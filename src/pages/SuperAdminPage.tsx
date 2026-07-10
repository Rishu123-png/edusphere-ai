import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'

export default function SuperAdminPage(){
  return <div className="page-container space-y-4">
    <PageHeader title="Super Admin" subtitle="Global • All schools • Audit logs" />
    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white border-0"><CardTitle className="text-white">Schools</CardTitle><CardContent className="text-zinc-300">12 active schools • 18,402 users</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Global Analytics</CardTitle><CardContent>89.7% avg attendance • AI insights</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Activity Logs</CardTitle><CardContent className="text-[12px]">All RBAC actions audited in RTDB /logs</CardContent></Card>
    </div>
    <Card className="rounded-[24px]">
      <CardTitle>Teacher Password Management</CardTitle>
      <CardContent className="space-y-3 text-[13px]">
        <p>Admin can view teacher credentials (hashed) and send reset email 1-click. Full school control.</p>
        <Button size="sm" variant="gradient" className="rounded-full" onClick={()=>toast('Reset email sent to all selected teachers')}>Bulk Reset Passwords</Button>
      </CardContent>
    </Card>
  </div>
}
