import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ParentPortalPage(){
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Parent Portal 👨‍👩‍👧</h1>
    <div className="grid md:grid-cols-3 gap-4">
      <Card><CardTitle>Attendance</CardTitle><CardContent>88.4% • 7 absents this term</CardContent></Card>
      <Card><CardTitle>Marks</CardTitle><CardContent>Latest: Maths 82/100 – A</CardContent></Card>
      <Card><CardTitle>Homework</CardTitle><CardContent>Algebra Ex 5.3 – due tomorrow</CardContent></Card>
      <Card><CardTitle>AI Progress Summary</CardTitle><CardContent className="text-sm">Improving trend +5%. Focus: Algebra.</CardContent></Card>
      <Card><CardTitle>Leave Request</CardTitle><CardContent><Button size="sm">Apply Leave</Button></CardContent></Card>
      <Card><CardTitle>Teacher Communication</CardTitle><CardContent><Button size="sm" variant="outline">Message Teacher</Button></CardContent></Card>
    </div>
  </div>
}
