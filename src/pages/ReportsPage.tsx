import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { FileDown, BarChart3 } from 'lucide-react'

export default function ReportsPage(){
  return <div className="page-container space-y-4">
    <PageHeader title="Reports" subtitle="Analytics • Export PDF/Excel/CSV" action={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full h-9" onClick={()=>toast('PDF exported')}><FileDown size={14} className="mr-1"/> PDF</Button>
      </div>
    } />
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {['Daily','Weekly','Monthly','Yearly','Student','Teacher','Attendance','Marks','Class','Overall School'].map(r=>(
        <Card key={r} className="rounded-[20px] hover:shadow-md transition"><CardTitle className="flex items-center gap-2 text-[15px]"><BarChart3 size={16}/> {r}</CardTitle><CardContent className="text-[12px] text-muted-foreground">Charts • Heatmaps • Graphs</CardContent></Card>
      ))}
    </div>
  </div>
}
