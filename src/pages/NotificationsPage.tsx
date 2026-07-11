import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { Bell, AlertTriangle, FileWarning, Users } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue, update } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'

const iconFor = (type: string) => {
  if (type === 'ai' || type === 'alert') return { icon: AlertTriangle, color: 'bg-red-500' }
  if (type === 'marks') return { icon: FileWarning, color: 'bg-amber-500' }
  if (type === 'announcement') return { icon: Users, color: 'bg-violet-500' }
  return { icon: Bell, color: 'bg-blue-500' }
}

export default function NotificationsPage(){
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const [notifs, setNotifs] = useState<any[]>([])

  useEffect(()=>{
    if(!schoolId){ setNotifs([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/notifications`), snap=>{
      const v = snap.val() || {}
      const list = Object.entries(v)
        .map(([id, n]:any)=>({ id, ...n }))
        .sort((a:any,b:any)=>(b.createdAt||0)-(a.createdAt||0))
      setNotifs(list)
    })
    return ()=>unsub()
  }, [schoolId])

  const markRead = async (n: any) => {
    if(!schoolId || !n?.id) return
    await update(ref(db, `schools/${schoolId}/notifications/${n.id}`), { read: true })
    toast.success('Marked as read')
  }

  return <div className="page-container space-y-4">
    <PageHeader title="Notifications" subtitle="Smart alerts from your school activity" />
    <div className="grid gap-3">
      {notifs.map((n)=>(
        <Card key={n.id} className="rounded-[20px]">
          <CardContent className="p-4 flex items-center gap-3">
            {(() => {
              const meta = iconFor(n.type || 'attendance')
              const Icon = meta.icon
              return <div className={`w-10 h-10 rounded-full ${meta.color} flex items-center justify-center text-white shrink-0`}><Icon size={18}/></div>
            })()}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14px]">{n.title || 'Notification'}</div>
              <div className="text-[12px] text-muted-foreground leading-snug">{n.body || ''}</div>
            </div>
            <Button size="sm" variant="outline" className="rounded-full h-8 text-[12px]" onClick={()=>markRead(n)}>{n.read ? 'Read' : 'Mark read'}</Button>
          </CardContent>
        </Card>
      ))}
      {!notifs.length && (
        <Card className="p-10 text-center text-muted-foreground text-sm rounded-[20px]">
          No notifications yet for {profile?.displayName || 'your school'}. Alerts will appear here when attendance, marks, or admin actions create them.
        </Card>
      )}
    </div>
    <Card className="rounded-[20px] bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border-violet-100 dark:border-violet-900/30">
      <CardTitle>Auto Rule</CardTitle>
      <CardContent className="text-[13px] text-muted-foreground">Students below 75% attendance can be flagged for parent WhatsApp follow-up from the WhatsApp page using real absent records.</CardContent>
    </Card>
  </div>
}
