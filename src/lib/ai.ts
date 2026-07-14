
import { AttendanceRecord, MarksEntry } from '@/types'

export function predictMarks(previous: MarksEntry[], attendancePct: number) {
  if (!previous.length) return { predicted: 65, grade: 'B', passProb: 0.78 }
  const avg = previous.reduce((s, m) => s + (m.marksObtained / m.maxMarks * 100), 0) / previous.length
  const attendanceBoost = Math.max(-10, (attendancePct - 75) * 0.3)
  const trend = previous.length > 3 ? 3 : 1.5
  const predicted = Math.min(98, Math.max(25, avg + attendanceBoost + trend))
  const grade = predicted >= 90 ? 'A+' : predicted >= 80 ? 'A' : predicted >= 70 ? 'B+' : predicted >= 60 ? 'B' : predicted >= 50 ? 'C' : predicted >= 33 ? 'D' : 'F'
  return {
    predicted: Math.round(predicted * 10) / 10,
    grade,
    passProb: Math.min(0.99, Math.max(0.15, predicted / 100 * 0.85 + attendancePct / 100 * 0.35))
  }
}

export function attendanceRisk(records: AttendanceRecord[]) {
  if (records.length < 5) return { risk: 'low' as const, probability: 0.15, reasons: ['Insufficient data'] }
  const last30 = records.slice(-30)
  const absent = last30.filter(r => r.status === 'absent').length
  const late = last30.filter(r => r.status === 'late').length
  const pct = 1 - absent / last30.length
  const reasons: string[] = []
  if (pct < 0.75) reasons.push('Attendance below 75%')
  if (late > 4) reasons.push('Frequent late arrivals')
  const dow = new Date().getDay()
  const dowAbsents = records.filter(r => new Date(r.date).getDay() === dow && r.status === 'absent').length
  if (dowAbsents > 2) reasons.push(`Pattern: frequent ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]} absences`)
  const prob = Math.min(0.92, absent / last30.length + late * 0.02)
  const risk = prob > 0.5 ? 'high' : prob > 0.25 ? 'medium' : 'low'
  return { risk, probability: Math.round(prob * 100) / 100, reasons: reasons.length ? reasons : ['Stable attendance'] }
}

export function aiDailySummary(stats: { attendancePct: number, present: number, absent: number, late: number }) {
  const messages = [
    `${stats.attendancePct}% overall attendance`,
    `${stats.present} students present today`,
    stats.absent > 0 ? `${stats.absent} students absent — consider guardian notification` : 'No absences today',
  ]
  if (stats.attendancePct < 75) messages.push('AI Alert: Follow up with absent students')
  return messages
}

export function getStudentAIInsights(studentId: string, attendance: any[], marks: any[]) {
  const studentAttendance = attendance.filter(a => a.studentId === studentId)
  const studentMarks = marks.filter(m => m.studentId === studentId)
  const attPct = studentAttendance.length ? Math.round((studentAttendance.filter(a => a.status === 'present').length / studentAttendance.length) * 100) : 75
  const avgMarks = studentMarks.length ? studentMarks.reduce((s, m) => s + m.marksObtained, 0) / studentMarks.length : 65
  const prediction = predictMarks(studentMarks, attPct)
  return {
    attendancePct: attPct,
    averageMarks: Math.round(avgMarks),
    prediction,
    recommendation: attPct < 75 ? 'Improve attendance' : avgMarks < 60 ? 'Focus on weak subjects' : 'Good performance'
  }
}