# Product clarity programme — wrap-up

Date: 2026-11-11 · Audit and approved proposal: [AUDIT-AND-PROPOSAL.md](AUDIT-AND-PROPOSAL.md).
Seven phases (UX-1…UX-7), each tested, reviewed by Rishi and deployed separately (UX-7 waits
for its go-ahead). No database changes in any phase; existing data, backups and sync untouched.

## What changed, by phase

| Phase | Change                                                                                                                                                           | Problems closed |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| UX-1  | No screen scrolls sideways (14 grids fixed); Ask moved from floating to each main header                                                                         | P2, P6          |
| UX-2  | One next action: the Today tile shows the same pick as "Now" (only doable quests); honest core wording; missed wake-up says when tomorrow opens                  | P1, P14         |
| UX-3  | Today: compact header, one Next card, no shortcut tiles, one goal nudge, "For: main quest · Builds: skills" lines on quest cards                                 | P3, P4          |
| UX-4  | Each main quest shows one % and where it stands (No plan yet · Next milestone · Plan waiting · Done) with Plan it / Review the plan — one shared rule with Today | P5, P13         |
| UX-5  | Quests: Daily · Weekly · Side (Main lives in Growth); Roadmap → Compass with redirects; Today filters STR · INT · WIL                                            | P7, P8          |
| UX-6  | Me: compact rows; stats shown once (XP moved into the triangle table); Settings in five fold-out groups with working hash links                                  | P10, P11, P12   |
| UX-7  | Empty states that say what to do next (Side, Weekly, no daily quests vs rest day); copy aligned with the glossary (main quest, target)                           | acceptance 9    |

Corrections to the audit made during the work: P9 (career quiz) and P15 (evening check-in) were
already handled; my screenshots had been taken in states where they didn't show.

## Measured before → after (phone, 360 px, new account)

| Screen                  | Before                    | After                                                                      |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------- |
| Settings height         | 5,213 px                  | **852 px**                                                                 |
| Today height (Day 1)    | 2,723 px                  | 2,327 px (lived-in Day 31: 3,239 → 2,863 px)                               |
| Skills width            | 418 px on a 360 px screen | **fits** (360 px)                                                          |
| Stats width (with data) | wider than the screen     | **fits**                                                                   |
| Goals height            | 1,340 px                  | 1,488 px (each main quest now has its Plan it button — a deliberate trade) |
| "Next" answers on Today | 2, could disagree         | **1**                                                                      |

## Acceptance criteria (request section 9) — honest status

| #   | Criterion                                          | Status                     | Evidence / gap                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A new user understands the purpose quickly         | **Partly**                 | Welcome text, one Next card and the System message on Day 1; **not tested with real new users** — a 5-minute hallway test is the honest way to confirm                                                                                                  |
| 2   | Every module has a clear responsibility            | Met                        | IA table (proposal D); Main tab removed; Compass named for what it is                                                                                                                                                                                   |
| 3   | Navigation feels natural                           | Met                        | Same five tabs; old links redirect (tested)                                                                                                                                                                                                             |
| 4   | Goals connect to execution                         | **Mostly**                 | Plan it on every unplanned main quest; "For:" lines — but only for linked quests: the starter daily quests from onboarding aren't linked to main quests, so they show no "For:" until you link them (edit the quest) or the planner creates linked ones |
| 5   | Skills and quests relate understandably            | **Partly**                 | "Builds: skill" on linked quests; the Skills tab explains how levels grow; same linking gap as #4                                                                                                                                                       |
| 6   | Progress calculations are consistent               | Met                        | One calculator per number (verified in code); one shared plan rule; one next action                                                                                                                                                                     |
| 7   | Screens are visually cohesive                      | Met                        | Shared tiles, panels, pills; stats/percentages shown once; screenshots reviewed per phase                                                                                                                                                               |
| 8   | Every interactive element has a meaningful outcome | Met for what was audited   | Removed duplicate shortcuts; dead wake-up card now explains; not every control was exhaustively re-tested by hand                                                                                                                                       |
| 9   | Empty states explain what to do next               | Met for the lists reviewed | Dream, daily/weekly/side quests, focus, jobs, Today (rest day vs none)                                                                                                                                                                                  |
| 10  | Existing user data remains safe                    | Met                        | No schema change or migration in any phase                                                                                                                                                                                                              |
| 11  | Reliable and maintainable                          | Met                        | 908 unit/integration tests, 46 e2e incl. axe and a no-sideways-scroll check, CI on every push                                                                                                                                                           |
| 12  | No critical regressions                            | Met                        | Full e2e green locally and against production after each deploy                                                                                                                                                                                         |

## Deliberately not done (open choices for you)

1. **Collapse done quests on Today** — left out to keep undo one tap away; easy to add.
2. **Today's quests above the System suggestion and reminders** — the approved order keeps the
   suggestion first; with real data the list starts at the top of the second screen.
3. **Link the starter daily quests to your main quests** (closes the gap in #4/#5) — e.g. a
   one-time "Which main quest does this serve?" prompt, or the planner offering links.
4. A shared loading component — not added: data is local and loads in milliseconds, and screens
   already wait for it instead of flashing empty content.

## Process notes

- Tests caught real problems during the work: a duplicated done-count (UX-3), a wrong accessible
  name on the filter chips (UX-5, axe), a hidden e2e failure behind `| tail` (fixed: e2e exit codes
  are now captured), a test that passed for the wrong reason (UX-7), a lint rule on effects (UX-6).
- Each phase was deployed only after your go-ahead and verified against production.
