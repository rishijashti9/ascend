Read CLAUDE.md, then PROGRESS.md. Check git status.
Add a new Phase 11: "Digital Discipline" — keep it simple. Screen time and strict wasted-time reminders on phone and laptop, with locked limits. No blocking. Record this in DECISIONS.md. Everything off by default; I switch each part on.

1. Screen time
- Android: native plugin using UsageStatsManager ("Usage access", with a short setup guide incl. Nothing OS). Daily totals per app only.
- Laptop: Chrome/Edge extension (Manifest V3) in this repo. Daily totals per website domain only — never full URLs, page content or history. Incognito counts too: guide me to enable "Allow in Incognito" during setup. README with install steps (unpacked extension). Syncs only daily totals to my account.
- Three categories only: Entertainment, Work/Study, Neutral. Defaults — Entertainment: youtube.com, netflix.com, primevideo.com, jiohotstar.com, sonyliv.com, zee5.com, aha.video, mxplayer.in, crunchyroll.com, twitch.tv, instagram.com, facebook.com, x.com, snapchat.com, pinterest.com, poki.com, crazygames.com, store.steampowered.com, webtoons.com, cricbuzz.com, dream11.com and the matching phone apps. Everything else starts as Neutral; phone browsers are Neutral. I can edit categories (subject to locks).
- Observe week: when I switch screen time on, it only tracks for 7 days (no reminders), then suggests realistic limits and study hours from my real usage, which I accept or edit.
- A simple Screen time screen: today and this week, top apps/sites, entertainment vs work/study.

2. Reminders (strict, never blocking)
- Limits and reminders apply only to Entertainment, never to Work/Study.
- Three triggers: over my daily entertainment limit; entertainment during my study hours (I set them, plus any focus session); entertainment after my wind-down time (protects my 5:00 wake-up).
- Reminder interval: I choose 15 seconds, 30 seconds or 1 minute (default 1 minute). While I'm still on entertainment, re-alert at that interval until I leave or tap a button. Update one ongoing notification each time (sound/vibration + time spent so far) instead of stacking new ones. Buttons: "Start focus", "5 more minutes" (once), "I'm on a break" (pause 20 min). Calm, clear wording, never shaming. Respect quiet hours.
- Screen-time reminders use their own Android notification channel, separate from the wake-up and other reminders.
- Do Not Disturb: optionally (I grant Do Not Disturb access once in setup), screen-time reminders may come through during Do Not Disturb, except during quiet hours. Explain this clearly before asking.
- Planned free time: I can schedule entertainment time in advance (at least 12 hours ahead, max 2 per week, e.g. "Sunday 19:00–21:00 movie night"). No reminders during it; the time still shows in stats and the weekly review. Planned free time can't be created or extended at short notice during a lock.
- During any focus session, YouTube counts as Work/Study.
- Android: a small foreground service (with its required ongoing notification, e.g. "ASCEND: study time") that runs ONLY while a trigger is active, checking the foreground app at the chosen interval; otherwise no background checking. Test battery impact on my Nothing Phone (3a).
- Laptop: the extension shows a reminder bar on the entertainment page itself at the same interval (plus a browser notification), never blocking the page.

3. Locked limits
- When I set limits, I choose a lock: 1 week (suggested at first) or 1 month. During the lock I can make things stricter anytime; loosening (raising/deleting a limit, shortening study hours, later wind-down, moving something out of Entertainment, a less frequent reminder interval, turning reminders off, removing Do Not Disturb pass-through) only takes effect after the lock ends, with the date shown.
- "I'm on a break" max 2 per day during a lock. Locks are synced, and changing the device clock, reinstalling or importing a backup doesn't unlock them.
- If during a lock: ASCEND's notifications or just the screen-time reminder channel are disabled in system settings, Usage access is removed, Do Not Disturb access is revoked (if I had granted it), or the extension is disabled/removed or loses incognito access — show a persistent banner on Today until fixed, extend the lock by 7 days per incident, and show it in the weekly review. No XP loss.
- Deliberate exception to principle 8 — record in DECISIONS.md.

4. Connect to the System
- A "Digital discipline" daily quest (e.g. entertainment under my limit) counting toward WIL, completed automatically.
- Weekly review: entertainment time vs last week, breaks and planned free time used, any lock extensions. No XP loss, no guilt.

Privacy and rules
- Only daily totals are stored; on-device and my private synced account only; never sent to any AI. Included in export, compaction and "Delete everything" (clearing data does not remove active locks).
- Never break existing user data. Tests for triggers, reminder intervals, break cap, planned free time rules, observe week, locks (incl. clock/import/re-categorize attempts, channel disabling and the 7-day extension), work sites never limited, privacy. Give me a real-device checklist for my Nothing Phone (3a) and Chrome on Windows.
- Future idea (SPEC.md section 15, don't build): optional accountability partner who gets an email if I disable reminders during a lock.

PROCESS
First write the SPEC.md section and the Phase 11 task list in PLAN.md and PROGRESS.md (small tasks, section 0.1), then STOP and show me a short summary for approval. After I approve, build the whole phase without stopping between tasks. At the end, give me one short summary: what's new, bugs fixed, decisions made, and the checklist.
