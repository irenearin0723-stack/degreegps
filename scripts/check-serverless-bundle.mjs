import { readFile, writeFile, mkdir, mkdtemp, copyFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// Reconstruct ONLY traced function files, with no node_modules symlink or source data fallback.
const root = process.cwd();
const routes = ['plan', 'ask', 'goal', 'transcript', 'plan/mock'];
const staging = await mkdtemp(join(tmpdir(), 'degreegps-serverless-'));
const files = new Set();
const bundles = [];
for (const route of routes) {
  const entry = resolve(`.next/server/app/api/${route}/route.js`);
  const trace = JSON.parse(await readFile(`${entry}.nft.json`, 'utf8'));
  const paths = [entry, ...trace.files.map(file => resolve(dirname(entry), file))];
  let bytes = 0;
  for (const source of paths) {
    const path = relative(root, source);
    assert.ok(!path.startsWith(`..${sep}`) && !path.startsWith('/'), 'Function trace escaped project');
    assert.ok(!/(^|\/)\.env(?:\.|$)|\.DS_Store|data\/archive\//.test(path), `Private/unneeded file traced: ${path}`);
    if (files.has(source)) continue;
    files.add(source);
    const target = join(staging, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  for (const source of paths) bytes += (await stat(source)).size;
  assert.ok(bytes < 250 * 1024 * 1024, `${route}: function exceeds 250 MiB`);
  bundles.push({ route, files: paths.length, bytes });
}
const pdf = await PDFDocument.create(); const page = pdf.addPage(); const font = await pdf.embedFont(StandardFonts.Helvetica);
['AUTUMN 2026', 'CSE 123 PROGRAMMING 5.0 3.8'].forEach((line, i) => page.drawText(line, { x: 40, y: 700 - 25 * i, size: 12, font }));
await writeFile(join(staging, 'synthetic.pdf'), await pdf.save());
await writeFile(join(staging, 'verify.cjs'), `
const assert = require('node:assert/strict');
const fs = require('node:fs');
const route = name => require('./.next/server/app/api/'+name+'/route.js').routeModule.userland;
let outbound=0;
global.fetch=async()=>{outbound++;throw new Error('External request forbidden in free bundle test')};
async function post(name,body){const response=await route(name).POST(new Request('https://demo.example/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,200);return response.json()}
(async()=>{
const request={major:'Computer Science + Applied Mathematics',completed_courses:['CSE 123','MATH 126'],reviewed_grades:{'CSE 123':3.8,'MATH 126':3.4},in_progress_courses:[],goal:{type:'internship',track:'ml',deadline:'2027-06-01'},max_courses_per_term:2,start_term:'2027-winter',graduation_term:'2029-spring',use_ai_explanation:true};
const plan=await post('plan',request);assert.equal(plan.mode,'generated');assert.equal(plan.quarters.length,8);assert.ok(plan.sources.length);assert.ok(plan.warnings.some(w=>/disabled/.test(w.message)));
const ask=await post('ask',{question:'What should I take next quarter?',plan:request,use_ai:true});assert.equal(ask.mode,'deterministic');assert.equal(ask.retrieval,'keyword');assert.ok(ask.citations.length);assert.ok(ask.sources.some(s=>s.kind==='plan'));assert.ok(ask.warnings.some(w=>w.includes('AI_DISABLED')));
const goal=await post('goal',{text:'ML internship before 2027-06-01',use_ai:true});assert.equal(goal.mode,'deterministic');
const form=new FormData();form.set('file',new File([fs.readFileSync('synthetic.pdf')],'synthetic.pdf',{type:'application/pdf'}));
const response=await route('transcript').POST(new Request('https://demo.example/api/transcript',{method:'POST',body:form}));const transcript=await response.json();assert.equal(response.status,200,JSON.stringify(transcript));assert.ok(transcript.records.some(r=>r.course_id==='CSE 123'));assert.equal(transcript.user_confirmation_required,true);
const mock=await route('plan/mock').GET();assert.equal((await mock.json()).mode,'mock');
assert.equal(outbound,0);
console.log(JSON.stringify({isolated_bundle_passed:5,outbound_provider_requests:outbound,plan_quarters:plan.quarters.length,plan_bytes:Buffer.byteLength(JSON.stringify(plan)),rag_citations:ask.citations,pdf_confirmation:true}));
})().catch(error=>{console.error(error);process.exitCode=1});
`);
const run = spawnSync(process.execPath, [join(staging, 'verify.cjs')], { cwd: staging, encoding: 'utf8',
  env: { ...process.env, NODE_PATH: '', OPENAI_API_KEY: 'synthetic-key-that-must-never-be-used',
    DEGREEGPS_FREE_DEMO: 'true', NEXT_PUBLIC_FREE_DEMO: 'true', AI_RATE_GLOBAL_PER_DAY: '0' } });
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
console.log(JSON.stringify({ bundles, staging }, null, 2));
process.exitCode = run.status ?? 1;
