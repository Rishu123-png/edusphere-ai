import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

export default function MarksPage(){
  const [rows,setRows] = useState([{student:'Aarav Sharma', marks:78},{student:'Isha Verma', marks:91},{student:'Rohan Singh', marks:64}]);
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Marks Management</h1>
    <Card><CardTitle>Enter Marks – Maths • Mid-Term • Class 10-A</CardTitle>
      <table className="w-full text-sm mt-3"><thead><tr className="text-left text-muted-foreground"><th>Student</th><th>Marks / 100</th></tr></thead>
      <tbody>{rows.map((r,i)=><tr key={i} className="border-t border-border"><td className="py-2">{r.student}</td><td><Input type="number" defaultValue={r.marks} className="w-28"/></td></tr>)}</tbody></table>
      <Button className="mt-3" onClick={()=>toast.success('Marks saved. Grade/GPA auto-calculated. Report cards ready.')}>Save Marks</Button>
    </Card>
    <Card><CardTitle>Report Cards</CardTitle>
      <p className="text-sm text-muted-foreground mt-2">Printable CBSE report cards with GPA, rank list, AI Performance Summary. Export PDF/Excel.</p>
      <Button variant="secondary" className="mt-2" onClick={()=>toast('PDF export – integrated via jsPDF')}>Export PDF</Button>
    </Card>
  </div>
}
