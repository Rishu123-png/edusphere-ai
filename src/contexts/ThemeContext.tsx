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
  // EduSphere AI ships with a single premium deep-space dark theme. The
  // ThemeContext is kept for API compatibility (other components call
  // useTheme()), but user-selectable Light/System themes are disabled
  // because most screens use hard-coded deep-space glass styles that are
  // not designed for light backgrounds. This prevents the white-on-white
  // / dark-on-dark breakage users saw when flipping to Light mode.
  const theme: Theme = 'dark'
  const resolvedTheme: ResolvedTheme = 'dark'

  useEffect(() => {
    try {
      if (typeof document === 'undefined') return
      const root = document.documentElement
      root.classList.remove('light')
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
      try { localStorage.setItem('edusphere-theme', 'dark') } catch { /* private mode */ }
      const themeColor = '#0b0f1a'
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.setAttribute('content', themeColor)
      })
      root.classList.add('theme-ready')
    } catch {
      // ignore
    }
  }, [])

  const setTheme = useCallback((_t: Theme) => {
    // no-op: dark only
  }, [])
  const toggle = useCallback(() => {
    // no-op: dark only
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
