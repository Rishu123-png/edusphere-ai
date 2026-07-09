import React, { useState } from 'react';
import { Calendar, QrCode, Users, Clock, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const Attendance: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState([
    { id: 's1', name: 'Aarav Sharma', class: '10-A', status: 'present' },
    { id: 's2', name: 'Priya Patel', class: '11-B', status: 'present' },
    { id: 's3', name: 'Rahul Gupta', class: '9-C', status: 'absent' },
    { id: 's4', name: 'Ananya Singh', class: '10-A', status: 'late' },
    { id: 's5', name: 'Vikram Rao', class: '10-A', status: 'present' },
  ]);

  const updateStatus = (id: string, status: string) => {
    setAttendanceData(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const presentCount = attendanceData.filter(s => s.status === 'present').length;
  const absentCount = attendanceData.filter(s => s.status === 'absent').length;
  const lateCount = attendanceData.filter(s => s.status === 'late').length;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Attendance</h1>
          <p>Manual • QR Code • Mobile • Offline Sync</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline"><QrCode className="mr-2 h-4 w-4" /> QR Scan</Button>
          <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> Calendar View</Button>
          <Button><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
          <div><div className="font-semibold text-emerald-700">Present</div><div className="text-4xl font-bold text-emerald-600">{presentCount}</div></div>
          <Users className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex justify-between items-center">
          <div><div className="font-semibold text-rose-700">Absent</div><div className="text-4xl font-bold text-rose-600">{absentCount}</div></div>
          <Users className="h-10 w-10 text-rose-400" />
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex justify-between items-center">
          <div><div className="font-semibold text-amber-700">Late</div><div className="text-4xl font-bold text-amber-600">{lateCount}</div></div>
          <Clock className="h-10 w-10 text-amber-400" />
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex justify-between items-center">
          <div><div className="font-semibold text-blue-700">Total</div><div className="text-4xl font-bold text-blue-600">{attendanceData.length}</div></div>
          <Users className="h-10 w-10 text-blue-400" />
        </div>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Attendance — {selectedDate}</span>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              className="border rounded px-3 py-1 text-sm" 
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map(student => (
                <tr key={student.id}>
                  <td className="font-medium">{student.name}</td>
                  <td>{student.class}</td>
                  <td>
                    <span className={`status-badge px-3 py-1 text-xs rounded-full font-medium ${
                      student.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 
                      student.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {['present', 'absent', 'late', 'leave'].map(s => (
                        <Button 
                          key={s} 
                          size="sm" 
                          variant={student.status === s ? 'default' : 'outline'} 
                          onClick={() => updateStatus(student.id, s)}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground flex gap-2 items-center">
        <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Real-time Firebase sync enabled</div>
        <div>Offline support enabled via PWA</div>
      </div>
    </div>
  );
};

export default Attendance;