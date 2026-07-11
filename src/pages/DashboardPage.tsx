import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { aiDailySummary } from '@/lib/ai'
import { todayIST } from '@/lib/rtdb'
import { Users, GraduationCap, CheckCircle2, Clock3, AlertTriangle, Sparkles, TrendingUp, Award, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'

const dateKey = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const dayLabel = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })

export default function DashboardPage(){
  const { profile } = useAuth()
  const { school, schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, Record<string, any>>>({})

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=>({ id, ...s })))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/teachers` : 'users'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, t]:any)=>({ uid: t.uid || id, id, ...t }))
        .filter((t:any)=> schoolId ? true : t.role === 'teacher')
      setTeachers(list)
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

  const studentMap = useMemo(()=> new Map(students.map((s:any)=>[s.id, s])), [students])
  const todayRecords = useMemo(()=> Object.values(attendance[todayIST()] || {}), [attendance])

  const counts = useMemo(()=>{
    const presentRecords = todayRecords.filter((r:any)=>r.status === 'present')
    const lateRecords = todayRecords.filter((r:any)=>r.status === 'late')
    const absentRecords = todayRecords.filter((r:any)=>r.status === 'absent')
    const leaveRecords = todayRecords.filter((r:any)=>['leave','half_day','medical_leave'].includes(r.status))
    const presentPct = students.length ? Math.round((presentRecords.length / students.length) * 1000) / 10 : 0
    const newEnrollments = students.filter((s:any)=> s.createdAt && s.createdAt >= Date.now() - 30 * 86400000).length

    let atRisk = 0
    for (const s of students) {
      const records = Object.values(attendance).flatMap((day:any)=> Object.values(day || {}).filter((r:any)=>r.studentId === s.id))
      if(records.length >= 5) {
        const presentLike = records.filter((r:any)=>['present','late'].includes(r.status)).length
        if(presentLike / records.length < 0.75) atRisk++
      }
    }

    return {
      students: students.length,
      teachers: teachers.length,
      teachersOnline: teachers.filter((t:any)=>t.isOnline).length,
      present: presentPct,
      presentCount: presentRecords.length,
      absent: absentRecords.length,
      late: lateRecords.length,
      leave: leaveRecords.length,
      newEnrollments,
      atRisk,
    }
  }, [students, teachers, todayRecords, attendance])

  const trend = useMemo(()=> Array.from({length: 6}, (_,i)=>5-i).map(daysAgo=>{
    const key = dateKey(daysAgo)
    const records = Object.values(attendance[key] || {})
    const present = records.length ? Math.round(records.filter((r:any)=>['present','late'].includes(r.status)).length / records.length * 100) : 0
    const absent = records.length ? Math.round(records.filter((r:any)=>r.status === 'absent').length / records.length * 100) : 0
    return { name: dayLabel(daysAgo), present, absent }
  }), [attendance])

  const bestDay = trend.reduce((best, d)=> d.present > best.present ? d : best, trend[0] || {name:'—', present:0})
  const summary = students.length || todayRecords.length
    ? aiDailySummary({attendancePct: counts.present, present: counts.presentCount, absent: counts.absent, late: counts.late })
    : ['No student or attendance data yet.', 'Add students from the Students page to start seeing live dashboard analytics.', 'Demo data has been removed from this dashboard.']

  const kpis = [
    { label: 'Total Students', value: counts.students.toLocaleString(), icon: Users, color: 'from-indigo-500 to-violet-500' },
    { label: 'Teachers Online', value: `${counts.teachersOnline}/${counts.teachers}`, icon: GraduationCap, color: 'from-emerald-500 to-teal-500' },
    { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'from-blue-500 to-cyan-500' },
    { label: 'New Enrollments', value: counts.newEnrollments.toString(), icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
    { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'from-fuchsia-500 to-pink-500' },
    { label: 'At Risk', value: counts.atRisk.toString(), icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
  ]

  const recentActivities = todayRecords
    .slice()
    .sort((a:any,b:any)=> (b.timestamp||0) - (a.timestamp||0))
    .slice(0,4)
    .map((r:any)=>{
      const st = studentMap.get(r.studentId)
      const time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata' }) : '--:--'
      return { time, text: `${st?.name || 'Student'} marked ${r.status} (${(r.method || 'manual').replace('_',' ')})` }
    })

  return <div className="page-container space-y-5">
    <div className="rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-[1px] shadow-[0_12px_40px_rgba(79,70,229,0.25)]">
      <div className="rounded-[27px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-5 md:p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/80 text-[12px]"><Sparkles size={14}/> {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Kolkata' })}</div>
          <h1 className="text-[22px] md:text-[28px] font-extrabold tracking-tight mt-1 leading-tight">Good Morning, {profile?.displayName?.split(' ')[0] || profile?.email?.split('@')[0] || 'Admin'}!</h1>
          <p className="text-white/80 text-[13px] md:text-[14px] mt-1 max-w-[85%]">Welcome to {school?.name || 'your school'}. Today&apos;s saved attendance is {counts.present}% from your real records.</p>
        </div>
      </div>
    </div>

    <div className="md:hidden flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1">
      {kpis.map((k)=>(
        <div key={k.label} className="kpi-card min-w-[152px] max-w-[152px] shrink-0 snap-start">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${k.color} flex items-center justify-center text-white mb-1`}><k.icon size={16}/></div>
          <div className="text-[20px] font-extrabold leading-none tracking-tight">{k.value}</div>
          <div className="text-[11px] text-muted-foreground font-medium leading-tight">{k.label}</div>
        </div>
      ))}
    </div>

    <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((k)=>(
        <Card key={k.label} className="p-0">
          <CardContent className="p-4">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center text-white mb-3`}><k.icon size={18}/></div>
            <div className="text-[22px] font-bold leading-none">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 overflow-hidden">
        <div className="flex items-center justify-between pr-5">
          <CardTitle>Weekly Attendance Trend</CardTitle>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">Best: {bestDay.name} {bestDay.present}%</span>
        </div>
        <CardContent>
          <div className="h-[200px] md:h-[220px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <YAxis hide domain={[0,100]} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={2.5} fill="url(#attendGrad)" dot={{ r:4, fill:'#6366f1' }} activeDot={{ r:6 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-b from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-900/50">
        <div className="flex items-center gap-2 px-5 pt-5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600"><Activity size={18}/></div>
          <CardTitle className="p-0">AI Daily Summary</CardTitle>
        </div>
        <CardContent className="text-[13px] leading-[1.5] space-y-1.5 mt-3">
          {summary.map((s,i)=><p key={i} className="flex gap-2"><span className="mt-1 w-1 h-1 rounded-full bg-zinc-900 dark:bg-white shrink-0" />{s}</p>)}
          <Button variant="gradient" size="sm" className="w-full mt-4 rounded-full h-11">Regenerate Summary</Button>
        </CardContent>
      </Card>
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card>
        <CardTitle className="flex items-center gap-2"><TrendingUp size={18}/> Attendance Trend</CardTitle>
        <CardContent>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Line type="monotone" dataKey="present" stroke="#8b5cf6" strokeWidth={2.5} dot={false}/>
                <XAxis dataKey="name" hide/>
                <YAxis hide domain={[0,100]}/>
                <Tooltip/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Based on saved attendance records only.</div>
        </CardContent>
      </Card>

      <Card>
        <CardTitle className="flex items-center gap-2"><Award size={18}/> Top Performers</CardTitle>
        <CardContent className="text-[13px] space-y-3 mt-2 text-muted-foreground">
          No marks data yet. Add and publish marks to show real rank/performance information here.
        </CardContent>
      </Card>

      <Card className="border-red-100 dark:border-red-900/20">
        <CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle size={18}/> Students at Risk</CardTitle>
        <CardContent className="text-[13px] space-y-2.5 mt-1">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500"/> {counts.atRisk} students below 75% from saved attendance</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> {counts.absent} absent today</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> {counts.presentCount} present today</div>
          <div className="pt-3 text-[11px] text-muted-foreground p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">AI Attendance Risk Prediction uses your Firebase attendance records.</div>
        </CardContent>
      </Card>
    </div>

    {(profile?.role==='school_admin' || profile?.role==='super_admin') && (
      <Card>
        <CardTitle>Teacher Live Status</CardTitle>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {teachers.map((t:any,i)=>(
              <div key={t.uid || i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/50">
                <div>
                  <div className="font-semibold text-[14px]">{t.displayName || t.name || 'Teacher'}</div>
                  <div className="text-[11px] text-muted-foreground">{(t.subjects||[]).join(', ') || 'No subjects added'}</div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Active' : 'Offline'}</span>
              </div>
            ))}
            {!teachers.length && <div className="md:col-span-3 text-center text-muted-foreground p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/80">No teachers added yet.</div>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Admin-only online/offline presence tracking • Real-time Firebase</p>
        </CardContent>
      </Card>
    )}

    <div className="grid md:grid-cols-2 gap-4 pb-4">
      <Card>
        <CardTitle>Recent Activities</CardTitle>
        <CardContent>
          <ul className="text-[13px] space-y-2.5 text-muted-foreground">
            {recentActivities.map((a,i)=><li key={i} className="flex gap-2"><span className="text-foreground font-medium">{a.time}</span> {a.text}</li>)}
            {!recentActivities.length && <li>No activity saved today yet.</li>}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardTitle>Quick Actions</CardTitle>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Mark Attendance','Add Student','Enter Marks','Send WhatsApp','Export Report','AI Predict'].map(a=><span key={a} className="px-3.5 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer transition">{a}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
}
