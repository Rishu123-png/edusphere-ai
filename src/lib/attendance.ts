/**
 * Subject/period-wise attendance helpers (v2.9)
 *
 * Data shape (RTDB):
 *   schools/{sid}/attendance/{dateYYYY-MM-DD}/{classKey e.g. "11-A"}/{periodKey}/{studentId} = {
 *     studentId, className, section, subject, periodIdx, periodName, slotKey,
 *     date, status: 'present'|'late'|'absent',
 *     markedBy, markedByName, method,
 *     isMorningRegister?: true,
 *     lockedAt?: number,     // set UNDO_WINDOW_MS after save
 *     createdAt, updatedAt
 *   }
 *
 * periodKey:
 *   - "morning"        : class-teacher morning register (period 0)
 *   - "p{idx}:{hhmm}"  : e.g. "p3:1030" for period index 3 starting 10:30
 *
 * Backward-compat: legacy flat records at attendance/{date}/{studentId} are
 * read into history but never overwritten — new writes always go to period-keyed paths.
 */
import { db } from './firebase'
import { ref, get, set, update, onValue } from 'firebase/database'
import { todayIST } from './rtdb'

export const UNDO_WINDOW_MS = 5 * 60 * 1000 // 5 minutes to undo/change after save
export const LATE_CUTOFF_MINUTES = 9 * 60 + 15 // 9:15 AM IST

export type AttendanceStatus = 'present' | 'late' | 'absent'
export type AttendanceMethod = 'manual' | 'ai_camera' | 'qr' | 'bulk'

export interface AttendanceRecord {
  studentId: string
  className: string
  section: string
  classKey: string
  subject: string
  periodIdx: number
  periodName?: string
  slotKey: string          // 'morning' | `p${idx}`
  date: string
  status: AttendanceStatus
  markedBy?: string
  markedByName?: string
  method?: AttendanceMethod
  isMorningRegister?: boolean
  lockedAt?: number
  createdAt: number
  updatedAt: number
  confidence?: number
}

export interface ScheduleSlot {
  start: string            // "HH:MM"
  end: string
  startMin: number
  endMin: number
}

export interface PeriodCell { subject?: string; teacherId?: string; teacherName?: string }
export interface ScheduleForClass {
  slots: ScheduleSlot[]
  days?: string[]
  grid?: Record<string, PeriodCell> // key = `${day}:${slotIdx}`
}

export const DOW_IN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function periodKey(periodIdx: number, startHhmm?: string): string {
  if (periodIdx === -1) return 'morning'
  return `p${periodIdx}:${(startHhmm || '0000').replace(':', '')}`
}

export function classKeyOf(s: { className?: string; section?: string } | string, section?: string): string {
  if (typeof s === 'string') return section ? `${s}-${section}` : s
  return `${s.className || ''}-${s.section || ''}`
}

export function istNowParts(): { dow: string; minutes: number; hhmm: string } {
  // Build a date formatter that pins Asia/Kolkata regardless of device TZ.
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  let dow = 'Mon', hh = '00', mm = '00'
  for (const p of parts) {
    if (p.type === 'weekday') dow = p.value
    else if (p.type === 'hour') hh = p.value
    else if (p.type === 'minute') mm = p.value
  }
  return { dow, minutes: toMin(`${hh}:${mm}`), hhmm: `${hh}:${mm}` }
}

/** Find the currently-running or next-up period for a teacher in a given class schedule. */
export function resolveTeacherPeriod(
  schedule: ScheduleForClass | undefined,
  dow: string,
  minutesNow: number,
  opts: { onlyMine?: boolean; teacherId?: string; subject?: string } = {}
): { idx: number; slot: ScheduleSlot; cell: PeriodCell; isLive: boolean } | null {
  if (!schedule?.slots?.length) return null
  const { onlyMine, teacherId, subject } = opts
  let live: { idx: number; slot: ScheduleSlot; cell: PeriodCell; isLive: boolean } | null = null
  let next: { idx: number; slot: ScheduleSlot; cell: PeriodCell; isLive: boolean } | null = null
  for (let i = 0; i < schedule.slots.length; i++) {
    const slot = schedule.slots[i]
    const cell: PeriodCell = schedule.grid?.[`${dow}:${i}`] || {}
    if (!cell.subject || ['Lunch', 'Break', 'Assembly', 'PT', 'Library'].includes(cell.subject)) continue
    if (onlyMine) {
      const mine =
        (teacherId && cell.teacherId === teacherId) ||
        (subject && cell.subject?.toLowerCase() === subject.toLowerCase())
      if (!mine) continue
    }
    if (minutesNow >= slot.startMin && minutesNow < slot.endMin) {
      live = { idx: i, slot, cell, isLive: true }; break
    }
    if (!live && minutesNow < slot.startMin && !next) {
      next = { idx: i, slot, cell, isLive: false }
    }
  }
  return live || next
}

export function isSundayOrHoliday(dow: string, events: any[]): boolean {
  if (dow === 'Sun') return true
  const today = todayIST()
  return events.some(e => e && e.type === 'holiday' && (e.date === today))
}

/** Build a bunking report: students marked present in morning register but absent in ≥1 later period today. */
export function buildBunkingReport(
  dayData: Record<string, any> | undefined,
  students: any[]
): Array<{ student: any; absentPeriods: Array<{ idx: number; subject: string; slot: ScheduleSlot }> }> {
  if (!dayData) return []
  const morning = dayData.morning || {}
  const out: Array<{ student: any; absentPeriods: Array<{ idx: number; subject: string; slot: ScheduleSlot }> }> = []
  for (const s of students) {
    const mr = morning[s.id]
    if (!mr || (mr.status !== 'present' && mr.status !== 'late')) continue
    const absentPeriods: Array<{ idx: number; subject: string; slot: ScheduleSlot }> = []
    for (const [pkey, precs] of Object.entries(dayData)) {
      if (pkey === 'morning') continue
      if (!pkey.startsWith('p')) continue
      const idx = parseInt(pkey.slice(1).split(':')[0], 10)
      const rec = (precs as any)?.[s.id]
      if (rec?.status === 'absent') {
        absentPeriods.push({ idx, subject: rec.subject || '—', slot: { start: '', end: '', startMin: 0, endMin: 0 } })
      }
    }
    if (absentPeriods.length) out.push({ student: s, absentPeriods })
  }
  return out
}

export function isRecordLocked(rec: { lockedAt?: number; updatedAt?: number; createdAt?: number } | undefined): boolean {
  if (!rec) return false
  const t = rec.lockedAt || (rec.updatedAt || rec.createdAt || 0) + UNDO_WINDOW_MS
  return Date.now() > t
}

export function computeLockAt(createdAt: number): number {
  return createdAt + UNDO_WINDOW_MS
}

/** Seed default Indian public holidays for a school year on first run. */
export const DEFAULT_INDIAN_HOLIDAYS_2025_26: Array<{ title: string; date: string; note?: string }> = [
  { title: 'Independence Day',         date: '2025-08-15', note: 'National holiday' },
  { title: 'Raksha Bandhan',           date: '2025-08-09' },
  { title: 'Janmashtami',              date: '2025-08-16' },
  { title: 'Gandhi Jayanti',           date: '2025-10-02', note: 'National holiday' },
  { title: 'Dussehra (Vijayadashami)', date: '2025-10-02' },
  { title: 'Diwali',                   date: '2025-10-20' },
  { title: 'Bhai Dooj',                date: '2025-10-22' },
  { title: 'Guru Nanak Jayanti',       date: '2025-11-05' },
  { title: 'Christmas',                date: '2025-12-25' },
  { title: 'Republic Day',             date: '2026-01-26', note: 'National holiday' },
  { title: 'Holi',                     date: '2026-03-03' },
  { title: 'Good Friday',              date: '2026-04-03' },
  { title: 'Eid-ul-Fitr',              date: '2026-03-20' },
  { title: 'Ambedkar Jayanti',         date: '2026-04-14' },
  { title: 'Raksha Bandhan (2026)',    date: '2026-08-19' },
  { title: 'Independence Day (2026)',  date: '2026-08-15' },
]

export async function seedDefaultHolidaysIfEmpty(schoolId: string): Promise<void> {
  if (!schoolId) return
  try {
    const snap = await get(ref(db, `schools/${schoolId}/events`))
    const existing = snap.val() || {}
    if (Object.keys(existing).length) return
    const updates: Record<string, any> = {}
    for (const h of DEFAULT_INDIAN_HOLIDAYS_2025_26) {
      const key = `holiday_${h.date.replace(/-/g, '')}`
      updates[`schools/${schoolId}/events/${key}`] = {
        id: key,
        title: h.title,
        date: h.date,
        type: 'holiday',
        note: h.note || 'Default Indian holiday — edit/delete as needed',
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    }
    await update(ref(db), updates)
  } catch { /* ignore */ }
}
