import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BrainCircuit, Camera, ChevronRight, Sparkles, TrendingUp, X } from 'lucide-react'

const actions = [
  { label: 'Open AI predictions', hint: 'Marks, risk & recommendations', to: '/ai', icon: TrendingUp },
  { label: 'Scan attendance', hint: 'Verify enrolled faces', to: '/attendance', icon: Camera },
]

export default function FloatingAIAssistant() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname === '/login' || location.pathname === '/onboarding') return null

  return (
    <div className="md:hidden fixed right-4 bottom-[100px] z-40">
      {open && (
        <div className="ai-assistant-panel absolute bottom-[62px] right-0 w-[min(330px,calc(100vw-32px))] rounded-[26px] p-3.5 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 px-1 pb-3">
            <div>
              <div className="flex items-center gap-2 text-[14px] font-extrabold"><Sparkles size={15} className="text-cyan-300"/> EduSphere Copilot</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-400">Choose a live AI tool. Predictions use saved school records only.</div>
            </div>
            <button aria-label="Close AI Copilot" onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 text-slate-400"><X size={15}/></button>
          </div>
          <div className="space-y-2">
            {actions.map(action => (
              <button
                key={action.to}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.045] p-3 text-left transition active:scale-[.98]"
                onClick={() => { navigate(action.to); setOpen(false) }}
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300"><action.icon size={18}/></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">{action.label}</span>
                  <span className="block text-[10px] text-slate-400">{action.hint}</span>
                </span>
                <ChevronRight size={15} className="text-slate-500"/>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="ai-fab relative grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_0_34px_rgba(109,64,255,.5)]"
      >
        <span className="absolute inset-0 rounded-full ai-fab-ring" />
        {open ? <X size={21}/> : <BrainCircuit size={23}/>} 
      </button>
    </div>
  )
}
