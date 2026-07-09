import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const Marks: React.FC = () => {
  const [marksData] = useState([
    { student: 'Aarav Sharma', subject: 'Mathematics', type: 'Unit Test', marks: 87, max: 100 },
    { student: 'Priya Patel', subject: 'Science', type: 'Mid-Term', marks: 79, max: 100 },
    { student: 'Rahul Gupta', subject: 'English', type: 'Assignment', marks: 92, max: 100 },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Marks Management</h1>
          <p>Subject-wise marks • GPA • Report Cards</p>
        </div>
        <Button>Enter New Marks</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Marks Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table w-full">
            <thead>
              <tr><th>Student</th><th>Subject</th><th>Type</th><th>Marks</th><th>Grade</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {marksData.map((m, idx) => {
                const perc = Math.round((m.marks / m.max) * 100);
                const grade = perc > 90 ? 'A+' : perc > 80 ? 'A' : perc > 70 ? 'B+' : 'B';
                return (
                  <tr key={idx}>
                    <td>{m.student}</td>
                    <td>{m.subject}</td>
                    <td>{m.type}</td>
                    <td>{m.marks}/{m.max} ({perc}%)</td>
                    <td><span className="font-semibold text-emerald-600">{grade}</span></td>
                    <td><Button size="sm" variant="outline">Edit</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle>AI Performance Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm">AI has generated personalized progress reports for 43 students. 8 students predicted to improve by 12% with extra help.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Marks;