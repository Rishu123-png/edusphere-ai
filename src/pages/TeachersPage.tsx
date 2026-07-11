import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove, get } from 'firebase/database'
import { toast } from 'sonner'
import { generateId, generateSchoolCode } from '@/lib/utils'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import PageHeader from '@/components/mobile/PageHeader'
import { GraduationCap, Mail, Plus, Trash2, Edit2, Send, Copy } from 'lucide-react'

export default function TeachersPage(){
  const { schoolId, school } = useSchool()
  const { profile, isSchoolAdmin } = useAuth() as any
  const [teachers, setTeachers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({ name:'', email:'', phone:'', subjects:'', assignedClasses:'', classTeacherOf:'', qualification:'', experience:'' })

  const canEdit = isSchoolAdmin || profile?.role === 'super_admin'

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/teachers` : 'users'
    const r = ref(db, path)
    const unsub = onValue(r, snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, t]:any)=>({ uid: t.uid || id, id, ...t }))
        .filter((u:any)=> schoolId ? true : u.role === 'teacher')
      setTeachers(list as any)
    })
    return ()=>unsub()
  }, [schoolId])

  const saveTeacher = async ()=>{
    if(!canEdit){ toast.error('School Admin only'); return }
    if(!form.name || !form.email){ toast.error('Name and email are required'); return }
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
    // Always write school teacher record
    await update(ref(db, `schools/${payload.schoolId}/teachers/${id}`), payload)

    // If a real user already signed up with this email, push assignment onto their auth profile
    // so Students/Marks filtering works for the teacher login.
    try {
      const usersSnap = await get(ref(db, 'users'))
      if (usersSnap.exists()) {
        const users = usersSnap.val() || {}
        const real = Object.entries(users).find(([, u]: any) =>
          String(u?.email || '').toLowerCase() === String(form.email || '').toLowerCase()
        ) as [string, any] | undefined
        if (real) {
          const realUid = real[0]
          await update(ref(db, `users/${realUid}`), {
            role: 'teacher',
            schoolId: payload.schoolId,
            displayName: form.name,
            name: form.name,
            phone: form.phone,
            subjects: payload.subjects,
            assignedClasses: payload.assignedClasses,
            classTeacherOf: payload.classTeacherOf,
            qualification: payload.qualification,
            experience: payload.experience,
            updatedAt: Date.now(),
          })
          // Also mirror under teachers/{realUid} for dashboard presence
          await update(ref(db, `schools/${payload.schoolId}/teachers/${realUid}`), {
            ...payload,
            uid: realUid,
            linkedFrom: id,
          })
        } else {
          // Placeholder user row until teacher signs up (may not be used for login)
          await update(ref(db, `users/${id}`), {
            uid: id,
            email: form.email,
            displayName: form.name,
            name: form.name,
            role: 'teacher',
            schoolId: payload.schoolId,
            phone: form.phone,
            subjects: payload.subjects,
            assignedClasses: payload.assignedClasses,
            classTeacherOf: payload.classTeacherOf,
            qualification: payload.qualification,
            experience: payload.experience,
            createdAt: payload.createdAt,
            mustResetPassword: true,
            isOnline: editing?.isOnline || false,
          })
        }
      }
    } catch {
      await update(ref(db, `users/${id}`), {
        uid: id,
        email: form.email,
        displayName: form.name,
        name: form.name,
        role: 'teacher',
        schoolId: payload.schoolId,
        phone: form.phone,
        subjects: payload.subjects,
        assignedClasses: payload.assignedClasses,
        classTeacherOf: payload.classTeacherOf,
        createdAt: payload.createdAt,
        mustResetPassword: true,
        isOnline: false,
      }).catch(()=>{})
    }
    toast.success(editing ? 'Teacher updated — classes/subjects synced to teacher login' : 'Teacher added')
    setOpen(false); setEditing(null)
  }

  const delTeacher = async (t:any)=>{
    if(!canEdit) return
    if(!confirm('Remove teacher '+ (t.displayName||t.name)+'?')) return
    try {
      await remove(ref(db, `users/${t.uid}`))
      await remove(ref(db, `schools/${t.schoolId || schoolId || 'global'}/teachers/${t.uid}`)).catch(()=>{})
      await remove(ref(db, `schools/global/teachers/${t.uid}`)).catch(()=>{})
      toast.success('Teacher removed (both paths cleaned)')
    } catch(e:any){ toast.error(e.message) }
  }

  const buildInvite = () => {
    const code = school?.code || generateSchoolCode()
    const schoolName = school?.name || 'EduSphere'
    const link = `${window.location.origin}/login?schoolCode=${encodeURIComponent(code)}&invite=${encodeURIComponent(inviteEmail)}`
    const subject = `Teacher invite for ${schoolName}`
    const body = `Join ${schoolName} as Teacher.\n\nSchool Code: ${code}\n\nLink: ${link}\n\nLogin → Sign Up → Enter School Code → Verify Email`
    return { code, subject, body }
  }

  const openGmailInvite = ()=>{
    if(!canEdit){ toast.error('Admin only'); return }
    if(!inviteEmail) return toast.error('Enter teacher email')
    const { subject, body } = buildInvite()
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(inviteEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    const mailtoUrl = `mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    const isAndroid = /Android/i.test(navigator.userAgent)
    if(isAndroid) {
      // Android opens the installed mail app / Gmail chooser with the draft filled.
      window.location.href = mailtoUrl
    } else {
      const opened = window.open(gmailUrl, '_blank', 'noopener,noreferrer')
      if(!opened) window.location.href = mailtoUrl
    }
    navigator.clipboard?.writeText(body).catch(()=>{})
    toast.success('Email draft opened. Review and press Send.')
  }

  const copyInvite = ()=>{
    if(!canEdit){ toast.error('Admin only'); return }
    if(!inviteEmail) return toast.error('Enter teacher email')
    const { body } = buildInvite()
    navigator.clipboard.writeText(body)
    toast.success('Invite text copied')
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

  return <div className="page-container space-y-4">
    <PageHeader title="Teachers" subtitle={`Registration • Subjects • Class Teacher • ${teachers.length} total`} action={
      canEdit ? (
      <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o) setEditing(null)}}>
        <DialogTrigger asChild><Button variant="gradient" size="sm" className="rounded-full h-11 px-5"><Plus size={16} className="mr-1"/>{editing ? 'Edit' : 'Add Teacher'}</Button></DialogTrigger>
        <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle className="text-[20px]">{editing ? 'Edit Teacher' : 'Teacher Registration'}</DialogTitle></DialogHeader>
          <div className="grid gap-3.5">
            <div><Label className="text-[12px]">Name *</Label><Input className="mt-1 h-12 rounded-xl" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[12px]">Email *</Label><Input className="mt-1 h-12 rounded-xl" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
              <div><Label className="text-[12px]">Phone</Label><Input className="mt-1 h-12 rounded-xl" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[12px]">Qualification</Label><Input className="mt-1 h-12 rounded-xl" value={form.qualification} onChange={e=>setForm({...form, qualification:e.target.value})} placeholder="M.Sc, B.Ed" /></div>
              <div><Label className="text-[12px]">Experience (yrs)</Label><Input className="mt-1 h-12 rounded-xl" type="number" value={form.experience} onChange={e=>setForm({...form, experience:e.target.value})} /></div>
            </div>
            <div><Label className="text-[12px]">Subjects (comma)</Label><Input className="mt-1 h-12 rounded-xl" value={form.subjects} onChange={e=>setForm({...form, subjects:e.target.value})}/></div>
            <div><Label className="text-[12px]">Assigned Classes (e.g. 10-A,9-B)</Label><Input className="mt-1 h-12 rounded-xl" value={form.assignedClasses} onChange={e=>setForm({...form, assignedClasses:e.target.value})}/></div>
            <div><Label className="text-[12px]">Class Teacher Of</Label><Input className="mt-1 h-12 rounded-xl" placeholder="10-A" value={form.classTeacherOf} onChange={e=>setForm({...form, classTeacherOf:e.target.value})}/></div>
            <Button variant="gradient" className="rounded-full h-12 mt-2" onClick={saveTeacher}>{editing ? 'Update Teacher' : 'Save Teacher'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      ) : null
    } />

    <Card className="rounded-[24px] border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20">
      <CardTitle className="flex items-center gap-2"><Mail size={18}/> Invite via School Code</CardTitle>
      <CardContent className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[12px]">Teacher Email</Label>
          <Input className="mt-1 h-12 rounded-xl bg-white dark:bg-zinc-900" placeholder="teacher@school.edu" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" className="rounded-full h-12" onClick={openGmailInvite} disabled={!canEdit}><Send size={16} className="mr-1"/> Open Gmail</Button>
          <Button variant="outline" className="rounded-full h-12 px-4" onClick={copyInvite} disabled={!canEdit} title="Copy invite text"><Copy size={16}/></Button>
        </div>
        <div className="w-full text-[13px] text-muted-foreground">School Code: <b className="text-indigo-600 font-mono text-[15px]">{school?.code || 'EDU-XXXXXX'}</b> • Opens Gmail draft automatically; admin only has to press Send</div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {teachers.map((t:any,i)=>(
        <Card key={t.uid||i} className="rounded-[20px] hover:shadow-lg transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">{t.displayName?.[0] || t.name?.[0] || 'T'}</div>
                <div>
                  <div className="font-bold text-[14px] leading-tight">{t.displayName || t.name || 'Teacher'}</div>
                  <div className="text-[11px] text-muted-foreground">{t.email}</div>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${t.isOnline ? 'bg-emerald-500/15 text-emerald-600':'bg-zinc-500/15 text-zinc-500'}`}>{t.isOnline ? 'Online':'Offline'}</span>
            </div>
            <div className="text-[13px] mt-3 space-y-1 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
              <div>📚 {(t.subjects||[]).join(', ') || '—'}</div>
              <div>🏫 {(t.assignedClasses||[]).join(', ') || '—'}</div>
              <div>👨‍🏫 Class Teacher: {t.classTeacherOf || '—'}</div>
              <div className="text-[11px] text-muted-foreground">{t.qualification || '—'} • Exp: {t.experience || 0}y</div>
            </div>
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 rounded-full h-8 text-[12px]" onClick={()=>startEdit(t)}><Edit2 size={12} className="mr-1"/> Edit</Button>
                <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0" onClick={()=>delTeacher(t)}><Trash2 size={14}/></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!teachers.length && <Card className="col-span-full p-10 text-center text-muted-foreground rounded-[20px]">No teachers yet – invite via school code.</Card>}
    </div>
  </div>
}
