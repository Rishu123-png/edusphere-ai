import { Card, CardTitle } from '@/components/ui/card';
export default function NotificationsPage(){
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Smart Notifications</h1>
    <div className="grid md:grid-cols-3 gap-4">
      {[
        ['Teacher Notifications','Attendance Reminder • High-Risk Student Alert • <75% Attendance • Marks Pending • Parent Meeting'],
        ['Parent Notifications','Student Absent • Attendance Warning • Homework Assigned • New Marks • Fee Reminder'],
        ['Student Notifications','Homework • Attendance Warning • Exam Reminder • New Marks • School Notices'],
      ].map(([t,body])=><Card key={t}><CardTitle>{t}</CardTitle><p className="text-sm text-muted-foreground mt-2">{body}</p></Card>)}
    </div>
    <Card><CardTitle>Scheduled Notifications</CardTitle>
      <p className="text-sm text-muted-foreground mt-2">Admin can schedule class reminders, exam alerts, fee reminders. Firebase Cloud Messaging integrated (enable in Firebase Console).</p>
    </Card>
  </div>
}
