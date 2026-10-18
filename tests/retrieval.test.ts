import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AskResponseSchema } from '../types/ask';
import { buildCorpus, chunkHash, extractCourseIds } from '../lib/rag-corpus';
import { INDEX_PATH, retrieveSources } from '../lib/retrieval';
import { explainPlan, quoteSource, ungroundedReasons } from '../lib/ai';
import { generatePlan } from '../lib/plan-service';
import { PlanRequestSchema, PlanResponseSchema } from '../types/plan';
import { answerQuestion } from '../lib/ask-service';
import { POST } from '../app/api/ask/route';

const req = (body: unknown, type = 'application/json') => new Request('http://localhost/api/ask', { method: 'POST', headers: { 'Content-Type': type }, body: JSON.stringify(body) });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const aiAnswer = (output: unknown) => json({ id: 'chatcmpl_test', object: 'chat.completion', created: 0, model: 'test',
  choices: [{ index: 0, finish_reason: 'stop', logprobs: null, message: { role: 'assistant', content: JSON.stringify(output), refusal: null } }] });
async function withOpenAi<T>(fetcher: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previousFetch = globalThis.fetch; const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key'; globalThis.fetch = fetcher;
  try { return await run(); }
  finally { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
}
async function withoutKey<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  try { return await run(); } finally { if (previous !== undefined) process.env.OPENAI_API_KEY = previous; }
}
async function dataCopy() {
  const directory = await mkdtemp(join(tmpdir(), 'degreegps-rag-'));
  await cp(join(process.cwd(), 'data'), directory, { recursive: true });
  await rm(join(directory, INDEX_PATH), { force: true });
  return directory;
}

test('corpus chunks are unique, cited, and derived only from bundled data', async () => {
  const { chunks, prefixes } = await buildCorpus();
  assert.equal(new Set(chunks.map(c => c.id)).size, chunks.length);
  assert.ok(chunks.filter(c => c.kind === 'course').length >= 64);
  for (const chunk of chunks.filter(c => c.official)) assert.match(chunk.source_url ?? '', /^https:\/\//, chunk.id);
  assert.ok(chunks.filter(c => c.kind === 'career_path').every(c => !c.official && c.source_url === null));
  assert.ok(prefixes.includes('CSE') && prefixes.includes('CS&SS'));
});

test('course codes are recognized only for known department prefixes', () => {
  const prefixes = ['CSE', 'MATH', 'CS&SS'];
  assert.deepEqual(extractCourseIds('Take cse311 after MATH 126 and CS&SS 321', prefixes), ['CSE 311', 'MATH 126', 'CS&SS 321']);
  assert.deepEqual(extractCourseIds('Earn over 180 credits and 2027 deadlines', prefixes), []);
});

const evaluation: [string, string | string[]][] = [
  ['What are the prerequisites for CSE 311?', 'course:CSE 311'],
  ['minimum grade cse331', 'course:CSE 331'],
  ['When does Winter 2027 registration open?', 'registration_policy:registration_periods'],
  ['Which 400-level courses count as CS core?', 'requirement:CS_CORE_400'],
  ['Can informatics majors take CSE 312?', 'sections:CSE 312'],
  ['Do I need an add code to add a class late?', 'registration_policy:late_add_codes'],
  ['What should I do to prepare for ML research?', 'career:research:ml'],
  ['Should I take INFO 280 or INFO 290?', 'policy_issue:INFO_VERSION'],
  ['Is there a calculus requirement for computer science?', 'requirement:CS_CALCULUS'],
  // Many STAT/MATH courses teach probability; this pairing identifies one course by its skills.
  ['Which course covers probability and computational complexity?', 'course:CSE 312'],
  ['Can I take INFO 340 at the same time as CSE 163?', 'course:INFO 340'],
  ['AMATH registration priority in period I', 'registration_policy:amath_priority'],
  ['How do I get an internship in software engineering?', 'career:internship:swe'],
  ['which 400 level courses count as cs core', 'requirement:CS_CORE_400'],
  ['Which courses teach probability?', ['course:MATH 394', 'course:STAT 394', 'course:STAT 390', 'course:IND E 315', 'course:CSE 312']],
  // Keyword ranking needs the data's own wording ("admission", not "apply"); embeddings close that gap.
  ['What cumulative GPA is required for Economics admission?', ['requirement:ECON_BS_ADMISSION_GPA', 'requirement:ECON_BA_ADMISSION_GPA']],
  ['Can I double major in CS and Computer Engineering?', 'policy_issue:CMPE_NO_DOUBLE_DEGREE'],
  ['Which physics courses are needed to apply to Mechanical Engineering?', ['requirement:ME_STD_ADMISSION_PHYSICS', 'requirement:ME_MECH_ADMISSION_PHYSICS']],
  ['HCDE application programming requirement', 'requirement:HCDE_STD_ADMISSION_PROGRAMMING'],
  ['What statistics course do I need for Applied Statistics admission?', 'requirement:STAT_APP_ADM_STATISTICS'],
  ['Do I need differential equations before entering Aeronautical engineering?', 'requirement:AA_ADMISSION_PRE_AUTUMN_DIFF_EQ'],
  ['What proof and analysis courses does the Mathematics BS require?', 'requirement:MATH_BS_FOUNDATIONS'],
  ['What GPA is required for ACMS admission?', 'policy_issue:ACMS_ADMISSION_GPA'],
  ['Which courses are joint-listed between CSE and EE?', 'policy_issue:CMPE_CS_JOINT_LISTED'],
  ['Industrial engineering statics requirement', ['requirement:ISE_STD_ADMISSION_STATICS', 'requirement:ISE_DS_ADMISSION_STATICS']],
  ['When are Computer Engineering application deadlines?', 'requirement:CMPE_ADMISSION_PROCESS'],
];
// Quality check on the live data: re-imports may reorder results, so any accepted source in the top three passes.
test('keyword retrieval places an expected source in the top three', async () => {
  const { chunks } = await buildCorpus();
  const ids = new Set(chunks.map(c => c.id));
  for (const [question, expected] of evaluation) {
    const accepted = [expected].flat();
    assert.ok(accepted.some(id => ids.has(id)), `${question}: none of ${accepted.join(', ')} exist in the corpus; update this case`);
    const { sources, mode } = await retrieveSources(question, {}, { limit: 3 });
    assert.equal(mode, 'keyword');
    assert.ok(sources.some(s => accepted.includes(s.id)), `${question} → ${sources.map(s => s.id).join(', ')}`);
  }
});

test('filters restrict majors and unofficial guidance without hiding course records', async () => {
  const info = await retrieveSources('What is the GPA requirement?', { major: 'Informatics' });
  assert.ok(info.sources.length && info.sources.every(s => !/^requirement:(CS|AMATH)_/.test(s.id)));
  const byId = await retrieveSources('What is the GPA requirement?', { major: 'cs' });
  assert.equal(byId.sources[0].id, 'requirement:CS_GPA');
  const official = await retrieveSources('prepare for ML research', { official_only: true });
  assert.ok(official.sources.every(s => s.official));
  const course = await retrieveSources('CSE 311 prerequisites', { major: 'Informatics' });
  assert.equal(course.sources[0].id, 'course:CSE 311');
});

test('grounding check rejects invented courses, dates, links, and missing citations', async () => {
  const { prefixes } = await buildCorpus();
  const { sources } = await retrieveSources('CSE 311 prerequisites', {}, { limit: 2 });
  const ok = { answer: 'CSE 311 requires CSE 123 or CSE 143 and MATH 126 or MATH 135.', citations: ['course:CSE 311'], insufficient_evidence: false };
  assert.deepEqual(ungroundedReasons(ok, sources, prefixes), []);
  assert.ok(ungroundedReasons({ ...ok, answer: 'Take CSE 999 first.' }, sources, prefixes).some(r => r.includes('CSE 999')));
  assert.ok(ungroundedReasons({ ...ok, answer: 'Register by 2026-01-01.' }, sources, prefixes).some(r => r.includes('dates')));
  assert.ok(ungroundedReasons({ ...ok, answer: 'See https://example.com' }, sources, prefixes).length);
  assert.ok(ungroundedReasons({ ...ok, citations: [] }, sources, prefixes).includes('no citations'));
  assert.ok(ungroundedReasons({ ...ok, citations: ['course:CSE 999'] }, sources, prefixes).length);
});

test('without a key, ask returns a cited extractive answer and never calls the network', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network must not be used'); };
  try {
    const result = await withoutKey(() => answerQuestion({ question: 'What are the prerequisites for CSE 311?', use_ai: true }));
    assert.equal(AskResponseSchema.safeParse(result).success, true);
    assert.equal(result.mode, 'deterministic'); assert.equal(result.retrieval, 'keyword');
    assert.deepEqual(result.citations, ['course:CSE 311']);
    assert.ok(result.answer?.startsWith('CSE 311: Foundations of Computing I.'));
    assert.ok(result.warnings.some(w => w.startsWith('AI_UNAVAILABLE')));
    const none = await answerQuestion({ question: 'zzzz qqqq xxxx' });
    assert.equal(none.answer, null); assert.equal(none.insufficient_evidence, true);
  } finally { globalThis.fetch = previousFetch; }
});

test('AI answers are accepted only when grounded in cited sources', async () => {
  const fetcher = (output: unknown) => (async () => aiAnswer(output)) as typeof fetch;
  const grounded = await withOpenAi(fetcher({ answer: 'CSE 311 needs CSE 123 or CSE 143 plus MATH 126 or MATH 135, each with a 2.0.', citations: ['S1'], insufficient_evidence: false }),
    () => answerQuestion({ question: 'What are the prerequisites for CSE 311?', use_ai: true }));
  assert.equal(grounded.mode, 'ai'); assert.deepEqual(grounded.citations, ['course:CSE 311']);
  const invented = await withOpenAi(fetcher({ answer: 'Take CSE 999 first; you are guaranteed a seat.', citations: ['S1'], insufficient_evidence: false }),
    () => answerQuestion({ question: 'What are the prerequisites for CSE 311?', use_ai: true }));
  assert.equal(invented.mode, 'deterministic');
  assert.ok(!invented.answer?.includes('CSE 999'));
  assert.ok(invented.warnings.some(w => w.includes('rejected')));
  const offline = await withOpenAi((async () => { throw new Error('Offline test'); }) as typeof fetch,
    () => answerQuestion({ question: 'What are the prerequisites for CSE 311?', use_ai: true }));
  assert.equal(offline.mode, 'deterministic'); assert.ok(offline.warnings.some(w => w.includes('failed')));
});

test('embedding index enables hybrid retrieval and stale entries are ignored', async () => {
  const directory = await dataCopy();
  try {
    const { chunks } = await buildCorpus(directory);
    const target = chunks.find(c => c.id === 'registration_policy:late_add_codes')!;
    const stale = chunks.find(c => c.id === 'course:CSE 311')!;
    await mkdir(join(directory, 'index'), { recursive: true });
    await writeFile(join(directory, INDEX_PATH), JSON.stringify({ schema_version: '1.0.0', model: 'test-embedding', dimensions: 3, generated_at: '2026-10-17T00:00:00.000Z',
      chunks: [{ id: target.id, content_sha256: chunkHash(target), embedding: [1, 0, 0] }, { id: stale.id, content_sha256: 'outdated', embedding: [1, 0, 0] }] }));
    let embeddedQuery: unknown;
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.match(String(url), /\/embeddings$/);
      const { model, dimensions, input } = JSON.parse(String(init?.body));
      embeddedQuery = { model, dimensions, input };
      return json({ object: 'list', model: 'test-embedding', usage: { prompt_tokens: 1, total_tokens: 1 }, data: [{ object: 'embedding', index: 0, embedding: [0.9, 0.1, 0] }] });
    }) as typeof fetch;
    // No keyword overlap with the target chunk: only the embedding can surface it.
    const result = await withOpenAi(fetcher, () => retrieveSources('belated enrollment permission', {}, { use_embeddings: true, directory }));
    assert.equal(result.mode, 'hybrid');
    assert.ok(result.sources.some(s => s.id === target.id));
    assert.ok(result.warnings.some(w => w.startsWith('RETRIEVAL_INDEX_STALE')));
    assert.deepEqual(embeddedQuery, { model: 'test-embedding', dimensions: 3, input: 'belated enrollment permission' });
    const local = await retrieveSources('belated enrollment permission', {}, { directory });
    assert.equal(local.mode, 'keyword'); assert.deepEqual(local.warnings, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('ask endpoint validates input and returns private structured responses', async () => {
  const ok = await POST(req({ question: 'When does Winter 2027 registration open?' }));
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  const body = AskResponseSchema.parse(await ok.json());
  assert.equal(body.citations[0], 'registration_policy:registration_periods');
  assert.equal((await POST(req({ question: 'hi' }))).status, 400);
  assert.equal((await POST(req({ question: 'CSE 311?', extra: true }))).status, 400);
  assert.equal((await POST(req({ question: 'CSE 311?', plan_course_ids: ['not a course'] }))).status, 400);
  assert.equal((await POST(req({ question: 'CSE 311?' }, 'text/plain'))).status, 415);
});

test('AI plan explanations may quote retrieved policy records verbatim and cite them', async () => {
  const request = PlanRequestSchema.parse({ major: 'Computer Science', completed_courses: ['CSE 123', 'MATH 126'], in_progress_courses: [],
    goal: { type: 'internship', track: 'ml', deadline: '2027-06-01' }, start_term: '2027-winter', max_courses_per_term: 2, use_ai_explanation: true });
  const now = new Date('2026-10-17T18:00:00Z');
  const choose = (sentence_ids: string[]) => (async () => aiAnswer({ sentence_ids })) as typeof fetch;
  const cited = await withOpenAi(choose(['policy_1', 'academic']), () => generatePlan(request, { now }));
  assert.equal(PlanResponseSchema.safeParse(cited).success, true);
  const added = cited.sources.filter(s => s.id.startsWith('retrieved:'));
  assert.equal(added.length, 1);
  assert.ok(cited.plan_summary?.includes(`${added[0].title}:`));
  assert.ok(cited.plan_summary?.endsWith('No placement or graduation outcome is guaranteed.'));
  const invented = await withOpenAi(choose(['policy_9']), () => generatePlan(request, { now }));
  assert.ok(!invented.sources.some(s => s.id.startsWith('retrieved:')));
  assert.ok(invented.warnings.some(w => w.code === 'AI_UNAVAILABLE'));
  const blocked = await generatePlan(request, { now, aiBlocked: 'AI_RATE_LIMITED: limit reached.' });
  assert.ok(blocked.warnings.some(w => w.code === 'AI_RATE_LIMITED'));
  const plain = await withoutKey(() => explainPlan(cited));
  assert.deepEqual(plain.cited, []);
});

test('policy quotes keep whole leading sentences', () => {
  const source = { document_title: 'T', content: 'First sentence. Second one is here. Third.' };
  assert.equal(quoteSource(source, 40), 'T: First sentence. Second one is here.');
  assert.equal(quoteSource(source, 5), 'T: First sentence.');
});
