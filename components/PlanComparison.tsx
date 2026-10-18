'use client';

import {ArrowLeft,ArrowRight,BookOpen,BriefcaseBusiness,Check,Code2,FolderGit2,RefreshCw,Sparkles,Wrench} from 'lucide-react';
import type {PlanRequest} from '../types/plan';

const changes=[
 {icon:BookOpen,label:'Courses',before:'ML-oriented math and data electives',after:'Systems and software-design electives',note:'Core degree progress stays unchanged'},
 {icon:Wrench,label:'Skills',before:'Python, model evaluation, experiment design',after:'APIs, testing, system design',note:'Career skill emphasis changes'},
 {icon:FolderGit2,label:'Project',before:'UW course-demand forecasting model',after:'Full-stack course planning application',note:'Portfolio evidence changes'},
 {icon:BriefcaseBusiness,label:'Milestones',before:'ML fundamentals and model stories',after:'Algorithms, behavioral stories, system design',note:'Interview preparation changes'}
];

export function PlanComparison({request,onBack,onApply}:{request:PlanRequest;onBack:()=>void;onApply:(request:PlanRequest)=>void}){
 const next={...request,target_role:'Software Engineering Intern'};
 return <main className="comparison-page"><header><button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Back to roadmap</button><span>WHAT CHANGED?</span></header><section className="comparison-hero"><div><p className="eyebrow">INTERACTIVE REPLANNING</p><h1>New destination.<br/>Clear consequences.</h1><p>Alex changes the goal from ML Internship to SWE Internship. DegreeGPS keeps valid academic progress and highlights only the parts that should adapt.</p></div><div className="goal-swap"><span><Sparkles/>Before<b>ML Internship</b></span><ArrowRight/><span><Code2/>After<b>SWE Internship</b></span></div></section><section className="comparison-table"><div className="comparison-head"><span>Area</span><span>Original plan</span><span>Updated plan</span></div>{changes.map(({icon:Icon,label,before,after,note})=><article key={label}><div><Icon size={17}/><b>{label}</b><small>{note}</small></div><p>{before}</p><p className="changed">{after}</p></article>)}</section><div className="unchanged-note"><Check size={17}/><span><b>Preserved:</b> completed courses, in-progress courses, CS + AMATH requirements, workload limit, and target year.</span></div><footer><button className="button secondary" onClick={onBack}>Keep ML plan</button><button className="button primary" onClick={()=>onApply(next)}><RefreshCw size={15}/> Apply SWE goal and regenerate</button></footer></main>;
}
