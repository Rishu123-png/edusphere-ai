import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { Bell, AlertTriangle, FileWarning, Users } from 'lucide-react'

const notifs = [
  {t:'Attendance Reminder', b:'10-A Maths attendance window closing in 2 min', type:'teacher', icon: Bell, color: 'bg-blue-500'},
  {t:'High-Risk Student Alert', b:'Rohan K. attendance 68% – parent contact: +91 98xxx', type:'ai', icon: AlertTriangle, color: 'bg-red-500'},
  {t:'Marks Pending', b:'Science UT-2 – 4 students pending', type:'teacher', icon: FileWarning, color: 'bg-amber-500'},
  {t:'Parent Meeting Reminder', b:'6 meetings scheduled today 3-5 PM', type:'admin', icon: Users, color: 'bg-violet-500'},
]

export default function NotificationsPage(){
  return <div className="page-container space-y-4">
    <PageHeader title="Notifications" subtitle="Smart alerts • AI warnings • Auto WhatsApp" />
    <div className="grid gap-3">
      {notifs.map((n,i)=>(
        <Card key={i} className="rounded-[20px]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${n.color} flex items-center justify-center text-white shrink-0`}><n.icon size={18}/></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14px]">{n.t}</div>
              <div className="text-[12px] text-muted-foreground leading-snug">{n.b}</div>
            </div>
            <Button size="sm" variant="outline" className="rounded-full h-8 text-[12px]" onClick={()=>toast('Actioned')}>Action</Button>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card className="rounded-[20px] bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border-violet-100 dark:border-violet-900/30"><CardTitle>Auto Rule</CardTitle><CardContent className="text-[13px] text-muted-foreground">Students Below 75% → auto include parent contact + WhatsApp CTA + Daily sync</CardContent></Card>
  </div>
}
