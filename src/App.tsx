import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import StudentsPage from './pages/StudentsPage'
import TeachersPage from './pages/TeachersPage'
import AttendancePage from './pages/AttendancePage'
import MarksPage from './pages/MarksPage'
import AIPage from './pages/AIPage'
import SchedulePage from './pages/SchedulePage'
import NotificationsPage from './pages/NotificationsPage'
import WhatsAppPage from './pages/WhatsAppPage'
import SettingsPage from './pages/SettingsPage'
import SuperAdminPage from './pages/SuperAdminPage'
import ReportsPage from './pages/ReportsPage'
import CalendarPage from './pages/CalendarPage'
import ParentPortalPage from './pages/ParentPortalPage'
import { useAuth } from './contexts/AuthContext'
import { UserRole } from './types'
import { Button } from './components/ui/button'
import { toast } from 'sonner'
import { useEffect } from 'react'

function RequireAuth({ children, allow }: { children: React.ReactNode, allow?: UserRole[] }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 p-6">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 animate-pulse" />
        <div className="font-bold">Booting EduSphere AI…</div>
        <div className="text-xs text-muted-foreground">Mobile-first • Fast • Secure</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />

  // Strict email verification for all production accounts
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-zinc-950 dark:to-indigo-950 p-6">
        <div className="w-full max-w-md p-6 rounded-[28px] bg-white dark:bg-zinc-900 border shadow-2xl text-center space-y-4">
          <div className="text-4xl">✉️</div>
          <h2 className="text-[22px] font-extrabold">Email Verification Required</h2>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Without verification, no one is allowed to enter EduSphere AI. Please verify your email <b>{user.email}</b> to secure your account.
          </p>
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-[12px]">
            Check your inbox (and spam folder) for the verification link. Once clicked, refresh this page.
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="gradient" className="rounded-full" onClick={() => window.location.reload()}>I Have Verified My Email</Button>
            <Button variant="outline" className="rounded-full" onClick={async () => {
              const { sendEmailVerification } = await import('firebase/auth')
              const { auth } = await import('@/lib/firebase')
              if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser)
                toast.success('Verification link re-sent!')
              }
            }}>Resend Verification Link</Button>
            <Button variant="ghost" className="rounded-full" onClick={async () => {
              const { auth } = await import('@/lib/firebase')
              await auth.signOut()
              window.location.reload()
            }}>Sign Out & Try Another Account</Button>
          </div>
        </div>
      </div>
    )
  }

  // School onboarding check: only redirect if profile is loaded and user has NO schoolId
  const isSuperAdmin = profile?.role === 'super_admin'
  const isOnboardingPath = location.pathname === '/onboarding'
  
  // Only force onboarding when we have a profile but it has no school (and not super admin)
  if (!isSuperAdmin && profile && !profile.schoolId && !isOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }

  if (allow && profile && !allow.includes(profile.role)) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center p-10 text-center">
      <div className="text-5xl mb-3">🚫</div>
      <div className="font-bold">Access denied for {profile.role}</div>
      <div className="text-muted-foreground text-sm mt-1">Ask Super Admin to update role permissions.</div>
      <Button className="mt-4 rounded-full" onClick={()=>window.history.back()}>Go Back</Button>
    </div>
  }
  return <>{children}</>
}

// Scroll to top on route change for mobile
function ScrollToTop(){
  const { pathname } = useLocation()
  useEffect(()=>{ window.scrollTo({ top:0, behavior:'smooth' }) }, [pathname])
  return null
}

export default function App(){
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage/></RequireAuth>} />
        <Route element={<RequireAuth><Layout/></RequireAuth>}>
          <Route path="/" element={<DashboardPage/>}/>
          <Route path="/students" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><StudentsPage/></RequireAuth>}/>
          <Route path="/teachers" element={<RequireAuth allow={['super_admin','school_admin']}><TeachersPage/></RequireAuth>}/>
          <Route path="/attendance" element={<AttendancePage/>}/>
          <Route path="/marks" element={<MarksPage/>}/>
          <Route path="/ai" element={<AIPage/>}/>
          <Route path="/schedule" element={<SchedulePage/>}/>
          <Route path="/notifications" element={<NotificationsPage/>}/>
          <Route path="/whatsapp" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><WhatsAppPage/></RequireAuth>}/>
          <Route path="/reports" element={<ReportsPage/>}/>
          <Route path="/calendar" element={<CalendarPage/>}/>
          <Route path="/parent" element={<ParentPortalPage/>}/>
          <Route path="/settings" element={<SettingsPage/>}/>
          <Route path="/superadmin" element={<RequireAuth allow={['super_admin']}><SuperAdminPage/></RequireAuth>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </>
  )
}
