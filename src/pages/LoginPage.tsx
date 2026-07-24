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
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ScanFace, Fingerprint, Sparkles, CheckCircle2 } from 'lucide-react'

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

  useEffect(() => {
    const code = searchParams.get('schoolCode')
    if (code) setSchoolCode(code)
  }, [searchParams])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

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
    } catch (error: any) {
      toast.error('Login failed. ' + (getFriendlyError(error) || 'Please check your email and password.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await signup(email, password, name)
      toast.success('Account created! Verify your email to continue.')
      if (schoolCode) {
        localStorage.setItem('pending_school_code', schoolCode)
        toast('Invite code saved — verify your email, then join the school.')
      }
      nav('/onboarding')
    } catch (error: any) {
      toast.error(getFriendlyError(error) || 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometric = () => {
    toast('Biometric access is available in the Android build through Capacitor.')
  }

  return (
    <div
      className="login-shell relative flex min-h-[100dvh] w-full flex-col items-center text-white"
      style={{
        background:
          'radial-gradient(ellipse 80% 40% at 20% 10%, rgba(34,211,238,0.18), transparent 55%),' +
          'radial-gradient(ellipse 70% 40% at 85% 25%, rgba(168,85,247,0.22), transparent 55%),' +
          'radial-gradient(ellipse 90% 45% at 50% 100%, rgba(79,70,229,0.20), transparent 60%),' +
          '#03060f',
      }}
    >
      {/* Stars / particle field */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {Array.from({ length: 50 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: `${(i % 3) + 1}px`,
              height: `${(i % 3) + 1}px`,
              opacity: 0.15 + ((i % 5) / 20),
              animation: `star-twinkle ${3 + (i % 5)}s ease-in-out ${i * 0.2}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes star-twinkle {
          from { opacity: 0.1; transform: scale(0.9); }
          to { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes globe-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes globe-rotate-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes globe-pulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.03); }
        }
        @keyframes satellite-orbit {
          from { transform: rotate(0deg) translateX(92px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(92px) rotate(-360deg); }
        }
        @keyframes satellite-pulse {
          0%, 100% { opacity: 0.65; box-shadow: 0 0 14px 3px rgba(34,211,238,0.55), 0 0 28px 6px rgba(34,211,238,0.25); }
          50%      { opacity: 1;    box-shadow: 0 0 22px 5px rgba(34,211,238,0.85), 0 0 44px 10px rgba(34,211,238,0.45); }
        }
        /* The glowing globe with E inside — breathes gently */
        .neural-globe {
          position: relative;
          animation: globe-pulse 4s ease-in-out infinite;
        }
        /* The outer orbital ring rotates slowly like a planet ring */
        .neural-ring {
          position: absolute;
          inset: -18px;
          border-radius: 50%;
          border: 1.5px solid rgba(34,211,238,0.35);
          border-top-color: rgba(34,211,238,0.9);
          border-right-color: rgba(168,85,247,0.6);
          box-shadow: 0 0 22px rgba(34,211,238,0.25), inset 0 0 18px rgba(34,211,238,0.12);
          transform: rotateX(68deg);
          animation: globe-rotate 14s linear infinite;
          pointer-events: none;
        }
        .neural-ring-2 {
          position: absolute;
          inset: -30px;
          border-radius: 50%;
          border: 1px dashed rgba(168,85,247,0.28);
          transform: rotateX(68deg) rotateY(35deg);
          animation: globe-rotate-rev 24s linear infinite;
          pointer-events: none;
        }
        /* Inner sphere longitude/latitude lines spin slowly to feel like a globe */
        .neural-sphere-svg {
          animation: globe-rotate 32s linear infinite;
          transform-origin: center;
        }
        /* Single satellite dot that orbits the globe — Earth-like revolution */
        .neural-satellite {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 14px;
          height: 14px;
          margin: -7px 0 0 -7px;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 35%, #fff 0%, #a5f3fc 30%, #22D3EE 60%, rgba(34,211,238,0) 80%);
          animation: satellite-orbit 7s linear infinite, satellite-pulse 2.2s ease-in-out infinite;
          pointer-events: none;
          z-index: 3;
        }
        .neural-satellite::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(34,211,238,0.45), transparent 65%);
          filter: blur(2px);
        }
        /* Desktop-sized globe (smaller) uses a tighter orbit radius */
        .neural-globe.desktop .neural-satellite {
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          animation-name: satellite-orbit-sm, satellite-pulse;
          animation-duration: 8s, 2.2s;
          animation-timing-function: linear, ease-in-out;
          animation-iteration-count: infinite, infinite;
        }
        @keyframes satellite-orbit-sm {
          from { transform: rotate(0deg) translateX(68px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(68px) rotate(-360deg); }
        }
        .neural-globe.desktop .neural-ring { inset: -12px; }
        .neural-globe.desktop .neural-ring-2 { inset: -20px; }
      `}</style>

      <div className="login-inner relative z-10 w-full px-0">

      {/* ====== MOBILE / SHARED: Brand (top) ====== */}
      <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-col items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:hidden">
        {/* Neural globe with E inside + orbiting satellite */}
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18 }}
          className="neural-globe relative mt-8 grid h-[180px] w-[180px] place-items-center"
        >
          {/* Outer aurora halo behind the globe */}
          <div
            className="absolute inset-[-28px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(34,211,238,0.25), rgba(79,70,229,0.12) 45%, transparent 70%)',
              filter: 'blur(16px)',
            }}
          />
          {/* Orbital rings */}
          <span className="neural-ring" aria-hidden="true" />
          <span className="neural-ring-2" aria-hidden="true" />
          {/* Orbiting satellite dot */}
          <span className="neural-satellite" aria-hidden="true" />
          {/* The planet itself */}
          <div
            className="relative h-[116px] w-[116px] rounded-full overflow-hidden"
            style={{
              background:
                'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.22) 0%, rgba(34,211,238,0.45) 18%, rgba(79,70,229,0.55) 55%, rgba(12,18,40,1) 100%)',
              boxShadow:
                'inset -14px -18px 38px rgba(0,0,0,0.65), inset 8px 10px 22px rgba(165,243,252,0.18), 0 0 50px rgba(34,211,238,0.28), 0 0 90px rgba(79,70,229,0.25)',
            }}
          >
            {/* Longitude/latitude grid that slowly rotates inside the globe */}
            <svg viewBox="0 0 120 120" className="neural-sphere-svg absolute inset-0 h-full w-full">
              <defs>
                <clipPath id="globeClip">
                  <circle cx="60" cy="60" r="58" />
                </clipPath>
              </defs>
              <g clipPath="url(#globeClip)" opacity="0.75">
                {[0, 30, 60, 90, 120, 150].map(a => (
                  <ellipse key={`lo${a}`} cx="60" cy="60" rx={58 * Math.abs(Math.cos((a * Math.PI) / 180)) || 3} ry="58" fill="none" stroke="rgba(165,243,252,0.45)" strokeWidth="0.7" />
                ))}
                {[15, 30, 45].map(ry => (
                  <ellipse key={`la${ry}`} cx="60" cy="60" rx="58" ry={ry * 58 / 45} fill="none" stroke="rgba(168,85,247,0.40)" strokeWidth="0.6" />
                ))}
                {/* Sparkle nodes */}
                {[
                  [38, 42], [62, 30], [86, 48], [92, 66], [80, 86], [58, 92], [36, 84], [26, 64],
                  [52, 54], [70, 56], [68, 78], [48, 80], [60, 62],
                ].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="1.6" fill="#e0f7ff" />
                ))}
              </g>
              {/* Highlight sheen */}
              <ellipse cx="48" cy="40" rx="22" ry="14" fill="rgba(255,255,255,0.12)" />
            </svg>
            {/* The E — center of the planet */}
            <span className="absolute inset-0 grid place-items-center">
              <span className="text-[52px] font-black leading-none text-white" style={{ textShadow: '0 0 18px rgba(34,211,238,0.85), 0 0 38px rgba(79,70,229,0.55)' }}>E</span>
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-center text-[36px] font-black leading-none tracking-tight"
        >
          <span className="bg-gradient-to-r from-[#4F46E5] via-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
            EduSphere AI
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-2 text-center text-[16px] font-semibold"
        >
          <span className="bg-gradient-to-r from-[#22D3EE] to-[#A855F7] bg-clip-text text-transparent">
            Your school Smarter every day
          </span>
        </motion.p>

        {/* Horizon glow under title */}
        <div className="mt-3 h-[44px] w-full max-w-[320px]">
          <div
            className="mx-auto h-[2px] w-[70%] rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(34,211,238,0.8), rgba(79,70,229,0.3) 40%, transparent 70%)',
              boxShadow: '0 0 22px rgba(34,211,238,0.55)',
            }}
          />
          <div
            className="mx-auto mt-[-1px] h-[36px] w-[92%] rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(34,211,238,0.35), rgba(79,70,229,0.12) 40%, transparent 70%)',
              filter: 'blur(6px)',
            }}
          />
        </div>
      </div>

      {/* ====== DESKTOP SPLIT: Hidden on mobile ====== */}
      <div className="relative z-10 hidden w-full flex-1 min-h-0 items-stretch md:grid md:grid-cols-[.9fr_1.1fr] md:gap-8 md:px-10 md:py-10 lg:px-16">
        <section className="flex min-h-0 flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="brand-orbit grid h-12 w-12 place-items-center rounded-2xl shadow-lg shadow-brand-primary/20">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-[19px] font-black tracking-tight">
                  EduSphere <span className="text-gradient-ai">AI</span>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[.2em] text-white/30">CBSE Smart Campus OS</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#22C55E]"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" /> Secure
            </span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-10">
            <div className="neural-globe desktop relative mx-auto grid h-[140px] w-[140px] place-items-center">
              {/* halo */}
              <div className="absolute inset-[-24px] rounded-full" style={{
                background: 'radial-gradient(circle, rgba(34,211,238,0.22), rgba(79,70,229,0.12) 45%, transparent 70%)',
                filter: 'blur(14px)',
              }} />
              <span className="neural-ring" aria-hidden="true" />
              <span className="neural-ring-2" aria-hidden="true" />
              <span className="neural-satellite" aria-hidden="true" />
              <div
                className="relative h-[90px] w-[90px] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.22) 0%, rgba(34,211,238,0.45) 18%, rgba(79,70,229,0.55) 55%, rgba(12,18,40,1) 100%)',
                  boxShadow:
                    'inset -10px -14px 28px rgba(0,0,0,0.65), inset 6px 8px 16px rgba(165,243,252,0.18), 0 0 36px rgba(34,211,238,0.28), 0 0 64px rgba(79,70,229,0.22)',
                }}
              >
                <span className="absolute inset-0 grid place-items-center">
                  <span className="text-[40px] font-black leading-none text-white" style={{ textShadow: '0 0 14px rgba(34,211,238,0.85), 0 0 28px rgba(79,70,229,0.5)' }}>E</span>
                </span>
              </div>
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[.22em] text-[#22D3EE]/80">Intelligence for every classroom</p>
            <h1 className="mt-2 max-w-[480px] text-[52px] font-black leading-[0.96] tracking-[-.05em]">
              Your school.<br />
              <span className="text-gradient-primary">Smarter every day.</span>
            </h1>
            <p className="mt-4 max-w-[400px] text-[14px] leading-relaxed text-white/55">
              Attendance, performance and parent communication — connected through one secure AI workspace.
            </p>
            <div className="mt-8 grid max-w-[480px] grid-cols-2 gap-3">
              {['Real-time attendance', 'AI marks prediction', 'Parent risk alerts', 'Role-based security'].map(item => (
                <div key={item} className="flex items-center gap-2 rounded-2xl p-3.5 text-[12px] text-white/65"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <CheckCircle2 size={15} className="text-[#22C55E] shrink-0" />{item}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="flex min-h-0 items-center justify-center">
          <LoginCard
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            name={name} setName={setName}
            schoolCode={schoolCode} setSchoolCode={setSchoolCode}
            showPass={showPass} setShowPass={setShowPass}
            loading={loading} handleLogin={handleLogin} handleSignup={handleSignup}
            handleBiometric={handleBiometric} loginGoogle={loginGoogle}
            user={user} resetPassword={resetPassword} resendVerification={resendVerification}
          />
        </section>
      </div>

      {/* ====== MOBILE CARD ====== */}
      <div className="relative z-10 flex w-full max-w-[480px] flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <LoginCard
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          name={name} setName={setName}
          schoolCode={schoolCode} setSchoolCode={setSchoolCode}
          showPass={showPass} setShowPass={setShowPass}
          loading={loading} handleLogin={handleLogin} handleSignup={handleSignup}
          handleBiometric={handleBiometric} loginGoogle={loginGoogle}
          user={user} resetPassword={resetPassword} resendVerification={resendVerification}
          mobile
        />
      </div>

      {/* Bottom shield + horizon */}
      <div className="relative z-0 mt-2 flex h-[60px] w-full items-end justify-center pb-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-white/25">
          <ShieldCheck size={14} style={{ color: 'rgba(34,197,94,0.6)' }} />
          Encrypted • Role-based • Firebase secured
        </div>
      </div>
      </div>{/* /.login-inner */}
    </div>
  )
}

interface LoginCardProps {
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  name: string; setName: (v: string) => void
  schoolCode: string; setSchoolCode: (v: string) => void
  showPass: boolean; setShowPass: (v: boolean) => void
  loading: boolean
  handleLogin: (e: React.FormEvent) => void
  handleSignup: (e: React.FormEvent) => void
  handleBiometric: () => void
  loginGoogle: () => Promise<any>
  user: any
  resetPassword: (email: string) => Promise<any>
  resendVerification: () => Promise<any>
  mobile?: boolean
}


function LoginCard(p: LoginCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.14, type: 'spring', stiffness: 170, damping: 20 }}
      className="login-card w-full p-6 md:p-8 mb-4"
      style={{
        border: '1px solid rgba(129,140,248,0.25)',
        background: 'linear-gradient(180deg, rgba(20,28,58,0.78), rgba(8,12,30,0.78))',
        boxShadow: '0 30px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px rgba(34,211,238,0.08)',
        backdropFilter: 'blur(26px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(26px) saturate(1.3)',
        borderRadius: 28,
      }}
    >
      {/* Secure & Verified badge */}
      <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#22D3EE]"
        style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)' }}>
        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(79,70,229,0.2))' }}>
          <ShieldCheck size={14} className="text-[#22D3EE]" />
        </span>
        Secure & Verified
      </div>

      <Tabs defaultValue="login" className="w-full">
        <TabsList className="mb-5 grid h-11 w-full grid-cols-2 rounded-2xl p-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <TabsTrigger value="login" className="rounded-xl text-[13px] font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#22D3EE] data-[state=active]:text-white data-[state=active]:shadow-lg">
            Login
          </TabsTrigger>
          <TabsTrigger value="signup" className="rounded-xl text-[13px] font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#A855F7] data-[state=active]:text-white data-[state=active]:shadow-lg">
            Sign up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={p.handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Email address</Label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <Input
                  className="h-14 rounded-2xl border-white/10 bg-white/5 pl-11 text-[15px] placeholder:text-white/30 focus:border-cyan-400/40"
                  type="email"
                  value={p.email}
                  onChange={e => p.setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="student@edusphere.ai"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Password</Label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <Input
                  className="h-14 rounded-2xl border-white/10 bg-white/5 pl-11 pr-12 text-[15px] placeholder:text-white/30 focus:border-cyan-400/40"
                  type={p.showPass ? 'text' : 'password'}
                  value={p.password}
                  onChange={e => p.setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••••••"
                />
                <button
                  aria-label={p.showPass ? 'Hide password' : 'Show password'}
                  type="button"
                  onClick={() => p.setShowPass(!p.showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                >
                  {p.showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                className="text-[13px] font-medium text-white/50 hover:text-[#22D3EE] transition-colors"
                onClick={() => {
                  if (!p.email) return toast.error('Enter your email first')
                  p.resetPassword(p.email)
                    .then(() => toast.success('Reset email sent'))
                    .catch((error: any) => toast.error(getFriendlyError(error) || 'Could not send reset email'))
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={p.loading}
              className="relative mt-2 flex h-14 w-full items-center justify-center rounded-2xl text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #2563EB 0%, #4F46E5 40%, #22D3EE 100%)',
                boxShadow: '0 10px 28px rgba(37,99,235,0.35), 0 6px 20px rgba(34,211,238,0.25)',
              }}
            >
              {p.loading ? 'Authenticating…' : 'Login'}
            </button>

            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[12px] font-semibold text-white/40">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => p.loginGoogle().catch((error: any) => toast.error(getFriendlyError(error) || 'Google sign-in failed'))}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-[15px] font-semibold text-white/80 transition-all hover:border-[#4F46E5]/40 hover:bg-white/5 active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(129,140,248,0.35)' }}
            >
              <GoogleMark />
              <span>Login with Google</span>
            </button>

            <button
              type="button"
              onClick={p.handleBiometric}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-[15px] font-semibold text-white/85 transition-all hover:border-[#22D3EE]/40 hover:bg-white/5 active:scale-[0.98]"
              style={{ border: '1px solid rgba(34,211,238,0.35)' }}
            >
              <span className="relative grid h-7 w-7 place-items-center text-[#22D3EE]">
                <ScanFace size={24} />
              </span>
              <span>Login with Face ID</span>
            </button>

            <div className="hidden items-center justify-center gap-3 pt-1 md:flex">
              <button type="button" onClick={p.handleBiometric} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[12px] font-semibold text-white/55 hover:text-white/80"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <ScanFace size={18} className="text-[#22D3EE]" /> Face ID
              </button>
              <button type="button" onClick={p.handleBiometric} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[12px] font-semibold text-white/55 hover:text-white/80"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Fingerprint size={18} className="text-[#A855F7]" /> Touch ID
              </button>
            </div>

            <div className="pt-3 text-center text-[14px] text-white/50">
              Don't have an account?{' '}
              <button type="button" onClick={() => {
                const tabsList = document.querySelector('[role="tablist"]');
                (tabsList?.querySelector('[value="signup"]') as HTMLElement)?.click();
              }} className="font-bold text-[#22D3EE] hover:underline">Sign up</button>
            </div>
          </form>
        </TabsContent>
<TabsContent value="signup">
          <form onSubmit={p.handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Full name</Label>
              <Input
                className="h-14 rounded-2xl border-white/10 bg-white/5 text-[15px] placeholder:text-white/30 focus:border-cyan-400/40"
                value={p.name}
                onChange={e => p.setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Email address</Label>
              <Input
                className="h-14 rounded-2xl border-white/10 bg-white/5 text-[15px] placeholder:text-white/30 focus:border-cyan-400/40"
                type="email"
                value={p.email}
                onChange={e => p.setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@school.edu"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Password</Label>
              <div className="relative">
                <Input
                  className="h-14 rounded-2xl border-white/10 bg-white/5 pr-12 text-[15px] placeholder:text-white/30 focus:border-cyan-400/40"
                  type={p.showPass ? 'text' : 'password'}
                  value={p.password}
                  onChange={e => p.setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  aria-label={p.showPass ? 'Hide password' : 'Show password'}
                  onClick={() => p.setShowPass(!p.showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50"
                >
                  {p.showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-white/70">Teacher invite code <span className="text-white/40 font-normal">(optional)</span></Label>
              <Input
                className="h-12 rounded-2xl border-white/10 bg-white/5 font-mono uppercase tracking-wider text-[14px] placeholder:text-white/30"
                value={p.schoolCode}
                onChange={e => p.setSchoolCode(e.target.value.toUpperCase())}
                placeholder="EDU-XXXXXX"
              />
            </div>
            <button
              type="submit"
              disabled={p.loading}
              className="relative mt-2 flex h-14 w-full items-center justify-center rounded-2xl text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #4F46E5 0%, #A855F7 100%)',
                boxShadow: '0 10px 28px rgba(168,85,247,0.35)',
              }}
            >
              {p.loading ? 'Creating secure account…' : 'Create & Verify Account'}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-white/40">
              Your email must be verified before any school data can be accessed.
            </p>
          </form>
        </TabsContent>
      </Tabs>

      {p.user && !p.user.emailVerified && (
        <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl p-3 text-[11px]"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
          <span>Email verification pending.</span>
          <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'transparent' }}
            onClick={() => p.resendVerification().then(() => toast.success('Verification sent')).catch((error: any) => toast.error(getFriendlyError(error) || 'Could not resend verification'))}>
            Resend
          </Button>
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 pt-4 text-[10px] text-white/30"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <ShieldCheck size={12} style={{ color: 'rgba(34,197,94,0.7)' }} />
        Encrypted • Role-based • Firebase secured
      </div>
    </motion.div>
  )
}
