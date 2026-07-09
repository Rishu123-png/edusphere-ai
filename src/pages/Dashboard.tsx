import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Award, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 1248,
    totalTeachers: 67,
    presentToday: 1092,
    absentToday: 98,
    lateToday: 58,
    attendancePercent: 87.5,
  });
  const [aiSummary, setAiSummary] = useState('');

  // Simulate fetching data + AI summary
  useEffect(() => {
    const fetchData = async () => {
      // In real app: fetch from Firestore
      // For demo: generate dynamic AI summary
      const summary = `Good morning, ${currentUser?.displayName?.split(' ')[0] || 'User'}! 
      Today's attendance is strong at ${stats.attendancePercent}%. 
      AI predicts 14 students at high risk of absence tomorrow. 
      3 students have shown significant improvement in Maths. 
      Recommendation: Schedule revision class for Class 10B.`;
      
      setAiSummary(summary);
    };
    
    fetchData();
  }, [currentUser]);

  const quickActions = [
    { label: 'Mark Attendance', icon: UserCheck, color: 'bg-emerald-500' },
    { label: 'Add Student', icon: Users, color: 'bg-blue-500' },
    { label: 'Generate Report', icon: Award, color: 'bg-purple-500' },
    { label: 'AI Analysis', icon: TrendingUp, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Good morning, {currentUser?.displayName?.split(' ')[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening at your school today</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Thursday, July 9, 2026</div>
          <div className="font-medium text-primary">CBSE School • Delhi</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-emerald-600 mt-1">+24 new this month</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Attendance</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-600">{stats.presentToday}</div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <div className="text-emerald-600">Present: {stats.presentToday}</div>
              <div className="text-rose-600">Absent: {stats.absentToday}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{stats.attendancePercent}%</div>
            <div className="h-2.5 bg-muted rounded mt-3">
              <div className="h-2.5 bg-blue-600 rounded" style={{ width: `${stats.attendancePercent}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalTeachers}</div>
            <p className="text-xs text-muted-foreground mt-1">92% present today</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Daily Summary */}
      <Card className="ai-card border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Brain className="h-5 w-5" /> AI Daily Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm leading-relaxed whitespace-pre-line text-blue-700 dark:text-blue-200">
            {aiSummary}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">14 High Risk Students</div>
            <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">3 Improved Students</div>
            <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Revision Class Suggested</div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h3 className="font-semibold mb-4 text-lg">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button 
              key={index} 
              className="flex flex-col items-center justify-center gap-3 p-5 bg-card border border-border hover:bg-accent rounded-2xl transition-all active:scale-[0.985]"
            >
              <div className={`${action.color} text-white p-3 rounded-2xl`}>
                <action.icon size={22} />
              </div>
              <span className="font-medium text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-xs text-center">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                <div key={idx} className="font-medium text-muted-foreground mb-1">{day}</div>
              ))}
              {[92, 88, 95, 87, 91, 65, 0].map((val, i) => (
                <div key={i} className="aspect-square rounded flex items-center justify-center text-[10px] font-medium" 
                  style={{ 
                    backgroundColor: val > 90 ? '#10b981' : val > 80 ? '#eab308' : val > 0 ? '#f97316' : '#e5e7eb',
                    color: val > 0 ? 'white' : '#64748b'
                  }}>
                  {val}%
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Aarav Sharma", class: "10-A", percent: 97 },
                { name: "Priya Patel", class: "11-B", percent: 95 },
                { name: "Rahul Gupta", class: "9-C", percent: 94 },
              ].map((student, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.class}</div>
                  </div>
                  <div className="font-mono font-semibold text-emerald-600">{student.percent}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;