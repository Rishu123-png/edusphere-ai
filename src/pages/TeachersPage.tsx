import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function TeachersPage(){
  const { profile } = useAuth();
  const schoolId = profile?.schoolId || '';
  const [teachers, setTeachers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');

  const load = async ()=>{
    if(!schoolId) return;
    const snap = await getDocs(query(collection(db,'users'), where('schoolId','==', schoolId), where('role','in',['teacher','principal'])));
    setTeachers(snap.docs.map(d=>d.data()));
    const s = await getDoc(doc(db,'schools', schoolId));
    setSchoolCode(s.exists()? s.data().schoolCode : '');
  };
  useEffect(()=>{ load(); }, [schoolId]);

  const inviteLink = schoolCode ? `${window.location.origin}/login?code=${schoolCode}` : '';
  const sendInvite = (channel:'gmail'|'whatsapp')=>{
    const text = encodeURIComponent(`Join our school on EduSphere AI! School Code: ${schoolCode}\nRegister: ${inviteLink}`);
    if(channel==='gmail') window.open(`mailto:${inviteEmail}?subject=EduSphere AI Teacher Invite&body=${text}`,'_blank');
    else window.open(`https://wa.me/?text=${text}`,'_blank');
    toast.success(`Invite ready via ${channel}`);
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Teacher Management</h1>
    <Card><CardTitle>Invite Teachers</CardTitle>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <div className="px-3 py-2 rounded-xl bg-muted text-sm font-mono">School Code: <b>{schoolCode || '— create school first'}</b></div>
        <Input placeholder="teacher@gmail.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} className="w-64"/>
        <Button variant="secondary" onClick={()=>sendInvite('gmail')}>Invite via Gmail</Button>
        <Button variant="secondary" onClick={()=>sendInvite('whatsapp')}>Invite via WhatsApp</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Teachers sign up with the School Code, you then assign Subjects / Class Teacher / Classes in the table below.</p>
    </Card>
    <Card><CardTitle>Teachers ({teachers.length})</CardTitle>
      <table className="w-full text-sm mt-3"><thead><tr className="text-left text-muted-foreground"><th>Name</th><th>Email</th><th>Role</th><th>Subjects</th><th>Class Teacher</th></tr></thead>
      <tbody>{teachers.map((t,i)=><tr key={i} className="border-t border-border"><td className="py-2">{t.name}</td><td>{t.email}</td><td>{t.role}</td><td>{(t.subjects||[]).join(', ')||'—'}</td><td>{t.classTeacherOf||'—'}</td></tr>)}</tbody></table>
      <p className="text-xs text-muted-foreground mt-3">Admins can edit teacher profiles in Firestore users/{'{uid}'} – add subjects: ["Maths","Science"], classTeacherOf: "10-A", assignedClasses: ["10-A","10-B"]</p>
    </Card>
  </div>
}
