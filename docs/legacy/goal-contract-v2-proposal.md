# Goal-driven planning contract proposal (v2)

**Status:** additive design proposal. The frontend currently adapts this structured flow to the frozen v1 `target_role` and `target_summer` fields, so the existing backend remains compatible.

```ts
interface Goal {
  type: 'internship' | 'research' | 'projects' | 'explore';
  track: 'swe' | 'ml' | 'data' | 'systems' | 'cybersecurity' | 'cloud'
    | 'data_engineering' | 'quantitative' | 'robotics' | 'hci' | 'product'
    | 'bioinformatics' | 'undecided';
  deadline: { term: AcademicTerm; year: number } | null;
  notes?: string;
}
```

Valid combinations:

- internship and explore: all tracks above
- research: ml, data, systems, cybersecurity, robotics, hci, quantitative, bioinformatics, undecided
- projects: all tracks above

The backend must validate combinations. Notes may personalize action milestones but must never override prerequisites, offerings, or degree rules.

## Migration

1. Approve a `schema_version: 2.0.0` change with frontend and backend owners.
2. Update `types/plan.ts`, canonical mock, request example, contract documentation, and checks in one PR.
3. Replace the frontend adapter in `types/goal.ts` with the approved `goal` request field.
4. Keep a compatibility period if a deployed v1 backend still exists.
