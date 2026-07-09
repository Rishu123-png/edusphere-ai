import { Routes, Route } from 'react-router-dom'
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
import TransportPage from './pages/TransportPage'
import SettingsPage from './pages/SettingsPage'
import SuperAdminPage from './pages/SuperAdminPage'

export default function App(){
  return <Routes>
    <Route path="/login" element={<LoginPage/>} />
    <Route element={<Layout/>}>
      <Route path="/" element={<DashboardPage/>} />
      <Route path="/students" element={<StudentsPage/>} />
      <Route path="/teachers" element={<TeachersPage/>} />
      <Route path="/attendance" element={<AttendancePage/>} />
      <Route path="/marks" element={<MarksPage/>} />
      <Route path="/ai" element={<AIPage/>} />
      <Route path="/schedule" element={<SchedulePage/>} />
      <Route path="/notifications" element={<NotificationsPage/>} />
      <Route path="/whatsapp" element={<WhatsAppPage/>} />
      <Route path="/transport" element={<TransportPage/>} />
      <Route path="/settings" element={<SettingsPage/>} />
      <Route path="/superadmin" element={<SuperAdminPage/>} />
    </Route>
  </Routes>
}
