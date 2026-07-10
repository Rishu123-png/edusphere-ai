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

  // Prefill pending school code from local storage
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
      // Upgrade user profile FIRST to satisfy database security rules (user must be school_admin of this school to write to its node)
      await update(ref(db, `users/${user.uid}`), {
        role: 'school_admin',
        schoolId,
        schoolCode: code,
        displayName: profile?.displayName || form.principal || user.email?.split('@')[0],
        // Double-safety validation fields to guarantee validation passes
        uid: user.uid,
        email: user.email || '',
        createdAt: profile?.createdAt || Date.now()
      })

      // Now create the school data in the database
      await set(ref(db, `schools/${schoolId}`), school)
      await refreshProfile?.()
      toast.success(`School created! Code: ${code}`)
      setStep(2)
      setTimeout(()=> nav('/'), 1200)
    }catch(e:any){ toast.error(e.message) }
    finally{ setLoading(false) }
  }

  const joinSchool = async () => {
    if(!joinCode){ toast.error('School code required'); return }
    setLoading(true)
    try{
      const snap = await get(ref(db, 'schools'))
      if(snap.exists()){
        const schools = snap.val()
        const found = Object.entries(schools).find(([id, sch]: [string, any]) => sch.code?.toUpperCase() === joinCode.trim().toUpperCase())
        if(found){
          const [schoolId, schoolData]: [string, any] = found
          
          // Add teacher details to the school's teachers sub-tree
          const teacherId = 'T'+Math.floor(Math.random()*9000+1000)
          const teacherPayload = {
            uid: user.uid,
            teacherId,
            name: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Teacher',
            email: user.email || '',
            subjects: ['General'],
            assignedClasses: ['10-A'],
            createdAt: Date.now(),
            isOnline: true
          }
          
          // update user profile with double-safety fields
          await update(ref(db, `users/${user.uid}`), {
            role: 'teacher',
            schoolId,
            schoolCode: joinCode.trim().toUpperCase(),
            displayName: profile?.displayName || user.displayName || user.email?.split('@')[0],
            // Double-safety validation fields to guarantee validation passes
            uid: user.uid,
            email: user.email || '',
            createdAt: profile?.createdAt || Date.now()
          })
          
          await update(ref(db, `schools/${schoolId}/teachers/${user.uid}`), teacherPayload)
          
          await refreshProfile?.()
          toast.success(`Successfully joined ${schoolData.name}!`)
          localStorage.removeItem('pending_school_code')
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

  const isDemoUser = user.email === 'superadmin@edusphere.ai' || user.email?.endsWith('@demo.edu')
  const emailVerified = user.emailVerified || isDemoUser

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950 p-6">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardTitle>Welcome to EduSphere AI</CardTitle>
        <CardContent className="space-y-5">
          {profile?.email && !emailVerified && (
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="create" disabled={!emailVerified}>Create New School</TabsTrigger>
                <TabsTrigger value="join" disabled={!emailVerified}>Join Existing School</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4">
                <p className="text-muted-foreground text-sm">School Admin Onboarding. You will become <b>School Admin</b> and receive a unique School Code to invite teachers.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><Label>School Name *</Label><Input value={form.schoolName} onChange={e=>setForm({...form, schoolName:e.target.value})} placeholder="EduSphere Public School" /></div>
                  <div><Label>Principal / Admin Name</Label><Input value={form.principal} onChange={e=>setForm({...form, principal:e.target.value})} /></div>
                  <div><Label>School Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="+91 ..." /></div>
                  <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="City, State" /></div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-muted-foreground">After creation you get: <b>School Code (EDU-XXXXXX)</b></div>
                  <Button disabled={loading || !emailVerified} onClick={createSchool}>{loading ? 'Creating…' : 'Create School →'}</Button>
                </div>
              </TabsContent>

              <TabsContent value="join" className="space-y-4">
                <p className="text-muted-foreground text-sm">Teacher / Staff Onboarding. Enter the <b>School Code</b> shared by your school administrator to join.</p>
                <div className="space-y-2">
                  <Label>School Code *</Label>
                  <Input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="EDU-XXXXXX" className="font-mono text-lg tracking-wider" />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-muted-foreground">Your account will be registered under the school as a Teacher.</div>
                  <Button disabled={loading || !emailVerified} onClick={joinSchool}>{loading ? 'Joining…' : 'Join School →'}</Button>
                </div>
              </TabsContent>
              
              {!emailVerified && <p className="text-xs text-red-500 text-center mt-4">Email verification required before setting up or joining a school.</p>}
            </Tabs>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="text-2xl font-bold text-emerald-600">✓ Welcome to your School!</div>
              <p className="text-muted-foreground">Redirecting to dashboard… Set up classes, students and begin smart attendance!</p>
              <Button onClick={()=>nav('/')}>Go to Dashboard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
