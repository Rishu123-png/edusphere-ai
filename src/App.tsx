import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-10">Booting EduSphere AI…</div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>} />
      <Route element={<RequireAuth><Layout/></RequireAuth>}>
        <Route path="/" element={<DashboardPage/>}/>
        <Route path="/students" element={<StudentsPage/>}/>
        <Route path="/teachers" element={<TeachersPage/>}/>
        <Route path="/attendance" element={<AttendancePage/>}/>
        <Route path="/marks" element={<MarksPage/>}/>
        <Route path="/ai" element={<AIPage/>}/>
        <Route path="/schedule" element={<SchedulePage/>}/>
        <Route path="/notifications" element={<NotificationsPage/>}/>
        <Route path="/whatsapp" element={<WhatsAppPage/>}/>
        <Route path="/reports" element={<ReportsPage/>}/>
        <Route path="/calendar" element={<CalendarPage/>}/>
        <Route path="/parent" element={<ParentPortalPage/>}/>
        <Route path="/settings" element={<SettingsPage/>}/>
        <Route path="/superadmin" element={<SuperAdminPage/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>} />
    </Routes>
  )
}
