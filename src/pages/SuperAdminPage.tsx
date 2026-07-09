import { Card, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function SuperAdminPage(){
  const { profile } = useAuth();
  if (profile?.role !== 'super_admin') return <Navigate to="/" replace/>;
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Super Admin Panel</h1>
    <div className="grid md:grid-cols-3 gap-4">
      {[
        ['Schools','12 active'],
        ['Total Users','1,847'],
        ['Platform Uptime','99.9%']
      ].map(([k,v])=> <Card key={k}><CardTitle>{k}</CardTitle><div className="text-2xl font-bold mt-1">{v}</div></Card>)}
    </div>
    <Card><CardTitle>All Schools</CardTitle>
      <p className="text-sm mt-2 text-muted-foreground">Manage tenants, school codes, billing, disable schools, audit logs. Firestore collection: schools/</p>
    </Card>
  </div>
}
