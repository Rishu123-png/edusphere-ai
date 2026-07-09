import { Card, CardTitle } from '@/components/ui/card';

function predict(marks:number[], attendance:number){
  const avg = marks.reduce((a,b)=>a+b,0)/marks.length;
  const predicted = Math.round(avg*0.7 + attendance*0.3);
  const grade = predicted>=90?'A+':predicted>=75?'A':predicted>=60?'B':predicted>=40?'C':'D';
  return {predicted, grade, pass: predicted>=33};
}

export default function AIPage(){
  const students = [
    {name:'Aarav', marks:[72,75,78], att:88},
    {name:'Isha', marks:[88,91,94], att:96},
    {name:'Rohan', marks:[55,58,60], att:68},
  ];
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">AI Intelligence System</h1>
    <div className="grid md:grid-cols-3 gap-4">
      {students.map(s=>{
        const p = predict(s.marks, s.att);
        const risk = s.att < 75 ? '🔴 High' : s.att < 85 ? '🟡 Medium' : '🟢 Low';
        return <Card key={s.name}><CardTitle>{s.name}</CardTitle>
          <div className="text-sm mt-2 space-y-1">
            <div>Predicted Marks: <b>{p.predicted}</b></div>
            <div>Expected Grade: <b>{p.grade}</b></div>
            <div>Pass Probability: <b>{p.pass?'92%':'58%'}</b></div>
            <div>Attendance Risk: <b>{risk}</b></div>
            <div className="text-muted-foreground pt-2">Weak: {s.att<80?'Attendance':'—'} • Strong: {p.grade.startsWith('A')?'All': '—'}</div>
            <div className="text-muted-foreground">Suggestion: {s.att<80?'Improve attendance to boost 12 marks':'Keep revising past papers'}</div>
          </div>
        </Card>
      })}
    </div>
    <Card><CardTitle>AI Daily Summary</CardTitle>
      <p className="text-sm text-muted-foreground mt-2">
        School performance stable. 12 students need attention, 6 parent meetings suggested. 
        Attendance impacts marks by ~18% correlation. Revision classes suggested for Maths – Class 10-A.
        Teacher insights: 3 late check-ins yesterday – auto-notified admin.
      </p>
    </Card>
  </div>
}
