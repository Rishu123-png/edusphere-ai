export type Role = 'super_admin' | 'school_admin' | 'principal' | 'teacher' | 'student' | 'parent';

export interface School {
  id: string;
  name: string;
  schoolCode: string; // e.g. EDU-7Q2P
  address?: string;
  phone?: string;
  logoUrl?: string;
  createdBy: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  schoolId: string;
  photoURL?: string;
  phone?: string;
  active: boolean;
  createdAt: number;
}

export interface TeacherProfile extends UserProfile {
  role: 'teacher';
  teacherId: string;
  subjects: string[];
  classTeacherOf?: string; // classId e.g. "10-A"
  assignedClasses: string[];
}

export interface StudentProfile {
  id: string;
  schoolId: string;
  admissionNo: string;
  rollNo: string;
  name: string;
  photoUrl?: string;
  classId: string;
  section: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianPhone?: string;
  parentUid?: string;
  address?: string;
  classTeacherUid?: string;
  qrCode: string;
  status: 'active'|'inactive'|'tc';
  createdAt: number;
}

export interface ClassSchedule {
  id: string;
  schoolId: string;
  classId: string;
  subject: string;
  teacherUid: string;
  dayOfWeek: number; // 0-6
  startTime: string; // "09:00"
  endTime: string;
  room?: string;
}

export interface AttendanceSession {
  id: string;
  schoolId: string;
  classId: string;
  teacherUid: string;
  date: string; // YYYY-MM-DD
  startAt: number;
  expiresAt: number; // start + 5 min
  status: 'open'|'closed'|'late';
}

export interface AttendanceRecord {
  studentId: string;
  status: 'present'|'absent'|'late'|'half_day'|'leave'|'medical';
  markedAt: number;
  method: 'manual'|'qr'|'mobile';
}

export interface MarksRecord {
  id: string;
  studentId: string;
  schoolId: string;
  examType: 'unit_test'|'mid_term'|'final'|'practical'|'assignment'|'project';
  subject: string;
  marksObtained: number;
  maxMarks: number;
  term: string;
  date: string;
}
