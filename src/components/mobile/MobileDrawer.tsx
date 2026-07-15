import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, GraduationCap, ClipboardCheck, FileText, Brain, CalendarClock, Bell, MessageCircle, Settings, Shield, BarChart3, CalendarDays, UserCircle, X, LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Drawer } from 'vaul'

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

export default function MobileDrawer({ open, onOpenChange }: { open: boolean, onOpenChange: (o:boolean)=>void }) {
  const { profile, logout } = useAuth()
  const role = profile?.role || 'student'
  const items = nav.filter(n => n.roles.includes(role))

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/65 backdrop-blur-md z-50" />
        <Drawer.Content className="mobile-drawer fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[32px] bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 max-h-[88vh]">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-zinc-700" />
          <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="brand-orbit w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold">
                <Sparkles size={19}/>
              </div>
              <div>
                <div className="font-bold">{profile?.displayName || 'EduSphere User'}</div>
                <div className="text-xs text-muted-foreground capitalize">{profile?.role?.replace('_',' ')} • {profile?.schoolCode || 'GLOBAL'}</div>
              </div>
            </div>
            <button onClick={()=>onOpenChange(false)} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center"><X size={18}/></button>
          </div>
          <div className="p-3 overflow-y-auto flex-1 scrollbar-thin space-y-1">
            {items.map(i => (
              <NavLink key={i.to} to={i.to} onClick={()=>onOpenChange(false)} className={({isActive})=> cn("flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium transition", isActive ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow" : "hover:bg-slate-50 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground")}>
                <i.icon size={20} />
                {i.label}
              </NavLink>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-zinc-800 safe-bottom">
            <button onClick={async()=>{ onOpenChange(false); await logout() }} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-[13px] font-bold text-red-300"><LogOut size={16}/> Sign out</button>
            <div className="text-[10px] text-muted-foreground text-center uppercase tracking-[.12em]">EduSphere AI • Secure Campus OS • {new Date().getFullYear()}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
