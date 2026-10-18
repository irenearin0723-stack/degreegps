'use client';
import { formatGoalDeadline } from '../types/goal';

import { AlertTriangle, ArrowLeft, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, ExternalLink, FolderGit2, Info, Map as MapIcon, RotateCcw, ShieldCheck, Sparkles, UserRound, Wrench } from 'lucide-react';
import type { CareerMilestone, PlanResponse, PlannedCourse } from '../types/ui-plan';
import { Badge } from './ui/badge';
import { AskPanel } from './AskPanel';
import { toBackendRequest } from '../lib/plan-api';

type Props = { plan: PlanResponse; onEdit: () => void; onRegenerate: () => void; accountName?:string; onAccount:()=>void; onExplain?: () => void; explaining?: boolean; explainError?: string };
const termNames = { autumn: 'Autumn', winter: 'Winter', spring: 'Spring', summer: 'Summer' };

function CourseCard({ course, plan }: { course: PlannedCourse; plan: PlanResponse }) {
  const sources = plan.sources.filter((source) => course.source_ids.includes(source.id));
  const validated = plan.mode==='generated'&&course.status!=='tentative'&&sources.some((source) => source.kind === 'official');
  return <article className="course-card"><div className="course-code"><span>{course.code.split(' ')[0]}</span><b>{course.code.split(' ').slice(1).join(' ')}</b></div><div className="course-copy"><div className="card-title"><h4>{course.title}</h4><span className={validated ? 'source-pill verified' : 'source-pill pending'}>{validated ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}{validated ? 'Validated' : 'Tentative'}</span></div><p>{course.rationale}</p><div className="course-meta"><span>{course.category.replace('_', ' ')}</span><span>{course.credits === null ? 'Credits pending' : `${course.credits} credits`}</span><span>{course.status.replace('_', ' ')}</span></div>{sources.map((source) => source.url && <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={11} /></a>)}</div></article>;
}

type Warning = PlanResponse['warnings'][number];
const severityOrder: Record<Warning['severity'], number> = { blocking: 0, warning: 1, info: 2 };
const WARNINGS_SHOWN = 2;
/** One group per warning code, most severe first, so a long list of similar notices stays readable. */
function groupWarnings(warnings: Warning[]) {
  const groups = new Map<string, Warning[]>();
  for (const warning of warnings) groups.set(warning.code, [...(groups.get(warning.code) ?? []), warning]);
  return [...groups].map(([code, items]) => ({ code, items, severity: items.reduce((worst, w) => severityOrder[w.severity] < severityOrder[worst] ? w.severity : worst, items[0].severity) }))
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
function WarningRow({ warning }: { warning: Warning }) {
  return <div className={`warning-row ${warning.severity}`}><Info size={14} /><div><p>{warning.message}</p></div></div>;
}
function WarningGroup({ code, items, severity }: { code: string; items: Warning[]; severity: Warning['severity'] }) {
  const hidden = items.slice(WARNINGS_SHOWN);
  return <div className={`warning-group ${severity}`}>
    <div className="warning-group-head"><b>{code.replaceAll('_', ' ')}</b>{items.length > 1 && <span className="warning-count">{items.length}</span>}</div>
    {items.slice(0, WARNINGS_SHOWN).map((warning) => <WarningRow key={warning.message} warning={warning} />)}
    {hidden.length > 0 && <details className="warning-more"><summary>Show {hidden.length} more</summary>{hidden.map((warning) => <WarningRow key={warning.message} warning={warning} />)}</details>}
  </div>;
}

function MilestoneCard({ milestone }: { milestone: CareerMilestone }) {
  return <article className="milestone-card"><div className="milestone-head"><span className={`milestone-status ${milestone.status}`}>{milestone.status === 'done' ? <CheckCircle2 size={14} /> : <BriefcaseBusiness size={14} />}</span><div><h4>{milestone.title}</h4><p>{milestone.description}</p></div></div><ul>{milestone.action_items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}

export function PlanDashboard({ plan, onEdit, onRegenerate, accountName, onAccount, onExplain, explaining, explainError }: Props) {
  const milestoneMap = new Map<string, CareerMilestone[]>();
  plan.career_milestones.forEach((milestone) => milestoneMap.set(milestone.quarter_id, [...(milestoneMap.get(milestone.quarter_id) ?? []), milestone]));
  const officialCount = plan.sources.filter((source) => source.kind === 'official').length;
  const courseIds = [...new Set(plan.quarters.flatMap((quarter) => quarter.courses.map((course) => course.code)))];
  const recommendedSkills=plan.recommended_skills??[];
  const recommendedProjects=plan.recommended_projects??[];
  // The ask service regenerates this plan from its inputs; legacy saved plans that no longer validate get catalog-only answers.
  const planInputs = (() => { if (plan.mode === 'mock') return undefined; try { return toBackendRequest(plan.request); } catch { return undefined; } })();
  const blockedCourse = plan.warnings.find((warning) => ['COURSE_REVIEW_REQUIRED', 'COURSE_BLOCKED', 'NEEDS_GRADE_CONFIRMATION'].includes(warning.code))?.affected_course_codes[0];
  return <main className="dashboard-page"><header className="dashboard-header"><button className="back-button" onClick={onEdit}><ArrowLeft size={16} /> Edit inputs</button><div className="dash-actions"><Badge variant={plan.mode === 'mock' ? 'mock' : 'generated'}>{plan.mode === 'mock' ? 'DEMO · UNVERIFIED' : 'GENERATED PLAN'}</Badge><button className="button secondary" onClick={onRegenerate}><RotateCcw size={15} /> Regenerate</button><button className="button secondary" onClick={onAccount}><UserRound size={15}/>{accountName??'Save plan'}</button></div></header>
    <section className="destination-card"><div className="destination-icon"><MapIcon size={23} /></div><div><span>YOUR DESTINATION</span><h1>{plan.request.target_role}</h1><p>{formatGoalDeadline(plan.request.goal_draft, plan.request.target_summer)} · {plan.request.majors.join(' + ')}</p></div><div className="destination-stats"><span><b>{plan.quarters.length}</b> terms mapped</span><span><b>{officialCount}</b> official sources</span></div></section>
    {plan.summary && <section className="summary-section"><div><p className="eyebrow">PLAN SUMMARY</p><p>{plan.summary}</p>{explainError ? <small className="summary-error">{explainError}</small> : onExplain && plan.mode !== 'mock' && <small>AI explanation sends your goal, preferences and planned courses to an external AI provider. It can quote official policy records but never changes courses or eligibility.</small>}</div>{onExplain && plan.mode !== 'mock' && <button className="button secondary" onClick={onExplain} disabled={explaining}><Sparkles size={15} />{explaining ? 'Explaining…' : 'Explain with AI'}</button>}</section>}
    {plan.warnings.length > 0 && <section className="warnings-panel"><div className="warning-title"><AlertTriangle size={18} /><div><b>Review before using this plan</b><span>{plan.warnings.length} planning notice{plan.warnings.length === 1 ? '' : 's'}</span></div></div><div className="warning-list">{groupWarnings(plan.warnings).map((group) => <WarningGroup key={group.code} {...group} />)}</div></section>}
    <section className="roadmap-section"><div className="section-title"><div><p className="eyebrow">INTEGRATED ROADMAP</p><h2>Academic path + career momentum</h2></div><div className="legend"><span><i className="academic-dot" />Academic</span><span><i className="career-dot" />Career</span></div></div><div className="plan-trust-note"><ShieldCheck size={14}/><span><b>Validated</b> means checked against an official source. <b>Tentative</b> means you must verify prerequisites and availability.</span></div><div className="timeline">{plan.quarters.map((quarter, index) => <section className="quarter" key={quarter.id}><div className="quarter-label"><span>{String(index + 1).padStart(2, '0')}</span><h3>{termNames[quarter.term]}<b>{quarter.year}</b></h3></div><div className="timeline-axis"><i /></div><div className="quarter-content"><div className="quarter-note"><CalendarDays size={14} /><span>{quarter.notes}</span></div><div className="tracks"><div className="track academic-track"><div className="track-heading"><BookOpen size={15} /><b>Academic</b><span>{quarter.courses.length}/{plan.request.max_courses_per_term} courses</span></div>{quarter.courses.length ? quarter.courses.map((course) => <CourseCard course={course} plan={plan} key={course.code} />) : <div className="empty-track">No academic courses planned for this term.</div>}</div><div className="track career-track"><div className="track-heading"><BriefcaseBusiness size={15} /><b>Career</b><span>{(milestoneMap.get(quarter.id) ?? []).length} milestones</span></div>{(milestoneMap.get(quarter.id) ?? []).length ? milestoneMap.get(quarter.id)?.map((milestone) => <MilestoneCard milestone={milestone} key={milestone.id} />) : <div className="empty-track">No career milestones returned for this term.</div>}</div></div></div></section>)}</div></section>
    {(recommendedSkills.length>0||recommendedProjects.length>0)&&<section className="growth-section"><div className="section-title"><div><p className="eyebrow">BUILD YOUR PROFILE</p><h2>Skills + projects recommended for this goal</h2></div></div><div className="growth-grid"><div><div className="growth-heading"><Wrench size={16}/><b>Skills to develop</b></div>{recommendedSkills.map(skill=><article className="skill-row" key={skill.name}><span>{skill.priority}</span><div><b>{skill.name}</b><p>{skill.reason}</p></div></article>)}</div><div><div className="growth-heading"><FolderGit2 size={16}/><b>Projects to build</b></div>{recommendedProjects.map(project=><article className="project-row" key={project.title}><b>{project.title}</b>{project.description&&<p>{project.description}</p>}<div>{project.skills.map(skill=><span key={skill}>{skill}</span>)}</div></article>)}</div></div></section>}
    <AskPanel courseIds={courseIds} majors={plan.request.majors} plan={planInputs} blockedCourse={blockedCourse} />
    <details className="sources-section"><summary className="section-title"><div><p className="eyebrow">PROVENANCE</p><h2>Sources used by this plan</h2></div><span className="sources-toggle">{plan.sources.length} sources · show</span></summary><div className="source-grid">{plan.sources.map((source) => <article key={source.id}><span className={`source-pill ${source.kind === 'official' ? 'verified' : 'pending'}`}>{source.kind}</span><h3>{source.title}</h3><p>{source.retrieved_at ? `Checked ${new Date(source.retrieved_at).toLocaleDateString()}` : 'Verification date unavailable'}</p>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a> : <span className="no-source">No external link</span>}</article>)}</div></details>
  </main>;
}
