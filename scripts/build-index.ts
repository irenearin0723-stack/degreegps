// Embeds the retrieval corpus into data/index/embeddings.json. Only changed chunks are re-embedded.
// Usage: npm run build:index [-- --check | --rebuild]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { openaiClient } from '../lib/ai';
import { buildCorpus, chunkHash, embeddingText } from '../lib/rag-corpus';
import { EmbeddingIndexSchema, INDEX_PATH, type EmbeddingIndex } from '../lib/retrieval';

async function withRetry<T>(call: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await call(); }
    catch (error) {
      const status = (error as { status?: number }).status;
      if (attempt >= attempts || !(status === 429 || (status ?? 0) >= 500)) throw error;
      console.warn(`Embedding request failed with ${status}; retrying in ${attempt * 10}s.`);
      await new Promise(resolve => setTimeout(resolve, attempt * 10_000));
    }
  }
}

async function main() {
  const check = process.argv.includes('--check');
  const rebuild = process.argv.includes('--rebuild');
  const directory = join(process.cwd(), 'data');
  const path = join(directory, INDEX_PATH);
  const { chunks } = await buildCorpus(directory);
  let existing: EmbeddingIndex | null = null;
  try { existing = EmbeddingIndexSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`Existing index is invalid and will be rebuilt: ${error}`); }
  const model = (rebuild ? undefined : existing?.model) ?? process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const dimensions = (rebuild ? undefined : existing?.dimensions) ?? Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 512);
  const reusable = new Map((rebuild ? [] : existing?.chunks ?? []).map(c => [c.id, c]));
  const stale = chunks.filter(c => reusable.get(c.id)?.content_sha256 !== chunkHash(c));
  const removed = [...reusable.keys()].filter(id => !chunks.some(c => c.id === id));
  console.log(`${chunks.length} corpus chunks; ${stale.length} need embeddings; ${removed.length} index entries are obsolete.`);
  if (check) { process.exitCode = stale.length || removed.length || !existing ? 1 : 0; return; }
  if (!stale.length && !removed.length && existing) return console.log('Index is current.');
  if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY is required to embed chunks (set it in .env.local).'); process.exitCode = 1; return; }
  const fresh = new Map<string, number[]>();
  for (let i = 0; i < stale.length; i += 64) {
    const batch = stale.slice(i, i + 64);
    const response = await withRetry(() => openaiClient().embeddings.create({ model, dimensions, encoding_format: 'float', input: batch.map(embeddingText) }));
    if (response.data.length !== batch.length) throw new Error(`Expected ${batch.length} embeddings, received ${response.data.length}.`);
    // Gemini's OpenAI-compatible endpoint omits index 0, so fall back to response order.
    response.data.forEach((d, position) => fresh.set(batch[d.index ?? position].id, d.embedding.map(v => Math.round(v * 1e5) / 1e5)));
    console.log(`Embedded ${Math.min(i + 64, stale.length)}/${stale.length}`);
  }
  const index = EmbeddingIndexSchema.parse({
    schema_version: '1.0.0', model, dimensions, generated_at: new Date().toISOString(),
    chunks: chunks.map(c => ({ id: c.id, content_sha256: chunkHash(c), embedding: fresh.get(c.id) ?? reusable.get(c.id)!.embedding })),
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(index)}\n`);
  console.log(`Wrote ${path} (${model}, ${dimensions} dimensions).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
