import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function LoginPage() {
  const { login, loginGoogle, user, profile, resetPassword, signup, resendVerification } = useAuth() as any
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const [sp] = useSearchParams()

  // prefill invite code from URL
  useState(()=>{
    const sc = sp.get('schoolCode')
    if(sc) setSchoolCode(sc)
  })

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
      // if schoolCode provided (teacher invite), store pending join
      if(schoolCode){
        localStorage.setItem('pending_school_code', schoolCode)
        toast('Invite code saved – verify email, then join school.')
      }
      nav('/onboarding')
    }catch(err:any){ toast.error(err.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
        <div className="max-w-md space-y-5">
          <h1 className="text-4xl font-extrabold tracking-tight">EduSphere AI</h1>
          <p className="text-white/90 text-lg">Smart School Management & AI Attendance System</p>
          <ul className="text-sm space-y-2 text-white/90">
            <li>✓ AI Marks Prediction & Attendance Risk</li>
            <li>✓ AI Camera Attendance • QR • Manual</li>
            <li>✓ WhatsApp Parent Alerts – 1 Click</li>
            <li>✓ Multi-Role RBAC • PWA • Android</li>
            <li>✓ Real-time Firebase RTDB</li>
          </ul>
          <div className="text-xs text-white/80 bg-white/10 rounded-xl p-3">
            New school? <b>Sign Up → Verify Email → Create School → Get School Code → Invite Teachers</b>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
          <CardTitle>Secure Access</CardTitle>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@school.edu" /></div>
                  <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" /></div>
                  <div><Label>School Code (teacher invite – optional)</Label><Input value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} placeholder="EDU-XXXXXX" /></div>
                  <Button disabled={loading} className="w-full" type="submit">{loading ? 'Signing in…' : 'Sign In'}</Button>
                  <Button type="button" variant="outline" className="w-full" onClick={()=>loginGoogle().catch((e:any)=>toast.error(e.message))}>Continue with Google</Button>
                  <div className="flex justify-between text-sm">
                    <button type="button" className="text-primary hover:underline" onClick={()=> {
                      if(!email) return toast.error('Enter email first')
                      resetPassword(email).then(()=>toast.success('Reset email sent')).catch((e:any)=>toast.error(e.message))
                    }}>Forgot password?</button>
                    <span className="text-muted-foreground">RBAC secure</span>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div><Label>Full Name</Label><Input value={name} onChange={e=>setName(e.target.value)} required placeholder="Rishu Kumar" /></div>
                  <div><Label>Email *</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                  <div><Label>Password *</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="min 6 characters" /></div>
                  <div><Label>School Invite Code (teachers only – optional)</Label><Input value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} placeholder="EDU-XXXXXX" />
                    <p className="text-xs text-muted-foreground mt-1">Leave blank if you’re creating a NEW school – you’ll become School Admin after email verification.</p>
                  </div>
                  <Button disabled={loading} className="w-full" type="submit">{loading ? 'Creating…' : 'Create Account & Verify Email'}</Button>
                  <p className="text-xs text-muted-foreground text-center">By signing up you agree to verify your email. School Admin can create school after verification.</p>
                </form>
              </TabsContent>
            </Tabs>

            {user && !user.emailVerified && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm">
                Email <b>{user.email}</b> not verified.
                <Button size="sm" variant="outline" className="ml-2" onClick={()=>resendVerification().then(()=>toast.success('Verification sent')).catch((e:any)=>toast.error(e.message))}>Resend</Button>
              </div>
            )}

            <div className="mt-6 text-xs text-muted-foreground space-y-1 border-t pt-4">
              <p className="font-medium">Demo roles:</p>
              <p>superadmin@edusphere.ai / admin123</p>
              <p>schooladmin@demo.edu / admin123</p>
              <p>teacher@demo.edu / teacher123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
