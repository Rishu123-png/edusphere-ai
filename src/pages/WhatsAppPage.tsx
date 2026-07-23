
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect, useMemo, useState } from 'react'
import { whatsappUrl } from '@/lib/utils'
import PageHeader from '@/components/mobile/PageHeader'
import { MessageCircle, Send, Sparkles, Copy, ExternalLink, Wand2 } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { todayIST } from '@/lib/rtdb'
import { toast } from 'sonner'

export default function WhatsAppPage(){
  const { school, schoolId } = useSchool()
  const [students, setStudents] = useState<any[]>([])
  const [attendanceToday, setAttendanceToday] = useState<Record<string, any>>({})
  const [template, setTemplate] = useState('Dear Parent, your ward {name} ({class}) was marked {reason} today ({date}). Please ensure regular attendance. - {school}')

  useEffect(()=>{
    if(!schoolId){ setStudents([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/students`), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id,s]:any)=>({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setAttendanceToday({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance/${todayIST()}`), snap=>{
      setAttendanceToday(snap.val() || {})
    })
    return ()=>unsub()
  }, [schoolId])

  const schoolName = school?.name || 'School'
  const todayLabel = new Date().toLocaleDateString('en-IN')

  const resetTemplate = () => {
    setTemplate(`Dear Parent, your ward {name} ({class}) was marked {reason} today (${todayLabel}). Please ensure regular attendance. - ${schoolName}`)
    toast.success('Template auto-filled with your school name & date')
  }

  const absentees = useMemo(()=>{
    const studentMap = new Map(students.map(s=>[s.id, s]))
    return Object.values(attendanceToday)
      .filter((r:any)=> r.status === 'absent' || r.status === 'late')
      .map((r:any)=>{
        const s = studentMap.get(r.studentId)
        return {
          id: r.studentId,
          name: s?.name || 'Student',
          class: s ? `${s.className}-${s.section}` : '—',
          parent: s?.guardianPhone || '',
          reason: r.status === 'late' ? 'Late' : 'Absent',
        }
      })
      .filter((a:any)=> a.parent)
  }, [attendanceToday, students])

  const buildMessage = (a:any) => template
    .replace(/\{name\}/g, a.name)
    .replace(/\{class\}/g, a.class)
    .replace(/\{reason\}/g, a.reason)
    .replace(/\{date\}/g, todayLabel)
    .replace(/\{school\}/g, schoolName)

  const copyAll = async () => {
    if (!absentees.length) return toast.error('No absentees with phone numbers yet')
    const text = absentees.map(a => `${buildMessage(a)}\n${whatsappUrl(a.parent, buildMessage(a))}`).join('\n\n')
    try { await navigator.clipboard.writeText(text); toast.success(`Copied ${absentees.length} WhatsApp links`) }
    catch { toast.error('Could not copy to clipboard') }
  }

  const openAll = () => {
    if (!absentees.length) return toast.error('No absentees with phone numbers yet')
    absentees.forEach((a, i) => {
      window.setTimeout(() => {
        const w = window.open(whatsappUrl(a.parent, buildMessage(a)), '_blank', 'noopener,noreferrer')
        if (!w) toast.error('Pop-up blocked — allow pop-ups to open all chats')
      }, i * 450)
    })
    toast.success(`Opening ${absentees.length} parent chats…`)
  }

  return <div className="page-container space-y-4 pb-12">
    <PageHeader title="WhatsApp" subtitle="Automatic parent alerts from today's real attendance" action={
      <Button variant="outline" size="sm" className="rounded-full h-10" onClick={resetTemplate}><Wand2 size={15} className="mr-1"/> Auto-setup</Button>
    } />

    <Card className="rounded-[24px]">
      <CardTitle className="flex items-center gap-2"><MessageCircle size={18}/> Attendance Alert Template</CardTitle>
      <CardContent className="space-y-3">
        <Input value={template} onChange={e=>setTemplate(e.target.value)} className="h-14 rounded-xl text-[13px] leading-snug" />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Variables: {'{name} {class} {reason} {date} {school}'}</p>
          <Button variant="ghost" size="sm" className="rounded-full h-8 text-[11px]" onClick={resetTemplate}><Sparkles size={13} className="mr-1"/> Reset</Button>
        </div>
      </CardContent>
    </Card>

    <div className="flex flex-wrap gap-2">
      <Button variant="gradient" className="rounded-full flex-1" onClick={openAll} disabled={!absentees.length}>
        <ExternalLink size={15} className="mr-1.5"/> Open All Absentee Chats ({absentees.length})
      </Button>
      <Button variant="outline" className="rounded-full" onClick={copyAll} disabled={!absentees.length}>
        <Copy size={15} className="mr-1.5"/> Copy All
      </Button>
    </div>

    {absentees.length > 0 && (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[12px] text-emerald-700 dark:text-emerald-300">
        {absentees.length} parent(s) will be notified automatically. For fully automated sending (no manual open),
        deploy the <b>sendWhatsAppAlert</b> Cloud Function with your WhatsApp Business API credentials.
      </div>
    )}

    <div className="grid md:grid-cols-2 gap-3">
      {absentees.map(a=>{
        const msg = buildMessage(a)
        return <Card key={a.id} className="rounded-[20px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[14px]">{a.name} • {a.class}</div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{a.reason}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{a.parent}</div>
            <div className="text-[12px] bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-3 leading-snug">{msg}</div>
            <div className="flex gap-2 mt-3">
              <a href={whatsappUrl(a.parent, msg)} target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="success" className="w-full rounded-full"><Send size={14} className="mr-1"/> WhatsApp</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      })}
      {!absentees.length && (
        <Card className="col-span-full p-10 text-center text-muted-foreground rounded-[20px]">
          No absent/late students with guardian phone numbers for today. Mark attendance first, and ensure students have Guardian Phone saved.
        </Card>
      )}
    </div>
  </div>
}
