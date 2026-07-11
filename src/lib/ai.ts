import { AttendanceRecord, MarksEntry } from '@/types'

export function predictMarks(previous: MarksEntry[], attendancePct: number) {
  if (!previous.length) return { predicted: 65, grade: 'B', passProb: 0.78 }
  const avg = previous.reduce((s,m)=> s + (m.marksObtained/m.maxMarks*100),0)/previous.length
  const attendanceBoost = (attendancePct - 75) * 0.25
  const trend = previous.length > 2 ? 2.5 : 0
  const predicted = Math.min(98, Math.max(28, avg + attendanceBoost + trend))
  const grade = predicted >= 90 ? 'A+' : predicted >= 80 ? 'A' : predicted >= 70 ? 'B+' : predicted >= 60 ? 'B' : predicted >=50 ? 'C' : predicted>=33?'D':'F'
  return {
    predicted: Math.round(predicted*10)/10,
    grade,
    passProb: Math.min(0.99, Math.max(0.15, predicted/100*0.9 + attendancePct/100*0.3))
  }
}

export function attendanceRisk(records: AttendanceRecord[]) {
  if(records.length < 5) return { risk: 'low' as const, probability: 0.15, reasons: ['Insufficient data']}
  const last30 = records.slice(-30)
  const absent = last30.filter(r=> r.status==='absent').length
  const late = last30.filter(r=> r.status==='late').length
  const pct = 1 - absent/last30.length
  const reasons:string[] = []
  if(pct < 0.75) reasons.push('Attendance below 75%')
  if(late > 4) reasons.push('Frequent late arrivals')
  // day of week pattern
  const dow = new Date().getDay()
  const dowAbsents = records.filter(r=> new Date(r.date).getDay()===dow && r.status==='absent').length
  if(dowAbsents>2) reasons.push('Pattern: frequent '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]+' absences')

  const prob = Math.min(0.92, absent/last30.length + late*0.02)
  const risk = prob > 0.5 ? 'high' : prob > 0.25 ? 'medium' : 'low'
  return { risk, probability: Math.round(prob*100)/100, reasons: reasons.length?reasons:['Stable attendance'] }
}

export function aiDailySummary(stats: {attendancePct:number, present:number, absent:number, late:number}) {
  if (stats.present === 0 && stats.absent === 0 && stats.late === 0) {
    return [
      'No attendance has been saved for today yet.',
      'Use Manual, QR, or AI Camera attendance to generate live insights.',
      'Dashboard demo numbers are disabled; only real school records are shown.'
    ]
  }

  const messages = [
    `${stats.attendancePct}% overall attendance – ${stats.attendancePct>=75?'above the 75% threshold':'below 75%, action needed'}.`,
    `${stats.present} students marked present today.`,
    `${stats.absent} students absent today${stats.absent ? ' – review and notify guardians if required' : ''}.`,
    `${stats.late} late arrivals flagged today.`
  ]

  if (stats.attendancePct < 75) messages.push('AI recommends follow-up with absent students and guardians.')
  else messages.push('AI status: attendance is stable based on today’s saved records.')

  return messages
}
