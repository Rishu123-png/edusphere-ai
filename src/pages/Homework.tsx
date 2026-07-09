import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const Homework: React.FC = () => {
  const [homeworks] = useState([
    { id: 1, class: '10-A', subject: 'Mathematics', title: 'Quadratic Equations', due: '2026-07-12', status: 'Active' },
    { id: 2, class: '11-B', subject: 'Physics', title: 'Laws of Motion', due: '2026-07-15', status: 'Active' },
    { id: 3, class: '9-C', subject: 'Chemistry', title: 'Periodic Table', due: '2026-07-10', status: 'Completed' },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Homework &amp; Assignments</h1>
          <p>Online submission • AI feedback</p>
        </div>
        <Button>Assign New Homework</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Homework</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table w-full">
            <thead>
              <tr><th>Class</th><th>Subject</th><th>Title</th><th>Due Date</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {homeworks.map(hw => (
                <tr key={hw.id}>
                  <td>{hw.class}</td>
                  <td>{hw.subject}</td>
                  <td className="font-medium">{hw.title}</td>
                  <td>{hw.due}</td>
                  <td><span className="status-badge bg-emerald-100 text-emerald-700">{hw.status}</span></td>
                  <td><Button size="sm" variant="outline">View Submissions</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Homework;