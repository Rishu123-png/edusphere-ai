import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserCheck, Award, Brain, BarChart3, Calendar, 
  Settings, LogOut, Menu, X, Bell, Search, User 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['*'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['superadmin','schooladmin','principal','teacher','parent'] },
  { to: '/teachers', label: 'Teachers', icon: Users, roles: ['superadmin','schooladmin','principal'] },
  { to: '/attendance', label: 'Attendance', icon: UserCheck, roles: ['*'] },
  { to: '/marks', label: 'Marks', icon: Award, roles: ['*'] },
  { to: '/ai-insights', label: 'AI Insights', icon: Brain, roles: ['superadmin','schooladmin','principal','teacher'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['superadmin','schooladmin','principal','teacher'] },
  { to: '/calendar', label: 'Calendar', icon: Calendar, roles: ['*'] },
  { to: '/homework', label: 'Homework', icon: Award, roles: ['*'] },
  { to: '/qr-scanner', label: 'QR Scanner', icon: UserCheck, roles: ['teacher','principal'] },
  { to: '/parent-portal', label: 'Parent Portal', icon: Users, roles: ['parent','student'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['*'] },
];

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const filteredNav = navItems.filter(item => 
    item.roles.includes('*') || item.roles.includes(currentUser?.role || '')
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">E</span>
            </div>
            <div>
              <div className="font-bold text-xl tracking-tight">EduSphere</div>
              <div className="text-[10px] text-muted-foreground -mt-1">AI School ERP</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-auto py-4 px-3">
            <div className="space-y-1">
              {filteredNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => 
                    `sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'active bg-primary text-primary-foreground' : 'hover:bg-accent'}`
                  }
                >
                  <item.icon size={19} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 border-t mt-auto">
            <div className="flex items-center gap-3 px-3 py-2 mb-3">
              <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{currentUser?.displayName}</div>
                <div className="text-xs text-muted-foreground capitalize">{currentUser?.role}</div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-destructive hover:text-destructive" 
              onClick={handleLogout}
            >
              <LogOut size={16} /> Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <h1 className="text-xl font-semibold tracking-tight">EduSphere AI</h1>
            </div>
            
            {/* Global Search */}
            <div className="hidden md:block relative w-72">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <input 
                  type="text" 
                  placeholder="Search students, teachers, classes..." 
                  className="w-full bg-muted pl-10 pr-4 py-2 text-sm rounded-full border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="relative">
              <Bell size={18} />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full">12</div>
            </Button>
            
            <div className="flex items-center gap-2 text-sm">
              <div className="text-right hidden md:block">
                <div className="font-medium">{currentUser?.displayName}</div>
                <div className="text-xs text-muted-foreground capitalize">{currentUser?.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;