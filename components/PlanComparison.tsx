'use client';

import { ArrowRight, ArrowRightLeft, BookOpen, BriefcaseBusiness, Check, Minus, Plus, Sparkles } from 'lucide-react';
import type { PlanResponse } from '../types/ui-plan';
import { comparePlans, quarterLabel } from '../lib/plan-comparison';

type Props = { previous: PlanResponse; current: PlanResponse; showingPrevious: boolean; onSelect: (previous: boolean) => void };
function Changes({ added, removed, updated = [] }: { added: string[]; removed: string[]; updated?: string[] }) {
  if (!added.length && !removed.length && !updated.length) return <p className="comparison-unchanged"><Check size={13}/> No changes</p>;
  return <ul className="comparison-changes">{added.map(item => <li className="change-added" key={`add:${item}`}><Plus size={13}/><span>{item}</span><b>Added</b></li>)}{removed.map(item => <li className="change-removed" key={`remove:${item}`}><Minus size={13}/><span>{item}</span><b>Removed</b></li>)}{updated.map(item => <li className="change-moved" key={`update:${item}`}><ArrowRightLeft size={13}/><span>{item}</span><b>Updated</b></li>)}</ul>;
}
export function PlanComparison({ previous, current, showingPrevious, onSelect }: Props) {
  const diff = comparePlans(previous, current);
  const sameGoal = previous.request.target_role === current.request.target_role;
  return <section className="plan-comparison" aria-labelledby="comparison-title">
    <div className="comparison-heading"><div><p className="eyebrow"><Sparkles size={13}/> YOUR ROUTE, REIMAGINED</p><h2 id="comparison-title">What changed?</h2><p>Two real plans. A clear view of your next move.</p></div><span className="comparison-live"><span/> Compared from your results</span></div>
    <div className="comparison-context"><div><small>BEFORE</small><b>{previous.request.target_role}</b><span>{previous.request.majors.join(' + ')} · {previous.request.max_courses_per_term} courses / term · {previous.request.completed_courses.length} completed</span></div><ArrowRight size={20}/><div><small>AFTER{sameGoal ? ' · SAME GOAL' : ' · NEW DIRECTION'}</small><b>{current.request.target_role}</b><span>{current.request.majors.join(' + ')} · {current.request.max_courses_per_term} courses / term · {current.request.completed_courses.length} completed</span></div></div>
    <div className="comparison-stats">{[{ label: 'Courses added', value: diff.courses.added.length, tone: 'added' }, { label: 'Courses removed', value: diff.courses.removed.length, tone: 'removed' }, { label: 'Courses moved', value: diff.moved.length, tone: 'moved' }].map(stat => <div className={`comparison-stat ${stat.tone}`} key={stat.label}><b>{stat.value}</b><span>{stat.label}</span></div>)}</div>
    {diff.academicUnchanged && <p className="comparison-honest"><Check size={16}/><span><b>Your academic schedule stayed the same.</b> Your current inputs produced the same course placements. Career changes, if any, appear below.</span></p>}
    <details className="comparison-details" open={!diff.academicUnchanged}><summary><BookOpen size={15}/> Academic changes <span>{diff.courses.added.length + diff.courses.removed.length + diff.moved.length}</span></summary><Changes {...diff.courses}/>{diff.moved.length > 0 && <ul className="comparison-changes">{diff.moved.map(m => <li className="change-moved" key={m.code}><ArrowRightLeft size={13}/><span><b>{m.code}</b> {quarterLabel(m.from)} → {quarterLabel(m.to)}</span><b>Moved</b></li>)}</ul>}</details>
    <div className="comparison-career"><section><h3><Sparkles size={15}/> Skills</h3><Changes {...diff.skills} updated={diff.updatedSkills}/></section><section><h3><BriefcaseBusiness size={15}/> Projects</h3><Changes {...diff.projects} updated={diff.updatedProjects}/></section><section><h3><ArrowRightLeft size={15}/> Milestones & timing</h3><Changes {...diff.milestones} updated={diff.updatedMilestones}/></section></div>
    <div className="comparison-footer"><span>{showingPrevious ? 'Viewing the previous plan · read only' : 'Viewing your current plan'} · Comparison stays in this session</span><div role="group" aria-label="Choose plan to inspect"><button type="button" aria-pressed={showingPrevious} onClick={() => onSelect(true)}>View previous plan</button><button type="button" aria-pressed={!showingPrevious} onClick={() => onSelect(false)}>View current plan <ArrowRight size={13}/></button></div></div>
  </section>;
}
