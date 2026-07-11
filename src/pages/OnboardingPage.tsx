import { useState, useEffect } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { ref, set, update, get } from 'firebase/database'
import { generateSchoolCode, generateId } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export default function OnboardingPage(){
  const { user, profile, refreshProfile } = useAuth() as any
  const [step, setStep] = useState(profile?.schoolId ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('create')
  
  const [form, setForm] = useState({
    schoolName: '',
    address: '',
    phone: '',
    principal: '',
    email: profile?.email || user?.email || ''
  })
  
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    const pending = localStorage.getItem('pending_school_code')
    if (pending) {
      setJoinCode(pending)
      setActiveTab('join')
    }
  }, [])

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
      await update(ref(db, `users/${user.uid}`), {
        role: 'school_admin',
        schoolId,
        schoolCode: code,
        displayName: profile?.displayName || form.principal || user.email?.split('@')[0],
        uid: user.uid,
        email: user.email || '',
        createdAt: profile?.createdAt || Date.now()
      })
      await set(ref(db, `schools/${schoolId}`), school)
      await refreshProfile?.()
      toast.success(`School created! Code: ${code}`)
      setStep(2)
      setTimeout(()=> nav('/'), 1200)
    }catch(e:any){ toast.error(e.message) }
    finally{ setLoading(false) }
  }

  const joinSchool = async () => {
    const trimmedCode = joinCode.trim().toUpperCase()
    if(!trimmedCode){ toast.error('Enter school code'); return }
    setLoading(true)
    try{
      const snap = await get(ref(db, `schools`))
      if(snap.exists()){
        const schools = snap.val()
        const found = Object.values(schools).find((s:any)=> s.code === trimmedCode) as any
        if(found){
          await update(ref(db, `users/${user.uid}`), {
            schoolId: found.id,
            schoolCode: found.code,
            role: 'teacher',
            uid: user.uid,
            email: user.email || '',
          })
          localStorage.removeItem('pending_school_code')
          await refreshProfile?.()
          toast.success(`Joined ${found.name}!`)
          setStep(2)
          setTimeout(()=> nav('/'), 1200)
        } else {
          toast.error('School not found with this code. Please check and try again.')
        }
      } else {
        toast.error('No schools registered yet.')
      }
    } catch(e:any){ toast.error(e.message) }
    finally{ setLoading(false) }
  }

  if(!user) return <div className="p-10">Please login first.</div>

  const emailVerified = !!user.emailVerified

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950 p-4">
      <Card className="w-full max-w-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] rounded-[32px] overflow-hidden border-0">
        <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="p-7 md:p-8">
          <CardTitle className="text-[24px] p-0">Welcome to EduSphere AI ✨</CardTitle>
          <p className="text-[13px] text-muted-foreground mt-1">Setup your school in 30 seconds</p>
        </div>
        <CardContent className="space-y-5 px-7 md:px-8 pb-8">
          {profile?.email && !emailVerified && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-[13px] flex items-center justify-between gap-2">
              <span>✉️ Not verified: <b>{user.email}</b></span>
              <Button size="sm" variant="outline" className="rounded-full h-8 shrink-0 ml-2" onClick={async()=>{
                const { sendEmailVerification } = await import('firebase/auth')
                const { auth } = await import('@/lib/firebase')
                if(auth.currentUser) { await sendEmailVerification(auth.currentUser); toast.success('Verification email re-sent') }
              }}>Resend</Button>
            </div>
          )}

          {step===1 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-6 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 p-1">
                <TabsTrigger value="create" disabled={!emailVerified} className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900">Create School</TabsTrigger>
                <TabsTrigger value="join" disabled={!emailVerified} className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white">Join School</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4">
                <p className="text-muted-foreground text-[13px] p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30">You will become <b>School Admin</b> and receive unique code EDU-XXXXXX to invite teachers.</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><Label className="text-[12px]">School Name *</Label><Input className="mt-1 h-12 rounded-xl" value={form.schoolName} onChange={e=>setForm({...form, schoolName:e.target.value})} placeholder="EduSphere Public School" /></div>
                  <div><Label className="text-[12px]">Principal / Admin</Label><Input className="mt-1 h-12 rounded-xl" value={form.principal} onChange={e=>setForm({...form, principal:e.target.value})} /></div>
                  <div><Label className="text-[12px]">School Email</Label><Input className="mt-1 h-12 rounded-xl" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
                  <div><Label className="text-[12px]">Phone</Label><Input className="mt-1 h-12 rounded-xl" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="+91 ..." /></div>
                  <div className="md:col-span-2"><Label className="text-[12px]">Address</Label><Input className="mt-1 h-12 rounded-xl" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="City, State" /></div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="gradient" disabled={loading || !emailVerified} className="rounded-full h-12" onClick={createSchool}>{loading ? 'Creating…' : 'Create School →'}</Button>
                  <div className="text-[11px] text-muted-foreground text-center">After creation you get School Code EDU-XXXXXX</div>
                </div>
              </TabsContent>

              <TabsContent value="join" className="space-y-4">
                <p className="text-muted-foreground text-[13px] p-3 rounded-xl bg-slate-50 dark:bg-zinc-800">Enter <b>School Code</b> shared by admin to join as Teacher.</p>
                <div className="space-y-2">
                  <Label>School Code *</Label>
                  <Input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="EDU-XXXXXX" className="font-mono text-[18px] tracking-wider h-14 rounded-2xl text-center" />
                </div>
                <Button variant="gradient" disabled={loading || !emailVerified} className="w-full rounded-full h-12" onClick={joinSchool}>{loading ? 'Joining…' : 'Join School →'}</Button>
              </TabsContent>
              
              {!emailVerified && <p className="text-[12px] text-red-500 text-center mt-4 p-2 rounded-xl bg-red-50 dark:bg-red-950/20">Email verification required before setup.</p>}
            </Tabs>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-3xl">✓</div>
              <div className="text-[22px] font-extrabold text-emerald-600">Welcome to your School!</div>
              <p className="text-[13px] text-muted-foreground">Redirecting to dashboard… Setup classes, students and begin smart attendance!</p>
              <Button variant="gradient" className="rounded-full mt-2" onClick={()=>nav('/')}>Go to Dashboard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

