import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardCheck, FileText, Settings, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { AnimeBounceClick } from '../AnimeWrapper'

const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['super_admin','school_admin','teacher'] },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['super_admin','school_admin','teacher'] },
  { to: '/marks', label: 'Marks', icon: FileText, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/ai', label: 'AI', icon: Brain, roles: ['super_admin','school_admin','teacher','parent'] },
]

export default function BottomNav(){
  const { profile } = useAuth()
  const role = profile?.role || 'student'
  const visibleTabs = tabs.filter(t => t.roles.includes(role)).slice(0,5)
  // If less than 5, add Settings as last
  if(visibleTabs.length < 5){
    visibleTabs.push({ to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','school_admin','teacher','student','parent'] })
  }
  const loc = useLocation()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-[420px] bottom-nav-glass rounded-full flex items-center justify-around p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.15)] pointer-events-auto">
        {visibleTabs.map(item => {
          const active = loc.pathname === item.to || (item.to !== '/' && loc.pathname.startsWith(item.to))
          return (
            <AnimeBounceClick key={item.to}>
              <NavLink to={item.to} className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-full transition-all min-w-[56px]", active ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow" : "text-zinc-500 dark:text-zinc-400") }>
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </NavLink>
            </AnimeBounceClick>
          )
        })}
      </div>
    </div>
  )
}