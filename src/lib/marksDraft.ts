// Auto-save draft marks entries so teachers don't lose work if tab refreshes/closes.
const KEY = 'edusphere_marks_draft_v1'

export type DraftMarks = {
  // keyed by `${schoolId}|${cls}|${subject}|${examType}`
  [composite: string]: {
    entries: Record<string, { marks?: string; remarks?: string; absent?: boolean }>
    maxMarks?: string
    savedAt: number
  }
}

export function loadAllDrafts(): DraftMarks {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function loadDraft(composite: string) {
  return loadAllDrafts()[composite] || null
}

export function saveDraft(composite: string, data: DraftMarks[string]) {
  try {
    const all = loadAllDrafts()
    all[composite] = { ...data, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch (e) { console.warn('Draft save failed', e) }
}

export function clearDraft(composite: string) {
  try {
    const all = loadAllDrafts()
    delete all[composite]
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // localStorage unavailable (private mode / quota) — drafts are best-effort.
  }
}

// Prune drafts older than 30 days
export function pruneDrafts() {
  try {
    const all = loadAllDrafts()
    const cut = Date.now() - 30*24*60*60*1000
    for (const k of Object.keys(all)) if ((all[k]?.savedAt||0) < cut) delete all[k]
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // localStorage unavailable (private mode / quota) — pruning is best-effort.
  }
}
