import { cn } from '@/lib/utils'

export default function PageHeader({ title, subtitle, action, className }: { title: string, subtitle?: string, action?: React.ReactNode, className?: string }){
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] md:text-[30px] font-extrabold tracking-tight leading-[0.95]">{title}</h1>
        {subtitle && <p className="text-[13px] md:text-sm text-muted-foreground mt-1.5 leading-snug line-clamp-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
