# Plan — link daily quests to main quests

Date: 2026-11-11 · Follows [WRAP-UP.md](WRAP-UP.md) (acceptance criteria #4 and #5 were only
partly met). **Plan for review — nothing built yet.**

## The problem, precisely

- The data model already supports it: every daily quest (habit) has `linked_goal_type` /
  `linked_goal_id` and `skill_ids`, and the `habit.update` action accepts them.
- **But there is no way in the app to link an existing daily quest to a main quest.** The daily
  quest editor has a skills picker but no goal picker. Weekly and side quests _do_ have one
  ("For", in `QuestDefForm`). Today only _new_ daily quests made by Ask or Follow-ups get a link.
- Onboarding creates the starter daily quests and your main quests side by side, unlinked.
- Effects: the "For:" line (UX-3) stays empty on the quests you do every day; "why does this
  task matter?" goes unanswered there; and the Adaptive System can't use a goal's deadline when it
  picks the next action (it already does that for linked quests).

## Proposal — two small phases

### L1 · A "For" picker on daily quests (manual, the foundation)

- In the daily quest editor (Quests → Daily → edit, and wherever `HabitEditor` is used), add
  **"For"**: none · each active main quest · its active milestones — the same choices, order and
  wording as the weekly/side quest form. Extract that picker into one shared component used by
  both forms (no second copy).
- Saves through the existing `habit.update` (already validated: type and id set together).
- Applies from today forward, like every edit (SPEC principle 8). The link lives on the quest
  definition, so it changes the "For:" line and the next-action ranking — **not** past XP, past
  completions or skill levels.
- Tests: the editor shows the picker with the right options; saving sets both fields; "none"
  clears both; an archived main quest isn't offered; the Today card shows "For: …" afterwards.

### L2 · "Link your daily quests" — one System suggestion (approve, then undo)

- A new candidate in Today's one-suggestion slot (as built: after burnout and difficulty, **before**
  the goal nudges — those can recur every day, so placed last this card would rarely be seen;
  it's a one-off that hides itself once answered; never on Day 1, which stays for planning the goals from onboarding): shown only when you have at least one active main quest **and** at least one
  active, unlinked daily quest — and you haven't snoozed or declined it.
- It lists each unlinked daily quest with a **suggested** main quest or "No link", each changeable
  before you accept:

  | Daily quest                                      | Suggested                    | Why                                                                                                |
  | ------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------- |
  | AI & Robotics study (phone-free)                 | MS in AI/Robotics in Germany | shares "ai" and "robotics" — card also shows "also fits: Core robotics skills, Robotics portfolio" |
  | Game dev study (phone-free)                      | Game dev foundations         | shares "game" and "dev"                                                                            |
  | Workout, Walk, Sleep, Journal, Meditate, Wake up | No link                      | no main quest is about this — they still count for their stat                                      |

  (Corrected after building: the plan first said "Core robotics skills" for the study quest; the
  shared-word rule picks the MS quest, which shares two words. Rather than tune the rule to one
  person's titles, the card lists the near-ties so the choice is yours before accepting.)

- Suggestion rule (deterministic, offline, explainable): meaningful words shared between the quest
  title and the main quest's title or its milestones' titles (stop-words removed), same stat as a
  tie-breaker; no match → "No link". Never invents a link it can't explain.
- **Link these** applies through the existing Goal Planner path (`plan.apply`, `habit.update`
  items) — so it appears in Plan history with **Undo**, exactly like other System suggestions.
  **Not now** snoozes it (same mechanism as the other suggestion cards); **Don't ask again**
  records a decline so it isn't shown again.
- Tests: the rule on your real titles and edge cases (no main quests, all linked, archived goals,
  ties); the card appears only when it should; Link these → links set, Plan history entry, Undo
  restores exactly; Not now / Don't ask again.

### Deliberately not included

- **Skills are not suggested automatically.** A quest linked to skills adds evidence to those
  skills' levels, so auto-linking could inflate them; you choose skills yourself in the editor
  (the picker already exists).
- **Onboarding is unchanged** for now; the L2 card covers new users on Day 1 too. (Could later
  become an onboarding step.)

## Impact

- **No database or server change**: the fields exist; sync and backups carry them already.
- Files (expected): `ui/habit/HabitEditor.tsx`, a shared goal picker (from
  `features/quests/QuestDefForm.tsx`), a pure suggestion rule (e.g. `core/planner/links.ts`),
  `features/today/SuggestionSlot.tsx` + a new card, `core/state/suggestion.ts` (snooze kind),
  tests.
- Effort: L1 small; L2 medium. Each phase: check, e2e, screenshots, your go-ahead to deploy.

## Decisions for you

1. Approve L1 and L2 as described (or L1 only).
2. For L2: is "No link" right for the body and mind quests, or would you like a main quest about
   health (the Compass can create one: "A healthier body") so Workout / Walk / Sleep link too?
