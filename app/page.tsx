'use client';

import { useState } from 'react';
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, Compass, DatabaseZap, ShieldCheck, Sparkles } from 'lucide-react';
import type { PlanRequest, PlanResponse } from '../types/plan';
import { createPlan, PlanApiError } from '../lib/plan-api';
import { Logo } from '../components/Logo';
import { PlanForm } from '../components/PlanForm';
import { LoadingPlan } from '../components/LoadingPlan';
import { PlanDashboard } from '../components/PlanDashboard';

type View = 'landing' | 'planner' | 'loading' | 'dashboard' | 'error';

export default function Home() {
  const [view, setView] = useState<View>('landing');
  const [request, setRequest] = useState<PlanRequest>();
  const [plan, setPlan] = useState<PlanResponse>();
  const [error, setError] = useState<PlanApiError>();

  const generate = async (payload: PlanRequest) => {
    setRequest(payload); setError(undefined); setView('loading');
    try { setPlan(await createPlan(payload)); setView('dashboard'); }
    catch (caught) { setError(caught instanceof PlanApiError ? caught : new PlanApiError('Something went wrong.')); setView('error'); }
  };

  if (view === 'loading') return <LoadingPlan />;
  if (view === 'dashboard' && plan) return <PlanDashboard plan={plan} onEdit={() => setView('planner')} onRegenerate={() => generate(plan.request)} />;
  if (view === 'error') return <main className="error-view"><div><span><DatabaseZap size={24} /></span><p className="eyebrow">PLANNING SERVICE ERROR</p><h1>We couldn’t generate your route.</h1><p>{error?.message}</p>{error?.details?.map((detail) => <small key={detail}>{detail}</small>)}<div><button className="button secondary" onClick={() => setView('planner')}>Edit inputs</button>{request && <button className="button primary" onClick={() => generate(request)}>Try again</button>}</div></div></main>;

  return <><nav className="site-nav"><Logo /><div className="uw-label"><span /> Built for University of Washington</div><button className="button nav-button" onClick={() => setView('planner')}>Open planner <ArrowRight size={15} /></button></nav>{view === 'planner' ? <main className="planner-page"><aside className="planner-intro"><button className="text-link" onClick={() => setView('landing')}>← Back to overview</button><p className="eyebrow">BUILD YOUR ROUTE</p><h1>One plan for what you learn—and where it takes you.</h1><p>Enter your academic starting point and internship target. DegreeGPS returns the exact contract your backend owns.</p><div className="contract-points"><span><ShieldCheck size={17} /><b>No invented UW requirements</b></span><span><DatabaseZap size={17} /><b>Mock/API switch built in</b></span><span><Compass size={17} /><b>Four-term integrated route</b></span></div></aside><PlanForm initial={request} onSubmit={generate} /></main> : <main className="landing-page"><section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> ACADEMIC PLANNING, POINTED SOMEWHERE</p><h1>Your degree has a <em>destination.</em></h1><p>DegreeGPS connects UW coursework, prerequisite-aware planning, and internship preparation in one quarter-by-quarter route.</p><div className="hero-buttons"><button className="button primary large" onClick={() => setView('planner')}>Map my route <ArrowRight size={17} /></button><span>Demo-ready with a backend-safe mock fallback.</span></div></div><div className="hero-map"><div className="map-card"><div className="map-head"><div><span>YOUR DESTINATION</span><h2>ML Engineer Intern</h2></div><b>SUMMER ’27</b></div><div className="route-step done"><i>01</i><div><b>Build foundations</b><span>Coursework + core skills</span></div></div><div className="route-line" /><div className="route-step current"><i>02</i><div><b>Create proof</b><span>Portfolio + interview prep</span></div></div><div className="route-line dotted" /><div className="route-step"><i>03</i><div><b>Reach the destination</b><span>Internship or fallback project</span></div></div><div className="map-foot"><ShieldCheck size={15} /><span>Sources and uncertainty stay visible</span></div></div></div></section><section className="value-section"><div className="section-title"><div><p className="eyebrow">ONE ROUTE, TWO TRACKS</p><h2>Designed to be more than a chatbot.</h2></div></div><div className="value-grid"><article><span className="value-icon blue"><BookOpenCheck /></span><p>ACADEMIC</p><h3>Requirements without the scavenger hunt.</h3><span>Course load, status, sources, and warnings render directly from the backend contract.</span></article><article><span className="value-icon violet"><BriefcaseBusiness /></span><p>CAREER</p><h3>Work backward from the role you want.</h3><span>Projects, applications, and interview actions live beside each academic term.</span></article><article className="dark"><span className="value-icon"><Sparkles /></span><p>TRUST</p><h3>Know exactly what is verified.</h3><span>Mock plans are clearly labeled. Missing sources never become invented citations.</span></article></div></section></main>}</>;
}
