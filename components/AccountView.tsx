'use client';
import { formatGoalDeadline } from '../types/goal';

import {ArrowRight,BookOpenCheck,BriefcaseBusiness,CalendarDays,LogOut,Map as MapIcon,UserRound} from 'lucide-react';
import type {PlanResponse} from '../types/ui-plan';
import type {DemoUser} from './AccountModal';

type Props={user:DemoUser;plan?:PlanResponse;onOpenPlan:()=>void;onNewPlan:()=>void;onBack:()=>void;onLogout:()=>void};

export function AccountView({user,plan,onOpenPlan,onNewPlan,onBack,onLogout}:Props){
  const milestones=plan?.career_milestones.length??0;
  const done=plan?.career_milestones.filter(item=>item.status==='done').length??0;
  return <main className="account-page"><header className="account-top"><button className="back-button" onClick={onBack}>← Back</button><button className="button secondary" onClick={onLogout}><LogOut size={15}/> Log out</button></header><section className="account-hero"><div className="account-avatar"><UserRound size={25}/></div><div><p className="eyebrow">MY DEGREEGPS</p><h1>Welcome back, {user.name}.</h1><span>{user.email} · Demo account</span></div></section>{plan?<><section className="progress-grid"><article><BookOpenCheck/><span>TERMS PLANNED</span><b>{plan.quarters.length}</b></article><article><BriefcaseBusiness/><span>CAREER MILESTONES</span><b>{milestones}</b></article><article><CalendarDays/><span>COMPLETED ACTIONS</span><b>{done}/{milestones}</b></article></section><section className="saved-plan-card"><div className="saved-plan-icon"><MapIcon size={23}/></div><div><span>SAVED ROADMAP</span><h2>{plan.request.target_role}</h2><p>{plan.request.majors.join(' + ')} · {formatGoalDeadline(plan.request.goal_draft, plan.request.target_summer)}</p><small>Last generated {new Date(plan.generated_at).toLocaleDateString()}</small></div><button className="button primary" onClick={onOpenPlan}>Check my progress <ArrowRight size={15}/></button></section></>:<section className="empty-account"><MapIcon size={28}/><h2>No roadmap saved yet.</h2><p>Create your first academic and career plan. It will appear here when you return.</p><button className="button primary" onClick={onNewPlan}>Build my roadmap <ArrowRight size={15}/></button></section>}</main>;
}
