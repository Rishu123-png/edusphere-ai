import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardCheck, FileText, Settings, Brain, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { AnimeBounceClick } from '../AnimeWrapper'
import { motion, AnimatePresence } from 'framer-motion'

const tabs = [
  { to: '/', label: 'Home', icon: LayoutDashboard, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/parent', label: 'My Child', icon: UserCircle, roles: ['parent'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['super_admin','school_admin','teacher'] },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['super_admin','school_admin','teacher'] },
  { to: '/marks', label: 'Marks', icon: FileText, roles: ['super_admin','school_admin','teacher','student','parent'] },
  { to: '/ai', label: 'AI', icon: Brain, roles: ['super_admin','school_admin','teacher','parent'] },
]

export default function BottomNav(){
  const { profile } = useAuth()
  const role = profile?.role || 'student'
  const visibleTabs = tabs.filter(t => t.roles.includes(role)).slice(0,5)
  if(visibleTabs.length < 5){
    visibleTabs.push({ to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','school_admin','teacher','student','parent'] })
  }
  const loc = useLocation()
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = navRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const activeIcon = root.querySelector<HTMLElement>('.mobile-nav-active .nav-icon-wrap')
    if (!activeIcon) return
    let cancelled = false
    import('animejs')
      .then((mod) => {
        if (cancelled || !activeIcon.isConnected) return
        const { animate } = mod
        const springFactory = (mod as unknown as Record<string, (p: { stiffness: number; damping: number; mass: number }) => unknown>)
        const spring = (springFactory.spring ?? springFactory.createSpring)({ stiffness: 340, damping: 13, mass: 1 })
        animate(activeIcon, {
          scale: [0.82, 1],
          translateY: [4, 0],
          ease: spring as never,
        })
      })
      .catch(() => {
        activeIcon.animate(
          [{ transform: 'translateY(4px) scale(0.82)' }, { transform: 'translateY(0) scale(1)' }],
          { duration: 260, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' },
        )
      })
    return () => { cancelled = true }
  }, [loc.pathname])

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none" aria-label="Primary navigation">
      <div ref={navRef} className="bottom-nav-glass mx-auto max-w-[480px] flex items-center justify-around px-2 pt-2 pointer-events-auto safe-bottom">
        {visibleTabs.map(item => {
          const active = loc.pathname === item.to || (item.to !== '/' && loc.pathname.startsWith(item.to))
          return (
            <AnimeBounceClick key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'mobile-nav-item relative mx-auto flex min-h-[55px] max-w-[72px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-300',
                  active
                    ? 'mobile-nav-active'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                <span className={cn(
                  'nav-icon-wrap relative grid h-8 w-9 place-items-center rounded-xl transition-all duration-300',
                  active ? 'shadow-lg' : ''
                )}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(79,70,229,0.25), rgba(168,85,247,0.15))',
                    boxShadow: '0 4px 16px rgba(79,70,229,0.2), inset 0 0 0 1px rgba(79,70,229,0.15)'
                  } : {}}
                >
                  <item.icon
                    size={20}
                    strokeWidth={active ? 2.5 : 1.8}
                    style={active ? { color: '#818cf8' } : {}}
                  />
                  {active && (
                    <motion.span
                      layoutId="navIndicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                      style={{ background: 'linear-gradient(90deg, #4F46E5, #A855F7)' }}
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </span>
                <span className={cn(
                  'text-[9px] font-semibold leading-none tracking-wide transition-colors',
                  active ? 'text-brand-primary' : ''
                )}>
                  {item.label}
                </span>
              </NavLink>
            </AnimeBounceClick>
          )
        })}
      </div>
    </nav>
  )
}
