import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { aiDailySummary } from '@/lib/ai'

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
  const [counts, setCounts] = useState({ students:1248, teachers:64, present:1142, absent:83, late:18, leave:23 })

  useEffect(()=>{
    if(profile?.role !== 'school_admin' && profile?.role !== 'super_admin') return
    const unsub = onValue(ref(db,'users'), snap=>{
      const v = snap.val()||{}
      const teachers = Object.values(v).filter((u:any)=>u.role==='teacher')
      setLiveTeachers(teachers as any)
    })
    return ()=>unsub()
  }, [profile?.role])

  const summary = aiDailySummary({attendancePct:91.5, present: counts.present, absent: counts.absent, late: counts.late })

  const kpis = [
    ['Total Students', counts.students.toLocaleString()],
    ['Total Teachers', counts.teachers.toString()],
    ["Today's Present", counts.present.toLocaleString()],
    ['Attendance %', '91.5%'],
    ['Late Today', counts.late.toString()],
    ['Leave', counts.leave.toString()],
    ['Absent', counts.absent.toString()],
    ['At Risk', '12'],
  ]

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Smart AI Dashboard</h1>
        <p className="text-muted-foreground">Real-time school pulse • Role: {profile?.role} • {school?.name || 'EduSphere Global'}</p>
      </div>
      <div className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Live Sync • Firebase RTDB</div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map(([k,v])=>(
        <Card key={k}>
          <CardTitle className="text-sm text-muted-foreground font-medium">{k}</CardTitle>
          <div className="px-5 pb-5 text-2xl font-bold">{v}</div>
        </Card>
      ))}
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardTitle>Attendance Trend</CardTitle>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <Tooltip />
                <Bar dataKey="present" radius={[8,8,0,0]} fill="hsl(var(--primary))"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardTitle>AI Daily Summary</CardTitle>
        <CardContent className="text-sm space-y-2">
          {summary.map((s,i)=><p key={i}>• {s}</p>)}
        </CardContent>
      </Card>
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card>
        <CardTitle>Performance Trend</CardTitle>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Line type="monotone" dataKey="present" stroke="hsl(var(--primary))" strokeWidth={2} dot={false}/>
                <XAxis dataKey="name" hide/>
                <YAxis hide/>
                <Tooltip/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardTitle>Top Performers</CardTitle>
        <CardContent className="text-sm space-y-2">
          {['Aarav S. 10-A 96.4%','Ishita M. 9-B 95.1%','Vihaan R. 12-C 94.8%','Ananya P. 11-A 93.9%','Reyansh K. 10-B 93.2%'].map(n=><div key={n} className="flex justify-between"><span>{n.split('  ')[0]}</span><span className="text-muted-foreground">{n.split('  ')[1]}</span></div>)}
        </CardContent>
      </Card>

      <Card>
        <CardTitle>Students at Risk</CardTitle>
        <CardContent className="text-sm space-y-2">
          <div className="text-red-500">🔴 High: 4 students (&lt;60%)</div>
          <div className="text-amber-500">🟡 Medium: 8 students (60-75%)</div>
          <div className="text-emerald-500">🟢 Low: 1236 students</div>
          <div className="pt-2 text-xs text-muted-foreground">AI Attendance Risk Prediction active</div>
        </CardContent>
      </Card>
    </div>

    {(profile?.role==='school_admin' || profile?.role==='super_admin') && (
      <Card>
        <CardTitle>Teacher Live Status</CardTitle>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            {(liveTeachers.slice(0,6).length?liveTeachers.slice(0,6):[
              {displayName:'Priya Sharma', isOnline:true, subjects:['Maths']},
              {displayName:'Rahul Verma', isOnline:true, subjects:['Science']},
              {displayName:'Sneha Iyer', isOnline:false, subjects:['English']},
            ]).map((t:any,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/60">
                <div>
                  <div className="font-medium">{t.displayName || t.name || 'Teacher '+(i+1)}</div>
                  <div className="text-xs text-muted-foreground">{(t.subjects||['General']).join(', ')}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Active' : 'Offline'}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Admin-only online/offline presence tracking.</p>
        </CardContent>
      </Card>
    )}

    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardTitle>Recent Activities</CardTitle>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>09:04 – Class 9-B attendance closed (AI camera 34/36)</li>
            <li>08:47 – Marks published: Science UT-2 – Class 10</li>
            <li>08:30 – WhatsApp absent alerts sent (23)</li>
            <li>08:12 – Teacher late alert: Maths 10-A – 7 min</li>
            <li>07:55 – Holiday calendar sync – No holiday today</li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardTitle>Quick Actions</CardTitle>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Mark Attendance','Add Student','Enter Marks','Send WhatsApp','Export Report','AI Predict'].map(a=><span key={a} className="px-3 py-1.5 rounded-full bg-muted text-sm hover:bg-muted/70 cursor-pointer">{a}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
}
