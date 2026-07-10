import { db } from './firebase'
import { ref, get, set, update, push, query, orderByChild, equalTo, onValue, off, serverTimestamp } from 'firebase/database'

export const rtdb = {
  get: (path:string) => get(ref(db, path)),
  set: (path:string, val:any) => set(ref(db, path), val),
  update: (path:string, val:any) => update(ref(db, path), val),
  push: (path:string, val:any) => push(ref(db, path), val),
  listen: (path:string, cb:(snap:any)=>void) => {
    const r = ref(db, path)
    onValue(r, cb)
    return () => off(r)
  }
}

export const nowTs = () => Date.now()
export const todayStr = () => new Date().toISOString().slice(0,10)
