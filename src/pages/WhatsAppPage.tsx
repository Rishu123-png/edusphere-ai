import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { whatsappUrl } from '@/lib/utils'
import PageHeader from '@/components/mobile/PageHeader'
import { MessageCircle, Send } from 'lucide-react'

const absentees = [
  {name:'Rohan Kumar', class:'10-A', parent:'+919876543210', reason:'Absent'},
  {name:'Meera Singh', class:'9-B', parent:'+919812345678', reason:'Absent'},
  {name:'Dev Patel', class:'10-A', parent:'+919800112233', reason:'Late 3x'},
]

export default function WhatsAppPage(){
  const [template, setTemplate] = useState('Dear Parent, your ward {name} ({class}) was marked {reason} today ({date}). Attendance: {attendance}%. Please ensure regular attendance. - {school}')
  return <div className="page-container space-y-4">
    <PageHeader title="WhatsApp" subtitle="Parent alerts • Templates • 1-click send" />
    <Card className="rounded-[24px]">
      <CardTitle className="flex items-center gap-2"><MessageCircle size={18}/> Attendance Alert Template</CardTitle>
      <CardContent className="space-y-3">
        <Input value={template} onChange={e=>setTemplate(e.target.value)} className="h-12 rounded-xl" />
        <p className="text-[11px] text-muted-foreground">Variables: {'{name} {class} {reason} {date} {attendance} {school}'}</p>
      </CardContent>
    </Card>
    <div className="grid md:grid-cols-2 gap-3">
      {absentees.map(a=>{
        const msg = template.replace('{name}', a.name).replace('{class}', a.class).replace('{reason}', a.reason).replace('{date}', new Date().toLocaleDateString('en-IN')).replace('{attendance}','68').replace('{school}','EduSphere Public School')
        return <Card key={a.name} className="rounded-[20px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[14px]">{a.name} • {a.class}</div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{a.reason}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{a.parent}</div>
            <div className="text-[12px] bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-3 leading-snug">{msg}</div>
            <div className="flex gap-2 mt-3">
              <a href={whatsappUrl(a.parent, msg)} target="_blank" rel="noreferrer" className="flex-1"><Button size="sm" variant="success" className="w-full rounded-full"><Send size={14} className="mr-1"/> WhatsApp</Button></a>
              <Button size="sm" variant="outline" className="rounded-full">Edit</Button>
            </div>
          </CardContent>
        </Card>
      })}
    </div>
  </div>
}
