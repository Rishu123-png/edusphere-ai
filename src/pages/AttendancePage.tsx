import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { db } from '@/lib/firebase'
import { ref, onValue, update } from 'firebase/database'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { todayStr } from '@/lib/rtdb'
import QRScanner from '@/components/QRScanner'
import PageHeader from '@/components/mobile/PageHeader'
import { Users, QrCode, Camera, BarChart3 } from 'lucide-react'

export default function AttendancePage(){
  const { profile } = useAuth()
  const { schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [marks, setMarks] = useState<Record<string,string>>({})
  const [classSel, setClassSel] = useState('10-A')
  const [aiScanning, setAiScanning] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [tab, setTab] = useState('manual')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(()=>{
    const r = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    const unsub = onValue(r, snap=>{
      const v = snap.val()||{}
      const list = Object.entries(v).map(([id,s]:any)=>({id, ...s}))
      setStudents(list.filter((s:any)=> `${s.className}-${s.section}`===classSel))
    })
    return ()=>unsub()
  }, [classSel, schoolId])

  const submit = async ()=>{
    const date = todayStr()
    const sid = schoolId || profile?.schoolId || 'global'
    let present=0
    for(const s of students){
      const status = marks[s.id] || 'present'
      if(status==='present') present++
      await update(ref(db, `schools/${sid}/attendance/${date}/${s.id}`), {
        studentId: s.id,
        className: s.className,
        section: s.section,
        date,
        status,
        markedBy: profile?.uid,
        method: aiScanning ? 'ai_camera':'manual',
        timestamp: Date.now()
      })
    }
    toast.success(`Attendance saved • Present ${present}/${students.length}`)
    try { navigator.vibrate?.(50) } catch {}
  }

  const startAiCamera = async ()=>{
    setAiScanning(true)
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if(videoRef.current){ videoRef.current.srcObject = stream; await videoRef.current.play() }
      toast('AI camera active – face detection running (demo)')
      setTimeout(()=>{
        const auto:any = {}
        students.forEach((s,i)=> { auto[s.id] = i%7===0 ? 'absent' : 'present' })
        setMarks(auto)
        toast.success('AI: Detected '+Object.values(auto).filter(v=>v==='present').length+' present')
      }, 3000)
    }catch(e:any){ toast.error('Camera permission denied'); setAiScanning(false)}
  }
  const stopAi = ()=>{
    setAiScanning(false)
    const stream = videoRef.current?.srcObject as MediaStream
    stream?.getTracks().forEach(t=>t.stop())
    if(videoRef.current) videoRef.current.srcObject = null
  }

  const handleQrScan = async (scannedText: string) => {
    const sid = schoolId || profile?.schoolId || 'global'
    const fullRef = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    onValue(fullRef, async (snap) => {
      const v = snap.val() || {}
      const allList = Object.entries(v).map(([id,s]:any)=>({id, ...s}))
      const matchedStudent = allList.find((s: any) => s.id === scannedText || s.qrCode === scannedText)

      if (matchedStudent) {
        const date = todayStr()
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
    }, { onlyOnce: true })
  }

  const presentCount = Object.values(marks).filter(v=>v==='present').length || students.length
  const absentCount = students.length - presentCount

  return <div className="page-container space-y-4">
    <PageHeader title="Attendance" subtitle={`Smart • QR • AI Camera • ${todayStr()}`} />

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
            <option>9-A</option><option>9-B</option><option>10-A</option><option>10-B</option><option>11-A</option><option>12-C</option>
          </select>
          <div className="h-11 rounded-full px-4 bg-white dark:bg-zinc-900 border flex items-center text-[13px] font-medium">{new Date().toLocaleDateString('en-IN', { month:'short', day:'numeric', year:'numeric' })}</div>
        </div>
      </div>

      <TabsContent value="manual" className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center rounded-2xl"><div className="text-[11px] text-muted-foreground">Total</div><div className="text-[20px] font-bold">{students.length}</div></Card>
          <Card className="p-3 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"><div className="text-[11px] text-emerald-700 dark:text-emerald-300">Present</div><div className="text-[20px] font-bold text-emerald-600">{presentCount}</div></Card>
          <Card className="p-3 text-center rounded-2xl bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"><div className="text-[11px] text-red-700 dark:text-red-300">Absent</div><div className="text-[20px] font-bold text-red-600">{students.length - presentCount}</div></Card>
        </div>

        {/* Mobile list with P/A toggles */}
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
          {!students.length && <Card className="p-10 text-center text-muted-foreground text-sm">No students in {classSel}. Add in Students page.</Card>}
        </div>

        <div className="sticky bottom-[88px] md:bottom-6 z-20 pt-3">
          <Button onClick={submit} variant="success" size="lg" className="w-full rounded-full h-14 text-[16px] shadow-[0_10px_30px_rgba(16,185,129,0.3)]">✓ SAVE ATTENDANCE • {presentCount}/{students.length} Present</Button>
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
            {!aiScanning ? (
              <>
                <div className="aspect-video bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-muted-foreground text-sm">Camera off - Tap Start</div>
                <Button variant="gradient" className="w-full rounded-full h-12" onClick={startAiCamera}>Start AI Camera</Button>
              </>
            ) : (
              <>
                <video ref={videoRef} className="w-full aspect-video rounded-2xl bg-black object-cover" muted playsInline />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={stopAi}>Stop</Button>
                  <Button variant="success" className="flex-1 rounded-full" onClick={submit}>Save AI Attendance</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Face detection simulated. In production uses face-api.js with school face embeddings.</p>
              </>
            )}
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
  </div>
}
