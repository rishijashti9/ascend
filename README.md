# ASCEND

A personal leveling system for real life: daily quests, stats, levels and ranks, built for calm daily use over many years. Works offline; your data stays on your device.

**Live app:** https://ascend-vert-mu.vercel.app

> Status: everything is built except the optional AI coach (Phase 8, next). Version 0.9.0. See `PROGRESS.md`.

## Requirements (Windows)

- [Node.js](https://nodejs.org) 22 or newer (`node -v` to check)
- [Git](https://git-scm.com/download/win)
- For the Android app: Android Studio (see _Android app_ below) and a phone with Android 8.0 or newer

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

**Privacy:** the site is public, but it contains only the app itself. Your data stays on your device unless you sign in to sync (then it's copied only to your own private sync space).

## Android app (APK) — step by step on Windows

The Android app is the same app wrapped with Capacitor. You build it on your laptop with Android Studio and install it on your phone over USB. You only do steps 1–3 once.

### 1. Install Android Studio (once)

1. Download **Android Studio** from https://developer.android.com/studio and run the installer with the default options.
2. Open Android Studio. The **Setup Wizard** appears: choose **Standard**, accept the licences, and let it download the Android SDK (this takes a while).
3. When it finishes, go to **More Actions → SDK Manager** (or **Settings → Languages & Frameworks → Android SDK**) and check that **Android 16 (API 36)** is installed under _SDK Platforms_. Under _SDK Tools_, make sure **Android SDK Build-Tools** and **Android SDK Platform-Tools** are ticked. Click **Apply**.

This project builds with **Java 21**. Newer Android Studio versions bundle Java 25, which the project's Gradle can't run on, so check once: **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** should say **jbr-21** (if it isn't in the list, choose _Download JDK…_ → version 21 → JetBrains Runtime). The Java 17 already on your laptop doesn't matter.

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

### Or install from PowerShell (no Android Studio window needed)

With the phone connected (USB debugging on):

```powershell
npm run android:sync
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"   # Android Studio's Java 21
cd android
.\gradlew.bat assembleDebug
& "$env:LOCALAPPDATA\Android\Sdk\platform-toolsdb.exe" install -r appuild\outputspk\debugpp-debug.apk
cd ..
```

`install -r` updates the app in place — your data stays. (Never uninstall the app to "fix" something: that deletes its data. Export a backup first if you ever must.)

### Build an APK file instead (optional)

In Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. When it finishes, click **locate** in the popup. The file is `android\app\build\outputs\apk\debug\app-debug.apk`. Copy it to the phone and open it to install (allow "install unknown apps" for your file manager when asked).

### Notes

- The Android app and a browser PWA on the same phone keep **separate data**. Recommended: the Android app on the phone, the PWA on the laptop, and sync between them (see _Sync_ below).
- Android launcher icons and splash screen are generated from the app symbol with `npm run icons:android` (it also keeps the one-colour layer that themed icons on Nothing OS / Android 13+ use).

## Android extras

### Health Connect (steps, sleep, workouts)

1. Make sure **Health Connect** is on the phone (built into Android 14+; on older phones install it from the Play Store). Apps that record steps or sleep — e.g. your watch's app or Google Fit — need to share into Health Connect too (in their own settings).
2. In ASCEND: **Settings → Health Connect → Connect Health Connect**, and allow **Steps**, **Sleep** and **Exercise**.
3. From then on ASCEND reads them when it opens, when you come back to it, and every 15 minutes while it's open: your Walk and Sleep quests and the Body log fill in by themselves, and a workout of 10+ minutes completes the Workout quest (30+ in full). Sleep counts for the morning you wake up into. A number you type yourself always wins. ASCEND only reads; it never writes to Health Connect.
4. To stop: switch it off in ASCEND's Settings, or remove ASCEND under **Health Connect → App permissions**.

### Home-screen widgets

Long-press an empty spot on the home screen → **Widgets** → **ASCEND**. Two sizes:

- **ASCEND — today** (4×2): level, XP bar, streak and two of today's quests.
- **ASCEND — today + focus** (4×4): four quests and a **Start focus** button.

Tap **Done?** to mark a quest done in full, or **I'm up** for the wake-up check-in — it counts at the moment you tap, even if ASCEND only opens later. Quests that need a number (minutes, steps, sleep) open the app. After the day-start hour the widget says "Open ASCEND to start today" until you do.

### Reminders that arrive on time

Settings → Notifications → **Reliable reminders** has "Exact timing" and a battery guide for your phone's brand (Nothing, Samsung, Xiaomi, Realme, Oppo / OnePlus, Vivo and others) plus a 2-minute locked-phone test.

### Screen time (phone only)

Off until you switch it on. It counts how long you spend in entertainment apps each day and reminds you calmly — it **never blocks** anything.

1. **Settings → Screen time → Allow screen time.** Android opens its "Usage access" list: find **ASCEND** and switch on **Permit usage access**, then come back. (Nothing Phone: Settings → Apps → Special app access → Usage access → ASCEND.) Allow notifications if Android asks.
2. **Observe week:** for 7 days ASCEND only measures — no reminders, no questions.
3. **One card on Today:** "You average Xh Ym of entertainment a day. Set your daily limit to Z min?" — **Accept** (locks it for 1 week) or **Edit** (another limit, or a 1-month lock). That's the whole setup.

After that:

- **Reminders** only on entertainment apps (the built-in list — YouTube, Instagram, Facebook, X, Snapchat, Netflix, Prime Video, JioHotstar, SonyLIV, ZEE5, aha, MX Player, Crunchyroll, Twitch, Webtoon, Cricbuzz, Dream11 — plus games, plus apps you add), and only when you're **past today's limit** or it's **after your wind-down time** (Settings → Notifications → wind-down, 21:00) until the day-start hour. A gentle first notification, then the same notification updated every minute with the time so far, with **Start focus** and **I'm on a break** (20 minutes, twice a day). Silent in quiet hours. YouTube inside a focus session doesn't count.
- **The lock:** you can always lower the limit or add apps. Raising the limit, removing an app or turning reminders/screen time off waits until the lock ends (the date is shown). Turning off ASCEND's notifications, the "Screen time reminders" channel or Usage access during a lock shows a banner on Today and adds 7 days to the lock. Changing the phone's clock, reinstalling (and signing in) or importing a backup doesn't unlock it — the end is checked against ASCEND's server time, so the phone needs to be online now and then for a lock to end.
- **Screen time** (on Me) shows today vs your limit, this week and top apps. A **Digital discipline** daily quest (Willpower) completes itself for each day you stay within the limit, and the weekly review shows one line comparing your entertainment time with last week.
- **Privacy:** only daily totals per app, on the phone and your own account — never what you did inside an app, never sent to any AI.
- **Battery:** nothing runs in the background except one alarm; a small foreground service (with its required "ASCEND: wind-down time" notification) runs only while a reminder applies, checks once a minute, and pauses while the screen is off.

Server step: see **Phase 11 server step** below.

## Using ASCEND day to day

The bottom bar has **Today · Quests · Focus · Growth · Me** (on a laptop, the same five plus Settings in the sidebar). **Growth** holds Goals, Roadmap, Skills and Jobs; **Me** holds Stats & achievements, Body and Reviews, plus Screen time, What the System knows and the Settings gear. The round robot button on every main screen opens **Ask the System**.

- **Today** is home: tap “I’m up” when you wake (on time until wake time + window, late until the cutoff), then Full or Minimum on each quest, or log minutes / steps / sleep. Undo fixes a mistaken tap the same day.
- A day is **active** when every core quest has at least its minimum done. Hard day? Turn on **Low energy**: only core minimums are needed and they still count.
- Missed a day? A shield covers it automatically if you have one (one per 7 active days, up to 3). Otherwise a small **Recovery quest** appears the next day and can restore the streak.
- **Quests** is where daily quests are added, edited, paused or archived, and where the 3 core quests are chosen.
- **Growth → Goals** holds your Dream, its Main Quests and their milestones. Tap **Plan this goal** (or **Re-plan**): answer a few taps and the Goal Planner proposes milestones, this week's quests and any daily quest — untick or edit anything, then approve. Every plan can be undone from **Plan history**. Each new week, this week's quests are planned automatically (with Undo).
- **Focus** (or “Start focus” on Today): pick a minutes quest or a stat and a length; the minutes count toward the quest, or give 1 XP per minute.
- **Me → Body**: log weight, waist, sleep, steps and workouts; see trends; add a private daily photo (kept only on this device — use “Export with photos” to carry photos to a new device).
- **Me → Reviews**: the 1-minute evening check-in, the weekly review (look back, then confirm next week's quests), and monthly / yearly summaries.
- **Growth → Skills**: your skill tree (AI & ML, Robotics, Game development, Engineering — rename, add or archive anything) and this week's **70/30 study balance**. Levels 0–5 grow with real practice: tag a focus session with skills, or link a daily / weekly / side quest to skills when you edit it (“Skills: … · Change”); levels 4 and 5 also need a finished project, added on the skill with a link as proof. You can also set a level by hand.
- **Growth → Jobs** (switch it on in Settings → Job tracker when your search starts): log applications for jobs, internships or lab positions and move them through Saved → Applied → Assessment → Interview → Offer / Rejected / Ghosted. Each application (and each interview) gives INT XP through a quest; a follow-up reminder comes 7 days after applying; simple stats show applications per week, the response rate and where most applications end — and the Goal Planner suggests a next step when a pattern shows (e.g. a mock interview).
- **Me → Stats & achievements**: level, rank, stats triangle, XP per week, the active-days calendar, achievements, and the title you choose to show.
- The System sometimes suggests a lighter or harder load on Today — one tap applies it (with Undo), or “Not now”.
- **Notifications** (Settings): on the Android app, the wake-up check-in, morning briefing, core quest reminder and evening wind-down arrive even when ASCEND is closed; tap “I’m up” on the wake-up one and the tap time counts. In a browser they only appear while ASCEND is open. Quiet hours hold everything except the wake-up check-in.
- **Settings** (the gear on Me) has the theme and effects (Appearance: Elevate; Effects Full / Light / Off; optional sound and vibration), day-start hour, wake-up times, Auto-plan, Ask the System, backup (export / import), My data and “Rebuild progress”.
- **The Adaptive System** learns quietly on this device from numbers only (never your journal): which quests tend to slip on which days (marked “at risk” on Today), when you really focus, how much you really get done in a week. Today shows one “Now:” line with the best next quest and why, and at most **one suggestion card** at a time — a smaller or bigger target aiming at about 4 good days in 5, a better reminder time, a lighter week when you’re running down, or a goal running behind. Nothing changes without your tap, and everything can be undone. **Me → What the System knows about you** lists everything it has learned, with how sure it is; clear any item, reset one quest or everything, or export the learning data as CSV.
- **Growth → Roadmap** (the Growth Compass): career and health guidance from trusted sources (O*NET, ESCO, DAAD, official docs, WHO, ICMR-NIN), worked out on the device. _Career_: find careers that fit you (interests, strengths, values), pick a target, see the skills still missing in learning order and when you’d be ready at your real pace, and turn it into a plan for approval; roadmaps for AI/ML, ROS 2, C++, robotics maths, simulation, Unreal, IELTS, GRE and the Master’s-in-Germany (APS) route, and study guides. _Health_: a one-minute check-in, your picture against WHO and sleep guidelines from your real data, and a safe, gradual health plan. Not medical advice — for pain or illness it always says to see a doctor.
- **Ask** (the robot button, switch on in Settings → Ask the System): ask career and health questions in your own words. It uses a free AI model through OpenRouter, via your sync account; only the question and progress numbers are sent — never health data, journal text, mood or photos — and free models’ providers may use questions to improve their services. The model can’t browse the web, so it says when something may be out of date and points to official sites for deadlines, fees and requirements; its sources are Growth Compass links. Off-topic questions are declined; when it can’t answer (offline, daily limit, not set up), the Growth Compass answers instead. Suggested quests are only added after you approve them.

## Developer tools (testing only)

When running `npm run dev`, a small yellow wrench button appears at the bottom-left. It lets you change the app's date and time, jump forward N days, switch timezone, generate 30 days / 1 year / 2 years of realistic test data, and reset all data. Changing the clock reloads the app, like opening it later. These tools are **removed from production builds and the Android app**.

## Useful commands

| Command                                | What it does                                                           |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                          | Development server with live reload                                    |
| `npm run build`                        | Production build into `dist/`                                          |
| `npm run preview`                      | Serve the production build locally                                     |
| `npm run e2e`                          | End-to-end tests in a real browser (phone and laptop sizes)            |
| `npm test`                             | Run unit tests once                                                    |
| `npm run check`                        | Type-check + lint + formatting check + tests (run before every commit) |
| `npm run format`                       | Auto-format all files                                                  |
| `npm run icons`                        | Regenerate all app icons from `public/icon.svg`                        |
| `npm run android:sync`                 | Build the web app and copy it into the Android project                 |
| `npm run android:open`                 | Open the Android project in Android Studio                             |
| `npm run icons:android`                | Regenerate Android launcher icons and splash                           |
| `npm run simulate`                     | 5-year game-balance simulation (after changing `src/config/game.ts`)   |
| `npm run perf`                         | 10-year performance test (times every screen's data with 10 years)     |
| `npx playwright test e2e/a11y.spec.ts` | Accessibility check (axe, 44px targets) on every screen                |

## Project docs

- `SPEC.md` — what the app must do
- `PLAN.md` — architecture, data model, build phases and tasks
- `DECISIONS.md` — every decision made (wins over SPEC.md where they differ)
- `PROGRESS.md` — where the build is right now
- `CHANGELOG.md` — what changed in each version

## My data, compaction and deleting everything

Settings → Data → **My data** shows what is stored on this device and in your cloud account, how much space it takes, and everything ever sent outside ASCEND (only Ask the System questions — when and how long, never their content). From there:

- **Compact old history**: when your history gets big, keep a short monthly summary of anything older than 1, 2 or 3 years and remove the day-by-day detail. A full export is saved first and you see exactly what would change before confirming. Levels, XP, ranks, streaks, skill levels and achievements stay exactly the same; other signed-in devices tidy up the same way by themselves.
- **Delete everything**: a final export first, then your cloud data (and your account, if you tick it), then this device.

## Backing up your data

Your data lives on your devices (and in your sync space if you sign in). Back it up anyway — the Android app also saves a weekly backup file to **Documents/ASCEND** by itself:

1. **Export:** Settings → Backup → **Export my data**. In a browser this downloads `ascend-backup-YYYY-MM-DD.json`; in the Android app a share sheet opens — save it to Files, Google Drive or email it to yourself. Keep the file somewhere safe (not only on the same device). Body photos are never included.
2. **Reminder:** in a browser, Today shows a gentle note when your last export is a week old.
3. **Restore on a new device or after a reset:** on the first onboarding screen, open **Already use ASCEND? Restore from a backup** and choose the file. Your level, streaks and history come back exactly.
4. **Import into a device that already has data:** Settings → Backup → **Import a backup**, then pick
   - **Replace** — the device becomes exactly the backup, or
   - **Merge** — combine both; the newer change wins and XP is never counted twice.

   A safety backup of the current data is saved first, automatically.

If the app ever shows its error screen, the **Export my data** button there still works, so your data can always be rescued.

## Sync between your phone and laptop (optional)

ASCEND works fully offline without an account. Signing in (Settings → **Account**: Google or an email link) keeps devices in sync through Supabase (project `ascend`, region eu-west-1).

- **Recommended setup:** the Android app on the phone and the installed web app (PWA) on the laptop, both signed in to the same account. The Android app and a browser on the same phone keep separate data, so don't use both on one phone.
- **First sign-in:** if the account is empty, this device's data is uploaded. On a fresh install, onboarding offers "Sign in to bring your data here". If both have data, ASCEND asks: merge, keep this device's data, or use the account's data — and saves a backup file first.
- **Photos never sync** — they stay on the device they were taken on (use "Export with photos" to move them).

### If Settings says "Sync paused"

Supabase's free tier pauses a project after about a week without activity. Your data is safe on every device; ASCEND keeps working and retries by itself (after 1, 5, 15 minutes, then hourly). To wake the project:

1. Go to https://supabase.com/dashboard and open the **ascend** project.
2. If it shows **Project paused**, click **Restore project** and wait a few minutes until it's active.
3. Back in ASCEND, Settings → Account → **Sync now**. Everything changed in the meantime syncs up.

### Database changes (developers)

The server schema lives in `supabase/migrations`. With the Supabase CLI logged in (`npx supabase login`) and the project linked (`npx supabase link --project-ref cyvrymsjizkpvtyqqflu`), apply new migrations with `npx supabase db push`. The SQL rules are tested locally in PGlite as part of `npm run test`.

### Phase 8 server setup (once, in PowerShell from the project folder)

Phase 8 adds three migrations (new synced tables, cloud usage, compaction clean-up, Ask the System limits) and two Edge Functions. Until they are applied, the app keeps working: the new data stays on your devices and Ask the System falls back to the Growth Compass.

```powershell
npx supabase login
npx supabase link --project-ref cyvrymsjizkpvtyqqflu
npx supabase db push
npx supabase functions deploy delete-account
npx supabase functions deploy ask
```

Then set up Ask the System (below) and switch it on in Settings → **Ask the System**.

### Phase 11 server step (once)

Phase 11 adds one migration (`supabase/migrations/20261105000000_phase11_screen_time.sql`: the screen-time tables for sync and the server clock used by locks). Run `npx supabase db push` from the project folder. Until then screen time works on the phone alone, its data stays on the phone, and a lock can't end (no trusted time yet) — so push before your first lock is due to end.

```powershell
npx supabase db push
```

### Ask the System: the OpenRouter key

Ask the System uses free models on [OpenRouter](https://openrouter.ai) (an OpenAI-compatible service). Create a key at https://openrouter.ai/settings/keys, then in PowerShell from the project folder — the key is typed into the prompt, never pasted into a chat or a file:

```powershell
$secure = Read-Host "OpenRouter API key" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
npx supabase secrets set OPENROUTER_API_KEY=$key
Remove-Variable key, secure
npx supabase functions deploy ask
```

- **Model**: by default `google/gemma-4-31b-it:free`; if it's unavailable, `nvidia/nemotron-3-ultra-550b-a55b:free`; if both fail, the app answers from the Growth Compass. To use another model (see the `:free` ones at https://openrouter.ai/models?q=free), run `npx supabase secrets set OPENROUTER_MODEL=<model id>` — no redeploy needed.
- **Free-model privacy setting**: OpenRouter only routes to free models if your account allows it — https://openrouter.ai/settings/privacy (allow the free endpoints / their data policy). Otherwise the logs show "No endpoints found matching your data policy".
- **Limits**: free models have daily limits on OpenRouter's side; ASCEND stays well under them (10 questions a day per device, 20 per account on the server).
- **When it fails**: Supabase Dashboard → Edge Functions → **ask** → Logs shows lines like `ask: OpenRouter 404 code=404 model=…: <OpenRouter's message>` (never the key).
- The earlier Gemini version is kept in `supabase/functions/ask/gemini.ts` (unused; Gemini needed prepaid credits).
