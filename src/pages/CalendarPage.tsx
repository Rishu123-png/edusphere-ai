import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/mobile/PageHeader'
import { CalendarDays, PartyPopper } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'

export default function CalendarPage(){
  const { schoolId } = useSchool()
  const [events, setEvents] = useState<any[]>([])

  useEffect(()=>{
    if(!schoolId){ setEvents([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/events`), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, e]:any)=>({ id, ...e }))
        .sort((a:any,b:any)=> String(a.date||'').localeCompare(String(b.date||'')))
      setEvents(list)
    })
    return ()=>unsub()
  }, [schoolId])

  const upcoming = events.filter((e:any)=> !e.date || e.date >= new Date().toISOString().slice(0,10)).slice(0,5)

  return <div className="page-container space-y-4">
    <PageHeader title="Calendar" subtitle="Events • Holidays • Exams from your school data" />
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><CalendarDays size={18}/> School Calendar</CardTitle>
        <CardContent>
          {events.length ? (
            <ul className="text-[13px] space-y-3">
              {events.map(e=>(
                <li key={e.id} className="flex gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold h-fit ${e.type==='holiday'?'bg-red-100 text-red-600': e.type==='exam'?'bg-amber-100 text-amber-700':'bg-indigo-100 text-indigo-700'}`}>{e.type || 'event'}</span>
                  <span><b>{e.date || '—'}</b> – {e.title || e.name || 'Event'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground p-4 rounded-xl bg-slate-50 dark:bg-zinc-800">
              No calendar events saved yet. Add events under <code>schools/&#123;schoolId&#125;/events</code> or from Settings when event management is enabled.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">Holiday entries can be used to disable schedule notifications.</p>
        </CardContent>
      </Card>
      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><PartyPopper size={18}/> Upcoming</CardTitle>
        <CardContent className="text-[13px] space-y-2.5">
          {upcoming.length ? upcoming.map(e=>(
            <div key={e.id} className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800">
              <div className="font-bold">{e.title || e.name || 'Event'}</div>
              <div className="text-[12px] text-muted-foreground">{e.date || 'Date TBA'}{e.note ? ` • ${e.note}` : ''}</div>
            </div>
          )) : (
            <p className="text-muted-foreground">No upcoming events.</p>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
}
