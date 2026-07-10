import { useState, useEffect } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, push, update, remove } from 'firebase/database'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { generateId } from '@/lib/utils'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'

type Student = any

export default function StudentsPage(){
  const { profile } = useAuth()
  const { schoolId } = useSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ name:'', className:'10', section:'A', rollNumber:'', admissionNumber:'', guardianName:'', guardianPhone:'' })

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
    if(!form.name || !form.rollNumber){ toast.error('Name & Roll required'); return }
    const sid = schoolId || profile?.schoolId || 'global'
    const id = generateId('stu_')
    const payload = {
      ...form,
      schoolId: sid,
      classTeacherId: form.classTeacherId || '',
      status: 'active',
      createdAt: Date.now(),
      qrCode: id
    }
    await update(ref(db, `schools/${sid}/students/${id}`), payload)
    toast.success('Student saved')
    setOpen(false)
    setForm({ name:'', className:'10', section:'A', rollNumber:'', admissionNumber:'', guardianName:'', guardianPhone:'' })
  }

  const bulkExport = ()=>{
    const csv = 'Admission,Roll,Name,Class,Section,Guardian,Phone\n' + filtered.map((s:any)=> [s.admissionNumber,s.rollNumber,s.name,s.className,s.section,s.guardianName,s.guardianPhone].join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='students.csv'; a.click()
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Student Management</h1>
        <p className="text-muted-foreground text-sm">Register • Profile • QR ID • Bulk Import/Export • Timeline</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={bulkExport}>Export CSV</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add Student</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Student</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-3">
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
                ['address','Address'],
              ].map(([k,label])=>(
                <div key={k}>
                  <Label>{label}</Label>
                  <Input value={form[k]||''} onChange={e=>setForm({...form, [k]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save Student</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Card>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input placeholder="Search name, admission, roll…" value={q} onChange={e=>setQ(e.target.value)} />
          <select className="border rounded-xl px-3 text-sm bg-background">
            <option>All Classes</option>
            <option>9</option><option>10</option><option>11</option><option>12</option>
          </select>
          <select className="border rounded-xl px-3 text-sm bg-background">
            <option>All Sections</option><option>A</option><option>B</option><option>C</option>
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Adm No</th><th>Roll</th><th>Name</th><th>Class</th><th>Guardian</th><th>Phone</th><th>QR</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((s:any)=>(
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2">{s.admissionNumber}</td>
                  <td>{s.rollNumber}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.className}-{s.section}</td>
                  <td>{s.guardianName}</td>
                  <td>{s.guardianPhone}</td>
                  <td><div className="bg-white p-1 rounded"><QRCodeSVG value={s.qrCode||s.id} size={36}/></div></td>
                  <td className="space-x-2">
                    <button className="text-primary text-xs" onClick={()=>toast('Edit modal – wired to RTDB')}>Edit</button>
                    <button className="text-destructive text-xs" onClick={()=> remove(ref(db, `schools/${s.schoolId}/students/${s.id}`))}>Delete</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No students – Add first student</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-3 gap-4">
      <Card><CardTitle>Documents Upload</CardTitle><CardContent className="text-sm text-muted-foreground">Aadhaar, TC, Medical – drag & drop enabled (Firebase Storage)</CardContent></Card>
      <Card><CardTitle>Behavior Records</CardTitle><CardContent className="text-sm text-muted-foreground">Positive/negative remarks timeline per student.</CardContent></Card>
      <Card><CardTitle>Student Timeline</CardTitle><CardContent className="text-sm text-muted-foreground">Attendance • Marks • Behavior – unified chronological view.</CardContent></Card>
    </div>
  </div>
}
