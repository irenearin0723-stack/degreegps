'use client';

import {FormEvent,useState} from 'react';
import {LockKeyhole,Mail,UserRound,X} from 'lucide-react';

export type DemoUser={name:string;email:string};
type Props={onClose:()=>void;onContinue:(user:DemoUser)=>void};

export function AccountModal({onClose,onContinue}:Props){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('student@uw.edu');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const submit=(event:FormEvent)=>{event.preventDefault();if(mode==='register'&&!name.trim()){setError('Enter your name.');return}if(!email.includes('@')){setError('Enter a valid email address.');return}if(password.length<6){setError('Use at least 6 characters.');return}onContinue({name:name.trim()||email.split('@')[0],email:email.trim().toLowerCase()})};
  return <div className="auth-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close" onClick={onClose} aria-label="Close"><X size={18}/></button><div className="auth-mark"><UserRound size={22}/></div><p className="eyebrow">YOUR DEGREEGPS</p><h2 id="auth-title">{mode==='login'?'Welcome back.':'Create your account.'}</h2><p>Save your roadmap and return later to check your academic and career progress.</p><div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Log in</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Create account</button></div><form onSubmit={submit}>{mode==='register'&&<label><span>Name</span><div><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></div></label>}<label><span>Email</span><div><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@uw.edu" autoComplete="email"/></div></label><label><span>Password</span><div><LockKeyhole size={16}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6+ characters" autoComplete={mode==='login'?'current-password':'new-password'}/></div></label>{error&&<span className="auth-error">{error}</span>}<button className="button primary" type="submit">{mode==='login'?'Log in':'Create account'}</button></form><small className="demo-auth-note"><LockKeyhole size={12}/> Hackathon demo: profile and roadmap are stored only in this browser. Production authentication requires the backend.</small></section></div>;
}
