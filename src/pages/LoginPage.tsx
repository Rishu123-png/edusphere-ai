import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function LoginPage(){
  const { login, googleLogin, register, profile } = useAuth();
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [form, setForm] = useState({email:'', password:'', name:'', role:'school_admin', schoolCode:'', schoolName:''});
  const [busy,setBusy] = useState(false);

  if (profile) return <Navigate to="/" replace/>;

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode==='login') await login(form.email, form.password);
      else await register({email:form.email, password:form.password, name:form.name, role: form.role as any, schoolCode: form.schoolCode, schoolName: form.schoolName });
      toast.success('Welcome to EduSphere AI');
    } catch(e:any){ toast.error(e.message); }
    setBusy(false);
  };

  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-100 dark:from-zinc-950 dark:to-zinc-900 p-6">
    <Card className="w-full max-w-md p-8">
      <h1 className="text-2xl font-bold mb-1">EduSphere AI</h1>
      <p className="text-muted-foreground mb-6">Smart School Management & AI Attendance</p>
      <div className="flex gap-2 mb-4 text-sm">
        <button onClick={()=>setMode('login')} className={mode==='login'?'font-semibold text-primary':''}>Login</button>
        <span>·</span>
        <button onClick={()=>setMode('register')} className={mode==='register'?'font-semibold text-primary':''}>Register / Join School</button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode==='register' && <>
          <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required/></div>
          <div><Label>Role</Label>
            <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})} className="flex h-11 w-full rounded-xl border border-input bg-background px-3">
              <option value="school_admin">School Admin</option>
              <option value="principal">Principal</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
            </select>
          </div>
          {form.role==='school_admin' ? 
            <div><Label>New School Name</Label><Input value={form.schoolName} onChange={e=>setForm({...form, schoolName:e.target.value})} placeholder="DPS Delhi" required/></div> :
            <div><Label>School Invite Code</Label><Input value={form.schoolCode} onChange={e=>setForm({...form, schoolCode:e.target.value})} placeholder="EDU-7Q2P" required/></div>
          }
        </>}
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required/></div>
        <div><Label>Password</Label><Input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required/></div>
        <Button className="w-full" disabled={busy}>{busy?'...': mode==='login'?'Sign In':'Create Account'}</Button>
      </form>
      <Button variant="outline" className="w-full mt-3" onClick={()=>googleLogin()}>Continue with Google</Button>
      <p className="text-xs text-muted-foreground mt-4">School Admins: registering creates a new school and gives you a unique School Code to invite teachers via Email/WhatsApp.</p>
    </Card>
  </div>
}
