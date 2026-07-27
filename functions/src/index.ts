import { initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()
const db = getDatabase()
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
  const role = request.data?.role === 'parent' ? 'parent' : 'teacher'
  if (!codePattern.test(code)) throw new HttpsError('invalid-argument', 'Enter a valid school code.')
  const schools = await db.ref('schools').orderByChild('code').equalTo(code).limitToFirst(1).get()
  if (!schools.exists()) throw new HttpsError('not-found', 'School code was not found.')
  const [schoolId, school] = Object.entries(schools.val() as Record<string, { code: string; name: string }>)[0]
  const now = Date.now(); const email = clean(auth.token.email, 254).toLowerCase(); const displayName = clean(auth.token.name || email.split('@')[0])
  let linkedStudentIds: string[] = []
  if (role === 'parent') {
    const students = await db.ref(`schools/${schoolId}/students`).get()
    linkedStudentIds = Object.entries(students.val() || {}).filter(([, s]: [string, any]) => s?.parentUid === auth.uid || s?.guardianUid === auth.uid || String(s?.guardianEmail || '').toLowerCase() === email).map(([studentId]) => studentId)
    if (!linkedStudentIds.length) throw new HttpsError('permission-denied', 'No child is linked to this email. Ask the school to add the guardian email first.')
  }
  const profile = { uid: auth.uid, email, displayName, role, schoolId, schoolCode: school.code, ...(role === 'parent' ? { linkedStudentIds } : {}), createdAt: now, updatedAt: now, isOnline: true }
  const updates: Record<string, unknown> = { [`users/${auth.uid}`]: profile }
  if (role === 'teacher') updates[`schools/${schoolId}/teachers/${auth.uid}`] = { uid: auth.uid, email, name: displayName, role, schoolId, createdAt: now }
  await db.ref().update(updates)
  return { schoolId, schoolName: school.name, role }
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
 * The browser must NEVER hold a model credential — anything inlined into the
 * Vite bundle is readable by every visitor of the deployed site. This callable
 * keeps the key in Functions config and returns only the generated text.
 *
 * Configure with either:
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set AI_API_KEY      (OpenAI-compatible: OpenRouter/Groq)
 *
 * Optional env: AI_PROVIDER ('gemini' | 'openai'), AI_BASE_URL, AI_MODEL, GEMINI_MODEL
 */
export const aiChat = onCall({ enforceAppCheck: false }, async request => {
  const auth = requireUser(request.auth)

  const prompt = String(request.data?.prompt ?? '').slice(0, 8000)
  if (!prompt.trim()) throw new HttpsError('invalid-argument', 'Empty prompt.')

  const systemInstruction = String(request.data?.systemInstruction ?? '').slice(0, 8000)
  const temperature = Number.isFinite(request.data?.temperature) ? Number(request.data.temperature) : 0.7
  const maxTokens = Math.min(2048, Math.max(16, Number(request.data?.maxTokens) || 900))

  const rawHistory: Array<{ role?: string; text?: unknown }> =
    Array.isArray(request.data?.history) ? request.data.history : []
  const history: Array<{ role: 'user' | 'model'; text: string }> = rawHistory
    .slice(-12)
    .map(h => ({
      role: (h?.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      text: String(h?.text ?? '').slice(0, 4000),
    }))

  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const geminiKey = process.env.GEMINI_API_KEY || ''
  const aiKey = process.env.AI_API_KEY || ''

  try {
    if (provider === 'openai') {
      if (!aiKey) throw new HttpsError('failed-precondition', 'AI is not configured.')
      const baseUrl = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1'
      const model = process.env.AI_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'

      const messages: Array<{ role: string; content: string }> = []
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
      for (const h of history) messages.push({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })
      messages.push({ role: 'user', content: prompt })

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiKey}`,
          'X-Title': 'EduSphere AI',
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      })
      if (!res.ok) throw new HttpsError('unavailable', 'AI is busy right now.')
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const text = (data?.choices?.[0]?.message?.content || '').trim()
      if (!text) throw new HttpsError('unavailable', 'AI returned an empty reply.')
      return { text }
    }

    if (!geminiKey) throw new HttpsError('failed-precondition', 'AI is not configured.')
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const body: Record<string, unknown> = {
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: { temperature, topP: 0.9, maxOutputTokens: maxTokens },
    }
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )
    if (!res.ok) throw new HttpsError('unavailable', 'AI is busy right now.')
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
    if (!text) throw new HttpsError('unavailable', 'AI returned an empty reply.')
    return { text }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    // Never leak provider internals to the client (white-label rule).
    throw new HttpsError('unavailable', 'AI is unavailable right now.')
  }
})
