import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { whatsappUrl } from '@/lib/utils'

const absentees = [
  {name:'Rohan Kumar', class:'10-A', parent:'+919876543210', reason:'Absent'},
  {name:'Meera Singh', class:'9-B', parent:'+919812345678', reason:'Absent'},
  {name:'Dev Patel', class:'10-A', parent:'+919800112233', reason:'Late 3x'},
]

export default function WhatsAppPage(){
  const [template, setTemplate] = useState('Dear Parent, your ward {name} ({class}) was marked {reason} today ({date}). Attendance: {attendance}%. Please ensure regular attendance. - {school}')
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">WhatsApp Parent Communication</h1>
    <Card>
      <CardTitle>Attendance Alert Template</CardTitle>
      <CardContent className="space-y-3">
        <Input value={template} onChange={e=>setTemplate(e.target.value)} />
        <p className="text-xs text-muted-foreground">Variables: {'{name} {class} {reason} {date} {attendance} {school}'}</p>
      </CardContent>
    </Card>
    <div className="grid md:grid-cols-2 gap-3">
      {absentees.map(a=>{
        const msg = template.replace('{name}', a.name).replace('{class}', a.class).replace('{reason}', a.reason).replace('{date}', new Date().toLocaleDateString('en-IN')).replace('{attendance}','68').replace('{school}','EduSphere Public School')
        return <Card key={a.name}>
          <CardContent>
            <div className="font-semibold">{a.name} • {a.class}</div>
            <div className="text-xs text-muted-foreground mb-2">{a.parent}</div>
            <div className="text-xs bg-muted p-2 rounded mb-2">{msg}</div>
            <div className="flex gap-2">
              <a href={whatsappUrl(a.parent, msg)} target="_blank" rel="noreferrer"><Button size="sm">Send WhatsApp</Button></a>
              <Button size="sm" variant="outline">Edit</Button>
            </div>
          </CardContent>
        </Card>
      })}
    </div>
    <Card><CardTitle>Parent Meeting Invitation Template</CardTitle><CardContent className="text-sm text-muted-foreground">One-click invite with date/time picker – WhatsApp pre-filled.</CardContent></Card>
  </div>
}
