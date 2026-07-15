import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/mobile/PageHeader'
import NeonGauge from '@/components/mobile/NeonGauge'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'
import { predictMarks } from '@/lib/ai'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { AlertTriangle, Award, Bell, BookOpen, CalendarCheck, ChevronRight, FileText, ShieldCheck, Sparkles, TrendingUp, UserRound } from 'lucide-react'

const statusTone = (status: string) => {
  if (status === 'present') return 'bg-emerald-400/10 text-emerald-300 border-emerald-300/15'
  if (status === 'late') return 'bg-amber-400/10 text-amber-300 border-amber-300/15'
  if (status === 'absent') return 'bg-rose-400/10 text-rose-300 border-rose-300/15'
  if (['leave', 'half_day', 'medical_leave'].includes(status)) return 'bg-blue-400/10 text-blue-300 border-blue-300/15'
  return 'bg-white/[.04] text-slate-400 border-white/[.07]'
}

export default function ParentPortalPage(){
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, any>>({})
  const [marksData, setMarksData] = useState<Record<string, any>>({})
  const [selectedChildId, setSelectedChildId] = useState('')

  useEffect(()=>{
    if(!schoolId){ setStudents([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/students`), snap=>{
      const value = snap.val() || {}
      setStudents(Object.entries(value).map(([id, student]:any)=>({id, ...student})))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setAttendance({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), snap=> setAttendance(snap.val() || {}))
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setMarksData({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), snap=> setMarksData(snap.val() || {}))
    return ()=>unsub()
  }, [schoolId])

  // Parent records are linked only through authenticated guardian identifiers.
  const linkedStudents = useMemo(()=>{
    const phone = (profile as any)?.phone || ''
    const email = String(profile?.email || '').toLowerCase()
    const uid = profile?.uid || ''
    const digits = (value: unknown) => String(value || '').replace(/\D/g,'')
    return students.filter((student:any)=>{
      if (uid && (student.parentUid === uid || student.guardianUid === uid)) return true
      if (phone && student.guardianPhone && digits(student.guardianPhone) === digits(phone)) return true
      if (email && student.guardianEmail && String(student.guardianEmail).toLowerCase() === email) return true
      return false
    })
  }, [students, profile])

  useEffect(() => {
    if (!linkedStudents.length) { setSelectedChildId(''); return }
    if (!linkedStudents.some(student => student.id === selectedChildId)) setSelectedChildId(linkedStudents[0].id)
  }, [linkedStudents, selectedChildId])

  const child = linkedStudents.find(student => student.id === selectedChildId) || linkedStudents[0]

  const childRecords = useMemo(()=>{
    if(!child) return []
    return Object.entries(attendance).flatMap(([date, day]: [string, any]) =>
      Object.values(day || {})
        .filter((record:any)=>record.studentId === child.id)
        .map((record:any)=>({ date, ...record }))
    ) as any[]
  }, [attendance, child])

  const childMarks = useMemo(() => {
    if (!child) return []
    return (Object.values(marksData[child.id] || {}) as any[])
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
  }, [marksData, child])

  const presentLike = childRecords.filter((record:any)=>['present','late'].includes(record.status)).length
  const attendancePct = childRecords.length ? Math.round((presentLike / childRecords.length) * 1000) / 10 : 0
  const absents = childRecords.filter((record:any)=>record.status==='absent').length
  const todayStatus = child ? (attendance[todayIST()]?.[child.id]?.status || 'not_marked') : 'not_marked'

  const prediction = useMemo(() => {
    if (!childMarks.length) return null
    return predictMarks(childMarks.map((mark:any) => ({
      marksObtained: Number(mark.marksObtained) || 0,
      maxMarks: Number(mark.maxMarks) || 100,
    })) as any, attendancePct || 75)
  }, [childMarks, attendancePct])

  const subjectScores = useMemo(() => {
    const latest = new Map<string, any>()
    childMarks.forEach((mark:any) => {
      const subject = String(mark.subject || 'Subject')
      if (!latest.has(subject)) latest.set(subject, mark)
    })
    return Array.from(latest.entries()).map(([subject, mark]) => ({
      subject,
      score: Math.round((Number(mark.marksObtained) || 0) / (Number(mark.maxMarks) || 100) * 100),
      grade: mark.grade || '—',
    })).slice(0, 5)
  }, [childMarks])

  const recentAttendance = useMemo(() => childRecords
    .slice()
    .sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date)))
    .slice(0, 7), [childRecords])

  return <div className="page-container parent-portal space-y-4">
    <PageHeader title="Parent Portal" subtitle="A clear, live view of your child's progress" action={
      <Link to="/notifications" aria-label="Parent notifications" className="mobile-icon-button grid h-10 w-10 place-items-center rounded-full"><Bell size={17}/></Link>
    } />

    {!child ? (
      <Card className="overflow-hidden rounded-[26px] p-8 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-cyan-300/15 bg-gradient-to-br from-cyan-400/10 to-violet-500/10 text-cyan-300"><UserRound size={34}/></div>
        <h2 className="mt-5 text-[18px] font-extrabold">Link your child</h2>
        <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-muted-foreground">No student record matches this account. Ask the school admin to add your login email or phone as the guardian contact on the student profile.</p>
        <div className="mt-5 rounded-2xl border border-white/[.06] bg-white/[.025] p-3 text-[10px] text-muted-foreground"><ShieldCheck size={14} className="mr-1 inline text-emerald-400"/> Only authenticated guardian matches can view student data.</div>
      </Card>
    ) : (
      <>
        <section className="parent-hero relative overflow-hidden rounded-[28px] p-[1px]">
          <div className="relative overflow-hidden rounded-[27px] bg-[#0e1520] p-4 text-white">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"/>
            <div className="relative flex items-center gap-3">
              <div className="grid h-14 w-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] shrink-0 relative place-items-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-[20px] font-black text-cyan-100">
                {child.photoUrl ? <img src={child.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover"/> : (child.name?.[0] || 'S')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-cyan-300/70"><Sparkles size={11}/> Live student profile</div>
                <h2 className="mt-1 truncate text-[18px] font-extrabold">{child.name}</h2>
                <p className="mt-0.5 text-[10px] text-slate-400">Class {child.className}-{child.section} • Roll {child.rollNumber || child.admissionNumber || '—'}</p>
              </div>
              {linkedStudents.length > 1 && (
                <select aria-label="Select child" value={child.id} onChange={event=>setSelectedChildId(event.target.value)} className="h-9 max-w-[100px] rounded-full border border-white/10 bg-white/5 px-2 text-[10px]">
                  {linkedStudents.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              )}
            </div>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/[.06] bg-white/[.03] p-3"><div className="text-[9px] text-slate-500">Today</div><div className={`mt-1 truncate text-[12px] font-black capitalize ${todayStatus==='present'?'text-emerald-300':todayStatus==='absent'?'text-rose-300':'text-amber-300'}`}>{todayStatus.replace('_',' ')}</div></div>
              <div className="rounded-2xl border border-white/[.06] bg-white/[.03] p-3"><div className="text-[9px] text-slate-500">Attendance</div><div className="mt-1 text-[16px] font-black text-cyan-300">{childRecords.length ? `${attendancePct}%` : '—'}</div></div>
              <div className="rounded-2xl border border-white/[.06] bg-white/[.03] p-3"><div className="text-[9px] text-slate-500">Forecast</div><div className="mt-1 text-[16px] font-black text-violet-300">{prediction ? prediction.grade : '—'}</div></div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="rounded-[24px] md:col-span-1">
            <CardTitle className="flex items-center gap-2"><CalendarCheck size={17} className="text-emerald-400"/> Attendance</CardTitle>
            <CardContent className="pt-0">
              <NeonGauge value={attendancePct} size={214} label="Attendance Rate" caption={`${presentLike} present • ${absents} absent`} />
              <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {recentAttendance.length ? recentAttendance.map((record:any)=><div key={`${record.date}-${record.studentId}`} className={`min-w-[46px] rounded-xl border p-2 text-center ${statusTone(record.status)}`}><div className="text-[8px] opacity-70">{new Date(`${record.date}T00:00:00`).toLocaleDateString('en-IN',{weekday:'short'})}</div><div className="mt-1 text-[10px] font-black uppercase">{String(record.status).slice(0,1)}</div></div>) : <div className="text-[11px] text-muted-foreground">No attendance history yet.</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] md:col-span-2">
            <div className="flex items-center justify-between pr-5"><CardTitle className="flex items-center gap-2"><BookOpen size={17} className="text-cyan-300"/> Subject performance</CardTitle><span className="pt-5 text-[9px] uppercase tracking-wider text-muted-foreground">Latest</span></div>
            <CardContent className="space-y-3">
              {subjectScores.length ? subjectScores.map(item=><div key={item.subject}>
                <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{item.subject}</span><span className="font-bold">{item.score}% • {item.grade}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[.055]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 transition-all duration-1000" style={{width:`${item.score}%`}}/></div>
              </div>) : <div className="py-8 text-center text-[12px] text-muted-foreground">No marks have been published yet.</div>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="rounded-[24px] overflow-hidden">
            <CardTitle className="flex items-center gap-2"><TrendingUp size={17} className="text-violet-300"/> AI performance forecast</CardTitle>
            <CardContent>
              {prediction ? <div className="flex items-end justify-between gap-3"><div><div className="text-[34px] font-black tracking-tight text-gradient-ai">{prediction.predicted}%</div><div className="mt-1 text-[11px] text-muted-foreground">Predicted grade {prediction.grade} • Pass probability {Math.round(prediction.passProb*100)}%</div></div><Award className="mb-1 text-violet-300" size={34}/></div> : <p className="text-[12px] text-muted-foreground">Publish marks to unlock a data-backed performance forecast.</p>}
            </CardContent>
          </Card>
          <Card className={`rounded-[24px] ${attendancePct && attendancePct < 75 ? 'border-amber-300/15' : ''}`}>
            <CardTitle className="flex items-center gap-2">{attendancePct && attendancePct < 75 ? <AlertTriangle size={17} className="text-amber-300"/> : <ShieldCheck size={17} className="text-emerald-300"/>} Parent actions</CardTitle>
            <CardContent className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">{attendancePct && attendancePct < 75 ? 'Attendance is below the recommended 75%. Contact the class teacher and review recent absences.' : 'Attendance is currently in a healthy range. Continue monitoring new marks and school alerts.'}</p>
              <Button variant="gradient" size="sm" className="w-full rounded-full" onClick={()=>toast('Leave request workflow is ready for school-admin integration.')}><FileText size={14} className="mr-1.5"/> Apply for leave</Button>
            </CardContent>
          </Card>
        </div>

        <Link to="/notifications" className="block">
          <Card className="rounded-[22px]">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><Bell size={17}/></span>
              <div className="min-w-0 flex-1"><div className="text-[12px] font-bold">School updates</div><div className="text-[10px] text-muted-foreground">Attendance, marks and teacher alerts appear in Notifications.</div></div>
              <ChevronRight size={16} className="text-muted-foreground"/>
            </CardContent>
          </Card>
        </Link>
      </>
    )}
  </div>
}
