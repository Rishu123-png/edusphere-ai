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
    <div className="app-shell w-full bg-transparent text-foreground flex h-screen">
      <AmbientBackground />
      <InteractiveCanvas />
      <Sidebar />
      <div className="relative z-[1] flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        <Topbar />
        <main className="mobile-main px-4 md:px-7 py-4 md:py-7 max-w-7xl w-full mx-auto flex-1 min-h-0">
          <AnimePageTransition>
            <div className="page-contents space-y-6">
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

