import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './mobile/BottomNav'
import AmbientBackground from './mobile/AmbientBackground'
import InteractiveCanvas from './mobile/InteractiveCanvas'
import FloatingAIAssistant from './mobile/FloatingAIAssistant'
import { AnimePageTransition } from './AnimeWrapper'

export default function Layout() {
  return (
    <div className="app-shell w-full h-full bg-transparent text-foreground flex flex-col md:flex-row">
      <AmbientBackground />
      <InteractiveCanvas />
      <Sidebar />
      <div className="relative z-[1] flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        <Topbar />
        <main className="mobile-main w-full max-w-7xl mx-auto flex-1">
          <AnimePageTransition>
            <div className="space-y-6 w-full">
              <Outlet />
            </div>
          </AnimePageTransition>
        </main>
      </div>
      <FloatingAIAssistant />
      <BottomNav />
    </div>
  )
}
