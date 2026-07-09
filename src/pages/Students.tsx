import React, { useState } from 'react';
import { Plus, Search, Download, Upload, QrCode } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface StudentRow {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
  section: string;
  attendance: number;
  status: string;
}

const Students: React.FC = () => {
  const [students] = useState<StudentRow[]>([
    { id: 's1', name: 'Aarav Sharma', admissionNo: 'CBSE2024012', class: '10', section: 'A', attendance: 96, status: 'active' },
    { id: 's2', name: 'Priya Patel', admissionNo: 'CBSE2024018', class: '11', section: 'B', attendance: 92, status: 'active' },
    { id: 's3', name: 'Rahul Gupta', admissionNo: 'CBSE2024023', class: '9', section: 'C', attendance: 88, status: 'active' },
    { id: 's4', name: 'Ananya Singh', admissionNo: 'CBSE2024031', class: '10', section: 'A', attendance: 75, status: 'active' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">Manage all students • QR IDs • Bulk Import</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Bulk Import</Button>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button><Plus className="mr-2 h-4 w-4" /> Add Student</Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by name or admission number..." 
            className="pl-10 w-full py-2.5 px-4 rounded-2xl border bg-background" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Students ({filteredStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Class/Section</th>
                  <th>Attendance %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="font-medium">{student.name}</td>
                    <td className="font-mono text-sm">{student.admissionNo}</td>
                    <td>{student.class}-{student.section}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{student.attendance}%</span>
                        <div className="w-16 h-2 bg-muted rounded">
                          <div className="h-2 bg-emerald-500 rounded" style={{width: `${student.attendance}%`}}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="status-badge bg-emerald-100 text-emerald-700">{student.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">View</Button>
                        <Button size="sm" variant="outline"><QrCode className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;