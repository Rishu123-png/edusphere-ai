import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types'

export default function ProtectedRoute({ allow }: { allow?: UserRole[] }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="p-8">Loading EduSphere AI…</div>
  if (!user) return <Navigate to="/login" replace />
  if (allow && profile && !allow.includes(profile.role)) {
    return <div className="p-10">Access denied for role {profile.role}</div>
  }
  return <Outlet />
}
