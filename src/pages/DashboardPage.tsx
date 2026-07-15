
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { aiDailySummary } from '@/lib/ai'
import { todayIST } from '@/lib/rtdb'
import { Users, GraduationCap, CheckCircle2, Clock3, AlertTriangle, Sparkles, TrendingUp, Award, Activity, Camera, UserPlus, FilePenLine, MessageCircle, CalendarDays, BrainCircuit, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import NeonGauge from '@/components/mobile/NeonGauge'

const dateKey = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const dayLabel = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })

export default function DashboardPage(){
  const { profile } = useAuth()
  const { school, schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [userPresence, setUserPresence] = useState<Record<string, any>>({})
  const [attendance, setAttendance] = useState<Record<string, Record<string, any>>>({})
  const [todayHoliday, setTodayHoliday] = useState<any | null>(null)

  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=>({ id, ...s })))
    })
    return ()=>unsub()
  }, [schoolId])

  // Admin only: live teacher list + presence
  useEffect(()=>{
    if(!isAdmin || !schoolId){ setTeachers([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/teachers`), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, t]:any)=>({ uid: t.uid || id, id, ...t }))
        .filter((t:any)=> t.role !== 'school_admin') // only teachers
      setTeachers(list)
    })
    return ()=>unsub()
  }, [schoolId, isAdmin])

  // Merge presence from users/ (authoritative when teacher is logged in)
  useEffect(()=>{
    if(!isAdmin || !schoolId){ setUserPresence({}); return }
    const unsub = onValue(ref(db, 'users'), snap=>{
      const v = snap.val() || {}
      const map: Record<string, any> = {}
      Object.entries(v).forEach(([uid, u]: any) => {
        if (u?.schoolId === schoolId && u?.role === 'teacher') {
          map[uid] = u
          if (u.email) map[String(u.email).toLowerCase()] = u
        }
      })
      setUserPresence(map)
    })
    return ()=>unsub()
  }, [schoolId, isAdmin])

  useEffect(()=>{
    if(!schoolId){ setAttendance({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), snap=>{
      setAttendance(snap.val() || {})
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setTodayHoliday(null); return }
    const today = todayIST()
    const unsub = onValue(ref(db, `schools/${schoolId}/events`), snap=>{
      const v = snap.val() || {}
      const holiday = Object.values(v).find((e:any)=> e?.type === 'holiday' && e?.date === today) as any
      setTodayHoliday(holiday || null)
    })
    return ()=>unsub()
  }, [schoolId])

  const teachersWithPresence = useMemo(() => {
    return teachers.map((t: any) => {
      const byUid = userPresence[t.uid] || userPresence[t.id]
      const byEmail = t.email ? userPresence[String(t.email).toLowerCase()] : null
      const live = byUid || byEmail
      // Online if either school teacher record OR live user session says so
      // and lastSeen within 3 minutes when using heartbeat
      const lastSeen = live?.lastSeen || t.lastSeen || 0
      const fresh = lastSeen ? (Date.now() - lastSeen) < 3 * 60 * 1000 : false
      const isOnline = !!(live?.isOnline || t.isOnline) && (fresh || live?.isOnline || t.isOnline)
      // Prefer fresh user flag
      const online = !!(live?.isOnline === true || (t.isOnline === true && (!live || live.isOnline !== false)))
      return {
        ...t,
        displayName: live?.displayName || t.displayName || t.name,
        subjects: live?.subjects || t.subjects || [],
        isOnline: online || (live?.isOnline === true),
        lastSeen: lastSeen || null,
      }
    })
  }, [teachers, userPresence])

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

    const onlineTeachers = teachersWithPresence.filter((t:any)=> t.isOnline).length

    return {
      students: students.length,
      teachers: teachersWithPresence.length,
      teachersOnline: onlineTeachers,
      present: presentPct,
      presentCount: presentRecords.length,
      absent: absentRecords.length,
      late: lateRecords.length,
      leave: leaveRecords.length,
      newEnrollments,
      atRisk,
    }
  }, [students, teachersWithPresence, todayRecords, attendance])

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
    : ['No student or attendance data yet.', 'Add students from the Students page to start seeing live dashboard analytics.', 'Only real school records appear here.']

  // Teachers never see "Teachers Online" KPI
  const kpis = isAdmin
    ? [
        { label: 'Total Students', value: counts.students.toLocaleString(), icon: Users, color: 'from-indigo-500 to-violet-500' },
        { label: 'Teachers Online', value: `${counts.teachersOnline}/${counts.teachers}`, icon: GraduationCap, color: 'from-emerald-500 to-teal-500' },
        { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'from-blue-500 to-cyan-500' },
        { label: 'New Enrollments', value: counts.newEnrollments.toString(), icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
        { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'from-fuchsia-500 to-pink-500' },
        { label: 'At Risk', value: counts.atRisk.toString(), icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
      ]
    : [
        { label: 'My Students', value: counts.students.toLocaleString(), icon: Users, color: 'from-indigo-500 to-violet-500' },
        { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'from-blue-500 to-cyan-500' },
        { label: 'Present Today', value: counts.presentCount.toString(), icon: GraduationCap, color: 'from-emerald-500 to-teal-500' },
        { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'from-fuchsia-500 to-pink-500' },
        { label: 'Absent Today', value: counts.absent.toString(), icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
        { label: 'At Risk', value: counts.atRisk.toString(), icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
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
    <section className="dashboard-hero relative overflow-hidden rounded-[28px] p-[1px] shadow-[0_18px_55px_rgba(0,0,0,.25)]">
      <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-[#15202d] via-[#101621] to-[#10101a] p-5 text-white md:bg-gradient-to-br md:from-indigo-600 md:via-violet-600 md:to-fuchsia-500 md:p-6">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl md:bg-white/15" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl md:bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.13em] text-cyan-200/70 md:text-[12px] md:normal-case md:tracking-normal md:text-white/80"><Sparkles size={13}/> Live campus intelligence</div>
              <h1 className="mt-1.5 text-[24px] font-black leading-tight tracking-[-.035em] md:text-[28px]">Good Morning, {profile?.displayName?.split(' ')[0] || profile?.email?.split('@')[0] || 'Admin'}!</h1>
              <p className="mt-1 max-w-[90%] text-[11px] leading-relaxed text-slate-400 md:text-[14px] md:text-white/80">
                {school?.name || 'Your school'} • {new Date().toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric', timeZone:'Asia/Kolkata' })}
              </p>
            </div>
            <Link to="/ai" className="md:hidden grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300"><ArrowUpRight size={17}/></Link>
          </div>

          <div className="mt-1 grid grid-cols-[1.25fr_.75fr] items-center gap-1 md:hidden">
            <NeonGauge value={counts.present} size={190} label="Today's Attendance" caption="Live from saved records" />
            <div className="space-y-2">
              <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3">
                <div className="text-[9px] uppercase tracking-[.13em] text-slate-500">Present</div>
                <div className="mt-0.5 text-[22px] font-black text-emerald-300">{counts.presentCount}</div>
              </div>
              <div className="rounded-2xl border border-white/[.07] bg-white/[.035] p-3">
                <div className="text-[9px] uppercase tracking-[.13em] text-slate-500">Needs attention</div>
                <div className="mt-0.5 text-[22px] font-black text-amber-300">{counts.atRisk}</div>
              </div>
            </div>
          </div>

          <p className="hidden md:block text-white/80 text-[14px] mt-1 max-w-[85%]">
            Welcome to {school?.name || 'your school'}. Today&apos;s saved attendance is {counts.present}% from your real records.
          </p>
          {todayHoliday && (
            <div className="mt-3 inline-flex rounded-full bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 md:bg-white/15 md:text-white">
              Holiday today: {todayHoliday.title || todayHoliday.name} — schedule alerts paused
            </div>
          )}
        </div>
      </div>
    </section>

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

    <div className="md:hidden">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-[14px] font-extrabold tracking-tight">Quick actions</h2>
        <span className="text-[9px] uppercase tracking-[.14em] text-slate-500">Swipe</span>
      </div>
      <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {[
          { label: 'AI Camera', hint: 'Face scan', to: '/attendance', icon: Camera, color: 'from-emerald-400/20 to-cyan-500/10 text-emerald-300' },
          { label: 'Add Student', hint: 'New profile', to: '/students', icon: UserPlus, color: 'from-blue-400/20 to-indigo-500/10 text-blue-300' },
          { label: 'Enter Marks', hint: 'Publish score', to: '/marks', icon: FilePenLine, color: 'from-violet-400/20 to-fuchsia-500/10 text-violet-300' },
          { label: 'AI Predict', hint: 'Risk & grades', to: '/ai', icon: BrainCircuit, color: 'from-cyan-400/20 to-violet-500/10 text-cyan-300' },
          { label: 'Calendar', hint: 'School plan', to: '/calendar', icon: CalendarDays, color: 'from-amber-400/20 to-orange-500/10 text-amber-300' },
          ...(isAdmin ? [{ label: 'WhatsApp', hint: 'Parent alerts', to: '/whatsapp', icon: MessageCircle, color: 'from-emerald-400/20 to-teal-500/10 text-emerald-300' }] : []),
        ].map(action => (
          <Link key={action.label} to={action.to} className="card-premium min-w-[118px] snap-start p-3.5 active:scale-[.97]">
            <span className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${action.color}`}><action.icon size={18}/></span>
            <span className="mt-3 block text-[12px] font-bold">{action.label}</span>
            <span className="mt-0.5 block text-[9px] text-slate-500">{action.hint}</span>
          </Link>
        ))}
      </div>
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
        </CardContent>
      </Card>
    </div>

    {/* Teacher Live Status — ADMIN ONLY */}
    {isAdmin && (
      <Card>
        <CardTitle>Teacher Live Status</CardTitle>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {teachersWithPresence.map((t:any,i)=>(
              <div key={t.uid || i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/50">
                <div>
                  <div className="font-semibold text-[14px]">{t.displayName || t.name || 'Teacher'}</div>
                  <div className="text-[11px] text-muted-foreground">{(t.subjects||[]).join(', ') || t.email || 'No subjects'}</div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'}`}>
                  {t.isOnline ? 'Active' : 'Offline'}
                </span>
              </div>
            ))}
            {!teachersWithPresence.length && <div className="md:col-span-3 text-center text-muted-foreground p-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/80">No teachers added yet.</div>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Admin-only • Updates when teachers login (live Firebase presence)</p>
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
      <Card className="hidden md:block">
        <CardTitle>Quick Actions</CardTitle>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(isAdmin
              ? ['Mark Attendance','Add Student','Enter Marks','Send WhatsApp','Export Report','AI Predict']
              : ['Mark Attendance','Add Student','Enter Marks','My Schedule','Calendar']
            ).map(a=><span key={a} className="px-3.5 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 cursor-pointer transition">{a}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
}
