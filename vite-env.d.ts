/// <reference types="vite/client" />

interface ImportMetaEnv {
  // --- Firebase web-app config (client-safe; public by design) -------------
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_DATABASE_URL: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string

  // --- Optional integrations ----------------------------------------------
  readonly VITE_WHATSAPP_API_KEY?: string

  // --- Dev / BYOK ONLY — leave UNSET in production -------------------------
  // These are baked into the public JS bundle when set. Production AI calls
  // always route through the `aiChat` Cloud Function, which holds the keys
  // in server-side secrets. See .env.example for details.
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_GROQ_API_KEY_2?: string
  readonly VITE_GROQ_MODEL?: string
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_GEMINI_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
