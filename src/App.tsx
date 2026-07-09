import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layout
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import AIInsights from './pages/AIInsights';
import Reports from './pages/Reports';
import ParentPortal from './pages/ParentPortal';
import CalendarPage from './pages/Calendar';
import Settings from './pages/Settings';
import Homework from './pages/Homework';
import QRScanner from './pages/QRScanner';
import NotFound from './pages/NotFound';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ 
  children, 
  allowedRoles 
}) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const queryClient = new QueryClient();

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/dashboard" />} />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* All Roles */}
        <Route path="students" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal','teacher','parent']}><Students /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal','teacher','parent']}><Attendance /></ProtectedRoute>} />
        <Route path="marks" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal','teacher','parent']}><Marks /></ProtectedRoute>} />
        <Route path="ai-insights" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal','teacher']}><AIInsights /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal','teacher']}><Reports /></ProtectedRoute>} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="homework" element={<Homework />} />
        <Route path="qr-scanner" element={<QRScanner />} />
        
        {/* Admin & Principal Only */}
        <Route path="teachers" element={<ProtectedRoute allowedRoles={['superadmin','schooladmin','principal']}><Teachers /></ProtectedRoute>} />
        
        {/* Parent Portal */}
        <Route path="parent-portal" element={<ProtectedRoute allowedRoles={['parent','student']}><ParentPortal /></ProtectedRoute>} />
        
        {/* Settings */}
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;