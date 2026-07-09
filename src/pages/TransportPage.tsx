import { Card, CardTitle } from '@/components/ui/card';
export default function TransportPage(){
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Transport Management</h1>
    <Card><CardTitle>Buses</CardTitle>
    <table className="w-full text-sm mt-3"><thead><tr className="text-left text-muted-foreground"><th>Bus</th><th>Driver</th><th>Route</th><th>Students</th></tr></thead>
    <tbody>
      <tr className="border-t"><td className="py-2">DL-01-AB-1234</td><td>Ramesh • 98xxxxxx10</td><td>Rohini → Pitampura → School</td><td>32</td></tr>
      <tr className="border-t"><td>DL-01-CD-5678</td><td>Suresh • 98xxxxxx11</td><td>Dwarka → Janakpuri</td><td>28</td></tr>
    </tbody></table>
    <p className="text-xs text-muted-foreground mt-2">GPS Ready – future enhancement hook included.</p>
    </Card>
  </div>
}
