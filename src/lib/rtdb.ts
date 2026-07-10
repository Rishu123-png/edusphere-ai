import { db } from './firebase'
import { ref, get, set, update, push, onValue, off } from 'firebase/database'

export const rtdb = {
  get: (path:string) => get(ref(db, path)),
  set: (path:string, val:any) => set(ref(db, path), val),
  update: (path:string, val:any) => update(ref(db, path), val),
  push: (path:string, val:any) => push(ref(db, path), val),
  // Fixed: onValue returns unsubscribe function directly - must return it
  listen: (path:string, cb:(snap:any)=>void) => {
    const r = ref(db, path)
    const unsub = onValue(r, cb)
    return () => unsub()
  },
  // Safe off wrapper
  off: (path:string) => {
    try { off(ref(db, path)) } catch {}
  }
}

export const nowTs = () => Date.now()
export const todayStr = () => new Date().toISOString().slice(0,10)
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
