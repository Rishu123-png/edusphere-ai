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

export default function Sidebar({ open, onClose }: { open?: boolean, onClose?: ()=>void }) {
  const { profile } = useAuth()
  const role = profile?.role || 'student'
  const items = nav.filter(n => n.roles.includes(role))
  return (
    <aside className={cn("w-64 border-r bg-card/60 backdrop-blur h-screen sticky top-0 hidden md:flex flex-col", open && "flex fixed z-40 md:static")}>
      <div className="p-5 border-b">
        <div className="font-extrabold text-xl tracking-tight"><span className="text-primary">Edu</span>Sphere AI</div>
        <div className="text-xs text-muted-foreground mt-1">{profile?.role?.replace('_',' ')} • {profile?.schoolCode || 'GLOBAL'}</div>
      </div>
      <nav className="p-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin">
        {items.map(i => (
          <NavLink key={i.to} to={i.to} onClick={onClose} className={({isActive})=> cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition", isActive ? "bg-primary text-primary-foreground shadow" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
            <i.icon size={18} />
            {i.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 text-[11px] text-muted-foreground border-t">
        v2.0 • PWA • Firebase RTDB
      </div>
    </aside>
  )
}
