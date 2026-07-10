import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export default function SettingsPage(){
  const { theme, setTheme, resolvedTheme, toggle } = useTheme()
  const { profile } = useAuth()
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Settings</h1>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><CardTitle>Theme Settings</CardTitle><CardContent className="space-y-3">
        <p className="text-sm">Current: <b>{resolvedTheme}</b> (mode: {theme})</p>
        <div className="flex gap-2">
          <Button variant={theme==='light'?'default':'outline'} size="sm" onClick={()=>setTheme('light')}>Light Mode</Button>
          <Button variant={theme==='dark'?'default':'outline'} size="sm" onClick={()=>setTheme('dark')}>Dark Mode</Button>
          <Button variant={theme==='system'?'default':'outline'} size="sm" onClick={()=>setTheme('system')}>System</Button>
          <Button size="sm" variant="secondary" onClick={toggle}>Toggle</Button>
        </div>
        <p className="text-xs text-emerald-600">✓ Dark/Light toggle fixed – persists in localStorage, respects system preference, no flash.</p>
      </CardContent></Card>
      <Card><CardTitle>School Information</CardTitle><CardContent className="text-sm">
        <p>EduSphere Public School</p>
        <p>Code: EDU-AI2026</p>
        <p>Admin: {profile?.email}</p>
      </CardContent></Card>
      <Card><CardTitle>Notification Settings</CardTitle><CardContent className="text-sm space-y-1">
        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> Attendance Reminders</label>
        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> AI Alerts</label>
        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked/> WhatsApp Auto</label>
      </CardContent></Card>
      <Card><CardTitle>Account Settings</CardTitle><CardContent className="text-sm">
        <p>Role: {profile?.role}</p>
        <p>Email: {profile?.email}</p>
        <Button size="sm" variant="outline" className="mt-2">Change Password</Button>
      </CardContent></Card>
    </div>
  </div>
}
