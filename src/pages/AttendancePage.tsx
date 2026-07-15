import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { db } from '@/lib/firebase'
import { ref, onValue, update } from 'firebase/database'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import QRScanner from '@/components/QRScanner'
import PageHeader from '@/components/mobile/PageHeader'
import { Camera, BarChart3, QrCode, Users, X, ShieldCheck, SwitchCamera, ScanFace } from 'lucide-react'
import {
  detectFacesWithDescriptors,
  findBestFaceMatch,
  isValidDescriptor,
  mapBoxToCanvas,
  FACE_MATCH_THRESHOLD,
  type EnrolledFace,
  type LiveFaceDetection,
} from '@/lib/faceRecognition'

export default function AttendancePage(){
  const { profile } = useAuth()
  const { schoolId } = useSchool()
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [marks, setMarks] = useState<Record<string,string>>({})
  const [classSel, setClassSel] = useState('')
  const [aiScanning, setAiScanning] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [tab, setTab] = useState('manual')
  const [aiStatus, setAiStatus] = useState('Camera off')
  const [aiFaceCount, setAiFaceCount] = useState(0)
  const [aiLog, setAiLog] = useState<string[]>([])
  // Front (user) / Back (environment) — UI stays portrait/vertical only
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [switchingCamera, setSwitchingCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scanTimerRef = useRef<number | null>(null)
  const scanBusyRef = useRef(false)
  const detectedIdsRef = useRef<Set<string>>(new Set())
  const streamRef = useRef<MediaStream | null>(null)

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

  const submit = async (method: 'manual' | 'ai_camera' = 'manual')=>{
    if(!students.length){ toast.error(classSel ? `No students in ${classSel}` : 'Select a class first'); return }
    const date = todayIST()
    const sid = schoolId || profile?.schoolId || 'global'
    let present=0
    for(const s of students){
      // Manual: unmarked defaults to present. AI: only matched faces are present.
      const status = marks[s.id] || (method === 'manual' ? 'present' : 'absent')
      if(status==='present') present++
      await update(ref(db, `schools/${sid}/attendance/${date}/${s.id}`), {
        studentId: s.id,
        className: s.className,
        section: s.section,
        date,
        status,
        markedBy: profile?.uid,
        method,
        timestamp: Date.now()
      })
    }
    toast.success(`Attendance saved • Present ${present}/${students.length}`)
    try { navigator.vibrate?.(50) } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
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

  const drawDetections = (detections: LiveFaceDetection[], matchedByFace: Map<number, { id: string; name: string; confidence: number }>) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    resizeOverlayCanvas()
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = Math.max(3, canvas.width / 280)
    ctx.font = `600 ${Math.max(14, canvas.width / 42)}px Inter, system-ui, sans-serif`

    detections.forEach((d, index) => {
      const mapped = mapBoxToCanvas(d.box, video, canvas, 'cover')
      const match = matchedByFace.get(index)
      ctx.strokeStyle = match ? '#10b981' : '#f59e0b'
      ctx.fillStyle = match ? '#10b981' : '#f59e0b'
      ctx.strokeRect(mapped.x, mapped.y, mapped.width, mapped.height)
      const label = match
        ? `${match.name} ✓ ${Math.round(match.confidence * 100)}%`
        : 'Unknown person'
      const padX = 10
      const labelH = Math.max(24, canvas.height / 28)
      const labelW = Math.min(canvas.width - mapped.x, ctx.measureText(label).width + padX * 2)
      const labelY = Math.max(0, mapped.y - labelH)
      ctx.fillRect(mapped.x, labelY, labelW, labelH)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, mapped.x + padX, labelY + labelH * 0.72)
    })
  }

  const runAiScan = async ()=>{
    if(scanBusyRef.current || !videoRef.current) return
    if(!enrolledFaces.length){
      setAiStatus('Camera live • no Face IDs enrolled for this class')
      return
    }
    scanBusyRef.current = true
    try {
      const detections = await detectFacesWithDescriptors(videoRef.current)
      setAiFaceCount(detections.length)
      const matchedByFace = new Map<number, { id: string; name: string; confidence: number }>()
      let newMatches = 0
      let unknown = 0
      const usedIds = new Set<string>()

      detections.forEach((d, index) => {
        const best = findBestFaceMatch(d.descriptor, enrolledFaces)
        if(best && best.distance <= FACE_MATCH_THRESHOLD && !usedIds.has(best.id)) {
          usedIds.add(best.id)
          matchedByFace.set(index, { id: best.id, name: best.name, confidence: best.confidence })
          if(!detectedIdsRef.current.has(best.id)) {
            detectedIdsRef.current.add(best.id)
            newMatches++
            setMarks(prev => ({ ...prev, [best.id]: 'present' }))
            setAiLog(prev => [`${best.name} verified (${Math.round(best.confidence * 100)}% match)`, ...prev].slice(0, 10))
            try { navigator.vibrate?.(60) } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
          }
        } else {
          unknown++
        }
      })

      drawDetections(detections, matchedByFace)
      const verified = detectedIdsRef.current.size
      setAiStatus(
        detections.length
          ? `${verified}/${students.length} verified${unknown ? ` • ${unknown} unknown ignored` : ''}${newMatches ? ` • ${newMatches} new` : ''}`
          : `No face detected • ${verified}/${students.length} verified`
      )
    } catch(e:any) {
      setAiStatus(e?.message || 'AI face detection failed')
    } finally {
      scanBusyRef.current = false
    }
  }

  const attachStream = async (mode: 'user' | 'environment') => {
    streamRef.current?.getTracks().forEach(t=>t.stop())
    streamRef.current = null

    // Portrait/vertical UI always. Mode only switches front vs back lens.
    const tryConstraints: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { exact: mode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 0.5625 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      },
      {
        video: { facingMode: mode },
        audio: false,
      },
    ]

    let stream: MediaStream | null = null
    let lastError: any = null
    for (const constraints of tryConstraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        break
      } catch (e) {
        lastError = e
      }
    }
    if (!stream) throw lastError || new Error('Could not open camera')

    streamRef.current = stream
    if(videoRef.current){
      videoRef.current.srcObject = stream
      videoRef.current.setAttribute('playsinline', 'true')
      videoRef.current.muted = true
      // Front camera preview is often mirrored on phones; keep natural for face match
      videoRef.current.style.transform = 'none'
      await videoRef.current.play()
      await new Promise<void>((resolve) => {
        const v = videoRef.current!
        if (v.videoWidth) return resolve()
        const onReady = () => { v.removeEventListener('loadeddata', onReady); resolve() }
        v.addEventListener('loadeddata', onReady)
      })
      resizeOverlayCanvas()
    }
  }

  const enterFullscreen = async () => {
    const el = overlayRef.current || document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
    } catch {
      // Overlay is already fixed full-viewport even if Fullscreen API is blocked
    }
    // Keep portrait/vertical only — never landscape
    try {
      await (screen.orientation as any)?.lock?.('portrait').catch?.(()=>{})
    } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
  }

  const startAiCamera = async ()=>{
    if(!classSel){ toast.error('Add students first so a class is available'); return }
    if(!students.length){ toast.error(`No students in ${classSel}`); return }
    detectedIdsRef.current = new Set(Object.entries(marks).filter(([,v])=>v==='present').map(([id])=>id))
    setAiLog([])
    setAiFaceCount(0)
    setAiStatus('Opening full-screen camera…')
    setAiScanning(true)
    document.body.style.overflow = 'hidden'
    try {
      await new Promise<void>(resolve => requestAnimationFrame(()=>resolve()))
      await enterFullscreen()
      await attachStream(facingMode)
      if(!enrolledFaces.length) {
        setAiStatus('Camera active. Enroll Face IDs from Students → Update Photo before AI can verify.')
        toast.error('No Face IDs enrolled for this class. AI will not mark anyone randomly.')
        return
      }
      setAiStatus('Loading face recognition models…')
      await detectFacesWithDescriptors(videoRef.current!)
      setAiStatus(`AI camera active • ${facingMode === 'user' ? 'Front' : 'Back'} camera • portrait`)
      await runAiScan()
      scanTimerRef.current = window.setInterval(runAiScan, 1200)
    }catch(e:any){
      toast.error(e?.message || 'Camera permission denied')
      stopAi(false)
    }
  }

  
  /** Switch Front ↔ Back camera. Keeps portrait/vertical layout. */
  const switchCamera = async () => {
    if (switchingCamera || !aiScanning) return
    const next: 'user' | 'environment' = facingMode === 'environment' ? 'user' : 'environment'
    setSwitchingCamera(true)
    setAiStatus(`Switching to ${next === 'user' ? 'Front' : 'Back'} camera…`)
    try {
      await attachStream(next)
      setFacingMode(next)
      setAiStatus(`AI camera active • ${next === 'user' ? 'Front' : 'Back'} camera • portrait`)
      await runAiScan()
      try { navigator.vibrate?.(30) } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
    } catch (e: any) {
      toast.error(e?.message || `Could not open ${next === 'user' ? 'front' : 'back'} camera`)
      setAiStatus(`Still on ${facingMode === 'user' ? 'Front' : 'Back'} camera`)
    } finally {
      setSwitchingCamera(false)
    }
  }

  const stopAi = (exitFullscreen = true)=>{
    setAiScanning(false)
    setAiStatus('Camera off')
    setAiFaceCount(0)
    setSwitchingCamera(false)
    document.body.style.overflow = ''
    if(scanTimerRef.current){ window.clearInterval(scanTimerRef.current); scanTimerRef.current = null }
    streamRef.current?.getTracks().forEach(t=>t.stop())
    streamRef.current = null
    if(videoRef.current) videoRef.current.srcObject = null
    const ctx = canvasRef.current?.getContext('2d')
    if(ctx && canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
    if(exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(()=>{})
    }
    try { (screen.orientation as any)?.unlock?.() } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
  }

  const saveAiAttendance = async ()=>{
    await submit('ai_camera')
    stopAi()
  }
const handleQrScan = async (scannedText: string) => {
    const sid = schoolId || profile?.schoolId || 'global'
    const matchedStudent = allStudents.find((s: any) => s.id === scannedText || s.qrCode === scannedText)

    if (matchedStudent) {
      const date = todayIST()
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
      setMarks(prev => ({ ...prev, [matchedStudent.id]: 'present' }))
      toast.success(`Verified: ${matchedStudent.name} marked Present!`)
      setShowQrScanner(false)
      try { navigator.vibrate?.(100) } catch { /* Best-effort mobile enhancement; safe to ignore. */ }
    } else {
      toast.error(`Invalid QR: not found in your students list`)
    }
  }

  const presentCount = tab === 'ai'
    ? students.filter(s=>marks[s.id]==='present').length
    : students.filter(s=>(marks[s.id]||'present')==='present').length
  const absentCount = students.length - presentCount

  return <div className="page-container space-y-4">
    <PageHeader title="Attendance" subtitle={`Smart • QR • Real AI Camera • ${todayIST()}`} />
   <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TabsList className="attendance-tabs h-11 max-w-full overflow-x-auto scrollbar-hide rounded-full bg-slate-100 dark:bg-zinc-800 p-1">
          <TabsTrigger value="manual" className="shrink-0 rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900 px-3.5">
            <Users size={14} className="mr-1.5 inline"/> Manual
          </TabsTrigger>
          <TabsTrigger value="qr" className="shrink-0 rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900 px-3.5">
            <QrCode size={14} className="mr-1.5 inline"/> QR
          </TabsTrigger>
          <TabsTrigger value="ai" className="shrink-0 rounded-full px-3.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"><ScanFace size={14} className="mr-1.5 inline"/> AI Camera</TabsTrigger>
          <TabsTrigger value="analytics" className="shrink-0 rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-3.5"><BarChart3 size={14} className="mr-1.5 inline"/>Stats</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <select value={classSel} onChange={e=>setClassSel(e.target.value)} className="h-11 rounded-full px-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[13px] font-semibold">
            {!classOptions.length && <option value="">No classes yet</option>}
            {classOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="h-11 rounded-full px-4 bg-white dark:bg-zinc-900 border flex items-center text-[13px] font-medium">{new Date().toLocaleDateString('en-IN', { month:'short', day:'numeric', year:'numeric', timeZone:'Asia/Kolkata' })}</div>
        </div>
      </div>

      <TabsContent value="manual" className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center rounded-2xl"><div className="text-[11px] text-muted-foreground">Total</div><div className="text-[20px] font-bold">{students.length}</div></Card>
          <Card className="p-3 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"><div className="text-[11px] text-emerald-700 dark:text-emerald-300">Present</div><div className="text-[20px] font-bold text-emerald-600">{presentCount}</div></Card>
          <Card className="p-3 text-center rounded-2xl bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"><div className="text-[11px] text-red-700 dark:text-red-300">Absent</div><div className="text-[20px] font-bold text-red-600">{students.length - presentCount}</div></Card>
        </div>

        <div className="space-y-2.5">
          {students.map(s=>(
            <Card key={s.id} className="rounded-[18px] p-0 overflow-hidden">
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                    {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : (s.name?.[0]||'S')}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] leading-tight truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">Roll: {s.rollNumber || s.admissionNumber} • {s.className}-{s.section} • Face: {isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'No'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-full p-1">
                  <button onClick={()=>setMarks({...marks, [s.id]: 'present'})} className={`w-10 h-8 rounded-full text-[13px] font-bold transition ${ (marks[s.id]||'present')==='present' ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground'}`}>P</button>
                  <button onClick={()=>setMarks({...marks, [s.id]: 'absent'})} className={`w-10 h-8 rounded-full text-[13px] font-bold transition ${ marks[s.id]==='absent' ? 'bg-red-500 text-white shadow' : 'text-muted-foreground'}`}>A</button>
                </div>
              </div>
            </Card>
          ))}
          {!students.length && <Card className="p-10 text-center text-muted-foreground text-sm">{classOptions.length ? `No students in ${classSel}.` : 'No students yet. Add students from the Students page.'}</Card>}
        </div>
<div className="sticky bottom-[88px] md:bottom-6 z-20 pt-3">
          <Button onClick={()=>submit('manual')} variant="success" size="lg" className="w-full rounded-full h-14 text-[16px] shadow-[0_10px_30px_rgba(16,185,129,0.3)]" disabled={!students.length}>✓ SAVE ATTENDANCE • {presentCount}/{students.length} Present</Button>
        </div>
      </TabsContent>

      <TabsContent value="qr" className="mt-4 space-y-4">
        {!showQrScanner ? (
          <Card className="p-6 text-center space-y-4 rounded-[24px]">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center"><QrCode size={36} className="text-indigo-600"/></div>
            <div>
              <h3 className="font-bold text-[16px]">QR Code Entry Verification</h3>
              <p className="text-[13px] text-muted-foreground mt-1">Scan student QR cards at gate or classroom door to verify registration and auto mark present.</p>
            </div>
            <Button variant="gradient" size="lg" className="w-full rounded-full" onClick={()=>setShowQrScanner(true)} disabled={!allStudents.length}>Start QR Scanner</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <QRScanner onScan={handleQrScan} onClose={()=>setShowQrScanner(false)} />
            <Button variant="outline" className="w-full rounded-full h-12" onClick={()=>setShowQrScanner(false)}>Close Scanner</Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="ai" className="mt-4 space-y-4">
        <Card className="ai-camera-card overflow-hidden rounded-[26px]">
          <div className="flex items-center justify-between px-5 pt-5">
            <CardTitle className="flex items-center gap-2 p-0"><ScanFace size={18} className="text-emerald-400"/> AI Smart Camera</CardTitle>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"/> READY</span>
          </div>
          <CardContent className="space-y-4 pt-4">
            <div className="scanner-preview relative aspect-[4/3] overflow-hidden rounded-[22px] border border-emerald-300/20 bg-gradient-to-br from-[#15212a] via-[#111923] to-[#10131b] p-5">
              <div className="absolute inset-0 opacity-30" style={{backgroundImage:'radial-gradient(circle at 50% 35%, rgba(40,225,190,.18), transparent 38%), linear-gradient(rgba(70,230,210,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(70,230,210,.06) 1px, transparent 1px)', backgroundSize:'auto, 28px 28px, 28px 28px'}}/>
              <span className="scan-corner scan-corner-tl"/><span className="scan-corner scan-corner-tr"/><span className="scan-corner scan-corner-bl"/><span className="scan-corner scan-corner-br"/>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="relative grid h-20 w-20 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/[.06] text-emerald-300">
                  <span className="absolute inset-2 animate-ping rounded-full border border-emerald-300/10"/><ScanFace size={38}/>
                </div>
                <div className="mt-4 text-[14px] font-extrabold text-white">Face verification ready</div>
                <div className="mt-1 max-w-[250px] text-[10px] leading-relaxed text-slate-400">Only enrolled faces are matched. Unknown people are safely ignored.</div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/[.06] bg-black/25 px-3 py-2 backdrop-blur-md">
                <span className="text-[9px] text-slate-400">Face IDs • {classSel || 'No class'}</span>
                <span className="text-[10px] font-black text-emerald-300">{enrolledFaces.length}/{students.length} READY</span>
              </div>
            </div>
<div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-3 text-center"><div className="text-[18px] font-black">{students.length}</div><div className="text-[9px] text-slate-500">Students</div></div>
              <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[.035] p-3 text-center"><div className="text-[18px] font-black text-emerald-300">{enrolledFaces.length}</div><div className="text-[9px] text-slate-500">Face ready</div></div>
              <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[.035] p-3 text-center"><div className="text-[18px] font-black text-cyan-300">Live</div><div className="text-[9px] text-slate-500">Detection</div></div>
            </div>

            <Button variant="gradient" className="w-full rounded-full h-13 min-h-12 font-bold" onClick={startAiCamera} disabled={!students.length}>
              <Camera size={17} className="mr-2"/> Start Secure Face Scan
            </Button>
            <p className="flex gap-2 text-[10px] leading-relaxed text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400"/> Photos and Face IDs remain linked to authenticated school records. AI never invents attendance.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="analytics" className="mt-4">
        <Card className="p-6 rounded-[24px]">
          <CardTitle>Analytics</CardTitle>
          <CardContent className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Present Rate</span><b>{presentCount}/{students.length} ({students.length?Math.round(presentCount/students.length*100):0}%)</b></div>
            <div className="flex justify-between"><span>Absent Rate</span><b className="text-red-500">{absentCount}</b></div>
            <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width: `${students.length?presentCount/students.length*100:0}%`}} /></div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {aiScanning && (
      <div
        ref={overlayRef}
        id="ai-camera-overlay"
        className="fixed inset-0 z-[99999] bg-black text-white flex flex-col"
        style={{
          width: '100vw',
          height: '100dvh',
          maxHeight: '100dvh',
          // Portrait-only camera UI (no landscape layout)
          maxWidth: '100vw',
          overflow: 'hidden',
        }}
      >
        <div className="h-14 md:h-16 px-3 md:px-4 flex items-center justify-between bg-black/85 border-b border-white/10 shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="min-w-0">
            <div className="font-bold leading-tight truncate">AI Camera • {classSel}</div>
            <div className="text-[11px] md:text-[12px] text-white/70 truncate">{aiStatus} • Faces: {aiFaceCount}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
variant="ghost"
              className="rounded-full text-white hover:bg-white/10 px-3"
              onClick={switchCamera}
              disabled={switchingCamera}
              title="Switch Front / Back camera"
            >
              <SwitchCamera size={18} className="mr-1"/>
              {switchingCamera ? '…' : (facingMode === 'environment' ? 'Front' : 'Back')}
            </Button>
            <Button variant="ghost" className="rounded-full text-white hover:bg-white/10 px-3" onClick={()=>stopAi()}>
              <X size={18} className="mr-1"/> Close
            </Button>
          </div>
        </div>
<div className="scanner-stage relative flex-1 min-h-0 bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover bg-black"
            muted
            playsInline
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <div className="pointer-events-none absolute inset-x-[11%] top-[12%] h-[42%]">
            <span className="scan-corner scan-corner-tl"/><span className="scan-corner scan-corner-tr"/><span className="scan-corner scan-corner-bl"/><span className="scan-corner scan-corner-br"/>
          </div>

          {/* Portrait-only stacked panels (no horizontal split) */}
          <div className="absolute left-3 right-3 bottom-3 flex flex-col gap-2 pointer-events-none">
            <div className="rounded-2xl bg-black/65 backdrop-blur border border-white/10 p-3">
              <div className="text-[11px] text-white/70 mb-1">Verified students ({students.filter(s=>marks[s.id]==='present').length}/{students.length})</div>
              <div className="flex flex-wrap gap-2 max-h-16 overflow-auto">
                {students.filter(s=>marks[s.id]==='present').map(s=>(
                  <span key={s.id} className="verified-pop px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-semibold">✓ {s.name}</span>
                ))}
                {!students.filter(s=>marks[s.id]==='present').length && (
                  <span className="text-[12px] text-white/60">Point camera at enrolled students. Unknown faces are ignored.</span>
                )}
              </div>
            </div>
            {!!aiLog.length && (
              <div className="rounded-2xl bg-black/65 backdrop-blur border border-white/10 p-2.5 max-h-16 overflow-auto">
                <div className="space-y-0.5 text-[11px]">
                  {aiLog.slice(0, 3).map((l,i)=><div key={i}>✓ {l}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 grid grid-cols-2 gap-3 bg-black/95 border-t border-white/10 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" className="rounded-full h-12 bg-transparent border-white/30 text-white hover:bg-white/10" onClick={()=>stopAi()}>Stop</Button>
          <Button variant="success" className="rounded-full h-12" onClick={saveAiAttendance}>
            Save AI Attendance • {students.filter(s=>marks[s.id]==='present').length}/{students.length}
          </Button>
        </div>
      </div>
    )}
  </div>
}
