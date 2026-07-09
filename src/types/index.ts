export type UserRole = 'superadmin' | 'schooladmin' | 'principal' | 'teacher' | 'student' | 'parent';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  schoolId?: string;
  photoURL?: string;
  phone?: string;
}

export interface Student {
  id: string;
  admissionNo: string;
  rollNo: string;
  name: string;
  class: string;
  section: string;
  house: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  email?: string;
  phone: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  emergencyContact: string;
  photoURL?: string;
  status: 'active' | 'inactive' | 'graduated';
  schoolId: string;
  createdAt: string;
}

export interface Teacher {
  id: string;
  teacherId: string;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  classes: string[];
  qualification: string;
  experience: number;
  photoURL?: string;
  schoolId: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'halfday' | 'leave' | 'medical';
  class: string;
  section: string;
  markedBy: string;
  timestamp: string;
}

export interface Marks {
  id: string;
  studentId: string;
  subject: string;
  examType: string;
  marks: number;
  maxMarks: number;
  date: string;
  teacherId: string;
}

export interface Class {
  id: string;
  name: string;
  sections: string[];
  schoolId: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
  description: string;
  schoolId: string;
}

export interface AIInsight {
  studentId: string;
  type: 'marks_prediction' | 'attendance_risk' | 'performance';
  predictedMarks?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  suggestion: string;
  confidence: number;
}