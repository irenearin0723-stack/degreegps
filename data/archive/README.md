# Archived data

Superseded datasets, kept for provenance. Nothing in this folder is loaded by the app or tests.

## Convention

When a newer dataset replaces an older one:

1. Create `data/archive/<YYYY-MM-DD>_<short-name>/`, dated when the data was replaced.
2. `git mv` the old files (and their companion `.md`) into it unchanged.
3. Add a row below saying what replaced it.
4. Update any `source_*` paths in live metadata that pointed at the old location.

## Contents

| Folder | What it was | Replaced by |
| --- | --- | --- |
| `2026-10-17_registration-handoff-v1/` | `registration_evidence_handoff.json` (handoff v1, loaded by the backend until Oct 17 2026, pinned SHA-256 hashes of the course files) and `winter_2027_registration_review.json` (raw detailed SLN review of 90 sections), with their explanatory `.md` files | `data/target_courses/registration_rules.json` plus the `registration_*` fields in `sections.json` |
