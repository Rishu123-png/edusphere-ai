// ============================================================================
// EduSphere AI — Intelligence Brain  (v3.1: dual-Groq-key auto-failover)
// ----------------------------------------------------------------------------
// Provider chain (tries in order; auto-falls-over on any failure/timeout/quota):
//   1. Groq #1 (primary)    VITE_GROQ_API_KEY      model: llama-3.3-70b-versatile
//   2. Groq #2 (fallback)   VITE_GROQ_API_KEY_2    model: llama-3.3-70b-versatile
//
// Google Gemini support is left in the code (callGemini function exists) but
// is DISABLED by default because the current Gemini key has quota=0 and OAuth
// keys don't work on the generativelanguage endpoint. To re-enable later, set
// VITE_GEMINI_API_KEY to a real AIza... key from aistudio.google.com and
// prepend `{ kind: 'gemini', key: GEMINI_KEY }` to the PROVIDERS array below.
//
// If all providers fail we fall back to calm local replies so the assistant
// never shows a raw provider error to a teacher.
//
// IMPORTANT (white-label / "proper website" rule):
//   This module is internal. The UI NEVER mentions the provider by name —
//   the assistant is branded as the "EduSphere AI Assistant". Raw model
//   errors are swallowed.
// ============================================================================

// --- Groq #1 (primary) ------------------------------------------------------
const GROQ_KEY_1 =
  ((import.meta.env.VITE_GROQ_API_KEY as string | undefined) || '').trim() ||
  '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'

// --- Groq #2 (fallback — second free Groq account, doubles free-tier quota) -
const GROQ_KEY_2 =
  ((import.meta.env.VITE_GROQ_API_KEY_2 as string | undefined) || '').trim() ||
  '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'

const GROQ_MODEL =
  ((import.meta.env.VITE_GROQ_MODEL as string | undefined) || '').trim() ||
  'llama-3.3-70b-versatile'
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

// --- Google Gemini (disabled by default — kept dormant for future re-enable) -
// To re-enable: get an AIza... key from https://aistudio.google.com/apikey,
// set VITE_GEMINI_API_KEY, and uncomment the gemini entry in PROVIDERS below.
const GEMINI_KEY =
  ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '').trim() || ''
const GEMINI_MODEL =
  ((import.meta.env.VITE_GEMINI_MODEL as string | undefined) || '').trim() ||
  'gemini-2.0-flash'

// ----------------------------------------------------------------------------
// Ordered list of providers — tried in order, first to succeed wins.
// ----------------------------------------------------------------------------
interface Provider {
  name: string
  call(prompt: string, opts: GeminiOptions, timeoutMs: number): Promise<string>
}

function buildProviders(): Provider[] {
  const list: Provider[] = []
  if (GROQ_KEY_1) list.push({ name: 'groq#1', call: (p, o, t) => callGroqWithKey(GROQ_KEY_1, p, o, t) })
  if (GROQ_KEY_2) list.push({ name: 'groq#2', call: (p, o, t) => callGroqWithKey(GROQ_KEY_2, p, o, t) })
  if (GEMINI_KEY) list.push({ name: 'gemini', call: callGemini })
  return list
}

export interface GeminiTurn {
  role: 'user' | 'model'
  text: string
}

export interface GeminiOptions {
  history?: GeminiTurn[]
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

// ----------------------------------------------------------------------------
// Groq implementation  (OpenAI-compatible chat/completions) — takes key param
// ----------------------------------------------------------------------------
async function callGroqWithKey(
  key: string,
  prompt: string,
  opts: GeminiOptions,
  timeoutMs: number,
): Promise<string> {
  if (!key) throw new Error('missing_groq_key')

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  if (opts.systemInstruction)
    messages.push({ role: 'system', content: opts.systemInstruction })
  for (const h of opts.history ?? []) {
    messages.push({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })
  }
  messages.push({ role: 'user', content: prompt })

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const chained = chainSignal(controller.signal, opts.signal)
  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 900,
        top_p: 0.9,
      }),
      signal: chained,
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = (await res.json())?.error?.message || ''
      } catch {
        /* ignore */
      }
      console.warn(
        `[EduSphere AI] Groq key failed (HTTP ${res.status}). ${String(detail).slice(0, 200)} — trying next key.`,
      )
      throw new Error(`groq_failed_${res.status}`)
    }
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('groq_empty_response')
    return text
  } finally {
    window.clearTimeout(timeout)
  }
}

// ----------------------------------------------------------------------------
// Gemini implementation (dormant — kept for future use)
// ----------------------------------------------------------------------------
async function callGemini(
  prompt: string,
  opts: GeminiOptions,
  timeoutMs: number,
): Promise<string> {
  if (!GEMINI_KEY) throw new Error('missing_gemini_key')
  const contents = [
    ...(opts.history ?? []).map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ]
  const body: Record<string, unknown> = { contents }
  if (opts.systemInstruction)
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  body.generationConfig = {
    temperature: opts.temperature ?? 0.7,
    topP: 0.9,
    maxOutputTokens: opts.maxTokens ?? 900,
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const chained = chainSignal(controller.signal, opts.signal)
  try {
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
    ]
    let lastErrDetail = ''
    let lastStatus = 0
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: chained,
        })
        if (!res.ok) {
          try { lastErrDetail = (await res.json())?.error?.message || '' } catch { /* ignore */ }
          lastStatus = res.status
          continue
        }
        const data = await res.json()
        const parts = data?.candidates?.[0]?.content?.parts ?? []
        const text = parts.map((p: { text?: string }) => p.text ?? '').join('').trim()
        if (!text) { lastErrDetail = 'empty_response'; continue }
        return text
      } catch (e) {
        lastErrDetail = (e as Error).message
        if ((e as Error).name === 'AbortError') throw e
      }
    }
    console.warn(
      `[EduSphere AI] Gemini failed (HTTP ${lastStatus}). ${String(lastErrDetail).slice(0, 200)}`,
    )
    throw new Error(`gemini_failed_${lastStatus || 'network'}`)
  } finally {
    window.clearTimeout(timeout)
  }
}

/** Combine two AbortSignals so internal timeout OR caller cancel aborts the request. */
function chainSignal(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a
  if (a.aborted) return a
  if (b.aborted) return b
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  a.addEventListener('abort', onAbort, { once: true })
  b.addEventListener('abort', onAbort, { once: true })
  return ctrl.signal
}

// ----------------------------------------------------------------------------
// Unified entry — tries providers in order
// ----------------------------------------------------------------------------
async function callModel(prompt: string, opts: GeminiOptions = {}): Promise<string> {
  const providers = buildProviders()
  if (!providers.length) throw new Error('no_providers_configured')
  const errors: string[] = []
  const timeoutMs = 20000

  for (const p of providers) {
    try {
      const out = await p.call(prompt, opts, timeoutMs)
      if (out) return out
    } catch (e) {
      errors.push(`${p.name}: ${(e as Error).message}`)
    }
  }

  console.warn('[EduSphere AI] All providers failed:', errors.join(' | '))
  throw new Error('all_providers_failed')
}

// ----------------------------------------------------------------------------
// Assistant-level helpers
// ----------------------------------------------------------------------------
export interface SchoolContext {
  totalStudents?: number
  present?: number
  absent?: number
  late?: number
  attendancePct?: number
  lowAttendanceStudent?: string | null
  page?: string
  role?: string
}

const ASSISTANT_SYSTEM = `You are "EduSphere AI Assistant", the friendly, witty, and supportive AI co-teacher built into the EduSphere school management app used by teachers, school admins and principals.

Your personality:
- Warm, encouraging, and a little playful. You love making teachers smile with a light joke when the moment is right.
- Offer helpful, specific suggestions from the current screen and explicitly supplied school context. Never claim to see a camera, private messages, or activity outside the app.
- You NEVER expose that you are an external AI service. You are simply "EduSphere AI".
- Keep replies short and mobile-friendly (2-5 sentences). Use line breaks for readability.
- ALWAYS reply in English only. Do not reply in Hindi, Hinglish, or any other language even if the teacher writes in another language — answer in English.
- When answering data questions, ONLY use the numbers given in the live context. Never invent students, counts, or percentages.

You help with: attendance, marks, student risk, parent communication, scheduling, and daily school operations.`

function formatContext(ctx: SchoolContext): string {
  const lines: string[] = []
  if (ctx.role) lines.push(`Teacher role: ${ctx.role}`)
  if (ctx.page) lines.push(`Current screen: ${ctx.page}`)
  if (typeof ctx.totalStudents === 'number') lines.push(`Total enrolled students: ${ctx.totalStudents}`)
  if (typeof ctx.present === 'number') lines.push(`Present today: ${ctx.present}`)
  if (typeof ctx.absent === 'number') lines.push(`Absent today: ${ctx.absent}`)
  if (typeof ctx.late === 'number') lines.push(`Late today: ${ctx.late}`)
  if (typeof ctx.attendancePct === 'number') lines.push(`Today's attendance rate: ${ctx.attendancePct}%`)
  if (ctx.lowAttendanceStudent) lines.push(`Lowest-attendance student right now: ${ctx.lowAttendanceStudent}`)
  return lines.length ? lines.join('\n') : 'No live school data available yet.'
}

/** Natural-language chat with the assistant. Falls back to a local reply if all providers are unreachable. */
export async function askAssistant(
  userMessage: string,
  history: GeminiTurn[],
  ctx: SchoolContext,
  signal?: AbortSignal,
): Promise<string> {
  const system = `${ASSISTANT_SYSTEM}\n\n---\nLIVE SCHOOL CONTEXT (use it, never invent numbers):\n${formatContext(ctx)}`
  try {
    return await callModel(userMessage, { history, systemInstruction: system, temperature: 0.6, maxTokens: 900, signal })
  } catch {
    return localFallbackReply(userMessage, ctx)
  }
}

/** Proactive one-liner the assistant "whispers" while the teacher works. */
export async function getProactiveWhisper(ctx: SchoolContext): Promise<string | null> {
  const system = `${ASSISTANT_SYSTEM}\n\nWrite ONE short, friendly, proactive sentence (max 22 words) a helpful co-teacher would whisper to a teacher based on the live context. If nothing needs attention, return the word NONE.`
  try {
    const out = await callModel(formatContext(ctx), { systemInstruction: system, temperature: 0.8, maxTokens: 160 })
    if (!out || out.trim().toUpperCase() === 'NONE') return null
    return out.trim()
  } catch {
    return localNudge(ctx)
  }
}

// ----------------------------------------------------------------------------
// Local fallbacks (keep the product feeling alive even offline / all keys busted)
// ----------------------------------------------------------------------------
const JOKES = [
  'Why did the teacher wear sunglasses? Because her students were so bright!',
  'Why was the math book sad? It had too many problems.',
  'A pencil says to the teacher: "You draw out the best in me."',
  'Why did the clock go to school? To learn how to pass the time!',
  'Knock knock. Who is there? Leaf. Leaf who? Leaf me alone, I am grading papers!',
  'Why did the student eat his homework? His dog said it was a snack-ademic!',
]

/** AI Tutor — explains school topics simply. */
export async function askTutor(
  topic: string,
  ctx: SchoolContext,
  signal?: AbortSignal,
): Promise<string> {
  const system = `You are "EduSphere AI Tutor", a patient, friendly subject tutor for school students (CBSE and state boards). Explain concepts in simple language, give a short relatable example, and when useful ask one quick check-in question. Keep replies mobile-friendly (3-6 sentences). Never mention any external AI service or brand. Always reply in English only.`
  try {
    return await callModel(topic, { systemInstruction: system, temperature: 0.6, maxTokens: 720, signal })
  } catch {
    return `Let's learn "${topic}". A simple way to start: break it into small steps, master each one, then connect them. Try one easy example and tell me where you get stuck — I'll guide you step by step.`
  }
}

export function getJoke(): string {
  return JOKES[Math.floor(Math.random() * JOKES.length)]
}

export function localNudge(ctx: SchoolContext): string | null {
  if (typeof ctx.absent === 'number' && ctx.absent > 0) {
    return `Heads up — ${ctx.absent} student${ctx.absent > 1 ? 's are' : ' is'} marked absent today. Want me to draft a parent message?`
  }
  if (typeof ctx.late === 'number' && ctx.late >= 3) {
    return `${ctx.late} late arrivals so far. Maybe a gentle gate reminder would help?`
  }
  if (ctx.lowAttendanceStudent) {
    return `${ctx.lowAttendanceStudent} has the lowest attendance right now. A quick check-in could help.`
  }
  if (typeof ctx.attendancePct === 'number' && ctx.attendancePct < 75) {
    return `Today's attendance is ${ctx.attendancePct}% — below the 75% goal. Shall we nudge guardians?`
  }
  return null
}

function localFallbackReply(message: string, ctx: SchoolContext): string {
  const lower = message.toLowerCase()
  if (lower.includes('joke') || lower.includes('smile') || lower.includes('funny')) return getJoke()
  const hasAttendanceToday =
    typeof ctx.totalStudents === 'number' &&
    ctx.totalStudents > 0 &&
    (typeof ctx.present === 'number' || typeof ctx.absent === 'number' || typeof ctx.attendancePct === 'number')

  if (!hasAttendanceToday) {
    if (lower.includes('attendance') || lower.includes('present') || lower.includes('absent') || lower.includes('who')) {
      return "I don't see today's attendance marked yet. Open the Attendance screen and start a class — I'll summarize it live as you mark students."
    }
    return "I'm running locally right now because the cloud AI isn't reachable. Open Attendance, Marks, or Students and I'll give you live insights from that screen."
  }
  if (lower.includes('present') || lower.includes('attendance today')) {
    if (typeof ctx.present === 'number' && typeof ctx.totalStudents === 'number') {
      const pct = ctx.totalStudents ? Math.round((ctx.present / ctx.totalStudents) * 100) : 0
      return `Today ${ctx.present} of ${ctx.totalStudents} students are present (${pct}%).${ctx.absent ? ` ${ctx.absent} are absent.` : ''}`
    }
  }
  if (lower.includes('lowest') || lower.includes('risk')) {
    return ctx.lowAttendanceStudent
      ? `${ctx.lowAttendanceStudent} currently has the lowest attendance. A parent check-in might help.`
      : "Everyone's looking steady right now — no clear low-attendance outlier yet."
  }
  const bits: string[] = []
  if (typeof ctx.present === 'number' && typeof ctx.totalStudents === 'number' && ctx.totalStudents > 0) {
    bits.push(`Today ${ctx.present}/${ctx.totalStudents} students are present`)
  }
  if (typeof ctx.attendancePct === 'number' && ctx.totalStudents && ctx.totalStudents > 0) {
    bits.push(`${ctx.attendancePct}% attendance`)
  }
  if (ctx.lowAttendanceStudent) bits.push(`${ctx.lowAttendanceStudent} may need a check-in`)
  if (bits.length) return `Quick snapshot: ${bits.join(' • ')}. Tap over to the Attendance tab for full details.`
  return "I'm running locally right now — open the Attendance, Marks, or Students screen and I'll give you live insights there."
}
