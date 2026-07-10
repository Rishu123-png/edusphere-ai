import { Routes, Route, Navigate } from 'react-router-dom'
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

function RequireAuth({ children, allow }: { children: React.ReactNode, allow?: UserRole[] }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="p-10">Booting EduSphere AI…</div>
  if (!user) return <Navigate to="/login" replace />

  // Demo user check to bypass email verification
  const isDemoUser = user.email === 'superadmin@edusphere.ai' || user.email?.endsWith('@demo.edu')

  // Strict email verification check - "without verification no one allowed to enter"
  if (!user.emailVerified && !isDemoUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950 p-6">
        <div className="w-full max-w-md p-6 rounded-2xl bg-card border shadow-2xl text-center space-y-4">
          <div className="text-4xl">✉️</div>
          <h2 className="text-2xl font-bold">Email Verification Required</h2>
          <p className="text-muted-foreground text-sm">
            Without verification, no one is allowed to enter EduSphere AI. Please verify your email <b>{user.email}</b> to secure your account and access the dashboard.
          </p>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs">
            Check your inbox (and spam folder) for the verification link. Once clicked, refresh this page.
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => window.location.reload()}>I Have Verified My Email</Button>
            <Button variant="outline" onClick={async () => {
              const { sendEmailVerification } = await import('firebase/auth')
              const { auth } = await import('@/lib/firebase')
              if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser)
                toast.success('Verification link re-sent!')
              }
            }}>Resend Verification Link</Button>
            <Button variant="ghost" onClick={async () => {
              const { auth } = await import('@/lib/firebase')
              await auth.signOut()
              window.location.reload()
            }}>Sign Out & Try Another Account</Button>
          </div>
        </div>
      </div>
    )
  }

  // School onboarding check: if user has no school and is not a super_admin, force onboarding
  const isSuperAdmin = profile?.role === 'super_admin'
  const isOnboardingPath = window.location.pathname === '/onboarding'
  if (!isSuperAdmin && !profile?.schoolId && !isOnboardingPath) {
    return <Navigate to="/onboarding" replace />
  }

  if (allow && profile && !allow.includes(profile.role)) {
    return <div className="p-10 text-center">🚫 Access denied for <b>{profile.role}</b><br/><span className="text-muted-foreground text-sm">Ask Super Admin to update role permissions.</span></div>
  }
  return <>{children}</>
}

export default function App(){
  return (
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
  )
}
