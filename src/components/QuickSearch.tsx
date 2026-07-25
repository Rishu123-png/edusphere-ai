import { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Search, UserCog, GraduationCap, User, ArrowRight } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

type Person = { id: string; name: string; cls?: string; role?: 'student'|'teacher' }

export default function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [students, setStudents] = useState<Person[]>([])
  const [teachers, setTeachers] = useState<Person[]>([])
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!schoolId || !open) return
    const unsub1 = onValue(ref(db,`schools/${schoolId}/students`), snap => {
      const v = snap.val() || {}
      const arr: Person[] = Object.entries(v as Record<string,any>).map(([id,s]) => ({
        id, name: s.name || s.fullName || 'Unknown',
        cls: `${s.className||''}${s.section?'-'+s.section:''}`,
        role: 'student' as const,
      }))
      setStudents(arr)
    })
    const unsub2 = onValue(ref(db,`schools/${schoolId}/teachers`), snap => {
      const v = snap.val() || {}
      const arr: Person[] = Object.entries(v as Record<string,any>).map(([id,t]) => ({
        id, name: t.name || 'Unknown',
        cls: t.subjects?.join?.(', ') || (t.subject || ''),
        role: 'teacher' as const,
      }))
      setTeachers(arr)
    })
    return () => { unsub1(); unsub2() }
  }, [schoolId, open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return [...students.slice(0,8), ...teachers.slice(0,3)]
    return [
      ...students.filter(p => (p.name.toLowerCase().includes(s) || (p.cls||'').toLowerCase().includes(s))).slice(0,10),
      ...teachers.filter(p => p.name.toLowerCase().includes(s)).slice(0,5),
    ]
  }, [q, students, teachers])

  const go = (p: Person) => {
    setOpen(false)
    if (p.role === 'student') navigate(`/students?q=${encodeURIComponent(p.name)}`)
    else navigate(`/teachers?q=${encodeURIComponent(p.name)}`)
  }

  const canSearch = profile && ['super_admin','school_admin','teacher'].includes(profile.role)
  if (!canSearch) return (
    <button onClick={()=>setOpen(false)} aria-hidden className="hidden" />
  )

  return (
    <>
      <button onClick={()=>setOpen(true)} aria-label="Quick search"
        className="flex items-center gap-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-[12px] text-white/60 transition">
        <Search size={13} />
        <span className="hidden sm:inline">Search student or teacher…</span>
        <kbd className="hidden sm:inline ml-1 text-[10px] rounded bg-white/10 px-1.5 py-0.5">⌘K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-[#0c1125] border-white/10 p-0 gap-0">
          <div className="flex items-center gap-2 p-3 border-b border-white/10">
            <Search size={16} className="text-white/50" />
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search by name, class, admission number…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"/>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <div className="p-6 text-center text-white/40 text-xs">No matches.</div>}
            {results.map(p => (
              <button key={p.role+p.id} onClick={()=>go(p)}
                className="w-full flex items-center gap-3 rounded-xl hover:bg-white/5 px-3 py-2 text-left transition">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${p.role==='student'?'bg-emerald-500/20 text-emerald-300':'bg-violet-500/20 text-violet-300'}`}>
                  {p.role==='student' ? <GraduationCap size={14}/> : <UserCog size={14}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-white/50 truncate">{p.role==='student'?`Student • ${p.cls||''}`:`Teacher • ${p.cls||''}`}</div>
                </div>
                <ArrowRight size={14} className="text-white/30"/>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
