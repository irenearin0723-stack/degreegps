'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

type Props = {
  label: string;
  hint: string;
  values: string[];
  blockedValues: string[];
  onChange: (values: string[]) => void;
};

const normalizeCourse = (value: string) => value.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d.*)$/, '$1 $2');

export function CourseInput({ label, hint, values, blockedValues, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');

  const add = () => {
    const course = normalizeCourse(draft);
    if (!course) return;
    if (values.includes(course)) return setMessage('This course is already in the list.');
    if (blockedValues.includes(course)) return setMessage('A course cannot be both completed and in progress.');
    onChange([...values, course]);
    setDraft('');
    setMessage('');
  };

  return (
    <div className="field-group">
      <div className="field-heading"><label>{label}</label><span>{values.length} added</span></div>
      <div className="course-entry">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder="e.g. CSE 311" aria-label={label} />
        <button type="button" onClick={add} aria-label={`Add ${label}`}><Plus size={17} /></button>
      </div>
      <div className="chips">
        {values.map((course) => <span key={course}>{course}<button type="button" onClick={() => onChange(values.filter((item) => item !== course))} aria-label={`Remove ${course}`}><X size={12} /></button></span>)}
      </div>
      <small className={message ? 'field-error' : ''}>{message || hint}</small>
    </div>
  );
}
