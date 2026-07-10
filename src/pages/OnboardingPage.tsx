import { useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { ref, set, update } from 'firebase/database'
import { generateSchoolCode, generateId } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function OnboardingPage(){
  const { user, profile, refreshProfile } = useAuth() as any
  const [step, setStep] = useState(profile?.schoolId ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const [form, setForm] = useState({
    schoolName: '',
    address: '',
    phone: '',
    principal: '',
    email: profile?.email || user?.email || ''
  })

  const createSchool = async () => {
    if(!form.schoolName){ toast.error('School name required'); return }
    setLoading(true)
    try{
      const schoolId = generateId('sch_')
      const code = generateSchoolCode()
      const school = {
        id: schoolId,
        name: form.schoolName,
        code,
        address: form.address,
        phone: form.phone,
        principal: form.principal,
        email: form.email,
        logoUrl: '',
        createdBy: user.uid,
        createdAt: Date.now()
      }
      await set(ref(db, `schools/${schoolId}`), school)
      // upgrade user to school_admin + attach school
      await update(ref(db, `users/${user.uid}`), {
        role: 'school_admin',
        schoolId,
        schoolCode: code,
        displayName: profile?.displayName || form.principal || user.email?.split('@')[0]
      })
      await refreshProfile?.()
      toast.success(`School created! Code: ${code}`)
      setStep(2)
      setTimeout(()=> nav('/'), 1200)
    }catch(e:any){ toast.error(e.message) }
    finally{ setLoading(false) }
  }

  if(!user) return <div className="p-10">Please login first.</div>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950 p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardTitle>Create Your School – EduSphere AI</CardTitle>
        <CardContent className="space-y-5">
          {profile?.email && !user.emailVerified && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
              ✉️ Email not verified yet. Check <b>{user.email}</b> inbox → click verify link → then refresh.
              <Button size="sm" variant="outline" className="ml-3" onClick={async()=>{
                const { sendEmailVerification } = await import('firebase/auth')
                const { auth } = await import('@/lib/firebase')
                if(auth.currentUser) { await sendEmailVerification(auth.currentUser); toast.success('Verification email re-sent') }
              }}>Resend verification</Button>
            </div>
          )}

          {step===1 ? (
            <>
              <p className="text-muted-foreground text-sm">Step 1/2 – School Admin Onboarding. You will become <b>School Admin</b> and receive a unique School Code to invite teachers via Email / WhatsApp.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><Label>School Name *</Label><Input value={form.schoolName} onChange={e=>setForm({...form, schoolName:e.target.value})} placeholder="EduSphere Public School" /></div>
                <div><Label>Principal / Admin Name</Label><Input value={form.principal} onChange={e=>setForm({...form, principal:e.target.value})} /></div>
                <div><Label>School Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="+91 ..." /></div>
                <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="City, State" /></div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-muted-foreground">After creation you get: <b>School Code (EDU-XXXXXX)</b></div>
                <Button disabled={loading || (profile && !user.emailVerified)} onClick={createSchool}>{loading ? 'Creating…' : 'Create School →'}</Button>
              </div>
              {!user.emailVerified && <p className="text-xs text-red-500">Email verification required before creating school.</p>}
            </>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="text-2xl font-bold text-emerald-600">✓ School Created!</div>
              <p className="text-muted-foreground">Redirecting to dashboard… Invite teachers from Teachers → Invite via School Code.</p>
              <Button onClick={()=>nav('/')}>Go to Dashboard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
