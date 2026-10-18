import 'server-only';
import { externalAiEnabled, aiUnavailableWarning } from './ai-config';
import { AskRequestSchema, AskResponseSchema, type AskRequest, type AskResponse } from '../types/ask';
import { answerFromSources } from './ai';
import { generatePlan } from './plan-service';
import { planChunks } from './plan-context';
import type { CorpusChunk } from './rag-corpus';
import { loadRetrievalCorpus, retrieveSources } from './retrieval';

export const ASK_DISCLAIMER = 'Answers use only the dated UW data snapshot bundled with DegreeGPS. This is not an official degree audit or registration approval; confirm with an academic adviser.';

export async function answerQuestion(input: AskRequest, options: { directory?: string; now?: Date } = {}): Promise<AskResponse> {
  const request = AskRequestSchema.parse(input);
  const warnings: string[] = [];
  if (request.use_ai && !externalAiEnabled()) warnings.push(aiUnavailableWarning());
  const useAi = request.use_ai && externalAiEnabled();
  const corpus = await loadRetrievalCorpus(options.directory);

  // The plan is regenerated here from its inputs (deterministic, no AI) rather than trusted from the client.
  let personal: CorpusChunk[] = [];
  const courseIds = new Set(request.plan_course_ids);
  if (request.plan) {
    try {
      const plan = await generatePlan({ ...request.plan, use_ai_explanation: false }, { now: options.now });
      const titles = new Map(corpus.chunks.filter(c => c.kind === 'course').map(c => [c.course_ids[0], c.document_title]));
      personal = planChunks(plan, titles);
      for (const q of plan.quarters) for (const c of q.courses) courseIds.add(c.id);
    } catch { warnings.push('PLAN_CONTEXT_UNAVAILABLE: your plan could not be regenerated, so answers use catalog sources only.'); }
  }

  const retrieval = await retrieveSources(request.question, { major: request.major, official_only: request.official_only },
    { use_embeddings: useAi, boost_course_ids: [...courseIds], directory: options.directory, extra_chunks: personal });
  warnings.push(...retrieval.warnings);
  const { sources } = retrieval;
  const base = { schema_version: '1.0.0', retrieval: retrieval.mode, sources, disclaimer: ASK_DISCLAIMER } as const;
  if (!sources.length) return AskResponseSchema.parse({ ...base, mode: 'deterministic', answer: null, insufficient_evidence: true, citations: [],
    warnings: [...warnings, 'No bundled source matched this question. Try naming a course (e.g. CSE 311), major, or policy.'] });
  if (useAi) {
    const generated = await answerFromSources(request.question, sources, corpus.prefixes, [...courseIds]);
    if (generated.result) return AskResponseSchema.parse({ ...base, mode: 'ai', ...generated.result, warnings });
    if (generated.warning) warnings.push(generated.warning);
  }
  // Extractive fallback: the best-ranked record verbatim (its title is in sources[]), so nothing is paraphrased without AI opt-in.
  const top = sources[0];
  return AskResponseSchema.parse({ ...base, mode: 'deterministic', answer: top.content,
    insufficient_evidence: false, citations: [top.id], warnings: [...new Set(warnings)] });
}
