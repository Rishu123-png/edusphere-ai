import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getOfflineQueue, syncOfflineQueueToFirebase } from '@/lib/offlineSync'

export default function PendingSyncBanner() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(() => {
    setPending(getOfflineQueue().length)
    setOnline(navigator.onLine)
  }, [])

  useEffect(() => {
    refresh()
    const onOnline = () => { refresh()
      const q = getOfflineQueue(); if (q.length) { setSyncing(true); syncOfflineQueueToFirebase().finally(()=>{setSyncing(false); refresh()}) }
    }
    const onOffline = () => refresh()
    const onStorage = () => refresh()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('storage', onStorage)
    const i = window.setInterval(refresh, 2000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(i)
    }
  }, [refresh])

  // Don't show banner when everything is clean
  if (!pending && online && !syncing) return null

  if (!online) {
    return (
      <div className="sticky top-0 z-[70] px-3 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-amber-500/15 border border-amber-400/30 backdrop-blur px-3 py-2 text-[12px] text-amber-200">
          <WifiOff size={14} className="shrink-0" />
          <span className="flex-1">Offline — {pending} record{pending===1?'':'s'} queued. Will auto-sync when internet returns.</span>
        </div>
      </div>
    )
  }

  if (syncing) {
    return (
      <div className="sticky top-0 z-[70] px-3 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 backdrop-blur px-3 py-2 text-[12px] text-cyan-100">
          <RefreshCw size={14} className="shrink-0 animate-spin" />
          <span>Syncing {pending} offline record{pending===1?'':'s'}...</span>
        </div>
      </div>
    )
  }

  if (pending > 0) {
    return (
      <div className="sticky top-0 z-[70] px-3 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 backdrop-blur px-3 py-2 text-[12px] text-cyan-100">
          <RefreshCw size={14} className="shrink-0" />
          <span className="flex-1">{pending} pending record{pending===1?'':'s'} waiting to sync.</span>
          <button onClick={async ()=>{setSyncing(true); await syncOfflineQueueToFirebase(); setSyncing(false); refresh()}}
            className="rounded-full bg-cyan-400/90 text-slate-900 font-semibold px-3 py-0.5 text-[11px]">Sync now</button>
        </div>
      </div>
    )
  }

  // Briefly show "synced!"
  return (
    <div className="sticky top-0 z-[70] px-3 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 backdrop-blur px-3 py-2 text-[12px] text-emerald-100">
        <CheckCircle2 size={14} className="shrink-0" />
        <span>All records synced.</span>
      </div>
    </div>
  )
}
