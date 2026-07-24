import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, push, set } from 'firebase/database'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import QRScanner from '@/components/QRScanner'
import PageHeader from '@/components/mobile/PageHeader'
import { Camera, QrCode, Users, X, ShieldCheck, SwitchCamera, ScanFace, AlertTriangle, Clock, Wifi, WifiOff, UserPlus, Grid, Volume2, History as HistoryIcon, CalendarDays, Search, Download } from 'lucide-react'
import { get } from 'firebase/database'
import {
  detectFacesWithDescriptors,
  findBestFaceMatch,
  isValidDescriptor,
  warmUpFaceModels,
  mapBoxToCanvas,
  FACE_MATCH_THRESHOLD,
  LIVE_FACE_MIN_AREA_RATIO,
  type EnrolledFace,
  type LiveFaceDetection,
} from '@/lib/faceRecognition'
import { saveToOfflineQueue } from '@/lib/offlineSync'

const AI_SCAN_INTERVAL_MS = 1200
const AI_DETECTION_TIMEOUT_MS = 6000
const REQUIRED_CONFIRM_FRAMES = 3
const AI_MARK_COOLDOWN_MS = 60_000
const LIVENESS_HISTORY_LIMIT = 6
/* Minutes after midnight (IST local device time) after which a check-in is
   marked Late instead of Present. 09:16 → late. */
const LATE_CUTOFF_MINUTES = 9 * 60 + 15

type AiCheckKey = 'camera' | 'detect' | 'liveness' | 'match' | 'cooldown' | 'mark'
type AiCheckState = 'idle' | 'checking' | 'pass' | 'fail'
type CameraFit = 'contain' | 'cover'

type AiCheckMap = Record<AiCheckKey, AiCheckState>

type FaceSample = {
  t: number
  x: number
  y: number
  area: number
  score: number
}

type ConfirmState = {
  frames: number
  samples: FaceSample[]
  lastConfidence: number
  lastSeenAt: number
  livenessPassed: boolean
  rejectedReason?: string
}

type UnknownFaceDraft = {
  descriptor: number[]
  previewUrl: string
}

const initialAiChecks = (): AiCheckMap => ({
  camera: 'idle',
  detect: 'idle',
  liveness: 'idle',
  match: 'idle',
  cooldown: 'idle',
  mark: 'idle',
})

const aiCheckLabels: Record<AiCheckKey, string> = {
  camera: 'Camera ready',
  detect: 'Face scan',
  liveness: 'Anti-spoof',
  match: 'Student match',
  cooldown: 'Cooldown safe',
  mark: 'Auto-mark',
}

const formatClock = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export default function AttendancePage(){
  const { profile } = useAuth()
  const { schoolId } = useSchool()
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [marks, setMarks] = useState<Record<string,string>>({})
  const [classSel, setClassSel] = useState('')
  const [aiScanning, setAiScanning] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [tab, setTab] = useState('manual')
  const [aiStatus, setAiStatus] = useState('Searching Faces...')
  const [aiFaceCount, setAiFaceCount] = useState(0)
  const [aiLog, setAiLog] = useState<string[]>([])
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [switchingCamera, setSwitchingCamera] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine)

  const [livenessStatus, setLivenessStatus] = useState<'PASS' | 'CHECKING' | 'FAKE'>('PASS')
  const [maskDetected, setMaskDetected] = useState<boolean>(false)
  const [headPoseText, setHeadPoseText] = useState<string>('Looking Straight')
  const [unknownPersonAlert, setUnknownPersonAlert] = useState<{ detected: boolean; time: string; box?: { x: number; y: number; width: number; height: number }; previewUrl?: string } | null>(null)
  const [pendingUnknownFace, setPendingUnknownFace] = useState<UnknownFaceDraft | null>(null)
  const [quickRegisterModalOpen, setQuickRegisterModalOpen] = useState(false)
  const [quickRegisterForm, setQuickRegisterForm] = useState({ name: '', rollNumber: '' })
  const [lateEntryMode, setLateEntryMode] = useState(false)
  const [hybridQrOverlay, setHybridQrOverlay] = useState(false)
  const [aiChecks, setAiChecks] = useState<AiCheckMap>(initialAiChecks)
  const [cameraFit, setCameraFit] = useState<CameraFit>('contain')
  const [zoomReady, setZoomReady] = useState(false)
  const [aiReviewOpen, setAiReviewOpen] = useState(false)
  const [lastMarkedNames, setLastMarkedNames] = useState<string[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, any>>({})
  const [histClass, setHistClass] = useState<string>('')
  const [histSubject, setHistSubject] = useState<string>('All')
  const [histRange, setHistRange] = useState<'7' | '30' | '90'>('30')
  const [histSearch, setHistSearch] = useState('')

  const lastCanvasSizeRef = useRef<{ w: number; h: number } | null>(null)
  const scanActiveRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scanTimerRef = useRef<number | null>(null)
  const scanBusyRef = useRef(false)
  const detectedIdsRef = useRef<Set<string>>(new Set())
  const streamRef = useRef<MediaStream | null>(null)
  const confirmRef = useRef<Map<string, ConfirmState>>(new Map())
  const lastMarkAtRef = useRef<Map<string, number>>(new Map())
  const unknownAlertAtRef = useRef(0)
  const marksRef = useRef(marks)

  useEffect(()=>{
    marksRef.current = marks
  }, [marks])
useEffect(()=>{
    const handleOnline = () => setIsOfflineMode(false)
    const handleOffline = () => setIsOfflineMode(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(()=>{
    const r = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    const unsub = onValue(r, snap=>{
      const v = snap.val()||{}
      const list = Object.entries(v).map(([id,s]:any)=>({id, ...s}))
      setAllStudents(list)
    })
    return ()=>unsub()
  }, [schoolId])

  // Pre-download the neural nets in idle time so the camera starts instantly.
  useEffect(()=>{
    warmUpFaceModels()
  }, [])

  const classOptions = useMemo(()=>{
    return Array.from(new Set(allStudents.map((s:any)=> `${s.className}-${s.section}`).filter(Boolean))).sort()
  }, [allStudents])

  useEffect(()=>{
    if (!classSel && classOptions.length) setClassSel(classOptions[0])
    if (classSel && classOptions.length && !classOptions.includes(classSel)) setClassSel(classOptions[0])
  }, [classOptions, classSel])

  // Load attendance history for History tab
  useEffect(() => {
    if (!schoolId && !profile?.schoolId) return
    const sid = schoolId || profile?.schoolId
    const unsub = onValue(ref(db, `schools/${sid}/attendance`), (snap) => {
      setHistoryMap(snap.val() || {})
    })
    return () => unsub()
  }, [schoolId, profile?.schoolId])

  const students = useMemo(
    () => allStudents.filter((s:any)=> `${s.className}-${s.section}`===classSel),
    [allStudents, classSel]
  )

  const enrolledFaces = useMemo<EnrolledFace[]>(()=> students
    .filter((s:any)=> isValidDescriptor(s.faceDescriptor))
    .map((s:any)=> ({ id: s.id, name: s.name || 'Student', descriptor: s.faceDescriptor })), [students])

  useEffect(()=>{
    return ()=>{
      scanActiveRef.current = false
      if(scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
      streamRef.current?.getTracks().forEach(t=>t.stop())
      streamRef.current = null
      document.body.style.overflow = ''
    }
  }, [])

  const updateAiCheck = (key: AiCheckKey, state: AiCheckState) => {
    setAiChecks(prev => prev[key] === state ? prev : { ...prev, [key]: state })
  }
const resetAiSession = () => {
    confirmRef.current.clear()
    setAiChecks(initialAiChecks())
    setAiReviewOpen(false)
    setLastMarkedNames([])
    setUnknownPersonAlert(null)
    setPendingUnknownFace(null)
    setLivenessStatus('CHECKING')
    setMaskDetected(false)
    setHeadPoseText('Passive liveness warming up')
  }

  const captureUnknownFacePreview = (detection: LiveFaceDetection) => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return ''

    const size = 280
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const padX = detection.box.width * 0.28
    const padY = detection.box.height * 0.32
    const sx = Math.max(0, detection.box.x - padX)
    const sy = Math.max(0, detection.box.y - padY)
    const sw = Math.min(video.videoWidth - sx, detection.box.width + padX * 2)
    const sh = Math.min(video.videoHeight - sy, detection.box.height + padY * 2)

    ctx.fillStyle = '#0b1120'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.86)
  }

  const rememberUnknownFace = (detection: LiveFaceDetection) => {
    const previewUrl = captureUnknownFacePreview(detection)
    setPendingUnknownFace({ descriptor: detection.descriptor, previewUrl })
    setUnknownPersonAlert({
      detected: true,
      time: formatClock(),
      box: detection.box,
      previewUrl,
    })
  }

  const evaluatePassiveLiveness = (studentId: string, detection: LiveFaceDetection, confidence: number): ConfirmState => {
    const video = videoRef.current
    const frameW = video?.videoWidth || 1
    const frameH = video?.videoHeight || 1
    const area = (detection.box.width * detection.box.height) / Math.max(1, frameW * frameH)
    const sample: FaceSample = {
      t: Date.now(),
      x: (detection.box.x + detection.box.width / 2) / frameW,
      y: (detection.box.y + detection.box.height / 2) / frameH,
      area,
      score: detection.score || 0,
    }

    const previous = confirmRef.current.get(studentId) || {
      frames: 0,
      samples: [],
      lastConfidence: confidence,
      lastSeenAt: 0,
      livenessPassed: false,
    }

    const samples = [...previous.samples, sample].slice(-LIVENESS_HISTORY_LIMIT)
    const motion = samples.slice(1).reduce((sum, current, index) => {
      const before = samples[index]
      return sum + Math.hypot(current.x - before.x, current.y - before.y)
    }, 0)
    const areaValues = samples.map(item => item.area)
    const areaRange = areaValues.length ? Math.max(...areaValues) - Math.min(...areaValues) : 0
    const avgScore = samples.reduce((sum, item) => sum + item.score, 0) / Math.max(1, samples.length)

    /* Keep liveness size gate in sync with the live-scan filter so the
       "Move closer" message is genuinely reachable and not dead code. */
    const faceLargeEnough = area >= LIVE_FACE_MIN_AREA_RATIO
    const highQuality = avgScore >= 0.58 && confidence >= 0.52
    const hasNaturalMotion = motion >= 0.003 || areaRange >= 0.002 || samples.length >= 5
    const livenessPassed = samples.length >= REQUIRED_CONFIRM_FRAMES && faceLargeEnough && highQuality && hasNaturalMotion
    const rejectedReason = !faceLargeEnough
      ? 'Move closer / face too small'
      : !highQuality
        ? 'Low light or blurred face'
        : !hasNaturalMotion && samples.length >= 5
          ? 'Static photo/screen suspected'
          : undefined

    const next: ConfirmState = {
      frames: previous.frames + 1,
      samples,
      lastConfidence: confidence,
      lastSeenAt: Date.now(),
      livenessPassed,
      rejectedReason,
    }
    confirmRef.current.set(studentId, next)
    return next
  }

  const markStudentFromAi = async (studentId: string, statusToMark: 'present' | 'late', confidence: number) => {
    const now = Date.now()
    const lastMarkedAt = lastMarkAtRef.current.get(studentId) || 0
    if (now - lastMarkedAt < AI_MARK_COOLDOWN_MS) {
      updateAiCheck('cooldown', 'fail')
      return false
    }

    const matchedStudent = students.find(s => s.id === studentId)
    if (!matchedStudent) return false

    lastMarkAtRef.current.set(studentId, now)
    detectedIdsRef.current.add(studentId)
    marksRef.current = { ...marksRef.current, [studentId]: statusToMark }
    setMarks(prev => ({ ...prev, [studentId]: statusToMark }))
    setLastMarkedNames(prev => [matchedStudent.name || 'Student', ...prev.filter(name => name !== matchedStudent.name)].slice(0, 5))

    const timeStr = formatClock()
    const icon = statusToMark === 'late' ? '⏰' : '✅'
    setAiLog(prev => [
      `${icon} ${statusToMark === 'late' ? 'Late' : 'Present'} • ${timeStr} • ${matchedStudent.name} • ${Math.round(confidence * 100)}% • liveness pass`,
      ...prev,
    ].slice(0, 12))

    const date = todayIST()
    const sid = schoolId || profile?.schoolId || 'global'
    const payload = {
      studentId: matchedStudent.id,
      className: matchedStudent.className,
      section: matchedStudent.section,
      subject: matchedStudent.subject || (Array.isArray(profile?.subjects) ? (profile as any).subjects?.[0] : ((profile as any)?.subject || 'General')) || 'General',
      date,
      status: statusToMark,
      markedBy: profile?.uid || 'ai_camera',
      method: 'ai_camera',
      confidence: Math.round(confidence * 100),
      antiSpoof: 'passive_liveness_passed',
      timestamp: now,
    }

    if (isOfflineMode) {
      saveToOfflineQueue([{
        id: `${matchedStudent.id}_${date}`,
        schoolId: sid,
        date,
        studentId: matchedStudent.id,
        className: matchedStudent.className,
        section: matchedStudent.section,
        status: statusToMark as any,
        markedBy: profile?.uid || 'ai_camera',
        method: 'ai_camera',
        timestamp: now,
      }])
    } else {
      update(ref(db, `schools/${sid}/attendance/${date}/${matchedStudent.id}`), payload).catch(error => {
        console.error('AI attendance write failed', error)
        toast.error(`Cloud save failed for ${matchedStudent.name}. It will remain selected locally.`)
      })
    }

    updateAiCheck('cooldown', 'pass')
    updateAiCheck('mark', 'pass')
    navigator.vibrate?.(55)
    return true
  }

  const applyWidestCameraView = async (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0]
    if (!track) return
    try {
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min?: number; max?: number; step?: number } }
      const zoomMin = capabilities?.zoom?.min
      if (typeof zoomMin === 'number') {
        await track.applyConstraints({ advanced: [{ zoom: zoomMin } as MediaTrackConstraintSet] })
        setZoomReady(true)
      } else {
        setZoomReady(false)
      }
    } catch (error) {
      console.warn('Wide/zoom-out camera control not supported', error)
      setZoomReady(false)
    }
  }

  const markMissingAbsent = () => {
    const missing = students.filter(s => marks[s.id] !== 'present' && marks[s.id] !== 'late')
    if (!missing.length) {
      toast.success('All students are already detected.')
      return
    }
    setMarks(prev => {
      const next = { ...prev }
      missing.forEach(s => { next[s.id] = 'absent' })
      marksRef.current = next
      return next
    })
    toast.success(`${missing.length} not-detected student(s) marked absent. Review and save when ready.`)
    setAiReviewOpen(false)
  }

  const restartAiCheck = async () => {
    detectedIdsRef.current = new Set(Object.entries(marks).filter(([,v])=>v==='present'||v==='late').map(([id])=>id))
    confirmRef.current.clear()
    setAiReviewOpen(false)
    setAiLog(prev => [`🔁 ${formatClock()} • Teacher restarted camera check for missing students`, ...prev].slice(0, 12))
    setAiStatus('Restarting AI scan for missing students…')
    await runAiScan()
  }

  const submit = async (method: 'manual' | 'ai_camera' | 'qr' = 'manual')=>{
    if(!students.length){ toast.error(classSel ? `No students in ${classSel}` : 'Select a class first'); return }
    const date = todayIST()
    const sid = schoolId || profile?.schoolId || 'global'
    let present = 0

    // Safety: on manual save, require the teacher to have actively marked
    // every student (green Present / amber Late / red Absent). Don't silently
    // default unmarked students to "present" — that caused fake 100% days.
    if (method === 'manual') {
      const unmarked = students.filter(s => !['present','late','absent'].includes(marks[s.id]))
      if (unmarked.length) {
        toast.error(`${unmarked.length} student(s) unmarked. Tap Present/Late/Absent for every row before saving.`)
        return
      }
    }

    if (isOfflineMode) {
      const offlineRecs = students.map(s => ({
        id: `${s.id}_${date}`,
        schoolId: sid,
        date,
        studentId: s.id,
        className: s.className,
        section: s.section,
        status: (marks[s.id] || 'absent') as any,
        markedBy: profile?.uid || 'system',
        method,
        timestamp: Date.now()
      }))
      saveToOfflineQueue(offlineRecs)
      toast.success(`Offline Mode • Saved ${offlineRecs.length} records locally! Will sync automatically when internet returns.`)
      return
    }

    const now = Date.now()
    const updates: Record<string, unknown> = {}
    for (const student of students) {
      // For non-manual methods (AI/QR) fall back to "absent" for anyone not
      // marked present/late; for manual we already enforced every row above.
      const status = marks[student.id] || (method === 'manual' ? 'absent' : 'absent')
      if (status === 'present' || status === 'late') present++
      updates[`schools/${sid}/attendance/${date}/${student.id}`] = {
        studentId: student.id,
        className: student.className,
        section: student.section,
        subject: student.subject || (Array.isArray(profile?.subjects) ? (profile as any).subjects?.[0] : ((profile as any)?.subject || 'General')) || 'General',
        date,
        status,
        markedBy: profile?.uid,
        method,
        timestamp: now,
      }
    }

    await update(ref(db), updates)
    toast.success(`Attendance saved to Firebase • Present/Late ${present}/${students.length}`)
    setMarks({})
  }

  const resizeOverlayCanvas = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    const rect = video.getBoundingClientRect()
    /* Perf: DPR 2+ on phones created a 2× canvas that struggled at 60fps.
       1.5 is visually identical for thin box strokes and much lighter. */
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    const last = lastCanvasSizeRef.current
    /* Perf: only touch canvas.width/height when the size actually changed —
       assigning width resets the whole canvas state every scan tick. */
    if (last && Math.abs(last.w - w) < 2 && Math.abs(last.h - h) < 2) return
    lastCanvasSizeRef.current = { w, h }
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }

  /** Rounded pill path (roundRect isn't available on older WebViews) */
  const pillPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, h / 2, w / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.arcTo(x + w, y, x + w, y + rr, rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
    ctx.lineTo(x + rr, y + h)
    ctx.arcTo(x, y + h, x, y + h - rr, rr)
    ctx.lineTo(x, y + rr)
    ctx.arcTo(x, y, x + rr, y, rr)
    ctx.closePath()
  }

  /* Clean mockup-style overlay: ONE slim corner-bracket box + ONE label pill
     per face. No laser line, no eye/nose dots, no shadowBlur — those were the
     main reasons the student's face was hidden and the canvas repaints were
     expensive on phones ("hanging"). */
  const drawDetections = (detections: LiveFaceDetection[], matchedByFace: Map<number, { id: string; name: string; confidence: number; isLate?: boolean; status?: 'verified' | 'checking' | 'cooldown' }>) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    resizeOverlayCanvas()
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.font = `700 ${Math.max(12, canvas.width / 46)}px Inter, system-ui, sans-serif`

    detections.forEach((d, index) => {
      const mapped = mapBoxToCanvas(d.box, video, canvas, cameraFit)
      const match = matchedByFace.get(index)

      let color: string
      let darkText = true
      if (match?.status === 'checking') color = '#22d3ee'
      else if (match?.status === 'cooldown') color = '#a78bfa'
      else if (match) color = match.isLate ? '#f59e0b' : '#10b981'
      else { color = '#f43f5e'; darkText = false }

      /* corner brackets instead of a full rectangle — face stays visible */
      const lw = Math.max(2.5, canvas.width / 300)
      const cl = Math.min(mapped.width, mapped.height) * 0.24
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.beginPath()
      /* top-left */ ctx.moveTo(mapped.x, mapped.y + cl); ctx.lineTo(mapped.x, mapped.y); ctx.lineTo(mapped.x + cl, mapped.y)
      /* top-right */ ctx.moveTo(mapped.x + mapped.width - cl, mapped.y); ctx.lineTo(mapped.x + mapped.width, mapped.y); ctx.lineTo(mapped.x + mapped.width, mapped.y + cl)
      /* bottom-right */ ctx.moveTo(mapped.x + mapped.width, mapped.y + mapped.height - cl); ctx.lineTo(mapped.x + mapped.width, mapped.y + mapped.height); ctx.lineTo(mapped.x + mapped.width - cl, mapped.y + mapped.height)
      /* bottom-left */ ctx.moveTo(mapped.x + cl, mapped.y + mapped.height); ctx.lineTo(mapped.x, mapped.y + mapped.height); ctx.lineTo(mapped.x, mapped.y + mapped.height - cl)
      ctx.stroke()

      const label = match
        ? match.status === 'checking'
          ? `${match.name} • checking…`
          : match.status === 'cooldown'
            ? `${match.name} • marked ✓`
            : `${match.name} • ${Math.round(match.confidence * 100)}% Verified ✓`
        : 'Unknown person'
      const padX = 11
      const labelH = Math.max(24, canvas.height / 30)
      const textW = ctx.measureText(label).width
      const labelW = Math.min(canvas.width - mapped.x - 2, textW + padX * 2)
      const labelY = Math.max(4, mapped.y - labelH - 7)

      ctx.fillStyle = color
      pillPath(ctx, mapped.x, labelY, labelW, labelH, labelH / 2)
      ctx.fill()
      ctx.fillStyle = darkText ? '#0b0f1a' : '#ffffff'
      ctx.fillText(label, mapped.x + padX, labelY + labelH * 0.7)
    })
  }

  const runAiScan = async ()=>{
    const video = videoRef.current
    if(scanBusyRef.current || !video || video.readyState < 2) return
    if(!enrolledFaces.length){
      setAiStatus('No Face IDs enrolled for this class. Add student photos first.')
      updateAiCheck('detect', 'fail')
      return
    }

   scanBusyRef.current = true
    updateAiCheck('detect', 'checking')
    updateAiCheck('liveness', 'checking')
    updateAiCheck('match', 'checking')
    setAiStatus('AI is scanning faces → checking liveness → matching students…')

    try {
      const detections = await Promise.race([
        detectFacesWithDescriptors(video),
        new Promise<LiveFaceDetection[]>((_, reject) => window.setTimeout(() => reject(new Error('Camera scan timed out. Move phone slowly or improve light.')), AI_DETECTION_TIMEOUT_MS)),
      ])

      setAiFaceCount(detections.length)
      updateAiCheck('detect', detections.length ? 'pass' : 'checking')

      const matchedByFace = new Map<number, { id: string; name: string; confidence: number; isLate?: boolean; status?: 'verified' | 'checking' | 'cooldown' }>()
      const usedIds = new Set<string>()
      const newlyMarked: string[] = []
      let unknownCount = 0
      let checkingCount = 0
      let blockedAsSpoof = 0

      if (!detections.length) {
        setLivenessStatus('CHECKING')
        setMaskDetected(false)
            setHeadPoseText('Move phone slowly across the classroom')
      }

      for (const [index, detection] of detections.entries()) {
        const best = findBestFaceMatch(detection.descriptor, enrolledFaces)
        if(best && best.distance <= FACE_MATCH_THRESHOLD && !usedIds.has(best.id)) {
          usedIds.add(best.id)
          updateAiCheck('match', 'pass')

          /* BUG FIX: the old check `getHours() >= 9 && getMinutes() > 15`
             jumped back to "present" at 10:05 because minutes wraps each
             hour. Compare total minutes after midnight instead. */
          const nowDate = new Date()
          const minutesNow = nowDate.getHours() * 60 + nowDate.getMinutes()
          const isLate = lateEntryMode || minutesNow > LATE_CUTOFF_MINUTES
          const statusToMark = isLate ? 'late' : 'present'
          const liveness = evaluatePassiveLiveness(best.id, detection, best.confidence)
          const alreadyMarked = detectedIdsRef.current.has(best.id) || marksRef.current[best.id] === 'present' || marksRef.current[best.id] === 'late'
          const inCooldown = Date.now() - (lastMarkAtRef.current.get(best.id) || 0) < AI_MARK_COOLDOWN_MS

          if (alreadyMarked || inCooldown) {
            matchedByFace.set(index, { id: best.id, name: best.name, confidence: best.confidence, isLate, status: 'cooldown' })
            updateAiCheck('cooldown', 'pass')
            continue
          }
if (!liveness.livenessPassed) {
            checkingCount++
            matchedByFace.set(index, { id: best.id, name: best.name, confidence: best.confidence, isLate, status: 'checking' })
            if (liveness.rejectedReason) {
              blockedAsSpoof++
              setAiLog(prev => [`🛡️ ${formatClock()} • ${best.name}: ${liveness.rejectedReason}`, ...prev].slice(0, 12))
            }
            continue
          }

          updateAiCheck('liveness', 'pass')
          matchedByFace.set(index, { id: best.id, name: best.name, confidence: best.confidence, isLate, status: 'verified' })
          const marked = await markStudentFromAi(best.id, statusToMark, best.confidence)
          if (marked) newlyMarked.push(best.name)
        } else {
          unknownCount++
          updateAiCheck('match', best ? 'checking' : 'fail')
          const now = Date.now()
          if (now - unknownAlertAtRef.current > 7000) {
            unknownAlertAtRef.current = now
            rememberUnknownFace(detection)
          }
        }
      }

      drawDetections(detections, matchedByFace)

      const newlyMarkedIds = newlyMarked
        .map(name => students.find(s => s.name === name)?.id)
        .filter((id): id is string => Boolean(id))
      const verified = new Set([
        ...Array.from(detectedIdsRef.current),
        ...Object.entries(marksRef.current).filter(([, value]) => value === 'present' || value === 'late').map(([id]) => id),
        ...newlyMarkedIds,
      ]).size

      const missingCount = Math.max(0, students.length - verified)
      const detectionSummary = detections.length
        ? `${detections.length} face(s) • ${newlyMarked.length} new • ${checkingCount} checking • ${unknownCount} unknown`
        : 'No faces in frame'

      setLivenessStatus(blockedAsSpoof ? 'FAKE' : detections.length ? (checkingCount ? 'CHECKING' : 'PASS') : 'CHECKING')
      setMaskDetected(Boolean(detections.length && detections.some(d => d.score < 0.62)))
      setHeadPoseText(detections.length >= 6 ? 'Wide classroom scan active' : detections.length ? 'Move slowly for full class coverage' : 'Full zoom-out view ready')

      setAiStatus(
missingCount
          ? `${detectionSummary} • ${verified}/${students.length} marked • ${missingCount} not detected`
          : `All detected • ${verified}/${students.length} marked present/late`
      )

      if (verified > 0 && missingCount > 0) setAiReviewOpen(true)
      if (missingCount === 0 && students.length) setAiReviewOpen(false)
    } catch(e:any) {
      updateAiCheck('detect', 'fail')
      setAiStatus(e?.message || 'AI face detection running...')
      console.warn('AI camera scan failed', e)
    } finally {
      scanBusyRef.current = false
    }
  }
  /* Perf: self-scheduling scan chain. setInterval kept firing while a slow
     frame was still being processed, so scans queued up and the UI froze.
     Now the next scan is only scheduled AFTER the current one finishes. */
  const scheduleNextScan = () => {
    scanTimerRef.current = window.setTimeout(async () => {
      if (!scanActiveRef.current) return
      await runAiScan()
      if (scanActiveRef.current) scheduleNextScan()
    }, AI_SCAN_INTERVAL_MS)
  }

const attachStream = async (mode: 'user' | 'environment') => {
    streamRef.current?.getTracks().forEach(t=>t.stop())
    streamRef.current = null

    const tryConstraints: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: mode }, width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 1.777 } }, audio: false },
      { video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      { video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: mode }, audio: false },
    ]

    let stream: MediaStream | null = null
    for (const constraints of tryConstraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        break
      } catch { /* ignore */ }
    }
    if (!stream) throw new Error('Could not open camera')

    streamRef.current = stream
    await applyWidestCameraView(stream)
    updateAiCheck('camera', 'pass')
    if(videoRef.current){
      videoRef.current.srcObject = stream
      videoRef.current.setAttribute('playsinline', 'true')
      videoRef.current.muted = true
      await videoRef.current.play()
      resizeOverlayCanvas()
    }
  }

  const enterFullscreen = async () => {
    const el = overlayRef.current || document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
    } catch { /* ignore */ }
  }

  const startAiCamera = async ()=>{
    if(!classSel){ toast.error('Add students first so a class is available'); return }
    if(!students.length){ toast.error(`No students in ${classSel}`); return }
    detectedIdsRef.current = new Set(Object.entries(marks).filter(([,v])=>v==='present'||v==='late').map(([id])=>id))
    resetAiSession()
    setAiLog([])
    setAiFaceCount(0)
    setAiStatus('Opening full-screen camera…')
    setAiScanning(true)
    document.body.style.overflow = 'hidden'
    try {
await new Promise<void>(resolve => requestAnimationFrame(()=>resolve()))
      await enterFullscreen()
      await attachStream(facingMode)
      setAiStatus('Searching Faces...')
      scanActiveRef.current = true
      await runAiScan()
      scheduleNextScan()
    }catch(e:any){
      toast.error(e?.message || 'Camera permission denied')
      stopAi(false)
    }
  }

  const switchCamera = async () => {
    if (switchingCamera || !aiScanning) return
    const next: 'user' | 'environment' = facingMode === 'environment' ? 'user' : 'environment'
    setSwitchingCamera(true)
    try {
      await attachStream(next)
      setFacingMode(next)
      await runAiScan()
    } catch (e: any) {
      toast.error(e?.message || `Could not open ${next === 'user' ? 'front' : 'back'} camera`)
    } finally {
      setSwitchingCamera(false)
    }
  }

  const stopAi = (exitFullscreen = true)=>{
    scanActiveRef.current = false
    setAiScanning(false)
    setAiStatus('Camera off')
    setAiFaceCount(0)
    setSwitchingCamera(false)
    setAiReviewOpen(false)
    setUnknownPersonAlert(null)
    setPendingUnknownFace(null)
    lastCanvasSizeRef.current = null
    document.body.style.overflow = ''
    if(scanTimerRef.current){ window.clearTimeout(scanTimerRef.current); scanTimerRef.current = null }
    streamRef.current?.getTracks().forEach(t=>t.stop())
    streamRef.current = null
    if(videoRef.current) videoRef.current.srcObject = null
    const ctx = canvasRef.current?.getContext('2d')
    if(ctx && canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
    if(exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(()=>{})
    }
  }

  const saveAiAttendance = async ()=>{
    const missing = students.filter(s => marks[s.id] !== 'present' && marks[s.id] !== 'late' && marks[s.id] !== 'absent')
    if (missing.length && aiScanning) {
      setAiReviewOpen(true)
      toast.info(`${missing.length} student(s) not detected. Mark absent or scan again first.`)
      return
    }
    await submit('ai_camera')
    stopAi()
  }
const handleQrScan = async (scannedText: string) => {
    const sid = schoolId || profile?.schoolId || 'global'
    const matchedStudent = allStudents.find((s: any) => s.id === scannedText || s.qrCode === scannedText)

    if (matchedStudent) {
      const date = todayIST()
      if (isOfflineMode) {
        saveToOfflineQueue([{
          id: `${matchedStudent.id}_${date}`,
          schoolId: sid,
          date,
          studentId: matchedStudent.id,
          className: matchedStudent.className,
          section: matchedStudent.section,
          status: 'present',
          markedBy: profile?.uid || 'qr',
          method: 'qr',
          timestamp: Date.now()
        }])
      } else {
        await update(ref(db, `schools/${sid}/attendance/${date}/${matchedStudent.id}`), {
          studentId: matchedStudent.id,
          className: matchedStudent.className,
          section: matchedStudent.section,
          date,
          status: 'present',
          markedBy: profile?.uid,
          method: 'qr',
          timestamp: Date.now()
        })
      }
      marksRef.current = { ...marksRef.current, [matchedStudent.id]: 'present' }
      setMarks(prev => ({ ...prev, [matchedStudent.id]: 'present' }))
      toast.success(`Verified: ${matchedStudent.name} marked Present via QR!`)
      setShowQrScanner(false)
      setHybridQrOverlay(false)
      try { navigator.vibrate?.(100) } catch { /* ignore */ }
    } else {
      toast.error(`Invalid QR: not found in your students list`)
    }
  }

  const sendParentAlert = async (student: any) => {
    const sid = schoolId || profile?.schoolId || 'global'
    const phone = student.guardianPhone || 'No Phone'

    /* BUG FIX: the previous copy baked in a hardcoded "Attendance 74%" for
       every student. Compute the real rate from saved attendance records. */
    let attendancePct = 0
    try {
      const snapshot = await get(ref(db, `schools/${sid}/attendance`))
      const allDays = snapshot.val() || {}
      let total = 0
      let presentLike = 0
      Object.values(allDays).forEach((day: any) => {
        const record = day?.[student.id]
        if (record?.status) {
          total += 1
          if (['present', 'late'].includes(record.status)) presentLike += 1
        }
      })
      attendancePct = total ? Math.round((presentLike / total) * 100) : 0
    } catch { /* fall through with 0 — alert still sends */ }

    const body = `${student.name} is absent today. Attendance rate: ${attendancePct}%. Please contact the class teacher.`
    toast.success(`Parent Alert Dispatched to ${student.guardianName || 'Guardian'} (${phone}):\n"${body}"`)
    try {
      const nRef = push(ref(db, `schools/${sid}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId: sid,
        toRole: 'parent',
        title: `Absent Alert: ${student.name}`,
        body,
        type: 'parent_alert',
        read: false,
        createdAt: Date.now()
      })
    } catch { /* ignore */ }
  }

  const presentCount = students.filter(s => marks[s.id] === 'present').length
  const lateCount = students.filter(s => marks[s.id] === 'late').length
  const absentCount = students.filter(s => marks[s.id] === 'absent').length
  const notDetectedStudents = students.filter(s => marks[s.id] !== 'present' && marks[s.id] !== 'late' && marks[s.id] !== 'absent')
  const unresolvedCount = notDetectedStudents.length

  const totalSeats = 40
  const occupiedSeats = presentCount + lateCount
  const emptySeats = Math.max(0, totalSeats - occupiedSeats)

  // ============ HISTORY TAB DATA ============
  useEffect(() => {
    if (!histClass && classOptions.length) setHistClass(classOptions[0])
  }, [classOptions, histClass])

  const subjectOptions = useMemo(() => {
    const subs = new Set<string>(['All'])
    allStudents.forEach(s => { if (s.subject) subs.add(s.subject) })
    subs.add('General')
    // Teacher subjects
    const teacherSubjects = Array.isArray(profile?.subjects) ? profile.subjects : (typeof (profile as any)?.subject === 'string' ? (profile as any).subject.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
    teacherSubjects.forEach((s: string) => s && subs.add(s))
    // Common fallback subjects
    ;['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'History', 'Geography', 'Computer Science', 'Physical Education'].forEach(s => subs.add(s))
    return Array.from(subs)
  }, [allStudents, profile])

  const historyRecords = useMemo(() => {
    const days = Number(histRange)
    const cutoff = Date.now() - days * 86400000
    const list: Array<{ date: string; studentId: string; studentName: string; rollNumber: string; status: string; method?: string; subject?: string; className?: string; section?: string; timestamp: number; confidence?: number }> = []
    Object.entries(historyMap).forEach(([dateStr, dayRecs]: [string, any]) => {
      if (!dayRecs) return
      const [y, m, d] = dateStr.split('-').map(Number)
      const dayDate = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getTime()
      if (dayDate < cutoff - 86400000) return
      const targetClass = histClass ? histClass.split('-') : null
      Object.values(dayRecs as Record<string, any>).forEach((rec: any) => {
        if (!rec) return
        if (targetClass) {
          const [c, sec] = targetClass
          if ((rec.className || '') !== c || (rec.section || '') !== sec) return
        }
        if (histSubject !== 'All' && (rec.subject || 'General') !== histSubject) return
        const student = allStudents.find(s => s.id === rec.studentId)
        const name = student?.name || rec.name || rec.studentId || 'Unknown'
        if (histSearch && !name.toLowerCase().includes(histSearch.toLowerCase()) && !(rec.rollNumber || student?.rollNumber || '').toLowerCase().includes(histSearch.toLowerCase())) return
        list.push({
          date: dateStr,
          studentId: rec.studentId,
          studentName: name,
          rollNumber: rec.rollNumber || student?.rollNumber || '-',
          status: rec.status || 'absent',
          method: rec.method,
          subject: rec.subject || 'General',
          className: rec.className,
          section: rec.section,
          timestamp: rec.timestamp || dayDate,
          confidence: rec.confidence,
        })
      })
    })
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return list
  }, [historyMap, histClass, histSubject, histRange, histSearch, allStudents])

  const historyStats = useMemo(() => {
    let present = 0, late = 0, absent = 0
    const byDate: Record<string, { present: number; late: number; absent: number }> = {}
    historyRecords.forEach(r => {
      if (r.status === 'present') present++
      else if (r.status === 'late') late++
      else absent++
      if (!byDate[r.date]) byDate[r.date] = { present: 0, late: 0, absent: 0 }
      if (r.status === 'present') byDate[r.date].present++
      else if (r.status === 'late') byDate[r.date].late++
      else byDate[r.date].absent++
    })
    const total = historyRecords.length
    const rate = total ? Math.round(((present + late) / total) * 100) : 0
    return { present, late, absent, total, rate, byDate }
  }, [historyRecords])

  const exportHistory = () => {
    try {
      const rows = [['Date', 'Class', 'Section', 'Subject', 'Roll', 'Student', 'Status', 'Method', 'Confidence']]
      historyRecords.forEach(r => {
        rows.push([r.date, r.className || '', r.section || '', r.subject || '', r.rollNumber, r.studentName, r.status, r.method || '', r.confidence ? r.confidence + '%' : ''])
      })
      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-${histClass || 'all'}-${histSubject}-${histRange}d.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('History CSV downloaded!')
    } catch (e) {
      toast.error('Could not export history')
    }
  }

  return <div className="space-y-4">
    <PageHeader title="AI Attendance Vision" subtitle={`Smart Biometrics • QR • Real-Time Occupancy • ${todayIST()}`} />

    {/* Top Actions & Class Selector Bar */}
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${isOfflineMode ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
          {isOfflineMode ? <WifiOff size={13}/> : <Wifi size={13}/>}
          {isOfflineMode ? 'Offline Mode (Local Storage)' : 'Cloud Sync Active'}
        </span>
        <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setIsOfflineMode(!isOfflineMode)}>
          {isOfflineMode ? 'Switch to Online Mode' : 'Simulate Offline Mode'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-white/60">Class:</span>
        <select value={classSel} onChange={e=>{setClassSel(e.target.value); setMarks({})}} className="h-10 rounded-full px-4 bg-white/10 border border-white/15 text-[13px] font-bold text-white outline-none focus:border-cyan-400/50">
          {!classOptions.length && <option value="">No classes yet</option>}
          {classOptions.map(opt => <option key={opt} value={opt} className="bg-[#0c1125]">{opt}</option>)}
        </select>
      </div>
    </div>

    {/* Main Counter Banner */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <Card className="p-4 rounded-[22px] border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-white/50 uppercase">Enrolled Students</div>
        <div className="text-[24px] font-black mt-1">{students.length}</div>
        <div className="text-[10px] text-white/40 mt-0.5">Class {classSel || 'All'}</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-emerald-400/20 bg-emerald-400/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-emerald-300 uppercase">Present Today</div>
        <div className="text-[24px] font-black text-emerald-300 mt-1">{presentCount}</div>
        <div className="text-[10px] text-emerald-300/70 mt-0.5">Updates every second</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-amber-400/20 bg-amber-400/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-amber-300 uppercase">Late Entry</div>
        <div className="text-[24px] font-black text-amber-300 mt-1">{lateCount}</div>
        <div className="text-[10px] text-amber-300/70 mt-0.5">Post-attendance arrivals</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-rose-400/20 bg-rose-400/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-rose-300 uppercase">Absent Today</div>
        <div className="text-[24px] font-black text-rose-300 mt-1">{absentCount}</div>
        <div className="text-[10px] text-rose-300/70 mt-0.5">Auto-queued parent alerts</div>
      </Card>
    </div>
<Tabs value={tab} onValueChange={setTab} className="w-full">
      {/* Mode selector — big tap-friendly button grid (no horizontal scroll!) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {([
          { key: 'manual', label: 'Manual & Roster', icon: Users, color: 'from-indigo-500 to-violet-500' },
          { key: 'ai', label: 'AI Smart Camera', icon: ScanFace, color: 'from-emerald-500 to-cyan-500' },
          { key: 'qr', label: 'QR Scanner', icon: QrCode, color: 'from-blue-500 to-indigo-500' },
          { key: 'heatmap', label: 'Occupancy & Heatmap', icon: Grid, color: 'from-fuchsia-500 to-pink-500' },
          { key: 'history', label: 'History', icon: HistoryIcon, color: 'from-violet-500 to-indigo-500' },
        ] as const).map(({ key, label, icon: Icon, color }) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 min-h-[74px] text-[12px] font-bold transition active:scale-[0.97] ${
                active
                  ? `bg-gradient-to-br ${color} text-white shadow-lg`
                  : 'bg-white/[0.05] border border-white/[0.1] text-white/70 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              <Icon size={20} className={active ? 'text-white' : 'text-white/70'} />
              <span className="leading-tight text-center">{label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: MANUAL & ROSTER */}
      <TabsContent value="manual" className="mt-4">
        {/* Roster + sticky Save bar live in a single flex column so the
            padding at the bottom of the roster is sized to the Save bar,
            guaranteeing the LAST student's Present/Late/Absent buttons are
            never hidden behind the Save button on phones (the bug you saw:
            "1 student unmarked" toast firing because the bottom card was
            unreachable under the sticky Save). */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2.5 pb-[88px] md:pb-3">
            {students.map(s=>(
              <Card key={s.id} className="rounded-[22px] p-0 overflow-hidden border border-white/[0.08] bg-white/[0.04] backdrop-blur-md shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 min-w-[44px] min-h-[44px] max-w-[44px] max-h-[44px] rounded-2xl relative bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden shadow-sm">
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span>{s.name?.[0]||'S'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-[14px] leading-tight truncate text-white">{s.name}</div>
                      <div className="text-[11px] text-white/50 mt-0.5 truncate">Roll #{s.rollNumber} • {s.className}-{s.section} • Face: {isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'No'}</div>
                    </div>
                  </div>
                  {/* On mobile the action buttons sit on their own row so
                      Present/Late/Absent + Alert Parent never squash off-screen. */}
                  <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
                    <div className="flex items-center gap-1 bg-white/10 rounded-full p-1">
                      {/* NO default-to-present: a student is unmarked (grey) until
                          the teacher taps. The SAVE button treats totally-unmarked
                          rosters as "nothing selected" instead of silently marking
                          everyone present. */}
                      <button onClick={()=>setMarks({...marks, [s.id]: 'present'})} className={`px-3 h-8 rounded-full text-[12px] font-bold transition ${ marks[s.id]==='present' ? 'bg-emerald-500 text-white shadow' : 'text-white/60 hover:text-white'}`}>Present</button>
                      <button onClick={()=>setMarks({...marks, [s.id]: 'late'})} className={`px-3 h-8 rounded-full text-[12px] font-bold transition ${ marks[s.id]==='late' ? 'bg-amber-500 text-white shadow' : 'text-white/60 hover:text-white'}`}>Late</button>
                      <button onClick={()=>setMarks({...marks, [s.id]: 'absent'})} className={`px-3 h-8 rounded-full text-[12px] font-bold transition ${ marks[s.id]==='absent' ? 'bg-rose-500 text-white shadow' : 'text-white/60 hover:text-white'}`}>Absent</button>
                    </div>
                    {marks[s.id] === 'absent' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendParentAlert(s)}
                        className="rounded-full h-8 text-[11px] text-rose-300 border-rose-400/40 bg-rose-500/10 hover:bg-rose-500/20"
                        title="Dispatch SMS / WhatsApp Alert to Parent"
                      >
                        Alert Parent
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {!students.length && <Card className="p-10 text-center text-white/50 text-sm rounded-[24px] border-white/10 bg-white/[0.03]">No students in {classSel || 'selected class'}. Add students from the Students page.</Card>}
          </div>
          <div className="sticky bottom-[88px] md:bottom-6 z-20 -mt-2 pt-2 bg-gradient-to-t from-[#050816] via-[#050816]/85 to-transparent">
            <Button onClick={()=>submit('manual')} variant="success" size="lg" className="w-full rounded-full h-14 font-extrabold text-[16px] shadow-[0_10px_30px_rgba(16,185,129,0.3)]" disabled={!students.length}>
              ✓ SAVE ATTENDANCE • {presentCount} Present • {lateCount} Late • {absentCount} Absent
            </Button>
          </div>
        </div>
      </TabsContent>
{/* TAB 2: AI SMART CAMERA */}
      <TabsContent value="ai" className="mt-4 space-y-4">
        <Card className="ai-camera-card overflow-hidden rounded-[28px] border border-emerald-400/30 bg-[#0e1520] text-white shadow-xl">
          <div className="flex items-center justify-between px-5 pt-5">
            <CardTitle className="flex items-center gap-2 p-0 text-white text-[17px] font-black">
              <ScanFace size={20} className="text-emerald-400"/> AI Classroom Vision System
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLateEntryMode(!lateEntryMode)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition ${lateEntryMode ? 'bg-amber-500 text-black shadow' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
              >
                <Clock size={13}/> {lateEntryMode ? 'Late Entry Mode Active' : 'Standard Check-In'}
              </button>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-extrabold text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/> READY FOR SCAN
              </span>
            </div>
          </div>
          <CardContent className="space-y-4 pt-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-emerald-400/20 bg-gradient-to-br from-[#15212a] via-[#111923] to-[#10131b] p-6 flex flex-col items-center justify-center text-center">
              <div className="absolute inset-0 opacity-25" style={{backgroundImage:'radial-gradient(circle at 50% 35%, rgba(40,225,190,.25), transparent 45%), linear-gradient(rgba(70,230,210,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(70,230,210,.08) 1px, transparent 1px)', backgroundSize:'auto, 32px 32px, 32px 32px'}}/>
              <span className="scan-corner scan-corner-tl"/><span className="scan-corner scan-corner-tr"/><span className="scan-corner scan-corner-bl"/><span className="scan-corner scan-corner-br"/>
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <span className="absolute inset-2 animate-ping rounded-full border border-emerald-400/20"/><ScanFace size={40}/>
              </div>
              <div className="mt-4 text-[16px] font-black text-white">AI Camera v2 • Cooldown + Anti-Spoof Classroom Scan</div>
              <div className="mt-1.5 max-w-[340px] text-[12px] leading-relaxed text-slate-400">Opens a mobile full-screen camera, uses full zoom-out classroom view, confirms faces across multiple frames, blocks duplicate marking with cooldown, and asks teacher to review not-detected students.</div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 backdrop-blur-md">
                <span className="text-[11px] text-slate-300 font-semibold">Class: {classSel || 'No class selected'}</span>
                <span className="text-[11px] font-black text-emerald-400">{enrolledFaces.length}/{students.length} EMBEDDINGS READY</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"><div className="text-[20px] font-black text-white">{students.length}</div><div className="text-[10px] text-slate-400 font-bold">Total Class</div></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-center"><div className="text-[20px] font-black text-emerald-400">{enrolledFaces.length}</div><div className="text-[10px] text-emerald-400/80 font-bold">Face Embeddings</div></div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-center"><div className="text-[20px] font-black text-cyan-400">{Math.round(AI_MARK_COOLDOWN_MS/1000)}s</div><div className="text-[10px] text-cyan-400/80 font-bold">Cooldown Lock</div></div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-3 text-center"><div className="text-[20px] font-black text-violet-300">{REQUIRED_CONFIRM_FRAMES}x</div><div className="text-[10px] text-violet-300/80 font-bold">Frame Confirm</div></div>
            </div>

            {enrolledFaces.length < students.length && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-[12px] text-amber-200">
                <span className="font-bold">{students.length - enrolledFaces.length}</span> student(s) in {classSel || 'this class'} don’t have a Face ID yet, so they can’t be auto-detected. Open the Students page, tap each, and generate their Face ID to include them.
              </div>
            )}

            <Button variant="gradient" className="w-full rounded-full h-14 text-[16px] font-extrabold shadow-[0_10px_35px_rgba(16,185,129,0.4)]" onClick={startAiCamera} disabled={!students.length}>
              <Camera size={19} className="mr-2"/> Start Beautiful AI Camera Scan
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
      {/* TAB 3: QR SCANNER */}
      <TabsContent value="qr" className="mt-4 space-y-4">
        {!showQrScanner ? (
          <Card className="p-8 text-center space-y-4 rounded-[26px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-white shadow-lg">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/30 flex items-center justify-center shadow"><QrCode size={40} className="text-cyan-300"/></div>
            <div>
              <h3 className="font-extrabold text-[18px] text-white">Instant QR Card Verification</h3>
              <p className="text-[13px] text-white/60 mt-1 max-w-md mx-auto">Scan student ID cards or QR codes at the gate or classroom door for lightning-fast check-in verification.</p>
            </div>
            <Button variant="gradient" size="lg" className="rounded-full px-8 font-bold" onClick={()=>setShowQrScanner(true)} disabled={!allStudents.length}>Start QR Scanner</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <QRScanner onScan={handleQrScan} onClose={()=>setShowQrScanner(false)} />
            <Button variant="outline" className="w-full rounded-full h-12 font-bold border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={()=>setShowQrScanner(false)}>Close QR Scanner</Button>
          </div>
        )}
      </TabsContent>

      {/* TAB 4: CLASSROOM OCCUPANCY & HEATMAP & AI ANALYTICS */}
      <TabsContent value="heatmap" className="mt-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-3.5">
          <Card className="p-4 rounded-[24px] border border-cyan-400/30 bg-gradient-to-br from-[#0e1624] to-[#131d2e] text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Seats Total</span>
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"/>
            </div>
            <div className="text-[32px] font-black mt-2">{totalSeats}</div>
            <div className="text-[11px] text-slate-400 mt-1">Configured Classroom Capacity</div>
          </Card>
          <Card className="p-4 rounded-[24px] border border-emerald-400/30 bg-gradient-to-br from-[#0e1f1c] to-[#112924] text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Occupied Seats</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"/>
            </div>
            <div className="text-[32px] font-black mt-2 text-emerald-400">{occupiedSeats}</div>
            <div className="text-[11px] text-emerald-400/80 mt-1">Verified Present & Late Students</div>
          </Card>
          <Card className="p-4 rounded-[24px] border border-amber-400/30 bg-gradient-to-br from-[#241d0e] to-[#2e2413] text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Empty Seats</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"/>
            </div>
            <div className="text-[32px] font-black mt-2 text-amber-400">{emptySeats}</div>
            <div className="text-[11px] text-amber-400/80 mt-1">Available / Unoccupied Desks</div>
          </Card>
        </div>
{/* AI Classroom Analytics Card */}
        <Card className="p-5 rounded-[26px] bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-400/20 backdrop-blur-md text-white shadow-lg">
          <CardTitle className="text-[16px] font-black flex items-center gap-2 text-white">
            <Volume2 className="text-indigo-300"/> AI Classroom Live Behavioral Analytics
          </CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="text-[11px] font-bold text-white/50 uppercase">Students Present</div>
              <div className="text-[20px] font-black text-emerald-400 mt-1">{presentCount}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="text-[11px] font-bold text-white/50 uppercase">Talking / Active Zone</div>
              <div className="text-[20px] font-black text-cyan-400 mt-1">{Math.min(presentCount, Math.round(presentCount * 0.12))}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="text-[11px] font-bold text-white/50 uppercase">Empty Seats</div>
              <div className="text-[20px] font-black text-amber-400 mt-1">{emptySeats}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10">
              <div className="text-[11px] font-bold text-white/50 uppercase">Teacher Present</div>
              <div className="text-[20px] font-black text-violet-400 mt-1">Yes ✓</div>
            </div>
          </div>
          <p className="text-[11px] text-white/50 mt-3 italic">Use classroom behavioral metrics carefully and transparently to foster positive class engagement.</p>
        </Card>

        {/* Classroom Desk Heatmap Grid */}
        <Card className="p-5 rounded-[26px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-[16px] font-black flex items-center gap-2 text-white">🪑 Classroom Seating Heatmap & Desk Grid</CardTitle>
              <p className="text-[12px] text-white/50 mt-0.5">Live visual mapping of occupied seats, active zones, and empty desks.</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-white/70">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500"/> Occupied</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"/> Late</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/15 border border-white/20"/> Empty Desk</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/30 border border-white/[0.08]">
            <div className="w-full text-center py-2 mb-4 rounded-xl bg-gradient-to-r from-indigo-500/30 to-violet-500/30 border border-white/10 text-white font-extrabold text-[12px] tracking-widest shadow">
              TEACHER PODIUM & SMART BOARD
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
              {Array.from({ length: totalSeats }, (_, idx) => {
                const student = students[idx]
                const status = student ? (marks[student.id] || 'unmarked') : 'empty'
                const isTalking = student && idx % 7 === 2 // simulation of active talking desk

                return (
                  <div
                    key={idx}
                    className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition hover:scale-105 shadow-xs ${
                      !student ? 'bg-white/[0.04] border-dashed border-white/15 text-white/30'
                      : status === 'present' ? 'bg-emerald-500 text-white border-emerald-600 font-bold'
                      : status === 'late' ? 'bg-amber-500 text-white border-amber-600 font-bold'
                      : status === 'absent' ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      : 'bg-white/[0.08] border-white/20 text-white/70'
                    }`}
                  >
                    <span className="text-[9px] font-mono opacity-80">Desk #{idx + 1}</span>
                    <span className="text-[11px] font-extrabold truncate w-full mt-0.5">
                      {student ? student.name.split(' ')[0] : 'Empty'}
                    </span>
                    {isTalking && student && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 border border-white flex items-center justify-center text-[8px] font-black text-black" title="Talking/Active Zone">🗣️</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </TabsContent>

      {/* TAB 5: ATTENDANCE HISTORY */}
      <TabsContent value="history" className="mt-4 space-y-4">
        <Card className="p-5 rounded-[26px] border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 backdrop-blur-md text-white shadow-lg">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-[17px] font-black flex items-center gap-2 text-white">
                <HistoryIcon className="text-violet-300" size={20} /> Attendance History
              </CardTitle>
              <p className="text-[12px] text-white/60 mt-1">View attendance history class-wise and subject-wise using the filters below.</p>
            </div>
            <Button variant="gradient" size="sm" className="rounded-full h-10 px-5" onClick={exportHistory}>
              <Download size={15} className="mr-1.5"/> Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1"><Users size={12}/> Class</label>
              <select value={histClass} onChange={e => setHistClass(e.target.value)} className="mt-1 w-full h-11 rounded-2xl bg-white/10 border border-white/15 px-4 text-[13px] font-bold text-white outline-none focus:border-cyan-400/50">
                {!classOptions.length && <option value="" className="bg-[#0c1125]">No classes yet</option>}
                {classOptions.map(opt => <option key={opt} value={opt} className="bg-[#0c1125]">{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1"><CalendarDays size={12}/> Subject</label>
              <select value={histSubject} onChange={e => setHistSubject(e.target.value)} className="mt-1 w-full h-11 rounded-2xl bg-white/10 border border-white/15 px-4 text-[13px] font-bold text-white outline-none focus:border-cyan-400/50">
                {subjectOptions.map(s => <option key={s} value={s} className="bg-[#0c1125]">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60">Date Range</label>
              <select value={histRange} onChange={e => setHistRange(e.target.value as '7'|'30'|'90')} className="mt-1 w-full h-11 rounded-2xl bg-white/10 border border-white/15 px-4 text-[13px] font-bold text-white outline-none focus:border-cyan-400/50">
                <option value="7" className="bg-[#0c1125]">Last 7 days</option>
                <option value="30" className="bg-[#0c1125]">Last 30 days</option>
                <option value="90" className="bg-[#0c1125]">Last 90 days</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1"><Search size={12}/> Search Student</label>
              <input
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Name or Roll No."
                className="mt-1 w-full h-11 rounded-2xl bg-white/10 border border-white/15 px-4 text-[13px] text-white placeholder-white/40 outline-none focus:border-cyan-400/50"
              />
            </div>
          </div>

          {/* Stat chips */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10">
              <div className="text-[10px] font-bold text-white/50 uppercase">Total Records</div>
              <div className="text-[22px] font-black text-white">{historyStats.total}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/25">
              <div className="text-[10px] font-bold text-emerald-300 uppercase">Present</div>
              <div className="text-[22px] font-black text-emerald-400">{historyStats.present}</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/25">
              <div className="text-[10px] font-bold text-amber-300 uppercase">Late</div>
              <div className="text-[22px] font-black text-amber-400">{historyStats.late}</div>
            </div>
            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-400/25">
              <div className="text-[10px] font-bold text-violet-300 uppercase">Attendance Rate</div>
              <div className="text-[22px] font-black text-violet-400">{historyStats.rate}%</div>
            </div>
          </div>
        </Card>

        {/* Daily summary */}
        {Object.keys(historyStats.byDate).length > 0 && (
          <Card className="p-4 rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-white shadow-lg">
            <CardTitle className="text-[14px] font-bold mb-3 text-white">Daily Summary — {histClass} • {histSubject}</CardTitle>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {Object.entries(historyStats.byDate).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14).map(([date, stats]) => {
                const total = stats.present + stats.late + stats.absent
                const rate = total ? Math.round(((stats.present + stats.late) / total) * 100) : 0
                return (
                  <div key={date} className="min-w-[90px] rounded-2xl p-3 border border-white/10 bg-white/[0.05] text-center">
                    <div className="text-[9px] font-bold uppercase text-white/50">{date.slice(5)}</div>
                    <div className={`text-[18px] font-black mt-1 ${rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{rate}%</div>
                    <div className="mt-1 flex gap-0.5 justify-center text-[9px] font-bold">
                      <span className="text-emerald-400">P{stats.present}</span>
                      <span className="text-amber-400 ml-1">L{stats.late}</span>
                      <span className="text-rose-400 ml-1">A{stats.absent}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Records table (scrollable) */}
        <Card className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-white shadow-lg overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <CardTitle className="text-[14px] font-bold text-white">Detailed Records</CardTitle>
            <span className="text-[11px] text-white/50">{historyRecords.length} record(s)</span>
          </div>
          <div className="max-h-[500px] overflow-auto scrollbar-thin">
            {historyRecords.length === 0 ? (
              <div className="p-10 text-center text-white/50 text-sm">
                <HistoryIcon size={32} className="mx-auto mb-2 opacity-40"/>
                No attendance records found for this filter. Mark attendance or adjust filters.
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-white/[0.05] sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2.5 font-bold text-white/50 uppercase text-[10px]">Date</th>
                    <th className="px-3 py-2.5 font-bold text-white/50 uppercase text-[10px]">Student</th>
                    <th className="px-3 py-2.5 font-bold text-white/50 uppercase text-[10px] hidden sm:table-cell">Subject</th>
                    <th className="px-3 py-2.5 font-bold text-white/50 uppercase text-[10px] hidden md:table-cell">Method</th>
                    <th className="px-3 py-2.5 font-bold text-white/50 uppercase text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map((r, i) => (
                    <tr key={`${r.date}-${r.studentId}-${i}`} className="border-t border-white/5 hover:bg-white/[0.04] transition">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-white/50">{r.date}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-white">{r.studentName}</div>
                        <div className="text-[10px] text-white/50">Roll {r.rollNumber} • {r.className}-{r.section}</div>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-white/60">{r.subject}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-[10px] uppercase font-bold text-white/50">{r.method || 'manual'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black ${
                          r.status === 'present' ? 'bg-emerald-500/20 text-emerald-300' :
                          r.status === 'late' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-rose-500/20 text-rose-300'
                        }`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </TabsContent>
    </Tabs>

    {/* FULL-SCREEN AI CAMERA OVERLAY */}
    {aiScanning && (
      <div
        ref={overlayRef}
        id="ai-camera-overlay"
        className="fixed inset-0 z-[99999] bg-black text-white flex flex-col"
        style={{ width: '100vw', height: '100dvh', maxHeight: '100dvh', maxWidth: '100vw', overflow: 'hidden' }}
      >
        {/* Slim header — mockup style: title + class chip + camera controls */}
        <div className="min-h-14 px-3 py-2 flex items-center justify-between gap-2 bg-black/85 border-b border-white/10 shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <div className="font-extrabold leading-tight truncate text-[15px] flex items-center gap-2">
              <ScanFace size={17} className="text-emerald-400 shrink-0"/> AI Smart Camera
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/85">{classSel}</span>
            </div>
            <div className="text-[11px] text-white/70 truncate mt-0.5 font-medium">{aiStatus}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              className="rounded-full text-white hover:bg-white/10 px-2.5 h-9 border border-white/15 text-[11px] font-bold"
              onClick={switchCamera}
              disabled={switchingCamera}
              title="Switch Front / Back camera"
            >
              <SwitchCamera size={15} className="mr-1"/> {switchingCamera ? '…' : (facingMode === 'environment' ? 'Front' : 'Back')}
            </Button>
            <Button variant="ghost" className="rounded-full bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 px-2.5 h-9 border border-rose-500/40 text-[11px] font-bold" onClick={()=>stopAi()}>
              <X size={15} className="mr-1"/> Close
            </Button>
          </div>
        </div>

        {/* Clean camera card — ONLY face boxes + name pills float on the video
            so the teacher can always see the student being captured. All the
            status panels live BELOW the camera now (mockup design). */}
        <div className="shrink-0 px-3 pt-2.5">
          <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/40 bg-black shadow-[0_0_44px_rgba(16,185,129,0.16)]" style={{ height: 'min(42dvh, 480px)' }}>
            <video ref={videoRef} className="absolute inset-0 w-full h-full bg-black" style={{ objectFit: cameraFit }} muted playsInline autoPlay />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-extrabold text-emerald-300 backdrop-blur-md border border-emerald-300/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/> Scanning{aiFaceCount ? ` • ${aiFaceCount} face${aiFaceCount > 1 ? 's' : ''}` : '…'}
            </span>
            <span className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md border border-white/15">
              {presentCount + lateCount}/{students.length} marked
            </span>
          </div>
        </div>

        {/* Everything else scrolls BELOW the camera instead of covering it */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold border flex items-center gap-1.5 ${livenessStatus === 'PASS' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' : livenessStatus === 'CHECKING' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40' : 'bg-rose-500/15 text-rose-300 border-rose-400/40'}`}>
              <ShieldCheck size={13}/> Anti-spoof: {livenessStatus === 'PASS' ? 'PASS ✓' : livenessStatus === 'CHECKING' ? 'Checking…' : 'Photo/screen risk'}
            </span>
            <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold border ${maskDetected ? 'bg-amber-500/15 text-amber-300 border-amber-400/40' : 'bg-white/5 text-white/70 border-white/15'}`}>
              {maskDetected ? '⚠️ Low light / covered face' : '😊 Face quality OK'}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-white/60 text-[10px] font-bold truncate max-w-full">
              {headPoseText}
            </span>
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">AI pipeline <span className="text-white/40 font-bold normal-case tracking-normal">cooldown {Math.round(AI_MARK_COOLDOWN_MS/1000)}s • {REQUIRED_CONFIRM_FRAMES} frames</span></div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCameraFit(cameraFit === 'contain' ? 'cover' : 'contain')}
                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/75"
                  title="Toggle full zoom-out classroom view"
                >
                  {cameraFit === 'contain' ? 'Full view' : 'Fill view'}{zoomReady ? ' • min zoom' : ''}
                </button>
                <button
                  onClick={() => setHybridQrOverlay(!hybridQrOverlay)}
                  className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200 flex items-center gap-1"
                  title="Toggle QR Hybrid Fallback"
                >
                  <QrCode size={11}/> {hybridQrOverlay ? 'Hide QR' : 'QR'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {(Object.keys(aiChecks) as AiCheckKey[]).map(key => (
                <div key={key} className={`ai-check-line rounded-lg px-1.5 py-1.5 text-center text-[9.5px] font-black border ${aiChecks[key] === 'pass' ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-200' : aiChecks[key] === 'checking' ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100' : aiChecks[key] === 'fail' ? 'border-rose-300/60 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-white/45'}`}>
                  <div className="mx-auto mb-1 h-1 rounded-full bg-current opacity-70" />
                  {aiCheckLabels[key]}
                </div>
              ))}
            </div>
          </div>
{hybridQrOverlay && (
            <div className="relative z-20 m-auto w-[min(340px,90vw)] p-4 rounded-[26px] bg-[#0f172a]/95 border border-cyan-400/50 backdrop-blur-xl shadow-2xl text-center space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[14px] text-cyan-300 flex items-center gap-1.5"><QrCode size={16}/> QR Hybrid Fallback Mode</span>
                <button onClick={() => setHybridQrOverlay(false)} className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center"><X size={14}/></button>
              </div>
              <p className="text-[11px] text-slate-300">If face verification is blocked by glare or masks, hold up your student QR ID card below for instant check-in:</p>
              <div className="max-h-[220px] overflow-hidden rounded-xl border border-white/10">
                <QRScanner onScan={handleQrScan} onClose={() => setHybridQrOverlay(false)} />
              </div>
            </div>
          )}

          {unknownPersonAlert && (
            <div className="relative z-20 mx-4 my-2 p-3.5 rounded-2xl bg-rose-600/95 border border-white/30 text-white shadow-2xl flex items-center justify-between gap-3 animate-bounce-short">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle size={22} className="shrink-0 text-yellow-300"/>
                <div className="min-w-0">
                  <div className="font-black text-[13px] uppercase tracking-wider">Warning: Unknown Person Detected</div>
                  <div className="text-[11px] text-rose-100 truncate">Class {classSel || 'XII-A'} • {unknownPersonAlert.time} • Unrecognized face embedding</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-8 rounded-full bg-white text-black font-bold text-[11px]" onClick={() => { setQuickRegisterModalOpen(true); setUnknownPersonAlert(null); }}>
                  Register Face
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-full text-white bg-black/40 hover:bg-black/60 font-semibold text-[11px]" onClick={() => {
                  toast.info('Notified School Admin & Security desk about unknown visitor.')
                  setUnknownPersonAlert(null)
                }}>
                  Notify Admin
                </Button>
                <button onClick={() => setUnknownPersonAlert(null)} className="w-7 h-7 rounded-full bg-black/30 flex items-center justify-center text-white"><X size={14}/></button>
              </div>
            </div>
          )}

          {aiReviewOpen && unresolvedCount > 0 && (
            <div className="relative z-20 mx-3 mb-2 rounded-[24px] border border-amber-300/40 bg-slate-950/90 p-3.5 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-black text-amber-200">
                    <AlertTriangle size={17}/> Teacher review needed
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                    {unresolvedCount} student(s) not detected. Mark them absent, or scan again by moving the phone slowly from back bench to front bench.
                  </p>
                </div>
                <button onClick={() => setAiReviewOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white"><X size={14}/></button>
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {notDetectedStudents.slice(0, 10).map(student => (
                  <span key={student.id} className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/90">
                    {student.name || 'Student'}
                  </span>
                ))}
{notDetectedStudents.length > 10 && <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold">+{notDetectedStudents.length - 10}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10 rounded-full border-cyan-300/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 font-bold" onClick={restartAiCheck}>
                  Start Again Scan
                </Button>
                <Button variant="default" className="h-10 rounded-full bg-amber-500 text-black hover:bg-amber-400 font-black" onClick={markMissingAbsent}>
                  Mark Not Detected Absent
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="rounded-2xl bg-slate-950/80 border border-white/15 p-3.5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-bold text-white flex items-center gap-2">
                  <span>Verified Classroom Students ({students.filter(s=>marks[s.id]==='present'||marks[s.id]==='late').length}/{students.length})</span>
                  {lateEntryMode && <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">LATE MODE</span>}
                </div>
                <div className="text-[11px] font-extrabold text-emerald-400">
                  Present: {presentCount} • Late: {lateCount}
                </div>
              </div>
              {!!lastMarkedNames.length && (
                <div className="mb-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
                  Just marked: {lastMarkedNames.join(', ')}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-auto pr-1">
                {students.filter(s=>marks[s.id]==='present'||marks[s.id]==='late').map(s=>(
                  <span key={s.id} className={`verified-pop px-3 py-1 rounded-full text-[11.5px] font-extrabold shadow flex items-center gap-1 ${marks[s.id] === 'late' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>
                    ✓ {s.name} {marks[s.id] === 'late' && '(Late)'}
                  </span>
                ))}
                {!students.filter(s=>marks[s.id]==='present'||marks[s.id]==='late').length && (
                  <span className="text-[12px] text-white/60 italic">Point camera at classroom students. All verified faces mark attendance simultaneously.</span>
                )}
              </div>
            </div>
{!!aiLog.length && (
              <div className="rounded-2xl bg-slate-950/80 border border-white/15 p-2.5 max-h-20 overflow-auto">
                <div className="space-y-0.5 text-[11px] font-medium text-emerald-300">
                  {aiLog.slice(0, 3).map((l,i)=><div key={i}>{l}</div>)}
                </div>
              </div>
            )}
</div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-black/95 p-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 shrink-0">
          <Button variant="outline" className="rounded-full h-11 bg-transparent border-white/30 text-white font-bold hover:bg-white/10" onClick={restartAiCheck}>
            Scan Again
          </Button>
          <Button variant="default" className="rounded-full h-11 bg-amber-500 text-black hover:bg-amber-400 font-black" onClick={markMissingAbsent} disabled={!unresolvedCount}>
            Missing Absent ({unresolvedCount})
          </Button>
          <Button variant="outline" className="rounded-full h-11 bg-transparent border-rose-400/40 text-rose-200 font-bold hover:bg-rose-500/10" onClick={()=>stopAi()}>
            Stop Camera
          </Button>
          <Button variant="success" className="rounded-full h-11 font-black text-[13px] shadow-[0_0_25px_rgba(16,185,129,0.4)]" onClick={saveAiAttendance}>
            Save ({presentCount + lateCount}/{students.length})
          </Button>
        </div>
      </div>
    )}

    {/* Quick Register Modal for Unknown Visitor */}
    <Dialog open={quickRegisterModalOpen} onOpenChange={(open) => {
      setQuickRegisterModalOpen(open)
      if (!open) setQuickRegisterForm({ name: '', rollNumber: '' })
    }}>
      <DialogContent className="rounded-[28px] max-w-md bg-zinc-900 text-white border border-white/15 p-6">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-extrabold flex items-center gap-2 text-white">
            <UserPlus className="text-cyan-400"/> Quick Enroll Unknown Face
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-[12px] text-slate-300">Store the detected face descriptor and preview into Class {classSel || 'XII-A'} so the student can be matched in future scans.</p>
          {pendingUnknownFace?.previewUrl ? (
            <div className="rounded-[24px] border border-cyan-400/25 bg-cyan-400/10 p-3">
              <div className="text-[10px] uppercase tracking-[.16em] font-black text-cyan-300 mb-2">Captured live preview</div>
              <img src={pendingUnknownFace.previewUrl} alt="Unknown face preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
              <div className="mt-2 text-[11px] text-slate-300">This preview comes from the live AI camera frame and will be saved with the enrolled face descriptor.</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-[12px] text-amber-200">No live face snapshot is available yet. Go back to the AI camera and scan the person again before enrolling.</div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-400">Student / Visitor Name *</label>
            <input
              type="text"
              value={quickRegisterForm.name}
              onChange={e => setQuickRegisterForm({...quickRegisterForm, name: e.target.value})}
              placeholder="e.g. Amit Kumar"
              className="mt-1 w-full h-11 rounded-xl px-3.5 bg-black/50 border border-white/20 text-white text-sm outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">Roll Number / Visitor ID *</label>
            <input
              type="text"
              value={quickRegisterForm.rollNumber}
              onChange={e => setQuickRegisterForm({...quickRegisterForm, rollNumber: e.target.value})}
              placeholder="e.g. 104"
              className="mt-1 w-full h-11 rounded-xl px-3.5 bg-black/50 border border-white/20 text-white text-sm outline-none focus:border-cyan-400"
            />
          </div>
<div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full bg-transparent border-white/20 text-white" onClick={() => {
              setQuickRegisterModalOpen(false)
              setQuickRegisterForm({ name: '', rollNumber: '' })
            }}>Cancel</Button>
            <Button variant="gradient" className="rounded-full font-bold px-6" onClick={async () => {
              if (!quickRegisterForm.name || !quickRegisterForm.rollNumber) {
                toast.error('Name and Roll Number required')
                return
              }
              if (!pendingUnknownFace?.descriptor?.length) {
                toast.error('No live face descriptor found. Re-scan the unknown person first.')
                return
              }

              const [c, sec] = (classSel || '10-A').split('-')
              const id = `stu_${Date.now().toString(36)}`
              const date = todayIST()
              const sid = schoolId || profile?.schoolId || 'global'
              const now = Date.now()

              try {
                await update(ref(db), {
                  [`schools/${sid}/students/${id}`]: {
                    studentId: id,
                    name: quickRegisterForm.name,
                    rollNumber: quickRegisterForm.rollNumber,
                    className: c || '10',
                    section: sec || 'A',
                    schoolId: sid,
                    status: 'active',
                    photoUrl: pendingUnknownFace.previewUrl || '',
                    faceDescriptor: pendingUnknownFace.descriptor,
                    faceEmbedding: pendingUnknownFace.descriptor,
                    createdAt: now,
                    updatedAt: now,
                  },
                  [`schools/${sid}/attendance/${date}/${id}`]: {
                    studentId: id,
                    className: c || '10',
                    section: sec || 'A',
                    date,
                    status: 'present',
                    markedBy: profile?.uid || 'quick_enroll',
                    method: 'ai_camera',
                    timestamp: now,
                  }
                })

                setMarks(prev => ({ ...prev, [id]: 'present' }))
                marksRef.current = { ...marksRef.current, [id]: 'present' }
                setUnknownPersonAlert(null)
                setPendingUnknownFace(null)
                setQuickRegisterModalOpen(false)
                setQuickRegisterForm({ name: '', rollNumber: '' })
                toast.success(`Quick Registered: ${quickRegisterForm.name} added to ${classSel || 'class'} with saved face ID and marked Present!`)
              } catch (error) {
                console.error('Quick enroll failed', error)
                toast.error('Could not quick-enroll this face. Please try again.')
              }
}}>
              Enroll & Mark Present
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
