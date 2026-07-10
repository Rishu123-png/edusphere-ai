import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
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

function RequireAuth({ children, allow }: { children: React.ReactNode, allow?: UserRole[] }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="p-10">Booting EduSphere AI…</div>
  if (!user) return <Navigate to="/login" replace />
  if (allow && profile && !allow.includes(profile.role)) {
    return <div className="p-10 text-center">🚫 Access denied for <b>{profile.role}</b><br/><span className="text-muted-foreground text-sm">Ask Super Admin to update role permissions.</span></div>
  }
  return <>{children}</>
}

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>} />
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
