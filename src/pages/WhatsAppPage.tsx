import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export default function WhatsAppPage(){
  const [msg,setMsg] = useState('Dear Parent, your ward Aarav Sharma (10-A, Roll 12) was marked ABSENT today (09-Jul-2026). Please contact class teacher if this is in error. - EduSphere AI');
  const send = ()=>{ window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank'); toast.success('WhatsApp opened – teacher review before send'); };
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">WhatsApp Parent Communication</h1>
    <Card><CardTitle>Absent Alert</CardTitle>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} className="w-full mt-3 h-32 rounded-xl border border-input bg-background p-3 text-sm"/>
      <div className="flex gap-2 mt-2">
        <Button onClick={send}>Send via WhatsApp</Button>
        <Button variant="secondary" onClick={()=>setMsg('Dear Parent, you are invited for a Parent-Teacher Meeting on 12-Jul, 10:00 AM. – Class Teacher, 10-A')}>Parent Meeting Template</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">One-click WhatsApp. Teacher reviews message before sending. Works on Web + Android Capacitor app.</p>
    </Card>
  </div>
}
