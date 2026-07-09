import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

export default function SchedulePage(){
  const [rows,setRows] = useState([
    {day:'Mon', time:'09:00-09:45', class:'10-A', subject:'Maths', teacher:'Mrs. Gupta'},
    {day:'Mon', time:'09:45-10:30', class:'9-B', subject:'Science', teacher:'Mr. Khan'},
  ]);
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Class Scheduling – Admin assigns teachers</h1>
    <Card><CardTitle>Timetable</CardTitle>
      <table className="w-full text-sm mt-3"><thead><tr className="text-left text-muted-foreground"><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Teacher</th></tr></thead>
      <tbody>{rows.map((r,i)=><tr key={i} className="border-t"><td className="py-2">{r.day}</td><td>{r.time}</td><td>{r.class}</td><td>{r.subject}</td><td>{r.teacher}</td></tr>)}</tbody></table>
      <Button className="mt-3" onClick={()=>toast.success('Schedule published. Teachers get 5-min attendance window at class start. Late teacher → admin alert.')}>Publish Schedule</Button>
      <p className="text-xs text-muted-foreground mt-2">When a scheduled period starts, the assigned teacher gets a 5-minute window to mark attendance. If late, School Admin gets a push notification – prevents bunking.</p>
    </Card>
  </div>
}
