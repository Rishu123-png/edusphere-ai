import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { db } from '@/lib/firebase'
import { ref, onValue, set } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'

const days = ['Mon','Tue','Wed','Thu','Fri','Sat']
const slots = ['08:30-09:15','09:15-10:00','10:15-11:00','11:00-11:45','12:30-13:15']

type CellKey = string // `${day}|${slot}`

export default function SchedulePage(){
  const { schoolId } = useSchool()
  const { profile, isSchoolAdmin } = useAuth() as any
  const isAdmin = isSchoolAdmin || profile?.role === 'super_admin'
  const isTeacher = profile?.role === 'teacher'

  const [teachers, setTeachers] = useState<any[]>([])
  const [grid, setGrid] = useState<Record<CellKey, string>>({})
  const [saving, setSaving] = useState(false)
  const [todayHoliday, setTodayHoliday] = useState<any | null>(null)

  useEffect(()=>{
    if(!schoolId) return
    const unsub = onValue(ref(db, `schools/${schoolId}/teachers`), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v).map(([id,t]:any)=>({uid:t.uid||id, ...t}))
      setTeachers(list)
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setGrid({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/schedule`), snap=>{
      setGrid(snap.val() || {})
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

  const teacherOptions = useMemo(()=> teachers.flatMap((t:any)=>{
    const name = t.displayName || t.name || 'Teacher'
    const subjects = t.subjects?.length ? t.subjects : ['General']
    const classes = t.assignedClasses?.length ? t.assignedClasses : ['Unassigned']
    return subjects.flatMap((sub:string)=> classes.map((cls:string)=>`${sub} – ${name} – ${cls}`))
  }), [teachers])

  // Teacher view: only their own periods
  const myNameBits = useMemo(() => {
    if (!isTeacher) return [] as string[]
    const n = profile?.displayName || profile?.name || ''
    return [n, profile?.email].filter(Boolean).map((x: string) => String(x).toLowerCase())
  }, [isTeacher, profile])

  const cellKey = (d: string, slot: string) => `${d}|${slot}`

  const setCell = (d: string, slot: string, value: string) => {
    if (!isAdmin) return
    setGrid(prev => ({ ...prev, [cellKey(d, slot)]: value }))
  }

  const publish = async () => {
    if (!isAdmin) { toast.error('Only School Admin can edit schedule'); return }
    if (!schoolId) { toast.error('No school linked'); return }
    if (todayHoliday) {
      toast.error(`Today is holiday (${todayHoliday.title || todayHoliday.name}). Schedule stays off.`)
      return
    }
    setSaving(true)
    try {
      await set(ref(db, `schools/${schoolId}/schedule`), {
        ...grid,
        _meta: {
          publishedAt: Date.now(),
          publishedBy: profile?.uid || '',
          publishedByName: profile?.displayName || profile?.email || '',
        }
      })
      toast.success('Schedule published — teachers can view their timetable')
    } catch (e: any) {
      toast.error(e?.message || 'Could not publish schedule')
    } finally {
      setSaving(false)
    }
  }

  const displayValue = (d: string, slot: string) => {
    const v = grid[cellKey(d, slot)] || ''
    if (!isTeacher) return v
    if (!v || v === 'Free') return 'Free'
    // Show only if this teacher is named in the cell
    const lower = v.toLowerCase()
    const mine = myNameBits.some(b => b && lower.includes(b))
    return mine ? v : '—'
  }

  return <div className="page-container space-y-4">
    <PageHeader
      title="Schedule"
      subtitle={isAdmin ? 'Admin edit • Publish for teachers' : 'View only • Your classes'}
      action={isAdmin ? (
        <Button variant="gradient" size="sm" className="rounded-full h-11" onClick={publish} disabled={saving || !!todayHoliday}>
          {saving ? 'Publishing…' : 'Publish'}
        </Button>
      ) : undefined}
    />

    {todayHoliday && (
      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100 text-[13px]">
        🏖 <b>Holiday today:</b> {todayHoliday.title || todayHoliday.name}. Schedule system is off — no teacher attendance windows or notifications for this day.
      </div>
    )}

    {!isAdmin && (
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-[13px] border border-blue-100 dark:border-blue-900/40">
        View only. School Admin publishes the timetable. Your periods are highlighted; other slots show —.
      </div>
    )}

    <Card className="rounded-[24px] overflow-hidden">
      <CardTitle>Weekly Timetable</CardTitle>
      <CardContent className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="min-w-[600px]">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th className="border border-slate-100 dark:border-zinc-800 p-2 text-left rounded-tl-xl bg-slate-50 dark:bg-zinc-800">Time</th>
                {days.map(d=><th key={d} className="border border-slate-100 dark:border-zinc-800 p-2 bg-slate-50 dark:bg-zinc-800">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {slots.map(slot=>(
                <tr key={slot}>
                  <td className="border border-slate-100 dark:border-zinc-800 p-2 font-medium bg-slate-50/50 dark:bg-zinc-800/30">{slot}</td>
                  {days.map(d=>{
                    const key = cellKey(d, slot)
                    const value = grid[key] || 'Free'
                    if (isAdmin) {
                      return (
                        <td key={d} className="border border-slate-100 dark:border-zinc-800 p-1">
                          <select
                            className="w-full bg-white dark:bg-zinc-900 text-[11px] border border-slate-200 dark:border-zinc-700 rounded-full px-2 py-1.5"
                            value={value}
                            onChange={e=>setCell(d, slot, e.target.value)}
                            disabled={!!todayHoliday}
                          >
                            <option value="Free">Free</option>
                            {teacherOptions.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </td>
                      )
                    }
                    const shown = displayValue(d, slot)
                    const mine = shown !== '—' && shown !== 'Free'
                    return (
                      <td key={d} className={`border border-slate-100 dark:border-zinc-800 p-2 text-[11px] ${mine ? 'bg-indigo-50 dark:bg-indigo-950/30 font-semibold' : 'text-muted-foreground'}`}>
                        {shown || 'Free'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          {isAdmin
            ? 'Holiday days auto-disable schedule & teacher notifications. Attendance window: 5 min after start when school is open.'
            : 'Contact School Admin to change the timetable.'}
        </p>
      </CardContent>
    </Card>

    {isAdmin && (
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="rounded-[20px]">
          <CardTitle>Assign Teacher</CardTitle>
          <CardContent className="text-[13px] text-muted-foreground space-y-2">
            <p>Use the timetable dropdowns above, then press <b>Publish</b> so teachers see their schedule.</p>
            <p className="text-[12px]">{teacherOptions.length} teacher-class options loaded from Teachers page.</p>
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardTitle>Window Monitor</CardTitle>
          <CardContent className="text-[13px] space-y-2 text-muted-foreground">
            {todayHoliday
              ? <p>Schedule off today (holiday).</p>
              : <p>On working days, attendance windows follow published periods. Late marking can notify admin.</p>}
          </CardContent>
        </Card>
      </div>
    )}
  </div>
}
