import { Camera, ScanFace, CheckCircle2, Database, Users, BrainCircuit, LayoutDashboard, ChevronRight } from 'lucide-react'

const modules = [
  { step: '01', title: 'Camera', icon: Camera, status: 'Active Lens • Portrait/Landscape', color: 'from-emerald-500 to-teal-500' },
  { step: '02', title: 'Face Detection', icon: ScanFace, status: 'Landmarks • Liveness • Mask Check', color: 'from-cyan-500 to-blue-500' },
  { step: '03', title: 'Face Recognition', icon: CheckCircle2, status: '128-D Numerical Embedding Match', color: 'from-indigo-500 to-violet-500' },
  { step: '04', title: 'Student Database', icon: Database, status: 'Single Registration • Secure IDs', color: 'from-violet-500 to-fuchsia-500' },
  { step: '05', title: 'Attendance System', icon: Users, status: 'Auto Status • QR+Face Hybrid', color: 'from-pink-500 to-rose-500' },
  { step: '06', title: 'AI Analytics', icon: BrainCircuit, status: 'Bunk & Marks Forecast • Heatmap', color: 'from-amber-500 to-orange-500' },
  { step: '07', title: 'Teacher Dashboard', icon: LayoutDashboard, status: 'Live Occupancy • Voice Copilot', color: 'from-emerald-600 to-indigo-600' }
]

export default function ModuleArchitectureBanner() {
  return (
    <div className="w-full overflow-hidden rounded-[26px] border border-indigo-100/60 dark:border-indigo-900/40 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-xl p-4 md:p-5 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-extrabold text-xs">AI</span>
          <div>
            <h3 className="font-extrabold text-[14px] md:text-[15px] tracking-tight leading-none text-foreground">EduSphere AI Vision Pipeline</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">End-to-end 7-Stage Neural Architecture • Real-Time Biometric Verification</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/> PIPELINE ONLINE
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
        {modules.map((m, idx) => (
          <div key={m.title} className="relative group rounded-2xl bg-slate-50/80 dark:bg-zinc-800/60 border border-slate-150/60 dark:border-zinc-700/50 p-3 flex flex-col justify-between hover:scale-[1.02] transition">
            {idx < modules.length - 1 && (
              <ChevronRight size={16} className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600 z-10" />
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500">{m.step}</span>
              <span className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${m.color} text-white shadow-sm`}><m.icon size={14}/></span>
            </div>
            <div>
              <div className="font-extrabold text-[12px] text-foreground leading-tight">{m.title}</div>
              <div className="text-[9.5px] text-muted-foreground leading-snug mt-1 line-clamp-2">{m.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
