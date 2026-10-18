'use client';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, ExternalLink, Info, MapPinned, MessageCircleQuestion, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { PlanRequest as BackendPlanRequest } from '../types/plan';
import type { AskResponse, RetrievedSourceDto } from '../types/ask';
import { askQuestion, AskApiError } from '../lib/ask-api';

// plan: the plan's validated inputs, so answers can cite the student's own plan. Omitted for mock plans.
type Props = { courseIds: string[]; majors: string[]; plan?: BackendPlanRequest; blockedCourse?: string };

function SourceCard({ source, cited }: { source: RetrievedSourceDto; cited: boolean }) {
  const mine = source.kind === 'plan';
  return <article className={cited ? 'ask-source cited' : 'ask-source'}>
    <div className="ask-source-head">{mine ? <span className="source-pill plan"><MapPinned size={11} />Your plan</span>
      : <span className={`source-pill ${source.official ? 'verified' : 'pending'}`}>{source.official ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}{source.official ? 'Official data' : 'General guidance'}</span>}{cited && <b>Cited</b>}</div>
    <h4>{source.document_title}</h4>
    <p>{mine ? `Computed from your inputs on ${source.verified_at}` : source.verified_at ? `Checked ${source.verified_at}` : 'Verification date unavailable'}</p>
    {source.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">Open source <ExternalLink size={11} /></a> : <span className="no-source">{mine ? 'Not an official record' : 'No external link'}</span>}
  </article>;
}

/** Cited Q&A over the bundled UW data. AI is opt-in per question; the default answer is a verbatim source. */
export function AskPanel({ courseIds, majors, plan, blockedCourse }: Props) {
  const [question, setQuestion] = useState('');
  // AI answers are on by default in the UI; the checkbox and its disclosure let students switch to quoted records.
  const [useAi, setUseAi] = useState(true);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AskResponse>();
  const [error, setError] = useState<string>();
  const suggestions = [
    plan && 'What should I take next quarter?',
    plan && blockedCourse && `Why isn't ${blockedCourse} in my plan?`,
    !plan && courseIds[0] && `What are the prerequisites for ${courseIds[0]}?`,
    majors[0] && `What does the ${majors[0]} major require?`,
    'When does Winter 2027 registration open?',
  ].filter((s): s is string => Boolean(s)).slice(0, 4);

  async function ask(text: string) {
    if (pending) return;
    setQuestion(text); setPending(true); setError(undefined);
    try { setResult(await askQuestion({ question: text, plan_course_ids: courseIds, use_ai: useAi, ...(plan ? { plan } : {}), ...(majors.length === 1 ? { major: majors[0] } : {}) })); }
    catch (caught) { setResult(undefined); setError(caught instanceof AskApiError ? caught.message : 'Something went wrong. Please retry.'); }
    finally { setPending(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); if (question.trim().length >= 3) void ask(question.trim()); };
  const cited = result ? result.sources.filter(s => result.citations.includes(s.id)) : [];
  const related = result ? result.sources.filter(s => !result.citations.includes(s.id)) : [];

  return <section className="ask-section" aria-labelledby="ask-title">
    <div className="section-title"><div><p className="eyebrow">ASK ABOUT YOUR ROUTE</p><h2 id="ask-title">Questions, answered from UW sources</h2></div></div>
    <form className="ask-form" onSubmit={submit}>
      <label className="ask-input"><Search size={15} /><span className="sr-only">Your question</span>
        <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} placeholder="e.g. Can informatics majors take CSE 312?" /></label>
      <button className="button primary" type="submit" disabled={pending || question.trim().length < 3}>{pending ? 'Searching…' : 'Ask'}</button>
    </form>
    <label className="ask-ai-toggle"><input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} /><span><Sparkles size={12} /> Write the answer with AI. This sends your question, the matching public UW records and, for questions about your plan, your plan’s course statuses (never grades) to an external AI provider. Don’t include personal details.</span></label>
    {suggestions.length > 0 && !result && <div className="ask-suggestions">{suggestions.map(s => <button key={s} type="button" onClick={() => void ask(s)} disabled={pending}>{s}</button>)}</div>}
    <div aria-live="polite">
      {error && <div className="ask-error"><AlertTriangle size={14} /><p>{error}</p></div>}
      {result && <div className="ask-result">
        <div className="ask-answer">
          <span className={`ask-mode ${result.mode}`}>{result.mode === 'ai' ? <><Sparkles size={11} /> AI answer, checked against sources</> : <><MessageCircleQuestion size={11} /> Closest matching record, quoted</>}</span>
          <p>{result.answer ?? 'No bundled UW record answers this question. Try naming a course (e.g. CSE 311), major, or policy.'}</p>
          {result.insufficient_evidence && result.answer && <small>The sources only partly cover this question.</small>}
        </div>
        {result.warnings.length > 0 && <div className="ask-warnings">{result.warnings.map(w => { const [, code, message] = /^([A-Z_]+): (.*)$/s.exec(w) ?? [, 'NOTICE', w];
          return <div key={w} className="warning-row info"><Info size={13} /><div><b>{code.replaceAll('_', ' ')}</b><p>{message}</p></div></div>; })}</div>}
        {cited.length > 0 && <div className="ask-sources">{cited.map(s => <SourceCard key={s.id} source={s} cited />)}</div>}
        {related.length > 0 && <details className="ask-related"><summary>{related.length} other related source{related.length === 1 ? '' : 's'}</summary><div className="ask-sources">{related.map(s => <SourceCard key={s.id} source={s} cited={false} />)}</div></details>}
        <p className="ask-disclaimer">{result.disclaimer}</p>
      </div>}
    </div>
  </section>;
}
