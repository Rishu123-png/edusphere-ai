import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, GraduationCap, ClipboardCheck, FileText, Brain, CalendarClock, Bell, MessageCircle, Settings, Shield, BarChart3, CalendarDays, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['super_admin','school_admin','teacher'] },
  { to: '/teachers', label: 'Teachers', icon: GraduationCap, roles: ['super_admin','school_admin'] },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['super_admin','school_admin','teacher'] },
  { to: '/marks', label: 'Marks', icon: FileText, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock, roles: ['super_admin','school_admin','teacher'] },
  { to: '/ai', label: 'AI Insights', icon: Brain, roles: ['super_admin','school_admin','teacher','parent'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['super_admin','school_admin','teacher'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/parent', label: 'Parent Portal', icon: UserCircle, roles: ['parent','student','super_admin','school_admin'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, roles: ['super_admin','school_admin','teacher'] },
  { to: '/superadmin', label: 'Super Admin', icon: Shield, roles: ['super_admin'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','school_admin','teacher','student','parent'] },
]

export default function Sidebar() {
  const { profile } = useAuth()
  const role = profile?.role || 'student'
  const items = nav.filter(n => n.roles.includes(role))
  return (
    <aside className="w-[280px] border-r border-slate-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl h-screen sticky top-0 hidden md:flex flex-col">
      <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-[16px]">E</div>
          <div>
            <div className="font-extrabold text-[17px] tracking-tight leading-none"><span className="text-indigo-600">Edu</span>Sphere AI</div>
            <div className="text-[11px] text-muted-foreground mt-1 capitalize">{profile?.role?.replace('_',' ')} • {profile?.schoolCode || 'GLOBAL'}</div>
          </div>
        </div>
      </div>
      <nav className="p-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin">
        {items.map(i => (
          <NavLink key={i.to} to={i.to} className={({isActive})=> cn("flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[14px] font-medium transition", isActive ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow" : "hover:bg-slate-50 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground")}>
            <i.icon size={18} />
            {i.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-[11px] text-muted-foreground border-t border-slate-100 dark:border-zinc-800">
        v2.1 • Mobile First • PWA • Firebase RTDB
      </div>
    </aside>
  )
}
