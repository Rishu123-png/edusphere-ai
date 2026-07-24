import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { sendEmailVerification } from 'firebase/auth'
import { initOfflineAutoSync } from './lib/offlineSync'
import { auth } from './lib/firebase'
import Layout from './components/Layout'
import { useAuth } from './contexts/AuthContext'
import { UserRole } from './types'
import { Button } from './components/ui/button'
import { toast } from 'sonner'
import { AnimePageTransition } from './components/AnimeWrapper'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const MarksPage = lazy(() => import('./pages/MarksPage'))
const AIPage = lazy(() => import('./pages/AIPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const ParentPortalPage = lazy(() => import('./pages/ParentPortalPage'))

function AppLoader({ label = 'Loading EduSphere AI…' }: { label?: string }) {
  return (
    <div className="min-h-[55vh] flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 animate-pulse" />
        <div className="font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">Mobile-first • Fast • Secure</div>
      </div>
    </div>
  )
}

function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppLoader />}>{children}</Suspense>
}

function RequireAuth({ children, allow }: { children: ReactNode, allow?: UserRole[] }) {
  const { user, profile, loading, refreshProfile } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 p-6">
      <AppLoader label="Booting EduSphere AI…" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

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
            <Button variant="gradient" className="rounded-full" onClick={async () => {
              try {
                await refreshProfile()
                if (!auth.currentUser?.emailVerified) toast.info('Your verification is not visible yet. Please wait a moment and try again.')
              } catch {
                toast.error('Could not refresh your account. Please try again.')
              }
            }}>I Have Verified My Email</Button>
            <Button variant="outline" className="rounded-full" onClick={async () => {
              if (auth.currentUser) {
                try {
                  await sendEmailVerification(auth.currentUser)
                  toast.success('Verification link re-sent!')
                } catch {
                  toast.error('Could not send the verification email. Please try again shortly.')
                }
              }
            }}>Resend Verification Link</Button>
            <Button variant="ghost" className="rounded-full" onClick={async () => {
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
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [pathname])
  return null
}

export default function App(){
  useEffect(() => initOfflineAutoSync(), [])

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<PageSuspense><AnimePageTransition><LoginPage/></AnimePageTransition></PageSuspense>} />
        <Route path="/onboarding" element={<RequireAuth><PageSuspense><AnimePageTransition><OnboardingPage/></AnimePageTransition></PageSuspense></RequireAuth>} />
        <Route element={<RequireAuth><Layout/></RequireAuth>}>
          <Route path="/" element={<PageSuspense><DashboardPage/></PageSuspense>}/>
          <Route path="/students" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><PageSuspense><StudentsPage/></PageSuspense></RequireAuth>}/>
          <Route path="/teachers" element={<RequireAuth allow={['super_admin','school_admin']}><PageSuspense><TeachersPage/></PageSuspense></RequireAuth>}/>
          <Route path="/attendance" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><PageSuspense><AttendancePage/></PageSuspense></RequireAuth>}/>
          <Route path="/marks" element={<RequireAuth allow={['super_admin','school_admin','teacher','student','parent']}><PageSuspense><MarksPage/></PageSuspense></RequireAuth>}/>
          <Route path="/ai" element={<PageSuspense><AIPage/></PageSuspense>}/>
          <Route path="/schedule" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><PageSuspense><SchedulePage/></PageSuspense></RequireAuth>}/>
          <Route path="/notifications" element={<PageSuspense><NotificationsPage/></PageSuspense>}/>
          <Route path="/whatsapp" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><PageSuspense><WhatsAppPage/></PageSuspense></RequireAuth>}/>
          <Route path="/reports" element={<RequireAuth allow={['super_admin','school_admin','teacher']}><PageSuspense><ReportsPage/></PageSuspense></RequireAuth>}/>
          <Route path="/calendar" element={<PageSuspense><CalendarPage/></PageSuspense>}/>
          <Route path="/parent" element={<RequireAuth allow={['super_admin','school_admin','student','parent']}><PageSuspense><ParentPortalPage/></PageSuspense></RequireAuth>}/>
          <Route path="/settings" element={<PageSuspense><SettingsPage/></PageSuspense>}/>
          <Route path="/superadmin" element={<RequireAuth allow={['super_admin']}><PageSuspense><SuperAdminPage/></PageSuspense></RequireAuth>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>} />
      </Routes>
    </>
  )
}
