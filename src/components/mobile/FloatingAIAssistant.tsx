import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Brain,
  ChevronRight,
  Lightbulb,
  Mic,
  Send,
  Smile,
  Sparkles,
  Volume2,
  X,
  MessageSquare,
  Search,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import { toast } from 'sonner'
import {
  askAssistant,
  askTutor,
  getJoke,
  getProactiveWhisper,
  localNudge,
  type GeminiTurn,
  type SchoolContext,
} from '@/lib/gemini'

type Tab = 'chat' | 'voice' | 'discover'
type Emotion = 'happy' | 'thinking' | 'listening' | 'speaking' | 'curious' | 'idle' | 'wink'

const quickPrompts = [
  'Summarize today’s attendance',
  'Who needs attention today?',
  'Explain a topic as my AI tutor',
  'Tell me a joke',
  'Draft a message to absentees’ parents',
  'How is the class performing?',
]

const PAGE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/attendance': 'Attendance',
  '/marks': 'Marks',
  '/ai': 'AI Insights',
  '/schedule': 'Schedule',
  '/reports': 'Reports',
  '/calendar': 'Calendar',
  '/parent': 'Parent Portal',
  '/notifications': 'Notifications',
  '/whatsapp': 'WhatsApp',
  '/settings': 'Settings',
  '/superadmin': 'Super Admin',
}

// --- Web Speech API typings (not in default lib) -----------------------------
type SpeechRecognitionLike = any
const SpeechRecognitionCtor: SpeechRecognitionLike =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined

export default function FloatingAIAssistant() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')
  const location = useLocation()
  const navigate = useNavigate()
  const { schoolId } = useSchool()

  // Live data
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, any>>({})

  // Chat
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'ai'; text: string; time: string }>
  >([
    {
      sender: 'ai',
      text:
        "Hi! I'm your AI co-teacher. I use this screen's school context to help — ask me anything, talk to me, or let me surprise you with a tip or a joke. 💡",
      time: 'Just now',
    },
  ])
  const [chatBusy, setChatBusy] = useState(false)

  // Voice
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceReply, setVoiceReply] = useState('Tap the mic and talk to me…')
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const voiceCanvasRef = useRef<HTMLCanvasElement>(null)
  const speakingRef = useRef(false)

  // Discover / proactive
  const [whisper, setWhisper] = useState<string | null>(null)
  const [showWhisper, setShowWhisper] = useState(false)
  const [pupil, setPupil] = useState({ x: 0, y: 0 })
  const [emotion, setEmotion] = useState<Emotion>('happy')
  const [blinkNow, setBlinkNow] = useState(false)
  const idleTimerRef = useRef<number | null>(null)
  const emotionTimerRef = useRef<number | null>(null)

  const setEmotionTemp = useCallback((e: Emotion, ms = 1400) => {
    setEmotion(e)
    if (emotionTimerRef.current) window.clearTimeout(emotionTimerRef.current)
    emotionTimerRef.current = window.setTimeout(() => setEmotion('happy'), ms)
  }, [])

  // ---- Live data subscriptions ---------------------------------------------
  useEffect(() => {
    if (!schoolId) return
    const unsubs: any[] = []
    unsubs.push(
      onValue(ref(db, `schools/${schoolId}/students`), (snap) => {
        const v = snap.val() || {}
        setStudents(Object.entries(v).map(([id, s]: any) => ({ id, ...s })))
      }),
    )
    unsubs.push(
      onValue(ref(db, `schools/${schoolId}/attendance`), (snap) => {
        setAttendance(snap.val() || {})
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [schoolId])

  const todayRecords = useMemo(
    () => (Object.values(attendance[todayIST()] || {}) as any[]) || [],
    [attendance],
  )

  const stats = useMemo(() => {
    const total = students.length
    // todayRecords only contains students who actually have an attendance
    // record for today. Don't assume everyone else is absent — only count
    // records whose status is explicitly set.
    const marked = todayRecords.length
    const present = todayRecords.filter((r: any) => ['present', 'late'].includes(r.status)).length
    const absent = todayRecords.filter((r: any) => r.status === 'absent').length
    const late = todayRecords.filter((r: any) => r.status === 'late').length

    let lowestStudent: any = null
    let lowestPct = 101
    for (const s of students) {
      const allRecs = Object.values(attendance)
        .flatMap((day: any) => Object.values(day || {}).filter((r: any) => r.studentId === s.id))
      if (allRecs.length >= 2) {
        const p = allRecs.filter((r: any) => ['present', 'late'].includes(r.status)).length
        const pct = Math.round((p / allRecs.length) * 100)
        if (pct < lowestPct) {
          lowestPct = pct
          lowestStudent = { ...s, attendancePct: pct }
        }
      }
    }

    // Only report a percentage when attendance has actually been taken for
    // at least one student today. Otherwise leave undefined so the assistant
    // doesn't falsely claim "0% attendance".
    const pct = total && marked > 0 ? Math.round((present / total) * 1000) / 10 : undefined
    return {
      total,
      present: marked > 0 ? present : undefined,
      absent: marked > 0 ? absent : undefined,
      late: marked > 0 ? late : undefined,
      attendancePct: pct,
      lowAttendanceStudent: lowestStudent ? lowestStudent.name : null,
    }
  }, [students, todayRecords, attendance])

  const ctx: SchoolContext = useMemo(
    () => ({
      ...stats,
      page: PAGE_LABELS[location.pathname] || location.pathname,
      role: 'teacher',
    }),
    [stats, location.pathname],
  )

  // ---- "Moving AI" observer: proactive whispers -----------------------------
  const lastWhisperAt = useRef(0)
  const pushWhisper = useCallback(
    (text: string | null) => {
      if (!text) return
      setWhisper(text)
      setShowWhisper(true)
      lastWhisperAt.current = Date.now()
      window.setTimeout(() => setShowWhisper(false), 9000)
    },
    [],
  )

  // Contextual greeting when the teacher moves to a new screen
  useEffect(() => {
    if (open) return
    const label = PAGE_LABELS[location.pathname]
    if (!label) return
    const greetings: Record<string, string> = {
      Attendance: 'On the Attendance screen — I’ll keep an eye on who’s in and who’s missing.',
      Marks: 'Marks time! Ask me to summarize class performance anytime.',
      Students: 'Student list loaded. Need to find someone fast? Just ask.',
      Dashboard: 'Dashboard’s ready. Want today’s quick summary?',
      AI: 'The AI hub! I can go deeper here if you like.',
    }
    if (greetings[label]) {
      window.setTimeout(() => pushWhisper(greetings[label]), 1400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Periodic smart nudge based on live data
  useEffect(() => {
    if (open) return
    let active = true
    const id = window.setInterval(() => {
      if (!active || open || Date.now() - lastWhisperAt.current < 40000) return
      // Mostly smart nudges; occasionally a light joke so the teacher smiles.
      if (Math.random() < 0.25) { pushWhisper(getJoke()); return }
      getProactiveWhisper(ctx)
        .then((w) => {
          if (active && w) pushWhisper(w)
        })
        .catch(() => {
          const local = localNudge(ctx)
          if (active && local) pushWhisper(local)
        })
    }, 28000)
    return () => {
      active = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, open])

  // ---- Chat ----------------------------------------------------------------
  const runAssistant = useCallback(
    async (text: string) => {
      const userMsg = {
        sender: 'user' as const,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setChatMessages((prev) => [...prev, userMsg])
      setChatBusy(true)

      const history: GeminiTurn[] = chatMessages
        .filter((m) => m.sender === 'user' || m.sender === 'ai')
        .slice(-8)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }))

      const wantsTutor = /tutor|explain|teach|quiz|solve|concept|how does|what is|why (does|is)|define|learn/i.test(text)
      try {
        const reply = wantsTutor ? await askTutor(text, ctx) : await askAssistant(text, history, ctx)
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'ai', text: getJoke(), time: 'just now' },
        ])
      } finally {
        setChatBusy(false)
      }
    },
    [chatMessages, ctx],
  )

  const handleSend = () => {
    const q = chatInput.trim()
    if (!q || chatBusy) return
    setChatInput('')
    void runAssistant(q)
  }

  // ---- Voice ---------------------------------------------------------------
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.02
      u.pitch = 1.05
      const voices = window.speechSynthesis.getVoices?.() || []
      const preferred =
        voices.find((v) => /en[-_]IN/i.test(v.lang) && /female|woman|samantha|zira|google/i.test(v.name)) ||
        voices.find((v) => /en[-_]IN/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        undefined
      if (preferred) u.voice = preferred
      u.onstart = () => {
        setIsSpeaking(true)
        speakingRef.current = true
      }
      u.onend = () => {
        setIsSpeaking(false)
        speakingRef.current = false
      }
      u.onerror = () => {
        setIsSpeaking(false)
        speakingRef.current = false
      }
      window.speechSynthesis.speak(u)
    } catch {
      setIsSpeaking(false)
      speakingRef.current = false
    }
  }, [])

  const stopSpeaking = () => {
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // Speech synthesis may be unavailable while an app is backgrounded.
    }
    setIsSpeaking(false)
    speakingRef.current = false
  }

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      toast.info('Voice isn’t supported on this device — type your message instead.')
      return
    }
    try {
      const rec = new SpeechRecognitionCtor()
      rec.lang = 'en-IN'
      rec.interimResults = true
      rec.continuous = false
      rec.maxAlternatives = 1
      recognitionRef.current = rec

      rec.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        transcriptRef.current = transcript
        setVoiceTranscript(transcript)
      }
      rec.onerror = () => {
        setIsListening(false)
        toast.error('Couldn’t hear you clearly. Please try again.')
      }
      rec.onend = () => {
        setIsListening(false)
        const finalText = (transcriptRef.current || '').trim()
        transcriptRef.current = ''
        if (finalText) {
          setVoiceReply('Thinking…')
          const history: GeminiTurn[] = []
          askAssistant(finalText, history, ctx)
            .then((reply) => {
              setVoiceReply(reply)
              speak(reply)
            })
            .catch(() => {
              const j = getJoke()
              setVoiceReply(j)
              speak(j)
            })
        }
      }
      rec.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
      toast.error('Voice could not start. Please try again.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, speak])

  const stopListening = () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // Recognition can already be stopped by the browser.
    }
    setIsListening(false)
  }

  // Voice waveform canvas animation (throttled for performance)
  useEffect(() => {
    const canvas = voiceCanvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    let raf = 0
    let last = 0
    const FPS = 30
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 1000 / FPS) return
      last = now
      const w = (canvas.width = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5))
      const h = (canvas.height = canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 1.5))
      ctx2d.clearRect(0, 0, w, h)
      const bars = 22
      const mid = h / 2
      const t = now / 1000
      for (let i = 0; i < bars; i++) {
        const phase = t * (isSpeaking ? 7 : 2.0) + i * 0.5
        const amp = (isSpeaking ? 0.85 : 0.18) * Math.abs(Math.sin(phase)) * (0.4 + (i % 5) / 7)
        const bh = amp * h * 0.92
        const x = (i / (bars - 1)) * w
        const grad = ctx2d.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2)
        grad.addColorStop(0, 'rgba(34,211,238,0.95)')
        grad.addColorStop(1, 'rgba(168,85,247,0.95)')
        ctx2d.fillStyle = grad
        const bw = w / bars * 0.5
        ctx2d.fillRect(x - bw / 2, mid - bh / 2, bw, bh)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [isSpeaking, tab])

  // ---- Eye tracking ("sees everything") ------------------------------------
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const orb = document.getElementById('ai-orb')
      if (!orb) return
      const r = orb.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy) || 1
      const max = 5
      setPupil({ x: (dx / dist) * max, y: (dy / dist) * max })
      // Curious when pointer is near the orb
      if (dist < 90) setEmotionTemp('curious', 900)
    }
    const onLeave = () => setEmotion('happy')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [setEmotionTemp])

  // Occasional blink + idle emotion changes
  useEffect(() => {
    let active = true
    const blink = () => {
      if (!active) return
      setBlinkNow(true)
      window.setTimeout(() => { setBlinkNow(false); schedule() }, 60 + Math.random() * 80)
    }
    const schedule = () => {
      const next = 2800 + Math.random() * 3800
      idleTimerRef.current = window.setTimeout(blink, next)
    }
    schedule()
    const idleEmotion = window.setInterval(() => {
      if (!active) return
      // When idle, flip through friendly micro-expressions
      const moods: Emotion[] = ['happy', 'thinking', 'curious']
      setEmotion(moods[Math.floor(Math.random() * moods.length)])
    }, 7000)
    return () => {
      active = false
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      window.clearInterval(idleEmotion)
      if (emotionTimerRef.current) window.clearTimeout(emotionTimerRef.current)
    }
  }, [])

  // React to AI speaking / listening / busy
  useEffect(() => {
    if (isSpeaking) setEmotion('speaking')
    else if (isListening) setEmotion('listening')
    else if (chatBusy) setEmotion('thinking')
    else setEmotion('happy')
  }, [isSpeaking, isListening, chatBusy])

  // When chat opens, greet with a smile + tiny wink
  useEffect(() => {
    if (open) setEmotionTemp('wink', 900)
  }, [open, setEmotionTemp])

  // ---- Whisper action (jump to relevant screen) -----------------------------
  const whisperTap = () => {
    const t = (whisper || '').toLowerCase()
    if (t.includes('attendance') || t.includes('absent') || t.includes('late')) navigate('/attendance')
    else if (t.includes('mark') || t.includes('perform')) navigate('/marks')
    else if (t.includes('parent') || t.includes('guardian')) navigate('/whatsapp')
    setShowWhisper(false)
  }

  const tellJoke = () => {
    const j = getJoke()
    setChatMessages((prev) => [
      ...prev,
      { sender: 'ai', text: j, time: 'just now' },
    ])
    if (tab === 'voice') speak(j)
  }

  return (
    <>
      {/* Whisper bubble */}
      {showWhisper && whisper && !open && (
        <button
          onClick={whisperTap}
          className="ai-whisper fixed bottom-[150px] right-4 z-40 max-w-[260px] rounded-2xl rounded-br-md border border-cyan-300/30 bg-zinc-900/95 px-4 py-3 text-left text-[12.5px] font-medium text-white shadow-2xl backdrop-blur-xl animate-[ai-pop_.3s_ease-out] md:bottom-[160px]"
        >
          <span className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles size={11} /> EduSphere AI
          </span>
          {whisper}
          <span className="mt-1 flex items-center gap-1 text-[10px] text-cyan-200/80">
            Tap to open <ChevronRight size={12} />
          </span>
        </button>
      )}

      {/* Floating mascot orb — cute 3D neural face */}
      <button
        id="ai-orb"
        onClick={() => {
          setOpen((o) => !o)
          setShowWhisper(false)
          setEmotionTemp('happy', 1200)
        }}
        onMouseEnter={() => setEmotionTemp('curious', 1200)}
        aria-label="Open AI assistant"
        className="ai-orb group fixed bottom-[96px] right-4 z-40 grid h-[70px] w-[70px] place-items-center rounded-full md:bottom-[28px]"
      >
        <span className="ai-orb-aura" />
        <span className="ai-orb-ring" />
        <span className="ai-orb-ring-2" />
        <span className="ai-orb-satellite" />

        <span className={`ai-orb-core emotion-${emotion}`}>
          {/* Gold ear panels */}
          <span className="ai-orb-ear left" />
          <span className="ai-orb-ear right" />
          {/* Lens flares beside ears */}
          <span className="ai-orb-flare left"><span className="flare-h"/><span className="flare-v"/><span className="flare-star"/></span>
          <span className="ai-orb-flare right"><span className="flare-h"/><span className="flare-v"/><span className="flare-star"/></span>

          {/* SVG face */}
          <svg className="ai-face" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="aiIrisGrad" cx="40%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="55%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#4f46e5" />
              </radialGradient>
              <radialGradient id="aiCheek" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(244,114,182,0.55)" />
                <stop offset="100%" stopColor="rgba(244,114,182,0)" />
              </radialGradient>
            </defs>

            {/* Eyebrows — shape shifts per emotion */}
            {(() => {
              const brow = {
                happy:   { l: 'M26,36 Q31,31 36,35', r: 'M64,35 Q69,31 74,36' },
                thinking:{ l: 'M27,36 Q31,31 37,32', r: 'M63,33 Q69,31 73,37' },
                curious: { l: 'M27,38 Q32,30 36,33', r: 'M64,33 Q69,31 73,35' },
                listening:{l: 'M27,35 Q32,31 37,33', r: 'M63,33 Q68,31 73,35' },
                speaking:{ l: 'M27,36 Q31,32 37,35', r: 'M63,35 Q69,32 73,36' },
                idle:    { l: 'M27,36 Q32,33 36,36', r: 'M64,36 Q69,33 73,36' },
                wink:    { l: 'M27,38 Q32,30 36,34', r: 'M63,33 Q69,31 73,38' },
              }[emotion] || { l: 'M27,36 Q32,33 36,36', r: 'M64,36 Q69,33 73,36' }
              return (
                <>
                  <path className="ai-brow left" d={brow.l} />
                  <path className="ai-brow right" d={brow.r} />
                </>
              )
            })()}

            {/* Cheeks */}
            <circle cx="26" cy="60" r="6" fill="url(#aiCheek)" />
            <circle cx="74" cy="60" r="6" fill="url(#aiCheek)" />

            {/* Left eye */}
            <g className={`ai-eye-blink left ${blinkNow ? 'ai-blink-now' : ''}`} style={{ transformOrigin: '33px 49px' }}>
              <ellipse className="ai-eye-sclera" cx="33" cy="49" rx="9" ry="10" />
              <circle className="ai-eye-ring" cx="33" cy="49" r="8" />
              <g style={{ transform: `translate(${pupil.x * 0.6}px, ${pupil.y * 0.6}px)` }}>
                <circle className="ai-iris-inner" cx="33" cy="49" r="5.5" />
                <circle className="ai-pupil" cx="33" cy="49" r="3.2" />
                <circle className="ai-pupil-glow" cx="31.5" cy="47" r="1.4" />
              </g>
            </g>

            {/* Right eye */}
            <g className={`ai-eye-blink right ${blinkNow ? 'ai-blink-now' : ''}`} style={{ transformOrigin: '67px 49px' }}>
              <ellipse className="ai-eye-sclera" cx="67" cy="49" rx="9" ry="10" />
              <circle className="ai-eye-ring" cx="67" cy="49" r="8" />
              {emotion === 'wink' ? (
                <path d="M59,49 Q67,45 75,49" stroke="#0b0f1a" strokeWidth="2" fill="none" strokeLinecap="round" />
              ) : (
                <g style={{ transform: `translate(${pupil.x * 0.6}px, ${pupil.y * 0.6}px)` }}>
                  <circle className="ai-iris-inner" cx="67" cy="49" r="5.5" />
                  <circle className="ai-pupil" cx="67" cy="49" r="3.2" />
                  <circle className="ai-pupil-glow" cx="65.5" cy="47" r="1.4" />
                </g>
              )}
            </g>

            {/* Nose (small glossy highlight) */}
            <ellipse className="ai-nose" cx="50" cy="60" rx="3.5" ry="2.5" />

            {/* Mouth — changes with emotion */}
            {(() => {
              const mouth = {
                happy:   <path className="ai-mouth" d="M40,70 Q50,80 60,70" />,
                thinking:<path className="ai-mouth" d="M42,72 Q50,68 58,72" />,
                curious: <path className="ai-mouth" d="M42,72 Q50,78 58,72" />,
                listening:<path className="ai-mouth" d="M44,72 Q50,74 56,72" />,
                speaking:<ellipse className="ai-mouth-fill" cx="50" cy="73" rx="5" ry="3.5" />,
                idle:    <path className="ai-mouth" d="M43,72 Q50,75 57,72" />,
                wink:    <path className="ai-mouth" d="M40,70 Q48,78 55,68 Q52,75 60,72" />,
              }[emotion] || <path className="ai-mouth" d="M40,70 Q50,78 60,70" />
              return mouth
            })()}
          </svg>
        </span>
         
        <span className="ai-orb-status" />
        {isSpeaking && <span className="ai-orb-sound">🔊</span>}
      </button>

      {/* Panel */}
      {open && (
        <div className="ai-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl animate-[ai-slideup_.28s_cubic-bezier(.22,1,.3,1)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="ai-mascot-header">
                <span className="ai-mini-orb" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-white">EduSphere AI Assistant</div>
                <div className="text-[10px] text-cyan-300/80">
                  {isSpeaking ? 'Speaking…' : isListening ? 'Listening…' : 'Context-aware & ready'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-slate-300 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 pt-3">
            {([
              ['chat', 'Chat', MessageSquare],
              ['voice', 'Voice', Mic],
              ['discover', 'Discover', Lightbulb],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition ${
                  tab === key
                    ? 'bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {tab === 'chat' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                        m.sender === 'user'
                          ? 'rounded-br-md bg-indigo-500 text-white'
                          : 'rounded-bl-md bg-white/[.06] text-slate-100'
                      }`}
                    >
                      {m.text}
                      <div className={`mt-1 text-[9px] ${m.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {m.time}
                      </div>
                    </div>
                  </div>
                ))}
                {chatBusy && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-white/[.06] px-3.5 py-3">
                      <span className="ai-typing">
                        <i /> <i /> <i />
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    disabled={chatBusy}
                    onClick={() => runAssistant(q)}
                    className="rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 text-[10.5px] text-slate-300 active:scale-95 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
</div>
                <div className="flex items-center gap-2 border-t border-white/10 p-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask your AI co-teacher…"
                  className="h-11 flex-1 rounded-full border border-white/10 bg-white/[.04] px-4 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />
                <button
                  onClick={handleSend}
                  disabled={chatBusy}
                  className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-white active:scale-95 disabled:opacity-50"
                >
                  <Send size={17} />
                </button>
              </div>
            </div>
          )}

          {/* Voice tab */}
          {tab === 'voice' && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-4 px-5 py-6">
              <div className="w-full">
                <canvas ref={voiceCanvasRef} className="h-20 w-full rounded-2xl bg-white/[.03]" />
              </div>
              <div className="text-center">
                <div className="text-[13px] font-semibold text-white">
                  {isListening ? 'Listening…' : voiceReply}
                </div>
                {voiceTranscript && (
                  <div className="mt-1 text-[11px] text-slate-400">“{voiceTranscript}”</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!isListening ? (
                  <button
                    onClick={startListening}
                    className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-white shadow-lg active:scale-95"
                  >
                    <Mic size={26} />
                  </button>
                ) : (
                  <button
                    onClick={stopListening}
                    className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white shadow-lg active:scale-95"
                  >
                    <X size={26} />
                  </button>
                )}
                <button
                  onClick={isSpeaking ? stopSpeaking : () => speak(voiceReply)}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[.04] text-slate-200 active:scale-95"
                >
                  <Volume2 size={20} />
                </button>
              </div>
              <p className="px-6 text-center text-[10px] text-slate-500">
                Tap the mic and talk naturally — “Take attendance”, “Summarize marks”, or “Tell me a joke”.
              </p>
</div>
          )}

          {/* Discover tab */}
          {tab === 'discover' && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl bg-gradient-to-br from-cyan-500/15 to-fuchsia-500/15 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  <Sparkles size={12} /> Live snapshot
                </div>
                {typeof stats.attendancePct === 'number' ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[20px] font-black text-white">{stats.present ?? 0}</div>
                      <div className="text-[10px] text-slate-400">Present</div>
                    </div>
                    <div>
                      <div className="text-[20px] font-black text-white">{stats.absent ?? 0}</div>
                      <div className="text-[10px] text-slate-400">Absent</div>
                    </div>
                    <div>
                      <div className="text-[20px] font-black text-white">{stats.attendancePct}%</div>
                      <div className="text-[10px] text-slate-400">Rate</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    No attendance marked yet today. Open the Attendance screen and start a class — I'll show live numbers here as you mark students.
                  </p>
                )}
              </div>

              <button
                onClick={tellJoke}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left active:scale-[.98]"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <Smile size={17} className="text-fuchsia-300" /> Make me smile
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>

              <button
                onClick={() => runAssistant('Start AI Tutor mode. Give me a clear, friendly 2-minute study tip I can use with my class today.')}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left active:scale-[.98]"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <Brain size={17} className="text-cyan-300" /> AI Tutor
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>

              <button
                onClick={() => {
                  const n = localNudge(ctx) || 'Everything looks calm right now — nice work!'
                  setChatMessages((prev) => [...prev, { sender: 'ai', text: n, time: 'just now' }])
                  setTab('chat')
                }}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left active:scale-[.98]"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <Lightbulb size={17} className="text-amber-300" /> What needs my attention?
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
<button
                onClick={() => runAssistant('Give me 3 practical suggestions for today as a teacher.')}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left active:scale-[.98]"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <Brain size={17} className="text-cyan-300" /> Smart suggestions
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>

              <button
                onClick={() => navigate('/attendance')}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left active:scale-[.98]"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  <Search size={17} className="text-indigo-300" /> Go to Attendance
                </span>
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
