# CLAUDE.md

Read `SPEC.md`, `PLAN.md`, `DECISIONS.md` and `PROGRESS.md` before any work, and follow SPEC.md section 0.1.

- `SPEC.md` is the product spec; section 4.8 is the authority for all game rules.
- `DECISIONS.md` records every answer and decision — it overrides SPEC.md where they differ.
- `PROGRESS.md` "Resume here" says exactly where work stopped.
- One task = one commit (`task X.Y: ...`), only after type-check + tests pass. Push after each task.
- Never build on unknown half-finished work: check `git status` first.
- Commit only through the check's exit code: `npm run check && git add -A && git commit ... && git push`. Never chain with `;` or pipe the check through `grep` before committing (that let a lint failure through in task 1.8).
