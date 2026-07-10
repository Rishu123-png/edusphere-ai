import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { Mail, Lock, School, Shield, Eye, EyeOff, Fingerprint, ScanFace } from 'lucide-react'

export default function LoginPage() {
  const { login, loginGoogle, user, profile, resetPassword, signup, resendVerification } = useAuth() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const nav = useNavigate()
  const [sp] = useSearchParams()

  // Fixed: useEffect not useState
  useEffect(()=>{
    const sc = sp.get('schoolCode')
    if(sc) setSchoolCode(sc)
  }, [sp])

  if (user && profile?.schoolId) return <Navigate to="/" replace />
  if (user && !profile?.schoolId) return <Navigate to="/onboarding" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome to EduSphere AI')
      nav('/')
    } catch (err:any) {
      toast.error(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try{
      await signup(email, password, name)
      toast.success('Account created! Check email to verify – then create your school.')
      if(schoolCode){
        localStorage.setItem('pending_school_code', schoolCode)
        toast('Invite code saved – verify email, then join school.')
      }
      nav('/onboarding')
    }catch(err:any){ toast.error(err.message) }
    finally{ setLoading(false) }
  }

  const handleBiometric = () => {
    toast('Biometric available on Android build via Capacitor. Install APK for Face ID / Fingerprint.')
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:grid md:grid-cols-2 bg-[#0b0b14] md:bg-white">
      {/* Mobile Top / Desktop Left */}
      <div className="relative flex flex-col justify-end md:justify-center p-6 md:p-10 bg-gradient-to-br from-[#1e1b62] via-[#5b2cc6] to-[#b04cff] md:from-indigo-700 md:via-violet-700 md:to-fuchsia-600 text-white overflow-hidden min-h-[46vh] md:min-h-screen">
        {/* Blobs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-fuchsia-400/20 rounded-full blur-3xl" />
        
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="relative z-10">
          <div className="hidden md:flex w-20 h-20 rounded-[20px] bg-white/15 backdrop-blur-xl border border-white/20 items-center justify-center mb-8 shadow-xl">
            <School className="w-10 h-10" />
          </div>
          {/* 3D Icon for mobile */}
          <div className="md:hidden flex justify-center mb-4">
            <div className="w-24 h-24 rounded-[24px] bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl text-5xl">
              🏫
            </div>
          </div>
          <h1 className="text-[32px] md:text-[44px] font-extrabold tracking-tight leading-[0.9] text-center md:text-left">EduSphere AI</h1>
          <p className="text-white/80 text-[15px] md:text-[18px] mt-3 text-center md:text-left font-medium">Empowering Education.<br className="md:hidden"/> Anytime, Anywhere.</p>

          <div className="hidden md:block mt-8 space-y-3 text-[15px]">
            <div className="flex gap-3 items-center text-white/90"><Shield size={18}/> AI Marks Prediction & Risk Alert</div>
            <div className="flex gap-3 items-center text-white/90">✓ AI Camera + QR Attendance in 1 tap</div>
            <div className="flex gap-3 items-center text-white/90">✓ WhatsApp Alerts • PWA • Android APK</div>
            <div className="flex gap-3 items-center text-white/90">✓ Firebase RTDB Live • Offline Sync</div>
          </div>

          <div className="hidden md:flex mt-6 p-4 rounded-2xl bg-white/10 border border-white/15 text-[13px] leading-snug">
            New school? <b>Sign Up → Verify Email → Create School → Get Code → Invite Teachers</b>
          </div>
        </motion.div>
      </div>

      {/* Form side - Glass card on mobile overlapped */}
      <div className="flex-1 -mt-10 md:mt-0 relative z-20 flex items-start md:items-center justify-center p-4 md:p-8 bg-transparent md:bg-[#fcfcfc] dark:md:bg-zinc-950">
        <motion.div initial={{opacity:0, y:24}} animate={{opacity:1, y:0}} transition={{delay:0.2, type:'spring'}} className="w-full max-w-[420px] bg-white dark:bg-zinc-900 rounded-[32px] shadow-[0_20px_64px_rgba(0,0,0,0.25)] border border-white/20 md:border-slate-100 dark:md:border-zinc-800 p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-[22px] font-extrabold tracking-tight">Secure Access</h2>
            <p className="text-[13px] text-muted-foreground mt-1">Role-based • Verified Email Only • School Code Join</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-5 h-12 p-1 rounded-full bg-slate-100 dark:bg-zinc-800">
              <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900 data-[state=active]:shadow">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[13px]">Email</Label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-11 h-14 rounded-2xl" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@school.edu" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px]">Password</Label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-11 pr-11 h-14 rounded-2xl" type={showPass ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" />
                    <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px]">School Code (teacher invite - optional)</Label>
                  <Input className="h-12 rounded-2xl bg-slate-50 dark:bg-zinc-800" value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} placeholder="EDU-XXXXXX" />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button type="button" onClick={handleBiometric} className="h-[64px] rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 text-[12px] font-medium hover:bg-slate-100 transition">
                    <ScanFace size={22} className="text-indigo-500" /> Sign in with Face ID
                  </button>
                  <button type="button" onClick={handleBiometric} className="h-[64px] rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 text-[12px] font-medium hover:bg-slate-100 transition">
                    <Fingerprint size={22} className="text-fuchsia-500" /> Sign in with Touch ID
                  </button>
                </div>

                <Button disabled={loading} variant="gradient" size="lg" className="w-full h-14 rounded-full text-[16px]" type="submit">{loading ? 'Signing in…' : 'Sign In'}</Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                  <div className="relative flex justify-center"><span className="bg-white dark:bg-zinc-900 px-3 text-xs text-muted-foreground">OR</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full h-14 rounded-full" onClick={()=>loginGoogle().catch((e:any)=>toast.error(e.message))}>
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 mr-2" alt=""/>Continue with Google
                </Button>

                <div className="flex justify-between text-[13px] pt-1">
                  <button type="button" className="text-indigo-600 font-medium hover:underline" onClick={()=> {
                    if(!email) return toast.error('Enter email first')
                    resetPassword(email).then(()=>toast.success('Reset email sent')).catch((e:any)=>toast.error(e.message))
                  }}>Forgot password?</button>
                  <span className="text-muted-foreground">RBAC secure</span>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div><Label className="text-[13px]">Full Name</Label><Input className="h-14 rounded-2xl mt-1" value={name} onChange={e=>setName(e.target.value)} required placeholder="Rishu Kumar" /></div>
                <div><Label className="text-[13px]">Email *</Label><Input className="h-14 rounded-2xl mt-1" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                <div><Label className="text-[13px]">Password *</Label><Input className="h-14 rounded-2xl mt-1" type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="min 6 characters" /></div>
                <div><Label className="text-[13px]">School Invite Code (teachers only - optional)</Label><Input className="h-12 rounded-2xl mt-1 bg-slate-50 dark:bg-zinc-800" value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} placeholder="EDU-XXXXXX" />
                  <p className="text-[11px] text-muted-foreground mt-2 leading-snug">Leave blank if you’re creating a NEW school – you’ll become School Admin after email verification.</p>
                </div>
                <Button disabled={loading} variant="gradient" size="lg" className="w-full h-14 rounded-full" type="submit">{loading ? 'Creating…' : 'Create Account & Verify Email'}</Button>
                <p className="text-[11px] text-muted-foreground text-center leading-snug">By signing up you agree to verify your email. School Admin can create school after verification.</p>
              </form>
            </TabsContent>
          </Tabs>

          {user && !user.emailVerified && (
            <div className="mt-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[13px] flex items-center justify-between">
              <span>Email <b>{user.email}</b> not verified.</span>
              <Button size="sm" variant="outline" className="rounded-full ml-2 h-8" onClick={()=>resendVerification().then(()=>toast.success('Verification sent')).catch((e:any)=>toast.error(e.message))}>Resend</Button>
            </div>
          )}

          <div className="mt-6 text-[11px] text-muted-foreground space-y-1 border-t border-slate-100 dark:border-zinc-800 pt-4 leading-snug">
            <p className="font-bold text-zinc-900 dark:text-zinc-100">Demo roles:</p>
            <p>superadmin@edusphere.ai / admin123</p>
            <p>schooladmin@demo.edu / admin123 • teacher@demo.edu / teacher123</p>
          </div>
        </motion.div>
      </div>

      <div className="md:hidden text-center text-[11px] text-white/40 pb-6 pt-2">EduSphere AI © {new Date().getFullYear()} • PWA • Android</div>
    </div>
  )
}
