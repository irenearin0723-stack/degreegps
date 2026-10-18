import { CourseIdSchema } from '../types/course';

/** One requirement rule from data/major_requirements/major_requirements.json (major/admission scope only). */
export interface RequirementRule { rule_id: string; program_id: string; label: string; scope: string; logic: unknown }
export interface RequirementSet { rules: RequirementRule[]; pools: Record<string, { courses: string[] }> }
/** Why a course would advance the degree right now: 3 required, 2 named option, 1 elective list. */
export interface CourseNeed { weight: number; label: string }

type Logic = { type?: string; courses?: string[]; course?: string; branches?: Logic[]; pool_id?: string; pool_ids?: string[];
  min_courses?: number; min_credits?: number };
const ids = (list: unknown[] = []) => list.flatMap(raw => { const id = CourseIdSchema.safeParse(raw); return id.success && /\d{3}/.test(String(raw)) ? [id.data] : []; });

function listOf(logic: Logic, pools: RequirementSet['pools']): string[] {
  const pooled = [logic.pool_id, ...(logic.pool_ids ?? [])].filter(Boolean).flatMap(p => pools[String(p)]?.courses ?? []);
  return [...new Set([...ids(logic.courses ?? []), ...ids(pooled)])];
}

/** Courses still missing from a logic node (0 = satisfied). Unplannable node types (GPA, manual review) count as satisfied. */
function missing(logic: Logic, have: ReadonlySet<string>, credits: (id: string) => number, pools: RequirementSet['pools']): number {
  switch (logic.type) {
    case 'all_of': return ids(logic.courses ?? []).filter(id => !have.has(id)).length;
    case 'waiver_if_completed': return logic.course && have.has(CourseIdSchema.parse(logic.course)) ? 0 : 1;
    case 'any_of': return Math.min(...(logic.branches ?? []).map(b => missing(b, have, credits, pools)), Infinity);
    case 'choose_courses': return Math.max(0, (logic.min_courses ?? 1) - listOf(logic, pools).filter(id => have.has(id)).length);
    case 'min_credits': {
      const list = listOf(logic, pools);
      if (!list.length) return 0; // degree-wide totals are not course-plannable
      const earned = list.filter(id => have.has(id)).reduce((sum, id) => sum + credits(id), 0);
      return earned >= (logic.min_credits ?? 0) ? 0 : Math.ceil(((logic.min_credits ?? 0) - earned) / 4);
    }
    default: return 0;
  }
}

/** Courses that would advance an unmet node, with how strongly the node needs them. */
function advance(logic: Logic, have: ReadonlySet<string>, credits: (id: string) => number, pools: RequirementSet['pools'], weight: number, out: Map<string, number>) {
  if (missing(logic, have, credits, pools) === 0) return;
  const add = (list: string[], w: number) => { for (const id of list) if (!have.has(id)) out.set(id, Math.max(out.get(id) ?? 0, w)); };
  switch (logic.type) {
    case 'all_of': add(ids(logic.courses ?? []), weight); break;
    case 'waiver_if_completed': break; // the waiver course is an alternative, not a recommendation
    case 'any_of': {
      // Work toward the branch closest to completion (ties: first listed).
      const branches = logic.branches ?? [];
      const best = branches.reduce((a, b) => missing(b, have, credits, pools) < missing(a, have, credits, pools) ? b : a, branches[0]);
      if (best) advance(best, have, credits, pools, weight, out);
      break;
    }
    case 'choose_courses': { const list = listOf(logic, pools); add(list, Math.min(weight, list.length <= 12 ? 2 : 1)); break; }
    case 'min_credits': add(listOf(logic, pools), 1); break;
  }
}

/** Every course that would advance an unmet requirement given what the student has (completed, implied or planned). */
export function requirementNeeds(set: RequirementSet, have: ReadonlySet<string>, credits: (id: string) => number): Map<string, CourseNeed> {
  const needs = new Map<string, CourseNeed>();
  for (const rule of set.rules) {
    const found = new Map<string, number>();
    advance(rule.logic as Logic, have, credits, set.pools, 3, found);
    for (const [id, weight] of found) if (weight > (needs.get(id)?.weight ?? 0)) needs.set(id, { weight, label: rule.label });
  }
  return needs;
}

/** Rules not yet satisfied, for reporting what remains after the plan. */
export function unmetRules(set: RequirementSet, have: ReadonlySet<string>, credits: (id: string) => number): RequirementRule[] {
  return set.rules.filter(rule => missing(rule.logic as Logic, have, credits, set.pools) > 0);
}
