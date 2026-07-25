import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Moon, School, Bell, User, Palette, ShieldCheck, Mail, Phone, Sparkles, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { generateFeatureBrochure } from '@/lib/brochurePdf'

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

  // NOTE: EduSphere ships with a single deep-space dark theme (see ThemeContext).
  // The theme card is shown as "Dark (Deep Space)" with a friendly note, so users
  // don't expect a light toggle that would break the hard-coded glass surfaces.
  const activeThemeLabel = 'Deep-space Dark'

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="Settings" subtitle="Theme • School • Notifications • Account" />

    <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-cyan-500/15 text-white">
      <CardContent className="p-5 md:p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">
            <Palette size={13} /> Active theme
          </div>
          <h2 className="mt-3 text-[24px] font-black tracking-tight text-white">{activeThemeLabel}</h2>
          <p className="mt-1 text-[13px] text-white/70 max-w-xl">EduSphere uses a premium deep-space glass theme tuned for classrooms and low-light mobile use. Light mode is intentionally disabled so cards, charts and the AI mascot render consistently for every teacher, student and parent.</p>
        </div>
        <div className="grid h-11 place-items-center rounded-full border border-white/15 bg-white/5 px-5 text-[12px] font-semibold text-white/80 self-start md:self-auto">
          <Moon size={14} className="mr-2" /> Dark • Always
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Card className="rounded-[26px]">
        <CardTitle className="flex items-center gap-2"><Moon size={18}/> Theme</CardTitle>
        <CardContent className="space-y-4">
          <div className="rounded-[22px] border p-4 border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10">
            <div className="relative h-28 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#111827,#020617)]">
              <div className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow">
                <Moon size={16} />
              </div>
              <div className="absolute inset-x-3 bottom-3 space-y-2">
                <div className="h-2 rounded-full bg-white/15" />
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-8 rounded-xl bg-white/10" />
                  <div className="h-8 rounded-xl bg-white/12" />
                  <div className="h-8 rounded-xl bg-white/8" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-[14px] text-white">Deep-space Dark</div>
                <div className="text-[11px] text-white/50">Signature glass look • OLED-friendly • default</div>
              </div>
              <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200 border border-cyan-400/30">Active</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[12px] text-white/60">
            Light / System themes are hidden because every screen (Marks, Attendance, Dashboard, AI, Parent portal) is authored against the dark palette. Switching themes would cause white-on-white cards and unreadable charts. You still get smooth theme animations when the app boots and when the AI mascot reacts.
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
              toast.error(getFriendlyError(error) || 'Could not send password reset email')
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
          <Button variant="gradient" size="sm" className="mt-3 rounded-full"
            onClick={() => {
              try {
                const safeName = (school?.name || 'EduSphere-AI').replace(/[^\w\-]+/g, '_')
                generateFeatureBrochure(`${safeName}-EduSphere-Features.pdf`)
                toast.success('Feature brochure downloaded — share it with your principal!')
              } catch {
                toast.error('Could not generate PDF right now. Try again.')
              }
            }}>
            <FileDown size={14} className="mr-2" /> Download feature brochure (PDF)
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
}
