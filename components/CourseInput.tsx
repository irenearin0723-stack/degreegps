'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CourseIdSchema } from '../types/course';
import { uniqueCourseIds } from '../lib/course-history';
import { supportedCourseCodes } from '../lib/course-codes';

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
    if (!draft.trim()) return;
    const parsed = CourseIdSchema.safeParse(normalizeCourse(draft));
    if (!parsed.success) return setMessage('Enter a course code such as CSE 311.');
    const course = parsed.data;
    if (!supportedCourseCodes.has(course)) return setMessage(`${course} is not in our supported UW snapshot. Check the code; unlisted courses need adviser review.`);
    if (uniqueCourseIds(values).includes(course)) return setMessage('This course is already in the list.');
    if (uniqueCourseIds(blockedValues).includes(course)) return setMessage('A course cannot be both completed and in progress.');
    onChange(uniqueCourseIds([...values, course]));
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
