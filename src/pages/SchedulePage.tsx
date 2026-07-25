import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { db } from '@/lib/firebase'
import { ref, onValue, set, get } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'
import { useNavigate } from 'react-router-dom'
import { Play, Clock, CalendarDays, Save, AlertTriangle, Plus, Trash2, Pencil, X, Check } from 'lucide-react'

const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Slot = { label: string; tag?: string }
type CellValue = { subject: string; teacherId?: string; teacherName?: string; className?: string; tag?: string }
type ClassSchedule = {
  slots: Slot[]
  days: string[]
  grid: Record<string, CellValue | null>
  _meta?: { publishedAt: number; publishedBy: string; publishedByName: string }
}
type AllSchedules = Record<string, ClassSchedule> // keyed by classKey e.g. "12-A1"

const BREAK_TAGS = ['Lunch', 'Break', 'Assembly', 'PT', 'Library']
const DEFAULT_SLOTS: Slot[] = [
  { label: '08:00-08:45' }, { label: '08:45-09:30' }, { label: '09:45-10:30' },
  { label: '10:30-11:15' }, { label: '11:15-12:00', tag: 'Lunch' },
  { label: '13:00-13:45' }, { label: '13:45-14:30' },
]

const cellKey = (d: string, i: number) => `${d}|${i}`

function parseCell(raw: any): CellValue | null {
  if (!raw) return null
  if (typeof raw === 'object' && raw.subject) return raw as CellValue
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s === 'Free') return null
  const parts = s.split(/[–—-]/).map(p => p.trim())
  return { subject: parts[0] || s, teacherName: parts[1], className: parts[2] }
}

function formatCell(c: CellValue | null): string {
  if (!c) return 'Free'
  if (BREAK_TAGS.includes(c.subject)) return c.subject
  return [c.subject, c.teacherName, c.className].filter(Boolean).join(' – ')
}

function parseTimeRange(label: string) {
  const [start, end] = label.split('-')
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return null
  return { startMin: sh*60+sm, endMin: eh*60+em }
}

function validTimeLabel(label: string) {
  return /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(label.trim())
}

function nowISTMinutes() {
  const d = new Date()
  const ist = new Date(d.getTime() + (5*60+30)*60*1000 + d.getTimezoneOffset()*60*1000)
  return ist.getHours()*60 + ist.getMinutes()
}

function weekdayIST(): string {
  const d = new Date()
  const ist = new Date(d.getTime() + (5*60+30)*60*1000 + d.getTimezoneOffset()*60*1000)
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][ist.getDay()]
}

export default function SchedulePage(){
  const navigate = useNavigate()
  const { schoolId } = useSchool()
  const { profile, isSchoolAdmin } = useAuth() as any
  const isAdmin = isSchoolAdmin || profile?.role === 'super_admin'
  const isTeacher = profile?.role === 'teacher'
  const isStudentOrParent = profile?.role === 'student' || profile?.role === 'parent'
  const canEdit = isAdmin

  const [teachers, setTeachers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<AllSchedules>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [todayHoliday, setTodayHoliday] = useState<any | null>(null)
  const [activeClass, setActiveClass] = useState<string>('')
  const [editingSlots, setEditingSlots] = useState(false)
  const [dirty, setDirty] = useState<Set<string>>(new Set()) // set of classKeys that are dirty
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty

  // --- Load teachers ---
  useEffect(() => {
    if (!schoolId) return
    const unsub = onValue(ref(db, `schools/${schoolId}/teachers`), snap => {
      const v = snap.val() || {}
      setTeachers(Object.entries(v).map(([id,t]:any)=>({ uid: t.uid||id, id, ...t })))
    })
    return () => unsub()
  }, [schoolId])

  // --- Build the list of classes (union from teacher assignments, students, and existing schedules) ---
  const classes = useMemo(() => {
    const set = new Set<string>()
    teachers.forEach((t:any) => (t.assignedClasses||[]).forEach((c:string) => c && set.add(c)))
    if (isStudentOrParent && profile?.className) set.add(`${profile.className}${profile.section?'-'+profile.section:''}`)
    Object.keys(schedules).forEach(k => set.add(k))
    return [...set].sort()
  }, [teachers, schedules, isStudentOrParent, profile])

  // --- Migrate legacy "schedule" node to schedules/{class} on first load ---
  const migratedRef = useRef(false)
  useEffect(() => {
    if (!schoolId || migratedRef.current) return
    migratedRef.current = true
    ;(async () => {
      try {
        const legacySnap = await get(ref(db, `schools/${schoolId}/schedule`))
        const legacy = legacySnap.val()
        if (!legacy) return
        // find any class name embedded in legacy cells to use as target
        let targetClass = ''
        Object.values(legacy).forEach((v:any) => {
          const c = parseCell(v)
          if (c?.className) targetClass = c.className
        })
        if (!targetClass) targetClass = 'Default'
        const schSnap = await get(ref(db, `schools/${schoolId}/schedules/${targetClass}`))
        if (!schSnap.exists()) {
          await set(ref(db, `schools/${schoolId}/schedules/${targetClass}`), {
            slots: DEFAULT_SLOTS, days: DEFAULT_DAYS,
            grid: Object.fromEntries(Object.entries(legacy).filter(([k])=>!k.startsWith('_')).map(([k,v])=>[k, parseCell(v)])) as any,
            _meta: legacy._meta || null,
          })
          toast.info(`Migrated old timetable to "${targetClass}" section.`)
        }
      } catch(e) { console.warn('legacy schedule migration', e) }
    })()
  }, [schoolId])

  // --- Load schedules ---
  useEffect(() => {
    if (!schoolId) { setSchedules({}); setLoading(false); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/schedules`), snap => {
      const v = snap.val() || {}
      const parsed: AllSchedules = {}
      Object.entries(v).forEach(([cls, raw]:[string,any]) => {
        if (!raw) return
        parsed[cls] = {
          slots: Array.isArray(raw.slots) && raw.slots.length ? raw.slots : DEFAULT_SLOTS,
          days: Array.isArray(raw.days) && raw.days.length ? raw.days : DEFAULT_DAYS,
          grid: Object.fromEntries(Object.entries(raw.grid||{}).map(([k,v])=>[k, parseCell(v)])) as any,
          _meta: raw._meta,
        }
      })
      setSchedules(parsed)
      setLoading(false)
    })
    return () => unsub()
  }, [schoolId])

  // --- Active class auto-select ---
  useEffect(() => {
    if (loading) return
    if (isStudentOrParent) {
      const mine = profile?.className ? `${profile.className}${profile.section?'-'+profile.section:''}` : ''
      setActiveClass(prev => prev || (classes.includes(mine) ? mine : classes[0] || ''))
    } else if (isTeacher) {
      setActiveClass(prev => prev || classes[0] || '')
    } else {
      setActiveClass(prev => prev || classes[0] || '')
    }
  }, [loading, classes, isStudentOrParent, isTeacher, profile])

  // --- Holiday check ---
  useEffect(() => {
    if (!schoolId) { setTodayHoliday(null); return }
    const check = () => {
      const today = todayIST()
      const unsub = onValue(ref(db, `schools/${schoolId}/events`), snap => {
        const v = snap.val() || {}
        const holiday = Object.values(v).find((e:any)=> e?.type==='holiday' && e?.date===today) as any
        setTodayHoliday(holiday||null)
      })
      return unsub
    }
    const u = check(); const i = setInterval(check, 60*1000)
    return () => { u(); clearInterval(i) }
  }, [schoolId])

  // --- Teacher identity ---
  const myTeacherIds = useMemo(() => {
    if (!isTeacher) return new Set<string>()
    const ids = new Set<string>()
    const names = [profile?.displayName, profile?.name].filter(Boolean).map((s:string)=>s.toLowerCase().trim())
    teachers.forEach(t => {
      if (t.uid === profile?.uid) ids.add(t.id)
      const n = String(t.displayName||t.name||'').toLowerCase().trim()
      if (names.some(nm => nm === n)) ids.add(t.id)
    })
    return ids
  }, [isTeacher, teachers, profile])

  // --- Clock ---
  const [nowMin, setNowMin] = useState(nowISTMinutes())
  const [today, setToday] = useState(weekdayIST())
  useEffect(() => {
    const i = setInterval(() => { setNowMin(nowISTMinutes()); setToday(weekdayIST()) }, 30*1000)
    return () => clearInterval(i)
  }, [])

  // --- Get current schedule (the active class) with safe defaults ---
  const current: ClassSchedule = useMemo(() => {
    const s = schedules[activeClass]
    return s || { slots: DEFAULT_SLOTS, days: DEFAULT_DAYS, grid: {} }
  }, [schedules, activeClass])

  const teacherOptions = useMemo(() => {
    const opts: { key: string; label: string; teacherId: string; teacherName: string; subject: string; cls: string }[] = []
    teachers.forEach((t:any) => {
      const name = t.displayName||t.name||'Teacher'
      const subs = t.subjects?.length ? t.subjects : ['General']
      const clsList = t.assignedClasses?.length ? t.assignedClasses : [activeClass]
      subs.forEach((sub:string) => clsList.forEach((cls:string) => {
        opts.push({ key: `${t.id}|${sub}|${cls}`, label: `${sub} – ${name} – ${cls}`, teacherId: t.id, teacherName: name, subject: sub, cls })
      }))
    })
    return opts
  }, [teachers, activeClass])

  // --- Is a cell "mine" for the current viewer? ---
  const isCellMine = useCallback((c: CellValue | null, classKey?: string) => {
    if (!c) return false
    if (isTeacher) {
      if (c.teacherId && myTeacherIds.has(c.teacherId)) return true
      if (!c.teacherId && c.teacherName) {
        const nm = c.teacherName.toLowerCase().trim()
        return [profile?.displayName, profile?.name].filter(Boolean).some((n:string)=>n.toLowerCase().trim()===nm)
      }
      return false
    }
    if (isStudentOrParent) return !classKey || classKey === activeClass
    return true
  }, [isTeacher, isStudentOrParent, myTeacherIds, profile, activeClass])

  // --- Aggregated view for teachers: periods across all classes where they teach ---
  const myTodayPeriods = useMemo(() => {
    if (!isTeacher) return []
    const list: { slot: Slot; cell: CellValue; slotIdx: number; classKey: string }[] = []
    Object.entries(schedules).forEach(([ck, sch]) => {
      sch.slots.forEach((slot, i) => {
        const c = sch.grid[cellKey(today, i)]
        if (c && isCellMine(c, ck)) list.push({ slot, cell: c, slotIdx: i, classKey: ck })
      })
    })
    return list.sort((a,b) => {
      const ta = parseTimeRange(a.slot.label), tb = parseTimeRange(b.slot.label)
      return (ta?.startMin||0) - (tb?.startMin||0)
    })
  }, [isTeacher, schedules, today, isCellMine])

  // Live current/next period (uses teacher-aggregated view for teachers, active class for others)
  const { currentPeriod, nextPeriod } = useMemo(() => {
    if (todayHoliday || !DEFAULT_DAYS.includes(today)) return { currentPeriod: null, nextPeriod: null }
    if (isTeacher) {
      let cur=null, nxt=null
      for (const p of myTodayPeriods) {
        const t = parseTimeRange(p.slot.label); if (!t) continue
        if (nowMin >= t.startMin && nowMin < t.endMin && !BREAK_TAGS.includes(p.cell.subject)) { cur = { ...p, ...t }; break }
      }
      for (const p of myTodayPeriods) {
        const t = parseTimeRange(p.slot.label); if (!t) continue
        if (t.startMin > nowMin && !BREAK_TAGS.includes(p.cell.subject)) { nxt = { ...p, ...t, startMin: t.startMin }; break }
      }
      return { currentPeriod: cur, nextPeriod: nxt }
    }
    // Admin/student/parent: use active class
    let cur=null, nxt=null
    const slots = current.slots
    for (let i = 0; i < slots.length; i++) {
      const t = parseTimeRange(slots[i].label); if (!t) continue
      const c = current.grid[cellKey(today, i)]
      if (nowMin >= t.startMin && nowMin < t.endMin && c && !BREAK_TAGS.includes(c.subject)) { cur = { slot: slots[i], cell: c, slotIdx: i, ...t }; break }
    }
    for (let i = 0; i < slots.length; i++) {
      const t = parseTimeRange(slots[i].label); if (!t) continue
      const c = current.grid[cellKey(today, i)]
      if (t.startMin > nowMin && c && !BREAK_TAGS.includes(c.subject)) { nxt = { slot: slots[i], cell: c, slotIdx: i, startMin: t.startMin }; break }
    }
    return { currentPeriod: cur, nextPeriod: nxt }
  }, [todayHoliday, today, isTeacher, myTodayPeriods, current, nowMin])

  // --- Unsaved changes warning ---
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current.size > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const markDirty = (classKey: string) => setDirty(prev => new Set(prev).add(classKey))
  const unmarkDirty = (classKey: string) => setDirty(prev => { const n = new Set(prev); n.delete(classKey); return n })

  // --- Mutations ---
  const setCell = (day: string, slotIdx: number, value: CellValue | null) => {
    if (!canEdit || !activeClass) return
    setSchedules(prev => {
      const sch = { ...(prev[activeClass] || { slots: DEFAULT_SLOTS, days: DEFAULT_DAYS, grid: {} }) }
      sch.grid = { ...sch.grid, [cellKey(day, slotIdx)]: value }
      return { ...prev, [activeClass]: sch }
    })
    markDirty(activeClass)
  }

  const addNewClass = () => {
    const name = window.prompt('Enter class-section name (e.g. 12-A1):')?.trim()
    if (!name) return
    if (schedules[name]) { toast.error(`${name} already exists`); return }
    setSchedules(prev => ({ ...prev, [name]: { slots: DEFAULT_SLOTS.map(s=>({...s})), days: [...DEFAULT_DAYS], grid: {} } }))
    setActiveClass(name)
    markDirty(name)
    toast.success(`Added section ${name}`)
  }

  const deleteClass = () => {
    if (!activeClass) return
    if (!window.confirm(`Delete timetable for ${activeClass}? This cannot be undone after publishing.`)) return
    setSchedules(prev => { const n = { ...prev }; delete n[activeClass]; return n })
    markDirty(activeClass)
    setActiveClass(classes.filter(c=>c!==activeClass)[0] || '')
    // also delete in firebase directly
    if (schoolId) set(ref(db, `schools/${schoolId}/schedules/${activeClass}`), null).catch(()=>{})
    toast.success(`${activeClass} removed`)
  }

  const addSlot = () => {
    if (!canEdit || !activeClass) return
    const sch = { ...(schedules[activeClass] || { slots: DEFAULT_SLOTS, days: DEFAULT_DAYS, grid: {} }) }
    sch.slots = [...sch.slots, { label: '14:30-15:15' }]
    setSchedules(prev => ({ ...prev, [activeClass]: sch }))
    markDirty(activeClass)
  }
  const removeSlot = (idx: number) => {
    if (!canEdit || !activeClass) return
    if (current.slots.length <= 1) { toast.error('Need at least one period'); return }
    const sch = { ...schedules[activeClass] }
    sch.slots = sch.slots.filter((_,i)=>i!==idx)
    // shift grid keys for slots after idx
    const newGrid: Record<string, CellValue|null> = {}
    Object.entries(sch.grid || {}).forEach(([k,v]) => {
      const [d, siStr] = k.split('|'); const si = parseInt(siStr,10)
      if (si === idx) return // dropped
      newGrid[cellKey(d, si > idx ? si-1 : si)] = v
    })
    sch.grid = newGrid
    setSchedules(prev => ({ ...prev, [activeClass]: sch }))
    markDirty(activeClass)
  }
  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    if (!canEdit || !activeClass) return
    const sch = { ...schedules[activeClass] }
    sch.slots = sch.slots.map((s,i)=> i===idx ? { ...s, ...patch } : s)
    setSchedules(prev => ({ ...prev, [activeClass]: sch }))
    markDirty(activeClass)
  }

  const publish = async () => {
    if (!canEdit || !schoolId) return
    if (!activeClass) { toast.error('Select a class first'); return }
    // Validate slots
    const sch = schedules[activeClass]
    for (let i=0;i<sch.slots.length;i++) {
      if (!validTimeLabel(sch.slots[i].label)) { toast.error(`Period ${i+1} has invalid time "${sch.slots[i].label}". Use HH:MM-HH:MM.`); return }
    }
    setSaving(true)
    try {
      const cleanGrid: Record<string,any> = {}
      Object.entries(sch.grid).forEach(([k,v]) => { if (v) cleanGrid[k] = v })
      const payload = {
        slots: sch.slots, days: sch.days || DEFAULT_DAYS, grid: cleanGrid,
        _meta: { publishedAt: Date.now(), publishedBy: profile?.uid||'', publishedByName: profile?.displayName||profile?.email||'' },
      }
      await set(ref(db, `schools/${schoolId}/schedules/${activeClass}`), payload)
      toast.success(`${activeClass} timetable published`)
      unmarkDirty(activeClass)
    } catch(e:any) { toast.error(e?.message||'Publish failed') }
    finally { setSaving(false) }
  }

  const startAttendance = (className?: string) => {
    if (!className) { toast.info('No class assigned'); return }
    navigate(`/attendance?class=${encodeURIComponent(className)}`)
  }

  // For teacher view, today card is aggregated
  const todayList = isTeacher
    ? myTodayPeriods
    : current.slots.map((s,i) => ({ slot: s, cell: current.grid[cellKey(today, i)] || null, slotIdx: i, classKey: activeClass }))

  if (loading) {
    return <div className="page-container"><div className="p-10 text-center text-white/60">Loading timetable…</div></div>
  }

  return <div className="page-container space-y-4">
    <PageHeader
      title="Schedule"
      subtitle={canEdit ? 'Per-section timetable editor' : 'Your class timetable'}
      action={canEdit ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-full h-11 bg-white/5 border-white/10 text-white" onClick={addNewClass}>
            <Plus size={14} className="mr-1"/> New class
          </Button>
          <Button size="sm" variant="gradient" className="rounded-full h-11" onClick={publish} disabled={saving}>
            <Save size={14} className="mr-1"/>{saving ? 'Publishing…' : `Publish ${activeClass||''}`}
          </Button>
        </div>
      ) : undefined}
    />

    {todayHoliday && (
      <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[13px] flex items-start gap-2">
        <CalendarDays size={16} className="shrink-0 mt-0.5"/>
        <div><b>Holiday today:</b> {todayHoliday.title||todayHoliday.name}. No classes scheduled.</div>
      </div>
    )}

    {/* Class selector */}
    <div className="flex flex-wrap items-center gap-2">
      <select value={activeClass} onChange={e=>setActiveClass(e.target.value)}
        className="h-10 rounded-full bg-white/10 dark:bg-white/10 bg-slate-100 text-slate-900 dark:text-white border border-white/15 px-3 text-[12px] outline-none">
        {classes.length === 0 && <option value="">No classes yet</option>}
        {classes.map(c => <option key={c} value={c}>{c}{dirty.has(c) ? ' • (unsaved)' : ''}</option>)}
      </select>
      {canEdit && activeClass && (
        <>
          <Button size="sm" variant="outline" className="h-10 rounded-full bg-white/5 border-white/10 text-white" onClick={()=>setEditingSlots(v=>!v)}>
            <Pencil size={13} className="mr-1"/> {editingSlots ? 'Done editing' : 'Edit periods'}
          </Button>
          <Button size="sm" variant="outline" className="h-10 rounded-full bg-rose-500/10 border-rose-400/30 text-rose-200" onClick={deleteClass}>
            <Trash2 size={13} className="mr-1"/> Delete {activeClass}
          </Button>
        </>
      )}
      {dirty.has(activeClass) && canEdit && (
        <div className="flex items-center gap-1 text-[11px] text-amber-300">
          <AlertTriangle size={12}/> Unsaved changes
        </div>
      )}
    </div>

    {/* TODAY card */}
    {(isTeacher || isStudentOrParent || isAdmin) && !todayHoliday && activeClass && (
      <Card className="rounded-[24px] border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-indigo-500/10 to-violet-500/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                Today {today}{isTeacher ? ' (all your classes)' : ` • ${activeClass}`}
              </div>
              <div className="text-[18px] font-black text-white mt-0.5">
                {currentPeriod ? 'Happening now' : nextPeriod ? 'Up next' : 'No more periods today'}
              </div>
            </div>
            {currentPeriod && isCellMine(currentPeriod.cell, (currentPeriod as any).classKey) && (
              <Button size="sm" className="rounded-full" variant="gradient" onClick={()=>startAttendance(currentPeriod.cell.className || (currentPeriod as any).classKey)}>
                <Play size={13} className="mr-1"/> Start class
              </Button>
            )}
          </div>
          {currentPeriod ? (
            <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
              <div className="flex items-center gap-2 text-[11px] text-white/60"><Clock size={12}/>{currentPeriod.slot.label}</div>
              <div className="text-[16px] font-black text-white mt-1">{currentPeriod.cell.subject}</div>
              <div className="text-[12px] text-white/70">
                {[currentPeriod.cell.teacherName, (currentPeriod.cell.className||(currentPeriod as any).classKey)].filter(Boolean).join(' • ')}
              </div>
            </div>
          ) : null}
          {!currentPeriod && nextPeriod && (
            <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
              <div className="flex items-center gap-2 text-[11px] text-white/60"><Clock size={12}/>{nextPeriod.slot.label} starts in {Math.max(0,(nextPeriod as any).startMin-nowMin)} min</div>
              <div className="text-[16px] font-black text-white mt-1">{nextPeriod.cell.subject}</div>
              <div className="text-[12px] text-white/70">
                {[nextPeriod.cell.teacherName, (nextPeriod.cell.className||(nextPeriod as any).classKey)].filter(Boolean).join(' • ')}
              </div>
            </div>
          )}
          {!currentPeriod && !nextPeriod && (
            <div className="text-[12px] text-white/60">School day has ended. Check back tomorrow!</div>
          )}
          {/* Today list */}
          <div className="pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">Today's classes</div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {todayList.map((p, i) => {
                const isCurrent = currentPeriod?.slotIdx === p.slotIdx && (isTeacher || (currentPeriod as any)?.classKey === activeClass)
                return (
                  <div key={i} className={`flex items-center gap-2 rounded-xl p-2 border ${isCurrent ? 'bg-cyan-400/15 border-cyan-400/30' : 'bg-white/[0.03] border-white/5'}`}>
                    <div className="text-[10px] font-bold text-white/60 w-[72px] shrink-0">{p.slot.label}</div>
                    {p.cell ? (
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-white truncate flex items-center gap-1">
                          {p.cell.subject}
                          {(p as any).classKey && isTeacher && <span className="text-[10px] text-white/50 font-normal">({(p as any).classKey})</span>}
                        </div>
                        <div className="text-[10px] text-white/50 truncate">
                          {[p.cell.teacherName, !isTeacher && p.cell.className].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 text-[11px] text-white/30 italic">
                        {BREAK_TAGS.includes(current.grid[cellKey(today,p.slotIdx)]?.subject||'') ? current.grid[cellKey(today,p.slotIdx)]?.subject : '—'}
                      </div>
                    )}
                    {(isTeacher || canEdit) && p.cell && !BREAK_TAGS.includes(p.cell.subject) && isCellMine(p.cell, (p as any).classKey) && (
                      <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] bg-white/5 border-white/10 text-white px-2" onClick={()=>startAttendance((p.cell as CellValue).className || (p as any).classKey)}>
                        <Play size={10} className="mr-1"/> Start
                      </Button>
                    )}
                  </div>
                )
              })}
              {!todayList.length && <div className="text-[11px] text-white/40 italic">No periods assigned yet.</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Edit slots panel */}
    {canEdit && editingSlots && activeClass && (
      <Card className="rounded-[22px] bg-white/[0.03] border-white/10">
        <CardTitle className="flex items-center gap-2 text-white">Period timings <span className="text-[11px] text-white/50 font-normal">({current.slots.length} periods)</span></CardTitle>
        <CardContent className="space-y-2">
          {current.slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="text-[11px] text-white/50 w-6 font-bold">{i+1}.</div>
              <Input value={slot.label} onChange={e=>updateSlot(i,{label:e.target.value})} placeholder="HH:MM-HH:MM"
                className="h-9 bg-white/5 border-white/10 text-white rounded-full" />
              <Input value={slot.tag||''} onChange={e=>updateSlot(i,{tag:e.target.value})} placeholder="Tag (optional)"
                className="h-9 bg-white/5 border-white/10 text-white rounded-full w-28" />
              <button onClick={()=>removeSlot(i)} className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-200 grid place-items-center shrink-0" aria-label="Remove period">
                <X size={14}/>
              </button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addSlot} className="rounded-full bg-white/5 border-white/10 text-white mt-2">
            <Plus size={13} className="mr-1"/> Add period
          </Button>
          <div className="text-[11px] text-white/50 pt-1">Tip: format times like <code className="bg-white/10 px-1 rounded">08:00-08:45</code>. Add tags like <b>Lunch</b>, <b>Assembly</b> for non-teaching slots.</div>
        </CardContent>
      </Card>
    )}

    {/* Timetable grid for active class (admin/student/parent); teachers always see the "Today" card + per-class picker */}
    {activeClass && (isAdmin || isStudentOrParent) && (
      <Card className="rounded-[24px] overflow-hidden">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays size={16} className="text-cyan-300"/> {activeClass} • Weekly Timetable
        </CardTitle>
        <CardContent className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TimetableGrid
            schedule={current}
            canEdit={canEdit}
            today={today}
            nowMin={nowMin}
            teacherOptions={teacherOptions}
            activeClass={activeClass}
            setCell={setCell}
            isCellMine={isCellMine}
            onStart={startAttendance}
            isTeacher={false}
          />
        </CardContent>
      </Card>
    )}

    {/* Teacher grid for their selected class */}
    {activeClass && isTeacher && (
      <Card className="rounded-[24px] overflow-hidden">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays size={16} className="text-cyan-300"/> {activeClass} • Weekly Timetable
          <span className="ml-auto text-[10px] text-white/50 font-normal">Only your periods shown</span>
        </CardTitle>
        <CardContent className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TimetableGrid
            schedule={current}
            canEdit={false}
            today={today}
            nowMin={nowMin}
            teacherOptions={teacherOptions}
            activeClass={activeClass}
            setCell={setCell}
            isCellMine={isCellMine}
            onStart={startAttendance}
            isTeacher={true}
          />
        </CardContent>
      </Card>
    )}

    {!activeClass && canEdit && (
      <Card className="rounded-[24px]">
        <CardContent className="p-8 text-center space-y-3">
          <CalendarDays size={32} className="mx-auto text-white/30"/>
          <div className="text-white/70 font-bold">No class sections yet</div>
          <div className="text-white/50 text-[12px]">Create your first class-section (e.g. 12-A1) to start building the timetable.</div>
          <Button onClick={addNewClass} variant="gradient" className="rounded-full mt-2"><Plus size={14} className="mr-1"/> Add first class</Button>
        </CardContent>
      </Card>
    )}

    {canEdit && activeClass && (
      <Card className="rounded-[20px] bg-white/[0.03] border-white/5">
        <CardTitle>How to set timetables</CardTitle>
        <CardContent className="text-[12px] text-white/60 space-y-1.5">
          <p>1. Use the class selector to pick a section (e.g. 12-A1). Add new sections with <b>New class</b>.</p>
          <p>2. Tap <b>Edit periods</b> to add/remove periods or change timings. Use the Tag field for Lunch/Assembly/PT.</p>
          <p>3. Pick a subject-teacher-class from each cell. Hit <b>Publish</b> to save one section at a time.</p>
          <p>4. Teachers automatically see only their own periods across all sections, with <b>Start</b> buttons for today.</p>
          <p>5. Students & parents see only their own section's timetable; classes auto-select from their profile.</p>
          <p>6. Holidays from the Calendar automatically disable timetable display.</p>
        </CardContent>
      </Card>
    )}
  </div>
}

// Extracted grid component for reuse
function TimetableGrid({ schedule, canEdit, today, nowMin, teacherOptions, activeClass, setCell, isCellMine, onStart, isTeacher }:{
  schedule: ClassSchedule
  canEdit: boolean
  today: string
  nowMin: number
  teacherOptions: { key:string;label:string;teacherId:string;teacherName:string;subject:string;cls:string }[]
  activeClass: string
  setCell: (day:string, idx:number, v:CellValue|null) => void
  isCellMine: (c:CellValue|null, ck?:string) => boolean
  onStart: (c?:string)=>void
  isTeacher: boolean
}) {
  const { slots, days, grid } = schedule
  return (
    <div className="min-w-[600px]">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            <th className="border border-white/10 p-2 text-left rounded-tl-xl bg-white/[0.04] text-white/70">Time</th>
            {days.map(d => (
              <th key={d} className={`border border-white/10 p-2 text-center bg-white/[0.04] text-white/80 font-bold ${d===today?'text-cyan-300':''}`}>
                {d}{d===today?' • today':''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, si) => {
            const tr = parseTimeRange(slot.label)
            const isCurrent = !!tr && nowMin >= tr.startMin && nowMin < tr.endMin && today === 'now-check'
            void isCurrent
            const isCurrentSlot = !!tr && today !== 'Sun' && nowMin >= tr.startMin && nowMin < tr.endMin
            return (
              <tr key={si}>
                <td className={`border border-white/10 p-2 font-medium bg-white/[0.02] text-white/70 whitespace-nowrap ${slot.tag?'text-amber-300':''}`}>
                  {slot.label}
                  {slot.tag && <span className="block text-[9px] text-amber-300/80">{slot.tag}</span>}
                </td>
                {days.map(day => {
                  const key = cellKey(day, si)
                  const c = grid[key]
                  const isMine = isCellMine(c, activeClass)
                  const isCurrentCell = day === today && isCurrentSlot
                  const isBreak = BREAK_TAGS.includes(c?.subject||'')
                  if (canEdit) {
                    return (
                      <td key={day} className={`border border-white/10 p-1 ${isCurrentCell?'bg-cyan-500/10':''}`}>
                        <select
                          className="w-full bg-transparent text-[10px] text-white/90 border border-white/5 rounded-lg px-1 py-1 focus:outline-none"
                          value={formatCell(c)}
                          onChange={e => {
                            const v = e.target.value
                            if (v === 'Free') { setCell(day, si, null); return }
                            if (BREAK_TAGS.includes(v)) { setCell(day, si, { subject: v }); return }
                            const parts = v.split('–').map(p=>p.trim())
                            setCell(day, si, { subject: parts[0]||v, teacherName: parts[1], className: parts[2] })
                          }}
                        >
                          <option value="Free">Free</option>
                          <optgroup label="Breaks">
                            {BREAK_TAGS.map(b => <option key={b} value={b}>{b}</option>)}
                          </optgroup>
                          <optgroup label="Classes">
                            {teacherOptions.map(o => <option key={o.key} value={o.label}>{o.label}</option>)}
                          </optgroup>
                        </select>
                      </td>
                    )
                  }
                  return (
                    <td key={day} className={`border border-white/10 p-2 text-[10px] leading-tight ${isCurrentCell && isMine ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40' : isCurrentCell ? 'bg-cyan-500/5' : ''} ${isMine ? 'font-semibold text-white' : isBreak ? 'text-amber-300/70 italic' : 'text-white/40'}`}>
                      {c ? (
                        <div>
                          <div className="font-bold">{c.subject}</div>
                          {!isBreak && <div className="text-[9px] text-white/50">{[c.teacherName, isTeacher?c.className:activeClass].filter(Boolean).join(' • ')}</div>}
                          {isTeacher && isMine && day===today && !isBreak && (
                            <button onClick={()=>onStart(c.className||activeClass)}
                              className="mt-1 text-[9px] rounded-full bg-cyan-400 text-slate-900 font-bold px-2 py-0.5 inline-flex items-center gap-0.5">
                              <Play size={8}/> Start
                            </button>
                          )}
                          {!isTeacher && day===today && canEdit && !isBreak && (
                            <button onClick={()=>onStart(c.className||activeClass)}
                              className="mt-1 text-[9px] rounded-full bg-cyan-400/80 text-slate-900 font-bold px-2 py-0.5 inline-flex items-center gap-0.5">
                              <Play size={8}/> Start
                            </button>
                          )}
                        </div>
                      ) : (isBreak ? (c as unknown as CellValue)?.subject : '—')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}