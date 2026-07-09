import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const Teachers: React.FC = () => {
  const [teachers] = useState([
    { id: 't1', name: 'Dr. Meera Kapoor', subjects: 'Maths, Physics', classes: '10A, 11B', experience: 14 },
    { id: 't2', name: 'Mr. Rajesh Kumar', subjects: 'Chemistry, Biology', classes: '9C, 10A', experience: 9 },
    { id: 't3', name: 'Ms. Sneha Rao', subjects: 'English, History', classes: '11B, 12A', experience: 7 },
  ]);

  return (
    <div>
      <div className="flex justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Teacher Management</h1>
          <p>Assign classes • Workload • Performance</p>
        </div>
        <Button><Plus className="mr-2" /> Add Teacher</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faculty Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table w-full">
            <thead>
              <tr><th>Name</th><th>Subjects</th><th>Classes</th><th>Experience</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td>{t.subjects}</td>
                  <td>{t.classes}</td>
                  <td>{t.experience} years</td>
                  <td><Button size="sm" variant="outline">View Profile</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Teachers;