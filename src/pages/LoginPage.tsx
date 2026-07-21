import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, Lock, Mail, ScanFace, School, ShieldCheck, Sparkles } from 'lucide-react'
import AmbientBackground from '@/components/mobile/AmbientBackground'

function GoogleMark() {
  return <span className="google-mark grid h-5 w-5 place-items-center rounded-full bg-white text-[12px] font-black">G</span>
}

export default function LoginPage() {
  const { login, loginGoogle, user, profile, resetPassword, signup, resendVerification } = useAuth() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const nav = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(()=>{
    const code = searchParams.get('schoolCode')
    if(code) setSchoolCode(code)
  }, [searchParams])

  if (user && profile?.schoolId) return <Navigate to="/" replace />
  if (user && !profile?.schoolId) return <Navigate to="/onboarding" replace />

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Login successful — welcome back!')
      nav('/')
    } catch (error:any) {
      toast.error(error?.message || 'Login failed. Please check your details and try again.')
    } finally { setLoading(false) }
  }

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try{
      await signup(email, password, name)
      toast.success('Account created! Verify your email to continue.')
      if(schoolCode){
        localStorage.setItem('pending_school_code', schoolCode)
        toast('Invite code saved — verify your email, then join the school.')
      }
      nav('/onboarding')
    } catch(error:any) {
      toast.error(getFriendlyError(error) || 'Could not create account')
    } finally { setLoading(false) }
  }

  const handleBiometric = () => {
    toast('Biometric access is available in the Android build through Capacitor.')
  }

  return (
    <div className="login-shell relative min-h-[100dvh] overflow-hidden bg-[#070a10] text-white md:grid md:grid-cols-[.9fr_1.1fr]">
      <AmbientBackground />

      <section className="login-brand-panel relative z-[1] flex min-h-[285px] flex-col justify-between overflow-hidden px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] md:min-h-screen md:justify-center md:px-12 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(34,211,238,.16),transparent_28%),radial-gradient(circle_at_70%_70%,rgba(124,58,237,.22),transparent_34%)]"/>
        <motion.div initial={{opacity:0, y:-12}} animate={{opacity:1, y:0}} className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="brand-orbit grid h-10 w-10 place-items-center rounded-xl"><Sparkles size={19}/></div>
            <div><div className="text-[16px] font-black tracking-tight">EduSphere <span className="text-gradient-ai">AI</span></div><div className="text-[8px] font-bold uppercase tracking-[.18em] text-slate-500">CBSE Smart Campus OS</div></div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[.06] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300"/> Secure</span>
        </motion.div>

        <motion.div initial={{opacity:0, y:18}} animate={{opacity:1, y:0}} transition={{delay:.08}} className="relative mt-8 text-center md:mt-0 md:text-left">
          <div className="login-neural-logo relative mx-auto grid h-[84px] w-[84px] place-items-center rounded-[25px] md:mx-0 md:h-24 md:w-24">
            <School size={34} className="relative z-10 text-cyan-100"/>
            <span className="absolute inset-[-8px] rounded-[30px] border border-cyan-300/10"/>
          </div>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300/70">Intelligence for every classroom</p>
          <h1 className="mx-auto mt-2 max-w-[420px] text-[31px] font-black leading-[.96] tracking-[-.05em] md:mx-0 md:text-[48px]">Your school.<br/><span className="text-gradient-ai">Smarter every day.</span></h1>
          <p className="mx-auto mt-3 max-w-[340px] text-[12px] leading-relaxed text-slate-400 md:mx-0 md:text-[14px]">Attendance, performance and parent communication—connected through one secure AI workspace.</p>

          <div className="mt-8 hidden max-w-[430px] grid-cols-2 gap-2.5 md:grid">
            {['Real-time attendance','AI marks prediction','Parent risk alerts','Role-based security'].map(item=><div key={item} className="flex items-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.025] p-3 text-[11px] text-slate-300"><CheckCircle2 size={14} className="text-emerald-300"/>{item}</div>)}
          </div>
        </motion.div>
      </section>

      <section className="relative z-[2] -mt-4 flex items-start justify-center px-4 pb-8 md:mt-0 md:min-h-screen md:items-center md:bg-[#090d14]/75 md:px-8">
        <motion.div initial={{opacity:0, y:22, scale:.985}} animate={{opacity:1, y:0, scale:1}} transition={{delay:.14, type:'spring', stiffness:170, damping:20}} className="login-card w-full max-w-[450px] rounded-[30px] p-5 md:p-8">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-cyan-300/75"><ShieldCheck size={12}/> Verified access</div><h2 className="mt-1.5 text-[23px] font-black tracking-[-.035em]">Welcome back</h2><p className="mt-1 text-[11px] text-slate-500">Sign in to continue to your school workspace.</p></div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet-300/10 bg-violet-400/[.06] text-violet-300"><Sparkles size={17}/></div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="login-tabs mb-5 grid h-12 w-full grid-cols-2 rounded-full border border-white/[.06] bg-white/[.035] p-1">
              <TabsTrigger value="login" className="rounded-full text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-violet-500/20 data-[state=active]:text-white data-[state=active]:shadow">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full text-[12px] data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-violet-500/20 data-[state=active]:text-white">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Email address</Label>
                  <div className="relative"><Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/><Input className="login-input h-13 min-h-[52px] rounded-2xl pl-11" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="admin@school.edu" /></div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between"><Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Password</Label><button type="button" className="text-[10px] font-semibold text-cyan-300/80" onClick={()=>{
                    if(!email) return toast.error('Enter your email first')
                    resetPassword(email).then(()=>toast.success('Reset email sent')).catch((error:any)=>toast.error(getFriendlyError(error) || 'Could not send reset email'))
                  }}>Forgot password?</button></div>
                  <div className="relative"><Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"/><Input className="login-input h-13 min-h-[52px] rounded-2xl pl-11 pr-11" type={showPass ? 'text' : 'password'} value={password} onChange={event=>setPassword(event.target.value)} required autoComplete="current-password" placeholder="••••••••"/><button aria-label={showPass?'Hide password':'Show password'} type="button" onClick={()=>setShowPass(value=>!value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{showPass?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">School invite code <span className="normal-case tracking-normal">(optional)</span></Label>
                  <Input className="login-input h-11 rounded-2xl font-mono uppercase tracking-wider" value={schoolCode} onChange={event=>setSchoolCode(event.target.value.toUpperCase())} placeholder="EDU-XXXXXX" />
                </div>

                <Button disabled={loading} variant="gradient" size="lg" className="login-primary-button mt-1 h-14 w-full rounded-full text-[14px]" type="submit">{loading?'Authenticating…':<>Secure Sign In <ArrowRight size={17} className="ml-2"/></>}</Button>

                <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-white/[.07]"/><span className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-600">or continue with</span><span className="h-px flex-1 bg-white/[.07]"/></div>
                <Button type="button" variant="outline" className="login-secondary-button h-12 w-full rounded-full border-white/[.08] bg-white/[.025] text-[12px] text-slate-200" onClick={()=>loginGoogle().catch((error:any)=>toast.error(getFriendlyError(error) || 'Google sign-in failed'))}><GoogleMark/> <span className="ml-2">Google Workspace</span></Button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button type="button" onClick={handleBiometric} className="biometric-button flex h-[58px] items-center justify-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.025] text-[10px] font-semibold text-slate-400"><ScanFace size={20} className="text-cyan-300"/> Face ID</button>
                  <button type="button" onClick={handleBiometric} className="biometric-button flex h-[58px] items-center justify-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.025] text-[10px] font-semibold text-slate-400"><Fingerprint size={20} className="text-violet-300"/> Touch ID</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div><Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Full name</Label><Input className="login-input mt-1.5 min-h-[52px] rounded-2xl" value={name} onChange={event=>setName(event.target.value)} required autoComplete="name" placeholder="Your full name"/></div>
                <div><Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Email address</Label><Input className="login-input mt-1.5 min-h-[52px] rounded-2xl" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@school.edu"/></div>
                <div><Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Password</Label><div className="relative mt-1.5"><Input className="login-input min-h-[52px] rounded-2xl pr-11" type={showPass?'text':'password'} value={password} onChange={event=>setPassword(event.target.value)} required minLength={6} autoComplete="new-password" placeholder="Minimum 6 characters"/><button aria-label={showPass?'Hide password':'Show password'} type="button" onClick={()=>setShowPass(value=>!value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{showPass?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
                <div><Label className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Teacher invite code <span className="normal-case tracking-normal">(optional)</span></Label><Input className="login-input mt-1.5 h-11 rounded-2xl font-mono uppercase tracking-wider" value={schoolCode} onChange={event=>setSchoolCode(event.target.value.toUpperCase())} placeholder="EDU-XXXXXX"/><p className="mt-2 text-[9px] leading-relaxed text-slate-600">Leave blank to create a new school after email verification.</p></div>
                <Button disabled={loading} variant="gradient" size="lg" className="login-primary-button h-14 w-full rounded-full text-[13px]" type="submit">{loading?'Creating secure account…':<>Create & Verify Account <ArrowRight size={16} className="ml-2"/></>}</Button>
                <p className="text-center text-[9px] leading-relaxed text-slate-600">Your email must be verified before any school data can be accessed.</p>
              </form>
            </TabsContent>
          </Tabs>

          {user && !user.emailVerified && <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-[10px] text-amber-200"><span>Email verification pending.</span><Button size="sm" variant="outline" className="h-8 rounded-full border-amber-300/15 bg-transparent" onClick={()=>resendVerification().then(()=>toast.success('Verification sent')).catch((error:any)=>toast.error(getFriendlyError(error) || 'Could not resend verification'))}>Resend</Button></div>}

          <div className="mt-5 flex items-center justify-center gap-2 border-t border-white/[.06] pt-4 text-[9px] text-slate-600"><ShieldCheck size={12} className="text-emerald-400/70"/> Encrypted • Role-based • Firebase secured</div>
        </motion.div>
      </section>

      <div className="relative z-[2] pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[8px] uppercase tracking-[.16em] text-slate-700 md:hidden">EduSphere AI © {new Date().getFullYear()}</div>
    </div>
  )
}
