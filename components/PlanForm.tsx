'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, BrainCircuit, Code2, Scale, Sparkles } from 'lucide-react';
import type { PlanRequest } from '../types/plan';
import { CourseInput } from './CourseInput';
import { TranscriptUpload } from './TranscriptUpload';

type Props = { onSubmit: (request: PlanRequest) => void; initial?: PlanRequest };

const defaultRequest: PlanRequest = {
  majors: ['Computer Science', 'Applied Mathematics'],
  completed_courses: ['CSE 123', 'MATH 126'],
  in_progress_courses: ['CSE 311', 'CSE 351', 'INFO 201'],
  target_role: 'Machine Learning Engineer Intern',
  target_summer: 2027,
  max_courses_per_term: 3,
  start_term: 'autumn',
  start_year: 2026,
  horizon_terms: 4,
};

export function PlanForm({ onSubmit, initial }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PlanRequest>(initial ?? defaultRequest);
  const update = <K extends keyof PlanRequest>(key: K, value: PlanRequest[K]) => setForm((current) => ({ ...current, [key]: value }));
  const roles = [
    { value: 'Machine Learning Engineer Intern', title: 'ML Engineer', note: 'Models, data & systems', icon: BrainCircuit },
    { value: 'Software Engineer Intern', title: 'Software Engineer', note: 'Products, systems & scale', icon: Code2 },
  ];

  return (
    <section className="planner-card">
      <div className="form-progress"><span>STEP {step} OF 3</span><div><i style={{ width: `${step * 33.33}%` }} /></div></div>
      {step === 1 && <div className="form-step">
        <p className="eyebrow">ACADEMIC PROFILE</p><h2>Start with where you are.</h2><p className="step-lede">Completed and in-progress courses stay separate so the backend never treats unfinished work as a satisfied prerequisite.</p>
        <div className="field-group"><label>University</label><div className="locked-field"><span>University of Washington</span><b>UW</b></div></div>
        <div className="two-fields"><div className="field-group"><label>Primary major</label><select value={form.majors[0]} onChange={(event) => update('majors', [event.target.value, ...form.majors.slice(1)])}><option>Computer Science</option><option>Applied Mathematics</option><option>Informatics</option></select></div><div className="field-group"><label>Second major</label><select value={form.majors[1] ?? ''} onChange={(event) => update('majors', event.target.value ? [form.majors[0], event.target.value] : [form.majors[0]])}><option value="">None</option><option>Applied Mathematics</option><option>Computer Science</option><option>Informatics</option></select></div></div>
      </div>}
      {step === 2 && <div className="form-step">
        <p className="eyebrow">COURSE HISTORY</p><h2>What have you taken?</h2><p className="step-lede">Use official course codes where possible. The backend will normalize and validate them.</p>
        <TranscriptUpload onConfirm={(completed, inProgress) => { update('completed_courses', completed); update('in_progress_courses', inProgress); }} />
        <div className="manual-divider"><span>or enter courses manually</span></div>
        <CourseInput label="Completed courses" hint="These may satisfy prerequisites." values={form.completed_courses} blockedValues={form.in_progress_courses} onChange={(value) => update('completed_courses', value)} />
        <CourseInput label="Courses in progress" hint="These appear in the current term but do not count as completed yet." values={form.in_progress_courses} blockedValues={form.completed_courses} onChange={(value) => update('in_progress_courses', value)} />
      </div>}
      {step === 3 && <div className="form-step">
        <p className="eyebrow">DESTINATION & PACE</p><h2>Where should this route take you?</h2><p className="step-lede">The planner works backward from your internship target without letting career goals override academic rules.</p>
        <div className="role-grid">{roles.map(({ value, title, note, icon: Icon }) => <button type="button" key={value} className={form.target_role === value ? 'role-card active' : 'role-card'} onClick={() => update('target_role', value)}><Icon size={22} /><b>{title}</b><span>{note}</span></button>)}</div>
        <div className="two-fields"><div className="field-group"><label>Target summer</label><select value={form.target_summer} onChange={(event) => update('target_summer', Number(event.target.value))}><option>2027</option><option>2028</option><option>2029</option></select></div><div className="field-group"><label>Courses per term</label><select value={form.max_courses_per_term} onChange={(event) => update('max_courses_per_term', Number(event.target.value))}><option value="2">2 · Focused</option><option value="3">3 · Balanced</option><option value="4">4 · Ambitious</option></select></div></div>
        <div className="truth-note"><Scale size={19} /><div><b>Built for truthful planning</b><span>Unverified prerequisites, offerings, and degree requirements will be shown as warnings—not guesses.</span></div></div>
      </div>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={step === 1} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} /> Back</button>{step < 3 ? <button type="button" className="button primary" onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight size={16} /></button> : <button type="button" className="button primary sparkle" onClick={() => onSubmit(form)}>Generate roadmap <Sparkles size={16} /></button>}</div>
    </section>
  );
}
