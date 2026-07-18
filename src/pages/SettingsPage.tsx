import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Moon, Sun, Monitor, School, Bell, User, Palette, ShieldCheck, Mail, Phone, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'

export default function SettingsPage(){
  const { theme, setTheme, resolvedTheme, toggle } = useTheme()
  const { profile, resetPassword } = useAuth()
  const { school } = useSchool()
  const [adminEmail, setAdminEmail] = useState<string>('')
  const [adminName, setAdminName] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const applyAdminContact = (email?: string, name?: string) => {
      if (cancelled) return
      if (email) setAdminEmail(prev => prev || email)
      if (name) setAdminName(prev => prev || name)
    }

    const loadAdmin = async () => {
      applyAdminContact(school?.email, school?.principal)

      if (school?.createdBy) {
        try {
          const snap = await get(ref(db, `users/${school.createdBy}`))
          if (snap.exists()) {
            const user = snap.val() as { email?: string; displayName?: string; name?: string }
            applyAdminContact(user.email, user.displayName || user.name)
          }
        } catch (error) {
          console.warn('Unable to load school creator profile', error)
        }
      }

      if (!school?.createdBy && profile?.role === 'school_admin') {
        applyAdminContact(profile.email, profile.displayName || profile.name)
      }
    }

    loadAdmin()
    return () => { cancelled = true }
  }, [school?.createdBy, school?.email, school?.principal, profile?.role, profile?.email, profile?.displayName, profile?.name])

  const roleLabel = profile?.role === 'school_admin' ? 'School Admin'
    : profile?.role === 'super_admin' ? 'Super Admin'
    : profile?.role === 'teacher' ? 'Teacher'
    : profile?.role === 'parent' ? 'Parent'
    : profile?.role === 'student' ? 'Student'
    : '—'

  const assigned = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses.join(', ') : ''
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects.join(', ') : ''

  const activeThemeLabel = useMemo(() => {
    if (theme === 'system') return `System (${resolvedTheme})`
    return resolvedTheme === 'dark' ? 'Dark' : 'Light'
  }, [theme, resolvedTheme])

  const themeCards = [
    {
      value: 'light' as const,
      label: 'Light',
      icon: Sun,
      preview: 'bg-[linear-gradient(180deg,#ffffff,#eef2ff)] border-slate-200 text-slate-700',
      accent: 'from-amber-400 to-orange-500',
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      icon: Moon,
      preview: 'bg-[linear-gradient(180deg,#111827,#020617)] border-zinc-700 text-white',
      accent: 'from-cyan-400 to-violet-500',
    },
    {
      value: 'system' as const,
      label: 'System',
      icon: Monitor,
      preview: 'bg-[linear-gradient(120deg,#ffffff_0%,#ffffff_48%,#0f172a_48%,#020617_100%)] border-slate-200 text-slate-700',
      accent: 'from-emerald-400 to-cyan-500',
    },
  ]

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="Settings" subtitle="Theme • School • Notifications • Account" />

    <Card className="overflow-hidden rounded-[28px] border border-cyan-200/60 dark:border-cyan-900/30 bg-gradient-to-br from-white to-cyan-50/70 dark:from-zinc-900 dark:to-cyan-950/10">
      <CardContent className="p-5 md:p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-cyan-700 dark:text-cyan-300">
            <Palette size={13} /> Active theme
          </div>
          <h2 className="mt-3 text-[24px] font-black tracking-tight">{activeThemeLabel}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground max-w-xl">The shell, cards, navigation and support surfaces now use smoother glass layers for both light and dark mode on mobile.</p>
        </div>
        <Button variant="gradient" size="sm" className="rounded-full h-11 px-5 self-start md:self-auto" onClick={toggle}>
          Switch to {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
        </Button>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Card className="rounded-[26px]">
        <CardTitle className="flex items-center gap-2"><Moon size={18}/> Theme</CardTitle>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {themeCards.map(card => {
              const Icon = card.icon
              const selected = theme === card.value
              return (
                <button
                  key={card.value}
                  onClick={() => setTheme(card.value)}
                  className={`rounded-[22px] border p-3 text-left transition-all active:scale-[0.98] ${selected ? 'border-indigo-500 shadow-[0_14px_34px_rgba(79,70,229,.18)]' : 'border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                >
                  <div className={`relative h-24 overflow-hidden rounded-2xl border ${card.preview}`}>
                    <div className={`absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow`}>
                      <Icon size={16} />
                    </div>
                    <div className="absolute inset-x-3 bottom-3 space-y-2">
                      <div className="h-2 rounded-full bg-white/80 dark:bg-white/10" />
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="h-8 rounded-xl bg-white/85 dark:bg-white/8" />
                        <div className="h-8 rounded-xl bg-white/70 dark:bg-white/12" />
                        <div className="h-8 rounded-xl bg-white/65 dark:bg-white/6" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[14px]">{card.label}</div>
                      <div className="text-[11px] text-muted-foreground">{card.value === 'system' ? 'Follow device preference' : `${card.label} interface`}</div>
                    </div>
                    {selected && <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Selected</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/70 p-3 text-[12px] text-muted-foreground">
            Smooth mode improvements applied: softer contrast in white mode, improved glass surfaces in dark mode, and better mobile-safe spacing for bottom navigation.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="rounded-[26px]">
          <CardTitle className="flex items-center gap-2"><School size={18}/> School</CardTitle>
          <CardContent className="space-y-3 text-[13px]">
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70 p-4">
              <p className="font-black text-[17px]">{school?.name || 'No school linked'}</p>
              <p className="mt-1 text-muted-foreground">Code: <b>{school?.code || '—'}</b>{school?.address ? ` • ${school.address}` : ''}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">School Admin</div>
                <div className="mt-1 font-semibold">{adminName || '—'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Admin Email</div>
                <div className="mt-1 font-semibold break-all">{adminEmail || school?.email || '—'}</div>
              </div>
            </div>
            <div className="text-[12px] text-muted-foreground">Your role: <b className="text-foreground">{roleLabel}</b> • Your login: <b className="text-foreground">{profile?.email || '—'}</b></div>
            {profile?.role === 'teacher' && (
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-800 p-3 text-[12px] space-y-1.5">
                <div>Assigned classes: <b>{assigned || 'Not set by admin yet'}</b></div>
                <div>Subjects: <b>{subjects || 'Not set by admin yet'}</b></div>
                {profile?.classTeacherOf && <div>Class teacher of: <b>{profile.classTeacherOf}</b></div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px]">
          <CardTitle className="flex items-center gap-2"><Bell size={18}/> Notifications</CardTitle>
          <CardContent className="space-y-3 text-[13px]">
            {[
              { title: 'Attendance reminders', icon: Bell, desc: 'Daily nudges for class attendance completion.' },
              { title: 'AI risk alerts', icon: ShieldCheck, desc: 'Warnings when attendance or marks trends need action.' },
              { title: 'Parent communication', icon: Mail, desc: 'Keep WhatsApp and guardian updates visible.' },
            ].map(item => {
              const Icon = item.icon
              return (
                <label key={item.title} className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70">
                  <input type="checkbox" defaultChecked className="mt-1 rounded"/>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold"><Icon size={15} className="text-indigo-500"/>{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                </label>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-[26px]">
        <CardTitle className="flex items-center gap-2"><User size={18}/> Account</CardTitle>
        <CardContent className="space-y-4 text-[13px]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-4 bg-slate-50/80 dark:bg-zinc-900/70">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow">{profile?.displayName?.[0] || profile?.email?.[0] || 'U'}</div>
            <div className="min-w-0">
              <div className="font-black text-[16px] truncate">{profile?.displayName || profile?.name || 'User'}</div>
              <div className="text-muted-foreground text-[12px] truncate">{profile?.email}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">{roleLabel}</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail size={13}/> Email</div>
              <div className="mt-1 break-all font-semibold">{profile?.email || '—'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone size={13}/> Phone</div>
              <div className="mt-1 font-semibold">{profile?.phone || '—'}</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="rounded-full w-full h-11" onClick={async()=>{
            if(!profile?.email) return toast.error('No email on account')
            try {
              await resetPassword(profile.email)
              toast.success('Password reset email sent')
            } catch(error) {
              toast.error(error instanceof Error ? error.message : 'Could not send password reset email')
            }
          }}>Send password reset email</Button>
        </CardContent>
      </Card>

      <Card className="rounded-[26px] overflow-hidden border border-indigo-200/70 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">
            <Sparkles size={13} /> Upgrade summary
          </div>
          <div>
            <h3 className="text-[22px] font-black tracking-tight">Mobile polish is active</h3>
            <p className="mt-2 text-[13px] text-white/85 leading-relaxed">Theme switching, glass surfaces, safer role-aware data access and cleaner contact cards are now tuned for small screens.</p>
          </div>
          <ul className="space-y-2 text-[12px] text-white/90">
            <li>• Better contrast in light mode and dark mode.</li>
            <li>• Theme toggle now stays visible on mobile top bar.</li>
            <li>• School admin contact no longer needs broad user-list reads.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
}
