import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Moon, Sun, Monitor, School, Bell, User } from 'lucide-react'

export default function SettingsPage(){
  const { theme, setTheme, resolvedTheme, toggle } = useTheme()
  const { profile } = useAuth()
  return <div className="page-container space-y-4">
    <PageHeader title="Settings" subtitle="Theme • School • Notifications • Account" />
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><Moon size={18}/> Theme</CardTitle><CardContent className="space-y-4">
        <p className="text-[13px]">Current: <b>{resolvedTheme}</b> (mode: {theme})</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={()=>setTheme('light')} className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 ${theme==='light'?'border-zinc-900 dark:border-white bg-slate-50 dark:bg-zinc-800':'border-slate-100 dark:border-zinc-800'}`}><Sun size={20}/> <span className="text-[12px] font-medium">Light</span></button>
          <button onClick={()=>setTheme('dark')} className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 ${theme==='dark'?'border-zinc-900 dark:border-white bg-zinc-900 text-white':'border-slate-100 dark:border-zinc-800'}`}><Moon size={20}/> <span className="text-[12px] font-medium">Dark</span></button>
          <button onClick={()=>setTheme('system')} className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 ${theme==='system'?'border-zinc-900 dark:border-white':'border-slate-100 dark:border-zinc-800'}`}><Monitor size={20}/> <span className="text-[12px] font-medium">System</span></button>
        </div>
        <Button variant="outline" size="sm" className="rounded-full w-full" onClick={toggle}>Toggle {resolvedTheme==='dark'?'to Light':'to Dark'}</Button>
        <p className="text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-xl">✓ Fixed – persists in localStorage, no flash, safe for Capacitor</p>
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><School size={18}/> School</CardTitle><CardContent className="text-[13px] space-y-2">
        <p className="font-bold text-[16px]">EduSphere Public School</p>
        <p>Code: EDU-AI2026 • Affiliation: CBSE</p>
        <p>Admin: {profile?.email}</p>
        <p>Role: {profile?.role}</p>
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><Bell size={18}/> Notifications</CardTitle><CardContent className="text-[13px] space-y-3">
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> Attendance Reminders</label>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> AI Risk Alerts</label>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> WhatsApp Auto</label>
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><User size={18}/> Account</CardTitle><CardContent className="text-[13px] space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold">{profile?.displayName?.[0]||'U'}</div>
          <div><div className="font-bold">{profile?.displayName}</div><div className="text-muted-foreground text-[12px]">{profile?.email}</div></div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full w-full mt-2">Change Password</Button>
      </CardContent></Card>
    </div>
  </div>
}
