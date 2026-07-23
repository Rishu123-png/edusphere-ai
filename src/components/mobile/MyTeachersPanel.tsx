import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { getStudentTeachers } from '@/lib/teachers'
import { BookOpen, ChevronRight, UserRound, Clock3, CalendarDays, GraduationCap } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SLOTS = ['08:30-09:15', '09:15-10:00', '10:15-11:00', '11:00-11:45', '12:30-13:15']

/**
 * Shows a student's subjects and the teacher assigned to each (subject + class).
 * Tapping a teacher opens a read-only "teacher dashboard" (profile + timetable)
 * so a student / parent can jump straight to that teacher's workspace context.
 */
export default function MyTeachersPanel({
  className,
  section,
  subjects,
  title = 'My Teachers',
}: {
  className?: string
  section?: string
  subjects?: string[]
  title?: string
}) {
  const { schoolId } = useSchool()
  const [teachers, setTeachers] = useState<any[]>([])
  const [schedule, setSchedule] = useState<Record<string, string>>({})
  const [openTeacher, setOpenTeacher] = useState<any | null>(null)

  useEffect(() => {
    if (!schoolId) {
      setTeachers([])
      return
    }
    const unsub = onValue(ref(db, `schools/${schoolId}/teachers`), (snap) => {
      const v = snap.val() || {}
      setTeachers(Object.entries(v).map(([id, t]: any) => ({ id, ...t })))
    })
    return () => unsub()
  }, [schoolId])

  useEffect(() => {
    if (!schoolId) {
      setSchedule({})
      return
    }
    const unsub = onValue(ref(db, `schools/${schoolId}/schedule`), (snap) => {
      setSchedule(snap.val() || {})
    })
    return () => unsub()
  }, [schoolId])

  const mapping = useMemo(
    () => getStudentTeachers(teachers, className, section, subjects),
    [teachers, className, section, subjects],
  )

  const teacherSchedule = (teacher: any): string[] => {
    const name = (teacher.displayName || teacher.name || '').toLowerCase()
    const out: string[] = []
    DAYS.forEach((d) =>
      SLOTS.forEach((s) => {
        const v = schedule[`${d}|${s}`] || ''
        if (v && v.toLowerCase().includes(name)) out.push(`${d} ${s}: ${v}`)
      }),
    )
    return out
  }

  if (!mapping.length) return null

  return (
    <>
      <Card className="rounded-[24px] border-indigo-100 dark:border-indigo-900/30">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-300" /> {title}
        </CardTitle>
        <CardContent className="space-y-2.5 pt-1">
          {mapping.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-indigo-500">
                  <BookOpen size={12} /> {m.subject}
                </div>
                {m.teacher ? (
                  <div className="mt-0.5 truncate text-[14px] font-extrabold">
                    {m.teacher.displayName || m.teacher.name}
                    {m.isClassTeacher && (
                      <span className="ml-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                        Class Teacher
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[12px] text-amber-600 dark:text-amber-400">
                    No teacher assigned yet for {m.subject}
                  </div>
                )}
              </div>
              {m.teacher && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full shrink-0"
                  onClick={() => setOpenTeacher(m.teacher)}
                >
                  View dashboard <ChevronRight size={14} />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!openTeacher} onOpenChange={(o) => !o && setOpenTeacher(null)}>
        <DialogContent className="rounded-[28px] max-h-[85vh] overflow-auto">
          {openTeacher && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
                    <UserRound size={18} />
                  </span>
                  {openTeacher.displayName || openTeacher.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subjects</div>
                    <div className="mt-1 font-semibold">{(openTeacher.subjects || []).join(', ') || '—'}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Classes</div>
                    <div className="mt-1 font-semibold">{(openTeacher.assignedClasses || []).join(', ') || '—'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                    <CalendarDays size={13} /> Timetable (this teacher)
                  </div>
                  {teacherSchedule(openTeacher).length ? (
                    <ul className="space-y-1 text-[12px] text-muted-foreground">
                      {teacherSchedule(openTeacher).map((line, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Clock3 size={12} className="text-indigo-400" /> {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">
                      {openTeacher.displayName || openTeacher.name} teaches {className}-{section}. The full timetable appears here once the admin publishes the schedule.
                    </p>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  This is a read-only view of {openTeacher.displayName || openTeacher.name}'s classroom context.
                  Your school admin controls teacher data and schedules.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
