import { Card, CardContent, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/mobile/PageHeader'
import { CalendarDays, PartyPopper } from 'lucide-react'

export default function CalendarPage(){
  const events = [
    {d:'2026-07-15', t:'Unit Test – Maths', type:'exam'},
    {d:'2026-07-22', t:'Parent-Teacher Meeting', type:'meeting'},
    {d:'2026-08-15', t:'Independence Day – Holiday', type:'holiday'},
    {d:'2026-09-05', t:'Teachers Day Event', type:'event'},
  ]
  return <div className="page-container space-y-4">
    <PageHeader title="Calendar" subtitle="Events • Holidays • Exams" />
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><CalendarDays size={18}/> School Calendar</CardTitle><CardContent>
        <ul className="text-[13px] space-y-3">{events.map(e=><li key={e.d} className="flex gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800"><span className={`px-2 py-1 rounded-full text-[10px] font-bold h-fit ${e.type==='holiday'?'bg-red-100 text-red-600': e.type==='exam'?'bg-amber-100 text-amber-700':'bg-indigo-100 text-indigo-700'}`}>{e.type}</span><span><b>{e.d}</b> – {e.t}</span></li>)}</ul>
        <p className="text-[11px] text-muted-foreground mt-3 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20">Holiday auto-disables schedule & notifications.</p>
      </CardContent></Card>
      <Card className="rounded-[24px]"><CardTitle className="flex items-center gap-2"><PartyPopper size={18}/> Upcoming</CardTitle><CardContent className="text-[13px] space-y-2.5">
        <div className="p-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"><div className="font-bold">Sports Day</div><div className="text-white/80 text-[12px]">Aug 28 • All classes</div></div>
        <p>🔬 Science Competition – Sep 12</p>
        <p>📝 Mid-Term Exams – Sep 20-30</p>
      </CardContent></Card>
    </div>
  </div>
}
