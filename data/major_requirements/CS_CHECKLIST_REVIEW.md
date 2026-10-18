# CS checklist comparison

Reviewed on October 17, 2026 against the user-supplied `CS__Fall23.pdf`, one page, revision September 2023.

## Result

The encoded CS graduation rule values agree with this checklist. The dataset is incomplete for a full graduation plan. This review checks requirement definitions and course coverage, not a student's completed degree or a generated schedule.

No conflicting graduation rule was found that required changing the existing JSON, CSV or workbook. Twelve CS rule groups were compared. Automated assertions checked the principal course groups, thresholds, allocation-group linkage and general education credit values.

## Requirement comparison

| Checklist item | Existing rule | Result |
|---|---|---|
| MATH 124, 125, 126 or honors MATH 134, 135, 136 | CS_CALCULUS | Matches. Mixed sequences need approved equivalencies. |
| MATH 208, waived when MATH 136 is taken | CS_LINEAR | Matches. |
| Five approved natural science credits | CS_SCIENCE | Five-credit threshold matches. The PDF delegates eligible courses to a linked list rather than naming them. The existing pool comes from the separately recorded CS_LISTS source. |
| CSE 123 or CSE 143 | CS_PROGRAMMING | Matches. These alternatives contribute four or five credits respectively. |
| CSE 311, 312, 331, 332 and 351 | CS_FUNDAMENTALS | Matches. Together with the programming alternative, the stated course credits produce 24-25 fundamental credits. |
| Four 400-level courses from the core list | CS_CORE_400 | Matches the four-course threshold. Eligible membership requires the linked core list. |
| Two additional core courses at the 300 or 400 level | CS_CORE_EXTRA | Matches. Shares the distinct-course allocation group with the other core slots. |
| One additional core course or capstone course | CS_CORE_OR_CAPSTONE | Matches. A capstone is an alternative, not a universal additional requirement. The capstone pool remains partial and offering-dependent. |
| At least 33 additional core/elective credits | CS_ELECTIVE_CREDITS | Matches. The seven distinct course slots also contribute credits to the 33-credit total. Do not add another 33 credits on top of those courses. |
| Free electives as needed to reach 180 credits | CS_TOTAL | Matches the 180-credit minimum. Free elective credit is the remaining amount after counting earned credits once. |
| Cumulative GPA at least 2.0 | CS_GPA | Matches. This is a cumulative GPA requirement, not a newly inferred 2.0 minimum in every course. |
| Composition 5, writing 10, reasoning 5, diversity 5, A&H 20, SSc 20, NSc 20, additional inquiry 15, foreign language through third quarter | CS_GENERAL_ED | Values match. Evaluation remains manual and does not yet allocate overlapping courses. |

## Coverage gaps

### Course records

The target-course dataset currently has ten CSE records. Only CSE 446 belongs to the encoded 400-level CS core pool. Thirty-one other members of that pool lack target-course records. A planner starting with no completed 400-level cores cannot satisfy the four-course requirement using the current target-course dataset alone.

Neither CSE 123 nor CSE 143 has a target-course record. The calculus alternatives, MATH 208 and the approved science candidates also lack target-course records. They may be recognized in completed-course input, but must not be scheduled until their own catalog, prerequisite and term records are collected. These are alternative candidates, not a claim that every listed candidate must be taken.

The current 64-course dataset is a selected planning sample. A course missing from it is not automatically unavailable at UW. The 400-level pool count is an inventory comparison against the existing pool, not a fresh certification of every linked course's current eligibility.

### Application prerequisites

The PDF's star footnote requires the starred composition, calculus, programming and approved science items to be completed before applying to the major. It exempts direct-to-major freshman applicants from this application prerequisite condition.

The existing CS profile encodes graduation requirements and has no separate admission-scope rules. This was outside the stated package scope. If UniFlow supports applying to CS, add a separate admission profile and preserve the direct-to-major exception. Do not mark these starred courses as extra graduation courses or infer new application deadlines, minimum grades or admission guarantees from this PDF.

### General education allocation

The PDF allows diversity and writing credits to overlap other requirements. It states that required CSE/MATH work fulfills reasoning and that the specified math/science courses and CSE 121-123 credits can contribute to Areas of Inquiry. The existing profile records general education thresholds and a general overlap note, but has no automatic course-to-area allocation engine.

Therefore the system cannot yet declare general education complete or obtain the degree total by adding category totals. Count each earned course's actual credits once toward 180 while allowing documented requirement overlaps.

### Linked elective lists and course prerequisites

The PDF points to external core, capstone and elective lists. It does not reproduce those lists, individual course prerequisites, Winter 2027 offerings, section restrictions or meeting times. The existing senior elective and capstone pools are explicitly partial. Those facts require their own official sources and are not newly verified by this attached PDF.

## Implementation checks

- Keep the four-plus-two-plus-one slots distinct. Four courses cannot be reused to fill all seven slots.
- Include those allocated courses once in the 33-credit elective bucket. CSE 331 remains fundamental and is excluded from that bucket in the existing data.
- A CSE prefix alone does not establish core eligibility. The existing map does not count CSE 373 or CSE 391 as CS core courses.
- Preserve unknown course eligibility, missing schedule data and unapproved substitutions as review states.
- Match the student's applicable requirement version. This comparison establishes agreement with revision September 2023, not with every catalog year.

## Next data work

Expand CS course records, especially 400-level core options. Add an admission profile only if the application workflow is in scope. Implement general education and distinct-course allocation before claiming a complete degree audit. No application backend or student transcript was tested in this review.
