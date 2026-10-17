export type GoalType = 'internship' | 'research' | 'projects' | 'explore';
export type GoalTrack = 'swe' | 'ml' | 'data' | 'systems' | 'hci' | 'undecided';
export interface GoalDraft { type: GoalType; track: GoalTrack; deadline: 'summer-2027' | 'autumn-2027' | 'flexible'; notes: string; career_hours_per_week: number; intensity: 'balanced' | 'accelerated'; }
export const validGoalTracks: Record<GoalType, GoalTrack[]> = { internship:['swe','ml','data','undecided'],research:['ml','systems','hci','undecided'],projects:['swe','ml','data','systems','hci'],explore:['undecided'] };
const labels:Record<GoalTrack,string>={swe:'Software Engineering',ml:'AI / Machine Learning',data:'Data Science / Analytics',systems:'Computer Systems',hci:'Human-Computer Interaction',undecided:'Undecided'};
export function goalToV1TargetRole(goal:GoalDraft){if(goal.type==='explore')return 'Career Path Exploration';if(goal.type==='research')return `${labels[goal.track]} Research Assistant`;if(goal.type==='projects')return `${labels[goal.track]} Profile & Project Development`;return `${labels[goal.track]} Intern`;}
export function deadlineToSummer(deadline:GoalDraft['deadline']){return deadline==='flexible'?2028:2027;}
