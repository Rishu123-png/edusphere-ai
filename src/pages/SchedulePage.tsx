import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'

const days = ['Mon','Tue','Wed','Thu','Fri','Sat']
const slots = ['08:30-09:15','09:15-10:00','10:15-11:00','11:00-11:45','12:30-13:15']

export default function SchedulePage(){
  const { schoolId } = useSchool()
  const [teachers, setTeachers] = useState<any[]>([])
  const [teacher, setTeacher] = useState('')

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/teachers` : 'users'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v).map(([id,t]:any)=>({uid:t.uid||id, ...t})).filter((t:any)=> schoolId ? true : t.role === 'teacher')
      setTeachers(list)
    })
    return ()=>unsub()
  }, [schoolId])

  const teacherOptions = useMemo(()=> teachers.flatMap((t:any)=>{
    const name = t.displayName || t.name || 'Teacher'
    const subjects = t.subjects?.length ? t.subjects : ['General']
    const classes = t.assignedClasses?.length ? t.assignedClasses : ['Unassigned']
    return subjects.flatMap((sub:string)=> classes.map((cls:string)=>`${sub} – ${name} – ${cls}`))
  }), [teachers])

  useEffect(()=>{
    if(!teacher && teacherOptions.length) setTeacher(teacherOptions[0])
  }, [teacher, teacherOptions])

  return <div className="page-container space-y-4">
    <PageHeader title="Schedule" subtitle="Admin schedules • 5-min window • Late alert" action={<Button variant="gradient" size="sm" className="rounded-full h-11" onClick={()=>toast('Schedule published – teachers notified')}>Publish</Button>} />

    <Card className="rounded-[24px] overflow-hidden">
      <CardTitle>Weekly Timetable</CardTitle>
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
                        {teacherOptions.map(opt=><option key={opt}>{opt}</option>)}
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
          {teacherOptions.map(opt=><option key={opt}>{opt}</option>)}
          {!teacherOptions.length && <option>No teachers added yet</option>}
        </select>
        <Button size="sm" variant="gradient" className="rounded-full w-full" onClick={()=>toast(teacherOptions.length ? 'Teacher assigned' : 'Add teachers first')} disabled={!teacherOptions.length}>Assign</Button>
      </CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Window Monitor</CardTitle><CardContent className="text-[13px] space-y-2 text-muted-foreground">
        <p>No demo schedule alerts. Publish a real timetable to monitor attendance windows.</p>
      </CardContent></Card>
    </div>
  </div>
}
