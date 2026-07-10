import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: 'light'|'dark'
  setTheme: (t: Theme) => void
  toggle: () => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      if (typeof window === 'undefined') return 'system'
      return (localStorage.getItem('edusphere-theme') as Theme) || 'system'
    } catch { return 'system' }
  })

  const getSystem = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light' as const
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  const resolvedTheme = theme === 'system' ? getSystem() : theme

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)
      root.style.colorScheme = resolvedTheme
      localStorage.setItem('edusphere-theme', theme)
    } catch {}
  }, [theme, resolvedTheme])

  useEffect(() => {
    if (theme !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setThemeState(prev => prev) // force re-render via state copy
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState(prev => {
    const current = prev === 'system' ? getSystem() : prev
    return current === 'dark' ? 'light' : 'dark'
  })

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if(!ctx) throw new Error('useTheme outside provider')
  return ctx
}
