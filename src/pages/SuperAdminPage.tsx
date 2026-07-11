import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'

export default function SuperAdminPage(){
  const [schools, setSchools] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  useEffect(()=>{
    const unsub = onValue(ref(db, 'schools'), snap=>{
      const v = snap.val() || {}
      setSchools(Object.entries(v).map(([id,s]:any)=>({id, ...s})))
    })
    return ()=>unsub()
  }, [])

  useEffect(()=>{
    const unsub = onValue(ref(db, 'users'), snap=>{
      const v = snap.val() || {}
      setUsers(Object.entries(v).map(([id,u]:any)=>({id, ...u})))
    })
    return ()=>unsub()
  }, [])

  const teacherCount = useMemo(()=> users.filter(u=>u.role==='teacher').length, [users])
  const adminCount = useMemo(()=> users.filter(u=>u.role==='school_admin' || u.role==='super_admin').length, [users])

  return <div className="page-container space-y-4">
    <PageHeader title="Super Admin" subtitle="Global • All schools • Live Firebase counts" />
    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white border-0">
        <CardTitle className="text-white">Schools</CardTitle>
        <CardContent className="text-zinc-300">{schools.length} active schools • {users.length} users</CardContent>
      </Card>
      <Card className="rounded-[20px]">
        <CardTitle>Global Analytics</CardTitle>
        <CardContent className="text-[13px]">Teachers: {teacherCount} • Admins: {adminCount}</CardContent>
      </Card>
      <Card className="rounded-[20px]">
        <CardTitle>Activity Logs</CardTitle>
        <CardContent className="text-[12px]">RBAC actions should be written to /logs for audit.</CardContent>
      </Card>
    </div>

    <Card className="rounded-[24px]">
      <CardTitle>Registered Schools</CardTitle>
      <CardContent className="space-y-2 text-[13px]">
        {schools.map(s=>(
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800">
            <div>
              <div className="font-semibold">{s.name || s.id}</div>
              <div className="text-[11px] text-muted-foreground">Code: {s.code || '—'} • {s.email || s.address || ''}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">{s.id}</span>
          </div>
        ))}
        {!schools.length && <div className="text-muted-foreground p-4 text-center">No schools registered yet.</div>}
      </CardContent>
    </Card>

    <Card className="rounded-[24px]">
      <CardTitle>Teacher Password Management</CardTitle>
      <CardContent className="space-y-3 text-[13px]">
        <p>Use Firebase Auth password reset for teachers. Bulk tooling can be wired to selected teacher emails.</p>
        <Button size="sm" variant="gradient" className="rounded-full" onClick={()=>toast('Select teachers and use Firebase reset email flow from Teachers page invites.')}>Open Reset Guidance</Button>
      </CardContent>
    </Card>
  </div>
}
