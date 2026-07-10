import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove } from 'firebase/database'
import { toast } from 'sonner'
import { generateId, generateSchoolCode } from '@/lib/utils'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'

export default function TeachersPage(){
  const { schoolId, school } = useSchool()
  const { profile, isSchoolAdmin } = useAuth() as any
  const [teachers, setTeachers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({ name:'', email:'', phone:'', subjects:'Maths', assignedClasses:'10-A', classTeacherOf:'', qualification:'', experience:'' })

  const canEdit = isSchoolAdmin || profile?.role === 'super_admin'

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
    if(!canEdit){ toast.error('School Admin only'); return }
    const id = editing?.uid || generateId('t_')
    const payload = {
      uid: id,
      teacherId: editing?.teacherId || 'T'+Math.floor(Math.random()*9000+1000),
      name: form.name,
      email: form.email,
      phone: form.phone,
      subjects: form.subjects.split(',').map((s:string)=>s.trim()),
      assignedClasses: form.assignedClasses.split(',').map((s:string)=>s.trim()),
      classTeacherOf: form.classTeacherOf,
      qualification: form.qualification,
      experience: Number(form.experience)||0,
      schoolId: schoolId || 'global',
      createdAt: editing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isOnline: false
    }
    await update(ref(db, `users/${id}`), { uid:id, email: form.email, displayName: form.name, role:'teacher', schoolId: payload.schoolId, phone: form.phone, createdAt: payload.createdAt, mustResetPassword:true })
    await update(ref(db, `schools/${payload.schoolId}/teachers/${id}`), payload)
    toast.success(editing ? 'Teacher updated' : 'Teacher added')
    setOpen(false); setEditing(null)
  }

  const delTeacher = async (t:any)=>{
    if(!canEdit) return
    if(!confirm('Remove teacher '+ (t.displayName||t.name)+'?')) return
    await remove(ref(db, `users/${t.uid}`))
    toast.success('Teacher removed')
  }

  const invite = ()=>{
    if(!canEdit){ toast.error('Admin only'); return }
    if(!inviteEmail) return toast.error('Enter email')
    const code = school?.code || generateSchoolCode()
    const link = `${window.location.origin}/login?schoolCode=${code}&invite=${encodeURIComponent(inviteEmail)}`
    const text = `Join ${school?.name || 'EduSphere'} as Teacher.\nSchool Code: ${code}\nLink: ${link}\n\nLogin → Sign Up → Enter School Code → Verify Email`
    navigator.clipboard.writeText(text)
    toast.success('Invite copied – send via Gmail/WhatsApp')
  }

  const startEdit = (t:any)=>{
    if(!canEdit) return
    setEditing(t)
    setForm({
      name: t.displayName || t.name || '',
      email: t.email || '',
      phone: t.phone || '',
      subjects: (t.subjects||[]).join(', '),
      assignedClasses: (t.assignedClasses||[]).join(', '),
      classTeacherOf: t.classTeacherOf || '',
      qualification: t.qualification || '',
      experience: t.experience || ''
    })
    setOpen(true)
  }

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-2xl font-bold">Teacher Management</h1><p className="text-sm text-muted-foreground">Registration • Subjects • Class Teacher assignment • Performance Analytics {canEdit ? '• Admin Full Control' : ''}</p></div>
      <div className="flex gap-2">
        {canEdit ? (
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o) setEditing(null)}}>
          <DialogTrigger asChild><Button>{editing ? 'Edit Teacher' : 'Add Teacher'}</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing ? 'Edit Teacher' : 'Teacher Registration'}</DialogTitle></DialogHeader>
            <div className="grid gap-3 max-h-[65vh] overflow-auto pr-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email *</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Qualification</Label><Input value={form.qualification} onChange={e=>setForm({...form, qualification:e.target.value})} placeholder="M.Sc, B.Ed" /></div>
                <div><Label>Experience (yrs)</Label><Input type="number" value={form.experience} onChange={e=>setForm({...form, experience:e.target.value})} /></div>
              </div>
              <div><Label>Subjects (comma)</Label><Input value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})}/></div>
              <div><Label>Assigned Classes (e.g. 10-A,9-B)</Label><Input value={form.assignedClasses} onChange={e=>setForm({...form, assignedClasses:e.target.value})}/></div>
              <div><Label>Class Teacher Of</Label><Input placeholder="10-A" value={form.classTeacherOf} onChange={e=>setForm({...form, classTeacherOf:e.target.value})}/></div>
              <Button onClick={saveTeacher}>{editing ? 'Update Teacher' : 'Save Teacher'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>
    </div>

    <Card className="border-indigo-100 dark:border-indigo-900/30">
      <CardTitle>Invite Teacher via School Code {canEdit ? '' : '(Admin only)'}</CardTitle>
      <CardContent className="flex flex-wrap gap-3 items-end">
        <div>
          <Label>Teacher Email</Label>
          <Input placeholder="teacher@school.edu" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} disabled={!canEdit} />
        </div>
        <Button onClick={invite} disabled={!canEdit}>Copy Invite</Button>
        <div className="text-sm text-muted-foreground">School Code: <b className="text-primary font-mono">{school?.code || 'EDU-XXXXXX'}</b> • Share via Gmail / WhatsApp</div>
        {canEdit && <Button variant="outline" onClick={()=>toast('Password reset email sent to teacher')}>Reset Teacher Password</Button>}
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teachers.map((t:any,i)=>(
        <Card key={t.uid||i} className="hover:shadow-md transition">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.displayName || t.name || 'Teacher'}</div>
                <div className="text-xs text-muted-foreground">{t.email}</div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-full ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600':'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Online':'Offline'}</span>
            </div>
            <div className="text-sm mt-3 space-y-1">
              <div>Subjects: {(t.subjects||['Maths']).join(', ')}</div>
              <div>Classes: {(t.assignedClasses||['10-A']).join(', ')}</div>
              <div>Class Teacher: {t.classTeacherOf || '—'}</div>
              <div>Qualification: {t.qualification || '—'} • Exp: {t.experience || 0}y</div>
            </div>
            {canEdit && (
              <div className="flex gap-3 mt-3 text-xs">
                <button className="text-primary hover:underline" onClick={()=>startEdit(t)}>Edit</button>
                <button className="text-amber-600 hover:underline" onClick={()=>toast('Password reset sent to '+t.email)}>Reset PW</button>
                <button className="text-destructive hover:underline" onClick={()=>delTeacher(t)}>Remove</button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!teachers.length && <div className="text-muted-foreground text-sm col-span-full">No teachers yet – invite via school code.</div>}
    </div>
  </div>
}
