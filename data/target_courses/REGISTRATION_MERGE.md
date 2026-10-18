# Registration evidence merge

Term: Winter 2027. Campus: Seattle. Checked October 17, 2026.

## Coverage and precedence

All 64 course records and 115 section records are retained. Detailed SLN rules were added to 90 existing sections covering ten courses. The remaining 25 section JSON records are unchanged. No duplicate SLNs were introduced. Existing course, prerequisite, minimum-grade and concurrency data were preserved.

For reviewed sections, registration_rules in sections.json contains the structured rule array. registration_rules_json in sections.csv contains the same array serialized as JSON. registration_notes preserves the detailed Notes text; registration_source_url identifies the official detail page. The original notes and all meeting-time and enrollment-snapshot fields remain intact. Excel provides readable rule summaries and raw detailed notes.

registration_rules.json consolidates all 115 section evidence records, earlier minimum-grade and concurrency rules, and the newer policies and detailed review. Use structured_rules for its 90 reviewed entries. Historical baseline_import_candidates are retained for traceability. For the other 25 entries, import_candidates remain only candidates from the original schedule notes.

Join by term + campus + SLN, using Seattle for the existing campus-less section schema. Do not concatenate root handoff files into this dataset. The files in the project root remain historical source snapshots.

## Limits and checks

Exact permitted lecture/quiz pairings remain unverified. General university rules, institutional major-code mapping, student registration dates, grades, permissions and availability still require evaluation. Ten restriction fixtures passed during the detailed review; no backend API was executed for this merge. INFO meetings and detailed restrictions remain unimported.

Existing course and prerequisite files were protected by byte hashes, all original section fields were checked for equality, and the 25 baseline-only section objects were checked for exact equality. Detailed rule counts, raw Notes and CSV/JSON parity were validated.

Prior versions of changed files are backed up in backups/registration-merge-20261018T004640Z/ under the Dubhacks project root.
