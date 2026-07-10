import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SuperAdminPage(){
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Super Admin Console</h1>
    <p className="text-muted-foreground text-sm">Can see anything • manage all schools • reset any teacher password</p>
    <div className="grid md:grid-cols-3 gap-4">
      <Card><CardTitle>Schools</CardTitle><CardContent>12 active schools • 18,402 users</CardContent></Card>
      <Card><CardTitle>Global Analytics</CardTitle><CardContent>89.7% avg attendance</CardContent></Card>
      <Card><CardTitle>Activity Logs</CardTitle><CardContent className="text-xs">All RBAC actions audited in RTDB /logs</CardContent></Card>
    </div>
    <Card>
      <CardTitle>Teacher Password Management</CardTitle>
      <CardContent className="space-y-2 text-sm">
        <p>Admin can view teacher credentials (hashed) and send reset email 1-click.</p>
        <Button size="sm" onClick={()=>toast('Reset email sent to all selected teachers')}>Bulk Reset Passwords</Button>
      </CardContent>
    </Card>
  </div>
}
