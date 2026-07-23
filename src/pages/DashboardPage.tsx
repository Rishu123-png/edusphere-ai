
import ModuleArchitectureBanner from '@/components/ModuleArchitectureBanner'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { aiDailySummary } from '@/lib/ai'
import { todayIST } from '@/lib/rtdb'
import { Users, GraduationCap, CheckCircle2, Clock3, AlertTriangle, Sparkles, TrendingUp, Award, Activity, Camera, UserPlus, FilePenLine, MessageCircle, CalendarDays, BrainCircuit, ArrowUpRight, RotateCcw, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import NeonGauge from '@/components/mobile/NeonGauge'
import { AnimeEntrance } from '@/components/AnimeWrapper'
import { motion } from 'framer-motion'

const dateKey = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const dayLabel = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })

export default function DashboardPage(){
  const { profile } = useAuth()
  const { school, schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, Record<string, any>>>({})
  const [todayHoliday, setTodayHoliday] = useState<any | null>(null)
  const [summaryTick, setSummaryTick] = useState(0)

  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=>({ id, ...s })))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!isAdmin || !schoolId){ setTeachers([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/teachers`), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, t]:any)=>({ uid: t.uid || id, id, ...t }))
        .filter((t:any)=> t.role !== 'school_admin')
      setTeachers(list)
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
      const lastSeen = t.lastSeen || 0
      const fresh = lastSeen ? (Date.now() - lastSeen) < 3 * 60 * 1000 : false
      return {
        ...t,
        displayName: t.displayName || t.name,
        subjects: t.subjects || [],
        isOnline: t.isOnline === true && fresh,
        lastSeen: lastSeen || null,
      }
    })
  }, [teachers])

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
  const summary = useMemo(() => students.length || todayRecords.length
    ? aiDailySummary({attendancePct: counts.present, present: counts.presentCount, absent: counts.absent, late: counts.late })
    : ['No student or attendance data yet.', 'Add students from the Students page to start seeing live dashboard analytics.', 'Only real school records appear here.'],
    [students.length, todayRecords.length, counts.present, counts.presentCount, counts.absent, counts.late, summaryTick])

  const kpis = isAdmin
    ? [
        { label: 'Total Students', value: counts.students.toLocaleString(), icon: Users, color: 'rgba(79,70,229,0.15)', iconColor: '#818cf8' },
        { label: 'Teachers Online', value: `${counts.teachersOnline}/${counts.teachers}`, icon: GraduationCap, color: 'rgba(34,197,94,0.12)', iconColor: '#22C55E' },
        { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'rgba(34,211,238,0.1)', iconColor: '#22D3EE' },
        { label: 'New Enrollments', value: counts.newEnrollments.toString(), icon: TrendingUp, color: 'rgba(245,158,11,0.12)', iconColor: '#F59E0B' },
        { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'rgba(168,85,247,0.12)', iconColor: '#A855F7' },
        { label: 'At Risk', value: counts.atRisk.toString(), icon: AlertTriangle, color: 'rgba(239,68,68,0.12)', iconColor: '#EF4444' },
      ]
    : [
        { label: 'My Students', value: counts.students.toLocaleString(), icon: Users, color: 'rgba(79,70,229,0.15)', iconColor: '#818cf8' },
        { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'rgba(34,211,238,0.1)', iconColor: '#22D3EE' },
        { label: 'Present Today', value: counts.presentCount.toString(), icon: GraduationCap, color: 'rgba(34,197,94,0.12)', iconColor: '#22C55E' },
        { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'rgba(168,85,247,0.12)', iconColor: '#A855F7' },
        { label: 'Absent Today', value: counts.absent.toString(), icon: AlertTriangle, color: 'rgba(239,68,68,0.12)', iconColor: '#EF4444' },
        { label: 'At Risk', value: counts.atRisk.toString(), icon: TrendingUp, color: 'rgba(245,158,11,0.12)', iconColor: '#F59E0B' },
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

  return (
    <div className="page-container space-y-6">
      {/* anime.js spring entrance */}
      <AnimeEntrance delay={70}>
        {/* ===== HERO SECTION ===== */}
        <section className="card-premium overflow-hidden p-[1px]">
          <div className="relative overflow-hidden rounded-[20px] p-6" style={{background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(168,85,247,0.08), rgba(34,211,238,0.06))'}}>
            {/* Glow orbs */}
            <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full blur-3xl pointer-events-none" style={{background: 'rgba(34,211,238,0.08)'}} />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full blur-3xl pointer-events-none" style={{background: 'rgba(168,85,247,0.1)'}} />

            <div className="relative z-10 flex flex-col md:flex-row gap-6">
              {/* Left: Welcome + Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-1">Dashboard</p>
                  <h1 className="text-[26px] md:text-[32px] font-black leading-tight text-white">
                    Welcome back,{' '}
                    <span className="text-gradient-ai">{school?.name || 'EduSphere'}</span>
                  </h1>
                </div>

                {/* Stats Row */}
                <div className="flex gap-4">
                  <div className="rounded-2xl border border-white/[0.06] p-3 flex-1" style={{background: 'rgba(255,255,255,0.03)'}}>
                    <div className="text-[9px] uppercase tracking-[0.13em] text-white/40">Present</div>
                    <div className="mt-0.5 text-[22px] font-black text-brand-success">{counts.presentCount}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] p-3 flex-1" style={{background: 'rgba(255,255,255,0.03)'}}>
                    <div className="text-[9px] uppercase tracking-[0.13em] text-white/40">Absent</div>
                    <div className="mt-0.5 text-[22px] font-black text-brand-error">{counts.absent}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] p-3 flex-1" style={{background: 'rgba(255,255,255,0.03)'}}>
                    <div className="text-[9px] uppercase tracking-[0.13em] text-white/40">Late</div>
                    <div className="mt-0.5 text-[22px] font-black text-brand-warning">{counts.late}</div>
                  </div>
                </div>

                {todayHoliday && (
                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.15)'}}>
                    🎉 Holiday today: {todayHoliday.title || todayHoliday.name}
                  </div>
                )}
              </div>

              {/* Right: Attendance Gauge */}
              <div className="flex items-center justify-center">
                <NeonGauge value={counts.present} size={180} label="Today's Attendance" caption="Live from records" surface="dark" />
              </div>
            </div>
          </div>
        </section>
      </AnimeEntrance>

      {/* ===== KPI CARDS ===== */}
      <div className="md:hidden flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1">
        {kpis.map((k, i)=>(
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="kpi-card min-w-[152px] max-w-[152px] shrink-0 snap-start"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{background: k.color}}>
              <k.icon size={18} style={{color: k.iconColor}}/>
            </div>
            <div className="text-[22px] font-black leading-none tracking-tight text-white">{k.value}</div>
            <div className="text-[11px] text-white/50 font-medium leading-tight mt-1">{k.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k, i)=>(
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-premium p-4"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{background: k.color}}>
              <k.icon size={18} style={{color: k.iconColor}}/>
            </div>
            <div className="text-[22px] font-black leading-none text-white">{k.value}</div>
            <div className="text-xs text-white/50 mt-1">{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* ===== QUICK ACTIONS (Mobile) ===== */}
      <div className="md:hidden">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-extrabold tracking-tight text-white">Quick actions</h2>
          <span className="text-[9px] uppercase tracking-[.14em] text-white/30">Swipe</span>
        </div>
        <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {[
            { label: 'AI Camera', hint: 'Face scan', to: '/attendance', icon: Camera, bgColor: 'rgba(34,197,94,0.1)', iconColor: '#22C55E' },
            { label: 'Add Student', hint: 'New profile', to: '/students', icon: UserPlus, bgColor: 'rgba(79,70,229,0.12)', iconColor: '#818cf8' },
            { label: 'Enter Marks', hint: 'Publish score', to: '/marks', icon: FilePenLine, bgColor: 'rgba(168,85,247,0.1)', iconColor: '#A855F7' },
            { label: 'AI Predict', hint: 'Risk & grades', to: '/ai', icon: BrainCircuit, bgColor: 'rgba(34,211,238,0.08)', iconColor: '#22D3EE' },
            { label: 'Calendar', hint: 'School plan', to: '/calendar', icon: CalendarDays, bgColor: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B' },
            ...(isAdmin ? [{ label: 'WhatsApp', hint: 'Parent alerts', to: '/whatsapp', icon: MessageCircle, bgColor: 'rgba(34,197,94,0.1)', iconColor: '#22C55E' }] : []),
          ].map(action => (
            <Link key={action.label} to={action.to} className="card-premium min-w-[118px] snap-start p-4 active:scale-[.97] transition-transform">
              <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{background: action.bgColor}}>
                <action.icon size={20} style={{color: action.iconColor}}/>
              </span>
              <span className="mt-3 block text-[12px] font-bold text-white">{action.label}</span>
              <span className="mt-0.5 block text-[10px] text-white/40">{action.hint}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 card-premium overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-2">
            <div>
              <h3 className="text-[14px] font-bold text-white">Weekly Attendance Trend</h3>
              <p className="text-[11px] text-white/40 mt-0.5">Last 6 days</p>
            </div>
            <span className="status-chip status-chip-success">Best: {bestDay.name} {bestDay.present}%</span>
          </div>
          <CardContent className="p-2">
            <div className="h-[200px] md:h-[220px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="rgba(255,255,255,0.2)" fontSize={11}/>
                  <YAxis hide domain={[0,100]} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: '#0c1125', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', color: '#fff' }} />
                  <Area type="monotone" dataKey="present" stroke="#4F46E5" strokeWidth={2.5} fill="url(#attendGrad)" dot={{ r:4, fill:'#4F46E5' }} activeDot={{ r:6 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </div>

        {/* AI Daily Summary */}
        <div className="card-premium card-glow">
          <div className="flex items-center gap-2 px-5 pt-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'rgba(79,70,229,0.12)'}}>
              <Activity size={16} style={{color: '#818cf8'}}/>
            </div>
            <h3 className="text-[14px] font-bold text-white">AI Daily Summary</h3>
          </div>
          <CardContent className="text-[13px] leading-[1.6] space-y-2 mt-3 px-5">
            {summary.map((s,i)=>(
              <p key={`${summaryTick}-${i}`} className="flex gap-2 text-white/70">
                <span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{background: 'linear-gradient(135deg, #4F46E5, #A855F7)'}}/>
                {s}
              </p>
            ))}
            <button
              className="w-full mt-3 h-11 rounded-full font-semibold text-[13px] text-white flex items-center justify-center gap-1.5 transition-all hover:shadow-lg"
              style={{background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #A855F7)', boxShadow: '0 8px 20px rgba(79,70,229,0.3)'}}
              onClick={()=>{ setSummaryTick(t=>t+1); toast.success('Summary refreshed from live records') }}
            >
              <RotateCcw size={13}/> Regenerate
            </button>
          </CardContent>
        </div>
      </div>

      {/* ===== SECOND ROW ===== */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Trend line */}
        <div className="card-premium">
          <div className="flex items-center gap-2 px-5 pt-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'rgba(168,85,247,0.1)'}}>
              <TrendingUp size={16} style={{color: '#A855F7'}}/>
            </div>
            <h3 className="text-[14px] font-bold text-white">Attendance Trend</h3>
          </div>
          <CardContent className="px-3">
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <Line type="monotone" dataKey="present" stroke="#A855F7" strokeWidth={2.5} dot={false}/>
                  <XAxis dataKey="name" hide/>
                  <YAxis hide domain={[0,100]}/>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: '#0c1125', color: '#fff' }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-white/30 mt-2 px-2">Based on saved attendance records.</div>
          </CardContent>
        </div>

        {/* Top Performers */}
        <div className="card-premium">
          <div className="flex items-center gap-2 px-5 pt-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'rgba(245,158,11,0.1)'}}>
              <Award size={16} style={{color: '#F59E0B'}}/>
            </div>
            <h3 className="text-[14px] font-bold text-white">Top Performers</h3>
          </div>
          <CardContent className="text-[13px] mt-3 px-5 text-white/40">
            No marks data yet. Add and publish marks to see real performance information here.
          </CardContent>
        </div>
        
        {/* At Risk */}
        <div className="card-premium" style={{borderColor: 'rgba(239,68,68,0.12)'}}>
          <div className="flex items-center gap-2 px-5 pt-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'rgba(239,68,68,0.1)'}}>
              <AlertTriangle size={16} style={{color: '#EF4444'}}/>
            </div>
            <h3 className="text-[14px] font-bold text-brand-error">Students at Risk</h3>
          </div>
          <CardContent className="text-[13px] space-y-2.5 mt-3 px-5">
            <div className="flex items-center gap-3 text-white/70">
              <span className="w-2.5 h-2.5 rounded-full" style={{background: '#EF4444'}}/> {counts.atRisk} students below 75% attendance
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <span className="w-2.5 h-2.5 rounded-full" style={{background: '#F59E0B'}}/> {counts.absent} absent today
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <span className="w-2.5 h-2.5 rounded-full" style={{background: '#22C55E'}}/> {counts.presentCount} present today
            </div>
          </CardContent>
        </div>
      </div>

      {/* Teacher Live Status — ADMIN ONLY */}
      {isAdmin && (
        <div className="card-premium">
          <div className="flex items-center gap-2 px-5 pt-5">
            <h3 className="text-[14px] font-bold text-white">Teacher Live Status</h3>
          </div>
          <CardContent className="px-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-3">
              {teachersWithPresence.map((t:any,i)=>(
                <div key={t.uid || i} className="flex items-center justify-between p-3.5 rounded-2xl border border-white/[0.06]" style={{background: 'rgba(255,255,255,0.02)'}}>
                  <div>
                    <div className="font-semibold text-[14px] text-white">{t.displayName || t.name || 'Teacher'}</div>
                    <div className="text-[11px] text-white/40">{(t.subjects||[]).join(', ') || t.email || 'No subjects'}</div>
                  </div>
                  <span className={`status-chip ${t.isOnline ? 'status-chip-success' : 'status-chip-warning'}`}>
                    {t.isOnline ? '● Active' : '○ Offline'}
                  </span>
                </div>
              ))}
              {!teachersWithPresence.length && (
                <div className="md:col-span-3 text-center text-white/30 p-6 rounded-2xl border border-white/[0.04]" style={{background: 'rgba(255,255,255,0.02)'}}>
                  No teachers added yet.
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/30 mt-3">Admin-only • Updates when teachers login (live Firebase presence)</p>
          </CardContent>
        </div>
      )}
     {/* Recent Activities + Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4 pb-4">
        <div className="card-premium">
          <div className="px-5 pt-5">
            <h3 className="text-[14px] font-bold text-white">Recent Activities</h3>
          </div>
          <CardContent className="px-5">
            <ul className="text-[13px] space-y-2.5 mt-3">
              {recentActivities.map((a,i)=>(
                <li key={i} className="flex gap-2 text-white/60">
                  <span className="text-white/40 font-medium">{a.time}</span> {a.text}
                </li>
              ))}
              {!recentActivities.length && <li className="text-white/30">No activity saved today yet.</li>}
            </ul>
          </CardContent>
        </div>
        <div className="card-premium hidden md:block">
          <div className="px-5 pt-5">
            <h3 className="text-[14px] font-bold text-white">Quick Actions</h3>
          </div>
          <CardContent className="px-5">
            <div className="flex flex-wrap gap-2 mt-3">
              {(isAdmin
                ? ['Mark Attendance','Add Student','Enter Marks','Send WhatsApp','Export Report','AI Predict']
                : ['Mark Attendance','Add Student','Enter Marks','My Schedule','Calendar']
              ).map(a=><span key={a} className="px-3.5 py-2 rounded-full text-[13px] font-medium cursor-pointer transition-all hover:border-brand-primary/30" style={{background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)'}}>{a}</span>)}
            </div>
          </CardContent>
        </div>
      </div>
    </div>
  )
}