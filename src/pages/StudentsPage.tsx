import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove } from 'firebase/database'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { generateId } from '@/lib/utils'
import { createFaceDescriptorFromImageUrl, isValidDescriptor } from '@/lib/faceRecognition'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import PageHeader from '@/components/mobile/PageHeader'
import { Search, Plus, Filter, MoreVertical, QrCode, Edit2, Trash2, Download } from 'lucide-react'

type Student = any

export default function StudentsPage(){
  const { profile, isSchoolAdmin } = useAuth() as any
  const { schoolId } = useSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [generatingFaceId, setGeneratingFaceId] = useState(false)
  const emptyForm = { name:'', className:'10', section:'A', rollNumber:'', admissionNumber:'', guardianName:'', guardianPhone:'', photoUrl:'' }
  const [form, setForm] = useState<any>(emptyForm)

  const canEdit = isSchoolAdmin || profile?.role === 'super_admin'

  useEffect(()=>{
    const r = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    const unsub = onValue(r, snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=> ({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  const filtered = students.filter((s:any)=> (s.name||'').toLowerCase().includes(q.toLowerCase()) || (s.admissionNumber||'').includes(q) || (s.rollNumber||'').includes(q))

  const save = async ()=>{
    if(!canEdit){ toast.error('Only School Admin can add/edit students'); return }
    if(!form.name || !form.rollNumber){ toast.error('Name & Roll required'); return }
    const sid = schoolId || profile?.schoolId || 'global'
    const id = editing?.id || generateId('stu_')
    const payload = {
      ...form,
      schoolId: sid,
      classTeacherId: form.classTeacherId || '',
      status: 'active',
      updatedAt: Date.now(),
      createdAt: editing?.createdAt || Date.now(),
      qrCode: id
    }
    await update(ref(db, `schools/${sid}/students/${id}`), payload)
    toast.success(editing ? 'Student updated' : 'Student saved')
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const generateFaceId = async ()=>{
    if(!form.photoUrl){ toast.error('Add a clear student Photo URL first'); return }
    setGeneratingFaceId(true)
    try {
      const faceDescriptor = await createFaceDescriptorFromImageUrl(form.photoUrl)
      setForm((prev:any)=>({...prev, faceDescriptor}))
      toast.success('AI Face ID generated. Save the student to keep it.')
    } catch(e:any) {
      toast.error(e?.message || 'Could not generate Face ID')
    } finally {
      setGeneratingFaceId(false)
    }
  }

  const handleEdit = (s:any)=>{
    if(!canEdit){ toast.error('School Admin only'); return }
    setEditing(s)
    setForm(s)
    setOpen(true)
  }

  const handleDelete = async (s:any)=>{
    if(!canEdit){ toast.error('School Admin only'); return }
    if(!confirm('Delete student '+s.name+'?')) return
    try {
      await remove(ref(db, `schools/${s.schoolId}/students/${s.id}`))
      // also clean alternative path if exists
      await remove(ref(db, `students/${s.id}`)).catch(()=>{})
      toast.success('Deleted')
    } catch(e:any){ toast.error(e.message) }
  }

  const bulkExport = ()=>{
    const csv = 'Admission,Roll,Name,Class,Section,Guardian,Phone\n' + filtered.map((s:any)=> [s.admissionNumber,s.rollNumber,s.name,s.className,s.section,s.guardianName,s.guardianPhone].join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='students.csv'; a.click()
  }

  return <div className="page-container space-y-4">
    <PageHeader title="Students" subtitle={`${filtered.length} total • Admin Full Access`} action={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full hidden md:flex" onClick={bulkExport}><Download size={16} className="mr-1"/> Export</Button>
        {canEdit ? (
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o){ setEditing(null); setForm(emptyForm) }}}>
          <DialogTrigger asChild><Button variant="gradient" size="sm" className="rounded-full h-11 px-5"><Plus size={18} className="mr-1"/> Add Student</Button></DialogTrigger>
          <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle className="text-[20px]">{editing ? 'Edit Student' : 'New Student'}</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-3.5">
              {[
                ['name','Full Name'],
                ['admissionNumber','Admission No'],
                ['rollNumber','Roll No'],
                ['className','Class'],
                ['section','Section'],
                ['house','House'],
                ['dob','DOB'],
                ['gender','Gender'],
                ['bloodGroup','Blood Group'],
                ['guardianName','Guardian'],
                ['guardianPhone','Guardian Phone'],
                ['photoUrl','Photo URL (for AI Face ID)'],
                ['address','Address'],
              ].map(([k,label])=>(
                <div key={k}>
                  <Label className="text-[12px]">{label}</Label>
                  <Input className="mt-1 h-12 rounded-xl" value={form[k]||''} onChange={e=>setForm({...form, [k]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[13px] flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div>
                <b>AI Face ID:</b> {isValidDescriptor(form.faceDescriptor) ? 'Ready for camera attendance' : 'Not generated yet'}
                <div className="text-muted-foreground text-[12px]">Use one clear front-facing photo. The camera will only mark matched enrolled faces.</div>
              </div>
              <Button variant="outline" className="rounded-full shrink-0" onClick={generateFaceId} disabled={generatingFaceId || !form.photoUrl}>{generatingFaceId ? 'Generating…' : 'Generate Face ID'}</Button>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" className="rounded-full" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button variant="gradient" className="rounded-full" onClick={save}>{editing ? 'Update' : 'Save Student'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : <Button disabled variant="outline" size="sm" className="rounded-full" title="School Admin only">Add Student</Button>}
      </div>
    } />

    {/* Search + Filters - Mobile horizontal scroll */}
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search Students... name, adm, roll" value={q} onChange={e=>setQ(e.target.value)} className="pl-11 h-14 rounded-full bg-white dark:bg-zinc-900" />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <span className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[13px] font-medium whitespace-nowrap">Grade 10-A</span>
        <span className="px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] whitespace-nowrap">Section A</span>
        <span className="px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] whitespace-nowrap">Gender: All</span>
        <span className="px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 text-[13px] whitespace-nowrap">Status: Active</span>
      </div>
    </div>

    {!canEdit && (
      <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-[13px] border border-blue-100 dark:border-blue-900/50">
        👁️ Teacher view: read-only. Attendance & Marks entry allowed in respective modules.
      </div>
    )}

    {/* Mobile Cards */}
    <div className="grid gap-3 md:hidden">
      {filtered.map((s:any)=>(
        <Card key={s.id} className="p-3.5 rounded-[20px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-[16px]">{s.name?.[0]||'S'}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] leading-tight truncate">{s.name}</div>
              <div className="text-[12px] text-muted-foreground">Grade {s.className}-{s.section} • #{s.admissionNumber || s.rollNumber} • Face ID: {isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'No'}</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-9 h-9 rounded-full bg-white border flex items-center justify-center"><QRCodeSVG value={s.qrCode||s.id} size={20}/></div>
              <button className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center"><MoreVertical size={16}/></button>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="flex-1 rounded-full h-9" onClick={()=>handleEdit(s)}><Edit2 size={14} className="mr-1"/> Edit</Button>
              <Button size="sm" variant="ghost" className="rounded-full h-9 px-3" onClick={()=>handleDelete(s)}><Trash2 size={14}/></Button>
            </div>
          )}
        </Card>
      ))}
      {!filtered.length && <Card className="p-8 text-center text-muted-foreground text-[14px]">No students – {canEdit ? 'Add first student' : 'Ask admin to add'}</Card>}
    </div>

    {/* Desktop Table */}
    <Card className="hidden md:block">
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b"><th className="py-3">Adm No</th><th>Roll</th><th>Name</th><th>Class</th><th>Guardian</th><th>Phone</th><th>AI Face</th><th>QR</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((s:any)=>(
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3">{s.admissionNumber}</td>
                  <td>{s.rollNumber}</td>
                  <td className="font-semibold">{s.name}</td>
                  <td>{s.className}-{s.section}</td>
                  <td>{s.guardianName}</td>
                  <td>{s.guardianPhone}</td>
                  <td><span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${isValidDescriptor(s.faceDescriptor) ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{isValidDescriptor(s.faceDescriptor) ? 'Ready' : 'Missing'}</span></td>
                  <td><div className="bg-white p-1 rounded-lg border w-fit"><QRCodeSVG value={s.qrCode||s.id} size={36}/></div></td>
                  <td className="space-x-3 text-xs">
                    {canEdit ? (
                      <>
                        <button className="text-indigo-600 hover:underline font-medium" onClick={()=>handleEdit(s)}>Edit</button>
                        <button className="text-red-500 hover:underline" onClick={()=>handleDelete(s)}>Delete</button>
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

    {/* Floating Add on mobile */}
    {canEdit && (
      <div className="md:hidden fixed bottom-[96px] right-4 z-30">
        <Button variant="gradient" size="lg" className="rounded-full h-14 px-6 shadow-xl" onClick={()=>setOpen(true)}><Plus size={20} className="mr-2"/> Add Student</Button>
      </div>
    )}
  </div>
}
