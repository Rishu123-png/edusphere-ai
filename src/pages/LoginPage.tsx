
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
  return <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[12px] font-black text-gray-800">G</span>
}

export default function LoginPage() {
  const { login, loginGoogle, user, profile, loading: authLoading, resetPassword, signup, resendVerification, refreshProfile } = useAuth() as any
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

  if (user && !authLoading) {
    return <Navigate to={profile?.schoolId ? '/' : '/onboarding'} replace />
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      await refreshProfile?.().catch(() => {})
      toast.success('Login successful — welcome back!')
      nav('/')
    } catch (error:any) {
      toast.error('Login failed. ' + (getFriendlyError(error) || 'Please check your email and password.'))
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
    <div className="login-shell relative min-h-[100dvh] overflow-hidden text-white md:grid md:grid-cols-[.9fr_1.1fr]" style={{background: 'var(--brand-bg)'}}>
      <AmbientBackground />

      {/* ===== LEFT: Brand Panel ===== */}
      <section className="login-brand-panel relative z-[1] flex min-h-[285px] flex-col justify-between overflow-hidden px-6 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] md:min-h-screen md:justify-center md:px-12 lg:px-16">
        {/* Aurora gradient overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(circle at 40% 20%, rgba(34,211,238,0.12), transparent 30%), radial-gradient(circle at 70% 70%, rgba(124,58,237,0.18), transparent 35%)'
        }}/>

        {/* Header */}
        <motion.div initial={{opacity:0, y:-12}} animate={{opacity:1, y:0}} className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-orbit grid h-11 w-11 place-items-center rounded-2xl shadow-lg shadow-brand-primary/20">
              <Sparkles size={20}/>
            </div>
            <div>
              <div className="text-[17px] font-black tracking-tight">EduSphere <span className="text-gradient-ai">AI</span></div>
              <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/30">CBSE Smart Campus OS</div>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[8px] font-bold uppercase tracking-wider" style={{background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#22C55E'}}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-success"/> Secure
          </span>
        </motion.div>

        {/* Hero Content */}
        <motion.div initial={{opacity:0, y:18}} animate={{opacity:1, y:0}} transition={{delay:.08}} className="relative mt-8 text-center md:mt-0 md:text-left">
          <div className="login-neural-logo relative mx-auto grid h-[84px] w-[84px] place-items-center rounded-[25px] md:mx-0 md:h-24 md:w-24" style={{background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(34,211,238,0.15))'}}>
            <School size={34} className="relative z-10 text-white/80"/>
            <span className="absolute inset-[-8px] rounded-[30px]" style={{border: '1px solid rgba(79,70,229,0.15)'}}/>
          </div>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[.2em] text-brand-cyan/70">Intelligence for every classroom</p>
          <h1 className="mx-auto mt-2 max-w-[420px] text-[31px] font-black leading-[.96] tracking-[-.05em] md:mx-0 md:text-[48px]">
            Your school.<br/>
            <span className="text-gradient-primary">Smarter every day.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[340px] text-[12px] leading-relaxed text-white/50 md:mx-0 md:text-[14px]">
            Attendance, performance and parent communication—connected through one secure AI workspace.
          </p>

          <div className="mt-8 hidden max-w-[430px] grid-cols-2 gap-2.5 md:grid">
            {['Real-time attendance','AI marks prediction','Parent risk alerts','Role-based security'].map(item=>(
              <div key={item} className="flex items-center gap-2 rounded-2xl p-3.5 text-[11px] text-white/60" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'}}>
                <CheckCircle2 size={14} className="text-brand-success shrink-0"/>{item}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== RIGHT: Login Card ===== */}
      <section className="relative z-[2] -mt-4 flex items-start justify-center px-4 pb-8 md:mt-0 md:min-h-screen md:items-center">
        <motion.div
          initial={{opacity:0, y:22, scale:.985}}
          animate={{opacity:1, y:0, scale:1}}
          transition={{delay:.14, type:'spring', stiffness:170, damping:20}}
          className="login-card w-full max-w-[450px] rounded-[28px] p-6 md:p-8"
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-brand-cyan/70">
                <ShieldCheck size={12}/> Verified access
              </div>
              <h2 className="mt-1.5 text-[23px] font-black tracking-[-.035em] text-white">Welcome back</h2>
              <p className="mt-1 text-[11px] text-white/40">Sign in to continue to your school workspace.</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.12)'}}>
              <Sparkles size={17} style={{color: '#818cf8'}}/>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="login-tabs mb-6 grid h-12 w-full grid-cols-2 rounded-2xl p-1" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'}}>
              <TabsTrigger value="login" className="rounded-xl text-[12px] data-[state=active]:text-white data-[state=active]:shadow-lg" style={{}} >Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl text-[12px] data-[state=active]:text-white data-[state=active]:shadow-lg">Create Account</TabsTrigger>
            </TabsList>

            {/* ===== SIGN IN FORM ===== */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Email address</Label>
                  <div className="relative">
                    <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"/>
                    <Input className="login-input h-13 min-h-[52px] rounded-2xl pl-11" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="admin@school.edu" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Password</Label>
                    <button type="button" className="text-[10px] font-semibold text-brand-cyan/70 hover:text-brand-cyan transition-colors" onClick={()=>{
                      if(!email) return toast.error('Enter your email first')
                      resetPassword(email).then(()=>toast.success('Reset email sent')).catch((error:any)=>toast.error(getFriendlyError(error) || 'Could not send reset email'))
                    }}>Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"/>
                    <Input className="login-input h-13 min-h-[52px] rounded-2xl pl-11 pr-11" type={showPass ? 'text' : 'password'} value={password} onChange={event=>setPassword(event.target.value)} required autoComplete="current-password" placeholder="••••••••"/>
                    <button aria-label={showPass?'Hide password':'Show password'} type="button" onClick={()=>setShowPass(value=>!value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors">
                      {showPass?<EyeOff size={17}/>:<Eye size={17}/>}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">School invite code <span className="normal-case tracking-normal text-white/25">(optional)</span></Label>
                  <Input className="login-input h-11 rounded-2xl font-mono uppercase tracking-wider" value={schoolCode} onChange={event=>setSchoolCode(event.target.value.toUpperCase())} placeholder="EDU-XXXXXX" />
                </div>

                <Button disabled={loading} variant="gradient" size="lg" className="btn-gradient mt-1 h-14 w-full rounded-full text-[14px]" type="submit">
                  {loading?'Authenticating…':<>Secure Sign In <ArrowRight size={17} className="ml-2"/></>}
                </Button>

                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1" style={{background: 'rgba(255,255,255,0.06)'}}/>
                  <span className="text-[9px] font-bold uppercase tracking-[.14em] text-white/25">or continue with</span>
                  <span className="h-px flex-1" style={{background: 'rgba(255,255,255,0.06)'}}/>
                </div>
                <Button type="button" variant="outline" className="h-12 w-full rounded-full text-[12px] transition-all hover:border-brand-primary/30" style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)'}} onClick={()=>loginGoogle().catch((error:any)=>toast.error(getFriendlyError(error) || 'Google sign-in failed'))}>
                  <GoogleMark/> <span className="ml-2">Google Workspace</span>
                </Button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button type="button" onClick={handleBiometric} className="flex h-[58px] items-center justify-center gap-2 rounded-2xl text-[10px] font-semibold text-white/50 transition-all hover:border-brand-primary/20 hover:text-white/70" style={{background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <ScanFace size={20} style={{color: '#22D3EE'}}/> Face ID
                  </button>
                  <button type="button" onClick={handleBiometric} className="flex h-[58px] items-center justify-center gap-2 rounded-2xl text-[10px] font-semibold text-white/50 transition-all hover:border-brand-primary/20 hover:text-white/70" style={{background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)'}}>
                    <Fingerprint size={20} style={{color: '#A855F7'}}/> Touch ID
                  </button>
                </div>
              </form>
            </TabsContent>

            {/* ===== SIGNUP FORM ===== */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Full name</Label>
                  <Input className="login-input mt-1.5 min-h-[52px] rounded-2xl" value={name} onChange={event=>setName(event.target.value)} required autoComplete="name" placeholder="Your full name"/>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Email address</Label>
                  <Input className="login-input mt-1.5 min-h-[52px] rounded-2xl" type="email" value={email} onChange={event=>setEmail(event.target.value)} required autoComplete="email" placeholder="you@school.edu"/>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Password</Label>
                  <div className="relative mt-1.5">
                    <Input className="login-input min-h-[52px] rounded-2xl pr-11" type={showPass?'text':'password'} value={password} onChange={event=>setPassword(event.target.value)} required minLength={6} autoComplete="new-password" placeholder="Minimum 6 characters"/>
                    <button aria-label={showPass?'Hide password':'Show password'} type="button" onClick={()=>setShowPass(value=>!value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                      {showPass?<EyeOff size={17}/>:<Eye size={17}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40">Teacher invite code <span className="normal-case tracking-normal text-white/25">(optional)</span></Label>
                  <Input className="login-input mt-1.5 h-11 rounded-2xl font-mono uppercase tracking-wider" value={schoolCode} onChange={event=>setSchoolCode(event.target.value.toUpperCase())} placeholder="EDU-XXXXXX"/>
                  <p className="mt-2 text-[9px] leading-relaxed text-white/25">Leave blank to create a new school after email verification.</p>
                </div>
                <Button disabled={loading} variant="gradient" size="lg" className="btn-gradient h-14 w-full rounded-full text-[13px]" type="submit">
                  {loading?'Creating secure account…':<>Create & Verify Account <ArrowRight size={16} className="ml-2"/></>}
                </Button>
                <p className="text-center text-[9px] leading-relaxed text-white/25">Your email must be verified before any school data can be accessed.</p>
              </form>
            </TabsContent>
          </Tabs>

          {user && !user.emailVerified && (
            <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl p-3 text-[10px]" style={{background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: '#F59E0B'}}>
              <span>Email verification pending.</span>
              <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" style={{borderColor: 'rgba(245,158,11,0.2)', background: 'transparent'}} onClick={()=>resendVerification().then(()=>toast.success('Verification sent')).catch((error:any)=>toast.error(getFriendlyError(error) || 'Could not resend verification'))}>Resend</Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 pt-4 text-[9px] text-white/25" style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
            <ShieldCheck size={12} style={{color: 'rgba(34,197,94,0.6)'}}/> Encrypted • Role-based • Firebase secured
          </div>
        </motion.div>
      </section>

      <div className="relative z-[2] pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[8px] uppercase tracking-[.16em] text-white/20 md:hidden">
        EduSphere AI © {new Date().getFullYear()}
      </div>
    </div>
  )
}
