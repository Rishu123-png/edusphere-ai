import { db } from './firebase'
import { ref, update } from 'firebase/database'
import { toast } from 'sonner'

export interface OfflineAttendanceRecord {
  id: string
  schoolId: string
  date: string
  studentId: string
  className: string
  section: string
  status: 'present' | 'absent' | 'late' | 'leave'
  markedBy?: string
  method: 'manual' | 'ai_camera' | 'qr'
  timestamp: number
}

const STORAGE_KEY = 'edusphere_offline_attendance_queue'
let onlineListenerRegistered = false
let syncing = false

function isAttendanceRecord(value: unknown): value is OfflineAttendanceRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<OfflineAttendanceRecord>
  return Boolean(item.id && item.date && item.studentId && item.className && item.section && item.status && item.method)
}

export function getOfflineQueue(): OfflineAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isAttendanceRecord) : []
  } catch (error) {
    console.warn('Invalid offline queue. Resetting local queue.', error)
    localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

export function saveToOfflineQueue(records: OfflineAttendanceRecord[]) {
  try {
    const current = getOfflineQueue()
    const byId = new Map<string, OfflineAttendanceRecord>()
    for (const record of [...current, ...records].filter(isAttendanceRecord)) {
      byId.set(record.id, record)
    }
    const merged = Array.from(byId.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged.length
  } catch (e) {
    console.error('Failed to save to offline queue', e)
    return 0
  }
}

export async function syncOfflineQueueToFirebase(): Promise<number> {
  if (syncing) return 0

  const queue = getOfflineQueue()
  if (!queue.length || !navigator.onLine) return 0

  let syncedCount = 0
  const updatesByPath: Record<string, unknown> = {}

  for (const item of queue) {
    const path = `schools/${item.schoolId || 'global'}/attendance/${item.date}/${item.studentId}`
    updatesByPath[path] = {
      studentId: item.studentId,
      className: item.className,
      section: item.section,
      date: item.date,
      status: item.status,
      markedBy: item.markedBy || 'system',
      method: item.method,
      timestamp: item.timestamp || Date.now(),
      syncedFromOffline: true
    }
    syncedCount++
  }

  try {
    syncing = true
    await update(ref(db), updatesByPath)
    localStorage.removeItem(STORAGE_KEY)
    toast.success(`Cloud Sync • Successfully synced ${syncedCount} offline attendance records with Firebase!`)
    return syncedCount
  } catch (e) {
    console.error('Failed to sync offline queue', e)
    return 0
  } finally {
    syncing = false
  }
}

/** Hook up global network listeners for automatic sync */
export function initOfflineAutoSync() {
  if (typeof window === 'undefined' || onlineListenerRegistered) return

  const handleOnline = () => {
    const queue = getOfflineQueue()
    if (queue.length > 0) {
      toast.info(`Internet restored. Automatically syncing ${queue.length} offline attendance records...`)
      void syncOfflineQueueToFirebase()
    }
  }

  window.addEventListener('online', handleOnline)
  onlineListenerRegistered = true

  return () => {
    window.removeEventListener('online', handleOnline)
    onlineListenerRegistered = false
  }
}
