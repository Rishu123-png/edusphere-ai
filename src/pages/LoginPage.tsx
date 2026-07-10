import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useNavigate, Navigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function LoginPage() {
  const { login, loginGoogle, user, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  if (user) return <Navigate to="/" replace />

  const handle = async (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
        <div className="max-w-md space-y-5">
          <h1 className="text-4xl font-extrabold">EduSphere AI</h1>
          <p className="text-white/90 text-lg">Smart School Management & AI Attendance System</p>
          <ul className="text-sm space-y-2 text-white/80">
            <li>✓ AI Marks Prediction & Attendance Risk</li>
            <li>✓ AI Camera Attendance • QR • Manual</li>
            <li>✓ WhatsApp Parent Alerts – 1 Click</li>
            <li>✓ Multi-Role RBAC • PWA • Android</li>
            <li>✓ Real-time Firebase RTDB</li>
          </ul>
          <div className="text-xs text-white/70">React 19 • TypeScript • Firebase • Tailwind • shadcn/ui</div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardTitle>Secure Login</CardTitle>
          <CardContent>
            <form onSubmit={handle} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@school.edu" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              <div>
                <Label>School Code (optional join)</Label>
                <Input value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} placeholder="EDU-XXXXXX" />
                <p className="text-xs text-muted-foreground mt-1">Teachers: enter invite code sent by admin via Email/WhatsApp</p>
              </div>
              <Button disabled={loading} className="w-full" type="submit">{loading ? 'Signing in…' : 'Sign In'}</Button>
              <Button type="button" variant="outline" className="w-full" onClick={()=>loginGoogle().catch(e=>toast.error(e.message))}>
                Continue with Google
              </Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-primary" onClick={()=> {
                  if(!email) return toast.error('Enter email first')
                  resetPassword(email).then(()=>toast.success('Reset email sent')).catch(e=>toast.error(e.message))
                }}>Forgot password?</button>
                <span className="text-muted-foreground">RBAC secure</span>
              </div>
            </form>
            <div className="mt-6 text-xs text-muted-foreground space-y-1">
              <p>Demo roles:</p>
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
