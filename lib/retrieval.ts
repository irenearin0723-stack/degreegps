import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { RetrievedSourceDto } from '../types/ask';
import { openaiClient } from './ai';
import { buildCorpus, chunkHash, CORPUS_FILES, extractCourseIds, type Corpus, type CorpusChunk } from './rag-corpus';

export type RetrievedSource = RetrievedSourceDto;
export interface RetrievalFilters { official_only?: boolean; major?: string; effective_after?: string }
export interface RetrievalOptions {
  limit?: number;
  // Sends the query text to the embedding provider. Callers opt in; the default is local keyword ranking.
  use_embeddings?: boolean;
  boost_course_ids?: string[];
  directory?: string;
  // Per-request sources ranked with the corpus (e.g. the student's plan). Keyword-ranked only; never embedded.
  extra_chunks?: CorpusChunk[];
}
export interface RetrievalResult { sources: RetrievedSource[]; mode: 'hybrid' | 'keyword'; warnings: string[] }

export const INDEX_PATH = 'index/embeddings.json';
export const EmbeddingIndexSchema = z.object({
  schema_version: z.literal('1.0.0'), model: z.string().min(1), dimensions: z.number().int().positive(),
  generated_at: z.iso.datetime(),
  chunks: z.array(z.object({ id: z.string(), content_sha256: z.string(), embedding: z.array(z.number()) }).strict()),
}).strict();
export type EmbeddingIndex = z.infer<typeof EmbeddingIndexSchema>;

interface Prepared {
  corpus: Corpus; terms: Map<string, number>[]; lengths: number[]; average: number; df: Map<string, number>;
  index: EmbeddingIndex | null; vectors: Map<string, number[]>; warnings: string[];
  programs: { id: string; name: RegExp | null }[];
}
const STOP = new Set('a an and are as at be by can could do does for from get have how i if in is it me my need of on or should that the this to what when where which who why will with you your'.split(' '));
const cache = new Map<string, { signature: string; prepared: Promise<Prepared> }>();
// Program IDs that are also ordinary words only count when written in capitals ("INFO", not "more info").
const WORD_LIKE_PROGRAM_IDS = new Set(['INFO', 'ME', 'AA']);

function tokenize(value: string, prefixes: string[]): string[] {
  const words = value.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').split(' ')
    .filter(w => w.length > 1 && !STOP.has(w)).map(w => w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  return [...words, ...extractCourseIds(value, prefixes).map(id => id.replace(/ /g, '').toLowerCase())];
}
function unit(vector: number[]) {
  const norm = Math.hypot(...vector) || 1;
  return vector.map(v => v / norm);
}
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

async function prepare(directory: string): Promise<Prepared> {
  const corpus = await buildCorpus(directory);
  const terms = corpus.chunks.map(c => {
    const counts = new Map<string, number>();
    for (const t of tokenize(`${c.document_title} ${c.content}`, corpus.prefixes)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  });
  const lengths = terms.map(t => [...t.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  for (const t of terms) for (const term of t.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const warnings: string[] = [];
  let index: EmbeddingIndex | null = null;
  try { index = EmbeddingIndexSchema.parse(JSON.parse(await readFile(join(directory, INDEX_PATH), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push('RETRIEVAL_INDEX_INVALID: embedding index could not be read; keyword ranking used.'); }
  const vectors = new Map<string, number[]>();
  if (index) {
    const hashes = new Map(corpus.chunks.map(c => [c.id, chunkHash(c)]));
    for (const entry of index.chunks) if (hashes.get(entry.id) === entry.content_sha256) vectors.set(entry.id, unit(entry.embedding));
    if (vectors.size < corpus.chunks.length)
      warnings.push(`RETRIEVAL_INDEX_STALE: ${corpus.chunks.length - vectors.size} of ${corpus.chunks.length} sources lack current embeddings; run npm run build:index.`);
  }
  const programs = [...new Map(corpus.chunks.filter(c => c.program_id).map(c => [c.program_id!, c.program_name])).entries()].map(([id, name]) => {
    const base = name?.split(':')[0].trim().toLowerCase();
    return { id, name: base ? new RegExp(`\\b${base.replace(/[^a-z0-9 ]/g, '.')}\\b`) : null };
  });
  return { corpus, terms, lengths, average: lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1), df, index, vectors, warnings, programs };
}
/** Modification times of the corpus inputs, so edited data is picked up without a server restart. */
async function signature(directory: string) {
  const times = await Promise.all([...CORPUS_FILES, INDEX_PATH].map(file => stat(join(directory, file)).then(s => s.mtimeMs, () => 0)));
  return times.join(':');
}
async function prepared(directory = join(process.cwd(), 'data')) {
  const current = await signature(directory);
  const entry = cache.get(directory);
  if (entry?.signature === current) return entry.prepared;
  const next = prepare(directory);
  cache.set(directory, { signature: current, prepared: next });
  next.catch(() => { if (cache.get(directory)?.prepared === next) cache.delete(directory); });
  return next;
}
export async function loadRetrievalCorpus(directory?: string): Promise<Corpus> {
  return (await prepared(directory)).corpus;
}

/** Program IDs ("CS", "cs", "INFO") or program names ("Computer Science") named in the query. */
function mentionedPrograms(query: string, programs: Prepared['programs']): Set<string> {
  const lower = query.toLowerCase();
  const words = new Set(query.split(/[^A-Za-z0-9&_]+/));
  const lowerWords = new Set([...words].map(w => w.toLowerCase()));
  return new Set(programs.filter(({ id, name }) => words.has(id) || (!WORD_LIKE_PROGRAM_IDS.has(id) && lowerWords.has(id.toLowerCase())) || name?.test(lower))
    .map(p => p.id));
}

function passes(chunk: CorpusChunk, filters: RetrievalFilters) {
  if (filters.official_only && !chunk.official) return false;
  if (filters.major && chunk.program_id) {
    const major = filters.major.trim().toLowerCase();
    if (chunk.program_id.toLowerCase() !== major && chunk.program_name?.toLowerCase() !== major) return false;
  }
  if (filters.effective_after) {
    const date = chunk.effective_date ?? chunk.verified_at;
    if (!date || date < filters.effective_after) return false;
  }
  return true;
}

/** Ranks dataset-derived sources for explanation and discovery. Results must never override validated prerequisite rules. */
export async function retrieveSources(query: string, filters: RetrievalFilters = {}, options: RetrievalOptions = {}): Promise<RetrievalResult> {
  const p = await prepared(options.directory);
  const { chunks, prefixes } = p.corpus;
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 10);
  const warnings = options.use_embeddings ? [...p.warnings] : [];
  const queryTerms = [...new Set(tokenize(query, prefixes))];
  const mentioned = extractCourseIds(query, prefixes);
  const boosted = new Set(options.boost_course_ids ?? []);
  const programs = mentionedPrograms(query, p.programs);
  // "Which courses teach X?" asks for course records, not requirements that merely list courses.
  const wantsCourses = !mentioned.length && /\b(courses?|class(es)?)\b/i.test(query);
  // Questions about "my plan", "can I", "next quarter" prefer the student's own plan sources.
  const personal = /\b(my|me|i|i'm|plan|roadmap|next (quarter|term)|should i|can i)\b/i.test(query);
  const extra = (options.extra_chunks ?? []).map(chunk => {
    const terms = new Map<string, number>();
    for (const t of tokenize(`${chunk.document_title} ${chunk.content}`, prefixes)) terms.set(t, (terms.get(t) ?? 0) + 1);
    return { chunk, terms, length: [...terms.values()].reduce((a, b) => a + b, 0) };
  });
  // Plan sources answer questions about the student's plan, not general policy ("When does registration open?").
  const relevantExtra = extra.filter(({ chunk }) => personal || mentioned.some(id => chunk.course_ids.includes(id)));
  const candidates = [...chunks.map((chunk, i) => ({ chunk, terms: p.terms[i], length: p.lengths[i] })), ...relevantExtra].filter(({ chunk }) => passes(chunk, filters));

  const keyword = new Map<string, number>();
  for (const { chunk, terms, length } of candidates) {
    let score = 0;
    for (const term of queryTerms) {
      const tf = terms.get(term) ?? 0;
      if (!tf) continue;
      const df = p.df.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * length / p.average));
    }
    // An explicitly named course should surface its own catalog, plan and section records first.
    for (const id of mentioned) score += chunk.course_ids[0] !== id ? (chunk.course_ids.includes(id) ? 1 : 0)
      : chunk.kind === 'course' || chunk.kind === 'plan' ? 6 : chunk.kind === 'sections' ? 4 : 1;
    if (score > 0 && personal && chunk.kind === 'plan') score += 2;
    if (score > 0 && chunk.course_ids.some(id => boosted.has(id))) score += 0.5;
    // A named program ("CS", "Informatics") outranks other programs' similarly worded rules.
    if (score > 0 && chunk.program_id && programs.has(chunk.program_id)) score += 3;
    if (score > 0 && wantsCourses && chunk.kind === 'course') score += 1.5;
    if (score > 0) keyword.set(chunk.id, score);
  }
  const keywordRank = [...keyword.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  let semanticRank: string[] = [];
  if (options.use_embeddings && p.index && p.vectors.size) {
    if (!process.env.OPENAI_API_KEY) warnings.push('AI_UNAVAILABLE: no API key configured; keyword ranking used.');
    else try {
      const response = await openaiClient().embeddings.create({ model: p.index.model, dimensions: p.index.dimensions, encoding_format: 'float', input: query });
      const q = unit(response.data[0].embedding);
      semanticRank = candidates.flatMap(({ chunk }) => { const v = p.vectors.get(chunk.id); return v ? [{ id: chunk.id, score: dot(q, v) }] : []; })
        .sort((a, b) => b.score - a.score).slice(0, 20).map(s => s.id);
    } catch { warnings.push('RETRIEVAL_EMBEDDING_FAILED: query embedding failed or timed out; keyword ranking used.'); }
  } else if (options.use_embeddings && !p.index) warnings.push('RETRIEVAL_INDEX_MISSING: no embedding index; run npm run build:index. Keyword ranking used.');

  // Reciprocal-rank fusion keeps exact course-code matches competitive with semantic matches.
  const fused = new Map<string, number>();
  if (semanticRank.length) {
    keywordRank.slice(0, 20).forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (60 + rank)));
    semanticRank.forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (60 + rank)));
  } else for (const [id, score] of keyword) fused.set(id, score);
  const byId = new Map([...chunks, ...extra.map(e => e.chunk)].map(c => [c.id, c]));
  const sources = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, score]) => {
    const c = byId.get(id)!;
    return { id: c.id, kind: c.kind, document_title: c.document_title, content: c.content, source_url: c.source_url, section: c.section,
      verified_at: c.verified_at, effective_date: c.effective_date, official: c.official, score: Math.round(score * 10000) / 10000 };
  });
  return { sources, mode: semanticRank.length ? 'hybrid' : 'keyword', warnings: [...new Set(warnings)] };
}
