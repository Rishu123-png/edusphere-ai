
// ============================================================================
// EduSphere AI — Intelligence Brain
// ----------------------------------------------------------------------------
// Thin client for the server-side AI proxy (`aiChat` Cloud Function).
// The provider is chosen on the SERVER via the AI_PROVIDER env var:
//   • 'gemini'  (default) → Google Gemini generative language API
//   • 'openai'            → any OpenAI-compatible endpoint (OpenRouter, Groq…)
//
// You can still run the assistant 100% FREE using OpenRouter's free models —
// just set the key with `firebase functions:secrets:set AI_API_KEY`.
//
// SECURITY (2026-07 hardening):
//   API keys are NEVER read in the browser. Anything referenced through
//   `import.meta.env.VITE_*` is inlined into the public JS bundle at build time
//   and is readable by every visitor of the deployed site — a private GitHub
//   repo does not protect it. All model traffic now goes through the `aiChat`
//   Cloud Function, which holds the credential server-side.
//
// IMPORTANT (white-label / "proper website" rule):
//   This module is internal. The UI NEVER mentions the provider by name — the
//   assistant is branded as the "EduSphere AI Assistant". Raw model errors are
//   swallowed and a calm local fallback is returned instead.
// ============================================================================

import { getApp } from 'firebase/app'

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
 * Unified entry point — proxies to the `aiChat` Cloud Function.
 *
 * No API key exists in this bundle. If the function is not deployed or the
 * server has no key configured, this throws and every caller falls back to the
 * local offline replies below, so the assistant still feels alive.
 */
async function callModel(prompt: string, opts: GeminiOptions = {}): Promise<string> {
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const fns = getFunctions(getApp())
  const call = httpsCallable<
    {
      prompt: string
      history?: GeminiTurn[]
      systemInstruction?: string
      temperature?: number
      maxTokens?: number
    },
    { text?: string }
  >(fns, 'aiChat')

  const res = await call({
    prompt,
    history: opts.history ?? [],
    systemInstruction: opts.systemInstruction ?? '',
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens ?? 900,
  })

  const text = (res.data?.text || '').trim()
  if (!text) throw new Error('empty_response')
  return text
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

/** Natural-language chat with the assistant. Falls back to a local reply if the model is unreachable. */
export async function askAssistant(
  userMessage: string,
  history: GeminiTurn[],
  ctx: SchoolContext,
): Promise<string> {
  const system = `${ASSISTANT_SYSTEM}\n\n---\nLIVE SCHOOL CONTEXT (use it, never invent numbers):\n${formatContext(ctx)}`
  try {
    return await callModel(userMessage, { history, systemInstruction: system, temperature: 0.6, maxTokens: 900 })
  } catch {
    return localFallbackReply(userMessage, ctx)
  }
}

/** Proactive one-liner the assistant "whispers" while the teacher works. */
export async function getProactiveWhisper(ctx: SchoolContext): Promise<string | null> {
  const system = `${ASSISTANT_SYSTEM}\n\nWrite ONE short, friendly, proactive sentence (max 22 words) a helpful co-teacher would whisper to a teacher based on the live context. If nothing needs attention, return the word NONE.`
  try {
    const out = await callModel(formatContext(ctx), {
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

/** AI Tutor — explains school topics simply and quizzes the student. */
export async function askTutor(topic: string, ctx: SchoolContext): Promise<string> {
  const system = `You are "EduSphere AI Tutor", a patient, friendly subject tutor for school students (CBSE and state boards). Explain concepts in simple language, give a short relatable example, and when useful ask one quick check-in question. Keep replies mobile-friendly (3-6 sentences). Never mention any external AI service or brand.`
  try {
    return await callModel(topic, { systemInstruction: system, temperature: 0.6, maxTokens: 720 })
  } catch {
    return `Let's learn "${topic}". A simple way to start: break it into small steps, master each one, then connect them. Try one easy example and tell me where you get stuck — I'll guide you step by step. 📚`
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
  if (lower.includes('joke') || lower.includes('smile') || lower.includes('funny')) {
    return getJoke()
  }
  // If we genuinely have no data (students haven't loaded yet, or attendance
  // hasn't been marked today) the assistant should say so instead of lying
  // that attendance is 0%.
  const hasAttendanceToday =
    typeof ctx.totalStudents === 'number' &&
    ctx.totalStudents > 0 &&
    (typeof ctx.present === 'number' || typeof ctx.absent === 'number' || typeof ctx.attendancePct === 'number')

  if (!hasAttendanceToday) {
    if (lower.includes('attendance') || lower.includes('present') || lower.includes('absent') || lower.includes('who')) {
      return "I don't see today's attendance marked yet. Open the Attendance screen and start a class — I'll summarize it live as you mark students. 😊"
    }
    return "I'm running locally right now because the cloud AI isn't reachable. Open Attendance, Marks, or Students and I'll give you live insights from that screen. 😊"
  }

  if (lower.includes('present') || lower.includes('attendance today')) {
    if (typeof ctx.present === 'number' && typeof ctx.totalStudents === 'number') {
      const pct = ctx.totalStudents ? Math.round((ctx.present / ctx.totalStudents) * 100) : 0
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
  const bits: string[] = []
  if (typeof ctx.present === 'number' && typeof ctx.totalStudents === 'number' && ctx.totalStudents > 0) {
    bits.push(`Today ${ctx.present}/${ctx.totalStudents} students are present`)
  }
  if (typeof ctx.attendancePct === 'number' && ctx.totalStudents && ctx.totalStudents > 0) {
    bits.push(`${ctx.attendancePct}% attendance`)
  }
  if (ctx.lowAttendanceStudent) bits.push(`${ctx.lowAttendanceStudent} may need a check-in`)
  if (bits.length) {
    return `Quick snapshot: ${bits.join(' • ')}. Tap over to the Attendance tab for full details.`
  }
  return "I'm running locally right now — open the Attendance, Marks, or Students screen and I'll give you live insights there. 😊"
}
