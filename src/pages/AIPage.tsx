import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { predictMarks, attendanceRisk, aiDailySummary, getStudentAIInsights } from '@/lib/ai'
import { useEffect, useMemo, useState, useRef } from 'react'
import PageHeader from '@/components/mobile/PageHeader'
import { Brain, AlertTriangle, Sparkles, RotateCcw, User, ChevronRight, TrendingUp, Award, CheckCircle, ShieldCheck } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import { animate, stagger } from 'animejs'

export default function AIPage(){
  const { schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, any>>({})
  const [marksData, setMarksData] = useState<Record<string, any>>({})
  const [tick, setTick] = useState(0)

  // Student specific selection
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')

  const studentDetailRef = useRef<HTMLDivElement>(null)

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

  const todayRecords = useMemo(()=> Object.values(attendance[todayIST()] || {}) as any[], [attendance])
  const present = todayRecords.filter((r:any)=>r.status==='present' || r.status==='late').length
  const absent = todayRecords.filter((r:any)=>r.status==='absent').length
  const late = todayRecords.filter((r:any)=>r.status==='late').length
  const attendancePct = students.length ? Math.round((present / students.length) * 1000) / 10 : 0

  const allMarksList = useMemo(()=>{
    const list: any[] = []
    Object.values(marksData || {}).forEach((byStudent:any)=>{
      Object.values(byStudent || {}).forEach((m:any)=> list.push(m))
    })
    return list
  }, [marksData])

  // Aggregate Class-Wise lists for dropdown options
  const classOptions = useMemo(()=>{
    return Array.from(new Set(students.map((s:any)=> `${s.className}-${s.section}`).filter(Boolean))).sort()
  }, [students])

  // Filtered students inside selected class
  const classStudents = useMemo(()=>{
    if (!selectedClass) return []
    return students.filter((s:any)=> `${s.className}-${s.section}` === selectedClass)
  }, [students, selectedClass])

  // Find selected student details
  const selectedStudent = useMemo(()=>{
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  // Get selected student's marks and attendance history
  const studentMarksList = useMemo(()=>{
    if(!selectedStudentId) return []
    return Object.values(marksData[selectedStudentId] || {}) as any[]
  }, [marksData, selectedStudentId])

  const studentAttendanceList = useMemo(()=>{
    if(!selectedStudentId) return []
    const list: any[] = []
    Object.entries(attendance).forEach(([date, dayRecords]: [string, any]) => {
      if (dayRecords && dayRecords[selectedStudentId]) {
        list.push({ date, ...dayRecords[selectedStudentId] })
      }
    })
    return list
  }, [attendance, selectedStudentId])

  // Run dynamic student AI calculation using our robust mathematical algorithm!
  const studentAIResult = useMemo(()=>{
    if (!selectedStudentId) return null
    return getStudentAIInsights(selectedStudentId, studentAttendanceList, studentMarksList)
  }, [selectedStudentId, studentMarksList, studentAttendanceList])

  // Attendance risk for selected student specifically
  const studentRiskResult = useMemo(()=>{
    if(!selectedStudentId) return null
    return attendanceRisk(studentAttendanceList.map(r => ({ status: r.status, date: r.date || todayIST() })) as any)
  }, [selectedStudentId, studentAttendanceList])

  // Default aggregate predictor for high-level dashboard
  const pred = useMemo(()=>{
    const recent = allMarksList.slice(-20).map((m:any)=>({
      marksObtained: Number(m.marksObtained)||0,
      maxMarks: Number(m.maxMarks)||100,
    }))
    return predictMarks(recent as any, attendancePct || 75)
  }, [allMarksList, attendancePct])

  // Default school overall attendance risk
  const overallRisk = useMemo(()=>{
    const records = Object.values(attendance).flatMap((day:any)=> Object.values(day || {})) as any[]
    return attendanceRisk(records.map((r:any)=>({ status: r.status, date: r.date || todayIST() })) as any)
  }, [attendance])

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

  // Anime.js interaction triggering on student select
  useEffect(() => {
    if (selectedStudentId && studentDetailRef.current) {
      animate(studentDetailRef.current.querySelectorAll('.animate-ai-item'), {
        opacity: [0, 1],
        translateY: [15, 0],
        scale: [0.98, 1],
        duration: 400,
        delay: stagger(45),
        ease: 'outQuad'
      })
    }
  }, [selectedStudentId, tick])

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="AI Intelligence" subtitle="Dynamic predictive marks, attendance risk patterns, and individual recommendations" />

    {/* Class & Student Dropdown Selector for personalized insights */}
    <Card className="rounded-[24px] border border-indigo-100 dark:border-indigo-900/30 overflow-hidden bg-white dark:bg-zinc-900/90 shadow-sm">
      <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-violet-50/30 dark:from-indigo-950/20 dark:to-zinc-900/40 border-b border-indigo-100/40 dark:border-indigo-950/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-[14px] text-indigo-900 dark:text-indigo-200">Individual Student Analyzer</h3>
        </div>
        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full dark:bg-indigo-950 dark:text-indigo-300">Predictive</span>
      </div>
      <CardContent className="p-4 grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Select Class</label>
          <select 
            value={selectedClass} 
            onChange={e => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}
            className="w-full h-11 rounded-full px-4 bg-slate-50 dark:bg-zinc-800 border border-slate-150 dark:border-zinc-700 text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition"
          >
            <option value="">-- Choose Class --</option>
            {classOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Select Student</label>
          <select 
            value={selectedStudentId} 
            disabled={!selectedClass}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full h-11 rounded-full px-4 bg-slate-50 dark:bg-zinc-800 border border-slate-150 dark:border-zinc-700 text-[13px] font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:opacity-50"
          >
            <option value="">-- Choose Student --</option>
            {classStudents.map((s:any) => <option key={s.id} value={s.id}>{s.name} (Roll {s.rollNumber || 'N/A'})</option>)}
          </select>
        </div>
      </CardContent>
    </Card>

    {/* PERSOANLIZED STUDENT AI DISPLAY */}
    {selectedStudentId && selectedStudent && studentAIResult ? (
      <div ref={studentDetailRef} className="space-y-4">
        <div className="p-4 rounded-2xl bg-indigo-600 text-white flex items-center gap-3.5 shadow-md animate-ai-item">
          <div className="w-12 h-12 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-lg text-white">
            {selectedStudent.name?.[0] || 'S'}
          </div>
          <div>
            <h3 className="font-extrabold text-[16px] leading-tight">{selectedStudent.name}</h3>
            <p className="text-white/80 text-[11px] mt-0.5">
              Roll Number {selectedStudent.rollNumber || 'N/A'} • Section {selectedStudent.className}-{selectedStudent.section}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {/* Marks Prediction Card */}
          <Card className="rounded-[24px] overflow-hidden border border-indigo-100 dark:border-indigo-900/30 animate-ai-item">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardTitle className="flex items-center gap-2 pt-3.5"><TrendingUp size={16} className="text-indigo-600 dark:text-indigo-400" /> Projected Performance</CardTitle>
            <CardContent className="pt-2">
              <div className="text-[34px] font-extrabold tracking-tight leading-none text-indigo-600 dark:text-indigo-400">
                {studentAIResult.prediction.predicted}%
              </div>
              <div className="text-[12px] text-muted-foreground mt-2">
                Expected Grade: <b className="text-foreground dark:text-white">{studentAIResult.prediction.grade}</b>
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                Pass Probability: <b className="text-emerald-500">{(studentAIResult.prediction.passProb * 100).toFixed(0)}%</b>
              </div>
              <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-[12px]">
                <div className="font-semibold text-foreground mb-1">Calculation Details:</div>
                • Average Score: {studentAIResult.averageMarks}%<br />
                • History Records: {studentMarksList.length} exams<br />
                • Attendance Factor: {studentAIResult.attendancePct}%
              </div>
            </CardContent>
          </Card>

          {/* Attendance Risk Card */}
          <Card className="rounded-[24px] overflow-hidden border border-amber-100 dark:border-amber-900/30 animate-ai-item">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardTitle className="flex items-center gap-2 pt-3.5"><AlertTriangle size={16} className="text-amber-500" /> Attendance Risk</CardTitle>
            <CardContent className="pt-2">
              {studentRiskResult ? (
                <>
                  <div className={`text-[28px] font-extrabold tracking-tight leading-none ${studentRiskResult.risk === 'high' ? 'text-red-500' : studentRiskResult.risk === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {studentRiskResult.risk.toUpperCase()} RISK
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1.5">
                    Irregularity Probability: <b>{(studentRiskResult.probability * 100).toFixed(0)}%</b>
                  </div>
                  <div className="mt-3.5 space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">AI Identified Patterns:</span>
                    <ul className="text-[12px] text-muted-foreground space-y-1">
                      {studentRiskResult.reasons.map((r, idx) => (
                        <li key={idx} className="flex gap-1.5"><ChevronRight size={12} className="shrink-0 mt-0.5 text-amber-500" /> {r}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">Insufficient attendance history to compute personal risk trends.</p>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendation Card */}
          <Card className="rounded-[24px] overflow-hidden border border-emerald-100 dark:border-emerald-900/30 animate-ai-item">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardTitle className="flex items-center gap-2 pt-3.5"><Sparkles size={16} className="text-emerald-600" /> Actionable Advice</CardTitle>
            <CardContent className="pt-2">
              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[13px] leading-relaxed font-semibold">
                "{studentAIResult.recommendation}"
              </div>
              <div className="mt-4 text-[12px] text-muted-foreground space-y-1">
                <span className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">Subject Performance:</span>
                {studentMarksList.length ? (
                  studentMarksList.slice(0, 3).map((m, idx) => (
                    <div key={idx} className="flex justify-between py-0.5 border-b border-slate-50 dark:border-zinc-800">
                      <span>{m.subject} ({m.examType.replace('_',' ')})</span>
                      <b className="text-foreground dark:text-zinc-200">{m.marksObtained}/{m.maxMarks}</b>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] italic">No exam entries recorded yet. Enter marks to generate detailed subject breakdowns.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ) : selectedStudentId ? (
      <Card className="rounded-[24px] p-6 text-center text-muted-foreground text-sm">
        Computing predictive details for selected student...
      </Card>
    ) : null}

    {/* OVERALL SCHOOL AI COGNITIVE STATISTICS OVERVIEW */}
    <div className="grid lg:grid-cols-3 gap-3">
      <Card className="rounded-[24px] overflow-hidden border-indigo-100 dark:border-indigo-900/30">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-600" />
        <CardTitle className="flex items-center gap-2"><Brain size={18} className="text-indigo-600"/> School Average Prediction</CardTitle>
        <CardContent>
          {allMarksList.length ? (
            <>
              <div className="text-[36px] font-extrabold tracking-tight leading-none">{pred.predicted}%</div>
              <div className="text-[13px] text-muted-foreground mt-2">Grade: <b className="text-foreground">{pred.grade}</b> • Pass Rate: {(pred.passProb*100).toFixed(0)}%</div>
              <ul className="text-[13px] mt-4 space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800">
                <li>Based on {allMarksList.length} published marks records</li>
                <li>School attendance average: {attendancePct}%</li>
                <li>Calculated from authenticated school data only</li>
              </ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800">
              No marks published yet. Save marks on the Marks page to trigger real predictive model scoring.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500"/> School Attendance Risk</CardTitle>
        <CardContent>
          {Object.keys(attendance).length ? (
            <>
              <div className={`text-[28px] font-extrabold tracking-tight ${overallRisk.risk==='high'?'text-red-500': overallRisk.risk==='medium'?'text-amber-500':'text-emerald-500'}`}>{overallRisk.risk.toUpperCase()} • {(overallRisk.probability*100).toFixed(0)}%</div>
              <ul className="text-[13px] mt-3 list-disc pl-4 text-muted-foreground space-y-1">{overallRisk.reasons.map(r=><li key={r}>{r}</li>)}</ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground">No attendance history yet. Mark attendance to compute risk matrices.</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-black text-white border-0">
        <CardTitle className="text-white flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-400" /> AI School Snapshot</CardTitle>
        <CardContent className="text-[13px] space-y-2.5 text-zinc-300">
          <p className="flex justify-between"><span>Registered Students</span><b className="text-white">{students.length}</b></p>
          <p className="flex justify-between"><span>Present Today</span><b className="text-emerald-400">{present}</b></p>
          <p className="flex justify-between"><span>Absent Today</span><b className="text-red-300">{absent}</b></p>
          <p className="p-2 rounded-xl bg-white/10 mt-1">Total Published Exam Entries: {allMarksList.length}</p>
        </CardContent>
      </Card>
    </div>

    {/* AI DAILY SUMMARY */}
    <Card className="rounded-[24px]">
      <div className="flex items-center justify-between pr-5">
        <CardTitle className="flex items-center gap-2"><Sparkles size={18}/> AI Daily School Summary</CardTitle>
        <Button variant="outline" size="sm" className="rounded-full h-8" onClick={()=>setTick(t=>t+1)}><RotateCcw size={14} className="mr-1"/> Refresh</Button>
      </div>
      <CardContent className="grid md:grid-cols-2 gap-4 text-[13px] leading-relaxed mt-2">
        <div className="space-y-2">
          {summary.map((line,i)=><p key={i}>• {line}</p>)}
        </div>
        <div className="space-y-2 text-muted-foreground">
          <p>• Analytics: Scored using real historical databases</p>
          <p>• Verified biometric matches can be taken from the Attendance AI Camera page</p>
          <p>• Predictions update in real time when new marks are published</p>
        </div>
      </CardContent>
    </Card>
  </div>
}
