// Helper utilities for mapping students → subjects → teachers.
// Core of the new "students go to their teacher's dashboard" feature.

export const norm = (v: unknown) => String(v ?? '').trim()
export const normLower = (v: unknown) => norm(v).toLowerCase()

export function classKeyOf(className?: string, section?: string) {
  return `${norm(className)}-${norm(section)}`
}

/** Every teacher who can teach in this class-section. */
export function findTeachersForClass(teachers: any[], className?: string, section?: string): any[] {
  const key = classKeyOf(className, section)
  if (!key || key === '-') return []
  return teachers.filter(
    (t) =>
      (t.assignedClasses || []).map(norm).includes(key) ||
      (t.classTeacherOf && norm(t.classTeacherOf) === key),
  )
}

/** Best teacher for a given subject in a class (falls back to class teacher). */
export function findTeacherForSubject(
  teachers: any[],
  className?: string,
  section?: string,
  subject?: string,
): { teacher: any | null; isClassTeacher: boolean } {
  const key = classKeyOf(className, section)
  const subj = normLower(subject)
  const pool = findTeachersForClass(teachers, className, section)
  if (subj) {
    const bySubject = pool.find((t) => (t.subjects || []).map(normLower).includes(subj))
    if (bySubject) return { teacher: bySubject, isClassTeacher: false }
  }
  const classTeacher = pool.find((t) => t.classTeacherOf && norm(t.classTeacherOf) === key)
  if (classTeacher) return { teacher: classTeacher, isClassTeacher: true }
  return { teacher: null, isClassTeacher: false }
}

export interface StudentTeacherMapping {
  subject: string
  teacher: any | null
  isClassTeacher: boolean
}

/** Build a subject → teacher mapping for a student's enrolled subjects. */
export function getStudentTeachers(
  teachers: any[],
  className?: string,
  section?: string,
  subjects: string[] = [],
): StudentTeacherMapping[] {
  const list = subjects.length ? subjects : ['General']
  const seen = new Set<string>()
  const out: StudentTeacherMapping[] = []
  for (const subj of list) {
    const key = normLower(subj)
    if (seen.has(key)) continue
    seen.add(key)
    const { teacher, isClassTeacher } = findTeacherForSubject(teachers, className, section, subj)
    out.push({ subject: subj, teacher, isClassTeacher })
  }
  return out
}
