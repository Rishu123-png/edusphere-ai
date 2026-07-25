import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (t: Theme) => void
  toggle: () => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default theme is deep-space dark. A plain high-contrast light mode is
  // available for teachers who grade for hours and want bright backgrounds.
  // The light mode intentionally uses plain opaque surfaces (no glass) so
  // there is no white-on-white or transparency bleed.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    try {
      const stored = localStorage.getItem('edusphere-theme') as Theme | null
      return stored === 'light' ? 'light' : 'dark'
    } catch { return 'dark' }
  })
  const resolvedTheme: ResolvedTheme = theme

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.classList.remove('light','dark')
      root.classList.add(resolvedTheme)
      root.style.colorScheme = resolvedTheme
      try { localStorage.setItem('edusphere-theme', resolvedTheme) } catch { /* private mode */ }
      const themeColor = resolvedTheme === 'dark' ? '#0b0f1a' : '#ffffff'
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.setAttribute('content', themeColor)
      })
      root.classList.add('theme-ready')
    } catch {
      // ignore
    }
  }, [resolvedTheme])

  const setTheme = useCallback((t: Theme) => { setThemeState(t === 'light' ? 'light' : 'dark') }, [])
  const toggle = useCallback(() => { setThemeState(prev => prev === 'dark' ? 'light' : 'dark') }, [])

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
