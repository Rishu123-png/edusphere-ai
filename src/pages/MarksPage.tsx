import { useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gradeFromMarks } from '@/lib/utils'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { Award, TrendingUp, FileDown } from 'lucide-react'

const demoStudents = [
  {id:'1', name:'Aarav Sharma', roll:'01', avatar:'A'},
  {id:'2', name:'Ishita Mehta', roll:'02', avatar:'I'},
  {id:'3', name:'Vihaan Reddy', roll:'03', avatar:'V'},
  {id:'4', name:'Ananya Patel', roll:'04', avatar:'A'},
]

export default function MarksPage(){
  const [subject, setSubject] = useState('Mathematics')
  const [exam, setExam] = useState('mid_term')
  const [marks, setMarks] = useState<Record<string, number>>({})

  const save = ()=>{
    toast.success('Marks saved – AI grades calculated')
    try { navigator.vibrate?.(50) } catch {}
  }

  return <div className="page-container space-y-4">
    <PageHeader title="Marks" subtitle="Subject-wise • AI Grade • GPA • Rank • Reports" action={<Button variant="gradient" size="sm" className="rounded-full h-10 px-5" onClick={save}>Publish</Button>} />

    <Card className="rounded-[24px] overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
          <select value={subject} onChange={e=>setSubject(e.target.value)} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
            <option>Mathematics</option><option>Science</option><option>English</option><option>Social Science</option><option>Hindi</option>
          </select>
          <select value={exam} onChange={e=>setExam(e.target.value)} className="h-11 rounded-full px-4 bg-slate-100 dark:bg-zinc-800 border-0 text-[13px] font-semibold">
            <option value="unit_test">Unit Test</option>
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
            <option value="practical">Practical</option>
            <option value="mid_term">Mid-Term</option>
            <option value="final">Final</option>
            <option value="internal">Internal</option>
          </select>
          <span className="text-[11px] text-muted-foreground self-center whitespace-nowrap ml-2">AI auto grades</span>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-2">
          {demoStudents.map(st=>{
            const m = marks[st.id] ?? 78
            const grade = gradeFromMarks(m)
            const gpa = (m/100*4).toFixed(2)
            return (
              <div key={st.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-100 dark:border-zinc-700/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">{st.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px] leading-tight">{st.name}</div>
                  <div className="text-[11px] text-muted-foreground">Roll {st.roll} • GPA {gpa} • {m}%</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[11px] font-bold">{grade}</span>
                  <Input type="number" className="w-16 h-9 rounded-full text-center" value={m} onChange={e=>setMarks({...marks, [st.id]: Number(e.target.value)})} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-slate-100 dark:border-zinc-800"><th className="py-3 px-5">Roll</th><th>Name</th><th>Marks /100</th><th>Grade (AI)</th><th>GPA</th><th>%</th></tr></thead>
            <tbody>
              {demoStudents.map(st=>{
                const m = marks[st.id] ?? 78
                const grade = gradeFromMarks(m)
                const gpa = (m/100*4).toFixed(2)
                return <tr key={st.id} className="border-b border-slate-50 dark:border-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-5">{st.roll}</td>
                  <td className="font-medium">{st.name}</td>
                  <td><Input type="number" className="w-24 h-9 rounded-full" value={m} onChange={e=>setMarks({...marks, [st.id]: Number(e.target.value)})} /></td>
                  <td><span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold">{grade}</span></td>
                  <td>{gpa}</td>
                  <td>{m}%</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 p-4 flex-wrap">
          <Button variant="outline" size="sm" className="rounded-full" onClick={()=>toast('Exporting PDF…')}><FileDown size={14} className="mr-1"/> PDF</Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={()=>toast('Export Excel')}>Excel</Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={()=>toast('AI Performance Summary generated')}>AI Summary</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid md:grid-cols-3 gap-3">
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><Award size={16}/> Rank List</CardTitle><CardContent className="text-[13px] space-y-1">1. Ishita – 94.2%<br/>2. Aarav – 91.8%<br/>3. Ananya – 89.5%</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle className="flex items-center gap-2"><TrendingUp size={16}/> Top Performers</CardTitle><CardContent className="text-[13px]">Class 10-A avg 82.4% ↑ 3.1% vs last UT</CardContent></Card>
      <Card className="rounded-[20px]"><CardTitle>AI Summary</CardTitle><CardContent className="text-[13px] text-muted-foreground">Weak: Algebra (avg 68%). Suggest revision class. Strong: Geometry 88%.</CardContent></Card>
    </div>
  </div>
}
