import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'

const days = ['Mon','Tue','Wed','Thu','Fri','Sat']
const slots = ['08:30-09:15','09:15-10:00','10:15-11:00','11:00-11:45','12:30-13:15']

export default function SchedulePage(){
  const [teacher, setTeacher] = useState('Priya Sharma – Maths – 10-A')
  return <div className="page-container space-y-4">
    <PageHeader title="Schedule" subtitle="Admin schedules • 5-min window • Late alert" action={<Button variant="gradient" size="sm" className="rounded-full h-11" onClick={()=>toast('Schedule published – teachers notified')}>Publish</Button>} />

    <Card className="rounded-[24px] overflow-hidden">
      <CardTitle>Weekly Timetable – 10-A</CardTitle>
      <CardContent className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="min-w-[600px]">
          <table className="w-full text-[12px] border-collapse">
            <thead><tr><th className="border border-slate-100 dark:border-zinc-800 p-2 text-left rounded-tl-xl bg-slate-50 dark:bg-zinc-800">Time</th>{days.map(d=><th key={d} className="border border-slate-100 dark:border-zinc-800 p-2 bg-slate-50 dark:bg-zinc-800">{d}</th>)}</tr></thead>
            <tbody>
              {slots.map(slot=>(
                <tr key={slot}>
                  <td className="border border-slate-100 dark:border-zinc-800 p-2 font-medium bg-slate-50/50 dark:bg-zinc-800/30">{slot}</td>
                  {days.map(d=>(
                    <td key={d} className="border border-slate-100 dark:border-zinc-800 p-1">
                      <select className="w-full bg-white dark:bg-zinc-900 text-[11px] border border-slate-200 dark:border-zinc-700 rounded-full px-2 py-1.5">
                        <option>Maths – Priya</option>
                        <option>Science – Rahul</option>
                        <option>English – Sneha</option>
                        <option>Free</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Holiday → auto off, no notifications. Attendance window: 5 min after start. Late → admin alert.</p>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[20px]"><CardTitle>Assign Teacher</CardTitle><CardContent>
        <select className="border rounded-full px-4 h-11 w-full bg-white dark:bg-zinc-900 text-[13px] mb-3" value={teacher} onChange={e=>setTeacher(e.target.value)}>
          <option>Priya Sharma – Maths – 10-A</option>
          <option>Rahul Verma – Science – 10-A</option>
        </select>
        <Button size="sm" variant="gradient" className="rounded-full w-full" onClick={()=>toast('Teacher assigned')}>Assign</Button>
      </CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Window Monitor</CardTitle><CardContent className="text-[13px] space-y-2">
        <p>Next: 10-A Maths 09:15 – opens 09:15-09:20</p>
        <p className="text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl">Yesterday late: 3 teachers – alerts sent</p>
      </CardContent></Card>
    </div>
  </div>
}
