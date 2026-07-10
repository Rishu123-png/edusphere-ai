import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'

const days = ['Mon','Tue','Wed','Thu','Fri','Sat']
const slots = ['08:30-09:15','09:15-10:00','10:15-11:00','11:00-11:45','12:30-13:15']

export default function SchedulePage(){
  const [teacher, setTeacher] = useState('Priya Sharma – Maths – 10-A')
  return <div className="space-y-5">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold">Class Schedule System</h1><p className="text-sm text-muted-foreground">Admin schedules classes • Teacher gets 5-min attendance window • Late alert to admin</p></div>
      <Button onClick={()=>toast('Schedule published – teachers notified')}>Publish Schedule</Button>
    </div>

    <Card>
      <CardTitle>Weekly Timetable – 10-A</CardTitle>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead><tr><th className="border p-2 text-left">Time</th>{days.map(d=><th key={d} className="border p-2">{d}</th>)}</tr></thead>
            <tbody>
              {slots.map(slot=>(
                <tr key={slot}>
                  <td className="border p-2 font-medium">{slot}</td>
                  {days.map(d=>(
                    <td key={d} className="border p-2">
                      <select className="w-full bg-background text-xs border rounded px-1 py-1">
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
        <p className="text-xs text-muted-foreground mt-3">• If holiday in calendar → auto off, no notifications. • Attendance window: 5 min after start. Late → admin alert.</p>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 gap-4">
      <Card><CardTitle>Assign Teacher to Subject</CardTitle><CardContent>
        <select className="border rounded-xl px-3 py-2 w-full bg-background text-sm mb-2" value={teacher} onChange={e=>setTeacher(e.target.value)}>
          <option>Priya Sharma – Maths – 10-A</option>
          <option>Rahul Verma – Science – 10-A</option>
        </select>
        <Button size="sm" onClick={()=>toast('Teacher assigned')}>Assign</Button>
      </CardContent></Card>
      <Card><CardTitle>Attendance Window Monitor</CardTitle><CardContent className="text-sm">
        <p>Next: 10-A Maths 09:15 – attendance opens 09:15-09:20</p>
        <p className="text-amber-600">Yesterday late: 3 teachers – alerts sent</p>
      </CardContent></Card>
    </div>
  </div>
}
