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
import type { MarksEntry, Student } from '@/types'

const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']

type StudentRow = Partial<Student> & {
  id: string
  name?: string
  rollNumber?: string
  admissionNumber?: string
  className?: string
  section?: string
}

type StoredMark = Partial<MarksEntry> & {
  id?: string
  studentName?: string
  className?: string
  section?: string
  examType?: string
  enteredByName?: string
  enteredByRole?: string
  updatedAt?: number
}

type MarksTree = Record<string, Record<string, StoredMark>>
type MarkValue = number | ''

const getClassKey = (student: Pick<StudentRow, 'className' | 'section'>) => {
  const className = String(student.className || '').trim()
  const section = String(student.section || '').trim()
  return [className, section].filter(Boolean).join('-')
}

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item).trim()).filter(Boolean)
}

const parseMarkInput = (value: string): MarkValue => {
  if (value.trim() === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : ''
}

const hasNumericMark = (value: MarkValue | undefined): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const downloadCsv = (filename: string, rows: unknown[][]) => {
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function MarksPage(){
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const [allStudents, setAllStudents] = useState<StudentRow[]>([])
  const [savedMarksTree, setSavedMarksTree] = useState<MarksTree>({})
  const [subject, setSubject] = useState('Mathematics')
  const [exam, setExam] = useState<MarksEntry['examType']>('mid_term')
  const [classSel, setClassSel] = useState('')
  const [marks, setMarks] = useState<Record<string, MarkValue>>({})
  const [saving, setSaving] = useState(false)

  const isTeacher = profile?.role === 'teacher'
  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  const teacherClasses = useMemo(()=>{
    if(!isTeacher) return [] as string[]
    const assigned = toStringList(profile?.assignedClasses)
    const classTeacherOf = profile?.classTeacherOf ? [String(profile.classTeacherOf).trim()] : []
    return Array.from(new Set([...assigned, ...classTeacherOf].filter(Boolean)))
  }, [profile?.assignedClasses, profile?.classTeacherOf, isTeacher])

  const teacherSubjects = useMemo(()=>{
    if(!isTeacher) return DEFAULT_SUBJECTS
    const subs = toStringList(profile?.subjects)
    return subs.length ? subs : DEFAULT_SUBJECTS
  }, [profile?.subjects, isTeacher])

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap=>{
      const v = snap.val() || {}
      setAllStudents(Object.entries(v).map(([id, s])=>({ id, ...(s as Record<string, unknown>) })))
    }, error => {
      console.error('Failed to load students', error)
      toast.error('Unable to load students. Please check your connection.')
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    const sid = schoolId || profile?.schoolId
    if(!sid){ setSavedMarksTree({}); return }
    const unsub = onValue(ref(db, `schools/${sid}/marks`), snap=>{
      setSavedMarksTree(snap.val() || {})
    }, error => {
      console.error('Failed to load marks', error)
      toast.error('Unable to load saved marks.')
    })
    return ()=>unsub()
  }, [schoolId, profile?.schoolId])

  // Admin: all students. Teacher: assigned classes (or all if none assigned yet, so they can still work)
  const visibleStudents = useMemo(()=>{
    if(!isTeacher) return allStudents
    if(!teacherClasses.length) return allStudents
    return allStudents.filter(student => teacherClasses.includes(getClassKey(student)))
  }, [allStudents, isTeacher, teacherClasses])

  const classOptions = useMemo(()=>{
    return Array.from(new Set(visibleStudents.map(getClassKey).filter(Boolean))).sort()
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
    () => visibleStudents.filter(student => getClassKey(student) === classSel),
    [visibleStudents, classSel]
  )

  // Prefill marks for current class + subject + exam from saved Firebase data
  useEffect(()=>{
    const next: Record<string, MarkValue> = {}
    for (const st of students) {
      const entries = Object.values(savedMarksTree[st.id] || {})
      const match = entries
        .filter(mark => mark.subject === subject && mark.examType === exam)
        .sort((a,b)=>(Number(b.updatedAt || b.createdAt || 0))-(Number(a.updatedAt || a.createdAt || 0)))[0]
      if (match && hasNumericMark(match.marksObtained as MarkValue)) next[st.id] = match.marksObtained as number
    }
    setMarks(next)
  }, [students, savedMarksTree, subject, exam])

  const entered = useMemo(
    () => students.filter(student => hasNumericMark(marks[student.id])),
    [students, marks]
  )

  const avg = entered.length ? entered.reduce((sum, student)=> sum + Number(marks[student.id]), 0) / entered.length : 0
  const rankList = entered
    .map(student=>({ ...student, mark: Number(marks[student.id]) }))
    .sort((a,b)=>b.mark-a.mark)
    .slice(0,5)

  const updateStudentMark = (studentId: string, value: string) => {
    const parsed = parseMarkInput(value)
    setMarks(prev => ({ ...prev, [studentId]: parsed }))
  }

  const notifyAdmin = async (count: number) => {
    if (!isTeacher || !schoolId) return
    try {
      const nRef = push(ref(db, `schools/${schoolId}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId,
        toRole: 'school_admin',
        title: 'Marks published by teacher',
        body: `${profile?.displayName || profile?.email || 'Teacher'} saved ${count} mark(s) for ${classSel} • ${subject} (${exam})`,
        type: 'marks',
        read: false,
        createdAt: Date.now(),
        meta: { classSel, subject, exam, by: profile?.uid },
      })
    } catch (error) {
      console.warn('Marks saved, but admin notification failed', error)
    }
  }

  const save = async ()=>{
    if (saving) return
    const sid = schoolId || profile?.schoolId || 'global'
    if(!students.length){ toast.error(classSel ? `No students in ${classSel}` : 'No class selected'); return }
    if(!entered.length){ toast.error('Enter marks for at least one student'); return }

    if (isTeacher && teacherClasses.length && !teacherClasses.includes(classSel)) {
      toast.error('You can only enter marks for your assigned classes')
      return
    }

    const updates: Record<string, StoredMark> = {}
    const date = todayIST()
    const now = Date.now()

    for (const st of entered) {
      const value = Number(marks[st.id])
      if(!Number.isFinite(value) || value < 0 || value > 100){ toast.error(`Marks for ${st.name || 'student'} must be 0–100`); return }

      // Update latest matching entry if exists, else create new — keeps admin view clean
      const existing = Object.entries(savedMarksTree[st.id] || {}) as [string, StoredMark][]
      const found = existing
        .filter(([, mark]) => mark.subject === subject && mark.examType === exam)
        .sort(([, a], [, b]) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0]
      const id = found?.[0] || generateId('mark_')

      updates[`schools/${sid}/marks/${st.id}/${id}`] = {
        id,
        schoolId: sid,
        studentId: st.id,
        studentName: st.name || '',
        className: st.className || '',
        section: st.section || '',
        subject,
        examType: exam,
        marksObtained: value,
        maxMarks: 100,
        grade: gradeFromMarks(value),
        enteredBy: profile?.uid || '',
        enteredByName: profile?.displayName || profile?.name || profile?.email || '',
        enteredByRole: profile?.role || '',
        date,
        createdAt: found?.[1]?.createdAt || now,
        updatedAt: now,
      }
    }

    try {
      setSaving(true)
      await update(ref(db), updates)
      await notifyAdmin(entered.length)
      toast.success(
        isTeacher
          ? `Marks saved for ${entered.length} student(s) — synced to school admin`
          : `Marks saved for ${entered.length} student(s)`
      )
      navigator.vibrate?.(50)
    } catch (error) {
      console.error('Failed to save marks', error)
      toast.error('Unable to save marks. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = ()=>{
    if (!students.length) {
      toast.error('No students available to export')
      return
    }
    const rows = [
      ['Roll', 'Name', 'Class', 'Subject', 'Exam', 'Marks', 'Grade'],
      ...students.map(student => {
        const mark = marks[student.id]
        return [
          student.rollNumber || student.admissionNumber || '',
          student.name || '',
          getClassKey(student),
          subject,
          exam,
          hasNumericMark(mark) ? mark : '',
          hasNumericMark(mark) ? gradeFromMarks(mark) : '',
        ]
      })
    ]
    downloadCsv(`marks-${classSel || 'class'}-${todayIST()}.csv`, rows)
  }

  return <div className="page-container space-y-4">
    <PageHeader
      title="Marks"
      subtitle={isTeacher
        ? `Your classes • marks sync live to school admin`
        : `All classes • Subject-wise • AI Grade • Rank`}
      action={<Button variant="gradient" size="sm" className="rounded-full h-10 px-5" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Publish'}</Button>}
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
            {teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            {/* Admin can still pick common subjects not in list */}
            {isAdmin && DEFAULT_SUBJECTS.filter(s => !teacherSubjects.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={exam} onChange={e=>setExam(e.target.value as MarksEntry['examType'])} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
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
          {students.map(st=>{
            const mark = marks[st.id]
            const hasMark = hasNumericMark(mark)
            const grade = hasMark ? gradeFromMarks(mark) : '—'
            const gpa = hasMark ? (mark/100*4).toFixed(2) : '—'
            return (
              <div key={st.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-100 dark:border-zinc-700/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">{st.name?.[0] || 'S'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] leading-tight">{st.name}</div>
                  <div className="text-[11px] text-muted-foreground">Roll {st.rollNumber || st.admissionNumber || '—'} • GPA {gpa} • {hasMark ? `${mark}%` : 'Not entered'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[11px] font-bold">{grade}</span>
                  <Input type="number" min="0" max="100" className="w-16 h-9 rounded-full text-center" value={mark ?? ''} onChange={e=>updateStudentMark(st.id, e.target.value)} />
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
              {students.map(st=>{
                const mark = marks[st.id]
                const hasMark = hasNumericMark(mark)
                const grade = hasMark ? gradeFromMarks(mark) : '—'
                const gpa = hasMark ? (mark/100*4).toFixed(2) : '—'
                return <tr key={st.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-5">{st.rollNumber || st.admissionNumber || '—'}</td>
                  <td className="font-medium">{st.name}</td>
                  <td><Input type="number" min="0" max="100" className="w-24 h-9 rounded-full" value={mark ?? ''} onChange={e=>updateStudentMark(st.id, e.target.value)} /></td>
                  <td><span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold">{grade}</span></td>
                  <td>{gpa}</td>
                  <td>{hasMark ? `${mark}%` : '—'}</td>
                </tr>
              })}
              {!students.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No students in {classSel || 'this class'}. Add students first.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 p-4 flex-wrap">
          <Button variant="outline" size="sm" className="rounded-full" onClick={exportCsv}><FileDown size={14} className="mr-1"/> CSV</Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={()=>toast(`Class average: ${entered.length ? avg.toFixed(1) : '—'}%`)}>AI Summary</Button>
          <Button variant="gradient" size="sm" className="rounded-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Publish Marks'}</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><Award size={16}/> Rank List</CardTitle><CardContent className="text-[13px] space-y-1">{rankList.length ? rankList.map((student,i)=><div key={student.id}>{i+1}. {student.name} – {student.mark}%</div>) : <span className="text-muted-foreground">Enter marks to generate ranks.</span>}</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><TrendingUp size={16}/> Class Average</CardTitle><CardContent className="text-[13px]">{entered.length ? `${classSel} avg ${avg.toFixed(1)}% from ${entered.length} entries` : 'No marks entered yet.'}</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Sync</CardTitle><CardContent className="text-[13px] text-muted-foreground">{isTeacher ? 'Your published marks are stored under the school and appear for School Admin automatically.' : 'You can see marks entered by any teacher for every class.'}</CardContent></Card>
    </div>
  </div>
}
