import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { StudentProfile } from '@/types';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentsPage(){
  const { profile } = useAuth();
  const schoolId = profile?.schoolId || '';
  const [list, setList] = useState<StudentProfile[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<any>({name:'', classId:'10-A', rollNo:'', admissionNo:'', guardianName:'', guardianPhone:''});
  const canEdit = ['school_admin','principal','teacher'].includes(profile?.role || '');

  const load = async () => {
    if(!schoolId) return;
    const snap = await getDocs(query(collection(db,'students'), where('schoolId','==', schoolId)));
    setList(snap.docs.map(d=>({id:d.id, ...d.data()}) as StudentProfile));
  };
  useEffect(()=>{ load(); }, [schoolId]);

  const save = async () => {
    const payload = {...form, schoolId, status:'active', qrCode: `STU-${Date.now()}`, createdAt: Date.now()};
    await addDoc(collection(db,'students'), payload);
    toast.success('Student added');
    setForm({name:'', classId:'10-A', rollNo:'', admissionNo:'', guardianName:'', guardianPhone:''});
    load();
  };

  const filtered = list.filter(s => (s.name+s.rollNo+s.admissionNo).toLowerCase().includes(q.toLowerCase()));

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Student Management</h1>
    {canEdit && <Card><CardTitle>Add Student</CardTitle>
      <div className="grid md:grid-cols-3 gap-3 mt-3">
        {Object.entries({name:'Name', admissionNo:'Admission No', rollNo:'Roll No', classId:'Class (e.g. 10-A)', guardianName:'Guardian', guardianPhone:'Guardian Phone'}).map(([k,ph])=>
          <Input key={k} placeholder={ph as string} value={form[k]||''} onChange={e=>setForm({...form, [k]: e.target.value})}/>
        )}
        <Button onClick={save}>Save Student</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Bulk Import/Export available via CSV (see Export button in Reports). QR ID auto-generated.</p>
    </Card>}

    <Card>
      <div className="flex items-center justify-between mb-3"><CardTitle>Students ({filtered.length})</CardTitle>
        <Input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} className="w-60"/>
      </div>
      <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">Admission</th><th>Name</th><th>Class</th><th>Roll</th><th>Guardian</th><th>QR</th><th></th></tr></thead>
        <tbody>{filtered.map(s=> <tr key={s.id} className="border-t border-border">
          <td className="py-2">{s.admissionNo}</td><td>{s.name}</td><td>{s.classId}</td><td>{s.rollNo}</td><td>{s.guardianName} {s.guardianPhone && `• ${s.guardianPhone}`}</td>
          <td><QRCodeSVG value={s.qrCode||s.id} size={40}/></td>
          <td>{canEdit && <Button variant="ghost" size="sm" onClick={async()=>{await deleteDoc(doc(db,'students',s.id)); load();}}>Delete</Button>}</td>
        </tr>)}</tbody>
      </table>
      </div>
    </Card>
  </div>
}
