import React, { useState } from 'react';
import { Brain, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface AIStudent {
  id: string;
  name: string;
  class: string;
  predictedMarks: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestion: string;
  attendanceTrend: number;
}

const AIInsights: React.FC = () => {
  const [students] = useState<AIStudent[]>([
    { id: 's1', name: 'Aarav Sharma', class: '10-A', predictedMarks: 89, riskLevel: 'low', suggestion: 'Focus on Science practicals', attendanceTrend: 96 },
    { id: 's2', name: 'Priya Patel', class: '11-B', predictedMarks: 78, riskLevel: 'medium', suggestion: 'Improve Maths consistency', attendanceTrend: 84 },
    { id: 's3', name: 'Rahul Gupta', class: '9-C', predictedMarks: 63, riskLevel: 'high', suggestion: 'Daily revision recommended', attendanceTrend: 71 },
    { id: 's4', name: 'Ananya Singh', class: '10-A', predictedMarks: 92, riskLevel: 'low', suggestion: 'Encourage leadership roles', attendanceTrend: 98 },
  ]);

  const getRiskBadge = (level: string) => {
    if (level === 'high') return <span className="status-badge bg-red-100 text-red-700">🔴 High Risk</span>;
    if (level === 'medium') return <span className="status-badge bg-amber-100 text-amber-700">🟡 Medium Risk</span>;
    return <span className="status-badge bg-emerald-100 text-emerald-700">🟢 Low Risk</span>;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Brain className="h-8 w-8" /> AI Intelligence System
        </h1>
        <p className="text-muted-foreground">Marks Prediction • Attendance Risk • Study Recommendations</p>
      </div>

      {/* AI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="ai-card">
          <CardHeader>
            <CardTitle>AI Marks Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">82.4</div>
            <p className="text-sm text-muted-foreground">Average predicted score (next exam)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Attendance Risk Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-3xl">
              <span className="font-bold text-red-600">7</span>
              <span className="text-sm text-muted-foreground">High Risk Students</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>• Schedule revision class for Class 9C</div>
            <div>• Parent meeting for 3 high-risk students</div>
            <div>• Maths extra classes for Class 10A</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Student Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle>AI Student Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Predicted Marks</th>
                <th>Risk Level</th>
                <th>Attendance Trend</th>
                <th>AI Suggestion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id}>
                  <td className="font-medium">{student.name}</td>
                  <td>{student.class}</td>
                  <td>
                    <div className="font-mono text-lg font-semibold">{student.predictedMarks}</div>
                  </td>
                  <td>{getRiskBadge(student.riskLevel)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted h-2 rounded"><div className="bg-emerald-500 h-2 rounded" style={{width: `${student.attendanceTrend}%`}}></div></div>
                      <span className="text-xs">{student.attendanceTrend}%</span>
                    </div>
                  </td>
                  <td className="text-xs max-w-[180px]">{student.suggestion}</td>
                  <td>
                    <Button size="sm" variant="outline">Send Alert</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      <Card>
        <CardHeader>
          <CardTitle>One-Click WhatsApp Parent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {students.filter(s => s.riskLevel !== 'low').map(s => (
              <Button 
                key={s.id}
                onClick={() => {
                  const msg = `Dear Parent, ${s.name} (${s.class}) is at ${s.riskLevel.toUpperCase()} attendance risk. AI suggests: ${s.suggestion}. - EduSphere AI`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                variant="outline"
              >
                📱 WhatsApp: {s.name}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Real WhatsApp integration ready (Firebase Cloud Messaging can be added later)</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsights;