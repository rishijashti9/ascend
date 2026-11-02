# ASCEND

A personal leveling system for real life: daily quests, stats, levels and ranks, built for calm daily use over many years. Works offline; your data stays on your device.

**Live app:** https://ascend-vert-mu.vercel.app

> Status: Phase 1 (Foundation) complete. See `PROGRESS.md`.

## Requirements (Windows)

- [Node.js](https://nodejs.org) 22 or newer (`node -v` to check)
- [Git](https://git-scm.com/download/win)
- For the Android app: Android Studio (see _Android app_ below)

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
- **Phone (Chrome):** menu → _Add to Home screen_. (For daily use on Android, the APK below is recommended.)

When a new version is available, a small "Update ready" note appears. Nothing reloads until you tap **Reload**.

Live address: **https://ascend-vert-mu.vercel.app**. To try a local production build instead: `npm run build` then `npm run preview`.

## Deploy the web app (Vercel)

The web/laptop version is hosted on Vercel's free plan and redeploys automatically on every push to `main`.

**One-time setup**

1. Go to https://vercel.com and choose **Sign Up → Continue with GitHub** (use the GitHub account that owns the `ascend` repo).
2. Click **Add New… → Project**, find **ascend** in the list and click **Import**. (If it isn't listed, click _Adjust GitHub App Permissions_ and give Vercel access to the `ascend` repository.)
3. Leave every setting as detected (Framework: **Vite**, build command `npm run build`, output `dist` — these come from `vercel.json`) and click **Deploy**.
4. After about a minute you get an address like `https://ascend-xxxx.vercel.app`. Open it on the laptop and install it (see _Install as an app_).

**Every update:** just push to `main` — Vercel builds and publishes it. Open apps show "Update ready".

**Privacy:** the site is public, but it contains only the app itself. Your data never leaves your device (until you turn on sync in Phase 7).

## Android app (APK) — step by step on Windows

The Android app is the same app wrapped with Capacitor. You build it on your laptop with Android Studio and install it on your phone over USB. You only do steps 1–3 once.

### 1. Install Android Studio (once)

1. Download **Android Studio** from https://developer.android.com/studio and run the installer with the default options.
2. Open Android Studio. The **Setup Wizard** appears: choose **Standard**, accept the licences, and let it download the Android SDK (this takes a while).
3. When it finishes, go to **More Actions → SDK Manager** (or **Settings → Languages & Frameworks → Android SDK**) and check that **Android 16 (API 36)** is installed under _SDK Platforms_. Under _SDK Tools_, make sure **Android SDK Build-Tools** and **Android SDK Platform-Tools** are ticked. Click **Apply**.

Android Studio includes its own Java 21, which this project needs (the Java 17 already on your laptop is too old, but you don't need to change it).

### 2. Turn on USB debugging on your phone (once)

1. On the phone: **Settings → About phone** → tap **Build number** 7 times until it says you're a developer. (On some phones it's under _Software information_.)
2. Go back to **Settings → System → Developer options** and turn on **USB debugging**.
3. Connect the phone to the laptop with a USB cable. On the phone, tap **Allow** when asked "Allow USB debugging?" (tick _Always allow from this computer_).

### 3. Open the project in Android Studio (once)

In PowerShell, in the project folder:

```powershell
npm install
npm run android:sync     # builds the web app and copies it into the Android project
npm run android:open     # opens the android folder in Android Studio
```

The first time, Android Studio downloads Gradle and other parts (several minutes). Wait until the progress bar at the bottom finishes.

If `npm run android:open` can't find Android Studio, open Android Studio yourself and choose **Open** → select the `android` folder inside the project.

### 4. Install on your phone (every time you want the latest version)

```powershell
npm run android:sync
```

Then in Android Studio: pick your phone in the device list at the top, and press the green **Run ▶** button. ASCEND is installed and opens on your phone. Your data stays on the phone between updates.

### Build an APK file instead (optional)

In Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. When it finishes, click **locate** in the popup. The file is `android\app\build\outputs\apk\debug\app-debug.apk`. Copy it to the phone and open it to install (allow "install unknown apps" for your file manager when asked).

### Notes

- The Android app and a browser PWA on the same phone keep **separate data**. Recommended: the Android app on the phone, the PWA on the laptop, and sync between them (Phase 7).
- Android launcher icons and splash screen are generated from the app symbol with `npm run icons:android`.

## Using ASCEND day to day

- **Today** is home: tap “I’m up” when you wake (on time until wake time + window, late until the cutoff), then Full or Minimum on each quest, or log minutes / steps / sleep. Undo fixes a mistaken tap the same day.
- A day is **active** when every core quest has at least its minimum done. Hard day? Turn on **Low energy**: only core minimums are needed and they still count.
- Missed a day? A shield covers it automatically if you have one (one per 7 active days, up to 3). Otherwise a small **Recovery quest** appears the next day and can restore the streak.
- **Quests** is where daily quests are added, edited, paused or archived, and where the 3 core quests are chosen.
- **Goals** holds your Dream, its Main Quests and their milestones. Tap **Plan this goal** (or **Re-plan**): answer a few taps and the Goal Planner proposes milestones, this week's quests and any daily quest — untick or edit anything, then approve. Every plan can be undone from **Plan history**. Each new week, this week's quests are planned automatically (with Undo).
- **Focus** (or “Start focus” on Today): pick a minutes quest or a stat and a length; the minutes count toward the quest, or give 1 XP per minute.
- **Body** (in More): log weight, waist, sleep, steps and workouts; see trends; add a private daily photo (kept only on this device — use “Export with photos” to carry photos to a new device).
- **Review** (in More): the 1-minute evening check-in, the weekly review (look back, then confirm next week's quests), and monthly / yearly summaries.
- **Profile** (in More): level, rank, stats triangle, XP per week, the active-days calendar, achievements, and the title you choose to show.
- The System sometimes suggests a lighter or harder load on Today — one tap applies it (with Undo), or “Not now”.
- **Settings** has the theme, day-start hour, wake-up times, Auto-plan, backup (export / import), and “Rebuild progress”.

## Developer tools (testing only)

When running `npm run dev`, a small yellow wrench button appears at the bottom-left. It lets you change the app's date and time, jump forward N days, switch timezone, generate 30 days / 1 year / 2 years of realistic test data, and reset all data. Changing the clock reloads the app, like opening it later. These tools are **removed from production builds and the Android app**.

## Useful commands

| Command                 | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | Development server with live reload                                    |
| `npm run build`         | Production build into `dist/`                                          |
| `npm run preview`       | Serve the production build locally                                     |
| `npm run e2e`           | End-to-end tests in a real browser (phone and laptop sizes)            |
| `npm test`              | Run unit tests once                                                    |
| `npm run check`         | Type-check + lint + formatting check + tests (run before every commit) |
| `npm run format`        | Auto-format all files                                                  |
| `npm run icons`         | Regenerate all app icons from `public/icon.svg`                        |
| `npm run android:sync`  | Build the web app and copy it into the Android project                 |
| `npm run android:open`  | Open the Android project in Android Studio                             |
| `npm run icons:android` | Regenerate Android launcher icons and splash                           |
| `npm run simulate`      | 5-year game-balance simulation (after changing `src/config/game.ts`)   |

## Project docs

- `SPEC.md` — what the app must do
- `PLAN.md` — architecture, data model, build phases and tasks
- `DECISIONS.md` — every decision made (wins over SPEC.md where they differ)
- `PROGRESS.md` — where the build is right now
- `CHANGELOG.md` — what changed in each version

## Backing up your data

Until sync arrives (Phase 7), your data lives only on the device you use. Back it up:

1. **Export:** Settings → Backup → **Export my data**. In a browser this downloads `ascend-backup-YYYY-MM-DD.json`; in the Android app a share sheet opens — save it to Files, Google Drive or email it to yourself. Keep the file somewhere safe (not only on the same device). Body photos are never included.
2. **Reminder:** in a browser, Today shows a gentle note when your last export is a week old.
3. **Restore on a new device or after a reset:** on the first onboarding screen, open **Already use ASCEND? Restore from a backup** and choose the file. Your level, streaks and history come back exactly.
4. **Import into a device that already has data:** Settings → Backup → **Import a backup**, then pick
   - **Replace** — the device becomes exactly the backup, or
   - **Merge** — combine both; the newer change wins and XP is never counted twice.

   A safety backup of the current data is saved first, automatically.

If the app ever shows its error screen, the **Export my data** button there still works, so your data can always be rescued.
