import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './mobile/BottomNav'
import { AnimePageTransition } from './AnimeWrapper'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-zinc-950 flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="px-4 md:px-7 py-5 md:py-7 max-w-7xl w-full mx-auto page-container pb-24 md:pb-7">
          <AnimePageTransition>
            <Outlet />
          </AnimePageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

