# ASCEND

A personal leveling system for real life: daily quests, stats, levels and ranks, built for calm daily use over many years. Works offline; your data stays on your device.

> Status: Phase 1 (Foundation) in progress. See `PROGRESS.md`.

## Requirements (Windows)

- [Node.js](https://nodejs.org) 22 or newer (`node -v` to check)
- [Git](https://git-scm.com/download/win)
- For the Android app (later): Android Studio — instructions will be added in task 1.11.

## Run it on your laptop

Open PowerShell in the project folder:

```powershell
npm install        # first time, and after pulling new code
npm run dev        # starts the app at http://localhost:5173
```

Open the printed address in your browser. Press `Ctrl+C` in PowerShell to stop.

## Install as an app (PWA)

ASCEND works offline once loaded. To install it:

- **Laptop (Chrome or Edge):** open the app, then click the install icon at the right end of the address bar (or menu → _Install ASCEND_).
- **Phone (Chrome):** menu → _Add to Home screen_. (For daily use on Android, the APK in a later section is recommended.)

When a new version is available, a small "Update ready" note appears. Nothing reloads until you tap **Reload**.

The hosted address is added in task 1.12. Until then you can try it locally with `npm run build` then `npm run preview`.

## Useful commands

| Command            | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `npm run dev`      | Development server with live reload                                    |
| `npm run build`    | Production build into `dist/`                                          |
| `npm run preview`  | Serve the production build locally                                     |
| `npm test`         | Run unit tests once                                                    |
| `npm run check`    | Type-check + lint + formatting check + tests (run before every commit) |
| `npm run format`   | Auto-format all files                                                  |
| `npm run icons`    | Regenerate all app icons from `public/icon.svg`                        |
| `npm run simulate` | 5-year game-balance simulation (after changing `src/config/game.ts`)   |

## Project docs

- `SPEC.md` — what the app must do
- `PLAN.md` — architecture, data model, build phases and tasks
- `DECISIONS.md` — every decision made (wins over SPEC.md where they differ)
- `PROGRESS.md` — where the build is right now
- `CHANGELOG.md` — what changed in each version

## Backing up your data

Export/import arrives in Phase 2 (task 2.13). This section will explain it then.
