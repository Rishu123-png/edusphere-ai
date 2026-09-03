const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const clean = (value, max = 4000) =>
  String(value ?? '').trim().slice(0, max)

async function isLoggedIn(req) {
  const header = String(req.headers?.authorization || '')
  const idToken = header.startsWith('Bearer ')
    ? header.slice(7).trim()
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    )
    return result.ok
  } catch {
    return false
  }
}

async function askGroq(key, messages, temperature, maxTokens) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  try {
    const result = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
      }),
      signal: controller.signal,
    })

    if (!result.ok) return ''

    const data = await result.json()
    return clean(data?.choices?.[0]?.message?.content, 12000)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  if (!(await isLoggedIn(req))) {
    return res.status(401).json({ error: 'unauthenticated' })
  }

  let data = req.body || {}
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data || '{}')
    } catch {
      return res.status(400).json({ error: 'invalid_json' })
    }
  }

  const prompt = clean(data.prompt)
  if (!prompt) {
    return res.status(400).json({ error: 'missing_prompt' })
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
      ? Math.max(1, Math.min(2000, Math.floor(data.maxTokens)))
      : 900

  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
  ]
    .map(key => String(key || '').trim())
    .filter(Boolean)

  if (!keys.length) {
    return res.status(503).json({ error: 'ai_not_configured' })
  }

  for (let index = 0; index < keys.length; index += 1) {
    const text = await askGroq(keys[index], messages, temperature, maxTokens)

    if (text) {
      return res.status(200).json({
        text,
        provider: `groq#${index + 1}`,
      })
    }
  }

  return res.status(503).json({ error: 'ai_unavailable' })
