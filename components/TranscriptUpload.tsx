'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Check, FileText, LoaderCircle, LockKeyhole, Upload, X } from 'lucide-react';
import { parseTranscript, type DetectedTranscriptCourse } from '../lib/transcript-api';

type Props = {
  onConfirm: (completed: string[], inProgress: string[]) => void;
};

const allowedTypes = ['application/pdf'];
const maxBytes = 5 * 1024 * 1024;

export function TranscriptUpload({ onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File>();
  const [courses, setCourses] = useState<DetectedTranscriptCourse[]>([]);
  const [state, setState] = useState<'idle' | 'parsing' | 'review' | 'confirmed' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const chooseFile = async (candidate?: File) => {
    if (!candidate) return;
    if (!allowedTypes.includes(candidate.type)) return fail('Upload a text-based PDF transcript.');
    if (candidate.size > maxBytes) return fail('The transcript must be 5 MiB or smaller.');
    setFile(candidate); setState('parsing'); setMessage('Extracting course history…');
    try {
      const result = await parseTranscript(candidate);
      setCourses(result.detected_courses);
      setMessage(result.warnings[0] ?? 'Review all detected courses before continuing.');
      setState('review');
    } catch (error) { fail(error instanceof Error ? error.message : 'Transcript parsing failed.'); }
  };
  const fail = (text: string) => { setMessage(text); setState('error'); };
  const updateStatus = (id: string, status: DetectedTranscriptCourse['status']) => setCourses((current) => current.map((course) => course.id === id ? { ...course, status } : course));
  const remove = (id: string) => setCourses((current) => current.filter((course) => course.id !== id));
  const confirm = () => {
    const completed = courses.filter((course) => course.status === 'completed').map((course) => course.code);
    const inProgress = courses.filter((course) => course.status === 'in_progress').map((course) => course.code);
    onConfirm(completed, inProgress); setState('confirmed'); setMessage(`${completed.length + inProgress.length} courses added. You can edit them below.`);
  };
  const reset = () => { setFile(undefined); setCourses([]); setState('idle'); setMessage(''); if (inputRef.current) inputRef.current.value = ''; };

  return <section className="transcript-tool">
    <div className="transcript-heading"><div><span className="transcript-icon"><FileText size={17} /></span><div><b>Import from transcript</b><small>Optional · PDF only</small></div></div>{state !== 'idle' && <button type="button" onClick={reset}>Start over</button>}</div>
    {state === 'idle' || state === 'error' ? <div className={dragging ? 'drop-zone dragging' : 'drop-zone'} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files[0]); }}>
      <input ref={inputRef} type="file" accept=".pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      <Upload size={21} /><div><b>Drop your unofficial transcript here</b><span>or choose a file from your device · max 5 MiB</span></div><button type="button" onClick={() => inputRef.current?.click()}>Choose file</button>
    </div> : null}
    {state === 'parsing' && <div className="parse-progress"><LoaderCircle className="spin" size={23} /><div><b>{file?.name}</b><span>{message}</span><i><span /></i></div></div>}
    {state === 'review' && <div className="transcript-review"><div className="review-top"><div><Check size={15} /><b>{courses.length} courses detected</b></div><span>Review status before adding</span></div><div className="detected-list">{courses.map((course) => <div className="detected-row" key={course.id}><div><b>{course.code}</b><span>{course.term ?? 'Term unknown'}{course.grade ? ` · Grade ${course.grade}` : ''}</span>{course.review_reasons?.length ? <small>{course.review_reasons.join(' ')}</small> : null}</div><select aria-label={`Status for ${course.code}`} value={course.status} onChange={(event) => updateStatus(course.id, event.target.value as DetectedTranscriptCourse['status'])}><option value="completed">Completed</option><option value="in_progress">In progress</option><option value="uncertain">Needs review</option></select><span className={course.confidence !== null && course.confidence < .9 ? 'confidence low' : 'confidence'}>{course.confidence === null ? 'Review' : `${Math.round(course.confidence * 100)}%`}</span><button type="button" onClick={() => remove(course.id)} aria-label={`Remove ${course.code}`}><X size={14} /></button></div>)}</div><button type="button" className="button primary transcript-confirm" onClick={confirm} disabled={!courses.some((course) => course.status !== 'uncertain')}>Confirm and add courses <Check size={15} /></button></div>}
    {state === 'confirmed' && <div className="transcript-success"><Check size={16} /><span>{message}</span></div>}
    {state === 'error' && <div className="transcript-error"><AlertCircle size={14} /><span>{message}</span></div>}
    <div className="privacy-note"><LockKeyhole size={13} /><span>Your transcript is used only to extract course history. Always review detected courses. PDFs are processed in memory by the local server. No transcript is sent to AI.</span></div>
  </section>;
}
