import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import PageHeader from '@/components/mobile/PageHeader'
import { Moon, Sun, School, Bell, User, Palette, ShieldCheck, Mail, Phone, Sparkles, FileDown, IdCard, Award, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { db } from '@/lib/firebase'
import { ref, get, onValue } from 'firebase/database'
import { generateFeatureBrochure } from '@/lib/brochurePdf'
import { generateStudentIdCardsPdf } from '@/lib/idCardPdf'
import { generateMeritListPdf } from '@/lib/meritListPdf'

type StudentRow = { id:string; name?:string; rollNumber?:string|number; admissionNumber?:string|number; className?:string; section?:string; dob?:string; dateOfBirth?:string; guardianName?:string; guardianPhone?:string; bloodGroup?:string; blood?:string; marks?:Record<string,any> }

export default function SettingsPage(){
  const { theme, setTheme } = useTheme()
  const { profile, resetPassword } = useAuth()
  const { school, schoolId } = useSchool()
  const [adminEmail, setAdminEmail] = useState<string>('')
  const [adminName, setAdminName] = useState<string>('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [idClassSel, setIdClassSel] = useState<string>('')

  const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'
  const isTeacher = profile?.role === 'teacher' || isAdmin

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

  // Load students for ID cards / merit list buttons
  useEffect(() => {
    if (!schoolId || !isTeacher) return
    const unsub = onValue(ref(db,`schools/${schoolId}/students`), snap => {
      const v = snap.val() || {}
      const arr = Object.entries(v).map(([id,s]:any) => ({ id, ...s }))
      setStudents(arr)
      if (!idClassSel && arr.length) {
        const firstClass = [...new Set(arr.map((s:any)=>`${s.className||''}${s.section?'-'+s.section:''}`))].sort()[0]
        if (firstClass) setIdClassSel(firstClass)
      }
    })
    return () => unsub()
  }, [schoolId, isTeacher])

  const classOptions = useMemo(() => {
    const set = new Set<string>()
    students.forEach(s => { const k=`${s.className||''}${s.section?'-'+s.section:''}`; if (k) set.add(k) })
    return [...set].sort()
  }, [students])

  const roleLabel = profile?.role === 'school_admin' ? 'School Admin'
    : profile?.role === 'super_admin' ? 'Super Admin'
    : profile?.role === 'teacher' ? 'Teacher'
    : profile?.role === 'parent' ? 'Parent'
    : profile?.role === 'student' ? 'Student'
    : '—'

  const assigned = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses.join(', ') : ''
  const subjects = Array.isArray(profile?.subjects) ? profile.subjects.join(', ') : ''

  const downloadIdCards = () => {
    const filtered = idClassSel
      ? students.filter(s => `${s.className||''}${s.section?'-'+s.section:''}` === idClassSel)
      : students
    if (!filtered.length) { toast.error('No students to print.'); return }
    try {
      generateStudentIdCardsPdf(filtered.map(s => ({
        name: s.name || 'Student',
        rollNumber: s.rollNumber,
        admissionNumber: s.admissionNumber != null ? String(s.admissionNumber) : undefined,
        className: s.className, section: s.section,
        dob: s.dob || s.dateOfBirth,
        guardianName: s.guardianName, guardianPhone: s.guardianPhone,
        bloodGroup: s.bloodGroup || s.blood,
      })), school?.name || 'EduSphere AI', `${(school?.name||'School').replace(/[^\w\-]+/g,'_')}-ID-cards-${idClassSel||'all'}.pdf`)
      toast.success(`ID cards PDF for ${filtered.length} student(s) downloaded.`)
    } catch(e){ console.error(e); toast.error('Could not generate ID cards PDF.') }
  }

  const downloadMeritList = () => {
    // Build merit from whatever marks we can load; for simplicity, take per-student best average percentage
    loadAllMarks().then(marksTree => {
      const rows:{rank:number;name:string;rollNumber?:string|number;className?:string;section?:string;total:number;maxTotal:number}[]=[]
      students.forEach(s => {
        const entries = Object.values(marksTree[s.id] || {}) as any[]
        const valid = entries.filter(m => m && !m.status && typeof m.marksObtained==='number')
        if (!valid.length) return
        const total = valid.reduce((a,m)=>a+m.marksObtained,0)
        const max = valid.reduce((a,m)=>a+(m.maxMarks||100),0)
        rows.push({ rank:0, name:s.name||'Student', rollNumber:s.rollNumber, className:s.className, section:s.section, total:Math.round(total), maxTotal:Math.round(max) })
      })
      rows.sort((a,b) => (b.total/b.maxTotal) - (a.total/a.maxTotal))
      rows.forEach((r,i)=>r.rank=i+1)
      if (!rows.length) { toast.error('No published marks found yet.'); return }
      try {
        generateMeritListPdf(rows.slice(0,50), school?.name||'EduSphere AI', 'Top Performers - Overall Merit', `${(school?.name||'School').replace(/[^\w\-]+/g,'_')}-Merit-list.pdf`)
        toast.success('Merit list PDF downloaded.')
      } catch(e){ console.error(e); toast.error('Could not generate merit list.') }
    }).catch(()=>toast.error('Could not load marks data.'))
  }

  async function loadAllMarks(): Promise<Record<string,Record<string,any>>> {
    if (!schoolId) return {}
    const snap = await get(ref(db,`schools/${schoolId}/marks`))
    return (snap.val() || {}) as Record<string,Record<string,any>>
  }

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="Settings" subtitle="Theme • School • Notifications • Account" />

    <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-cyan-500/15 text-white">
      <CardContent className="p-5 md:p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">
            <Palette size={13} /> Choose theme
          </div>
          <h2 className="mt-3 text-[24px] font-black tracking-tight text-white">
            {theme === 'light' ? 'High-contrast Light' : 'Deep-space Dark'}
          </h2>
          <p className="mt-1 text-[13px] text-white/70 max-w-xl">Pick the theme that matches where you work. Deep-space Dark is the signature glass look for classrooms; Light mode is a clean high-contrast paper-white theme perfect for long grading hours.</p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          <button onClick={()=>setTheme('dark')}
            className={`rounded-full px-4 h-11 text-[12px] font-bold flex items-center gap-1.5 border ${theme==='dark'?'bg-cyan-400 text-slate-950 border-cyan-300':'bg-white/5 text-white/80 border-white/15'}`}>
            <Moon size={14}/> Dark
          </button>
          <button onClick={()=>setTheme('light')}
            className={`rounded-full px-4 h-11 text-[12px] font-bold flex items-center gap-1.5 border ${theme==='light'?'bg-amber-300 text-slate-900 border-amber-200':'bg-white/5 text-white/80 border-white/15'}`}>
            <Sun size={14}/> Light
          </button>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
      <Card className="rounded-[26px]">
        <CardTitle className="flex items-center gap-2"><Palette size={18}/> Appearance</CardTitle>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={()=>setTheme('dark')}
              className={`rounded-[22px] border p-3 text-left transition ${theme==='dark'?'border-cyan-400/40 bg-cyan-400/10':'border-white/10 bg-white/[0.03]'}`}>
              <div className="relative h-28 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,#111827,#020617)]">
                <div className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow">
                  <Moon size={14} />
                </div>
                <div className="absolute inset-x-3 bottom-3 space-y-1.5">
                  <div className="h-2 rounded-full bg-white/15" />
                  <div className="grid grid-cols-3 gap-1">
                    <div className="h-7 rounded-lg bg-white/10" />
                    <div className="h-7 rounded-lg bg-white/12" />
                    <div className="h-7 rounded-lg bg-white/8" />
                  </div>
                </div>
              </div>
              <div className="mt-2 font-bold text-[13px] text-white">Deep-space Dark</div>
              <div className="text-[11px] text-white/50">Signature glass look • OLED-friendly • default</div>
            </button>
            <button onClick={()=>setTheme('light')}
              className={`rounded-[22px] border p-3 text-left transition ${theme==='light'?'border-amber-400/50 bg-amber-400/10':'border-white/10 bg-white/[0.03]'}`}>
              <div className="relative h-28 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow">
                  <Sun size={14} />
                </div>
                <div className="absolute inset-x-3 bottom-3 space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-200" />
                  <div className="grid grid-cols-3 gap-1">
                    <div className="h-7 rounded-lg bg-slate-100" />
                    <div className="h-7 rounded-lg bg-slate-100" />
                    <div className="h-7 rounded-lg bg-slate-100" />
                  </div>
                </div>
              </div>
              <div className="mt-2 font-bold text-[13px] text-white">High-contrast Light</div>
              <div className="text-[11px] text-white/50">Paper-white • easy on eyes during long grading</div>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="rounded-[26px]">
          <CardTitle className="flex items-center gap-2"><School size={18}/> School</CardTitle>
          <CardContent className="space-y-3 text-[13px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-black text-[17px] text-white">{school?.name || 'No school linked'}</p>
              <p className="mt-1 text-white/60">Code: <b className="text-white/80">{school?.code || '—'}</b>{school?.address ? ` • ${school.address}` : ''}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">School Admin</div>
                <div className="mt-1 font-semibold text-white">{adminName || '—'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">Admin Email</div>
                <div className="mt-1 font-semibold text-white break-all">{adminEmail || school?.email || '—'}</div>
              </div>
            </div>
            <div className="text-[12px] text-white/60">Your role: <b className="text-white">{roleLabel}</b> • Login: <b className="text-white">{profile?.email || '—'}</b></div>
            {profile?.role === 'teacher' && (
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-[12px] space-y-1.5 text-white/80">
                <div>Assigned classes: <b className="text-white">{assigned || 'Not set by admin yet'}</b></div>
                <div>Subjects: <b className="text-white">{subjects || 'Not set by admin yet'}</b></div>
                {profile?.classTeacherOf && <div>Class teacher of: <b className="text-white">{profile.classTeacherOf}</b></div>}
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
                <label key={item.title} className="flex items-start gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
                  <input type="checkbox" defaultChecked className="mt-1 rounded accent-indigo-500"/>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-semibold text-white"><Icon size={15} className="text-indigo-400"/>{item.title}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{item.desc}</div>
                  </div>
                </label>
              )
            })}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[11px] text-white/50">
              Lock-screen push notifications for parents/teachers are coming next. In-app alerts and WhatsApp already work.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-[26px]">
        <CardTitle className="flex items-center gap-2"><User size={18}/> Account</CardTitle>
        <CardContent className="space-y-4 text-[13px]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow">{profile?.displayName?.[0] || profile?.email?.[0] || 'U'}</div>
            <div className="min-w-0">
              <div className="font-black text-[16px] text-white truncate">{profile?.displayName || profile?.name || 'User'}</div>
              <div className="text-white/50 text-[12px] truncate">{profile?.email}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-300">{roleLabel}</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Mail size={13}/> Email</div>
              <div className="mt-1 break-all font-semibold text-white">{profile?.email || '—'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Phone size={13}/> Phone</div>
              <div className="mt-1 font-semibold text-white">{profile?.phone || '—'}</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="rounded-full w-full h-11 border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={async()=>{
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

      <Card className="rounded-[26px] overflow-hidden border border-indigo-500/25 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg">
        <CardContent className="p-5 md:p-6 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">
            <Sparkles size={13} /> Downloads
          </div>
          <div>
            <h3 className="text-[22px] font-black tracking-tight">Share, print, launch</h3>
            <p className="mt-2 text-[13px] text-white/85 leading-relaxed">One-tap PDFs you can hand directly to your principal, parents, or the school office.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="gradient" size="sm" className="rounded-full justify-start"
              onClick={() => {
                try {
                  const safeName = (school?.name || 'EduSphere-AI').replace(/[^\w\-]+/g, '_')
                  generateFeatureBrochure(`${safeName}-EduSphere-Features.pdf`)
                  toast.success('Feature brochure downloaded — share it with your principal!')
                } catch { toast.error('Could not generate PDF right now.') }
              }}>
              <FileDown size={14} className="mr-2" /> Download feature brochure (PDF)
            </Button>
            {isTeacher && (
              <>
                <div className="flex items-center gap-2">
                  <select value={idClassSel} onChange={e=>setIdClassSel(e.target.value)}
                    className="flex-1 h-10 rounded-full bg-white/15 border border-white/20 dark:bg-white/15 bg-slate-100 text-slate-900 dark:text-white px-3 text-[12px] outline-none">
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="">All classes</option>
                  </select>
                  <Button size="sm" variant="outline" className="rounded-full h-10 bg-white/10 border-white/20 text-white" onClick={downloadIdCards}>
                    <IdCard size={14} className="mr-1"/> ID cards
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="rounded-full justify-start bg-white/10 border-white/20 text-white" onClick={downloadMeritList}>
                  <Award size={14} className="mr-2" /> Download overall merit list
                </Button>
              </>
            )}
          </div>
          <div className="text-[11px] text-white/60">Crafted by Rishu Jaswar • v2.2</div>
        </CardContent>
      </Card>
    </div>
  </div>
}
