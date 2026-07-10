import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/mobile/PageHeader'

export default function ParentPortalPage(){
  return <div className="page-container space-y-4">
    <PageHeader title="Parent Portal 👨‍👩‍👧" subtitle="Child progress • Attendance • Homework" />
    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px]"><CardTitle>Attendance</CardTitle><CardContent className="text-[24px] font-extrabold">88.4%<div className="text-[12px] font-normal text-muted-foreground mt-1">7 absents this term</div></CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Marks</CardTitle><CardContent>Latest: Maths 82/100 – A</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Homework</CardTitle><CardContent className="text-[13px]">Algebra Ex 5.3 – due tomorrow</CardContent></Card>
      <Card className="rounded-[20px] bg-zinc-900 text-white border-0"><CardTitle className="text-white">AI Progress</CardTitle><CardContent className="text-[13px] text-zinc-300">Improving +5%. Focus: Algebra 30min/day.</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Leave</CardTitle><CardContent><Button variant="gradient" size="sm" className="rounded-full w-full">Apply Leave</Button></CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>Message Teacher</CardTitle><CardContent><Button size="sm" variant="outline" className="rounded-full w-full">Open Chat</Button></CardContent></Card>
    </div>
  </div>
}
