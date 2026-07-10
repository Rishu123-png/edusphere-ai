import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const notifs = [
  {t:'Attendance Reminder', b:'10-A Maths attendance window closing in 2 min', type:'teacher'},
  {t:'High-Risk Student Alert', b:'Rohan K. attendance 68% – parent contact: +91 98xxx', type:'ai'},
  {t:'Marks Pending', b:'Science UT-2 – 4 students pending', type:'teacher'},
  {t:'Parent Meeting Reminder', b:'6 meetings scheduled today 3-5 PM', type:'admin'},
]

export default function NotificationsPage(){
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Smart Notifications</h1>
    <div className="grid gap-3">
      {notifs.map((n,i)=>(
        <Card key={i}>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{n.t}</div>
              <div className="text-sm text-muted-foreground">{n.b}</div>
            </div>
            <Button size="sm" variant="outline" onClick={()=>toast('Notification actioned')}>Action</Button>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card><CardTitle>Auto WhatsApp Rule</CardTitle><CardContent className="text-sm text-muted-foreground">Students Below 75% Attendance → auto include parent contact + WhatsApp CTA</CardContent></Card>
  </div>
}
