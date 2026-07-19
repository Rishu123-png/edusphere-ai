import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
  toggle: () => void
} | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      if (typeof window === 'undefined') return 'system'
      const saved = localStorage.getItem('edusphere-theme') as Theme | null
      // The premium mobile experience is designed dark-first; users can still
      // choose Light or System at any time from Settings.
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)
      root.style.colorScheme = resolvedTheme
      localStorage.setItem('edusphere-theme', theme)

      /* PWA POLISH: keep the Android/browser chrome bar in sync with the
         resolved theme instead of the stale purple/dark from index.html. */
      const themeColor = resolvedTheme === 'dark' ? '#0b0f1a' : '#ffffff'
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.setAttribute('content', themeColor)
      })

      /* Mark the document once, enabling the `.42s` easing between themes
         (defined in index.css) without touching first paint. */
      root.classList.add('theme-ready')
    } catch {
      // Storage can be unavailable in private/embedded browsers; theme still works in memory.
    }
  }, [theme, resolvedTheme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => {
    setThemeState(prev => {
      const current = prev === 'system' ? getSystemTheme() : prev
      return current === 'dark' ? 'light' : 'dark'
    })
  }, [])

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
