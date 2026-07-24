import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { SchoolProvider } from './contexts/SchoolContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from 'sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
})

const root = document.getElementById('root')

if (!root) {
  throw new Error('EduSphere AI root element was not found')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <SchoolProvider>
                <App />
                <Toaster
                  richColors
                  position={typeof window !== 'undefined' && window.innerWidth < 768 ? 'top-center' : 'top-right'}
                  toastOptions={{
                    style: {
                      borderRadius: '16px',
                      fontSize: '13px',
                      background: 'rgba(12,17,37,0.96)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(12px)',
                    },
                  }}
                />
              </SchoolProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
