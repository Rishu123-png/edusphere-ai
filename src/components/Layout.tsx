import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, GraduationCap, ClipboardList, BarChart3, Bell, MessageCircle, Bus, Calendar, Settings, Sun, Moon, LogOut } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin','school_admin','principal','teacher','student','parent'] },
  { to: '/students', label: 'Students', icon: GraduationCap, roles: ['school_admin','principal','teacher'] },
  { to: '/teachers', label: 'Teachers', icon: Users, roles: ['school_admin','principal'] },
  { to: '/attendance', label: 'Attendance', icon: ClipboardList, roles: ['school_admin','principal','teacher','student','parent'] },
  { to: '/marks', label: 'Marks', icon: BarChart3, roles: ['school_admin','principal','teacher','student','parent'] },
  { to: '/ai', label: 'AI Insights', icon: BarChart3, roles: ['school_admin','principal','teacher','parent','student'] },
  { to: '/schedule', label: 'Schedule', icon: Calendar, roles: ['school_admin','principal','teacher'] },
  { to: '/transport', label: 'Transport', icon: Bus, roles: ['school_admin','principal'] },
  { to: '/notifications', label: 'Notify', icon: Bell, roles: ['school_admin','principal','teacher'] },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, roles: ['school_admin','principal','teacher'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','school_admin','principal','teacher','student','parent'] },
];

export default function Layout(){
  const { profile, logout, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();

  if (loading) return <div className="p-10">Loading…</div>;
  if (!profile) return <Navigate to="/login" replace />;

  const allowed = navItems.filter(n => n.roles.includes(profile.role));

  return <div className="min-h-screen grid grid-cols-[260px_1fr] bg-muted/30">
    <aside className="bg-card border-r border-border p-5 flex flex-col">
      <div className="text-2xl font-extrabold mb-6">EduSphere <span className="text-primary">AI</span></div>
      <nav className="space-y-1 flex-1">
        {allowed.map(n => (
          <Link key={n.to} to={n.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${loc.pathname===n.to ? 'bg-primary text-primary-foreground':'hover:bg-accent'}`}>
            <n.icon size={18}/> {n.label}
          </Link>
        ))}
      </nav>
      <div className="text-xs text-muted-foreground px-2">Role: {profile.role}<br/>School: {profile.schoolId || '—'}</div>
    </aside>
    <div className="flex flex-col min-h-screen">
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
        <div className="font-semibold">Welcome, {profile.name}</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="toggle theme">
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut size={16} className="mr-2"/>Logout</Button>
        </div>
      </header>
      <main className="p-6 lg:p-8 max-w-7xl w-full">
        <Outlet/>
      </main>
    </div>
  </div>
}
