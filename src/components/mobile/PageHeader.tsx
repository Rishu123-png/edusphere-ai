import { cn } from '@/lib/utils'

export default function PageHeader({ title, subtitle, action, className }: { title: string, subtitle?: string, action?: React.ReactNode, className?: string }){
  return (
    <div className={cn("mobile-page-header flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="mobile-page-kicker mb-2 hidden items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.18em] text-cyan-300/70"><span className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_7px_#4ee8db]"/> EduSphere Intelligence</div>
        <h1 className="mobile-page-title text-[26px] md:text-[30px] font-extrabold tracking-tight leading-[0.95]">{title}</h1>
        {subtitle && <p className="text-[13px] md:text-sm text-muted-foreground mt-1.5 leading-snug line-clamp-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
