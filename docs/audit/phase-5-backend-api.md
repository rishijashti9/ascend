# Production hardening — Phase 5: backend and API improvements

Date: 2026-11-11 · Builds on [phase-4-auth-db-hardening.md](phase-4-auth-db-hardening.md).
**Status: deployed 2026-11-11 with the owner's go-ahead** (was: committed, not deployed) — needs
`supabase functions deploy ask delete-account` and a push to `main`.

## 1. What was inspected

Both Edge Functions' request handling and CORS, every place a user-supplied URL becomes a
link, the local error log and console output, environment-variable documentation. AI-specific
items (prompt construction, model timeouts, output validation) are Phase 7.

## 2. Problems and changes

| ID   | Sev.                     | Problem                                                                                                                                                                                               | Change                                                                                                                                                                                        | Files                                                  |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| V-12 | Low                      | Edge Functions sent `Access-Control-Allow-Origin: *`.                                                                                                                                                 | Shared allow-list: the web app, the Android app (`https://localhost`), local dev; `Vary: Origin`; strangers get no CORS headers.                                                              | `supabase/functions/_shared/cors.ts`, both `index.ts`  |
| V-13 | Info (re-rated from Low) | **Phase 2 was partly wrong:** project and evidence links _are_ checked on save (`skills.ts:281`); I had only read the schema. Real remaining gap: records arriving by import or sync skip that check. | `safeExternalUrl` guards rendering of job and project links (`http(s)` only, parsed with `URL`).                                                                                              | `src/core/safeUrl.ts`, `JobCard.tsx`, `SkillSheet.tsx` |
| V-15 | Low                      | Error log stored raw messages and stacks; `console.error` printed the raw error (Android logcat).                                                                                                     | `scrubSecrets` removes JWTs, `Bearer` tokens, Supabase/OpenRouter keys, auth-code/token URL values and emails before storing or printing.                                                     | `src/core/errorLog.ts`                                 |
| V-17 | Low                      | `.env.example` named `VITE_SUPABASE_ANON_KEY` and `ANTHROPIC_API_KEY` (wrong/obsolete).                                                                                                               | Rewritten: the real `VITE_SUPABASE_PUBLISHABLE_KEY`, the CSP note, server secrets only as Supabase secrets. The unused Gemini code was **kept** — it's there by an earlier decision of yours. | `.env.example`                                         |

## 3. Tests and evidence

| Test                                                                                                                                                                                        | Result                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `edgeCors.test.ts`: 4 allowed origins echoed exactly; look-alikes (`…vercel.app.evil.example`, `evil-ascend…`), `http://`, other ports, `null`, empty, missing → no permission; no wildcard | 3/3 new                                   |
| `safeUrl.test.ts`: http(s) kept; `javascript:` (any case, leading space), `data:`, `vbscript:`, `file:`, `intent:`, app scheme, protocol-relative, spaces, bare host, empty → no link       | 2/2 new                                   |
| `errorLog.test.ts`: JWT, Bearer, auth code, email with `+`, publishable key, OpenRouter key all absent from storage; the rest of the message kept; ordinary messages unchanged              | 7/7 (2 new)                               |
| Jobs and skills screen tests                                                                                                                                                                | 13/13                                     |
| `npm run check`                                                                                                                                                                             | Passed — 153 files, 879 tests             |
| Full e2e (phone + laptop)                                                                                                                                                                   | 42 passed, 2 skipped (opt-in screenshots) |

Not run: Deno type-check of the Edge Functions (no Deno on this laptop) — the edit was
reviewed by reading it; `supabase functions deploy` bundles and type-checks it, and the live
probes after deploying confirm behaviour.

## 4. Remaining risks

- CORS protects browsers only; non-browser callers still need a valid token (unchanged,
  verified in Phase 2/4).
- Not live until deployed.

## 5. Deployment (2026-11-11)

| Step                                           | Evidence                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase functions deploy ask delete-account` | Both bundled and deployed, each with `_shared/cors.ts` (the deploy bundles and type-checks the code)                                                                                                                                                |
| Live CORS pre-flight                           | Both functions: `https://ascend-vert-mu.vercel.app` and `https://localhost` echoed; `https://evil.example` → no `Access-Control-Allow-Origin`                                                                                                       |
| Live auth still enforced                       | `ask` without a user token → `{"error":"signed_out"}` 401                                                                                                                                                                                           |
| `git push` (`8b6320e`) → Vercel                | Commit status `success`                                                                                                                                                                                                                             |
| e2e against production                         | security + smoke + career: 15/16 first run — the CSP screen walk **timed out** on laptop (`page.goto` > 30 s over the network; no violation). Gave that test a 90 s budget; re-run ×3 on both devices: 12/12 (slowest 32.3 s, confirming the cause) |
