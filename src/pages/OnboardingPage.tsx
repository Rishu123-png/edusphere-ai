import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { get, ref, set, update } from 'firebase/database'
import { generateId, generateSchoolCode } from '@/lib/utils'
import { getFriendlyError } from '@/lib/errors'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import AmbientBackground from '@/components/mobile/AmbientBackground'
import { ArrowRight, Building2, CheckCircle2, KeyRound, Mail, MailCheck, MapPin, Phone, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react'

export default function OnboardingPage(){
  const { user, profile, refreshProfile } = useAuth() as any
  const [step, setStep] = useState(profile?.schoolId ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('create')
  const [joinRole, setJoinRole] = useState<'teacher' | 'parent'>('teacher')
  const navigate = useNavigate()

  const [form, setForm] = useState({
    schoolName: '',
    address: '',
    phone: '',
    principal: '',
    email: profile?.email || user?.email || ''
  })
  const [joinCode, setJoinCode] = useState('')

  const reserveSchoolCode = async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateSchoolCode()
      const snap = await get(ref(db, `schoolCodes/${code}`))
      if (!snap.exists()) return code
    }
    throw new Error('Could not reserve a unique school code. Please try again.')
  }

  useEffect(() => {
    const pending = localStorage.getItem('pending_school_code')
    if (pending) {
      setJoinCode(pending)
      setActiveTab('join')
    }
  }, [])

  // Release the global html/body/#root overflow lock while this auth
  // screen is mounted so the page can scroll.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('auth-page-open')
    window.scrollTo(0, 0)
    return () => {
      root.classList.remove('auth-page-open')
      document.body.classList.remove('auth-page-open')
    }
  }, [])

  const createSchool = async () => {
    if(!form.schoolName){ toast.error('School name required'); return }
    setLoading(true)
    try{
      const schoolId = generateId('sch_')
      const code = await reserveSchoolCode()
      const createdAt = Date.now()
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
        createdAt
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
      await set(ref(db, `schoolCodes/${code}`), {
        schoolId,
        schoolName: school.name,
        code,
        createdBy: user.uid,
        createdAt,
      })
      await refreshProfile?.()
      toast.success(`School created! Code: ${code}`)
      setStep(2)
      setTimeout(()=> navigate('/'), 1200)
    } catch(error:any) {
      toast.error(getFriendlyError(error) || 'Could not create school')
    } finally { setLoading(false) }
  }

  const joinSchool = async () => {
    const trimmedCode = joinCode.trim().toUpperCase()
    if(!trimmedCode){ toast.error('Enter school code'); return }

    // Hardened rule: once a profile already belongs to a school it cannot hop
    // to another school by itself (see database.rules.json self-write guard).
    if (profile?.schoolId) {
      toast.error('This account already belongs to a school. Ask your school admin to unlink it first.')
      return
    }

    setLoading(true)
    try{
      const schoolCodeSnap = await get(ref(db, `schoolCodes/${trimmedCode}`))
      if (!schoolCodeSnap.exists()) {
        toast.error('School not found with this code. Please check and try again.')
        return
      }
      const found = schoolCodeSnap.val() as { schoolId: string; schoolName?: string; code?: string }
      const foundSchoolId = found.schoolId
      const foundSchoolName = found.schoolName || 'EduSphere School'
      const foundSchoolCode = found.code || trimmedCode

      /*
        CRITICAL ORDERING FIX:
        Firestore-style rules require users/$uid/schoolId == $schoolId BEFORE
        that member may read anything inside the school. The old flow read
        `schools/$id/students` and `schools/$id/teachers` while the account
        still had NO schoolId — every read was PERMISSION_DENIED, so:
          • parents could never complete guardian linking, and
          • a joining teacher overwrote the admin's assignedClasses with [].
        Now we (1) claim membership on our own profile first (allowed by the
        self-write rule because the profile has no school yet), then (2) read
        school data, and (3) roll membership back if the join is rejected.
      */
      const claimMembership = (role: 'teacher' | 'parent', extra: Record<string, unknown> = {}) =>
        update(ref(db, `users/${user.uid}`), {
          schoolId: foundSchoolId,
          schoolCode: foundSchoolCode,
          role,
          uid: user.uid,
          email: user.email || '',
          displayName: profile?.displayName || user.displayName || user.email?.split('@')[0] || '',
          createdAt: profile?.createdAt || Date.now(),
          updatedAt: Date.now(),
          ...extra,
        })

      const rollbackMembership = () =>
        update(ref(db, `users/${user.uid}`), {
          schoolId: null,
          schoolCode: null,
          linkedStudentIds: null,
          updatedAt: Date.now(),
        })

      // Parents can only join when the school has already linked their exact
      // verified login email to a student guardian record.
      if (joinRole === 'parent') {
        // Step 1: become a member (no schoolId existed, so self-write passes)
        await claimMembership('parent')

        // Step 2: now readable — verify a child is linked to this account
        const studentSnapshot = await get(ref(db, `schools/${foundSchoolId}/students`))
        const studentEntries = studentSnapshot.exists() ? Object.entries(studentSnapshot.val() || {}) : []
        const loginEmail = String(user.email || '').toLowerCase()
        const linkedStudentIds = studentEntries
          .filter(([, student]: any) =>
            student?.parentUid === user.uid ||
            student?.guardianUid === user.uid ||
            (loginEmail && String(student?.guardianEmail || '').toLowerCase() === loginEmail)
          )
          .map(([studentId]) => studentId)

        if (!linkedStudentIds.length) {
          // Step 3: no child found → leave the school again (allowed by rules)
          await rollbackMembership().catch(() => {})
          toast.error('No child is linked to this login email. Ask the school admin to add it as Guardian Login Email on the student profile, then try again.')
          return
        }

        await update(ref(db, `users/${user.uid}`), { linkedStudentIds })
        localStorage.removeItem('pending_school_code')
        await refreshProfile?.()
        toast.success(`Parent access connected to ${foundSchoolName}!`)
        setStep(2)
        setTimeout(()=> navigate('/parent'), 1200)
        return
      }

      // Teacher join: claim membership first, THEN read the directory (the
      // reads below would previously be denied and silently wipe assignments).
      await claimMembership('teacher')

      let assignedClasses: string[] = []
      let subjects: string[] = []
      let classTeacherOf = ''
      let teacherRecordId = user.uid
      try {
        const teacherSnapshot = await get(ref(db, `schools/${foundSchoolId}/teachers`))
        if (teacherSnapshot.exists()) {
          const teachers = teacherSnapshot.val() || {}
          const match = Object.entries(teachers).find(([, teacher]: any) =>
            String(teacher?.email || '').toLowerCase() === String(user.email || '').toLowerCase()
          ) as [string, any] | undefined
          if (match) {
            teacherRecordId = match[0]
            assignedClasses = match[1]?.assignedClasses || []
            subjects = match[1]?.subjects || []
            classTeacherOf = match[1]?.classTeacherOf || ''
          }
        }
      } catch (error) { console.warn('Teacher directory lookup failed (will register fresh)', error) }

      await update(ref(db, `users/${user.uid}`), {
        assignedClasses,
        subjects,
        classTeacherOf,
        updatedAt: Date.now(),
      })
      await update(ref(db, `schools/${foundSchoolId}/teachers/${user.uid}`), {
        uid: user.uid,
        email: user.email || '',
        name: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Teacher',
        displayName: profile?.displayName || user.displayName || '',
        schoolId: foundSchoolId,
        role: 'teacher',
        assignedClasses,
        subjects,
        classTeacherOf,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        isOnline: true,
      })
      if (teacherRecordId && teacherRecordId !== user.uid) {
        await update(ref(db, `schools/${foundSchoolId}/teachers/${teacherRecordId}`), {
          linkedUid: user.uid,
          updatedAt: Date.now(),
        }).catch(error => console.warn(error))
      }
      localStorage.removeItem('pending_school_code')
      await refreshProfile?.()
      toast.success(`Joined ${foundSchoolName}!`)
      setStep(2)
      setTimeout(()=> navigate('/'), 1200)
    } catch(error:any) {
      toast.error(getFriendlyError(error) || 'Could not join school')
    } finally { setLoading(false) }
  }

  if(!user) return <div className="grid min-h-screen place-items-center bg-[#070a10] text-white">Please sign in first.</div>
  const emailVerified = !!user.emailVerified

  return (
    <div className="onboarding-shell relative flex min-h-[100dvh] w-full flex-col items-center bg-[#070a10] px-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <AmbientBackground />
      <div className="login-inner w-full">
      <div className="relative z-[1] mx-auto w-full max-w-[560px]">
        <header className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2.5"><div className="brand-orbit grid h-10 w-10 place-items-center rounded-xl"><Sparkles size={19}/></div><div><div className="text-[15px] font-black">EduSphere <span className="text-gradient-ai">AI</span></div><div className="text-[8px] font-bold uppercase tracking-[.18em] text-slate-600">Secure school setup</div></div></div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[.055] px-2.5 py-1 text-[8px] font-bold text-emerald-300"><ShieldCheck size={10}/> VERIFIED FLOW</span>
        </header>

        <div className="onboarding-progress mx-auto my-6 flex max-w-[360px] items-center px-4">
          {[
            { number: 1, label: 'School setup' },
            { number: 2, label: 'Ready' },
          ].map((item, index)=><div key={item.number} className="contents"><div className="flex flex-col items-center gap-1.5"><span className={`grid h-9 w-9 place-items-center rounded-full border text-[12px] font-black ${step>=item.number?'border-cyan-300/35 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,.14)]':'border-white/[.08] bg-white/[.025] text-slate-600'}`}>{step>item.number?<CheckCircle2 size={15}/>:item.number}</span><span className={`whitespace-nowrap text-[8px] font-bold uppercase tracking-wider ${step>=item.number?'text-slate-300':'text-slate-600'}`}>{item.label}</span></div>{index===0&&<span className={`mx-3 mb-5 h-px flex-1 ${step>=2?'bg-gradient-to-r from-cyan-400 to-violet-500':'bg-white/[.08]'}`}/>}</div>)}
        </div>

        <main className="onboarding-card overflow-hidden rounded-[30px] p-[1px]">
          <div className="rounded-[29px] bg-[#0d131e]/95 p-5 md:p-8">
            <div className="mb-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/10 to-violet-500/15 text-cyan-200"><Building2 size={25}/></div>
              <h1 className="mt-4 text-[25px] font-black tracking-[-.045em]">{step===1?'Build your campus':'Your campus is ready'}</h1>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{step===1?'Create a new school workspace or join your administrator with an invite code.':'Secure profile connected. Redirecting to the intelligent dashboard.'}</p>
            </div>

            {profile?.email && !emailVerified && <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-[10px] text-amber-200"><span className="flex min-w-0 items-center gap-2"><MailCheck size={15} className="shrink-0"/><span className="truncate">Verify {user.email}</span></span><Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full border-amber-300/15 bg-transparent" onClick={async()=>{
              const { sendEmailVerification } = await import('firebase/auth')
              const { auth } = await import('@/lib/firebase')
              if(auth.currentUser) { await sendEmailVerification(auth.currentUser); toast.success('Verification email re-sent') }
            }}>Resend</Button></div>}

            {step===1 ? <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="onboarding-tabs mb-5 grid h-12 w-full grid-cols-2 rounded-full border border-white/[.06] bg-white/[.035] p-1">
                <TabsTrigger value="create" disabled={!emailVerified} className="rounded-full text-[11px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-violet-500/20 data-[state=active]:text-white"><Building2 size={14} className="mr-1.5"/> Create School</TabsTrigger>
                <TabsTrigger value="join" disabled={!emailVerified} className="rounded-full text-[11px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-violet-500/20 data-[state=active]:text-white"><UsersRound size={14} className="mr-1.5"/> Join School</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4">
                <div className="flex gap-2.5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.04] p-3 text-[10px] leading-relaxed text-slate-400"><Sparkles size={14} className="mt-0.5 shrink-0 text-cyan-300"/><span>You become <b className="text-slate-200">School Admin</b> and receive a unique code for securely inviting teachers.</span></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2"><Label className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">School name *</Label><div className="relative mt-1.5"><Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/><Input className="onboarding-input min-h-[52px] rounded-2xl pl-11" value={form.schoolName} onChange={event=>setForm({...form, schoolName:event.target.value})} placeholder="EduSphere Public School"/></div></div>
                  <div><Label className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">Principal / Admin</Label><div className="relative mt-1.5"><UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/><Input className="onboarding-input min-h-[50px] rounded-2xl pl-11" value={form.principal} onChange={event=>setForm({...form, principal:event.target.value})} placeholder="Full name"/></div></div>
                  <div><Label className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">School email</Label><div className="relative mt-1.5"><Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/><Input className="onboarding-input min-h-[50px] rounded-2xl pl-11" value={form.email} onChange={event=>setForm({...form, email:event.target.value})}/></div></div>
                  <div><Label className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">Phone</Label><div className="relative mt-1.5"><Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/><Input className="onboarding-input min-h-[50px] rounded-2xl pl-11" value={form.phone} onChange={event=>setForm({...form, phone:event.target.value})} placeholder="+91 ..."/></div></div>
                  <div className="md:col-span-2"><Label className="text-[9px] font-bold uppercase tracking-[.13em] text-slate-500">Address</Label><div className="relative mt-1.5"><MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/><Input className="onboarding-input min-h-[50px] rounded-2xl pl-11" value={form.address} onChange={event=>setForm({...form, address:event.target.value})} placeholder="City, State"/></div></div>
                </div>
                <Button variant="gradient" disabled={loading||!emailVerified} className="login-primary-button h-13 min-h-[52px] w-full rounded-full" onClick={createSchool}>{loading?'Creating secure workspace…':<>Create School <ArrowRight size={16} className="ml-2"/></>}</Button>
                <div className="text-center text-[9px] text-slate-600">A unique EDU-XXXXXX invite code is generated automatically.</div>
              </TabsContent>

              <TabsContent value="join" className="space-y-4">
                <div className="flex gap-2.5 rounded-2xl border border-violet-300/10 bg-violet-300/[.04] p-3 text-[10px] leading-relaxed text-slate-400"><KeyRound size={15} className="mt-0.5 shrink-0 text-violet-300"/><span>Enter the code shared by your school administrator. Parent access also requires your exact login email on the child profile.</span></div>
                <div>
                  <Label className="block text-center text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">I am joining as</Label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setJoinRole('teacher')} className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-[11px] font-bold transition ${joinRole==='teacher'?'border-cyan-300/25 bg-cyan-300/[.08] text-cyan-200':'border-white/[.06] bg-white/[.025] text-slate-500'}`}><UsersRound size={16}/> Teacher</button>
                    <button type="button" onClick={()=>setJoinRole('parent')} className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-[11px] font-bold transition ${joinRole==='parent'?'border-violet-300/25 bg-violet-300/[.08] text-violet-200':'border-white/[.06] bg-white/[.025] text-slate-500'}`}><UserRound size={16}/> Parent</button>
                  </div>
                </div>
                <div className="py-2"><Label className="block text-center text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">School invite code</Label><Input value={joinCode} onChange={event=>setJoinCode(event.target.value.toUpperCase())} placeholder="EDU-XXXXXX" className="onboarding-input mt-3 h-16 rounded-2xl text-center font-mono text-[19px] font-black uppercase tracking-[.18em]"/></div>
                {joinRole==='parent'&&<p className="rounded-xl border border-cyan-300/10 bg-cyan-300/[.04] p-2.5 text-center text-[9px] leading-relaxed text-cyan-100/70">Before joining, ask the admin to save <b>{user.email}</b> as Guardian Login Email on your child's profile.</p>}
                <Button variant="gradient" disabled={loading||!emailVerified} className="login-primary-button h-13 min-h-[52px] w-full rounded-full" onClick={joinSchool}>{loading?'Verifying invite…':<>Verify & Join as {joinRole==='parent'?'Parent':'Teacher'} <ArrowRight size={16} className="ml-2"/></>}</Button>
              </TabsContent>
              {!emailVerified&&<p className="mt-4 rounded-xl border border-rose-300/10 bg-rose-300/[.05] p-2.5 text-center text-[9px] text-rose-300">Email verification is required before school setup.</p>}
            </Tabs> : <div className="onboarding-success py-6 text-center"><div className="verified-pop mx-auto grid h-24 w-24 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/[.07] text-emerald-300 shadow-[0_0_45px_rgba(52,211,153,.12)]"><CheckCircle2 size={46}/></div><h2 className="mt-5 text-[22px] font-black text-emerald-300">Connection verified</h2><p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-slate-500">Your profile and school workspace are ready. You can now add classes, students and smart attendance.</p><Button variant="gradient" className="login-primary-button mt-6 h-12 rounded-full px-8" onClick={()=>navigate('/')}>Open Dashboard <ArrowRight size={16} className="ml-2"/></Button></div>}

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[.06] pt-4 text-[8px] uppercase tracking-[.12em] text-slate-700"><ShieldCheck size={11}/> Firebase secured • Role-based access</div>
          </div>
        </main>
      </div>
      </div>{/* /.login-inner */}
    </div>
  )
}
