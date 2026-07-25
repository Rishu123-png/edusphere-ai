
import { useAuth } from '@/contexts/AuthContext'
import { Button } from './ui/button'
import { Menu, Bell, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import MobileDrawer from './mobile/MobileDrawer'
import QuickSearch from './QuickSearch'
import PendingSyncBanner from './PendingSyncBanner'

export default function Topbar() {
  const { profile, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <header className="mobile-topbar h-[68px] md:h-[72px] border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 md:px-7 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <button aria-label="Open menu" onClick={()=>setMobileOpen(true)} className="mobile-icon-button md:hidden w-10 h-10 rounded-full flex items-center justify-center -ml-1 text-white/80">
            <Menu size={19} />
          </button>
          <div className="hidden md:flex flex-col">
            <div className="text-[12px] text-white/60 leading-none flex items-center gap-1"><Sparkles size={12}/> Welcome back,</div>
            <div className="font-bold text-[15px] mt-1">{profile?.displayName || profile?.email}</div>
          </div>
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <div className="brand-orbit grid h-9 w-9 shrink-0 place-items-center rounded-xl"><Sparkles size={18}/></div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-[15px] tracking-tight truncate">EduSphere <span className="text-gradient-ai">AI</span></div>
              <div className="text-[9px] uppercase tracking-[.14em] text-white/50 truncate">{profile?.schoolCode || 'Intelligent Campus'}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/10 ml-1">
            <QuickSearch />
            <Link to="/notifications" aria-label="Notifications">
              <Button variant="ghost" size="icon" className="rounded-full relative text-white/70 hover:text-white">
                <Bell size={18}/>
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              </Button>
            </Link>
          </div>
          <div className="flex md:hidden items-center gap-1.5">
            <QuickSearch />
          </div>
          <div className="text-right hidden lg:block mr-1 ml-2">
            <div className="text-[13px] font-semibold leading-none">{profile?.displayName}</div>
            <div className="text-[11px] text-white/50 capitalize mt-1">{profile?.role?.replace('_',' ')}</div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="rounded-full h-9 px-4 hidden md:flex border-white/10 bg-white/5 text-white hover:bg-white/10">Exit</Button>
          <Link to="/notifications" aria-label="Notifications" className="mobile-icon-button md:hidden relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80">
            <Bell size={18}/><span className="notification-dot absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-fuchsia-500"/>
          </Link>
          <button aria-label="Open profile menu" onClick={()=>setMobileOpen(true)} className="md:hidden h-9 w-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 p-[1px] shadow-[0_10px_24px_rgba(79,70,229,.28)]">
            <span className="grid h-full w-full place-items-center rounded-full bg-[#111827] text-[12px] font-extrabold text-white">{profile?.displayName?.[0] || profile?.email?.[0] || 'E'}</span>
          </button>
        </div>
      </header>
      <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen} />
      <PendingSyncBanner />
    </>
  )
}
