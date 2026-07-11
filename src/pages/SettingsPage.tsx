import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Moon, Sun, Monitor, School, Bell, User } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'

export default function SettingsPage(){
  const { theme, setTheme, resolvedTheme, toggle } = useTheme()
  const { profile, resetPassword } = useAuth() as any
  const { school } = useSchool()
  const [adminEmail, setAdminEmail] = useState<string>('')
  const [adminName, setAdminName] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const loadAdmin = async () => {
      // Prefer school contact email, then creator profile email
      if (school?.email) {
        if (!cancelled) {
          setAdminEmail(school.email)
          setAdminName(school.principal || 'School Admin')
        }
      }
      if (school?.createdBy) {
        try {
          const snap = await get(ref(db, `users/${school.createdBy}`))
          if (snap.exists() && !cancelled) {
            const u = snap.val()
            setAdminEmail(prev => prev || u.email || '')
            setAdminName(prev => prev || u.displayName || u.name || 'School Admin')
          }
        } catch {}
      }
      // Fallback: first school_admin in same school
      if (school?.id || profile?.schoolId) {
        try {
          const snap = await get(ref(db, 'users'))
          if (!snap.exists() || cancelled) return
          const users = snap.val() || {}
          const admin = Object.values(users).find((u: any) =>
            u?.role === 'school_admin' && u?.schoolId === (school?.id || profile?.schoolId)
          ) as any
          if (admin && !cancelled) {
            setAdminEmail(prev => prev || admin.email || '')
            setAdminName(prev => prev || admin.displayName || admin.name || 'School Admin')
          }
        } catch {}
      }
    }
    loadAdmin()
    return () => { cancelled = true }
  }, [school, profile?.schoolId])

  const roleLabel = profile?.role === 'school_admin' ? 'School Admin'
    : profile?.role === 'super_admin' ? 'Super Admin'
    : profile?.role === 'teacher' ? 'Teacher'
    : profile?.role || '—'

  const assigned = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses.join(', ') : ''
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects.join(', ') : ''

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
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><School size={18}/> School</CardTitle><CardContent className="text-[13px] space-y-2">
        <p className="font-bold text-[16px]">{school?.name || 'No school linked'}</p>
        <p>Code: {school?.code || '—'}{school?.address ? ` • ${school.address}` : ''}</p>
        <p>School Admin: <b>{adminName || '—'}</b></p>
        <p>Admin Email: <b>{adminEmail || school?.email || '—'}</b></p>
        <p className="text-muted-foreground text-[12px]">Your role: {roleLabel} • Your login: {profile?.email || '—'}</p>
        {profile?.role === 'teacher' && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 text-[12px] space-y-1">
            <div>Assigned classes: <b>{assigned || 'Not set by admin yet'}</b></div>
            <div>Subjects: <b>{subjects || 'Not set by admin yet'}</b></div>
            {profile?.classTeacherOf && <div>Class teacher of: <b>{profile.classTeacherOf}</b></div>}
          </div>
        )}
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><Bell size={18}/> Notifications</CardTitle><CardContent className="text-[13px] space-y-3">
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> Attendance Reminders</label>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> AI Risk Alerts</label>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800"><input type="checkbox" defaultChecked className="rounded"/> WhatsApp Auto</label>
      </CardContent></Card>

      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><User size={18}/> Account</CardTitle><CardContent className="text-[13px] space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold">{profile?.displayName?.[0]||'U'}</div>
          <div>
            <div className="font-bold">{profile?.displayName || 'User'}</div>
            <div className="text-muted-foreground text-[12px]">{profile?.email}</div>
            <div className="text-[11px] text-indigo-600 font-medium mt-0.5">{roleLabel}</div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full w-full mt-2" onClick={async()=>{
          if(!profile?.email) return toast.error('No email on account')
          try {
            await resetPassword(profile.email)
            toast.success('Password reset email sent')
          } catch(e:any){ toast.error(e.message) }
        }}>Change Password</Button>
      </CardContent></Card>
    </div>
  </div>
}
