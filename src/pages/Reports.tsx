import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const Reports: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Reports &amp; Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Attendance Reports</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">Daily Attendance Report</Button>
              <Button variant="outline" className="w-full justify-start">Monthly Attendance Heatmap</Button>
              <Button variant="outline" className="w-full justify-start">Class-wise Attendance</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Academic Reports</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">Marks Summary (PDF)</Button>
              <Button variant="outline" className="w-full justify-start">Rank List Generator</Button>
              <Button variant="outline" className="w-full justify-start">Report Cards</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle>Export Options</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            <Button>Export PDF</Button>
            <Button variant="outline">Export Excel</Button>
            <Button variant="outline">Export CSV</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;