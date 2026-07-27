# EduSphere AI — Full Codebase Audit

**Repo:** `Rishu123-png/edusphere-ai` · **Branch:** `arena/019fa3a6-edusphere-ai` (from `main` @ `4925774`)
**Audited:** 2026-07-27 · 116 tracked files · ~18,400 lines of TS/TSX/CSS · 22 MB working tree

---

## 1. Verdict at a glance

| Check | Result |
|---|---|
| `tsc -b` (typecheck) | ✅ **Passes, 0 errors** |
| `npm run build` (Vite + PWA) | ✅ **Passes in ~16 s**, 48 precache entries (4.4 MB) |
| `npm run lint` (ESLint) | ⚠️ **447 problems** — 11 errors, 436 warnings |
| `npm audit` (prod deps) | 🔴 **9 vulns** (1 critical, 5 high, 1 moderate, 2 low) |
| Secrets hygiene | 🔴 **Live API keys committed to git and shipped in the JS bundle** |
| Tests | ❌ **None exist** (no test runner, no test files) |

The app **compiles and builds cleanly** — that's genuinely good for a project this size. The problems are
concentrated in **security/secrets**, **data-model consistency**, and **process hygiene** (no tests, stale
build artifacts, default README).

---

## 2. What this project is

**EduSphere AI** — a mobile-first PWA for Indian private-school management (v2.1.0). Single-page React app
talking directly to Firebase Realtime Database, with an optional Firebase Functions backend and a Capacitor
wrapper for Android.

**Stack:** React 19 · TypeScript 5.7 · Vite 6 · Tailwind 3.4 · Firebase 11 (Auth + RTDB + Storage) ·
`face-api.js` (on-device biometric attendance) · jsPDF · XLSX · Recharts · Framer Motion + anime.js ·
Capacitor 6 · deployed to Vercel.

**Feature surface (15 pages):** Dashboard, Students, Teachers, Attendance, Marks, AI Insights, Schedule,
Reports, Calendar, Notifications, WhatsApp, Settings, Super Admin, Login, Onboarding.

**Five roles:** `super_admin`, `school_admin`, `teacher`, `student`, `parent`.

### Notable engineering that's actually well done

- **Offline-first attendance** (`src/lib/offlineSync.ts`) — localStorage queue, dedupe by ID, auto-flush on
  `online` event, single atomic multi-path `update()`. Solid.
- **Face recognition** (`src/lib/faceRecognition.ts`, 440 lines) — self-hosted 12 MB models with jsDelivr CDN
  fallback, SPA-fallback detection (probes for HTML masquerading as JSON), tensor-corruption recovery with
  cache eviction + retry, and a **runner-up margin check** in `findBestFaceMatch` so two similar faces don't
  swap identities. That last detail is a genuinely thoughtful anti-false-positive measure.
- **Manual chunking** in `vite.config.ts` splits vendors sensibly (react/firebase/face-api/pdf/xlsx/charts).
- **Friendly error mapping** (`src/lib/errors.ts`) — Firebase auth codes never leak to teachers.
- **White-label AI** (`src/lib/gemini.ts`) — provider-flexible (Gemini or any OpenAI-compatible endpoint),
  with local fallback replies so the assistant degrades gracefully instead of erroring.
- **IST-pinned time handling** — `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` rather than device TZ.

---

## 3. 🔴 Critical: secrets are committed and publicly shipped

### 3.1 `.env` is tracked in git

`.gitignore` correctly lists `.env`, **but the file was committed before the ignore rule took effect**, so
git keeps tracking it:

```
$ git ls-files | grep env
.env            ← tracked, contains live keys
.env.example
```

It contains two **real, live credentials**:

| Variable | Value prefix | Provider |
|---|---|---|
| `VITE_AI_API_KEY` | `sk-or-v1-66cb6ea9…` | OpenRouter |
| `VITE_GEMINI_API_KEY` | `AQ.Ab8RN6Ihgmq9…` | Google Gemini |

### 3.2 The keys are also compiled into the public JS bundle

This is the more serious half. Any `VITE_*` variable is **inlined at build time** by Vite. I confirmed it:

```
$ grep -oE "sk-or-v1-.{8}|AQ\.Ab8RN6.{6}" dist/assets/index-*.js
AQ.Ab8RN6Ihgmq9
sk-or-v1-66cb6ea9
```

So anyone who opens DevTools on the deployed site can read both keys and spend your quota. The code even
*acknowledges* this in a comment it then ignores — `src/lib/gemini.ts:56`:

> `// Never ship an AI credential in the browser bundle.`

…immediately above code that does exactly that.

### Remediation (do these in order)

1. **Rotate both keys now.** Revoke at [openrouter.ai/keys](https://openrouter.ai/keys) and
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Assume they are compromised.
2. **Untrack the file:** `git rm --cached .env && git commit`. (History rewriting via
   `git filter-repo` is only worth it if the repo is or was public.)
3. **Move AI calls server-side.** You already have `functions/` — add a `chat` callable that holds the key in
   Functions config and proxies to the model. The browser then never sees a credential.
4. Firebase `VITE_FIREBASE_*` keys are *fine* to ship publicly — they're identifiers, not secrets. Your RTDB
   rules are the real security boundary there. Only the **AI** keys are the problem.

---

## 4. 🔴 High: dependency vulnerabilities

`npm audit --omit=dev` → **9 vulnerabilities in production dependencies**:

| Package | Severity | Issue | Fix path |
|---|---|---|---|
| `xlsx@0.18.5` | **High** | Prototype pollution + ReDoS | **No npm fix exists.** Migrate to `exceljs`, or install SheetJS from their own CDN registry (`cdn.sheetjs.com`) which has patched builds. |
| `react-router` 7.12–8.2 | **High** | RSC-mode CSRF bypass | `npm audit fix` (non-breaking). You don't use RSC, so exposure is low — but patch anyway. |
| `dompurify` (via `jspdf`) | Moderate ×15 | Many XSS bypasses | Upgrade `jspdf` 2.5 → 4.2 (breaking; check `brochurePdf.ts`, `idCardPdf.ts`, `reportCardPdf.ts`, `meritListPdf.ts`, `tcPdf.ts`). |
| `node-fetch` (via `@tensorflow/tfjs-core` ← `face-api.js`) | High | Header leak on redirect | **Node-only code path** — never runs in the browser. Effectively not exploitable here, but `face-api.js` is unmaintained (last release 2020). Consider `@vladmandic/face-api`, a maintained fork with the same API. |

**Realistic risk ranking:** `xlsx` is the one that actually matters, because `StudentsPage.tsx:469` parses
**user-uploaded spreadsheets** with it. A malicious roster file is a real attack path. Prioritise that.

---

## 5. 🟠 The data-model bug: attendance is stored two ways and read three ways

This is the most consequential *correctness* issue in the codebase, and it silently corrupts dashboard numbers.

### The two shapes

`AttendancePage.tsx` writes **every record twice** (lines 489–490, 645–647, 1055–1056):

```js
// New period-keyed path (primary)
schools/{sid}/attendance/{date}/{classKey}/{slotKey}/{studentId} = rec
// Legacy flat compat path
schools/{sid}/attendance/{date}/{studentId} = { ...rec, _compat: true }
```

So under `attendance/{date}` you get a **mix** of nested class nodes and flat student records, side by side.

### The three reading strategies

| File | Strategy | Correct? |
|---|---|---|
| `DashboardPage.tsx:99` (`todayRecords`) | Recursive `ingest()`, walks all depths, dedupes per student | ✅ |
| `WhatsAppPage.tsx:59` (`absentees`) | Recursive `ingest()`, same logic | ✅ |
| `AttendancePage.tsx` | Recursive `ingest()` | ✅ |
| **`DashboardPage.tsx:154`** (6-day `trend`) | `Object.values(attendance[key])` — **one level only** | ❌ |
| **`ReportsPage.tsx:53,67,82`** (all/weekly/monthly) | `Object.values(dayRecords)` — **one level only** | ❌ |
| **`AIPage.tsx:53`** (`todayRecords`) | `Object.values(...)` — **one level only** | ❌ |
| **`FloatingAIAssistant.tsx:136`** | `Object.values(...)` — **one level only** | ❌ |
| **`ai.ts:298`** (`generateSchoolForecast`) | `Object.values(dayRecords)` — **one level only** | ❌ |

### What actually breaks

The shallow readers iterate `attendance[date]` and get a mix of:
- flat records → `{studentId, status: 'present', …}` — `r.status` works ✅
- class nodes → `{"10-A": {...}}` — `r.status` is `undefined` ❌

Those class nodes still **count toward the denominator** (`dayRecs.length`) but never match
`['present','late'].includes(r.status)`. Result: **Reports and AI Insights systematically under-report
attendance percentages**, and the error grows with the number of distinct classes marked that day.

Same-day numbers on the Dashboard (which uses `ingest`) will **disagree** with the Reports page for the same
date. Notably, `DashboardPage` gets its own KPI cards right but its own 6-day trend chart wrong — the two
strategies live 55 lines apart in the same file.

### Fix

Extract the `ingest`/flatten logic into one shared helper (it's already duplicated verbatim three times) and
call it everywhere:

```ts
// src/lib/attendance.ts
export function flattenDay(dayNode: unknown): AttendanceRecord[] { /* the ingest() logic */ }
```

Then replace all seven shallow `Object.values(...)` call sites. Longer term, drop the `_compat` double-write
once no reader depends on the flat path — carrying two shapes forever guarantees this bug recurs.

---

## 6. 🟠 Status enum mismatch: writes can be silently rejected

`src/types/index.ts:110` declares six attendance statuses:

```ts
status: 'present'|'absent'|'late'|'half_day'|'leave'|'medical_leave'
```

`database.rules.json` only validates **four**:

```
'present' || 'late' || 'absent' || 'leave'
```

So `half_day` and `medical_leave` would be **rejected by the server**. `DashboardPage.tsx:123` and
`ParentPortalPage.tsx:21` both read and colour-code these values, implying the UI expects them to exist.

Currently no code *writes* them (`lib/attendance.ts` narrows to a 3-value `AttendanceStatus`), so it's latent
— but the moment someone adds a "Half Day" button it fails with an opaque permission error. Either add the
two values to the rules or remove them from the type. Right now the type is lying.

---

## 7. 🟠 Firebase Functions: source and deployed build have diverged

`functions/lib/index.js` is a **committed build artifact that no longer matches `functions/src/index.ts`**:

| | `src/index.ts` (source) | `lib/index.js` (committed build) |
|---|---|---|
| `createSchool` | `enforceAppCheck: false` | `enforceAppCheck: **true**` |
| `joinSchool` | `enforceAppCheck: false` | `enforceAppCheck: **true**` |
| `sendWhatsAppAlert` | ✅ present | ❌ **missing entirely** |

Since `functions/package.json` sets `"main": "lib/index.js"`, **the stale file is what deploys**. So:
- `sendWhatsAppAlert` doesn't exist in production despite `WhatsAppPage.tsx` advertising it to users
  ("deploy the **sendWhatsAppAlert** Cloud Function…").
- App Check is enforced in the deployed build but not in source — if App Check isn't configured in your
  Firebase project, `createSchool`/`joinSchool` **fail for every user**.

**Fix:** add `functions/lib/` to `.gitignore`, `git rm -r --cached functions/lib`, and let `npm run build`
(which already runs `tsc`) generate it at deploy time.

### Related: the Functions aren't actually used

`OnboardingPage.tsx` defines its own local `createSchool`/`joinSchool` that write **directly to RTDB from the
browser** — including `role: 'school_admin'` and `schoolId` on the user's own profile. There is no
`httpsCallable` anywhere in `src/`. The server-side functions exist but are dead code from the client's
perspective.

The rules do guard this (`users/$uid/.validate` blocks self-promotion to `super_admin` and blocks changing
`schoolId` once set), so it isn't wide open — but it means **any authenticated user can make themselves a
`school_admin` of a brand-new school** by hitting the RTDB directly. The comment in `functions/src/index.ts`
says *"Server-owned role and school membership writes. Never expose these writes to a browser"* — which is
precisely what the client does. Also missing: `firebase.json` and `.firebaserc`, so the Functions can't be
deployed from this repo as-is.

---

## 8. 🟡 Lint: 11 errors, 436 warnings

`npm run lint` **fails** (exit 1). Breakdown:

| Rule | Count | Severity |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 352 | warning |
| `@typescript-eslint/no-unused-vars` | 70 | warning |
| `react-hooks/exhaustive-deps` | 6 | warning |
| `react-refresh/only-export-components` | 4 | warning |
| `no-useless-escape` | 4 | **error** |
| `no-empty` | 4 | **error** |
| `prefer-const` | 1 | **error** |
| `no-control-regex` | 1 | **error** |
| `@typescript-eslint/no-unused-expressions` | 1 | **error** |

**352 `any`s** is the headline. `StudentsPage.tsx` literally declares `type Student = any`, discarding the
`Student` interface that `src/types/index.ts` carefully defines with 30 fields. Several pages call
`useAuth() as any`, which throws away all `AuthContextType` safety. The type system is well-designed and then
routinely bypassed — that's how the §6 enum mismatch survives.

Quick wins:
- `--fix` handles 4 automatically.
- The 11 errors are all trivial (stray `\-` escapes in regex character classes, empty `catch {}` blocks,
  one `let` that should be `const`).
- `src/types/index.ts:154` — `meta?: any` on `NotificationItem`.

Also note **two lint configs coexist**: `eslint.config.js` (used by `npm run lint`) and `.oxlintrc.json`
(Oxlint, never invoked — `oxlint` isn't even a dependency). The `.oxlintrc.json` is leftover template debris.

---

## 9. 🟡 Dead code and unused dependencies

### Unreferenced source files (4)

| File | Lines | Note |
|---|---|---|
| `src/components/PremiumAnimatedHero.tsx` | 143 | Sole importer of `MotionWrapper.tsx` (329 lines) — both are effectively dead |
| `src/components/ProtectedRoute.tsx` | 13 | Superseded by inline `RequireAuth` in `App.tsx` |
| `src/lib/tcPdf.ts` | 97 | Transfer-certificate generator, never wired to UI |
| `src/lib/undoStack.ts` | 46 | Generic undo helper; pages hand-roll undo in toasts instead |

Plus `src/pages/ParentPortalPage.tsx` (222 lines) — deliberately disabled, route commented out in `App.tsx`
with a clear rationale (parents use WhatsApp). That one's intentional and documented; fine to keep.

### Declared but never imported (11 packages)

`cmdk` · `zustand` · `zod` · `react-hook-form` · `@hookform/resolvers` · `date-fns` · `react-to-print` ·
`react-webcam` · `@radix-ui/react-avatar` · `@radix-ui/react-dropdown-menu` · `@radix-ui/react-select` ·
`@radix-ui/react-separator` · `@radix-ui/react-switch` · `@radix-ui/react-toast` · `@radix-ui/react-label`

Notable: **`react-hook-form` + `zod` + `@hookform/resolvers` are all installed and completely unused** —
every form in the app is hand-rolled `useState`. Same for `zustand` (state is all Context + `useState`).
Removing these ~15 packages shrinks `node_modules` and your audit surface without touching a line of app code.

Also unused: `src/App.css` (184 lines, never imported — `index.css` is the real stylesheet) and
`src/assets/react.svg` / `vite.svg` (Vite template leftovers).

### Duplicate files

`vite-env.d.ts` and `src-vite-env.d.ts` are near-identical; the latter is stale (missing the
`VITE_GEMINI_*` entries). `tsconfig.app.json` includes both plus a third path (`src/vite-env.d.ts`) that
doesn't exist. Keep one.

---

## 10. 🟡 Smaller issues

- **`PendingSyncBanner` renders twice.** Imported in both `Layout.tsx:9` and `Topbar.tsx:9`. `Topbar` actually
  renders it (line 62); `Layout` imports it and never uses it — flagged by ESLint. Harmless but confusing.
- **README is the unmodified Vite template.** It talks about Oxlint config and React Compiler; nothing about
  EduSphere, setup, env vars, Firebase rules deployment, or the face-model pipeline. For a 18k-line app with
  a non-obvious setup (12 MB of model weights, RTDB rules, Functions), this is the single highest-leverage
  documentation gap.
- **Cloudflare bot-challenge script committed into `index.html`.** The `__CF$cv$params` block at the bottom
  was injected by a Cloudflare proxy and accidentally saved into source. It's inert locally but is noise that
  will confuse future readers — delete it.
- **`console.log` ×45 in production code**, mostly in `faceRecognition.ts` (model-loading traces). Fine for
  debugging, but they ship to users. Consider a `DEV`-gated logger.
- **No tests, no CI.** No test runner in `package.json`, no `.github/workflows/`. For logic like
  `computeWeighted`, `predictFinal`, `classStats`, and `descriptorDistance` — all pure functions with clear
  contracts — unit tests would be cheap and high-value.
- **`AttendancePage.tsx` is 2,231 lines with 44 `useState` hooks** in one component. It works, but it's the
  hardest file in the repo to change safely. The camera/liveness state machine is a natural extraction into a
  `useFaceScanner` hook.
- **`.env.example` has `VITE_AI_PROVIDER` defined twice** (lines 11 and 19) with the same value — harmless,
  but sloppy.
- **Default model in `.env.example` is `google/gemma-4-31b-it:free`** — that model doesn't exist on OpenRouter
  (Gemma tops out at 3n/27b). New contributors copying the example will get a 404 from the AI provider.

---

## 11. Security model review (RTDB rules)

`database.rules.json` (10.5 KB) is **genuinely well-constructed** — this is the strongest part of the
security posture. Highlights:

✅ Default `.read`/`.write: false` at root — deny-by-default.
✅ Every path scoped by `root.child('users').child(auth.uid).child('schoolId').val() == $schoolId` —
   real multi-tenant isolation.
✅ `users/$uid/.validate` prevents self-promotion to `super_admin` **and** locks `schoolId` once set
   (prevents school-hopping).
✅ Marks validated numerically server-side: `maxMarks` between 5–300, `marksObtained` between 0 and `maxMarks`.
✅ Attendance uses a recursive `$rest` wildcard so both the legacy flat and new nested shapes validate at
   every leaf.
✅ Parents can only mark notifications read (title/body/type must be unchanged) — a nice narrow grant.
✅ `.indexOn` declared on the paths that need it (`code`, `className`, `date`, `createdAt`).

Weaknesses:

⚠️ `schoolCodes` is `.read: "auth != null"` — **any authenticated user can enumerate every school's invite
   code**, then join any school as a teacher. Invite codes are 6 chars (`EDU-XXXXXX`) and are the only barrier
   to joining. Scope reads to a single `$code` lookup rather than allowing a full list read.
⚠️ Attendance `.validate` requires `['studentId','date','status','markedBy','timestamp']` — but the
   quick-enroll write at `AttendancePage.tsx:2200` and the offline-sync payload both satisfy it, so no
   conflict. Just verify any new write path includes all five.
⚠️ The rules file is committed but there's no `firebase.json`, so there's no documented deploy path
   (`firebase deploy --only database`). Easy for the deployed rules to drift from this file — exactly what
   happened with `functions/lib`.

---

## 12. Build & bundle analysis

Production build succeeds in ~16 s. Largest chunks (gzipped):

| Chunk | Raw | Gzip |
|---|---|---|
| `vendor-face-api` | 667 KB | 165 KB |
| `vendor-pdf` | 625 KB | 188 KB |
| `vendor-firebase` | 431 KB | 93 KB |
| `vendor-xlsx` | 430 KB | 143 KB |
| **`AttendancePage`** | **415 KB** | **122 KB** |
| `vendor-react` | 394 KB | 121 KB |
| `vendor-charts` | 376 KB | 103 KB |
| `vendor-animation` | 255 KB | 85 KB |

Code-splitting is working — all 15 pages are `lazy()`-loaded, and `xlsx`/`jspdf`/`face-api` are
dynamically imported at point of use, so they don't block first paint. Good.

**`AttendancePage` at 415 KB is the outlier** — it's 3× the next-largest page chunk and 122 KB gzipped on a
route teachers hit constantly, often on 3G. That's the 2,231-line component from §10.

PWA precaches 48 entries / 4.4 MB. Note the face models (12 MB) are **not** precached — they're
runtime-cached `CacheFirst` on first use, which is the right call.

Two icon files are oversized for their purpose: `apple-touch-icon.png` is 29 KB and `icon-512.png` is 43 KB;
both would compress to a few KB.

---

## 13. Prioritised action list

### Do today
1. **Rotate the OpenRouter and Gemini API keys.** They're in git *and* in the deployed bundle.
2. `git rm --cached .env` and commit.
3. Add `functions/lib/` to `.gitignore` and `git rm -r --cached functions/lib`.

### Do this week
4. **Proxy AI calls through a Cloud Function** so no key reaches the browser.
5. **Fix the attendance flattening bug** — one shared `flattenDay()` helper, seven call sites. Reports and AI
   Insights are showing wrong numbers right now.
6. `npm audit fix` for `react-router`; plan the `xlsx` migration (it parses untrusted uploads).
7. Reconcile the status enum between `types/index.ts` and `database.rules.json`.
8. Tighten `schoolCodes` read scope so invite codes can't be enumerated.

### Do this month
9. Fix the 11 lint errors so `npm run lint` passes; add it to CI.
10. Write a real README (setup, env vars, `firebase deploy --only database`, face-model provenance).
11. Add `firebase.json` / `.firebaserc` so rules and Functions have a reproducible deploy.
12. Delete the 4 dead source files, `App.css`, the duplicate `src-vite-env.d.ts`, the Cloudflare script in
    `index.html`, and the ~15 unused dependencies.
13. Add unit tests for the pure helpers in `lib/utils.ts` and `lib/ai.ts` — cheapest possible safety net.

### Longer term
14. Chip away at the 352 `any`s, starting with `type Student = any` and the `useAuth() as any` casts.
15. Split `AttendancePage.tsx` — extract the face-scanning state machine into a hook.
16. Migrate `face-api.js` → `@vladmandic/face-api` (maintained fork, same API, drops the `node-fetch` CVE).
