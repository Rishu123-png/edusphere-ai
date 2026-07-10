import { useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gradeFromMarks } from '@/lib/utils'
import { toast } from 'sonner'

const demoStudents = [
  {id:'1', name:'Aarav Sharma', roll:'01'},
  {id:'2', name:'Ishita Mehta', roll:'02'},
  {id:'3', name:'Vihaan Reddy', roll:'03'},
  {id:'4', name:'Ananya Patel', roll:'04'},
]

export default function MarksPage(){
  const [subject, setSubject] = useState('Mathematics')
  const [exam, setExam] = useState('mid_term')
  const [marks, setMarks] = useState<Record<string, number>>({})

  const save = ()=>{
    toast.success('Marks saved – AI grades calculated')
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Marks Management System</h1><p className="text-sm text-muted-foreground">Subject-wise • AI Grade • GPA • Rank List • Printable Report Cards</p></div>
      <Button onClick={save}>Publish Marks</Button>
    </div>
    <Card>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={subject} onChange={e=>setSubject(e.target.value)} className="border rounded-xl px-3 py-2 bg-background text-sm">
            <option>Mathematics</option><option>Science</option><option>English</option><option>Social Science</option><option>Hindi</option>
          </select>
          <select value={exam} onChange={e=>setExam(e.target.value)} className="border rounded-xl px-3 py-2 bg-background text-sm">
            <option value="unit_test">Unit Test</option>
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
            <option value="practical">Practical</option>
            <option value="mid_term">Mid-Term</option>
            <option value="final">Final</option>
            <option value="internal">Internal Assessment</option>
          </select>
          <span className="text-xs text-muted-foreground self-center">AI auto grades – editable</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Roll</th><th>Name</th><th>Marks /100</th><th>Grade (AI)</th><th>GPA</th><th>%</th></tr></thead>
            <tbody>
              {demoStudents.map(st=>{
                const m = marks[st.id] ?? 78
                const grade = gradeFromMarks(m)
                const gpa = (m/100*4).toFixed(2)
                return <tr key={st.id} className="border-b">
                  <td className="py-2">{st.roll}</td>
                  <td>{st.name}</td>
                  <td><Input type="number" className="w-24 h-8" value={m} onChange={e=>setMarks({...marks, [st.id]: Number(e.target.value)})} /></td>
                  <td><span className="px-2 py-1 rounded bg-muted">{grade}</span></td>
                  <td>{gpa}</td>
                  <td>{m}%</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={()=>toast('Exporting PDF report cards…')}>Export PDF</Button>
          <Button variant="outline" onClick={()=>toast('Export Excel')}>Export Excel</Button>
          <Button variant="outline" onClick={()=>toast('AI Performance Summary generated')}>AI Summary</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-3 gap-4">
      <Card><CardTitle>Rank List</CardTitle><CardContent className="text-sm">1. Ishita – 94.2%<br/>2. Aarav – 91.8%<br/>3. Ananya – 89.5%</CardContent></Card>
      <Card><CardTitle>Top Performers</CardTitle><CardContent className="text-sm">Class 10-A avg 82.4% ↑ 3.1% vs last UT</CardContent></Card>
      <Card><CardTitle>AI Performance Summary</CardTitle><CardContent className="text-sm text-muted-foreground">Weak: Algebra (class avg 68%). Suggest revision class. Strong: Geometry 88%.</CardContent></Card>
    </div>
  </div>
}
