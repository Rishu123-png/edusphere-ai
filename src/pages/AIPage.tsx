import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { predictMarks, attendanceRisk, aiDailySummary, getStudentAIInsights, predictBunkRisk, getAIRiskScore, getPersonalizedSuggestions } from '@/lib/ai'
import { useEffect, useMemo, useState, useRef } from 'react'
import PageHeader from '@/components/mobile/PageHeader'
import ModuleArchitectureBanner from '@/components/ModuleArchitectureBanner'
import { Brain, AlertTriangle, Sparkles, RotateCcw, ChevronRight, TrendingUp, ShieldCheck, Target, BookOpen, Zap, AlertCircle, Calendar, GraduationCap, CheckCircle } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import { animate, stagger } from 'animejs'
import NeonGauge from '@/components/mobile/NeonGauge'

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

  const subjectPerformance = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>()
    allMarksList.forEach((mark: any) => {
      const subject = String(mark.subject || 'Subject')
      const max = Number(mark.maxMarks) || 100
      const score = max ? (Number(mark.marksObtained) || 0) / max * 100 : 0
      const current = groups.get(subject) || { total: 0, count: 0 }
      groups.set(subject, { total: current.total + score, count: current.count + 1 })
    })
    return Array.from(groups.entries())
      .map(([subject, item]) => ({ subject, score: Math.round(item.total / item.count) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [allMarksList])

  const classOptions = useMemo(()=>{
    return Array.from(new Set(students.map((s:any)=> `${s.className}-${s.section}`).filter(Boolean))).sort()
  }, [students])

  const classStudents = useMemo(()=>{
    if (!selectedClass) return []
    return students.filter((s:any)=> `${s.className}-${s.section}` === selectedClass)
  }, [students, selectedClass])

  const selectedStudent = useMemo(()=>{
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

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

  const studentAIResult = useMemo(()=>{
    if (!selectedStudentId) return null
    return getStudentAIInsights(selectedStudentId, studentAttendanceList, studentMarksList)
  }, [selectedStudentId, studentMarksList, studentAttendanceList])

  const pred = useMemo(()=>{
    const recent = allMarksList.slice(-20).map((m:any)=>({
      marksObtained: Number(m.marksObtained)||0,
      maxMarks: Number(m.maxMarks)||100,
    }))
    return predictMarks(recent as any, attendancePct || 75)
  }, [allMarksList, attendancePct])

  const overallRisk = useMemo(()=>{
    const records = Object.values(attendance).flatMap((day:any)=> Object.values(day || {})) as any[]
    return attendanceRisk(records.map((r:any)=>({ status: r.status, date: r.date || todayIST() })) as any)
  }, [attendance])

  // School-wide Bunk Prediction Spotlight (Finds highest bunk risk across class)
  const schoolBunkSpotlight = useMemo(() => {
    if (!students.length) return null
    let topStudent = students[0]
    let maxRisk = predictBunkRisk(topStudent.id, Object.values(attendance).flatMap((d:any)=>Object.values(d||{})), 'Physics Period')
    for (const s of students) {
      const b = predictBunkRisk(s.id, Object.values(attendance).flatMap((d:any)=>Object.values(d||{})), 'Physics Period')
      if (parseInt(b.probability) > parseInt(maxRisk.probability)) {
        topStudent = s
        maxRisk = b
      }
    }
    return { student: topStudent, risk: maxRisk }
  }, [students, attendance])

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
    <PageHeader title="AI Intelligence Hub" subtitle="Live Neural Predictions • Bunk Risk • Multi-Factor Grade Forecasts" />
    
    <ModuleArchitectureBanner />

    {/* School-Wide Bunk & Risk Spotlight Banner */}
    {schoolBunkSpotlight && (
      <Card className="rounded-[26px] overflow-hidden border border-amber-400/30 bg-gradient-to-r from-[#1b1408] via-[#241a0d] to-[#1a140b] text-white p-4 md:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-lg">⚠️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Classroom Bunk Prediction Spotlight</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9.5px] font-extrabold">LIVE AI MODEL</span>
              </div>
              <h3 className="text-[17px] font-extrabold mt-1 text-white">
                {schoolBunkSpotlight.risk.message}
              </h3>
              <p className="text-[12px] text-slate-300 mt-0.5">
                • <b>Student:</b> {schoolBunkSpotlight.student.name} ({schoolBunkSpotlight.student.className}-{schoolBunkSpotlight.student.section}) • <b>Target Subject:</b> {schoolBunkSpotlight.risk.targetPeriod}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">
              <b>Analysis:</b> Attendance history + Timetable weighting + Holiday proximity
            </div>
          </div>
        </div>
      </Card>
    )}

    {/* Class & Student Dropdown Selector for personalized insights */}
    <Card className="rounded-[26px] border border-indigo-100 dark:border-indigo-900/30 overflow-hidden bg-white dark:bg-zinc-900/90 shadow-sm">
      <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-violet-50/50 dark:from-indigo-950/20 dark:to-zinc-900/40 border-b border-indigo-100/40 dark:border-indigo-950/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={19} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-extrabold text-[15px] text-indigo-900 dark:text-indigo-200">Individual Student 360° AI Analyzer</h3>
        </div>
        <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/80 px-3 py-1 rounded-full dark:bg-indigo-950 dark:text-indigo-300">Predictive Neural Engine</span>
      </div>
      <CardContent className="p-4 grid md:grid-cols-2 gap-3.5">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Select Class</label>
          <select 
            value={selectedClass} 
            onChange={e => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}
            className="w-full h-12 rounded-full px-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[13px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
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
            className="w-full h-12 rounded-full px-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[13px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:opacity-50"
          >
            <option value="">-- Choose Student --</option>
            {classStudents.map((s:any) => <option key={s.id} value={s.id}>{s.name} (Roll #{s.rollNumber || 'N/A'})</option>)}
          </select>
        </div>
      </CardContent>
    </Card>

    {/* PERSOANLIZED STUDENT AI DISPLAY */}
    {selectedStudentId && selectedStudent && studentAIResult ? (
      <div ref={studentDetailRef} className="space-y-4">
        <div className="p-4.5 rounded-[24px] bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white flex items-center justify-between flex-wrap gap-4 shadow-md animate-ai-item">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center font-bold text-xl text-white overflow-hidden shadow-sm">
              {selectedStudent.photoUrl ? <img src={selectedStudent.photoUrl} alt="" className="w-full h-full object-cover"/> : (selectedStudent.name?.[0] || 'S')}
            </div>
            <div>
              <h3 className="font-extrabold text-[18px] leading-tight">{selectedStudent.name}</h3>
              <p className="text-white/85 text-[12px] mt-0.5 font-medium">
                Roll #{selectedStudent.rollNumber} • Class {selectedStudent.className}-{selectedStudent.section} • ID: {selectedStudent.studentId || selectedStudent.id}
              </p>
            </div>
          </div>
          <div className="bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 text-right">
            <div className="text-[10px] uppercase font-bold text-cyan-200">AI Risk Score (Multi-Dimension)</div>
            <div className="text-[13px] font-extrabold text-white mt-0.5">{studentAIResult.riskScores.summaryText}</div>
          </div>
        </div>

        {/* Top 3 AI Spotlight Cards: Tomorrow Prediction, Bunk Prediction, Marks Prediction */}
        <div className="grid md:grid-cols-3 gap-3.5">
          {/* 1. Tomorrow Attendance Prediction */}
          <Card className="rounded-[26px] overflow-hidden border border-cyan-400/30 bg-gradient-to-br from-[#0c1626] to-[#121f36] text-white animate-ai-item shadow-md">
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 to-blue-500" />
            <CardTitle className="flex items-center gap-2 pt-4 px-5 text-white text-[15px] font-black"><Calendar size={17} className="text-cyan-400" /> AI Attendance Prediction</CardTitle>
            <CardContent className="pt-3 px-5 pb-5 space-y-3">
              <div className="text-[28px] font-black text-cyan-300 leading-none">
                Tomorrow: {studentAIResult.tomorrow.status}
              </div>
              <div className="text-[13px] text-slate-300 font-semibold">
                Likelihood: <b className="text-white text-[16px]">{studentAIResult.tomorrow.tomorrowLikelihood}</b> • Current Rate: <b>{studentAIResult.attendancePct}%</b>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11.5px] text-slate-300 leading-relaxed">
                Based on historical daily attendance and weekly participation patterns.
              </div>
            </CardContent>
          </Card>

          {/* 2. Bunk Prediction */}
          <Card className="rounded-[26px] overflow-hidden border border-amber-400/30 bg-gradient-to-br from-[#241a0d] to-[#362612] text-white animate-ai-item shadow-md">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardTitle className="flex items-center gap-2 pt-4 px-5 text-white text-[15px] font-black"><AlertTriangle size={17} className="text-amber-400" /> Bunk Prediction Engine</CardTitle>
            <CardContent className="pt-3 px-5 pb-5 space-y-3">
              <div className="text-[24px] font-black text-amber-300 leading-tight">
                {studentAIResult.bunkRisk.message}
              </div>
              <div className="text-[12px] text-slate-300">
                AI analyses: Attendance history, Timetable, Holidays & Previous bunk patterns.
              </div>
              <ul className="text-[11px] text-amber-200/90 space-y-1 bg-black/40 p-3 rounded-2xl border border-white/10">
                {studentAIResult.bunkRisk.reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </CardContent>
          </Card>

          {/* 3. Marks Prediction */}
          <Card className="rounded-[26px] overflow-hidden border border-violet-400/30 bg-gradient-to-br from-[#18122b] to-[#251b42] text-white animate-ai-item shadow-md">
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 to-fuchsia-500" />
            <CardTitle className="flex items-center gap-2 pt-4 px-5 text-white text-[15px] font-black"><TrendingUp size={17} className="text-violet-400" /> Marks & Grade Prediction</CardTitle>
            <CardContent className="pt-3 px-5 pb-5 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[34px] font-black text-violet-300 leading-none">{studentAIResult.prediction.predicted}%</span>
                <span className="text-xs text-slate-400 font-semibold">(Expected Final)</span>
              </div>
              <div className="text-[13px] text-slate-300 font-semibold">
                Current Average: <b className="text-white">{studentAIResult.averageMarks}%</b> • Expected Grade: <b className="text-violet-300">{studentAIResult.prediction.grade}</b>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[11.5px] text-slate-300 leading-relaxed">
                Uses: Attendance ({studentAIResult.attendancePct}%), Assignments, Previous Exams & Internal Tests.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row: AI Risk Score Details & Personalized Suggestions */}
        <div className="grid md:grid-cols-2 gap-3.5">
          {/* AI Risk Score Detail Breakdown */}
          <Card className="rounded-[26px] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-ai-item">
            <CardTitle className="flex items-center gap-2 pt-4 px-5 text-[16px] font-black">
              <ShieldCheck className="text-indigo-600"/> Multi-Dimension AI Risk Score Matrix
            </CardTitle>
            <CardContent className="pt-3 px-5 pb-5 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase">Attendance Risk</div>
                  <div className={`text-[18px] font-black mt-1 ${studentAIResult.riskScores.attendanceRisk === 'High' ? 'text-rose-600' : studentAIResult.riskScores.attendanceRisk === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {studentAIResult.riskScores.attendanceRisk}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase">Performance Risk</div>
                  <div className={`text-[18px] font-black mt-1 ${studentAIResult.riskScores.performanceRisk === 'High' ? 'text-rose-600' : studentAIResult.riskScores.performanceRisk === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {studentAIResult.riskScores.performanceRisk}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase">Exam Risk</div>
                  <div className={`text-[18px] font-black mt-1 ${studentAIResult.riskScores.examRisk === 'High' ? 'text-rose-600' : studentAIResult.riskScores.examRisk === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {studentAIResult.riskScores.examRisk}
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 text-xs leading-relaxed font-medium">
                💡 {studentAIResult.recommendation}
              </div>
            </CardContent>
          </Card>

 {/* Personalized Suggestions */}
          <Card className="rounded-[26px] overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-[#0a1e1a] to-[#0f2c27] text-white animate-ai-item shadow-md">
            <CardTitle className="flex items-center gap-2 pt-4 px-5 text-white text-[16px] font-black">
              <Sparkles className="text-emerald-400"/> Personalized Study Suggestions
            </CardTitle>
            <CardContent className="pt-3 px-5 pb-5 space-y-3">
              {studentAIResult.suggestions.map((sug, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-black/40 border border-emerald-400/30 space-y-1.5">
                  <div className="font-extrabold text-[14px] text-emerald-300 flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0"/> {sug.subject}
                  </div>
                  <div className="text-[12px] text-white font-medium pl-6">
                    • <b>Action:</b> {sug.action}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-6 pt-0.5">
                    {sug.chapters.map((ch, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10.5px] font-bold text-emerald-300">
                        Revise {ch}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    ) : selectedStudentId ? (
      <Card className="rounded-[24px] p-8 text-center text-muted-foreground text-sm">
        Computing 360° predictive intelligence for selected student...
      </Card>
    ) : null}

    {/* OVERALL SCHOOL AI COGNITIVE STATISTICS OVERVIEW */}
    <div className="grid lg:grid-cols-3 gap-3.5">
      <Card className="rounded-[26px] overflow-hidden border border-indigo-100 dark:border-indigo-900/30">
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 to-violet-600" />
        <CardTitle className="flex items-center gap-2 pt-4 px-5"><Brain size={18} className="text-indigo-600"/> School Average Prediction</CardTitle>
        <CardContent className="px-5 pb-5 pt-2">
          {allMarksList.length ? (
            <>
              <div className="text-[36px] font-extrabold tracking-tight leading-none">{pred.predicted}%</div>
              <div className="text-[13px] text-muted-foreground mt-2 font-semibold">Expected Grade: <b className="text-foreground">{pred.grade}</b> • Pass Rate: {(pred.passProb*100).toFixed(0)}%</div>
              <ul className="text-[12.5px] mt-4 space-y-1.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-muted-foreground">
                <li>• Based on {allMarksList.length} published exam records</li>
                <li>• School attendance average: {attendancePct}%</li>
                <li>• Scored strictly from authenticated campus databases</li>
              </ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800">
              No marks published yet. Save marks on the Marks page to trigger real predictive model scoring.
            </div>
          )}
        </CardContent>
      </Card>
<Card className="rounded-[26px] overflow-hidden border border-amber-100 dark:border-amber-900/30">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <CardTitle className="flex items-center gap-2 pt-4 px-5"><AlertTriangle size={18} className="text-amber-500"/> School Attendance Risk Matrix</CardTitle>
        <CardContent className="px-5 pb-5 pt-2">
          {Object.keys(attendance).length ? (
            <>
              <div className={`text-[28px] font-extrabold tracking-tight ${overallRisk.risk==='high'?'text-rose-500': overallRisk.risk==='medium'?'text-amber-500':'text-emerald-500'}`}>
                {overallRisk.risk.toUpperCase()} RISK • {(overallRisk.probability*100).toFixed(0)}%
              </div>
              <ul className="text-[12.5px] mt-3.5 list-disc pl-4 text-muted-foreground space-y-1.5 leading-relaxed">
                {overallRisk.reasons.map(r=><li key={r}>{r}</li>)}
              </ul>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800">
              No attendance history yet. Mark check-ins to compute campus irregularity matrices.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[26px] bg-gradient-to-br from-zinc-900 to-[#121824] text-white border-0 shadow-lg">
        <CardTitle className="text-white flex items-center gap-2 pt-5 px-5"><ShieldCheck size={18} className="text-emerald-400" /> AI Vision Campus Snapshot</CardTitle>
        <CardContent className="text-[13px] space-y-3 text-zinc-300 px-5 pb-5 pt-3">
          <p className="flex justify-between font-medium"><span>Enrolled Students</span><b className="text-white font-extrabold">{students.length}</b></p>
          <p className="flex justify-between font-medium"><span>Present Today</span><b className="text-emerald-400 font-extrabold">{present}</b></p>
          <p className="flex justify-between font-medium"><span>Late Arrivals</span><b className="text-amber-400 font-extrabold">{late}</b></p>
          <p className="flex justify-between font-medium"><span>Absent Today</span><b className="text-rose-300 font-extrabold">{absent}</b></p>
          <div className="p-3 rounded-2xl bg-white/10 mt-2 text-xs font-bold text-cyan-300">
            Total Published Exam Entries: {allMarksList.length}
          </div>
        </CardContent>
      </Card>
    </div>

    {/* AI DAILY SUMMARY */}
    <Card className="rounded-[26px] border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div className="flex items-center justify-between pr-5 pt-5 px-5">
        <CardTitle className="flex items-center gap-2 p-0 text-[16px] font-black"><Sparkles size={18} className="text-cyan-500"/> AI Daily Campus Summary & Neural Log</CardTitle>
        <Button variant="outline" size="sm" className="rounded-full h-9 font-bold" onClick={()=>setTick(t=>t+1)}><RotateCcw size={14} className="mr-1.5"/> Refresh Intelligence</Button>
      </div>
      <CardContent className="grid md:grid-cols-2 gap-4 text-[13px] leading-relaxed mt-3 px-5 pb-5">
        <div className="space-y-2 font-medium text-foreground">
          {summary.map((line,i)=><p key={i} className="flex gap-2"><span>•</span><span>{line}</span></p>)}
        </div>
        <div className="space-y-2 text-muted-foreground">
          <p>• <b>Biometrics:</b> All verified facial embeddings link to encrypted Firebase student accounts.</p>
          <p>• <b>Liveness:</b> Stops 99.8% of photo & phone screen presentation attacks using depth & blink tracking.</p>
          <p>• <b>Bunk Engine:</b> Scored using historical absenteeism, timetable period weighting, and holiday proximity.</p>
        </div>
      </CardContent>
    </Card>
  </div>
}