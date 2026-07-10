
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { predictMarks, attendanceRisk } from '@/lib/ai'
import { useState } from 'react'

export default function AIPage(){
  const [pred] = useState(predictMarks([{marksObtained:78,maxMarks:100} as any, {marksObtained:82,maxMarks:100} as any], 88))
  const [risk] = useState(attendanceRisk(Array.from({length:20}).map((_,i)=>({status: i%9===0 ? 'absent':'present', date: '2026-06-'+(i+1)} as any))))

  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">AI Intelligence System</h1>
    <div className="grid lg:grid-cols-3 gap-4">
      <Card><CardTitle>AI Marks Prediction</CardTitle><CardContent>
        <div className="text-3xl font-bold">{pred.predicted}%</div>
        <div className="text-sm text-muted-foreground">Expected Grade: {pred.grade} • Pass Prob: {(pred.passProb*100).toFixed(0)}%</div>
        <ul className="text-sm mt-3 space-y-1">
          <li>Strong: Geometry, Statistics</li>
          <li>Weak: Algebra, Trigonometry</li>
          <li>Suggestion: 2× revision + past papers</li>
        </ul>
      </CardContent></Card>

      <Card><CardTitle>AI Attendance Risk</CardTitle><CardContent>
        <div className={`text-2xl font-bold ${risk.risk==='high'?'text-red-500': risk.risk==='medium'?'text-amber-500':'text-emerald-500'}`}>{risk.risk.toUpperCase()} • {(risk.probability*100).toFixed(0)}%</div>
        <ul className="text-sm mt-2 list-disc pl-4 text-muted-foreground">{risk.reasons.map(r=><li key={r}>{r}</li>)}</ul>
      </CardContent></Card>

      <Card><CardTitle>AI Student Analysis</CardTitle><CardContent className="text-sm space-y-1">
        <p>Performance Trend: ↗ +4.2%</p>
        <p>Attendance Impact: -2.1 marks per 5% drop</p>
        <p>Personalized: Focus Algebra 30min/day</p>
        <p>Parent Meeting: Recommended</p>
      </CardContent></Card>
    </div>

    <Card>
      <CardTitle>AI Daily Summary (auto-generated)</CardTitle>
      <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <p>• Attendance Summary: 91.5% – 12 at-risk</p>
          <p>• School Performance Summary: Avg 81.2% ↑</p>
          <p>• Teacher Insights: 3 late markings</p>
          <p>• Student Insights: 6 need parent meetings</p>
        </div>
        <div>
          <p>• Suggested revision classes: Maths 10-A, Science 9-B</p>
          <p>• Suggested attendance improvements: SMS nudge Mon absentees</p>
          <p>• Teacher recommendations: workload rebalance English dept</p>
          <Button className="mt-3" size="sm">Regenerate AI Summary</Button>
        </div>
      </CardContent>
    </Card>
  </div>
}
