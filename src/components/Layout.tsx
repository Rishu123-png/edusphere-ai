import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './mobile/BottomNav'
import { motion } from 'framer-motion'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-zinc-950 flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="px-4 md:px-7 py-5 md:py-7 max-w-7xl w-full mx-auto page-container"
        >
          <Outlet />
        </motion.main>
      </div>
      <BottomNav />
    </div>
  )
}

