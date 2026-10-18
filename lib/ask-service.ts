import 'server-only';
import { AskRequestSchema, AskResponseSchema, type AskRequest, type AskResponse } from '../types/ask';
import { answerFromSources } from './ai';
import { loadRetrievalCorpus, retrieveSources } from './retrieval';

export const ASK_DISCLAIMER = 'Answers use only the dated UW data snapshot bundled with DegreeGPS. This is not an official degree audit or registration approval; confirm with an academic adviser.';

export async function answerQuestion(input: AskRequest, options: { directory?: string } = {}): Promise<AskResponse> {
  const request = AskRequestSchema.parse(input);
  const warnings: string[] = [];
  if (request.use_ai && !process.env.OPENAI_API_KEY) warnings.push('AI_UNAVAILABLE: no API key configured; keyword retrieval and an extractive answer were returned.');
  const useAi = request.use_ai && !!process.env.OPENAI_API_KEY;
  const corpus = await loadRetrievalCorpus(options.directory);
  const retrieval = await retrieveSources(request.question, { major: request.major, official_only: request.official_only },
    { use_embeddings: useAi, boost_course_ids: request.plan_course_ids, directory: options.directory });
  warnings.push(...retrieval.warnings);
  const { sources } = retrieval;
  const base = { schema_version: '1.0.0', retrieval: retrieval.mode, sources, disclaimer: ASK_DISCLAIMER } as const;
  if (!sources.length) return AskResponseSchema.parse({ ...base, mode: 'deterministic', answer: null, insufficient_evidence: true, citations: [],
    warnings: [...warnings, 'No bundled source matched this question. Try naming a course (e.g. CSE 311), major, or policy.'] });
  if (useAi) {
    const generated = await answerFromSources(request.question, sources, corpus.prefixes, request.plan_course_ids);
    if (generated.result) return AskResponseSchema.parse({ ...base, mode: 'ai', ...generated.result, warnings });
    if (generated.warning) warnings.push(generated.warning);
  }
  // Extractive fallback: the best-ranked record verbatim (its title is in sources[]), so nothing is paraphrased without AI opt-in.
  const top = sources[0];
  return AskResponseSchema.parse({ ...base, mode: 'deterministic', answer: top.content,
    insufficient_evidence: false, citations: [top.id], warnings: [...new Set(warnings)] });
}
