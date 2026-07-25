import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

type PromptEvt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'edusphere_pwa_install_dismissed_until'

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<PromptEvt | null>(null)
  const [visible, setVisible] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    // iOS Safari detection: supports PWA add-to-homescreen but no beforeinstallprompt
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    if (isStandalone) return

    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || '0')
    if (Date.now() < dismissedUntil) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as PromptEvt)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    if (isIOS) {
      // Show a small iOS hint after a short delay
      const t = window.setTimeout(() => setShowIosHint(true), 2500)
      return () => { window.removeEventListener('beforeinstallprompt', handler); window.clearTimeout(t) }
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = (days = 14) => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + days*24*60*60*1000))
    setVisible(false); setShowIosHint(false)
  }

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  if (!visible && !showIosHint) return null

  return (
    <div className="fixed left-3 right-3 z-[65]" style={{ bottom: 'calc(100px + env(safe-area-inset-bottom))' }}>
      <div className="mx-auto max-w-md rounded-[20px] bg-[#0c1125]/90 backdrop-blur-xl border border-cyan-400/30 shadow-2xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {visible ? (
            <>
              <div className="text-[13px] font-bold text-white leading-tight">Install EduSphere AI</div>
              <div className="text-[11px] text-white/70 leading-tight mt-0.5">Add to Home Screen for one-tap access and parent alerts.</div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-bold text-white leading-tight">Add to Home Screen</div>
              <div className="text-[11px] text-white/70 leading-tight mt-0.5">Tap Safari's Share → "Add to Home Screen" for full app experience.</div>
            </>
          )}
        </div>
        {visible ? (
          <>
            <button onClick={install} className="rounded-full bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 text-[12px] flex items-center gap-1 shrink-0">
              <Download size={13} /> Install
            </button>
            <button onClick={()=>dismiss(14)} className="text-white/60 p-1 shrink-0" aria-label="Later">
              <X size={16} />
            </button>
          </>
        ) : (
          <button onClick={()=>dismiss(7)} className="text-white/60 p-1 shrink-0" aria-label="Later">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
