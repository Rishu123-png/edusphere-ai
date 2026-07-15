import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './mobile/BottomNav'
import AmbientBackground from './mobile/AmbientBackground'
import FloatingAIAssistant from './mobile/FloatingAIAssistant'
import { AnimePageTransition } from './AnimeWrapper'

export default function Layout() {
  return (
    <div className="app-shell min-h-screen bg-[#fcfcfc] dark:bg-zinc-950 flex">
      <AmbientBackground />
      <Sidebar />
      <div className="relative z-[1] flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="mobile-main px-4 md:px-7 py-5 md:py-7 max-w-7xl w-full mx-auto page-container pb-28 md:pb-7">
          <AnimePageTransition>
            <Outlet />
          </AnimePageTransition>
        </main>
      </div>
      <FloatingAIAssistant />
      <BottomNav />
    </div>
  )
}

