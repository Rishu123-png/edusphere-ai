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
import { Camera, BarChart3, QrCode, Users, X, ShieldCheck } from 'lucide-react'
import { detectFacesWithDescriptors, findBestFaceMatch, isValidDescriptor, type EnrolledFace } from '@/lib/faceRecognition'

const FACE_MATCH_THRESHOLD = 0.52
const DEFAULT_CLASSES = ['9-A', '9-B', '10-A', '10-B', '11-A', '12-C']

export default function AttendancePage(){
  const { profile } = useAuth()
  const { schoolId } = useSchool()
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [marks, setMarks] = useState<Record<string,string>>({})
  const [classSel, setClassSel] = useState('10-A')
  const [aiScanning, setAiScanning] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [tab, setTab] = useState('manual')
  const [aiStatus, setAiStatus] = useState('Camera off')
  const [aiFaceCount, setAiFaceCount] = useState(0)
  const [aiLog, setAiLog] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanTimerRef = useRef<number | null>(null)
  const scanBusyRef = useRef(false)
  const detectedIdsRef = useRef<Set<string>>(new Set())

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
    const fromStudents = Array.from(new Set(allStudents.map((s:any)=> `${s.className}-${s.section}`).filter(Boolean))).sort()
    return fromStudents.length ? fromStudents : DEFAULT_CLASSES
  }, [allStudents])

  useEffect(()=>{
    if (classOptions.length && !classOptions.includes(classSel)) setClassSel(classOptions[0])
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
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach(t=>t.stop())
    }
  }, [])

  const submit = async (method: 'manual' | 'ai_camera' = 'manual')=>{
    const date = todayIST()
    const sid = schoolId || profile?.schoolId || 'global'
    let present=0
    for(const s of students){
      // Manual mode keeps the common school workflow: unmarked students default to present.
      // AI camera mode is strict: only a real matched face is present; everyone else remains absent.
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
    try { navigator.vibrate?.(50) } catch {}
  }

  const drawDetections = (detections:any[], matchedIds:Set<string>) => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if(!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 4
    ctx.font = '24px Inter, system-ui, sans-serif'
    detections.forEach((d:any)=>{
      const box = d.detection?.box
      if(!box) return
      const descriptor = Array.from(d.descriptor || []) as number[]
      const best = findBestFaceMatch(descriptor, enrolledFaces)
      const matched = best && best.distance <= FACE_MATCH_THRESHOLD && matchedIds.has(best.id)
      ctx.strokeStyle = matched ? '#10b981' : '#f59e0b'
      ctx.fillStyle = matched ? '#10b981' : '#f59e0b'
      ctx.strokeRect(box.x, box.y, box.width, box.height)
      const label = matched && best ? `${best.name} ✓` : 'Unknown face'
      ctx.fillRect(box.x, Math.max(0, box.y - 32), Math.min(canvas.width - box.x, ctx.measureText(label).width + 18), 32)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, box.x + 8, Math.max(24, box.y - 9))
    })
  }

  const runAiScan = async ()=>{
    if(scanBusyRef.current || !videoRef.current) return
    if(!enrolledFaces.length){
      setAiStatus('Camera is live, but no student Face IDs are enrolled for this class.')
      return
    }
    scanBusyRef.current = true
    try {
      const detections = await detectFacesWithDescriptors(videoRef.current)
      setAiFaceCount(detections.length)
      const matchedThisFrame = new Set<string>()
      let newMatches = 0
      let unknown = 0

      for (const d of detections) {
        const descriptor = Array.from(d.descriptor || []) as number[]
        const best = findBestFaceMatch(descriptor, enrolledFaces)
        if(best && best.distance <= FACE_MATCH_THRESHOLD) {
          matchedThisFrame.add(best.id)
          if(!detectedIdsRef.current.has(best.id)) {
            detectedIdsRef.current.add(best.id)
            newMatches++
            setMarks(prev => ({ ...prev, [best.id]: 'present' }))
            setAiLog(prev => [`${best.name} verified (${Math.round((1-best.distance)*100)}% match)`, ...prev].slice(0, 8))
            try { navigator.vibrate?.(60) } catch {}
          }
        } else {
          unknown++
        }
      }

      drawDetections(detections, matchedThisFrame)
      const verified = detectedIdsRef.current.size
      setAiStatus(
        detections.length
          ? `${verified}/${students.length} verified${unknown ? ` • ${unknown} unknown face${unknown>1?'s':''} ignored` : ''}${newMatches ? ` • ${newMatches} new` : ''}`
          : `No face detected • ${verified}/${students.length} verified`
      )
    } catch(e:any) {
      setAiStatus(e?.message || 'AI face detection failed')
    } finally {
      scanBusyRef.current = false
    }
  }

  const startAiCamera = async ()=>{
    if(!students.length){ toast.error(`No students in ${classSel}`); return }
    detectedIdsRef.current = new Set(Object.entries(marks).filter(([,v])=>v==='present').map(([id])=>id))
    setAiLog([])
    setAiFaceCount(0)
    setAiStatus('Opening secure camera…')
    setAiScanning(true)
    try { await document.documentElement.requestFullscreen?.() } catch {}
    try{
      await new Promise<void>(resolve => requestAnimationFrame(()=>resolve()))
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      if(videoRef.current){
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if(!enrolledFaces.length) {
        setAiStatus('Camera active. Add Photo URL / Face ID in student profiles before AI can verify attendance.')
        toast.error('No Face IDs enrolled for this class. AI will not mark random attendance.')
        return
      }
      setAiStatus('Loading face recognition models…')
      await detectFacesWithDescriptors(videoRef.current!)
      setAiStatus('AI camera active • matching only enrolled student faces')
      await runAiScan()
      scanTimerRef.current = window.setInterval(runAiScan, 1400)
    }catch(e:any){
      toast.error(e?.message || 'Camera permission denied')
      stopAi(false)
    }
  }

  const stopAi = (exitFullscreen = true)=>{
    setAiScanning(false)
    setAiStatus('Camera off')
    setAiFaceCount(0)
    if(scanTimerRef.current){ window.clearInterval(scanTimerRef.current); scanTimerRef.current = null }
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach(t=>t.stop())
    if(videoRef.current) videoRef.current.srcObject = null
    const ctx = canvasRef.current?.getContext('2d')
    if(ctx && canvasRef.current) ctx.clearRect(0,0,canvasRef.current.width,canvasRef.current.height)
    if(exitFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(()=>{})
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
      try { navigator.vibrate?.(100) } catch {}
    } else {
      toast.error(`Invalid QR: "${scannedText.slice(0,20)}..." not found`)
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
        <TabsList className="h-11 rounded-full bg-slate-100 dark:bg-zinc-800 p-1">
          <TabsTrigger value="manual" className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900 px-4">
            <Users size={14} className="mr-1.5 inline"/> Manual
          </TabsTrigger>
          <TabsTrigger value="qr" className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900 px-4">
            <QrCode size={14} className="mr-1.5 inline"/> QR Code
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-full data-[state=active]:bg-emerald-500 data-[state=active]:text-white px-4">AI Attendance</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white px-4"><BarChart3 size={14} className="mr-1.5 inline"/>Analy</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <select value={classSel} onChange={e=>setClassSel(e.target.value)} className="h-11 rounded-full px-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[13px] font-semibold">
            {classOptions.map(opt => <option key={opt}>{opt}</option>)}
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
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shrink-0">{s.name?.[0]||'S'}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] leading-tight truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">Roll: {s.rollNumber || s.admissionNumber} • {s.className}-{s.section}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 rounded-full p-1">
                  <button onClick={()=>setMarks({...marks, [s.id]: 'present'})} className={`w-10 h-8 rounded-full text-[13px] font-bold transition ${ (marks[s.id]||'present')==='present' ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground'}`}>P</button>
                  <button onClick={()=>setMarks({...marks, [s.id]: 'absent'})} className={`w-10 h-8 rounded-full text-[13px] font-bold transition ${ marks[s.id]==='absent' ? 'bg-red-500 text-white shadow' : 'text-muted-foreground'}`}>A</button>
                </div>
              </div>
            </Card>
          ))}
          {!students.length && <Card className="p-10 text-center text-muted-foreground text-sm">No students in {classSel}. Add students from the Students page.</Card>}
        </div>

        <div className="sticky bottom-[88px] md:bottom-6 z-20 pt-3">
          <Button onClick={()=>submit('manual')} variant="success" size="lg" className="w-full rounded-full h-14 text-[16px] shadow-[0_10px_30px_rgba(16,185,129,0.3)]">✓ SAVE ATTENDANCE • {presentCount}/{students.length} Present</Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">Schedule enforced: teacher has 5 min window after class start. Late marking triggers admin notification.</p>
      </TabsContent>

      <TabsContent value="qr" className="mt-4 space-y-4">
        {!showQrScanner ? (
          <Card className="p-6 text-center space-y-4 rounded-[24px]">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center"><QrCode size={36} className="text-indigo-600"/></div>
            <div>
              <h3 className="font-bold text-[16px]">QR Code Entry Verification</h3>
              <p className="text-[13px] text-muted-foreground mt-1">Scan student QR cards at gate or classroom door to verify registration and auto mark present.</p>
            </div>
            <Button variant="gradient" size="lg" className="w-full rounded-full" onClick={()=>setShowQrScanner(true)}>Start QR Scanner</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <QRScanner onScan={handleQrScan} onClose={()=>setShowQrScanner(false)} />
            <Button variant="outline" className="w-full rounded-full h-12" onClick={()=>setShowQrScanner(false)}>Close Scanner</Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="ai" className="mt-4 space-y-4">
        <Card className="overflow-hidden rounded-[24px]">
          <CardTitle className="flex items-center gap-2"><Camera size={18}/> AI Camera Attendance</CardTitle>
          <CardContent className="space-y-4">
            <div className="aspect-video bg-slate-100 dark:bg-zinc-800 rounded-2xl flex flex-col items-center justify-center text-muted-foreground text-sm p-5 text-center">
              <ShieldCheck className="mb-2 text-emerald-600" />
              <b className="text-foreground">Real face matching only</b>
              <span>No random/demo attendance is generated. Students need a saved Face ID from their profile photo.</span>
              <span className="mt-2 text-[12px]">Face IDs in {classSel}: {enrolledFaces.length}/{students.length}</span>
            </div>
            <Button variant="gradient" className="w-full rounded-full h-12" onClick={startAiCamera}>Open Full Screen AI Camera</Button>
            <p className="text-[11px] text-muted-foreground">Tip: Add a clear Photo URL in Students page and generate Face ID. AI saves present only for matched enrolled faces.</p>
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
      <div id="ai-camera-overlay" className="fixed inset-0 z-[9999] bg-black text-white flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between bg-black/80 border-b border-white/10 shrink-0">
          <div>
            <div className="font-bold leading-tight">AI Camera • {classSel}</div>
            <div className="text-[12px] text-white/70">{aiStatus} • Faces now: {aiFaceCount}</div>
          </div>
          <Button variant="ghost" className="rounded-full text-white hover:bg-white/10" onClick={()=>stopAi()}><X size={18} className="mr-1"/>Close</Button>
        </div>
        <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-contain" muted playsInline autoPlay />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute left-3 right-3 bottom-3 grid md:grid-cols-[1fr_320px] gap-3 pointer-events-none">
            <div className="rounded-2xl bg-black/60 backdrop-blur border border-white/10 p-3">
              <div className="text-[12px] text-white/70 mb-1">Verified students</div>
              <div className="flex flex-wrap gap-2">
                {students.filter(s=>marks[s.id]==='present').map(s=><span key={s.id} className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[12px] font-semibold">{s.name}</span>)}
                {!students.filter(s=>marks[s.id]==='present').length && <span className="text-[12px] text-white/60">No verified faces yet.</span>}
              </div>
            </div>
            <div className="rounded-2xl bg-black/60 backdrop-blur border border-white/10 p-3 hidden md:block">
              <div className="text-[12px] text-white/70 mb-1">Live log</div>
              <div className="space-y-1 text-[12px] max-h-24 overflow-auto">
                {aiLog.map((l,i)=><div key={i}>✓ {l}</div>)}
                {!aiLog.length && <div className="text-white/60">Waiting for enrolled faces…</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 grid grid-cols-2 gap-3 bg-black/90 border-t border-white/10 shrink-0">
          <Button variant="outline" className="rounded-full h-12 bg-transparent border-white/30 text-white hover:bg-white/10" onClick={()=>stopAi()}>Stop</Button>
          <Button variant="success" className="rounded-full h-12" onClick={saveAiAttendance}>Save AI Attendance • {students.filter(s=>marks[s.id]==='present').length}/{students.length}</Button>
        </div>
      </div>
    )}
  </div>
}
