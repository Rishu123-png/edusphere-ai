import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, AreaChart, Area } from 'recharts'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { aiDailySummary } from '@/lib/ai'
import PageHeader from '@/components/mobile/PageHeader'
import { Users, GraduationCap, CheckCircle2, Clock3, AlertTriangle, Sparkles, TrendingUp, Award, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'

const trend = [
  {name:'Mon', present:92, absent:8},
  {name:'Tue', present:88, absent:12},
  {name:'Wed', present:94, absent:6},
  {name:'Thu', present:90, absent:10},
  {name:'Fri', present:86, absent:14},
  {name:'Sat', present:78, absent:8},
]

export default function DashboardPage(){
  const { profile } = useAuth()
  const { school } = useSchool()
  const [liveTeachers, setLiveTeachers] = useState<any[]>([])
  const [counts, setCounts] = useState({ students:2485, teachers:132, present:96.8, absent:83, late:18, leave:23 })

  useEffect(()=>{
    if(profile?.role !== 'school_admin' && profile?.role !== 'super_admin') return
    const unsub = onValue(ref(db,'users'), snap=>{
      const v = snap.val()||{}
      const teachers = Object.values(v).filter((u:any)=>u.role==='teacher')
      setLiveTeachers(teachers as any)
    })
    return ()=>unsub()
  }, [profile?.role])

  const summary = aiDailySummary({attendancePct:counts.present, present: 2400, absent: counts.absent, late: counts.late })

  const kpis = [
    { label: 'Total Students', value: counts.students.toLocaleString(), icon: Users, color: 'from-indigo-500 to-violet-500' },
    { label: 'Teachers Present', value: `132/138`, icon: GraduationCap, color: 'from-emerald-500 to-teal-500' },
    { label: "Today's Attendance", value: `${counts.present}%`, icon: CheckCircle2, color: 'from-blue-500 to-cyan-500' },
    { label: 'New Enrollments', value: '42', icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
    { label: 'Late Today', value: counts.late.toString(), icon: Clock3, color: 'from-fuchsia-500 to-pink-500' },
    { label: 'At Risk', value: '12', icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
  ]

  return <div className="page-container space-y-5">
    {/* Greeting */}
    <div className="rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-[1px] shadow-[0_12px_40px_rgba(79,70,229,0.25)]">
      <div className="rounded-[27px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-5 md:p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/80 text-[12px]"><Sparkles size={14}/> {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
          <h1 className="text-[22px] md:text-[28px] font-extrabold tracking-tight mt-1 leading-tight">Good Morning, {profile?.displayName?.split(' ')[0] || 'Sarah'}!</h1>
          <p className="text-white/80 text-[13px] md:text-[14px] mt-1 max-w-[85%]">Welcome to {school?.name || 'EduSphere Public School'}, your AI attendance is strong at 96.8% and congrats ✨</p>
        </div>
      </div>
    </div>

    {/* KPI scroll on mobile */}
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
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">98% Thu best</span>
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
                <YAxis hide domain={[70,100]} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={2.5} fill="url(#attendGrad)" dot={{ r:4, fill:'#6366f1' }} activeDot={{ r:6 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-1.5 mt-3 md:hidden">
            {[0,1,2,3,4].map(i=><div key={i} className={`w-1.5 h-1.5 rounded-full ${i===0?'bg-zinc-900 dark:bg-white':'bg-zinc-300 dark:bg-zinc-700'}`} />)}
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
        <CardTitle className="flex items-center gap-2"><TrendingUp size={18}/> Performance Trend</CardTitle>
        <CardContent>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Line type="monotone" dataKey="present" stroke="#8b5cf6" strokeWidth={2.5} dot={false}/>
                <XAxis dataKey="name" hide/>
                <YAxis hide/>
                <Tooltip/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground mt-2">Avg +4.2% vs last week</div>
        </CardContent>
      </Card>

      <Card>
        <CardTitle className="flex items-center gap-2"><Award size={18}/> Top Performers</CardTitle>
        <CardContent className="text-[13px] space-y-3 mt-2">
          {['Aarav S. • 10-A • 96.4%','Ishita M. • 9-B • 95.1%','Vihaan R. • 12-C • 94.8%','Ananya P. • 11-A • 93.9%','Reyansh K. • 10-B • 93.2%'].map(n=><div key={n} className="flex justify-between items-center"><span className="font-medium">{n.split(' • ')[0]}</span><span className="text-muted-foreground text-xs">{n.split(' • ').slice(1).join(' • ')}</span></div>)}
        </CardContent>
      </Card>

      <Card className="border-red-100 dark:border-red-900/20">
        <CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle size={18}/> Students at Risk</CardTitle>
        <CardContent className="text-[13px] space-y-2.5 mt-1">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500"/> High: 4 students (&lt;60%)</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> Medium: 8 students (60-75%)</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Low: 1236 students</div>
          <div className="pt-3 text-[11px] text-muted-foreground p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">AI Attendance Risk Prediction active • Auto WhatsApp alerts ready</div>
        </CardContent>
      </Card>
    </div>

    {(profile?.role==='school_admin' || profile?.role==='super_admin') && (
      <Card>
        <CardTitle>Teacher Live Status</CardTitle>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {(liveTeachers.slice(0,6).length?liveTeachers.slice(0,6):[
              {displayName:'Priya Sharma', isOnline:true, subjects:['Maths']},
              {displayName:'Rahul Verma', isOnline:true, subjects:['Science']},
              {displayName:'Sneha Iyer', isOnline:false, subjects:['English']},
            ]).map((t:any,i)=>(
              <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/50">
                <div>
                  <div className="font-semibold text-[14px]">{t.displayName || t.name || 'Teacher '+(i+1)}</div>
                  <div className="text-[11px] text-muted-foreground">{(t.subjects||['General']).join(', ')}</div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Active' : 'Offline'}</span>
              </div>
            ))}
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
            <li className="flex gap-2"><span className="text-foreground font-medium">09:04</span> Class 9-B attendance closed (AI camera 34/36)</li>
            <li className="flex gap-2"><span className="text-foreground font-medium">08:47</span> Marks published: Science UT-2 - Class 10</li>
            <li className="flex gap-2"><span className="text-foreground font-medium">08:30</span> WhatsApp absent alerts sent (23)</li>
            <li className="flex gap-2"><span className="text-foreground font-medium">08:12</span> Teacher late alert: Maths 10-A - 7 min</li>
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
