import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  gradeFromMarks,
  gpaFromMarks,
  gradeColorClasses,
  GRADE_BANDS,
  PASSING_PERCENT,
  DEFAULT_EXAM_WEIGHTS,
  computeWeighted,
  predictFinal,
  classStats,
  cn,
  generateId,
} from '@/lib/utils'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import {
  Award,
  TrendingUp,
  TrendingDown,
  FileDown,
  Sparkles,
  AlertTriangle,
  Send,
  Users,
  BarChart3,
  Target,
  Brain,
  ChevronRight,
  Lock,
  CheckCircle2,
  Clock,
  X,
  UserCheck,
  BookOpen,
  Download,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue, update, push, set } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'
import type { MarksEntry } from '@/types'
import { downloadReportCard } from '@/lib/reportCardPdf'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import { askAssistant } from '@/lib/gemini'

const DEFAULT_SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Social Science', 'Hindi',
  'Computer Science', 'Sanskrit', 'Physical Education',
]

type ExamType = MarksEntry['examType']
type SpecialStatus = '' | 'absent' | 'ufm' | 'medical'

type StudentRow = {
  id: string
  name?: string
  rollNumber?: string
  admissionNumber?: string
  className?: string
  section?: string
  photoUrl?: string
  guardianName?: string
  guardianPhone?: string
}

type LocalMarkState = {
  obtained: number | ''
  status: SpecialStatus
  remarks: string
}

type MarksTree = Record<string, Record<string, MarksEntry>>
type AttendanceMap = Record<string, any>

const EXAM_LABELS: Record<ExamType, string> = {
  unit_test: 'Unit Test',
  assignment: 'Assignment',
  project: 'Project',
  practical: 'Practical',
  mid_term: 'Mid-Term',
  final: 'Final',
  internal: 'Internal',
}

const EXAM_OPTIONS: ExamType[] = ['unit_test','assignment','project','practical','mid_term','final','internal']

const REMARK_PRESETS = ['Excellent', 'Good', 'Needs Practice', 'Outstanding', 'Careless Mistakes']

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

const parseMarkInput = (value: string): number | '' => {
  if (value.trim() === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
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
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const getClassKey = (s: Pick<StudentRow,'className'|'section'>) =>
  [String(s.className||'').trim(), String(s.section||'').trim()].filter(Boolean).join('-')

export default function MarksPage() {
  const { schoolId, school } = useSchool()
  const { profile } = useAuth()

  const [allStudents, setAllStudents] = useState<StudentRow[]>([])
  const [savedMarksTree, setSavedMarksTree] = useState<MarksTree>({})
  const [attendanceAll, setAttendanceAll] = useState<AttendanceMap>({})
  const [subject, setSubject] = useState('Mathematics')
  const [exam, setExam] = useState<ExamType>('mid_term')
  const [classSel, setClassSel] = useState('')
  const [maxMarks, setMaxMarks] = useState(80)
  const [marksMap, setMarksMap] = useState<Record<string, LocalMarkState>>({})
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showWeights, setShowWeights] = useState(false)
  const [weights, setWeights] = useState(DEFAULT_EXAM_WEIGHTS)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const isTeacher = profile?.role === 'teacher'
  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  /* ---------- teacher scope ---------- */
  const teacherClasses = useMemo(() => {
    if (!isTeacher) return [] as string[]
    return Array.from(new Set([
      ...toStringList(profile?.assignedClasses),
      ...(profile?.classTeacherOf ? [String(profile.classTeacherOf).trim()] : []),
    ].filter(Boolean)))
  }, [profile?.assignedClasses, profile?.classTeacherOf, isTeacher])

  const teacherSubjects = useMemo(() => {
    if (!isTeacher) return DEFAULT_SUBJECTS
    const subs = toStringList(profile?.subjects)
    return subs.length ? subs : DEFAULT_SUBJECTS
  }, [profile?.subjects, isTeacher])

  /* ---------- subscriptions ---------- */
  useEffect(() => {
    const path = schoolId ? `schools/${schoolId}/students` : 'students'
    const unsub = onValue(ref(db, path), snap => {
      const v = snap.val() || {}
      setAllStudents(Object.entries(v).map(([id, s]: [string, any]) => ({ id, ...s })))
    }, () => toast.error('Unable to load students.'))
    return () => unsub()
  }, [schoolId])

  useEffect(() => {
    const sid = schoolId || profile?.schoolId
    if (!sid) { setSavedMarksTree({}); return }
    const unsub = onValue(ref(db, `schools/${sid}/marks`), snap => {
      setSavedMarksTree(snap.val() || {})
    }, () => toast.error('Unable to load saved marks.'))
    return () => unsub()
  }, [schoolId, profile?.schoolId])

  useEffect(() => {
    const sid = schoolId || profile?.schoolId
    if (!sid) return
    const unsub = onValue(ref(db, `schools/${sid}/attendance`), snap => {
      setAttendanceAll(snap.val() || {})
    })
    return () => unsub()
  }, [schoolId, profile?.schoolId])

  /* ---------- visibility filter ---------- */
  const visibleStudents = useMemo(() => {
    if (!isTeacher) return allStudents
    if (!teacherClasses.length) return allStudents
    return allStudents.filter(s => teacherClasses.includes(getClassKey(s)))
  }, [allStudents, isTeacher, teacherClasses])

  const classOptions = useMemo(
    () => Array.from(new Set(visibleStudents.map(getClassKey).filter(Boolean))).sort(),
    [visibleStudents],
  )
  useEffect(() => {
    if (!classSel && classOptions.length) setClassSel(classOptions[0])
    if (classSel && classOptions.length && !classOptions.includes(classSel)) setClassSel(classOptions[0])
  }, [classOptions, classSel])
  useEffect(() => {
    if (teacherSubjects.length && !teacherSubjects.includes(subject)) setSubject(teacherSubjects[0])
  }, [teacherSubjects, subject])

  const students = useMemo(
    () => visibleStudents.filter(s => getClassKey(s) === classSel),
    [visibleStudents, classSel],
  )

  /* ---------- attendance% per student ---------- */
  const attendanceOfStudent = useCallback((sid: string) => {
    let p = 0, total = 0
    Object.values(attendanceAll).forEach((day: any) => {
      const rec = day?.[sid]
      if (!rec?.status) return
      total++
      if (['present','late'].includes(rec.status)) p++
    })
    return total ? Math.round((p/total)*1000)/10 : undefined
  }, [attendanceAll])

  /* ---------- prefill from Firebase ---------- */
  useEffect(() => {
    const next: Record<string, LocalMarkState> = {}
    for (const st of students) {
      const entries = Object.values(savedMarksTree[st.id] || {}) as MarksEntry[]
      const match = entries
        .filter(m => m.subject === subject && m.examType === exam)
        .sort((a,b)=>(Number(b.updatedAt||b.createdAt||0)) - Number(a.updatedAt||a.createdAt||0))[0]
      next[st.id] = {
        obtained: match && Number.isFinite(match.marksObtained) ? match.marksObtained : '',
        status: (match?.status as SpecialStatus) || '',
        remarks: match?.remarks || '',
      }
    }
    setMarksMap(next)
  }, [students, savedMarksTree, subject, exam])

  /* ---------- stats ---------- */
  const numericMarks = useMemo(() => {
    return students
      .map(s => {
        const row = marksMap[s.id]
        if (!row || row.status) return null
        if (typeof row.obtained !== 'number' || !Number.isFinite(row.obtained)) return null
        return { student: s, percent: Math.max(0, Math.min(100, (row.obtained/maxMarks)*100)), raw: row.obtained }
      })
      .filter(Boolean) as { student: StudentRow; percent: number; raw: number }[]
  }, [students, marksMap, maxMarks])

  const stats = useMemo(() => classStats(numericMarks.map(m => m.percent)), [numericMarks])

  const rankList = useMemo(() => {
    return [...numericMarks].sort((a,b)=>b.percent-a.percent).slice(0,5)
  }, [numericMarks])

  const atRisk = useMemo(() => {
    return numericMarks
      .filter(m => m.percent < PASSING_PERCENT + 8)
      .slice(0, 6)
  }, [numericMarks])

  const unmarked = useMemo(() => {
    return students.filter(s => {
      const r = marksMap[s.id]
      if (!r) return true
      if (r.status) return false
      return typeof r.obtained !== 'number'
    })
  }, [students, marksMap])

  const distributionData = useMemo(() => {
    return GRADE_BANDS.slice().reverse().map(b => ({
      grade: b.grade,
      count: stats.distribution[b.grade] || 0,
      color: {
        emerald:'#10b981', cyan:'#22d3ee', violet:'#a855f7', amber:'#f59e0b', rose:'#f43f5e',
      }[b.color as string] || '#64748b',
    }))
  }, [stats.distribution])

  /* ---------- weighted aggregate (final predicted) ---------- */
  const aggregateMap = useMemo(() => {
    const out: Record<string, { weighted: number; gpa: number; grade: string; exams: Record<string,{obtained:number;max:number;status?:string}>; history: Array<{percent:number;timestamp:number}>; attPct?:number }> = {}
    for (const s of students) {
      const recs = Object.values(savedMarksTree[s.id] || {}) as MarksEntry[]
      const exams: Record<string,{obtained:number;max:number;status?:string}> = {}
      const history: Array<{percent:number;timestamp:number}> = []
      recs.forEach(r => {
        if (r.subject !== subject) return
        const max = r.maxMarks || 100
        if (Number.isFinite(r.marksObtained) && !r.status) {
          exams[r.examType] = { obtained: r.marksObtained, max, status: r.status }
          history.push({
            percent: (r.marksObtained/max)*100,
            timestamp: Number(r.updatedAt||r.createdAt||Date.now()),
          })
        } else if (r.status) {
          exams[r.examType] = { obtained: 0, max, status: r.status }
        }
      })
      // Include current unsaved values in weighted preview
      const cur = marksMap[s.id]
      if (cur && cur.status) {
        exams[exam] = { obtained: 0, max: maxMarks, status: cur.status }
      } else if (cur && typeof cur.obtained === 'number') {
        exams[exam] = { obtained: cur.obtained, max: maxMarks }
        history.push({ percent: (cur.obtained/maxMarks)*100, timestamp: Date.now() })
      }
      const w = computeWeighted(exams, weights)
      const att = attendanceOfStudent(s.id)
      const pred = predictFinal(history, att ?? 80)
      out[s.id] = { weighted: w.percent, gpa: w.gpa, grade: w.grade, exams, history, attPct: att, ...pred as any }
    }
    return out
  }, [students, savedMarksTree, marksMap, subject, exam, maxMarks, weights, attendanceOfStudent])

  /* ---------- helpers ---------- */
  const setMark = useCallback((sid: string, patch: Partial<LocalMarkState>) => {
    setMarksMap(prev => {
      const base = prev[sid] || { obtained: '' as const, status: '' as SpecialStatus, remarks: '' }
      return { ...prev, [sid]: { ...base, ...patch } }
    })
  }, [])

  const markAllAbsent = () => {
    setMarksMap(prev => {
      const next = { ...prev }
      unmarked.forEach(s => {
        next[s.id] = { ...(next[s.id] || { obtained: '', remarks: '' }), status: 'absent' }
      })
      return next
    })
    toast.success(`Marked ${unmarked.length} unmarked student(s) as Absent`)
  }

  const clearAll = () => {
    if (!confirm('Clear all marks for this class/subject/exam?')) return
    setMarksMap({})
    toast.info('Cleared local marks — press Publish to clear server values if needed.')
  }

  const applyGrace = () => {
    const pts = Number(prompt('Add grace marks (1–10)?', '3'))
    if (!Number.isFinite(pts) || pts <= 0) return
    setMarksMap(prev => {
      const next = { ...prev }
      students.forEach(s => {
        const cur = next[s.id]
        if (cur && typeof cur.obtained === 'number' && !cur.status) {
          next[s.id] = { ...cur, obtained: Math.min(maxMarks, cur.obtained + pts) }
        }
      })
      return next
    })
    toast.success(`Added +${pts} grace marks.`)
  }

  const notifyAdmin = async (count: number, publishStatus: 'draft'|'submitted'|'published') => {
    if (!schoolId) return
    try {
      const nRef = push(ref(db, `schools/${schoolId}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId,
        toRole: 'school_admin',
        title: publishStatus === 'published' ? 'Marks published' : 'Marks saved (draft)',
        body: `${profile?.displayName||profile?.email||'Teacher'} saved ${count} mark(s) for ${classSel} • ${subject} (${EXAM_LABELS[exam]})`,
        type: 'marks', read: false, createdAt: Date.now(),
        meta: { classSel, subject, exam, by: profile?.uid, publishStatus },
      })
    } catch (e) { console.warn('notify failed', e) }
  }

  const save = async (publishStatus: 'draft'|'submitted'|'published' = 'draft') => {
    if (saving || publishing) return
    const sid = schoolId || profile?.schoolId || 'global'
    if (!students.length) { toast.error(`No students in ${classSel||'selected class'}`); return }
    const ready = students.filter(s => {
      const r = marksMap[s.id]
      if (!r) return false
      if (r.status) return true
      return typeof r.obtained === 'number'
    })
    if (!ready.length) { toast.error('Enter marks for at least one student'); return }
    if (isTeacher && teacherClasses.length && !teacherClasses.includes(classSel)) {
      toast.error('You can only enter marks for your assigned classes'); return
    }
    const outOfRange = ready.find(s => {
      const r = marksMap[s.id]!
      return !r.status && (typeof r.obtained==='number' && (r.obtained<0 || r.obtained>maxMarks))
    })
    if (outOfRange) { toast.error(`${outOfRange.name}'s marks must be between 0 and ${maxMarks}`); return }

    const updates: Record<string, any> = {}
    const date = todayIST()
    const now = Date.now()
    let published = 0

    for (const st of ready) {
      const r = marksMap[st.id]!
      const existing = Object.entries(savedMarksTree[st.id] || {}) as [string, MarksEntry][]
      const found = existing
        .filter(([,m]) => m.subject===subject && m.examType===exam)
        .sort(([,a],[,b])=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0))[0]
      const id = found?.[0] || generateId('mark_')
      const pct = r.status ? 0 : Math.round((Number(r.obtained)/maxMarks)*1000)/10
      const grade = r.status ? 'AB' : gradeFromMarks(Number(r.obtained), maxMarks)
      const record: MarksEntry = {
        id, schoolId: sid, studentId: st.id, studentName: st.name || '',
        className: st.className||'', section: st.section||'',
        subject, examType: exam,
        marksObtained: r.status ? 0 : Number(r.obtained),
        maxMarks, percentage: pct, grade,
        remarks: r.remarks, status: r.status || 'present',
        enteredBy: profile?.uid||'', enteredByName: profile?.displayName||profile?.name||profile?.email||'',
        enteredByRole: profile?.role||'',
        date, publishStatus,
        createdAt: found?.[1]?.createdAt || now, updatedAt: now,
      }
      updates[`schools/${sid}/marks/${st.id}/${id}`] = record
      if (publishStatus === 'published') published++
    }

    try {
      if (publishStatus === 'published') setPublishing(true); else setSaving(true)
      await update(ref(db), updates)
      await notifyAdmin(ready.length, publishStatus)
      toast.success(publishStatus === 'published'
        ? `✓ Published ${ready.length} marks — visible to parents`
        : `Saved ${ready.length} marks (draft)`)
      navigator.vibrate?.(50)
    } catch (e) {
      console.error(e)
      toast.error('Save failed — check your connection.')
    } finally {
      setSaving(false); setPublishing(false)
    }
  }

  const sendParentWhatsApp = (st: StudentRow) => {
    const phone = (st.guardianPhone||'').replace(/\D/g,'')
    if (!phone) { toast.error(`No guardian phone for ${st.name}`); return }
    const r = marksMap[st.id]
    const pct = r && typeof r.obtained==='number' ? Math.round((r.obtained/maxMarks)*100) : 0
    const grade = r?.status ? 'Absent' : gradeFromMarks(pct,100)
    const text = `Dear ${st.guardianName||'Parent'},%0A%0A` +
      `${st.name}'s marks for *${subject}* (${EXAM_LABELS[exam]}, ${classSel}):%0A` +
      `Marks: ${r?.status ? 'ABSENT' : `${r?.obtained}/${maxMarks} (${pct}%)`}%0A` +
      `Grade: ${grade}%0A` +
      (r?.remarks ? `Teacher remark: ${r.remarks}%0A` : '') +
      `%0A— EduSphere AI`
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  const bulkWhatsApp = () => {
    const targets = numericMarks.filter(m => m.percent < PASSING_PERCENT + 5)
    if (!targets.length) { toast.info('No at-risk students to notify'); return }
    if (!confirm(`Send WhatsApp to ${targets.length} at-risk parents? This will open ${targets.length} tabs.`)) return
    targets.forEach((m,i) => setTimeout(()=>sendParentWhatsApp(m.student), i*350))
  }

  const exportCsv = () => {
    if (!students.length) { toast.error('No students'); return }
    const rows: (string|number)[][] = [['Roll','Name','Class','Subject','Exam','Max','Marks','%','Grade','GPA','Status','Remarks']]
    students.forEach(s => {
      const r = marksMap[s.id]
      const has = r && (r.status || typeof r.obtained==='number')
      const pct: string|number = has && r && !r.status && typeof r.obtained==='number' ? Math.round((r.obtained/maxMarks)*1000)/10 : ''
      rows.push([
        s.rollNumber||s.admissionNumber||'', s.name||'', getClassKey(s), subject, EXAM_LABELS[exam], String(maxMarks),
        r?.status ? 'AB' : (r?.obtained ?? ''), pct,
        has && r && !r.status && typeof r.obtained==='number' ? gradeFromMarks(r.obtained,maxMarks) : (r?.status||'—'),
        has && r && !r.status && typeof r.obtained==='number' ? gpaFromMarks(r.obtained,maxMarks).toFixed(2) : '',
        r?.status || 'present', r?.remarks || '',
      ])
    })
    downloadCsv(`marks-${classSel}-${subject}-${exam}-${todayIST()}.csv`, rows)
  }

  const pdfOne = (st: StudentRow) => {
    const r = marksMap[st.id]
    if (!r || (!r.status && typeof r.obtained !== 'number')) { toast.error('Enter marks for this student first'); return }
    // gather all subjects for this student
    const allSubjectMarks: Array<{subject:string;examType:string;obtained:number;max:number;remarks?:string}> = []
    Object.values(savedMarksTree[st.id] || {}).forEach((m: any) => {
      if (m.examType === exam && m.subject !== subject) return
      if (m.status && m.status !== 'present') return
      allSubjectMarks.push({
        subject: m.subject,
        examType: EXAM_LABELS[m.examType as ExamType] || m.examType,
        obtained: m.marksObtained, max: m.maxMarks||100, remarks: m.remarks,
      })
    })
    if (typeof r.obtained === 'number' && !r.status) {
      // replace/append current subject
      const idx = allSubjectMarks.findIndex(x => x.subject === subject)
      const entry = { subject, examType: EXAM_LABELS[exam], obtained: r.obtained, max: maxMarks, remarks: r.remarks }
      if (idx>=0) allSubjectMarks[idx] = entry; else allSubjectMarks.push(entry)
    }
    downloadReportCard({
      schoolName: school?.name || 'EduSphere AI School',
      schoolAddress: school?.address,
      studentName: st.name || 'Student',
      rollNumber: st.rollNumber || st.admissionNumber || '',
      className: st.className || '', section: st.section || '',
      guardianName: st.guardianName,
      examName: `${EXAM_LABELS[exam]} — ${subject}`,
      attendancePct: attendanceOfStudent(st.id),
      subjects: allSubjectMarks,
      teacherRemarks: r.remarks,
      issueDate: todayIST(),
    })
  }

  const runAIInsight = async () => {
    setAiLoading(true); setAiInsight(null)
    const payload = {
      class: classSel, subject, exam: EXAM_LABELS[exam], maxMarks,
      entries: numericMarks.map(m => ({ name: m.student.name, percent: Math.round(m.percent), predicted: (aggregateMap[m.student.id] as any)?.predicted })),
      avg: stats.avg, passPct: stats.passPct, highest: stats.highest, lowest: stats.lowest,
      atRisk: atRisk.map(m => m.student.name),
    }
    try {
      const prompt = `You are an AI co-teacher analyzing marks. Given class data below, produce a SHORT 5-bullet insight: 1) class performance summary, 2) weak areas / topics to re-teach (infer from distribution shape — don't invent topics you don't see), 3) top 3 students by name, 4) at-risk students by name with specific advice, 5) one practical suggestion for the next class. Be friendly, concise, use emojis sparingly.\n\nDATA: ${JSON.stringify(payload)}`
      const reply = await askAssistant(prompt, [], {
        page: 'Marks', role: 'teacher', totalStudents: students.length,
        present: stats.passCount, absent: stats.failCount,
        attendancePct: stats.passPct,
      })
      setAiInsight(reply)
    } catch (e) {
      setAiInsight(`• Class avg ${stats.avg}% • Pass ${stats.passPct}% • High ${stats.highest} • Low ${stats.lowest} • Review ${atRisk.length} at-risk students.`)
    } finally { setAiLoading(false) }
  }

  /* ---------- render ---------- */
  return <div className="page-container space-y-4">
    <PageHeader
      title="Marks & Analytics"
      subtitle={`Smart grading • AI insights • Weighted CGPA • Report cards`}
      action={<div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full h-10 border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={exportCsv}>
          <FileDown size={14} className="mr-1"/> CSV
        </Button>
        <Button variant="gradient" size="sm" className="rounded-full h-10 px-5" onClick={()=>save('published')} disabled={saving||publishing}>
          {publishing ? <Lock className="mr-1 animate-pulse" size={14}/> : <Send size={14} className="mr-1"/>}
          {publishing ? 'Publishing…' : 'Publish'}
        </Button>
      </div>}
    />

    {isTeacher && teacherClasses.length > 0 && (
      <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 backdrop-blur-md px-4 py-3 text-[12.5px] text-indigo-100 flex items-center gap-2">
        <UserCheck size={15} className="text-indigo-300 shrink-0"/>
        Assigned classes: <b className="text-white">{teacherClasses.join(', ')}</b>. Published marks sync to admin & parents automatically.
      </div>
    )}

    {/* === CONTROLS === */}
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-3 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select value={classSel} onChange={e=>setClassSel(e.target.value)}
          className="h-11 rounded-full px-4 bg-white/10 border border-white/15 text-[13px] font-semibold text-white outline-none focus:border-cyan-400/50">
          {!classOptions.length && <option value="" className="bg-[#0c1125]">No classes</option>}
          {classOptions.map(o => <option key={o} value={o} className="bg-[#0c1125]">{o}</option>)}
        </select>
        <select value={subject} onChange={e=>setSubject(e.target.value)}
          className="h-11 rounded-full px-4 bg-white/10 border border-white/15 text-[13px] font-semibold text-white outline-none focus:border-cyan-400/50">
          {teacherSubjects.map(s => <option key={s} value={s} className="bg-[#0c1125]">{s}</option>)}
          {isAdmin && DEFAULT_SUBJECTS.filter(s=>!teacherSubjects.includes(s)).map(s =>
            <option key={s} value={s} className="bg-[#0c1125]">{s}</option>)}
        </select>
        <select value={exam} onChange={e=>setExam(e.target.value as ExamType)}
          className="h-11 rounded-full px-4 bg-white/10 border border-white/15 text-[13px] font-semibold text-white outline-none focus:border-cyan-400/50">
          {EXAM_OPTIONS.map(e => <option key={e} value={e} className="bg-[#0c1125]">{EXAM_LABELS[e]}</option>)}
        </select>
        <div className="flex items-center gap-2 h-11 rounded-full px-3 bg-white/10 border border-white/15">
          <span className="text-[11px] text-white/50 font-bold">OUT OF</span>
          <input type="number" min={10} max={200} value={maxMarks} onChange={e=>setMaxMarks(Number(e.target.value)||100)}
            className="w-14 bg-transparent text-white font-bold text-[13px] outline-none text-center"/>
        </div>
        <Button variant="ghost" size="sm" className="h-11 rounded-full text-white/70 hover:bg-white/10" onClick={()=>setShowWeights(v=>!v)}>
          <BarChart3 size={15} className="mr-1"/> Weightings
        </Button>
      </div>

      {showWeights && (
        <div className="rounded-2xl bg-black/30 border border-white/10 p-3 space-y-2">
          <p className="text-[11px] text-white/60">Exam weightings for CGPA / prediction (must sum to 100).</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXAM_OPTIONS.map(e => (
              <div key={e} className="flex items-center gap-2">
                <label className="text-[11px] text-white/70 w-20 truncate">{EXAM_LABELS[e]}</label>
                <input type="number" min={0} max={70} value={weights[e]}
                  onChange={ev=>setWeights(w=>({...w, [e]:Number(ev.target.value)||0}))}
                  className="flex-1 h-8 rounded-lg bg-white/10 border border-white/10 px-2 text-white text-[12px] text-center"/>
                <span className="text-[11px] text-white/40">%</span>
              </div>
            ))}
              </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className={`font-bold ${Object.values(weights).reduce((a,b)=>a+b,0) === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              Total: {Object.values(weights).reduce((a,b)=>a+b,0)}%
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-white/70" onClick={()=>setWeights(DEFAULT_EXAM_WEIGHTS)}>
              Reset CBSE default
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="rounded-full h-9 text-[12px] border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          onClick={markAllAbsent} disabled={!unmarked.length}>
          <X size={13} className="mr-1"/> Mark {unmarked.length} unmarked Absent
        </Button>
        <Button size="sm" variant="outline" className="rounded-full h-9 text-[12px] border-white/10 bg-white/5 text-white/80 hover:bg-white/10" onClick={applyGrace}>
          <Sparkles size={13} className="mr-1"/> Grace marks
        </Button>
        <Button size="sm" variant="outline" className="rounded-full h-9 text-[12px] border-white/10 bg-white/5 text-white/80 hover:bg-white/10" onClick={clearAll}>
          <X size={13} className="mr-1"/> Clear
        </Button>
        <Button size="sm" variant="outline" className="rounded-full h-9 text-[12px] border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
          onClick={bulkWhatsApp}>
          <Send size={13} className="mr-1"/> WhatsApp at-risk
        </Button>
        <div className="ml-auto text-[11px] text-white/50 self-center">
          {students.length} students • {numericMarks.length} entered • {unmarked.length} unmarked
        </div>
      </div>
    </div>

    {/* === KPI ROW === */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <Card className="p-4 rounded-[22px] border-cyan-400/20 bg-cyan-500/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-cyan-300 uppercase flex items-center gap-1"><Users size={12}/> Entered</div>
        <div className="text-[24px] font-black text-cyan-300 mt-1">{numericMarks.length}/{students.length}</div>
        <div className="text-[10px] text-cyan-200/70 mt-0.5">Students marked</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-emerald-400/20 bg-emerald-500/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-emerald-300 uppercase flex items-center gap-1"><Target size={12}/> Class Avg</div>
        <div className="text-[24px] font-black text-emerald-300 mt-1">{numericMarks.length ? stats.avg : '—'}%</div>
        <div className="text-[10px] text-emerald-200/70 mt-0.5">Pass {stats.passPct}% • Median {stats.median || '—'}</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-violet-400/20 bg-violet-500/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-violet-300 uppercase flex items-center gap-1"><Award size={12}/> Highest</div>
        <div className="text-[24px] font-black text-violet-300 mt-1">{numericMarks.length ? stats.highest : '—'}%</div>
        <div className="text-[10px] text-violet-200/70 mt-0.5">Lowest {numericMarks.length ? stats.lowest : '—'}%</div>
      </Card>
      <Card className="p-4 rounded-[22px] border-rose-400/20 bg-rose-500/10 backdrop-blur-md text-white">
        <div className="text-[11px] font-bold text-rose-300 uppercase flex items-center gap-1"><AlertTriangle size={12}/> At Risk</div>
        <div className="text-[24px] font-black text-rose-300 mt-1">{atRisk.length}</div>
        <div className="text-[10px] text-rose-200/70 mt-0.5">Below {PASSING_PERCENT+8}% threshold</div>
      </Card>
    </div>
     
    <div className="grid lg:grid-cols-3 gap-3">
      {/* Distribution chart */}
      <Card className="rounded-[22px] border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-4 text-white lg:col-span-2">
        <CardTitle className="text-[14px] flex items-center gap-2 mb-2"><BarChart3 size={16} className="text-cyan-300"/> Grade Distribution</CardTitle>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} margin={{top:10,right:10,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="grade" stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} allowDecimals={false}/>
              <Tooltip
                contentStyle={{ background:'rgba(9,11,18,.95)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, fontSize:12 }}
                labelStyle={{ color:'#fff', fontWeight:'bold' }}
              />
              <Bar dataKey="count" radius={[10,10,4,4]}>
                {distributionData.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* AI Insight */}
      <Card className="rounded-[22px] border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 p-4 text-white">
        <CardTitle className="text-[14px] flex items-center gap-2 mb-2"><Brain size={16} className="text-violet-300"/> AI Class Insight</CardTitle>
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4 text-[12px] text-white/70"><Sparkles className="animate-spin" size={14}/> Analyzing class performance…</div>
        ) : aiInsight ? (
          <div className="text-[12px] leading-relaxed text-white/85 whitespace-pre-wrap">{aiInsight}</div>
        ) : (
          <p className="text-[12px] text-white/60 mb-3">Get AI-generated observations about class performance, at-risk students, and teaching suggestions based on these marks.</p>
        )}
        <Button size="sm" variant="gradient" className="rounded-full mt-2" onClick={runAIInsight} disabled={aiLoading||!numericMarks.length}>
          <Sparkles size={13} className="mr-1"/> {aiInsight ? 'Refresh insight' : 'Generate insight'}
        </Button>
      </Card>
    </div>

    {/* === STUDENT ROSTER (marks entry) === */}
    <Card className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <CardTitle className="text-[14px] text-white flex items-center gap-2"><BookOpen size={15} className="text-cyan-300"/> {classSel} • {subject} • {EXAM_LABELS[exam]} (out of {maxMarks})</CardTitle>
        <span className="text-[11px] text-white/50">Tap cell to edit</span>
      </div>

      <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto scrollbar-thin">
        {students.map((s, idx) => {
          const r = marksMap[s.id] || { obtained: '' as const, status: '' as SpecialStatus, remarks: '' }
          const hasMark = typeof r.obtained === 'number'
          const pct: number = hasMark && !r.status && typeof r.obtained === 'number'
            ? Math.round((r.obtained/maxMarks)*1000)/10 : 0
          const grade = r.status ? 'AB' : hasMark && typeof r.obtained==='number' ? gradeFromMarks(r.obtained, maxMarks) : '—'
          const gpa = hasMark && !r.status && typeof r.obtained==='number' ? gpaFromMarks(r.obtained, maxMarks).toFixed(2) : '—'
          const agg = aggregateMap[s.id] as any
          const att = attendanceOfStudent(s.id)
          const isAtRisk = hasMark && !r.status && pct < PASSING_PERCENT
          const isExpanded = selectedStudent === s.id
          const isTopper = rankList[0]?.student.id === s.id && hasMark && !r.status

          return (
            <div key={s.id} className={cn("p-3 transition", isExpanded && "bg-white/[0.03]")}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 min-w-[40px] rounded-2xl relative bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold overflow-hidden">
                  {s.photoUrl ? <img src={s.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"/> : <span>{s.name?.[0]||'S'}</span>}
                  {isTopper && <span className="absolute -top-1 -right-1 text-[10px]">🏆</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-[14px] text-white truncate">{s.name}</span>
                    <span className="text-[10px] text-white/40">Roll {s.rollNumber||'—'}</span>
                    {att != null && <span className="text-[10px] text-white/40">• Att {att}%</span>}
                    {agg?.predicted != null && hasMark && !r.status && (
                      <span className={cn("text-[10px] font-bold",
                        agg.predicted >= 60 ? 'text-emerald-300' : agg.predicted >= 40 ? 'text-amber-300' : 'text-rose-300')}>
                        🎯 Predicts {agg.predicted}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {r.status ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-400/30">
                        {r.status.toUpperCase()}
                      </span>
                    ) : hasMark ? (
                      <>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", gradeColorClasses(grade))}>
                          {grade}
                        </span>
                        <span className={cn("text-[11px] font-bold", isAtRisk?'text-rose-300':'text-white/70')}>{r.obtained}/{maxMarks}</span>
                        <span className="text-[10px] text-white/40">• GPA {gpa}</span>
                        {isAtRisk && <AlertTriangle size={11} className="text-rose-400"/>}
                      </>
                    ) : (
                      <span className="text-[11px] text-white/40 italic">Not entered</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number" min={0} max={maxMarks}
                    disabled={!!r.status}
                    value={r.status ? '' : (r.obtained ?? '')}
                    onChange={e=>setMark(s.id, { obtained: parseMarkInput(e.target.value), status: '' })}
                    className={cn("w-16 h-10 rounded-xl text-center font-bold text-[14px] bg-white/10 border-white/15 text-white",
                      isAtRisk && "border-rose-400/50 text-rose-200")}
                  />
                   <button
                    onClick={()=>setMark(s.id, { status: r.status === 'absent' ? '' : 'absent' })}
                    className={cn("h-10 px-2 rounded-xl text-[10px] font-bold border transition",
                      r.status==='absent' ? 'bg-rose-500 text-white border-rose-400' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10')}
                    title="Mark absent">AB</button>
                  <button
                    onClick={()=>setSelectedStudent(isExpanded?null:s.id)}
                    className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10">
                    <ChevronRight size={16} className={cn("transition", isExpanded && "rotate-90")}/>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 ml-[52px] space-y-2 animate-fade-in">
                  <div className="flex flex-wrap gap-1.5">
                    {REMARK_PRESETS.map(rp=>(
                      <button key={rp} onClick={()=>setMark(s.id, { remarks: rp })}
                        className={cn("px-2.5 py-1 rounded-full text-[10.5px] border",
                          r.remarks===rp ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10")}>
                        {rp}
                      </button>
                    ))}
                  </div>
                  <Input placeholder="Custom remark…" value={r.remarks||''}
                    onChange={e=>setMark(s.id, { remarks: e.target.value })}
                    className="h-9 rounded-xl bg-white/5 border-white/10 text-white text-[12px]"/>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-[11px] border-white/10 bg-white/5 text-white/80"
                      onClick={()=>pdfOne(s)}>
                      <Download size={12} className="mr-1"/> Report PDF
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-[11px] border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      onClick={()=>sendParentWhatsApp(s)}>
                      <Send size={12} className="mr-1"/> WhatsApp Parent
                    </Button>
                    {agg?.predicted != null && (
                      <span className="text-[10px] text-white/50 ml-auto">
                        Weighted: <b className="text-white">{agg.weighted||0}%</b> • Predicted final <b className="text-cyan-300">{agg.predicted}% ({agg.rangeLow}–{agg.rangeHigh})</b>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!students.length && (
          <div className="p-10 text-center text-white/50 text-sm">
            No students in {classSel||'this class'}. Add students from the Students page.
          </div>
        )}
      </div>

      <div className="p-4 flex items-center gap-2 flex-wrap border-t border-white/10 bg-black/20">
        <Button variant="outline" className="rounded-full h-11 border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={()=>save('draft')} disabled={saving||publishing}>
          <Clock size={15} className="mr-1"/> {saving?'Saving…':'Save draft'}
        </Button>
        <Button variant="outline" className="rounded-full h-11 border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={()=>save('submitted')} disabled={saving||publishing}>
          <CheckCircle2 size={15} className="mr-1"/> Submit to admin
        </Button>
        <Button variant="gradient" className="rounded-full h-11 font-bold ml-auto" onClick={()=>save('published')} disabled={saving||publishing}>
          <Send size={15} className="mr-1"/> {publishing?'Publishing…':'Publish to parents'}
        </Button>
      </div>
    </Card>

    {/* === BOTTOM CARDS: TOPPERS + AT RISK + CGPA TABLE === */}
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[22px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-4 text-white">
        <CardTitle className="text-[14px] flex items-center gap-2 mb-3"><Award size={16} className="text-amber-300"/> Top Performers</CardTitle>
        {rankList.length ? (
          <div className="space-y-2">
            {rankList.map((m,i)=>(
              <div key={m.student.id} className="flex items-center gap-3">
                <span className={cn("w-8 h-8 rounded-full grid place-items-center font-black text-[12px]",
                  i===0?"bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,.4)]":
                  i===1?"bg-gradient-to-br from-slate-300 to-slate-400 text-black":
                  i===2?"bg-gradient-to-br from-amber-700 to-amber-800 text-white":
                  "bg-white/10 text-white/70")}>{i+1}</span>
                <div className="flex-1"><div className="font-bold text-[13px]">{m.student.name}</div>
                  <div className="text-[10px] text-white/50">Roll {m.student.rollNumber||'—'}</div></div>
                <span className="text-[14px] font-black text-emerald-300">{Math.round(m.percent)}%</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", gradeColorClasses(gradeFromMarks(m.percent)))}>
                  {gradeFromMarks(m.percent)}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/50">Enter marks to see the leaderboard.</p>}
      </Card>

      <Card className="rounded-[22px] border border-rose-400/20 bg-rose-500/5 backdrop-blur-md p-4 text-white">
        <CardTitle className="text-[14px] flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-rose-300"/> At-Risk Students</CardTitle>
        {atRisk.length ? (
          <div className="space-y-2">
            {atRisk.map(m=>{
              const a = aggregateMap[m.student.id] as any
              return (
              <div key={m.student.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 grid place-items-center text-[12px] font-bold">
                  {m.student.name?.[0]}
                </div>
                <div className="flex-1"><div className="font-bold text-[13px]">{m.student.name}</div>
                  {a?.predicted != null && (
                    <div className="text-[10px] text-rose-200/80">
                      Predicted final ~{a.predicted}%
                    </div>
                  )}</div>
                <span className="text-[14px] font-black text-rose-300">{Math.round(m.percent)}%</span>
                <button onClick={()=>sendParentWhatsApp(m.student)}
                  className="h-8 w-8 rounded-full bg-rose-500/20 border border-rose-400/30 grid place-items-center text-rose-200">
                  <Send size={12}/>
                </button>
              </div>
            )})}
          </div>
        ) : <p className="text-[12px] text-white/50">All entered students are above the at-risk threshold. 💪</p>}
      </Card>
    </div>

    {/* CGPA / Weighted Aggregate table */}
    {Object.keys(aggregateMap).length > 0 && exam !== 'final' && (
      <Card className="rounded-[22px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-4 text-white overflow-hidden">
        <CardTitle className="text-[14px] flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-violet-300"/> Weighted CGPA & Final Prediction</CardTitle>
        <p className="text-[11px] text-white/50 mb-3">Based on past exams + current marks + attendance. Predictions update live as you type.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-white/50 border-b border-white/10">
                <th className="py-2 px-2">Student</th>
                <th className="px-2">Weighted %</th>
                <th className="px-2">Grade</th>
                <th className="px-2">GPA</th>
                <th className="px-2">Predicted Final</th>
                <th className="px-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0,20).map(s=>{
                const a = aggregateMap[s.id] as any
                if (!a) return null
                return (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="py-2 px-2 font-semibold">{s.name}</td>
                    <td className="px-2">{a.weighted || '—'}</td>
                    <td className="px-2"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", gradeColorClasses(a.grade||'—'))}>{a.grade||'—'}</span></td>
                    <td className="px-2">{a.gpa?.toFixed?.(2) ?? '—'}</td>
                    <td className="px-2">
                      {a.predicted != null ? (
                        <span className={a.predicted>=60?'text-emerald-300':a.predicted>=40?'text-amber-300':'text-rose-300'}>
                          {a.rangeLow}–{a.rangeHigh}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-2">
                      {a.confidence != null ? (
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
                            style={{ width: `${Math.round(a.confidence*100)}%` }}/>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )
               })}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>
}