export type GoalType = 'internship' | 'research' | 'projects' | 'explore';
export type GoalTrack = 'swe' | 'ml' | 'data' | 'systems' | 'cybersecurity' | 'cloud' | 'data_engineering' | 'quantitative' | 'robotics' | 'hci' | 'product' | 'bioinformatics' | 'undecided';
export type DeadlineTerm = 'winter' | 'spring' | 'summer' | 'autumn';
export type GoalDeadline = {term: DeadlineTerm; year: number} | null;
export interface GoalDraft { type: GoalType; track: GoalTrack; deadline: GoalDeadline; notes: string; career_hours_per_week: number; intensity: 'balanced' | 'accelerated'; }
const careerTracks:GoalTrack[]=['swe','ml','data','systems','cybersecurity','cloud','data_engineering','quantitative','robotics','hci','product','bioinformatics','undecided'];
export const validGoalTracks:Record<GoalType,GoalTrack[]>={internship:careerTracks,research:['ml','data','systems','cybersecurity','robotics','hci','quantitative','bioinformatics','undecided'],projects:careerTracks,explore:careerTracks};
const labels:Record<GoalTrack,string>={swe:'Software Engineering',ml:'AI / Machine Learning',data:'Data Science / Analytics',systems:'Computer Systems',cybersecurity:'Cybersecurity',cloud:'Cloud / DevOps',data_engineering:'Data Engineering',quantitative:'Quantitative Computing',robotics:'Robotics',hci:'Human-Computer Interaction',product:'Product Management',bioinformatics:'Computational Biology',undecided:'Undecided'};
export function goalToV1TargetRole(goal:GoalDraft){if(goal.type==='explore')return 'Career Path Exploration';if(goal.type==='research')return `${labels[goal.track]} Research Assistant`;if(goal.type==='projects')return `${labels[goal.track]} Profile & Project Development`;return `${labels[goal.track]} Intern`;}
export function deadlineToSummer(deadline:GoalDraft['deadline']){return deadline?.year??2028;}
