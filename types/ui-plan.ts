/** Legacy UI view model only. Wire APIs use types/plan.ts (v2). */
import type { GoalDraft } from './goal';
/**
 * DegreeGPS shared API contract — v1.0.0.
 *
 * IMPORTANT: Names are snake_case to exactly match API JSON.
 * Do not silently rename keys in the frontend or backend.
 * This file defines types, not runtime validation.
 */

export type AcademicTerm = 'autumn' | 'winter' | 'spring' | 'summer';

export type CourseCategory =
  | 'major'
  | 'math'
  | 'elective'
  | 'general_education'
  | 'other';

export interface PlanRequest {
  goal_draft?: GoalDraft;
  /** Examples: ['Computer Science', 'Applied Mathematics']. */
  majors: string[];
  /** Canonical codes, e.g. 'CSE 123'. No duplicates. */
  completed_courses: string[];
  in_progress_courses: string[];
  /** Free text at MVP stage; e.g. 'ML Engineer Intern'. */
  target_role: string;
  /** Calendar year of the desired summer internship (e.g. 2027). */
  target_summer: number;
  /** Maximum courses per quarter, inclusive; range 1–5. */
  max_courses_per_term: number;
  start_term: AcademicTerm;
  start_year: number;
  /** Number of consecutive quarters, including summers; range 1–8. */
  horizon_terms: number;
}

export interface PlannedCourse {
  code: string;
  title: string;
  /** Null means credits have not been verified. Do not render as 0. */
  credits: number | null;
  category: CourseCategory;
  status: 'planned' | 'in_progress' | 'tentative';
  /** Explanation for why this course appears in the suggested path. */
  rationale: string;
  /** Every ID must appear in PlanResponse.sources. Can be []. */
  source_ids: string[];
}

export interface QuarterPlan {
  /** Format: YYYY-term; e.g. '2027-winter'. */
  id: string;
  year: number;
  term: AcademicTerm;
  /** May be empty during summer. */
  courses: PlannedCourse[];
  notes: string;
}

export interface CareerMilestone {
  id: string;
  /** Must match a QuarterPlan.id. */
  quarter_id: string;
  title: string;
  description: string;
  action_items: string[];
  status: 'not_started' | 'in_progress' | 'done';
}

export interface PlanWarning {
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  message: string;
  /** Codes (not quarter IDs) to highlight; can be []. */
  affected_course_codes: string[];
}

export interface PlanSource {
  id: string;
  title: string;
  /** Null means no verified link is available. Never invent a URL. */
  url: string | null;
  kind: 'official' | 'third_party' | 'mock';
  /** ISO-8601 time or null if unknown. */
  retrieved_at: string | null;
}

export interface PlanResponse {
  schema_version: '1.0.0';
  plan_id: string;
  /** 'mock' responses are demo-only and not academic advice. */
  mode: 'mock' | 'generated';
  /** ISO-8601 date-time. */
  generated_at: string;
  /** Echo the normalized request so the UI knows which inputs were used. */
  request: PlanRequest;
  quarters: QuarterPlan[];
  career_milestones: CareerMilestone[];
  warnings: PlanWarning[];
  sources: PlanSource[];
}

export interface ApiErrorResponse {
  error: {
    code: 'INVALID_REQUEST' | 'UNPROCESSABLE_PLAN' | 'INTERNAL_ERROR';
    message: string;
    details?: string[];
  };
}
