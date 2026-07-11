import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove, push, set } from 'firebase/database'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { generateId } from '@/lib/utils'
import { createFaceDescriptorFromImageUrl, isValidDescriptor } from '@/lib/faceRecognition'
import { fileToDataUrl, resizeImageDataUrl, uploadStudentPhoto } from '@/lib/studentPhoto'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import PageHeader from '@/components/mobile/PageHeader'
import { Search, Plus, MoreVertical, Edit2, Trash2, Download, Camera, ImageUp } from 'lucide-react'

type Student = any

export default function StudentsPage(){
  const { profile, isSchoolAdmin } = useAuth() as any
  const { schoolId, school } = useSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [generatingFaceId, setGeneratingFaceId] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const emptyForm = { name:'', className:'10', section:'A', rollNumber:'', admissionNumber:'', guardianName:'', guardianPhone:'', subjects:'', photoUrl:'' }
  const [form, setForm] = useState<any>(emptyForm)

  const isAdmin = isSchoolAdmin || profile?.role === 'super_admin'
  const isTeacher = profile?.role === 'teacher'
  // Teachers can add/edit students for their classes; only admin can delete any student
  const canManage = isAdmin || isTeacher

  useEffect(()=>{
    const r = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    const unsub = onValue(r, snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=> ({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  const assignedClasses = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : []
  const classTeacherOf = profile?.classTeacherOf ? [profile.classTeacherOf] : []
  const teacherSubjects = Array.isArray(profile?.subjects) ? profile.subjects : []
  const teacherClasses = useMemo(
    () => Array.from(new Set([...assignedClasses, ...classTeacherOf].map((c:any)=>String(c).trim()).filter(Boolean))),
    [assignedClasses, classTeacherOf]
  )

  // Admin: all students. Teacher: assigned classes + students they added themselves
  const visibleStudents = useMemo(() => {
    if (!isTeacher) return students
    if (!teacherClasses.length) {
      // No assignment yet — still show students this teacher added so their work is visible
      return students.filter((s:any) => s.addedBy === profile?.uid)
    }
    return students.filter((s:any) =>
      teacherClasses.includes(`${s.className}-${s.section}`) || s.addedBy === profile?.uid
    )
  }, [students, isTeacher, teacherClasses, profile?.uid])

  const filtered = visibleStudents.filter((s:any)=>
    (s.name||'').toLowerCase().includes(q.toLowerCase()) ||
    (s.admissionNumber||'').includes(q) ||
    (s.rollNumber||'').includes(q)
  )

  const classKey = (className: string, section: string) => `${String(className||'').trim()}-${String(section||'').trim()}`

  const teacherCanEditStudent = (s: any) => {
    if (isAdmin) return true
    if (!isTeacher) return false
    if (s.addedBy === profile?.uid) return true
    if (teacherClasses.includes(classKey(s.className, s.section))) return true
    return false
  }

  const notifyAdmin = async (title: string, body: string) => {
    const sid = schoolId || profile?.schoolId
    if (!sid) return
    try {
      const nRef = push(ref(db, `schools/${sid}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId: sid,
        toRole: 'school_admin',
        title,
        body,
        type: 'announcement',
        read: false,
        createdAt: Date.now(),
        meta: { by: profile?.uid, byEmail: profile?.email, byName: profile?.displayName || profile?.name },
      })
    } catch {}
  }

  const save = async ()=>{
    if(!canManage){ toast.error('You do not have permission to add students'); return }
    if(!form.name || !form.rollNumber){ toast.error('Name & Roll required'); return }

    const className = String(form.className || '').trim()
    const section = String(form.section || '').trim()
    if(!className || !section){ toast.error('Class and Section are required'); return }

    const ck = classKey(className, section)
    if (isTeacher && teacherClasses.length && !teacherClasses.includes(ck) && !editing) {
      toast.error(`You can only add students to your assigned classes: ${teacherClasses.join(', ')}`)
      return
    }
    if (isTeacher && editing && !teacherCanEditStudent(editing)) {
      toast.error('You can only edit students in your classes or students you added')
      return
    }

    const sid = schoolId || profile?.schoolId || 'global'
    const id = editing?.id || form.id || generateId('stu_')
    const subjectsList = typeof form.subjects === 'string'
      ? form.subjects.split(',').map((x:string)=>x.trim()).filter(Boolean)
      : (form.subjects || [])

    // Teachers default subjects to their subject list if blank
    const finalSubjects = subjectsList.length
      ? subjectsList
      : (isTeacher && teacherSubjects.length ? teacherSubjects : [])

    const payload: any = {
      name: form.name,
      className,
      section,
      rollNumber: form.rollNumber,
      admissionNumber: form.admissionNumber || form.rollNumber,
      guardianName: form.guardianName || '',
      guardianPhone: form.guardianPhone || '',
      address: form.address || '',
      dob: form.dob || '',
      subjects: finalSubjects,
      photoUrl: form.photoUrl || '',
      faceDescriptor: isValidDescriptor(form.faceDescriptor) ? form.faceDescriptor : (editing?.faceDescriptor || null),
      schoolId: sid,
      classTeacherId: form.classTeacherId || (isTeacher && profile?.classTeacherOf === ck ? profile.uid : (editing?.classTeacherId || '')),
      status: 'active',
      updatedAt: Date.now(),
      createdAt: editing?.createdAt || Date.now(),
      qrCode: id,
      addedBy: editing?.addedBy || profile?.uid || '',
      addedByRole: editing?.addedByRole || profile?.role || '',
      addedByName: editing?.addedByName || profile?.displayName || profile?.name || profile?.email || '',
      lastEditedBy: profile?.uid || '',
      lastEditedAt: Date.now(),
    }

    // Strip local-only fields
    delete payload.localPhotoDataUrl
    delete payload.id

    await update(ref(db, `schools/${sid}/students/${id}`), payload)

    if (!editing && isTeacher) {
      await notifyAdmin(
        'New student added by teacher',
        `${profile?.displayName || profile?.email} added ${payload.name} (${className}-${section}, Roll ${payload.rollNumber})`
      )
    }

    toast.success(editing
      ? 'Student updated — synced to school admin'
      : isTeacher
        ? 'Student saved — school admin can see them instantly'
        : 'Student saved')
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const friendlyFaceError = (e: any) => {
    const msg = String(e?.message || e || '')
    if (/Unexpected token|<!doctype|not valid JSON|models failed|HTML instead/i.test(msg)) {
      return 'Face AI models could not load. Redeploy with public/models folder, hard-refresh the app (Ctrl+Shift+R), then try again.'
    }
    if (/timeout/i.test(msg)) return 'Face ID timed out. Use a clearer, closer front-facing photo.'
    if (/No clear face|too small|confidence/i.test(msg)) return msg
    return msg || 'Could not generate Face ID'
  }

  const generateFaceId = async ()=>{
    if(!form.photoUrl){ toast.error('Update/select a clear student photo first'); return }
    setGeneratingFaceId(true)
    try {
      const source = form.localPhotoDataUrl || form.photoUrl
      const faceDescriptor = await createFaceDescriptorFromImageUrl(source)
      setForm((prev:any)=>({...prev, faceDescriptor}))
      toast.success('AI Face ID generated. Save the student to keep it.')
    } catch(e:any) {
      setForm((prev:any)=>({...prev, faceDescriptor: null}))
      toast.error(friendlyFaceError(e))
    } finally {
      setGeneratingFaceId(false)
    }
  }

  const applySelectedPhoto = async (dataUrl: string) => {
    if(!canManage){ toast.error('No permission'); return }
    const sid = schoolId || profile?.schoolId || 'global'
    const id = editing?.id || form.id || generateId('stu_')
    setUploadingPhoto(true)
    try {
      const resized = await resizeImageDataUrl(dataUrl)
      setForm((prev:any)=>({...prev, id, photoUrl: resized, localPhotoDataUrl: resized, faceDescriptor: null}))

      let faceDescriptor: number[] | null = null
      try {
        faceDescriptor = await Promise.race([
          createFaceDescriptorFromImageUrl(resized),
          new Promise<never>((_, reject)=> window.setTimeout(()=>reject(new Error('Face ID generation timed out. Try a clearer, smaller photo.')), 60000))
        ])
        setForm((prev:any)=>({...prev, id, faceDescriptor, localPhotoDataUrl: resized}))
      } catch(faceError:any) {
        toast.error(friendlyFaceError(faceError))
      }

      try {
        const uploadedUrl = await uploadStudentPhoto(sid, id, resized)
        setForm((prev:any)=>({
          ...prev,
          id,
          photoUrl: uploadedUrl,
          localPhotoDataUrl: resized,
          faceDescriptor: faceDescriptor || prev.faceDescriptor
        }))
        toast.success(faceDescriptor
          ? 'Photo uploaded and AI Face ID generated. Now save the student.'
          : 'Photo saved. Tap Face ID after models load, or try a clearer front face photo.')
      } catch(uploadError:any) {
        setForm((prev:any)=>({...prev, id, photoUrl: resized, localPhotoDataUrl: resized, faceDescriptor: faceDescriptor || prev.faceDescriptor}))
        toast.error(uploadError?.message || 'Storage upload failed. Photo preview is kept; check Firebase Storage rules.')
      }
    } catch(e:any) {
      toast.error(e?.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const chooseStudentPhoto = async () => {
    if(!canManage){ toast.error('No permission'); return }
    try {
      const { Capacitor } = await import('@capacitor/core')
      if(Capacitor.isNativePlatform()) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
        const photo = await Camera.getPhoto({
          source: CameraSource.Prompt,
          resultType: CameraResultType.DataUrl,
          quality: 86,
          width: 900,
          height: 900,
          correctOrientation: true,
          allowEditing: false,
          promptLabelHeader: 'Update Student Photo',
          promptLabelPhoto: 'Open Gallery / Photos',
          promptLabelPicture: 'Open Camera',
          promptLabelCancel: 'Cancel'
        })
        if(photo.dataUrl) await applySelectedPhoto(photo.dataUrl)
        return
      }
    } catch(e:any) {
      if(e?.message && /cancel/i.test(e.message)) return
    }
    fileInputRef.current?.click()
  }

  const handlePhotoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if(!file) return
    if(!file.type.startsWith('image/')){ toast.error('Please select an image'); return }
    const dataUrl = await fileToDataUrl(file)
    await applySelectedPhoto(dataUrl)
  }

  const handleEdit = (s:any)=>{
    if(!teacherCanEditStudent(s)){ toast.error('You can only edit students in your classes'); return }
    setEditing(s)
    setForm({
      ...s,
      subjects: Array.isArray(s.subjects) ? s.subjects.join(', ') : (s.subjects || (isTeacher ? teacherSubjects.join(', ') : '')),
    })
    setOpen(true)
  }

  const handleDelete = async (s:any)=>{
    if(!isAdmin){ toast.error('Only School Admin can delete students'); return }
    if(!confirm('Delete student '+s.name+'?')) return
    try {
      await remove(ref(db, `schools/${s.schoolId || schoolId}/students/${s.id}`))
      await remove(ref(db, `students/${s.id}`)).catch(()=>{})
      toast.success('Deleted')
    } catch(e:any){ toast.error(e.message) }
  }

  const openAdd = () => {
    const defaults = { ...emptyForm }
    if (isTeacher) {
      if (teacherClasses.length) {
        const [c, sec] = teacherClasses[0].split('-')
        defaults.className = c || '10'
        defaults.section = sec || 'A'
      }
      if (teacherSubjects.length) defaults.subjects = teacherSubjects.join(', ')
    }
    setEditing(null)
    setForm(defaults)
    setOpen(true)
  }

  const bulkExport = ()=>{
    const csv = 'Admission,Roll,Name,Class,Section,Guardian,Phone,AddedBy\\n' + filtered.map((s:any)=>
      [s.admissionNumber,s.rollNumber,s.name,s.className,s.section,s.guardianName,s.guardianPhone,s.addedByName||''].join(',')
    ).join('\\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='students.csv'; a.click()
  }

  const subtitle = isTeacher
    ? `${filtered.length} in your classes • adds sync to admin live`
    : `${filtered.length} total • Admin Full Access`

  return <div className="page-container space-y-4">
    <PageHeader title="Students" subtitle={subtitle} action={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full hidden md:flex" onClick={bulkExport}><Download size={16} className="mr-1"/> Export</Button>
        {canManage ? (
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o){ setEditing(null); setForm(emptyForm) }}}>
          <DialogTrigger asChild>
            <Button variant="gradient" size="sm" className="rounded-full h-11 px-5" onClick={(e)=>{ e.preventDefault(); openAdd() }}>
              <Plus size={18} className="mr-1"/> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-[20px]">{editing ? 'Edit Student' : 'New Student'}</DialogTitle>
            </DialogHeader>
            {isTeacher && (
              <div className="mb-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-[12px] text-indigo-800 dark:text-indigo-200">
                You are adding as <b>Teacher</b>. Student saves to school database instantly — <b>{school?.name || 'School Admin'}</b> will see them.
                {teacherClasses.length ? <> Your classes: <b>{teacherClasses.join(', ')}</b></> : <> Ask admin to assign your classes for restricted add; you can still add and they will sync.</>}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700 flex flex-col md:flex-row gap-3 md:items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {form.photoUrl ? <img src={form.photoUrl} alt="Student" className="w-full h-full object-cover" /> : (form.name?.[0] || 'S')}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[14px]">Student Photo</div>
                  <div className="text-[12px] text-muted-foreground">Tap Update Photo for Gallery/Camera. Face ID enables AI attendance.</div>
                  <div className="text-[12px] mt-1">AI Face ID: <b className={isValidDescriptor(form.faceDescriptor) ? 'text-emerald-600' : 'text-amber-600'}>{isValidDescriptor(form.faceDescriptor) ? 'Ready' : 'Missing'}</b></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" className="rounded-full" onClick={chooseStudentPhoto} disabled={uploadingPhoto}><ImageUp size={16} className="mr-1"/>{uploadingPhoto ? 'Uploading…' : 'Update Photo'}</Button>
                {form.photoUrl && <Button variant="ghost" className="rounded-full" onClick={generateFaceId} disabled={generatingFaceId}><Camera size={16} className="mr-1"/>{generatingFaceId ? 'Checking…' : 'Face ID'}</Button>}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3.5">
              {[
                ['name','Full Name'],
                ['admissionNumber','Admission No'],
                ['rollNumber','Roll No'],
                ['className','Class'],
                ['section','Section'],
                ['subjects','Subjects (comma, e.g. Maths, Science)'],
                ['dob','DOB'],
                ['guardianName','Guardian'],
                ['guardianPhone','Guardian Phone'],
                ['address','Address'],
              ].map(([k,label])=>(
                <div key={k}>
                  <Label className="text-[12px]">{label}</Label>
                  {k === 'className' && isTeacher && teacherClasses.length ? (
                    <select
                      className="mt-1 h-12 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-[14px]"
                      value={classKey(form.className, form.section)}
                      onChange={e=>{
                        const [c, sec] = e.target.value.split('-')
                        setForm({...form, className: c || '', section: sec || ''})
                      }}
                    >
                      {teacherClasses.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <Input className="mt-1 h-12 rounded-xl" value={form[k]||''} onChange={e=>setForm({...form, [k]: e.target.value})} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[13px]">
              <b>Sync:</b> Saved students appear for School Admin and other teachers of the same class in real time (Firebase).
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" className="rounded-full" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button variant="gradient" className="rounded-full" onClick={save}>{editing ? 'Update' : 'Save Student'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>
    } />

    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search Students... name, adm, roll" value={q} onChange={e=>setQ(e.target.value)} className="pl-11 h-14 rounded-full bg-white dark:bg-zinc-900" />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <span className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[13px] font-medium whitespace-nowrap">
          {isTeacher ? (teacherClasses.length ? `Your classes: ${teacherClasses.join(', ')}` : 'Your added students') : 'All Classes'}
        </span>
        <span className="px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] whitespace-nowrap">Live sync with admin</span>
      </div>
    </div>

    {isTeacher && (
      <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-[13px] border border-blue-100 dark:border-blue-900/50">
        Teacher access: add/edit students for your classes. School Admin sees every student you save. Only Admin can delete students.
        {!teacherClasses.length && ' Tip: ask Admin to set your Assigned Classes on the Teachers page for class filtering.'}
      </div>
    )}

    <div className="grid gap-3 md:hidden">
      {filtered.map((s:any)=>(
        <Card key={s.id} className="p-3.5 rounded-[20px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-[16px] overflow-hidden">
              {s.photoUrl ? <img src={s.photoUrl} alt={s.name || 'Student'} className="w-full h-full object-cover" /> : (s.name?.[0]||'S')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] leading-tight truncate">{s.name}</div>
              <div className="text-[12px] text-muted-foreground">
                Grade {s.className}-{s.section} • #{s.admissionNumber || s.rollNumber} • Face: {isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'No'}
              </div>
              {s.addedByName && <div className="text-[11px] text-indigo-600">Added by {s.addedByName}{s.addedByRole === 'teacher' ? ' (teacher)' : ''}</div>}
            </div>
            <div className="flex items-center gap-1">
              <div className="w-9 h-9 rounded-full bg-white border flex items-center justify-center"><QRCodeSVG value={s.qrCode||s.id} size={20}/></div>
              <button className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center"><MoreVertical size={16}/></button>
            </div>
          </div>
          {teacherCanEditStudent(s) && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="flex-1 rounded-full h-9" onClick={()=>handleEdit(s)}><Edit2 size={14} className="mr-1"/> Edit</Button>
              {isAdmin && <Button size="sm" variant="ghost" className="rounded-full h-9 px-3" onClick={()=>handleDelete(s)}><Trash2 size={14}/></Button>}
            </div>
          )}
        </Card>
      ))}
      {!filtered.length && (
        <Card className="p-8 text-center text-muted-foreground text-[14px]">
          No students – {canManage ? 'Add first student' : 'Ask admin to add'}
        </Card>
      )}
    </div>
<Card className="hidden md:block">
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-3">Adm No</th><th>Roll</th><th>Name</th><th>Class</th><th>Guardian</th><th>Phone</th><th>AI Face</th><th>Added by</th><th>QR</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s:any)=>(
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3">{s.admissionNumber}</td>
                  <td>{s.rollNumber}</td>
                  <td className="font-semibold">{s.name}</td>
                  <td>{s.className}-{s.section}</td>
                  <td>{s.guardianName}</td>
                  <td>{s.guardianPhone}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${isValidDescriptor(s.faceDescriptor) ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                      {isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'Missing'}
                    </span>
                  </td>
                  <td className="text-[12px] text-muted-foreground">{s.addedByName || '—'}</td>
                  <td><div className="bg-white p-1 rounded-lg border w-fit"><QRCodeSVG value={s.qrCode||s.id} size={36}/></div></td>
                  <td className="space-x-3 text-xs">
                    {teacherCanEditStudent(s) ? (
                      <>
                        <button className="text-indigo-600 hover:underline font-medium" onClick={()=>handleEdit(s)}>Edit</button>
                        {isAdmin && <button className="text-red-500 hover:underline" onClick={()=>handleDelete(s)}>Delete</button>}
                      </>
                    ) : <span className="text-muted-foreground">View only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    {canManage && (
      <div className="md:hidden fixed bottom-[96px] right-4 z-30">
        <Button variant="gradient" size="lg" className="rounded-full h-14 px-6 shadow-xl" onClick={openAdd}><Plus size={20} className="mr-2"/> Add Student</Button>
      </div>
    )}
  </div>
}