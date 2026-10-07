# Security — EduSphere AI

## Threat model (short version)

EduSphere AI stores school data (students, guardians, attendance, marks) in
Firebase Realtime Database with **role-based rules** (`database.rules.json`):

- Root is deny-by-default (`.read: false`, `.write: false`).
- Every node requires a valid Firebase auth token.
- Access is scoped per school (`schoolId`), and only `super_admin` /
  `school_admin` / `teacher` roles can write to the school they belong to.
- `.validate` rules check the shape of new data (e.g. a new user must have
  `uid`, `email`, `role`, `createdAt` and a legal role value).

## Secret management — rules of the repo

1. **Never commit live keys.** `.env` is git-ignored; the committed file
   contains placeholders only.
2. **`VITE_*` variables are public.** Anything prefixed with `VITE_` is
   baked into the client JS bundle and readable by every visitor. Only put
   *client-safe* values (the Firebase web-app config) there.
3. **AI provider keys (Groq / Gemini) never ship to the browser.** They live
   server-side:
   - Firebase Cloud Functions Secrets: `firebase functions:secrets:set GROQ_API_KEY`
   - Vercel environment variables for the `api/ai-chat.js` function
     (`GROQ_API_KEY`, `GROQ_API_KEY_2`, `FIREBASE_API_KEY`).
4. **Rotate on any suspicion of exposure** — a key that was ever committed
   or logged must be considered public.

## Incident history

- **Early 2026 (pre-release):** two live provider keys were accidentally
  committed to `main`. Both were revoked/rotated at the time, the keys in
  this repo are placeholders, and the AI stack was re-architected so that
  provider keys exist **only** in server-side secrets (see the header of
  `src/lib/gemini.ts`). The incident is the reason for rule 1–3 above and
  the explicit warnings in `.env.example`.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Report privately
to the repository maintainer (see the GitHub profile of `Rishu123-png`),
ideally with reproduction steps. Reports in good faith are always welcome.
