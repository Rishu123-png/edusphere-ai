import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const ParentPortal: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Parent Portal</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Child's Attendance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-emerald-600">92%</div>
            <div className="text-sm mt-1">Present: 112 / 120 days</div>
            <div className="mt-3 text-xs text-emerald-600">AI: Low risk</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Marks</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>Maths: 87/100 <span className="text-emerald-600">(A)</span></div>
              <div>Science: 79/100 <span className="text-blue-600">(B+)</span></div>
              <div>English: 91/100 <span className="text-emerald-600">(A+)</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI Progress Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm">Strong in Science. Needs improvement in Mathematics consistency. Recommended: 2 extra revision sessions.</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader><CardTitle>WhatsApp Communication</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => window.open('https://wa.me/?text=Hello%20Teacher%2C%20I%20would%20like%20to%20discuss%20my%20child%27s%20progress.', '_blank')}>
              Message Class Teacher
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParentPortal;