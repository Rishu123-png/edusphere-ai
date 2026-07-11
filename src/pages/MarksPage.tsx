import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gradeFromMarks, generateId } from '@/lib/utils'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { Award, TrendingUp, FileDown } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue, update, push, set } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'

const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']

export default function MarksPage(){
  const { schoolId } = useSchool()
  const { profile } = useAuth() as any
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [savedMarksTree, setSavedMarksTree] = useState<Record<string, any>>({})
  const [subject, setSubject] = useState('Mathematics')
  const [exam, setExam] = useState('mid_term')
  const [classSel, setClassSel] = useState('')
  const [marks, setMarks] = useState<Record<string, number | ''>>({})

  const isTeacher = profile?.role === 'teacher'
  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  const teacherClasses = useMemo(()=>{
    if(!isTeacher) return [] as string[]
    const assigned = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : []
    const classTeacherOf = profile?.classTeacherOf ? [profile.classTeacherOf] : []
    return Array.from(new Set([...assigned, ...classTeacherOf].map((c:any)=>String(c).trim()).filter(Boolean)))
  }, [profile, isTeacher])

  const teacherSubjects = useMemo(()=>{
    if(!isTeacher) return DEFAULT_SUBJECTS
    const subs = Array.isArray(profile?.subjects) ? profile.subjects.filter(Boolean) : []
    return subs.length ? subs : DEFAULT_SUBJECTS
  }, [profile, isTeacher])

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      setAllStudents(Object.entries(v).map(([id, s]:any)=>({ id, ...s })))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setSavedMarksTree({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), snap=>{
      setSavedMarksTree(snap.val() || {})
    })
    return ()=>unsub()
  }, [schoolId])

  // Admin: all students. Teacher: assigned classes (or all if none assigned yet, so they can still work)
  const visibleStudents = useMemo(()=>{
    if(!isTeacher) return allStudents
    if(!teacherClasses.length) return allStudents
    return allStudents.filter((s:any)=> teacherClasses.includes(`${s.className}-${s.section}`))
  }, [allStudents, isTeacher, teacherClasses])

  const classOptions = useMemo(()=>{
    return Array.from(new Set(visibleStudents.map((s:any)=>`${s.className}-${s.section}`).filter(Boolean))).sort()
  }, [visibleStudents])

  useEffect(()=>{
    if(!classSel && classOptions.length) setClassSel(classOptions[0])
    if(classSel && classOptions.length && !classOptions.includes(classSel)) setClassSel(classOptions[0])
  }, [classOptions, classSel])

  useEffect(()=>{
    if(teacherSubjects.length && !teacherSubjects.includes(subject)) {
      setSubject(teacherSubjects[0])
    }
  }, [teacherSubjects, subject])

  const students = useMemo(
    () => visibleStudents.filter((s:any)=>`${s.className}-${s.section}` === classSel),
    [visibleStudents, classSel]
  )

  // Prefill marks for current class + subject + exam from saved Firebase data
  useEffect(()=>{
    const next: Record<string, number | ''> = {}
    for (const st of students) {
      const entries = Object.values(savedMarksTree[st.id] || {}) as any[]
      const match = entries
        .filter((m:any) => m.subject === subject && m.examType === exam)
        .sort((a:any,b:any)=>(b.createdAt||0)-(a.createdAt||0))[0]
      if (match && typeof match.marksObtained === 'number') next[st.id] = match.marksObtained
    }
    setMarks(next)
  }, [students, savedMarksTree, subject, exam])

  const entered = students.filter((s:any)=> typeof marks[s.id] === 'number')
  const avg = entered.length ? entered.reduce((sum:any, s:any)=> sum + Number(marks[s.id]), 0) / entered.length : 0
  const rankList = entered
    .map((s:any)=>({ ...s, mark: Number(marks[s.id]) }))
    .sort((a:any,b:any)=>b.mark-a.mark)
    .slice(0,5)

  const notifyAdmin = async (count: number) => {
    if (!isTeacher || !schoolId) return
    try {
      const nRef = push(ref(db, `schools/${schoolId}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId,
        toRole: 'school_admin',
        title: 'Marks published by teacher',
        body: `${profile?.displayName || profile?.email} saved ${count} mark(s) for ${classSel} • ${subject} (${exam})`,
        type: 'marks',
        read: false,
        createdAt: Date.now(),
        meta: { classSel, subject, exam, by: profile?.uid },
      })
    } catch {}
  }

  const save = async ()=>{
    const sid = schoolId || profile?.schoolId || 'global'
    if(!students.length){ toast.error(classSel ? `No students in ${classSel}` : 'No class selected'); return }
    if(!entered.length){ toast.error('Enter marks for at least one student'); return }

    if (isTeacher && teacherClasses.length && !teacherClasses.includes(classSel)) {
      toast.error('You can only enter marks for your assigned classes')
      return
    }

    const updates: Record<string, any> = {}
    const date = todayIST()
    for (const st of entered) {
      const value = Number(marks[st.id])
      if(value < 0 || value > 100){ toast.error(`Marks for ${st.name} must be 0–100`); return }

      // Update latest matching entry if exists, else create new — keeps admin view clean
      const existing = Object.entries(savedMarksTree[st.id] || {}) as [string, any][]
      const found = existing.find(([, m]) => m.subject === subject && m.examType === exam)
      const id = found?.[0] || generateId('mark_')

      updates[`schools/${sid}/marks/${st.id}/${id}`] = {
        id,
        schoolId: sid,
        studentId: st.id,
        studentName: st.name || '',
        className: st.className,
        section: st.section,
        subject,
        examType: exam,
        marksObtained: value,
        maxMarks: 100,
        grade: gradeFromMarks(value),
        enteredBy: profile?.uid || '',
        enteredByName: profile?.displayName || profile?.name || profile?.email || '',
        enteredByRole: profile?.role || '',
        date,
        createdAt: found?.[1]?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }
    }
    await update(ref(db), updates)
    await notifyAdmin(entered.length)
    toast.success(
      isTeacher
        ? `Marks saved for ${entered.length} student(s) — synced to school admin`
        : `Marks saved for ${entered.length} student(s)`
    )
    try { navigator.vibrate?.(50) } catch {}
  }

  const exportCsv = ()=>{
    const csv = 'Roll,Name,Class,Subject,Exam,Marks,Grade\\n' + students.map((s:any)=>{
      const m = marks[s.id]
      return [s.rollNumber || '', s.name || '', `${s.className}-${s.section}`, subject, exam, typeof m === 'number' ? m : '', typeof m === 'number' ? gradeFromMarks(m) : ''].join(',')
    }).join('\\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `marks-${classSel}-${todayIST()}.csv`; a.click()
  }

  return <div className="page-container space-y-4">
    <PageHeader
      title="Marks"
      subtitle={isTeacher
        ? `Your classes • marks sync live to school admin`
        : `All classes • Subject-wise • AI Grade • Rank`}
      action={<Button variant="gradient" size="sm" className="rounded-full h-10 px-5" onClick={save}>Publish</Button>}
    />

    {isTeacher && (
      <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-[13px] text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900/40">
        Showing students {teacherClasses.length ? `for ${teacherClasses.join(', ')}` : 'for the whole school (no class assignment yet — ask admin to assign classes)'}.
        Published marks are visible to School Admin immediately.
      </div>
    )}

    <Card className="rounded-[24px] overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
          <select value={classSel} onChange={e=>setClassSel(e.target.value)} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
            {!classOptions.length && <option value="">No classes yet</option>}
            {classOptions.map(opt=><option key={opt} value={opt}>{opt}</option>)}
          </select>
          <select value={subject} onChange={e=>setSubject(e.target.value)} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
            {teacherSubjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
            {/* Admin can still pick common subjects not in list */}
            {isAdmin && DEFAULT_SUBJECTS.filter((s: string) => !teacherSubjects.includes(s)).map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={exam} onChange={e=>setExam(e.target.value)} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
            <option value="unit_test">Unit Test</option>
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
            <option value="practical">Practical</option>
            <option value="mid_term">Mid-Term</option>
            <option value="final">Final</option>
            <option value="internal">Internal</option>
          </select>
          <span className="text-[11px] text-muted-foreground self-center whitespace-nowrap ml-2">
            {students.length} students • live Firebase
          </span>
        </div>

        <div className="md:hidden p-3 space-y-2">
          {students.map((st:any)=>{
            const m = marks[st.id]
            const hasMark = typeof m === 'number'
            const grade = hasMark ? gradeFromMarks(m) : '—'
            const gpa = hasMark ? (m/100*4).toFixed(2) : '—'
            return (
              <div key={st.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-100 dark:border-zinc-700/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">{st.name?.[0] || 'S'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] leading-tight">{st.name}</div>
                  <div className="text-[11px] text-muted-foreground">Roll {st.rollNumber || st.admissionNumber} • GPA {gpa} • {hasMark ? `${m}%` : 'Not entered'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[11px] font-bold">{grade}</span>
                  <Input type="number" min="0" max="100" className="w-16 h-9 rounded-full text-center" value={m ?? ''} onChange={e=>setMarks({...marks, [st.id]: e.target.value === '' ? '' : Number(e.target.value)})} />
                </div>
              </div>
            )
          })}
          {!students.length && <div className="p-8 text-center text-muted-foreground text-[14px]">No students in {classSel || 'this class'}. Add students first.</div>}
        </div>

        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-slate-100 dark:border-zinc-800"><th className="py-3 px-5">Roll</th><th>Name</th><th>Marks /100</th><th>Grade (AI)</th><th>GPA</th><th>%</th></tr></thead>
            <tbody>
              {students.map((st:any)=>{
                const m = marks[st.id]
                const hasMark = typeof m === 'number'
                const grade = hasMark ? gradeFromMarks(m) : '—'
                const gpa = hasMark ? (m/100*4).toFixed(2) : '—'
                return <tr key={st.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-5">{st.rollNumber || st.admissionNumber}</td>
                  <td className="font-medium">{st.name}</td>
                  <td><Input type="number" min="0" max="100" className="w-24 h-9 rounded-full" value={m ?? ''} onChange={e=>setMarks({...marks, [st.id]: e.target.value === '' ? '' : Number(e.target.value)})} /></td>
                  <td><span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold">{grade}</span></td>
                  <td>{gpa}</td>
                  <td>{hasMark ? `${m}%` : '—'}</td>
                </tr>
              })}
              {!students.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No students in {classSel || 'this class'}. Add students first.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 p-4 flex-wrap">
          <Button variant="outline" size="sm" className="rounded-full" onClick={exportCsv}><FileDown size={14} className="mr-1"/> CSV</Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={()=>toast(`Class average: ${entered.length ? avg.toFixed(1) : '—'}%`)}>AI Summary</Button>
          <Button variant="gradient" size="sm" className="rounded-full" onClick={save}>Publish Marks</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><Award size={16}/> Rank List</CardTitle><CardContent className="text-[13px] space-y-1">{rankList.length ? rankList.map((s:any,i:number)=><div key={s.id}>{i+1}. {s.name} – {s.mark}%</div>) : <span className="text-muted-foreground">Enter marks to generate ranks.</span>}</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><TrendingUp size={16}/> Class Average</CardTitle><CardContent className="text-[13px]">{entered.length ? `${classSel} avg ${avg.toFixed(1)}% from ${entered.length} entries` : 'No marks entered yet.'}</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Sync</CardTitle><CardContent className="text-[13px] text-muted-foreground">{isTeacher ? 'Your published marks are stored under the school and appear for School Admin automatically.' : 'You can see marks entered by any teacher for every class.'}</CardContent></Card>
    </div>
  </div>
}
