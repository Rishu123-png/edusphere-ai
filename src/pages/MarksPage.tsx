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
      const entry = { subject, ex