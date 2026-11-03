Read CLAUDE.md, then PROGRESS.md. Check git status.
Add a new Phase 11: "Screen Time" — phone only, and above all SIMPLE for the user: setup must take under 3 minutes and need no decisions beyond accepting a suggestion. It supports willpower; it never blocks. Record this in DECISIONS.md. Off by default.

1. Setup (3 steps, nothing more)
- One "Allow screen time" button that opens Android's Usage access screen for ASCEND (short guide incl. Nothing OS). Nothing else to configure.
- Observe week: for 7 days it only tracks quietly (no reminders, no questions).
- After 7 days, one card: "You average Xh Ym of entertainment a day. Set your daily limit to Z min?" (Z = a realistic step down from my average). Buttons: Accept (locks for 1 week) / Edit. That's the whole setup.

2. What it tracks
- Android UsageStatsManager, daily totals per app only.
- A built-in list of entertainment apps (e.g. YouTube, Instagram, Facebook, X, Snapchat, Netflix, Prime Video, JioHotstar, SonyLIV, ZEE5, aha, MX Player, Crunchyroll, Twitch, Webtoon, Cricbuzz, Dream11, common games). Everything else is not limited. I can add or remove apps from the list (removing waits for the lock to end).
- A simple Screen time card/screen: today vs my limit, this week, top apps.

3. Reminders (never blocking)
- Only for entertainment apps, only in two cases: I'm over my daily limit, or I'm scrolling after my wind-down time (protects my 5:00 wake-up). During a focus session, YouTube doesn't count.
- A gentle first notification, then a re-alert every 1 minute while I'm still on an entertainment app (one ongoing notification updated with time spent, not a stack). Buttons: "Start focus" and "I'm on a break" (pauses 20 min, max 2 per day). Calm wording, never shaming. Respects quiet hours.
- Uses its own notification channel, and a small foreground service that runs ONLY while a reminder is active; otherwise no background checking. Test battery impact on my Nothing Phone (3a).

4. Lock (automatic, invisible until needed)
- Accepting or changing the limit locks it for 1 week (option for 1 month). During the lock I can lower the limit anytime; raising it, removing apps from the list, or turning reminders off only takes effect after the lock ends (date shown).
- If during a lock ASCEND's notifications or the screen-time channel are turned off, or Usage access is removed: a banner on Today until fixed, and the lock extends by 7 days. Locks are synced; clock changes, reinstalling or importing a backup don't unlock them.
- Deliberate exception to principle 8 — record in DECISIONS.md.

5. Connect to the System
- A "Digital discipline" daily quest (entertainment under my limit) counting toward WIL, completed automatically.
- One line in the weekly review: entertainment time vs last week. No XP loss, no guilt.

Privacy and rules
- Only daily totals; on-device and my private synced account only; never sent to any AI; included in export, compaction and "Delete everything" (clearing data doesn't remove an active lock).
- Never break existing user data. Tests for observe week, limit suggestion, reminders, break cap, lock rules (incl. clock/import attempts and the 7-day extension), privacy. Give me a short real-phone checklist for my Nothing Phone (3a).
- Future ideas (SPEC.md section 15, don't build): laptop Chrome extension with the same reminders; accountability partner.

PROCESS
First write the SPEC.md section and the Phase 11 task list in PLAN.md and PROGRESS.md (small tasks, section 0.1), then STOP and show me a short summary for approval. After I approve, build the whole phase without stopping between tasks. At the end, give me one short summary: what's new, bugs fixed, decisions made, and the checklist.
