import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  {name:'Mon', present:92},{name:'Tue', present:88},{name:'Wed', present:94},{name:'Thu', present:90},{name:'Fri', present:86},{name:'Sat', present:78}
];

export default function DashboardPage(){
  const { profile } = useAuth();
  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Smart AI Dashboard</h1>
      <p className="text-muted-foreground">Real-time school pulse • Role: {profile?.role}</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        ['Total Students','1,248'],
        ['Total Teachers','64'],
        ['Today Present','1,142'],
        ['Attendance %','91.5%'],
        ['Late Today','18'],
        ['Leave','23'],
        ['At Risk','12'],
        ['Top Performers','47'],
      ].map(([k,v])=>
        <Card key={k}><CardTitle className="text-sm text-muted-foreground">{k}</CardTitle><div className="text-2xl font-bold mt-1">{v}</div></Card>
      )}
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-2"><CardTitle>Attendance Trend</CardTitle>
        <div className="h-64 mt-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="present" radius={8} fill="hsl(var(--primary))"/></BarChart></ResponsiveContainer></div>
      </Card>
      <Card><CardTitle>AI Daily Summary</CardTitle>
        <CardContent className="text-sm space-y-2 pt-3 px-0">
          <p>• 91.5% overall attendance – above CBSE 75% threshold.</p>
          <p>• 12 students flagged at-risk (&lt;75%).</p>
          <p>• Class 10-A needs revision in Maths.</p>
          <p>• 3 teachers marked attendance late – notifications sent.</p>
          <p>• Suggested parent meetings: 6</p>
        </CardContent>
      </Card>
    </div>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><CardTitle>Recent Activities</CardTitle><ul className="text-sm mt-2 space-y-1 text-muted-foreground">
        <li>09:04 – Class 9-B attendance closed</li>
        <li>08:47 – Marks published: Science UT-2</li>
        <li>08:30 – WhatsApp absent alerts sent (23)</li>
      </ul></Card>
      <Card><CardTitle>Quick Actions</CardTitle>
        <div className="flex flex-wrap gap-2 mt-3 text-sm">
          {['Mark Attendance','Add Student','Enter Marks','Send WhatsApp','Export Report'].map(a=><span key={a} className="px-3 py-1.5 rounded-full bg-muted">{a}</span>)}
        </div>
      </Card>
    </div>
  </div>
}
