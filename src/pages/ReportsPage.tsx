import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function ReportsPage(){
  return <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={()=>toast('PDF exported')}>Export PDF</Button>
        <Button variant="outline" onClick={()=>toast('Excel exported')}>Export Excel</Button>
        <Button variant="outline" onClick={()=>toast('CSV exported')}>Export CSV</Button>
      </div>
    </div>
    <div className="grid md:grid-cols-3 gap-4">
      {['Daily','Weekly','Monthly','Yearly','Student','Teacher','Attendance','Marks','Class','Overall School'].map(r=>(
        <Card key={r}><CardTitle>{r} Report</CardTitle><CardContent className="text-sm text-muted-foreground">Interactive charts • Heatmaps • Performance graphs</CardContent></Card>
      ))}
    </div>
  </div>
}
