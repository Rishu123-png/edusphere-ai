// ============================================================================
// EduSphere AI — Intelligence Brain
// ----------------------------------------------------------------------------
// Powered by Google's Gemini models. The API key is supplied through the
// VITE_GEMINI_API_KEY environment variable (see .env.example). A documented
// default is bundled so the app works out-of-the-box in development.
//
// IMPORTANT (white-label / "proper website" rule):
//   This module is internal. The user interface NEVER mentions the provider by
//   name — the assistant is branded as the "EduSphere AI Assistant". Raw model
//   errors are swallowed and a calm local fallback is returned instead, so the
//   backend is never exposed to teachers.
// ============================================================================

const DEFAULT_KEY = 'AQ.Ab8RN6JcapHDRsbXSGOyIf38KuBKEbR1p39gd5XDfwNm19qcKw'
const API_KEY =
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || DEFAULT_KEY
const MODEL =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

export interface GeminiTurn {
  role: 'user' | 'model'
  text: string
}

export interface GeminiOptions {
  history?: GeminiTurn[]
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Low-level call to the generative model. Throws on failure so callers can
 * decide how to degrade gracefully. Never returns raw provider errors to UI.
 */
export async function callGemini(
  prompt: string,
  opts: GeminiOptions = {},
): Promise<string> {
  const contents = [
    ...(opts.history ?? []).map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: prompt }] },
  ]

  const body: Record<string, unknown> = { contents }
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  }
  body.generationConfig = {
    temperature: opts.temperature ?? 0.7,
    topP: 0.9,
    maxOutputTokens: opts.maxTokens ?? 900,
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`request_failed_${res.status}`)
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim()

    if (!text) throw new Error('empty_response')
    return text
  } finally {
    window.clearTimeout(timeout)
  }
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
- You proactively watch what the teacher is doing and offer helpful, specific suggestions.
- You NEVER expose that you are an external AI service. You are simply "EduSphere AI".
- Keep replies short and mobile-friendly (2-5 sentences). Use line breaks for readability.
- When answering data questions, ONLY use the numbers given in the live context. Never invent students, counts, or percentages.

You help with: attendance, marks, student risk, parent communication, scheduling, and daily school operations.`

function formatContext(ctx: SchoolContext): string {
  const lines: string[] = []
  if (ctx.role) lines.push(`Teacher role: ${ctx.role}`)
  if (ctx.page) lines.push(`Current screen: ${ctx.page}`)
  if (typeof ctx.totalStudents === 'number')
    lines.push(`Total enrolled students: ${ctx.totalStudents}`)
  if (typeof ctx.present === 'number') lines.push(`Present today: ${ctx.present}`)
  if (typeof ctx.absent === 'number') lines.push(`Absent today: ${ctx.absent}`)
  if (typeof ctx.late === 'number') lines.push(`Late today: ${ctx.late}`)
  if (typeof ctx.attendancePct === 'number')
    lines.push(`Today's attendance rate: ${ctx.attendancePct}%`)
  if (ctx.lowAttendanceStudent)
    lines.push(`Lowest-attendance student right now: ${ctx.lowAttendanceStudent}`)
  return lines.length ? lines.join('\n') : 'No live school data available yet.'
}

/**
 * Natural-language chat with the assistant. Falls back to a local reply if the
 * model is unreachable so the experience never breaks.
 */
export async function askAssistant(
  userMessage: string,
  history: GeminiTurn[],
  ctx: SchoolContext,
): Promise<string> {
  const system = `${ASSISTANT_SYSTEM}\n\n---\nLIVE SCHOOL CONTEXT (use it, never invent numbers):\n${formatContext(ctx)}`
  try {
    return await callGemini(userMessage, {
      history,
      systemInstruction: system,
      temperature: 0.6,
      maxTokens: 900,
    })
  } catch {
    return localFallbackReply(userMessage, ctx)
  }
}

/**
 * Proactive one-liner the assistant "whispers" while the teacher works.
 */
export async function getProactiveWhisper(ctx: SchoolContext): Promise<string | null> {
  const system = `${ASSISTANT_SYSTEM}\n\nWrite ONE short, friendly, proactive sentence (max 22 words) a helpful co-teacher would whisper to a teacher based on the live context. If nothing needs attention, return the word NONE.`
  try {
    const out = await callGemini(formatContext(ctx), {
      systemInstruction: system,
      temperature: 0.8,
      maxTokens: 160,
    })
    if (!out || out.trim().toUpperCase() === 'NONE') return null
    return out.trim()
  } catch {
    return localNudge(ctx)
  }
}

// ----------------------------------------------------------------------------
// Local fallbacks (keep the product feeling alive even offline / key issues)
// ----------------------------------------------------------------------------

const JOKES = [
  'Why did the teacher wear sunglasses? Because her students were so bright! 😎',
  'Why was the math book sad? It had too many problems. 📚',
  'I told my class a joke about construction… but they said it was still building up. 🏗️',
  'Why did the student eat his homework? His dog told him it was a snack-ademic! 🐶',
  'What do you call a fake school? A fabric-ation! 🧵',
  'Why did the clock go to school? To learn how to pass the time! ⏰',
  'A pencil says to the teacher: "You draw out the best in me." ✏️',
  'Why was the science teacher so positive? Because she had a good ion her! ⚛️',
  'Why did the computer go to school? To improve its byte-size! 💻',
  'Knock knock. Who’s there? Leaf. Leaf who? Leaf me alone, I’m grading papers! 🍃',
]

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
  if (lower.includes('joke') || lower.includes('smile') || lower.includes('funny')) {
    return getJoke()
  }
  if (lower.includes('present') || lower.includes('attendance today')) {
    if (typeof ctx.present === 'number' && typeof ctx.totalStudents === 'number') {
      const pct = ctx.totalStudents
        ? Math.round((ctx.present / ctx.totalStudents) * 100)
        : 0
      return `Today ${ctx.present} of ${ctx.totalStudents} students are present (${pct}%).${
        ctx.absent ? ` ${ctx.absent} are absent.` : ''
      }`
    }
    return 'I don’t have live attendance loaded yet — open the Attendance screen and I’ll keep an eye on it for you.'
  }
  if (lower.includes('lowest') || lower.includes('risk')) {
    return ctx.lowAttendanceStudent
      ? `${ctx.lowAttendanceStudent} currently has the lowest attendance. A parent check-in might help.`
      : 'Everyone’s looking steady right now — no clear low-attendance outlier yet.'
  }
  return 'I’m running in offline mode at the moment, so I’ll keep this simple. Try again in a moment and I’ll give you the full smart answer. 😊'
        }
      
