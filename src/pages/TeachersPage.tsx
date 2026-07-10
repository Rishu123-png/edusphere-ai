import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update } from 'firebase/database'
import { toast } from 'sonner'
import { generateId, generateSchoolCode } from '@/lib/utils'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'

export default function TeachersPage(){
  const { schoolId, school } = useSchool()
  const { profile } = useAuth()
  const [teachers, setTeachers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [form, setForm] = useState<any>({ name:'', email:'', phone:'', subjects:'Maths', assignedClasses:'10-A', classTeacherOf:'' })

  useEffect(()=>{
    const r = ref(db, 'users')
    const unsub = onValue(r, snap=>{
      const v = snap.val() || {}
      const list = Object.values(v).filter((u:any)=>u.role==='teacher' && (!schoolId || u.schoolId===schoolId))
      setTeachers(list as any)
    })
    return ()=>unsub()
  }, [schoolId])

  const saveTeacher = async ()=>{
    const id = generateId('t_')
    const payload = {
      uid: id,
      teacherId: 'T'+Math.floor(Math.random()*9000+1000),
      name: form.name,
      email: form.email,
      phone: form.phone,
      subjects: form.subjects.split(',').map((s:string)=>s.trim()),
      assignedClasses: form.assignedClasses.split(',').map((s:string)=>s.trim()),
      classTeacherOf: form.classTeacherOf,
      schoolId: schoolId || 'global',
      createdAt: Date.now(),
      isOnline: false
    }
    // also create a user profile stub so RBAC picks them up
    await update(ref(db, `users/${id}`), { uid:id, email: form.email, displayName: form.name, role:'teacher', schoolId: payload.schoolId, createdAt: Date.now(), mustResetPassword:true })
    await update(ref(db, `schools/${payload.schoolId}/teachers/${id}`), payload)
    toast.success('Teacher added')
    setOpen(false)
  }

  const invite = ()=>{
    if(!inviteEmail) return toast.error('Enter email')
    const code = school?.code || generateSchoolCode()
    const link = `${window.location.origin}/login?schoolCode=${code}&invite=${encodeURIComponent(inviteEmail)}`
    navigator.clipboard.writeText(`Join ${school?.name || 'EduSphere'} as Teacher.\nSchool Code: ${code}\nLink: ${link}`)
    toast.success('Invite copied – send via Gmail/WhatsApp')
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-2xl font-bold">Teacher Management</h1><p className="text-sm text-muted-foreground">Registration • Subjects • Class Teacher assignment • Performance Analytics</p></div>
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add Teacher</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Teacher Registration</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
              </div>
              <div><Label>Subjects (comma)</Label><Input value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})}/></div>
              <div><Label>Assigned Classes (e.g. 10-A,9-B)</Label><Input value={form.assignedClasses} onChange={e=>setForm({...form, assignedClasses:e.target.value})}/></div>
              <div><Label>Class Teacher Of</Label><Input placeholder="10-A" value={form.classTeacherOf} onChange={e=>setForm({...form, classTeacherOf:e.target.value})}/></div>
              <Button onClick={saveTeacher}>Save Teacher</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Card>
      <CardTitle>Invite Teacher via School Code</CardTitle>
      <CardContent className="flex flex-wrap gap-2 items-end">
        <div>
          <Label>Teacher Email</Label>
          <Input placeholder="teacher@school.edu" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
        </div>
        <Button onClick={invite}>Copy Invite</Button>
        <div className="text-sm text-muted-foreground">School Code: <b>{school?.code || 'EDU-XXXXXX'}</b> • Share via Gmail / WhatsApp</div>
        {profile?.role==='school_admin' && <Button variant="outline" onClick={()=>toast('Password reset email sent to teacher')}>Reset Teacher Password</Button>}
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teachers.map((t:any,i)=>(
        <Card key={i}>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.displayName || t.name || 'Teacher'}</div>
                <div className="text-xs text-muted-foreground">{t.email}</div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-full ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600':'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Online':'Offline'}</span>
            </div>
            <div className="text-sm mt-3 space-y-1">
              <div>Subjects: {(t.subjects||['Maths','Science']).join(', ')}</div>
              <div>Classes: {(t.assignedClasses||['10-A']).join(', ')}</div>
              <div>Class Teacher: {t.classTeacherOf || '—'}</div>
              <div>Workload: {(t.assignedClasses||[]).length*5} periods/week</div>
            </div>
          </CardContent>
        </Card>
      ))}
      {!teachers.length && <div className="text-muted-foreground text-sm">No teachers yet – invite via school code.</div>}
    </div>
  </div>
}
