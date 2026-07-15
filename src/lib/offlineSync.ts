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

export function getOfflineQueue(): OfflineAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as OfflineAttendanceRecord[]
  } catch {
    return []
  }
}

export function saveToOfflineQueue(records: OfflineAttendanceRecord[]) {
  try {
    const current = getOfflineQueue()
    const merged = [...current, ...records]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged.length
  } catch (e) {
    console.error('Failed to save to offline queue', e)
    return 0
  }
}

export async function syncOfflineQueueToFirebase(): Promise<number> {
  const queue = getOfflineQueue()
  if (!queue.length) return 0

  if (!navigator.onLine) {
    return 0
  }

  let syncedCount = 0
  const updatesByPath: Record<string, any> = {}

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
    await update(ref(db), updatesByPath)
    localStorage.removeItem(STORAGE_KEY)
    toast.success(`Cloud Sync • Successfully synced ${syncedCount} offline attendance records with Firebase!`)
    return syncedCount
  } catch (e: any) {
    console.error('Failed to sync offline queue', e)
    return 0
  }
}

/** Hook up global network listeners for automatic sync */
export function initOfflineAutoSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    const queue = getOfflineQueue()
    if (queue.length > 0) {
      toast.info(`Internet restored. Automatically syncing ${queue.length} offline attendance records...`)
      syncOfflineQueueToFirebase()
    }
  })
}
