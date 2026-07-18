import { cn } from '@/lib/utils'

export default function PageHeader({ title, subtitle, action, className }: { title: string, subtitle?: string, action?: React.ReactNode, className?: string }){
  return (
    <div className={cn('mobile-page-header flex flex-col gap-3 md:flex-row md:items-start md:justify-between', className)}>
      <div className="min-w-0">
        <div className="mobile-page-kicker mb-2 inline-flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.18em] text-cyan-400/80 dark:text-cyan-300/70">
          <span className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_7px_rgba(34,211,238,.75)] dark:bg-cyan-300" />
          EduSphere Intelligence
        </div>
        <h1 className="mobile-page-title text-[26px] md:text-[30px] font-extrabold tracking-tight leading-[0.95]">{title}</h1>
        {subtitle && <p className="text-[13px] md:text-sm text-muted-foreground mt-1.5 leading-snug max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2 self-start md:self-auto">{action}</div>}
    </div>
  )
}
