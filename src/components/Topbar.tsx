import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from './ui/button'
import { Moon, Sun, Menu, LogOut, Bell } from 'lucide-react'
import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Topbar() {
  const { profile, logout } = useAuth()
  const { resolvedTheme, toggle, setTheme, theme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button className="md:hidden" onClick={()=>setMobileOpen(!mobileOpen)}><Menu /></button>
        <div className="hidden md:block">
          <div className="text-sm text-muted-foreground">Welcome back,</div>
          <div className="font-semibold">{profile?.displayName || profile?.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
          {resolvedTheme==='dark' ? <Sun size={18}/> : <Moon size={18}/>}
        </Button>
        <select value={theme} onChange={e=>setTheme(e.target.value as any)} className="text-xs bg-transparent border rounded-lg px-2 py-1">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <Button variant="ghost" size="icon"><Bell size={18}/></Button>
        <div className="text-right hidden sm:block mr-2">
          <div className="text-sm font-medium">{profile?.displayName}</div>
          <div className="text-xs text-muted-foreground capitalize">{profile?.role?.replace('_',' ')}</div>
        </div>
        <Button variant="outline" size="sm" onClick={logout}><LogOut size={14} className="mr-1"/> Exit</Button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setMobileOpen(false)} />
          <div className="relative w-64">
            <Sidebar open onClose={()=>setMobileOpen(false)} />
          </div>
        </div>
      )}
    </header>
  )
}
