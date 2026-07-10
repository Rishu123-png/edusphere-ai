import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { predictMarks, attendanceRisk } from '@/lib/ai'
import { useState } from 'react'
import PageHeader from '@/components/mobile/PageHeader'
import { Brain, TrendingUp, AlertTriangle, Sparkles, RotateCcw } from 'lucide-react'

export default function AIPage(){
  const [pred] = useState(predictMarks([{marksObtained:78,maxMarks:100} as any, {marksObtained:82,maxMarks:100} as any], 88))
  const [risk] = useState(attendanceRisk(Array.from({length:20}).map((_,i)=>({status: i%9===0 ? 'absent':'present', date: '2026-06-'+(i+1)} as any))))

  return <div className="page-container space-y-4">
    <PageHeader title="AI Intelligence" subtitle="Prediction • Risk • Summary • Insights" />

    <div className="grid lg:grid-cols-3 gap-3">
      <Card className="rounded-[24px] overflow-hidden border-indigo-100 dark:border-indigo-900/30">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-600" />
        <CardTitle className="flex items-center gap-2"><Brain size={18} className="text-indigo-600"/> AI Marks Prediction</CardTitle>
        <CardContent>
          <div className="text-[36px] font-extrabold tracking-tight leading-none">{pred.predicted}%</div>
          <div className="text-[13px] text-muted-foreground mt-2">Grade: <b className="text-foreground">{pred.grade}</b> • Pass: {(pred.passProb*100).toFixed(0)}%</div>
          <ul className="text-[13px] mt-4 space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800">
            <li className="flex gap-2"><span className="text-emerald-500">↑</span> Strong: Geometry, Statistics</li>
            <li className="flex gap-2"><span className="text-amber-500">⚠</span> Weak: Algebra, Trigonometry</li>
            <li className="flex gap-2"><span className="text-indigo-500">✦</span> Suggestion: 2× revision + past papers</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500"/> AI Attendance Risk</CardTitle>
        <CardContent>
          <div className={`text-[28px] font-extrabold tracking-tight ${risk.risk==='high'?'text-red-500': risk.risk==='medium'?'text-amber-500':'text-emerald-500'}`}>{risk.risk.toUpperCase()} • {(risk.probability*100).toFixed(0)}%</div>
          <ul className="text-[13px] mt-3 list-disc pl-4 text-muted-foreground space-y-1">{risk.reasons.map(r=><li key={r}>{r}</li>)}</ul>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-black text-white border-0">
        <CardTitle className="text-white">AI Student Analysis</CardTitle>
        <CardContent className="text-[13px] space-y-2.5 text-zinc-300">
          <p className="flex justify-between"><span>Trend</span><b className="text-emerald-400">↗ +4.2%</b></p>
          <p>Impact: -2.1 marks per 5% drop</p>
          <p>Personalized: Focus Algebra 30min/day</p>
          <p className="p-2 rounded-xl bg-white/10">Parent Meeting: Recommended</p>
        </CardContent>
      </Card>
    </div>

    <Card className="rounded-[24px]">
      <div className="flex items-center justify-between pr-5">
        <CardTitle className="flex items-center gap-2"><Sparkles size={18}/> AI Daily Summary</CardTitle>
        <Button variant="outline" size="sm" className="rounded-full h-8"><RotateCcw size={14} className="mr-1"/> Regenerate</Button>
      </div>
      <CardContent className="grid md:grid-cols-2 gap-4 text-[13px] leading-relaxed mt-2">
        <div className="space-y-2">
          <p>• Attendance Summary: 91.5% – 12 at-risk</p>
          <p>• School Performance: Avg 81.2% ↑</p>
          <p>• Teacher Insights: 3 late markings</p>
          <p>• Student Insights: 6 need parent meetings</p>
        </div>
        <div className="space-y-2">
          <p>• Suggested revision: Maths 10-A, Science 9-B</p>
          <p>• Attendance nudge: SMS Mon absentees</p>
          <p>• Workload: rebalance English dept</p>
          <Button variant="gradient" size="sm" className="rounded-full mt-3 h-10 w-full md:w-auto">Regenerate AI Summary</Button>
        </div>
      </CardContent>
    </Card>
  </div>
}
