// Per-school branding helpers. Persists to RTDB under schools/{sid}/branding so
// the logo / signature / school-wide settings are shared across every device
// a staff member logs in from. localStorage is a warm cache for offline starts.
import { db } from './firebase'
import { ref, get, set, onValue } from 'firebase/database'

export type SchoolBranding = {
  logoDataUrl?: string
  principalName?: string
  principalSignature?: string // base64 PNG
  schoolAddress?: string
  whatsappAutoSend?: boolean
  whatsappAutoSendTime?: string // "15:00"
}

const CACHE_KEY = (schoolId: string) => `edusphere_branding_cache_${schoolId}`

function cacheSet(schoolId: string, b: SchoolBranding) {
  try { localStorage.setItem(CACHE_KEY(schoolId), JSON.stringify(b)) } catch { /* ignore */ }
}

export function loadBrandingCached(schoolId?: string): SchoolBranding {
  if (!schoolId) return {}
  try { return JSON.parse(localStorage.getItem(CACHE_KEY(schoolId)) || '{}') } catch { return {} }
}

/** One-shot read of cloud branding. Falls back to cache if offline. */
export async function loadBranding(schoolId?: string): Promise<SchoolBranding> {
  if (!schoolId) return {}
  try {
    const snap = await get(ref(db, `schools/${schoolId}/branding`))
    if (snap.exists()) {
      const v = snap.val() as SchoolBranding
      cacheSet(schoolId, v)
      return v
    }
  } catch { /* offline or permission — fall through to cache */ }
  return loadBrandingCached(schoolId)
}

/** Subscribe to cloud branding; calls back immediately with cache, then again with cloud value. Returns unsubscribe. */
export function subscribeBranding(schoolId: string | undefined, cb: (b: SchoolBranding) => void): () => void {
  if (!schoolId) { cb({}); return () => {} }
  // Emit cache first so UI paints instantly
  cb(loadBrandingCached(schoolId))
  try {
    const r = ref(db, `schools/${schoolId}/branding`)
    const unsub = onValue(r, snap => {
      if (snap.exists()) {
        const v = snap.val() as SchoolBranding
        cacheSet(schoolId, v)
        cb(v)
      }
    }, () => { /* read denied/offline — keep cache */ })
    return () => { try { unsub() } catch { /* ignore */ } }
  } catch {
    return () => {}
  }
}

export async function saveBranding(schoolId: string, b: SchoolBranding) {
  cacheSet(schoolId, b)
  try { await set(ref(db, `schools/${schoolId}/branding`), b) }
  catch { /* offline — cache holds the value; will sync on reconnect via offlineSync if needed */ }
}

export function fileToDataUrl(file: File, maxDim = 600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => resolve(String(reader.result))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        // PNG for signatures/large logos (transparency), JPEG otherwise
        const isPng = file.type === 'image/png' || String(file.name || '').toLowerCase().endsWith('.png')
        resolve(c.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
