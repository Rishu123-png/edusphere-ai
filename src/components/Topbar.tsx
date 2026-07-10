import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from './ui/button'
import { Moon, Sun, Menu, LogOut, Bell, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import MobileDrawer from './mobile/MobileDrawer'

export default function Topbar() {
  const { profile, logout } = useAuth()
  const { resolvedTheme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="h-[64px] md:h-[72px] border-b border-slate-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 md:px-7">
        <div className="flex items-center gap-3">
          <button onClick={()=>setMobileOpen(true)} className="md:hidden w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center -ml-1">
            <Menu size={18} />
          </button>
          <div className="hidden md:flex flex-col">
            <div className="text-[12px] text-muted-foreground leading-none flex items-center gap-1"><Sparkles size={12}/> Welcome back,</div>
            <div className="font-bold text-[15px] mt-1">{profile?.displayName || profile?.email}</div>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">{profile?.displayName?.[0] || 'E'}</div>
            <div className="leading-tight">
              <div className="font-bold text-[14px]">EduSphere AI</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">{profile?.schoolCode || 'GLOBAL'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="hidden md:flex rounded-full" onClick={toggle} title="Toggle theme">
            {resolvedTheme==='dark' ? <Sun size={18}/> : <Moon size={18}/>}
          </Button>
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-zinc-700 ml-1">
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell size={18}/>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search size={18}/>
            </Button>
          </div>
          <div className="text-right hidden lg:block mr-1 ml-2">
            <div className="text-[13px] font-semibold leading-none">{profile?.displayName}</div>
            <div className="text-[11px] text-muted-foreground capitalize mt-1">{profile?.role?.replace('_',' ')}</div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="rounded-full h-9 px-4 hidden md:flex">Exit</Button>
          <Button variant="ghost" size="icon" className="md:hidden rounded-full w-9 h-9" onClick={logout}><LogOut size={16}/></Button>
        </div>
      </header>
      <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  )
}
