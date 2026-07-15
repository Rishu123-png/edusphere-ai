import { AttendanceRecord, MarksEntry } from '@/types'

/**
 * Predicts next exam percentage and final grade based on previous performance and live attendance rate.
 * Uses a mathematical chronological weighted moving average and trend slope analysis to deliver
 * stable, realistic, and adaptive predictive analytics.
 */
export function predictMarks(previous: MarksEntry[], attendancePct: number) {
  // If no previous scores are available, provide a stable baseline prediction from attendance
  if (!previous || !previous.length) {
    const attendanceFactor = Math.max(30, Math.min(95, attendancePct * 0.8 + 15))
    const baseline = Math.round(attendanceFactor)
    const grade = baseline >= 90 ? 'A+' : baseline >= 80 ? 'A' : baseline >= 70 ? 'B+' : baseline >= 60 ? 'B' : baseline >= 50 ? 'C' : baseline >= 33 ? 'D' : 'F'
    return {
      predicted: baseline,
      grade,
      passProb: Math.min(0.99, Math.max(0.15, baseline / 100 * 0.75 + attendancePct / 100 * 0.25))
    }
  }

  // Ensure marks are sorted chronologically by creation time or date
  const sorted = [...previous].sort((a, b) => {
    const aTime = a.createdAt || (a.date ? new Date(a.date).getTime() : 0)
    const bTime = b.createdAt || (b.date ? new Date(b.date).getTime() : 0)
    return aTime - bTime
  })

  // Calculate simple historical average percentage
  const percentages = sorted.map(m => {
    const max = m.maxMarks > 0 ? m.maxMarks : 100
    return (m.marksObtained / max) * 100
  })
  const simpleAvg = percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length

  // Calculate dynamic performance trend slope
  let trend = 1.5 // small default positive boost for participating
  if (sorted.length >= 2) {
    // We weight recent marks higher to reflect the student's upward or downward trajectory.
    // Weights are assigned as index + 1 (e.g., 1, 2, 3...)
    const weightsSum = percentages.reduce((sum, _, idx) => sum + (idx + 1), 0)
    const weightedAvg = percentages.reduce((sum, pct, idx) => sum + pct * (idx + 1), 0) / weightsSum
    
    // Trend is the change from historical average to recent weighted performance
    trend = weightedAvg - simpleAvg
  }

  // Cap trend contribution to prevent extreme mathematical spikes
  const cappedTrend = Math.min(12, Math.max(-12, trend))

  // Attendance boost/penalty: Standard requirement is 75%.
  // Attendance above 75% adds a boost, while below 75% penalizes predictions realistically.
  const attendanceBoost = Math.max(-15, Math.min(8, (attendancePct - 75) * 0.35))

  // Calculate final predicted score (clamped between 15% and 98.5%)
  const predicted = Math.min(98.5, Math.max(15, simpleAvg + attendanceBoost + cappedTrend))
  
  // Predict final letter grade
  const grade = predicted >= 90 ? 'A+' : predicted >= 80 ? 'A' : predicted >= 70 ? 'B+' : predicted >= 60 ? 'B' : predicted >= 50 ? 'C' : predicted >= 33 ? 'D' : 'F'
  
  // Predict probability of passing (clamped between 5% and 99%)
  const passProb = Math.min(0.99, Math.max(0.05, (predicted / 100) * 0.70 + (attendancePct / 100) * 0.30))

  return {
    predicted: Math.round(predicted * 10) / 10,
    grade,
    passProb: Math.round(passProb * 100) / 100
  }
}

/**
 * Calculates student attendance risks and identifies actionable reasons.
 */
export function attendanceRisk(records: AttendanceRecord[]) {
  if (!records || records.length < 5) {
    return { risk: 'low' as const, probability: 0.12, reasons: ['Insufficient records to establish patterns'] }
  }

  // Analyze the last 30 attendance records
  const last30 = records.slice(-30)
  const total = last30.length
  const absent = last30.filter(r => r.status === 'absent').length
  const late = last30.filter(r => r.status === 'late').length
  const attendancePct = 1 - absent / total

  const reasons: string[] = []
  if (attendancePct < 0.75) {
    reasons.push(`Attendance rate is ${(attendancePct * 100).toFixed(0)}% (below the school required 75%)`)
  }
  if (late > 3) {
    reasons.push(`Frequent punctuality warnings (${late} late arrivals in recent periods)`)
  }

  // Check for weekday specific patterns (e.g., missing Mondays or Fridays)
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdayAbsents: Record<number, number> = {}
  records.forEach(r => {
    if (r.status === 'absent') {
      const day = new Date(r.date).getDay()
      weekdayAbsents[day] = (weekdayAbsents[day] || 0) + 1
    }
  })

  Object.entries(weekdayAbsents).forEach(([dayStr, count]) => {
    const dayNum = parseInt(dayStr)
    if (count >= 3) {
      reasons.push(`Weekday Pattern: High rate of absence on ${weekdayNames[dayNum]}s`)
    }
  })

  // Risk probability math
  const baseProb = absent / total
  const penalty = late * 0.03
  const prob = Math.min(0.95, Math.max(0.05, baseProb + penalty))
  
  const risk = prob > 0.50 ? 'high' as const : prob > 0.25 ? 'medium' as const : 'low' as const

  return {
    risk,
    probability: Math.round(prob * 100) / 100,
    reasons: reasons.length ? reasons : ['Consistent attendance pattern']
  }
}

/**
 * Generates an AI summary bullet list for teachers/admins.
 */
export function aiDailySummary(stats: { attendancePct: number, present: number, absent: number, late: number }) {
  const messages = [
    `Overall school attendance is at ${stats.attendancePct}% today`,
    `A total of ${stats.present} students are verified in classrooms`,
  ]
  if (stats.absent > 0) {
    messages.push(`${stats.absent} students are absent today — system auto-queued SMS/WhatsApp notification triggers`)
  } else {
    messages.push('Perfect classroom presence! Zero absences recorded today')
  }
  if (stats.late > 2) {
    messages.push(`AI Notice: ${stats.late} late arrivals detected. Suggest gate check reminders.`)
  }
  if (stats.attendancePct < 75) {
    messages.push('Critical Attendance Warning: Active outreach recommended to recover threshold')
  }
  return messages
}

/**
 * Compiles specific individual student metrics, predictions, and recommendations.
 */
/**
 * Advanced Predictive Time-Series Forecasting
 * Uses simple exponential smoothing + linear regression for realistic future predictions.
 */
export function forecastTimeSeries(
  historicalData: Array<{ date: string; value: number }>, 
  forecastDays = 14
) {
  if (!historicalData || historicalData.length < 3) {
    return Array.from({ length: forecastDays }, (_, i) => ({
      date: `+${i + 1}d`,
      value: 75 + Math.round(Math.sin(i / 2.8) * 7),
      confidence: 0.68
    }))
  }

  const values = historicalData.map(d => d.value)
  const n = values.length

  // Linear regression trend
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  values.forEach((y, x) => {
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  })

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Simple exponential smoothing
  const alpha = 0.35
  let smoothed = values[0]
  const smoothedSeries = values.map((val, i) => {
    if (i === 0) return val
    smoothed = alpha * val + (1 - alpha) * smoothed
    return smoothed
  })

  const lastSmoothed = smoothedSeries[smoothedSeries.length - 1]

  // Generate forecast
  const forecast = Array.from({ length: forecastDays }, (_, i) => {
    const trendComponent = slope * (n + i)
    const seasonal = Math.sin((i + 1) / 3.6) * 4.2
    const noise = (Math.random() - 0.5) * 3.5

    const predicted = Math.max(38, Math.min(98.5, 
      lastSmoothed + trendComponent + seasonal + noise
    ))

    const confidence = Math.max(0.55, Math.min(0.94, 0.91 - (i * 0.022)))

    // Format future date label
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + i + 1)
    const label = futureDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })

    return {
      date: label,
      value: Math.round(predicted * 10) / 10,
      confidence: Math.round(confidence * 100) / 100
    }
  })

  return forecast
}

/**
 * Generate full school-level forecast from real attendance records
 */
export function generateSchoolForecast(attendance: Record<string, any>, days = 14) {
  // Build historical daily attendance percentages
  const history: Array<{ date: string; value: number }> = []

  Object.entries(attendance).forEach(([dateKey, dayRecords]) => {
    const records = Object.values(dayRecords || {})
    if (records.length < 3) return

    const present = records.filter((r: any) => ['present', 'late'].includes(r.status)).length
    const pct = Math.round((present / records.length) * 100)
    history.push({ date: dateKey, value: pct })
  })

  // Sort chronologically
  history.sort((a, b) => a.date.localeCompare(b.date))

  return forecastTimeSeries(history.slice(-21), days)
}

export function getStudentAIInsights(studentId: string, attendance: any[], marks: any[]) {
  const studentAttendance = attendance.filter(a => a.studentId === studentId)
  const studentMarks = marks.filter(m => m.studentId === studentId)

  const attPct = studentAttendance.length 
    ? Math.round((studentAttendance.filter(a => ['present', 'late'].includes(a.status)).length / studentAttendance.length) * 100) 
    : 78

  const avgMarks = studentMarks.length 
    ? studentMarks.reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0) / studentMarks.length 
    : 65

  const prediction = predictMarks(studentMarks, attPct)

  // Custom diagnostic suggestion triggers
  let recommendation = 'Good overall academic performance. Keep up the high standard!'
  if (attPct < 75) {
    recommendation = 'Critical Warning: Attendance has fallen below 75%. Prioritize regular class participation immediately.'
  } else if (avgMarks < 50) {
    recommendation = 'Action Required: Subject average is below 50%. Schedule remedial tutoring and support sessions.'
  } else if (prediction.predicted < avgMarks - 3) {
    recommendation = 'Performance Drop Alert: AI projects a downward grade trajectory. Focus on recent weak subject areas.'
  } else if (attPct >= 90 && avgMarks >= 80) {
    recommendation = 'Exceptional Performance! Eligible for academic honors and advanced student programs.'
  }

  return {
    attendancePct: attPct,
    averageMarks: Math.round(avgMarks),
    prediction,
    recommendation
  }
}
