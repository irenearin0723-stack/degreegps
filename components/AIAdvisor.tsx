'use client';

import {FormEvent,useState} from 'react';
import {ArrowUp,BookOpen,ShieldCheck,Sparkles,X} from 'lucide-react';
import type {PlanResponse} from '../types/ui-plan';

const answers:Record<string,string>={
 'Why is CSE 332 in this plan?':'CSE 332 is shown as a tentative next step because data structures and parallelism support both technical interviews and stronger ML systems work. DegreeGPS would verify its prerequisites and quarter availability before marking it Validated.',
 'Are these prerequisites verified?':'Not yet in this demo. The roadmap labels these courses Tentative because the live UW retrieval pipeline is not connected. In production, the planner would validate prerequisites against retrieved UW catalog records.',
 'How does this help the ML goal?':'The plan connects foundations, an ML-focused portfolio project, application tracking, and interview preparation. The point is not simply taking more classes—it is creating evidence for the Summer 2027 goal.'
};

export function AIAdvisor({plan,onClose}:{plan:PlanResponse;onClose:()=>void}){
 const [question,setQuestion]=useState(''),[messages,setMessages]=useState<{role:'user'|'advisor';text:string}[]>([{role:'advisor',text:`Ask me about ${plan.request.target_role}, a course recommendation, or what still needs verification.`}]);
 const ask=(text:string)=>{const clean=text.trim();if(!clean)return;setMessages(current=>[...current,{role:'user',text:clean},{role:'advisor',text:answers[clean]??'Based on this roadmap, I would compare the request with the student’s completed courses, planning constraints, and retrieved UW sources. This demo can explain the plan, but it will not invent a prerequisite or guarantee an outcome.'}]);setQuestion('')};
 const submit=(event:FormEvent)=>{event.preventDefault();ask(question)};
 return <div className="advisor-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><aside className="advisor-panel" role="dialog" aria-modal="true" aria-label="DegreeGPS AI Advisor"><header><div><span><Sparkles size={17}/></span><div><b>DegreeGPS Advisor</b><small>RAG-ready · Demo responses</small></div></div><button onClick={onClose} aria-label="Close advisor"><X size={18}/></button></header><div className="advisor-context"><ShieldCheck size={14}/><span>Answers must stay grounded in the plan and cited UW information.</span></div><div className="advisor-messages">{messages.map((message,index)=><div className={message.role} key={index}><b>{message.role==='advisor'?'Advisor':'You'}</b><p>{message.text}</p>{message.role==='advisor'&&index>0&&<a href="https://registrar.washington.edu/register/course-fundamentals/" target="_blank" rel="noreferrer"><BookOpen size={12}/> UW Registrar: Course prerequisites</a>}</div>)}</div><div className="advisor-prompts">{Object.keys(answers).map(prompt=><button key={prompt} onClick={()=>ask(prompt)}>{prompt}</button>)}</div><form onSubmit={submit}><input value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask about this roadmap…" aria-label="Ask the advisor"/><button type="submit" aria-label="Send question"><ArrowUp size={16}/></button></form></aside></div>;
}
