const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Groq shut down llama-3.1-8b-instant and llama-3.3-70b-versatile on 2026-08-16
// (free/developer tier). Keep this overridable so a catalog change is an env edit,
// not a code deploy.
const MODEL = (process.env.GROQ_MODEL || 'openai/gpt-oss-20b').trim()

const clean = (value, max = 4000) =>
  String(value ?? '').trim().slice(0, max)

const send = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })

async function isLoggedIn(request) {
  const authorization = request.headers.get('authorization') || ''
  const idToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : ''

  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    ''

  if (!idToken || !apiKey) return false

  try {
    const result = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    )

    return result.ok
  } catch {
    return false
  }
}

const REASONING_MODEL = /gpt-oss|compound|qwen3\.[68]/i

// Last upstream failure, surfaced to the client as `detail` so a teacher's
// "running locally" bubble is debuggable. One request per isolate, so a
// module-scoped slot is safe here.
let lastError = 'no_attempt'

async function askGroq(key, messages, temperature, maxTokens) {
  const controller = new AbortController()
  // 12s per key, inside the 30s maxDuration in vercel.json, so a slow
// first key still leaves the second Groq key a real chance to answer.
const timer = setTimeout(() => controller.abort(), 12000)

  try {
    const result = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        // GPT-OSS is a reasoning model: OpenAI recommends temp=1.0/top_p=1.0,
        // and sending both knobs together is rejected on some catalogs.
        ...(REASONING_MODEL.test(MODEL) ? {} : { top_p: 0.9 }),
      }),
      signal: controller.signal,
    })

    if (!result.ok) {
      const detail = await result.text().catch(() => '')
      let reason = ''
      try {
        reason = JSON.parse(detail)?.error?.message || ''
      } catch {
        /* non-json body */
      }
      lastError = `groq_${result.status}${reason ? `: ${reason.slice(0, 160)}` : ''}`
      console.error('[ai-chat] Groq failed:', result.status, detail.slice(0, 300))
      return ''
    }

    const data = await result.json()
    return clean(data?.choices?.[0]?.message?.content, 12000)
  } catch (err) {
    lastError =
      err?.name === 'AbortError'
        ? 'groq_timeout'
        : `groq_fetch_error: ${err?.message}`
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return send({ error: 'method_not_allowed' }, 405)
    }

    if (!(await isLoggedIn(request))) {
      return send({ error: 'unauthenticated' }, 401)
    }

    let data

    try {
      data = await request.json()
    } catch {
      return send({ error: 'invalid_json' }, 400)
    }

    const prompt = clean(data?.prompt)

    if (!prompt) {
      return send({ error: 'missing_prompt' }, 400)
    }

    const history = Array.isArray(data.history)
      ? data.history
          .slice(-20)
          .filter(turn => turn && typeof turn.text === 'string')
          .map(turn => ({
            role: turn.role === 'model' ? 'assistant' : 'user',
            content: clean(turn.text),
          }))
      : []

    const messages = []

    if (data.systemInstruction) {
      messages.push({
        role: 'system',
        content: clean(data.systemInstruction, 6000),
      })
    }

    messages.push(...history)
    messages.push({ role: 'user', content: prompt })

    const temperature =
      typeof data.temperature === 'number'
        ? Math.max(0, Math.min(1, data.temperature))
        : 0.7

    const maxTokens =
      typeof data.maxTokens === 'number'
        ? Math.max(1, Math.min(1200, Math.floor(data.maxTokens)))
        : 900

    const keys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
    ]
      .map(key => String(key || '').trim())
      .filter(Boolean)

    if (!keys.length) {
      return send({ error: 'ai_not_configured' }, 503)
    }

    for (let index = 0; index < keys.length; index += 1) {
      const text = await askGroq(
        keys[index],
        messages,
        temperature,
        maxTokens,
      )

      if (text) {
        return send({
          text,
          provider: `groq#${index + 1}`,
        })
      }
    }

    return send({ error: 'ai_unavailable', detail: lastError }, 503)
  },
}
