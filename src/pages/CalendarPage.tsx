import { Card, CardContent, CardTitle } from '@/components/ui/card'

export default function CalendarPage(){
  const events = [
    {d:'2026-07-15', t:'Unit Test – Maths'},
    {d:'2026-07-22', t:'Parent-Teacher Meeting'},
    {d:'2026-08-15', t:'Independence Day – Holiday'},
    {d:'2026-09-05', t:'Teachers Day Event'},
  ]
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Events & Calendar</h1>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><CardTitle>School Calendar</CardTitle><CardContent>
        <ul className="text-sm space-y-2">{events.map(e=><li key={e.d}><b>{e.d}</b> – {e.t}</li>)}</ul>
        <p className="text-xs text-muted-foreground mt-3">Holiday auto-disables schedule & notifications.</p>
      </CardContent></Card>
      <Card><CardTitle>Upcoming</CardTitle><CardContent className="text-sm space-y-1">
        <p>Sports Day – Aug 28</p>
        <p>Science Competition – Sep 12</p>
        <p>Mid-Term Exams – Sep 20-30</p>
      </CardContent></Card>
    </div>
  </div>
}
