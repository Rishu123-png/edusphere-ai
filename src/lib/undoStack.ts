/* eslint-disable @typescript-eslint/no-explicit-any */
// Simple undo stack for EduSphere actions — 6-second window per action,
// single-step undo (the UX everyone expects).
import { toast } from 'sonner'

type UndoEntry = {
  id: string
  label: string
  undo: () => Promise<void> | void
  timestamp: number
}

const WINDOW_MS = 6_000
let stack: UndoEntry[] = []
let timer: number | null = null

function scheduleExpire() {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    // drop all expired entries
    const now = Date.now()
    stack = stack.filter(e => now - e.timestamp < WINDOW_MS)
    if (stack.length) scheduleExpire()
  }, WINDOW_MS + 50)
}

export function pushUndoable(label: string, undo: () => Promise<void> | void, doAction?: () => void) {
  if (doAction) {
    try { doAction() } catch (e) { console.error(e); return }
  }
  const entry: UndoEntry = { id: Math.random().toString(36).slice(2), label, undo, timestamp: Date.now() }
  stack = [entry]  // single-step undo only — last action
  scheduleExpire()

  toast.success(`${label}`, {
    duration: WINDOW_MS,
    action: { label: 'Undo', onClick: async () => {
      try { await undo(); toast.success(`Undone: ${label}`) }
      catch (e) { console.error('undo failed', e); toast.error('Could not undo — please check permissions.') }
      stack = stack.filter(e => e.id !== entry.id)
    }}
  })
}

export function clearUndo() { stack = []; if (timer) window.clearTimeout(timer); timer = null }
export function hasUndo() { const now=Date.now(); return stack.some(e=>now-e.timestamp<WINDOW_MS) }
