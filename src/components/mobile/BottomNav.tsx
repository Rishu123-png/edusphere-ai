import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardCheck, FileText, Settings, Brain, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { AnimeBounceClick } from '../AnimeWrapper'

const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/parent', label: 'My Child', icon: UserCircle, roles: ['parent'] },
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none" aria-label="Primary navigation">
      <div className="bottom-nav-glass mx-auto max-w-[480px] flex items-center justify-around px-2 pt-2 pointer-events-auto safe-bottom">
        {visibleTabs.map(item => {
          const active = loc.pathname === item.to || (item.to !== '/' && loc.pathname.startsWith(item.to))
          return (
            <AnimeBounceClick key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn('mobile-nav-item relative mx-auto flex min-h-[55px] max-w-[72px] flex-col items-center justify-center gap-1 rounded-2xl transition-all', active ? 'mobile-nav-active text-cyan-300' : 'text-slate-500')}
              >
                <span className="nav-icon-wrap relative grid h-7 w-9 place-items-center rounded-xl">
                  <item.icon size={20} strokeWidth={active ? 2.5 : 1.9} />
                </span>
                <span className="text-[9px] font-semibold leading-none tracking-wide">{item.label}</span>
              </NavLink>
            </AnimeBounceClick>
          )
        })}
      </div>
    </nav>
  )
}
