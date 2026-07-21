import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove } from 'firebase/database'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { generateId, generateSchoolCode } from '@/lib/utils'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Mail, Plus, Trash2, Edit2, Send, Copy } from 'lucide-react'

type TeacherRecord = {
  id: string
  uid?: string
  linkedUid?: string
  linkedFrom?: string
  teacherId?: string
  displayName?: string
  name?: string
  email?: string
  phone?: string
  subjects?: string[]
  assignedClasses?: string[]
  classTeacherOf?: string
  qualification?: string
  experience?: number
  schoolId?: string
  createdAt?: number
  updatedAt?: number
  isOnline?: boolean
  lastSeen?: number
}

const splitCsv = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)

export default function TeachersPage(){
  const { schoolId, school } = useSchool()
  const { profile, isSchoolAdmin } = useAuth()
  const [teachers, setTeachers] = useState<TeacherRecord[]>([])
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [editing, setEditing] = useState<TeacherRecord | null>(null)
  const [form, setForm] = useState({ name:'', email:'', phone:'', subjects:'', assignedClasses:'', classTeacherOf:'', qualification:'', experience:'' })

  const canEdit = isSchoolAdmin || profile?.role === 'super_admin'

  useEffect(()=>{
    const path = schoolId ? `schools/${schoolId}/teachers` : 'users'
    const r = ref(db, path)
    const unsub = onValue(r, snap=>{
      const value = snap.val() || {}
      const raw = Object.entries(value)
        .map(([id, teacher]) => {
          const source = teacher as Omit<TeacherRecord, 'id'> & { role?: string }
          return { ...source, id, uid: source.uid || id }
        })
        .filter(record => schoolId ? true : (record as unknown as { role?: string }).role === 'teacher')

      const realIds = new Set(raw.map(record => String(record.uid || record.id)))
      const deduped = raw
        .filter(record => !(record.linkedUid && realIds.has(String(record.linkedUid))))
        .sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')))

      setTeachers(deduped)
    })
    return ()=>unsub()
  }, [schoolId])

  const teacherCountLabel = useMemo(() => `${teachers.length} total`, [teachers.length])

  const saveTeacher = async ()=>{
    if(!canEdit){ toast.error('School Admin only'); return }
    if(!form.name || !form.email){ toast.error('Name and email are required'); return }

    const schoolScopeId = schoolId || profile?.schoolId || 'global'
    const linkedUid = editing?.linkedUid || (editing?.uid && !String(editing.uid).startsWith('t_') ? String(editing.uid) : '')
    const recordId = editing?.id || linkedUid || generateId('t_')

    const payload: TeacherRecord = {
      id: recordId,
      uid: linkedUid || recordId,
      teacherId: editing?.teacherId || `T${Math.floor(Math.random()*9000+1000)}`,
      name: form.name,
      displayName: form.name,
      email: form.email,
      phone: form.phone,
      subjects: splitCsv(form.subjects),
      assignedClasses: splitCsv(form.assignedClasses),
      classTeacherOf: form.classTeacherOf.trim(),
      qualification: form.qualification.trim(),
      experience: Number(form.experience)||0,
      schoolId: schoolScopeId,
      createdAt: editing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isOnline: editing?.isOnline || false,
      lastSeen: editing?.lastSeen || 0,
      ...(editing?.linkedFrom ? { linkedFrom: editing.linkedFrom } : {}),
      ...(linkedUid ? { linkedUid } : {}),
    }

    await update(ref(db, `schools/${schoolScopeId}/teachers/${recordId}`), payload)

    if (linkedUid) {
      await update(ref(db, `users/${linkedUid}`), {
        role: 'teacher',
        schoolId: schoolScopeId,
        displayName: form.name,
        name: form.name,
        phone: form.phone,
        subjects: payload.subjects,
        assignedClasses: payload.assignedClasses,
        classTeacherOf: payload.classTeacherOf,
        qualification: payload.qualification,
        experience: payload.experience,
        updatedAt: Date.now(),
      }).catch(error => console.warn('Teacher profile sync skipped', error))
    }

    toast.success(editing
      ? 'Teacher updated — assignments saved for this school'
      : 'Teacher added — invite them to join with your school code')
    setOpen(false)
    setEditing(null)
    setForm({ name:'', email:'', phone:'', subjects:'', assignedClasses:'', classTeacherOf:'', qualification:'', experience:'' })
  }

  const delTeacher = async (teacher: TeacherRecord)=>{
    if(!canEdit) return
    if(!confirm(`Remove teacher ${teacher.displayName || teacher.name || ''}?`)) return

    try {
      const schoolScopeId = teacher.schoolId || schoolId || profile?.schoolId || 'global'
      await remove(ref(db, `schools/${schoolScopeId}/teachers/${teacher.id}`))
      if (teacher.linkedFrom) {
        await remove(ref(db, `schools/${schoolScopeId}/teachers/${teacher.linkedFrom}`)).catch(()=>{})
      }

      const realUid = teacher.linkedUid || (!String(teacher.uid || '').startsWith('t_') ? String(teacher.uid || '') : '')
      if (realUid) {
        await update(ref(db, `users/${realUid}`), {
          schoolId: null,
          schoolCode: null,
          assignedClasses: null,
          subjects: null,
          classTeacherOf: null,
          updatedAt: Date.now(),
        }).catch(error => console.warn('Teacher user unlink skipped', error))
      }

      toast.success('Teacher removed from this school')
    } catch(error) {
      toast.error(getFriendlyError(error) || 'Could not remove teacher')
    }
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

  const startEdit = (teacher: TeacherRecord)=>{
    if(!canEdit) return
    setEditing(teacher)
    setForm({
      name: teacher.displayName || teacher.name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      subjects: (teacher.subjects||[]).join(', '),
      assignedClasses: (teacher.assignedClasses||[]).join(', '),
      classTeacherOf: teacher.classTeacherOf || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience ? String(teacher.experience) : ''
    })
    setOpen(true)
  }

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="Teachers" subtitle={`Registration • Subjects • Class Teacher • ${teacherCountLabel}`} action={
      canEdit ? (
      <Dialog open={open} onOpenChange={(isOpen)=>{ setOpen(isOpen); if(!isOpen) setEditing(null)}}>
        <DialogTrigger asChild><Button variant="gradient" size="sm" className="rounded-full h-11 px-5"><Plus size={16} className="mr-1"/>{editing ? 'Edit' : 'Add Teacher'}</Button></DialogTrigger>
        <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle className="text-[20px]">{editing ? 'Edit Teacher' : 'Teacher Registration'}</DialogTitle></DialogHeader>
          <div className="grid gap-3.5">
            <div><Label className="text-[12px]">Name *</Label><Input className="mt-1 h-12 rounded-xl" value={form.name} onChange={event=>setForm({...form, name:event.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[12px]">Email *</Label><Input className="mt-1 h-12 rounded-xl" value={form.email} onChange={event=>setForm({...form, email:event.target.value})}/></div>
              <div><Label className="text-[12px]">Phone</Label><Input className="mt-1 h-12 rounded-xl" value={form.phone} onChange={event=>setForm({...form, phone:event.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[12px]">Qualification</Label><Input className="mt-1 h-12 rounded-xl" value={form.qualification} onChange={event=>setForm({...form, qualification:event.target.value})} placeholder="M.Sc, B.Ed" /></div>
              <div><Label className="text-[12px]">Experience (yrs)</Label><Input className="mt-1 h-12 rounded-xl" type="number" value={form.experience} onChange={event=>setForm({...form, experience:event.target.value})} /></div>
            </div>
            <div><Label className="text-[12px]">Subjects (comma)</Label><Input className="mt-1 h-12 rounded-xl" value={form.subjects} onChange={event=>setForm({...form, subjects:event.target.value})}/></div>
            <div><Label className="text-[12px]">Assigned Classes (e.g. 10-A,9-B)</Label><Input className="mt-1 h-12 rounded-xl" value={form.assignedClasses} onChange={event=>setForm({...form, assignedClasses:event.target.value})}/></div>
            <div><Label className="text-[12px]">Class Teacher Of</Label><Input className="mt-1 h-12 rounded-xl" placeholder="10-A" value={form.classTeacherOf} onChange={event=>setForm({...form, classTeacherOf:event.target.value})}/></div>
            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 text-[12px] text-indigo-800 dark:text-indigo-200">
              Admin changes are saved inside the school teacher directory first. When the teacher signs in with the same email and school code, their assignments sync automatically.
            </div>
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
          <Input className="mt-1 h-12 rounded-xl bg-white dark:bg-zinc-900" placeholder="teacher@school.edu" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} disabled={!canEdit} />
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" className="rounded-full h-12" onClick={openGmailInvite} disabled={!canEdit}><Send size={16} className="mr-1"/> Open Gmail</Button>
          <Button variant="outline" className="rounded-full h-12 px-4" onClick={copyInvite} disabled={!canEdit} title="Copy invite text"><Copy size={16}/></Button>
        </div>
        <div className="w-full text-[13px] text-muted-foreground">School Code: <b className="text-indigo-600 font-mono text-[15px]">{school?.code || 'EDU-XXXXXX'}</b> • Opens Gmail draft automatically; admin only has to press Send</div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {teachers.map((teacher, index)=>(
        <Card key={teacher.id || index} className="rounded-[20px] hover:shadow-lg transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">{teacher.displayName?.[0] || teacher.name?.[0] || 'T'}</div>
                <div>
                  <div className="font-bold text-[14px] leading-tight">{teacher.displayName || teacher.name || 'Teacher'}</div>
                  <div className="text-[11px] text-muted-foreground">{teacher.email}</div>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${teacher.isOnline ? 'bg-emerald-500/15 text-emerald-600':'bg-zinc-500/15 text-zinc-500'}`}>{teacher.isOnline ? 'Online':'Offline'}</span>
            </div>
            <div className="text-[13px] mt-3 space-y-1 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
              <div>📚 {(teacher.subjects||[]).join(', ') || '—'}</div>
              <div>🏫 {(teacher.assignedClasses||[]).join(', ') || '—'}</div>
              <div>👨‍🏫 Class Teacher: {teacher.classTeacherOf || '—'}</div>
              <div className="text-[11px] text-muted-foreground">{teacher.qualification || '—'} • Exp: {teacher.experience || 0}y</div>
            </div>
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 rounded-full h-8 text-[12px]" onClick={()=>startEdit(teacher)}><Edit2 size={12} className="mr-1"/> Edit</Button>
                <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0" onClick={()=>delTeacher(teacher)}><Trash2 size={14}/></Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!teachers.length && <Card className="col-span-full p-10 text-center text-muted-foreground rounded-[20px]">No teachers yet – invite via school code.</Card>}
    </div>
  </div>
}
