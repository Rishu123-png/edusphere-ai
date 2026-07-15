import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PageHeader from '@/components/mobile/PageHeader'
import { CalendarDays, PartyPopper, Plus, Trash2, Pencil } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue, set, remove, push, update } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { todayIST } from '@/lib/rtdb'

export default function CalendarPage(){
  const { schoolId } = useSchool()
  const { profile, isSchoolAdmin } = useAuth() as any
  const isAdmin = isSchoolAdmin || profile?.role === 'super_admin'

  const [events, setEvents] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', date: todayIST(), type: 'holiday', note: '' })

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

  const today = todayIST()
  const todayHoliday = useMemo(
    () => events.find(e => e.type === 'holiday' && e.date === today) || null,
    [events, today]
  )
  const upcoming = events.filter((e:any)=> !e.date || e.date >= today).slice(0,8)

  const resetForm = () => {
    setEditing(null)
    setForm({ title: '', date: todayIST(), type: 'holiday', note: '' })
    setOpen(false)
  }

  const saveEvent = async () => {
    if (!isAdmin) { toast.error('Only School Admin can edit calendar'); return }
    if (!schoolId) { toast.error('No school linked'); return }
    if (!form.title.trim() || !form.date) { toast.error('Title and date required'); return }

    const id = editing?.id || push(ref(db, `schools/${schoolId}/events`)).key
    if (!id) return

    const payload = {
      id,
      title: form.title.trim(),
      date: form.date,
      type: form.type, // holiday | exam | meeting | event
      note: form.note || '',
      updatedAt: Date.now(),
      createdAt: editing?.createdAt || Date.now(),
      createdBy: editing?.createdBy || profile?.uid || '',
      createdByName: editing?.createdByName || profile?.displayName || profile?.email || '',
    }

    await set(ref(db, `schools/${schoolId}/events/${id}`), payload)

    // Notify school (admin + teachers can read notifications list)
    try {
      const nRef = push(ref(db, `schools/${schoolId}/notifications`))
      const isHoliday = form.type === 'holiday'
      await set(nRef, {
        id: nRef.key,
        schoolId,
        title: isHoliday ? 'Holiday declared' : 'Calendar updated',
        body: isHoliday
          ? `${form.date}: ${form.title} — school holiday. Schedule & teacher alerts off for this day.`
          : `${form.date}: ${form.title} (${form.type})`,
        type: isHoliday ? 'alert' : 'announcement',
        read: false,
        createdAt: Date.now(),
        meta: { eventId: id, date: form.date, eventType: form.type },
      })
    } catch { /* ignore */ }

    toast.success(editing ? 'Event updated' : form.type === 'holiday' ? 'Holiday saved — schedule off that day' : 'Event saved')
    resetForm()
  }

  const startEdit = (e: any) => {
    if (!isAdmin) return
    setEditing(e)
    setForm({
      title: e.title || e.name || '',
      date: e.date || todayIST(),
      type: e.type || 'event',
      note: e.note || '',
    })
    setOpen(true)
  }

  const deleteEvent = async (e: any) => {
    if (!isAdmin) { toast.error('Only School Admin can delete events'); return }
    if (!confirm(`Delete "${e.title || e.name}"?`)) return
    await remove(ref(db, `schools/${schoolId}/events/${e.id}`))
    toast.success('Deleted')
  }

  return <div className="page-container space-y-4">
    <PageHeader
      title="Calendar"
      subtitle={isAdmin ? 'Admin: add holidays & events' : 'View only • Holidays & events'}
      action={isAdmin ? (
        <Button variant="gradient" size="sm" className="rounded-full h-11" onClick={()=>{ setEditing(null); setForm({ title:'', date: todayIST(), type:'holiday', note:'' }); setOpen(true) }}>
          <Plus size={16} className="mr-1"/> Add
        </Button>
      ) : undefined}
    />

    {todayHoliday && (
      <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 text-red-800 dark:text-red-200 text-[13px]">
        🏖 <b>Today is a holiday:</b> {todayHoliday.title}. Schedule system is off — teachers will not get attendance window notifications.
      </div>
    )}

    {!isAdmin && (
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-[13px]">
        View only. School Admin manages holidays and events.
      </div>
    )}

    {isAdmin && open && (
      <Card className="rounded-[24px] border-indigo-100 dark:border-indigo-900/40">
        <CardTitle>{editing ? 'Edit event' : 'Add holiday / event'}</CardTitle>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-[12px]">Title *</Label>
              <Input className="mt-1 h-12 rounded-xl" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Independence Day" />
            </div>
            <div>
              <Label className="text-[12px]">Date *</Label>
              <Input className="mt-1 h-12 rounded-xl" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
            </div>
            <div>
              <Label className="text-[12px]">Type</Label>
              <select
                className="mt-1 h-12 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3"
                value={form.type}
                onChange={e=>setForm({...form, type:e.target.value})}
              >
                <option value="holiday">Holiday (schedule off)</option>
                <option value="exam">Exam</option>
                <option value="meeting">Meeting</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <Label className="text-[12px]">Note</Label>
              <Input className="mt-1 h-12 rounded-xl" value={form.note} onChange={e=>setForm({...form, note:e.target.value})} placeholder="Optional" />
            </div>
          </div>
          {form.type === 'holiday' && (
            <p className="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl">
              Holiday days automatically turn schedule off and stop teacher period notifications for that date.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="rounded-full" onClick={resetForm}>Cancel</Button>
            <Button variant="gradient" className="rounded-full" onClick={saveEvent}>{editing ? 'Update' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>
    )}

    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><CalendarDays size={18}/> School Calendar</CardTitle>
        <CardContent>
          {events.length ? (
            <ul className="text-[13px] space-y-3">
              {events.map(e=>(
                <li key={e.id} className="flex gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 items-start">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold h-fit ${e.type==='holiday'?'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300': e.type==='exam'?'bg-amber-100 text-amber-700':'bg-indigo-100 text-indigo-700'}`}>{e.type || 'event'}</span>
                  <span className="flex-1 min-w-0">
                    <b>{e.date || '—'}</b> – {e.title || e.name || 'Event'}
                    {e.note ? <div className="text-[11px] text-muted-foreground mt-0.5">{e.note}</div> : null}
                  </span>
                  {isAdmin && (
                    <span className="flex gap-1 shrink-0">
                      <button className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border flex items-center justify-center" onClick={()=>startEdit(e)}><Pencil size={14}/></button>
                      <button className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border flex items-center justify-center text-red-500" onClick={()=>deleteEvent(e)}><Trash2 size={14}/></button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground p-4 rounded-xl bg-slate-50 dark:bg-zinc-800">
              {isAdmin ? 'No events yet. Tap Add to create a holiday or school event.' : 'No calendar events yet.'}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">
            Holiday auto-disables schedule & teacher notifications for that day.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><PartyPopper size={18}/> Upcoming</CardTitle>
        <CardContent className="text-[13px] space-y-2.5">
          {upcoming.length ? upcoming.map(e=>(
            <div key={e.id} className={`p-3 rounded-xl ${e.type==='holiday' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white' : 'bg-slate-50 dark:bg-zinc-800'}`}>
              <div className="font-bold">{e.title || e.name || 'Event'}</div>
              <div className={`text-[12px] ${e.type==='holiday' ? 'text-white/80' : 'text-muted-foreground'}`}>
                {e.date || 'Date TBA'} • {e.type || 'event'}{e.note ? ` • ${e.note}` : ''}
              </div>
            </div>
          )) : (
            <p className="text-muted-foreground">No upcoming events.</p>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
}
