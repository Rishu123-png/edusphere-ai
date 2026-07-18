
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
import ModuleArchitectureBanner from '@/components/ModuleArchitectureBanner'
import { Camera, QrCode, Users, X, ShieldCheck, SwitchCamera, ScanFace, AlertTriangle, Clock, Wifi, WifiOff, UserPlus, Grid, Volume2 } from 'lucide-react'
import {
  detectFacesWithDescriptors,
  findBestFaceMatch,
  isValidDescriptor,
  mapBoxToCanvas,
  FACE_MATCH_THRESHOLD,
  type EnrolledFace,
  type LiveFaceDetection,
} from '@/lib/faceRecognition'
import { saveToOfflineQueue } from '@/lib/offlineSync'

const AI_SCAN_INTERVAL_MS = 850
const AI_DETECTION_TIMEOUT_MS = 4500
const REQUIRED_CONFIRM_FRAMES = 3
const AI_MARK_COOLDOWN_MS = 60_000
const LIVENESS_HISTORY_LIMIT = 6

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

  const laserOffsetRef = useRef(0)
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

  const classOptions = useMemo(()=>{
    return Array.from(new Set(allStudents.map((s:any)=> `${s.className}-${s.section}`).filter(Boolean))).sort()
  }, [allStudents])

  useEffect(()=>{
    if (!classSel && classOptions.length) setClassSel(classOptions[0])
    if (classSel && classOptions.length && !classOptions.includes(classSel)) setClassSel(classOptions[0])
  }, [classOptions, classSel])

  const students = useMemo(
    () => allStudents.filter((s:any)=> `${s.className}-${s.section}`===classSel),
    [allStudents, classSel]
  )

  const enrolledFaces = useMemo<EnrolledFace[]>(()=> students
    .filter((s:any)=> isValidDescriptor(s.faceDescriptor))
    .map((s:any)=> ({ id: s.id, name: s.name || 'Student', descriptor: s.faceDescriptor })), [students])

  useEffect(()=>{
    return ()=>{
      if(scanTimerRef.current) window.clearInterval(scanTimerRef.current)
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

    const faceLargeEnough = area >= 0.018
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

    if (isOfflineMode) {
      const offlineRecs = students.map(s => ({
        id: `${s.id}_${date}`,
        schoolId: sid,
        date,
        studentId: s.id,
        className: s.className,
        section: s.section,
        status: (marks[s.id] || (method === 'manual' ? 'present' : 'absent')) as any,
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
      const status = marks[student.id] || (method === 'manual' ? 'present' : 'absent')
      if (status === 'present' || status === 'late') present++
      updates[`schools/${sid}/attendance/${date}/${student.id}`] = {
        studentId: student.id,
        className: student.className,
        section: student.section,
        date,
        status,
        markedBy: profile?.uid,
        method,
        timestamp: now,
      }
    }

    await update(ref(db), updates)
    toast.success(`Attendance saved to Firebase • Present/Late ${present}/${students.length}`)
  }

  const resizeOverlayCanvas = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    const rect = video.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }

  const drawDetections = (detections: LiveFaceDetection[], matchedByFace: Map<number, { id: string; name: string; confidence: number; isLate?: boolean; status?: 'verified' | 'checking' | 'cooldown' }>) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    resizeOverlayCanvas()
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    laserOffsetRef.current = (laserOffsetRef.current + 4) % (canvas.height || 480)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, laserOffsetRef.current)
    ctx.lineTo(canvas.width, laserOffsetRef.current)
    ctx.stroke()

    ctx.lineWidth = Math.max(3, canvas.width / 260)
    ctx.font = `700 ${Math.max(14, canvas.width / 38)}px Inter, system-ui, sans-serif`

    detections.forEach((d, index) => {
      const mapped = mapBoxToCanvas(d.box, video, canvas, cameraFit)
      const match = matchedByFace.get(index)

      if (match?.status === 'checking') {
        ctx.strokeStyle = '#22d3ee'
        ctx.fillStyle = '#22d3ee'
        ctx.shadowColor = 'rgba(34, 211, 238, 0.8)'
      } else if (match?.status === 'cooldown') {
        ctx.strokeStyle = '#a78bfa'
        ctx.fillStyle = '#a78bfa'
        ctx.shadowColor = 'rgba(167, 139, 250, 0.8)'
      } else if (match) {
        ctx.strokeStyle = match.isLate ? '#f59e0b' : '#10b981'
        ctx.fillStyle = match.isLate ? '#f59e0b' : '#10b981'
        ctx.shadowColor = match.isLate ? 'rgba(245, 158, 11, 0.8)' : 'rgba(16, 185, 129, 0.8)'
      } else {
        ctx.strokeStyle = '#f43f5e'
        ctx.fillStyle = '#f43f5e'
        ctx.shadowColor = 'rgba(244, 63, 94, 0.8)'
      }
ctx.shadowBlur = 15

      ctx.strokeRect(mapped.x, mapped.y, mapped.width, mapped.height)

      ctx.shadowBlur = 0
      ctx.fillStyle = '#00e5ff'
      const centerX = mapped.x + mapped.width / 2
      const centerY = mapped.y + mapped.height / 2
      ctx.beginPath()
      ctx.arc(centerX - mapped.width * 0.2, centerY - mapped.height * 0.15, 4, 0, Math.PI * 2)
      ctx.arc(centerX + mapped.width * 0.2, centerY - mapped.height * 0.15, 4, 0, Math.PI * 2)
      ctx.arc(centerX, centerY + mapped.height * 0.2, 5, 0, Math.PI * 2)
      ctx.fill()

      const label = match
        ? match.status === 'checking'
          ? `${match.name} • checking liveness ${Math.round(match.confidence * 100)}%`
          : match.status === 'cooldown'
            ? `${match.name} • already marked`
            : `${match.name} • Verified • ${Math.round(match.confidence * 100)}%`
        : 'Unknown Person • Register?'
      const padX = 12
      const labelH = Math.max(26, canvas.height / 26)
      const labelW = Math.min(canvas.width - mapped.x, ctx.measureText(label).width + padX * 2)
      const labelY = Math.max(0, mapped.y - labelH)

      ctx.fillRect(mapped.x, labelY, labelW, labelH)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, mapped.x + padX, labelY + labelH * 0.72)
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

   