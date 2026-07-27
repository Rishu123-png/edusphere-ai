import { initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

initializeApp()
const db = getDatabase()

// ----------------------------------------------------------------------------
// AI credential — held server-side only. Configure with:
//   firebase functions:secrets:set GEMINI_API_KEY
// Never put this in a VITE_* variable: those are inlined into the public
// browser bundle at build time and readable by anyone who visits the site.
// ----------------------------------------------------------------------------
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const codePattern = /^EDU-[A-Z0-9]{6,12}$/
const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max)
const id = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function requireUser(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Please sign in first.')
  if (auth.token.email_verified !== true) throw new HttpsError('permission-denied', 'Verify your email before school setup.')
  return auth
}

/** Server-owned role and school membership writes. Never expose these writes to a browser. */
export const createSchool = onCall({ enforceAppCheck: false }, async request => {
  const auth = requireUser(request.auth)
  const schoolName = clean(request.data?.schoolName)
  if (schoolName.length < 2) throw new HttpsError('invalid-argument', 'Enter a school name.')
  const schoolId = id('sch_')
  const code = `EDU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const now = Date.now()
  const email = clean(auth.token.email, 254).toLowerCase()
  const displayName = clean(request.data?.principal || auth.token.name || email.split('@')[0])
  const school = { id: schoolId, name: schoolName, code, address: clean(request.data?.address, 250), phone: clean(request.data?.phone, 32), principal: displayName, email, createdBy: auth.uid, createdAt: now }
  const profile = { uid: auth.uid, email, displayName, role: 'school_admin', schoolId, schoolCode: code, createdAt: now, updatedAt: now, isOnline: true }
  await db.ref().update({ [`schools/${schoolId}`]: school, [`users/${auth.uid}`]: profile, [`schools/${schoolId}/teachers/${auth.uid}`]: { uid: auth.uid, email, name: displayName, role: 'school_admin', schoolId, createdAt: now } })
  return { schoolId, code }
})

export const joinSchool = onCall({ enforceAppCheck: false }, async request => {
  const auth = requireUser(request.auth)
  const code = clean(request.data?.code).toUpperCase()
  if (!codePattern.test(code)) throw new HttpsError('invalid-argument', 'Enter a valid school code.')
  // Parent accounts are intentionally NOT supported — parents receive all updates
  // over WhatsApp (wa.me links). Only teachers join via code.
  const schools = await db.ref('schools').orderByChild('code').equalTo(code).limitToFirst(1).get()
  if (!schools.exists()) throw new HttpsError('not-found', 'School code was not found.')
  const [schoolId, school] = Object.entries(schools.val() as Record<string, { code: string; name: string }>)[0]
  const now = Date.now(); const email = clean(auth.token.email, 254).toLowerCase(); const displayName = clean(auth.token.name || email.split('@')[0])
  const profile = { uid: auth.uid, email, displayName, role: 'teacher', schoolId, schoolCode: school.code, createdAt: now, updatedAt: now, isOnline: true }
  await db.ref().update({
    [`users/${auth.uid}`]: profile,
    [`schools/${schoolId}/teachers/${auth.uid}`]: { uid: auth.uid, email, name: displayName, role: 'teacher', schoolId, createdAt: now }
  })
  return { schoolId, schoolName: school.name, role: 'teacher' }
})

/**
 * Automated WhatsApp parent alerts.
 *
 * When deployed with a WhatsApp Business / Meta Cloud API configuration
 * (functions env: WABA_TOKEN, WABA_PHONE_ID, WABA_VERSION), this sends the
 * template message server-side. If no credentials are configured it safely
 * returns a wa.me deep link so the client can open a pre-filled chat instead.
 *
 * The client (WhatsAppPage) also builds wa.me links directly, so parent alerts
 * work out-of-the-box even before this function is wired to Meta.
 */
export const sendWhatsAppAlert = onCall({ enforceAppCheck: false }, async request => {
  const auth = requireUser(request.auth)
  const schoolId = clean(request.data?.schoolId, 64)
  if (!schoolId) throw new HttpsError('invalid-argument', 'Missing school id.')

  const recipients: Array<{ name: string; phone: string; message: string }> =
    Array.isArray(request.data?.recipients) ? request.data.recipients : []

  if (!recipients.length) throw new HttpsError('invalid-argument', 'No recipients provided.')

  const token = process.env.WABA_TOKEN || ''
  const phoneId = process.env.WABA_PHONE_ID || ''
  const version = process.env.WABA_VERSION || 'v19.0'

  const results: Array<{ phone: string; status: string; url?: string }> = []

  for (const r of recipients.slice(0, 50)) {
    const to = String(r.phone || '').replace(/\D/g, '')
    const message = String(r.message || '')
    if (!to) continue
    const waLink = `https://wa.me/${to}?text=${encodeURIComponent(message)}`

    if (!token || !phoneId) {
      results.push({ phone: to, status: 'link', url: waLink })
      continue
    }

    try {
      const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { preview_url: false, body: message },
        }),
      })
      if (!res.ok) {
        results.push({ phone: to, status: 'failed', url: waLink })
      } else {
        results.push({ phone: to, status: 'sent' })
      }
    } catch {
      results.push({ phone: to, status: 'failed', url: waLink })
    }
  }

  // Persist an audit log of the alert campaign.
  try {
    await db.ref(`schools/${schoolId}/whatsappLogs`).push({
      sentBy: auth.uid,
      sentAt: Date.now(),
      count: results.length,
      mode: token && phoneId ? 'cloud_api' : 'manual_links',
    })
  } catch {
    /* non-blocking */
  }

  return { results, mode: token && phoneId ? 'cloud_api' : 'manual_links' }
})

/**
 * Server-side AI proxy.
 *
 * The browser never sees an AI API key. `src/lib/gemini.ts` calls this
 * callable with { prompt, history, systemInstruction, temperature, maxTokens }
 * and this function talks to Gemini using the GEMINI_API_KEY secret.
 * On any upstream failure it throws so the client can fall back to its
 * local, offline-friendly replies — the UX degrades gracefully instead of
 * leaking a stack trace or raw provider error to a teacher.
 */
interface AiChatTurn { role: 'user' | 'model'; text: string }
interface AiChatRequest {
  prompt?: string
  history?: AiChatTurn[]
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
}

export const aiChat = onCall(
  { enforceAppCheck: false, secrets: [GEMINI_API_KEY], timeoutSeconds: 30 },
  async request => {
    requireUser(request.auth)

    const data = (request.data || {}) as AiChatRequest
    const prompt = clean(data.prompt, 4000)
    if (!prompt) throw new HttpsError('invalid-argument', 'Missing prompt.')

    const history = Array.isArray(data.history) ? data.history.slice(-20) : []
    const temperature = typeof data.temperature === 'number' ? Math.max(0, Math.min(1, data.temperature)) : 0.7
    const maxTokens = typeof data.maxTokens === 'number' ? Math.max(1, Math.min(2000, data.maxTokens)) : 900

    const key = GEMINI_API_KEY.value()
    if (!key) throw new HttpsError('failed-precondition', 'AI is not configured on the server yet.')

    const contents = [
      ...history
        .filter((h): h is AiChatTurn => !!h && typeof h.text === 'string')
        .map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: clean(h.text, 4000) }] })),
      { role: 'user', parts: [{ text: prompt }] },
    ]

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature, topP: 0.9, maxOutputTokens: maxTokens },
    }
    if (data.systemInstruction) {
      body.systemInstruction = { parts: [{ text: clean(data.systemInstruction, 6000) }] }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new HttpsError('unavailable', `AI request failed (HTTP ${res.status}).`)
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const parts = json?.candidates?.[0]?.content?.parts ?? []
      const text = parts.map(p => p.text ?? '').join('').trim()
      if (!text) throw new HttpsError('unavailable', 'AI returned an empty response.')
      return { text }
    } catch (error) {
      if (error instanceof HttpsError) throw error
      throw new HttpsError('unavailable', 'AI is temporarily unreachable.')
    } finally {
      clearTimeout(timeout)
    }
  },
)
