# ASCEND operations runbook

How ASCEND is deployed, monitored, rolled back and recovered. Written in hardening Phase 9
(2026-11-11); keep it current when infrastructure changes.

## 1. Where things run

| Piece           | Where                                                                        | Notes                                                                 |
| --------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Web app (PWA)   | Vercel, auto-deploys `main` → https://ascend-vert-mu.vercel.app              | Static files only; security headers in `vercel.json`                  |
| Android app     | Debug APK built locally, sideloaded                                          | Same web code inside Capacitor; CSP via `<meta>`                      |
| Database + auth | Supabase project `ascend` (`cyvrymsjizkpvtyqqflu`, eu-west-1), **Free plan** | One table `sync_records` + Ask tables; schema = `supabase/migrations` |
| Edge Functions  | Supabase: `ask`, `delete-account`                                            | Code in `supabase/functions`; deploy with the CLI                     |
| AI              | OpenRouter (free models), called only by `ask`                               | Key = Supabase secret                                                 |
| CI + monitoring | GitHub Actions: `ci.yml` (every push/PR), `live-checks.yml` (daily)          | No secrets used                                                       |

**Where your data lives (most important first):** every signed-in device holds a **complete**
copy in IndexedDB; Supabase holds the latest version of every record for sync; JSON exports
and the weekly Android backup file are point-in-time copies. Supabase is a sync copy, not the
only copy.

## 2. Environments

- **Production**: the Vercel site + the Supabase project above.
- **Previews**: Vercel builds a preview for every non-`main` branch. Previews use the **same**
  Supabase project (the URL is built into the app), so signing in on a preview touches real data.
- **Local dev / tests**: also point at the production project by default. Automated tests never
  sign in, so they never read or write account data.
- **Recommended (needs you):** a second free Supabase project for development, used through
  `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and added to `connect-src`
  in `vercel.json`/`index.html` only for local builds. Until then: don't sign in with your real
  account on previews or local dev builds you're experimenting with.

## 3. Releasing a change

1. Work on a branch; push it — **CI** runs `npm run check`, e2e (phone + laptop) and the
   Android build. Fix anything red.
2. Merge to `main` (or push `main`) → Vercel deploys the web app in ~1–2 minutes.
3. Database change: `npx supabase db push --dry-run`, check the list, then `npx supabase db push`.
4. Edge Function change: `npx supabase functions deploy <name>`.
5. Verify: run **Actions → Live checks → Run workflow** (or
   `LIVE_API=1 npx playwright test e2e/live-api.spec.ts --project=laptop`).
6. Android: `npm run android:sync`, build and install the APK (README).
7. Version bump + CHANGELOG entry for user-visible releases.

## 4. Rolling back

| What               | How                                                                                                                                         | Time             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Web app            | Vercel dashboard → Deployments → the last good one → **Instant Rollback**. Or `git revert <sha>` and push.                                  | < 1 min / ~2 min |
| Edge Function      | `git checkout <good-sha> -- supabase/functions/<name>` then `npx supabase functions deploy <name>`; restore the files afterwards.           | ~1 min           |
| Database migration | Migrations are forward-only; undo with a new migration. Undo SQL for the hardening ones is below. **Never** edit an applied migration file. | minutes          |
| Android            | Reinstall the previous APK (keep the last good `app-debug.apk`). Data stays on the phone.                                                   | minutes          |

Undo SQL (run in the Supabase SQL editor only if a hardening change must be reverted):

```sql
-- 20261110000000_signup_allowlist.sql (re-opens sign-ups!)
drop trigger if exists guard_signup on auth.users;

-- 20261111000000_db_hardening.sql: the row ceiling only (keeps the grants)
create or replace function public.sync_row_limit() returns int
  language sql immutable set search_path = '' as $$ select 2147483647 $$;
```

## 5. Backups and disaster recovery

Supabase's Free plan has **no automatic backups and no point-in-time recovery** (Supabase
docs: Platform → Backups). Recovery therefore relies on the devices and on exports.

**Routine (you):**

- Monthly: Settings → Backup → **Export** (and **Export with photos** now and then); keep the
  file off the phone (laptop / cloud drive).
- Keep the Android app's weekly automatic backup on (Settings → Backup). _Open decision V-05:
  its location._
- Optional server copy: `npx supabase db dump --data-only -f backups/ascend-YYYY-MM-DD.sql`
  (asks for the database password; store the file privately — it contains your data).

| Disaster                                  | Recovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Data loss                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Phone lost / wiped                        | New phone: install the APK, onboarding → "Sign in to bring your data here" → everything downloads. Without sync: import the latest export.                                                                                                                                                                                                                                                                                                                                                                                                                                                   | None with sync; else since the last export |
| Laptop lost                               | Same as above in the browser (install the PWA, sign in).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | None with sync                             |
| Supabase project deleted / corrupted      | 1) New project; 2) `npx supabase link --project-ref <new>` and `npx supabase db push` (rebuilds the full schema — the migrations are tested from scratch in `sql.test.ts`); 3) `npx supabase functions deploy ask delete-account`; set `OPENROUTER_API_KEY`; 4) update URL + publishable key in `src/config/cloud.ts`, `connect-src` (`vercel.json`, `index.html`), redeploy; 5) sign in on your main device → choose **Use this device's data** → it re-uploads everything; other devices then sign in and download. Turn sign-ups off; add your email to `private.signup_allowlist` first. | None (devices hold everything)             |
| Supabase paused (free tier, ~1 week idle) | Dashboard → Restore project. The app keeps working offline meanwhile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | None                                       |
| Vercel down / project lost                | The installed PWA and Android app keep working offline. Re-create the Vercel project from GitHub (`vercel.json` holds the settings).                                                                                                                                                                                                                                                                                                                                                                                                                                                         | None                                       |
| GitHub account lost                       | Local clones hold the full history; push to a new repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | None                                       |

**Restore drills (automated, run on every CI run):** export → wipe → import gives identical
progress (`e2e/core-loop.spec.ts`); a fresh device downloads everything at sign-in
(`link.test.ts`); the full schema builds from the migrations on an empty database
(`sql.test.ts`). **Manual drill (yearly):** import last month's export into a fresh browser
profile and compare level, XP and streak with the phone.

## 6. Monitoring and alerting

| Signal                                                                                       | Where                                                                                                                          | Alert                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Live security + availability (site up, headers, no anonymous access, functions need sign-in) | `live-checks.yml`, daily 06:00 IST                                                                                             | GitHub emails you when it fails                        |
| Build/test regressions                                                                       | `ci.yml` on every push/PR                                                                                                      | GitHub email on failure                                |
| Edge Function errors                                                                         | Supabase Dashboard → Edge Functions → Logs (status, model, provider message — never keys or questions)                         | Check when Ask misbehaves                              |
| Sync problems                                                                                | In-app Account status ("Sync paused", "cloud copy is full")                                                                    | Shown to you                                           |
| App crashes                                                                                  | Local error log (last 100 errors, scrubbed of tokens/emails); the crash screen's **Copy error details** copies it for a report | No third-party tracking by design (SPEC: no analytics) |
| Dependency vulnerabilities                                                                   | Dependabot PRs weekly; `npm audit --omit=dev` must stay at 0                                                                   | GitHub notification                                    |

## 7. Secrets

| Secret                             | Lives in                                | Rotate when            | How                                                                                                                           |
| ---------------------------------- | --------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`               | Supabase function secrets               | Suspected leak; yearly | New key at openrouter.ai → `npx supabase secrets set OPENROUTER_API_KEY=…` (typed into a prompt, README) → revoke the old one |
| Supabase service-role / secret key | Supabase only (injected into functions) | Suspected leak         | Dashboard → Settings → API keys → rotate; functions pick it up automatically                                                  |
| Supabase publishable key           | In the app (public by design)           | Never needs secrecy    | —                                                                                                                             |
| Database password                  | You (CLI prompts)                       | Suspected leak         | Dashboard → Database → reset password                                                                                         |
| Google OAuth client secret         | Supabase auth settings                  | Suspected leak         | Google Cloud console → new secret → paste into Supabase                                                                       |

Never put a secret in a `VITE_` variable, a commit, a chat or a log.

## 8. Accepted risks (reviewed 2026-11-11)

- 20 moderate/low advisories in **dev/build tools only** (eslint/minimatch, vite-plugin-pwa/
  workbox-build, @capacitor/assets/uuid); npm's suggested fixes are major **downgrades**.
  Shipped app: 0 (`npm audit --omit=dev`). Dependabot tracks upstream fixes.
- Android lint warns that `@capgo/capacitor-health` was built with Kotlin 2.4 vs the
  toolchain's 2.2 — non-fatal, build and tests pass; resolves with the next Capacitor/AGP update.
