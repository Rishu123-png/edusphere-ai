import { initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

initializeApp()
const db = getDatabase()

// ----------------------------------------------------------------------------
// AI credentials — server-side only, dual Groq-key auto-failover:
//   Groq key #1 (primary) → Groq key #2 (fallback) → Gemini (dormant, opt-in)
// Configure via:
//   firebase functions:secrets:set GROQ_API_KEY
//   firebase functions:secrets:set GROQ_API_KEY_2
// (Optional Gemini opt-in):
//   firebase functions:secrets:set GEMINI_API_KEY
// Inline defaults below run for the pilot without requiring secrets:set.
// Env vars / secrets always win over inline defaults.
// Never expose these keys in a VITE_* variable — those are bundled publicly.
// ----------------------------------------------------------------------------
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const GROQ_API_KEY = defineSecret('GROQ_API_KEY')
const GROQ_API_KEY_2 = defineSecret('GROQ_API_KEY_2')
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

// Pilot defaults (override via secrets or env vars in production)
// Gemini default left empty on purpose — key provided has quota=0; re-enable
// by setting a real AIza... secret.
const DEFAULT_GEMINI_KEY = ''
const DEFAULT_GROQ_KEY = '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'
const DEFAULT_GROQ_KEY_2 = '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'
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
 * Server-side AI proxy with automatic key-level failover.
 *
 * Chain (tries in order, first success wins):
 *   Groq key #1 → Groq key #2 → Gemini (if configured) → HttpsError
 * The client catches the error and falls back to local offline replies.
 */
interface AiChatTurn { role: 'user' | 'model'; text: string }
interface AiChatRequest {
  prompt?: string
  history?: AiChatTurn[]
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
}

async function tryGemini(params: {
  key: string
  prompt: string
  history: AiChatTurn[]
  systemInstruction?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
}): Promise<string> {
  const { key, prompt, history, systemInstruction, temperature, maxTokens, timeoutMs } = params
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
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: clean(systemInstruction, 6000) }] }
  }
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
  ]
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let lastErr = ''
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal as unknown as never,
        })
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`
          continue
        }
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const parts = json?.candidates?.[0]?.content?.parts ?? []
        const text = parts.map(p => p.text ?? '').join('').trim()
        if (!text) { lastErr = 'empty_response'; continue }
        return text
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e
        lastErr = (e as Error).message
      }
    }
    throw new Error(`Gemini failed: ${lastErr}`)
  } finally {
    clearTimeout(to)
  }
}

async function tryGroq(params: {
  key: string
  prompt: string
  history: AiChatTurn[]
  systemInstruction?: string
  temperature: number
  maxTokens: number
  timeoutMs: number
}): Promise<string> {
  const { key, prompt, history, systemInstruction, temperature, maxTokens, timeoutMs } = params
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  if (systemInstruction) messages.push({ role: 'system', content: clean(systemInstruction, 6000) })
  for (const h of history) {
    if (!h || typeof h.text !== 'string') continue
    messages.push({ role: h.role === 'model' ? 'assistant' : 'user', content: clean(h.text, 4000) })
  }
  messages.push({ role: 'user', content: prompt })
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
      }),
      signal: controller.signal as unknown as never,
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json())?.error?.message || '' } catch { /* ignore */ }
      throw new Error(`Groq failed: HTTP ${res.status} ${String(detail).slice(0, 160)}`)
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = (json?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('Groq returned empty response')
    return text
  } finally {
    clearTimeout(to)
  }
}

export const aiChat = onCall(
  { enforceAppCheck: false, secrets: [GEMINI_API_KEY, GROQ_API_KEY, GROQ_API_KEY_2], timeoutSeconds: 55 },
  async request => {
    requireUser(request.auth)

    const data = (request.data || {}) as AiChatRequest
    const prompt = clean(data.prompt, 4000)
    if (!prompt) throw new HttpsError('invalid-argument', 'Missing prompt.')

    const history = Array.isArray(data.history) ? data.history.slice(-20) : []
    const temperature = typeof data.temperature === 'number' ? Math.max(0, Math.min(1, data.temperature)) : 0.7
    const maxTokens = typeof data.maxTokens === 'number' ? Math.max(1, Math.min(2000, data.maxTokens)) : 900
    const systemInstruction = data.systemInstruction ? clean(data.systemInstruction, 6000) : undefined

    // Resolve keys: secret > env var > inline pilot default.
    const resolve = (secret: { value(): string }, envName: string, fallback: string): string => {
      try { const v = secret.value(); if (v && v.trim()) return v.trim() } catch { /* secret not bound */ }
      const envV = (process.env[envName] || '').trim()
      if (envV) return envV
      return (fallback || '').trim()
    }
    const groqKey1 = resolve(GROQ_API_KEY,   'GROQ_API_KEY',   DEFAULT_GROQ_KEY)
    const groqKey2 = resolve(GROQ_API_KEY_2, 'GROQ_API_KEY_2', DEFAULT_GROQ_KEY_2)
    const geminiKey = resolve(GEMINI_API_KEY, 'GEMINI_API_KEY', DEFAULT_GEMINI_KEY)

    const errors: string[] = []
    const perProviderTimeout = 20000

    // Build ordered provider list.
    const queue: Array<{ name: string; key: string; kind: 'groq' | 'gemini' }> = []
    if (groqKey1) queue.push({ name: 'groq#1', key: groqKey1, kind: 'groq' })
    if (groqKey2 && groqKey2 !== groqKey1) queue.push({ name: 'groq#2', key: groqKey2, kind: 'groq' })
    if (geminiKey) queue.push({ name: 'gemini', key: geminiKey, kind: 'gemini' })

    if (!queue.length) {
      throw new HttpsError('failed-precondition', 'AI is not configured on the server yet.')
    }

    for (const p of queue) {
      try {
        const text = p.kind === 'groq'
          ? await tryGroq({ key: p.key, prompt, history, systemInstruction, temperature, maxTokens, timeoutMs: perProviderTimeout })
          : await tryGemini({ key: p.key, prompt, history, systemInstruction, temperature, maxTokens, timeoutMs: perProviderTimeout })
        return { text, provider: p.name }
      } catch (e) {
        errors.push(`${p.name}: ${(e as Error).message}`)
      }
    }

    console.warn('[aiChat] All providers failed:', errors.join(' | '))
    throw new HttpsError('unavailable', 'AI is temporarily unreachable. Please try again.')
  },
)
