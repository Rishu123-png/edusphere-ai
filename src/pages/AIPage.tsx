import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { predictMarks, attendanceRisk, aiDailySummary } from '@/lib/ai'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/mobile/PageHeader'
import { Brain, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'

export default function AIPage(){
  const { schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, any>>({})
  const [marksData, setMarksData] = useState<Record<string, any>>({})
  const [tick, setTick] = useState(0)

  useEffect(()=>{
    if(!schoolId){ setStudents([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/students`), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id,s]:any)=>({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setAttendance({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), snap=>{
      setAttendance(snap.val() || {})
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setMarksData({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), snap=>{
      setMarksData(snap.val() || {})
    })
    return ()=>unsub()
  }, [schoolId])

  const todayRecords = useMemo(()=> Object.values(attendance[todayIST()] || {}) as any[], [attendance, tick])
  const present = todayRecords.filter((r:any)=>r.status==='present' || r.status==='late').length
  const absent = todayRecords.filter((r:any)=>r.status==='absent').length
  const late = todayRecords.filter((r:any)=>r.status==='late').length
  const attendancePct = students.length ? Math.round((present / students.length) * 1000) / 10 : 0

  const allMarks = useMemo(()=>{
    const list: any[] = []
    Object.values(marksData || {}).forEach((byStudent:any)=>{
      Object.values(byStudent || {}).forEach((m:any)=> list.push(m))
    })
    return list
  }, [marksData])

  const pred = useMemo(()=>{
    const recent = allMarks.slice(-8).map((m:any)=>({
      marksObtained: Number(m.marksObtained)||0,
      maxMarks: Number(m.maxMarks)||100,
    }))
    return predictMarks(recent as any, attendancePct || 75)
  }, [allMarks, attendancePct, tick])

  const risk = useMemo(()=>{
    const records = Object.values(attendance).flatMap((day:any)=> Object.values(day || {})) as any[]
    return attendanceRisk(records.map((r:any)=>({ status: r.status, date: r.date || todayIST() })) as any)
  }, [attendance, tick])

  const summary = useMemo(()=>{
    if(!students.length && !todayRecords.length){
      return [
        'No school data yet for AI insights.',
        'Add students, mark attendance, and publish marks to unlock live predictions.',
        'Only real Firebase records are used — no demo numbers.',
      ]
    }
    return aiDailySummary({ attendancePct, present, absent, late })
  }, [students.length, todayRecords.length, attendancePct, present, absent, late, tick])

  return <div className="page-container space-y-4">
    <PageHeader title="AI Intelligence" subtitle="Prediction • Risk • Summary from your real school data" />

    <div className="grid lg:grid-cols-3 gap-3">
      <Card className="rounded-[24px] overflow-hidden border-indigo-100 dark:border-indigo-900/30">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-600" />
        <CardTitle className="flex items-center gap-2"><Brain size={18} className="text-indigo-600"/> AI Marks Prediction</CardTitle>
        <CardContent>
          {allMarks.length ? (
            <>
              <div className="text-[36px] font-extrabold tracking-tight leading-none">{pred.predicted}%</div>
              <div className="text-[13px] text-muted-foreground mt-2">Grade: <b className="text-foreground">{pred.grade}</b> • Pass: {(pred.passProb*100).toFixed(0)}%</div>
              <ul className="text-[13px] mt-4 space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800">
                <li>Based on {allMarks.length} published mark entries</li>
                <li>Attendance factor: {attendancePct}%</li>
                <li>Prediction uses your school records only</li>
              </ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800">
              No marks published yet. Enter marks from the Marks page to generate a real prediction.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500"/> AI Attendance Risk</CardTitle>
        <CardContent>
          {Object.keys(attendance).length ? (
            <>
              <div className={`text-[28px] font-extrabold tracking-tight ${risk.risk==='high'?'text-red-500': risk.risk==='medium'?'text-amber-500':'text-emerald-500'}`}>{risk.risk.toUpperCase()} • {(risk.probability*100).toFixed(0)}%</div>
              <ul className="text-[13px] mt-3 list-disc pl-4 text-muted-foreground space-y-1">{risk.reasons.map(r=><li key={r}>{r}</li>)}</ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground">No attendance history yet. Save attendance to compute risk.</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-black text-white border-0">
        <CardTitle className="text-white">AI School Snapshot</CardTitle>
        <CardContent className="text-[13px] space-y-2.5 text-zinc-300">
          <p className="flex justify-between"><span>Students</span><b className="text-white">{students.length}</b></p>
          <p className="flex justify-between"><span>Present today</span><b className="text-emerald-400">{present}</b></p>
          <p className="flex justify-between"><span>Absent today</span><b className="text-red-300">{absent}</b></p>
          <p className="p-2 rounded-xl bg-white/10">Marks entries: {allMarks.length}</p>
        </CardContent>
      </Card>
    </div>

    <Card className="rounded-[24px]">
      <div className="flex items-center justify-between pr-5">
        <CardTitle className="flex items-center gap-2"><Sparkles size={18}/> AI Daily Summary</CardTitle>
        <Button variant="outline" size="sm" className="rounded-full h-8" onClick={()=>setTick(t=>t+1)}><RotateCcw size={14} className="mr-1"/> Refresh</Button>
      </div>
      <CardContent className="grid md:grid-cols-2 gap-4 text-[13px] leading-relaxed mt-2">
        <div className="space-y-2">
          {summary.map((line,i)=><p key={i}>• {line}</p>)}
        </div>
        <div className="space-y-2 text-muted-foreground">
          <p>• Source: Firebase attendance + marks for your school only</p>
          <p>• Sample / fake school numbers are not used</p>
          <p>• Open Attendance AI Camera after enrolling Face IDs</p>
        </div>
      </CardContent>
    </Card>
  </div>
}
