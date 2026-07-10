export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent'

export interface AppUser {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  role: UserRole
  schoolId?: string
  schoolCode?: string
  phone?: string
  createdAt: number
  lastLogin?: number
  isOnline?: boolean
  mustResetPassword?: boolean
}

export interface School {
  id: string
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  principal?: string
  logoUrl?: string
  createdBy: string
  createdAt: number
}

export interface Teacher {
  id: string
  uid?: string
  teacherId: string
  name: string
  email: string
  phone?: string
  photoUrl?: string
  schoolId: string
  subjects: string[]
  assignedClasses: string[]
  classTeacherOf?: string // e.g. "10-A"
  qualification?: string
  experience?: number
  isOnline?: boolean
  lastSeen?: number
  createdAt: number
}

export interface Student {
  id: string
  admissionNumber: string
  rollNumber: string
  name: string
  photoUrl?: string
  className: string
  section: string
  house?: string
  dob?: string
  gender?: 'male'|'female'|'other'
  bloodGroup?: string
  schoolId: string
  classTeacherId?: string
  guardianName?: string
  guardianPhone?: string
  guardianEmail?: string
  emergencyContact?: string
  address?: string
  medicalInfo?: string
  status: 'active'|'inactive'|'tc'
  createdAt: number
  qrCode?: string
}

export interface ClassSchedule {
  id: string
  schoolId: string
  teacherId: string
  className: string
  section: string
  subject: string
  dayOfWeek: number // 0-6
  startTime: string // "08:30"
  endTime: string
  room?: string
  isActive: boolean
}

export interface AttendanceRecord {
  id: string
  schoolId: string
  studentId: string
  className: string
  section: string
  date: string // YYYY-MM-DD
  status: 'present'|'absent'|'late'|'half_day'|'leave'|'medical_leave'
  markedBy: string
  subject?: string
  method: 'manual'|'qr'|'ai_camera'|'mobile'
  timestamp: number
  scheduleId?: string
}

export interface MarksEntry {
  id: string
  schoolId: string
  studentId: string
  subject: string
  examType: 'unit_test'|'assignment'|'project'|'practical'|'mid_term'|'final'|'internal'
  marksObtained: number
  maxMarks: number
  grade?: string
  remarks?: string
  enteredBy: string
  date: string
  createdAt: number
}

export interface NotificationItem {
  id: string
  schoolId: string
  toRole?: UserRole
  toUserId?: string
  title: string
  body: string
  type: 'attendance'|'marks'|'alert'|'homework'|'announcement'|'ai'
  read: boolean
  createdAt: number
  meta?: any
}

export interface AIPrediction {
  studentId: string
  predictedMarks: number
  expectedGrade: string
  passProbability: number
  weakSubjects: string[]
  strongSubjects: string[]
  suggestions: string[]
}

export interface AttendanceRisk {
  studentId: string
  risk: 'low'|'medium'|'high'
  probability: number
  reasons: string[]
}
