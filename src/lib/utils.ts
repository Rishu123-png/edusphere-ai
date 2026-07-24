
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateSchoolCode = () => {
  return 'EDU-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const generateId = (prefix = '') => {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2,7)
}

export const formatDate = (d: Date | string | number) => {
  return new Intl.DateTimeFormat('en-IN', { year:'numeric', month:'short', day:'numeric'}).format(new Date(d))
}

export const calcPercentage = (present:number, total:number) => total ? Math.round((present/total)*1000)/10 : 0

/* CBSE-aligned grading */
export interface GradeBand { grade: string; min: number; gpa: number; color: string }
export const GRADE_BANDS: GradeBand[] = [
  { grade: 'A+', min: 91, gpa: 10, color: 'emerald' },
  { grade: 'A1', min: 81, gpa: 9,  color: 'emerald' },
  { grade: 'A2', min: 71, gpa: 8,  color: 'cyan' },
  { grade: 'B1', min: 61, gpa: 7,  color: 'cyan' },
  { grade: 'B2', min: 51, gpa: 6,  color: 'violet' },
  { grade: 'C1', min: 41, gpa: 5,  color: 'amber' },
  { grade: 'C2', min: 33, gpa: 4,  color: 'amber' },
  { grade: 'D',  min: 21, gpa: 3,  color: 'rose' },
  { grade: 'E1', min: 0,  gpa: 0,  color: 'rose' },
]
export const PASSING_PERCENT = 33

export const gradeFromMarks = (marks:number, max=100): string => {
  if (!Number.isFinite(marks) || !Number.isFinite(max) || max <= 0) return '—'
  const p = Math.max(0, Math.min(100, (marks/max)*100))
  for (const b of GRADE_BANDS) if (p >= b.min) return b.grade
  return 'E1'
}
export const gpaFromMarks = (marks:number, max=100): number => {
  if (!Number.isFinite(marks) || !Number.isFinite(max) || max <= 0) return 0
  const p = Math.max(0, Math.min(100, (marks/max)*100))
  for (const b of GRADE_BANDS) if (p >= b.min) return b.gpa
  return 0
}
export const gradeColor = (grade: string): string => {
  const b = GRADE_BANDS.find(g => g.grade === grade)
  return b?.color || 'slate'
}
export const gradeColorClasses = (grade: string): string => {
  const c = gradeColor(grade)
  const map: Record<string,string> = {
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    cyan:    'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
    violet:  'bg-violet-500/15 text-violet-300 border-violet-400/30',
    amber:   'bg-amber-500/15 text-amber-300 border-amber-400/30',
    rose:    'bg-rose-500/15 text-rose-300 border-rose-400/30',
    slate:   'bg-white/10 text-white/60 border-white/10',
  }
  return map[c] || map.slate
}

/* Default term weights (CBSE-style SA1/SA2 + 2 UTs) — schools can override */
export const DEFAULT_EXAM_WEIGHTS: Record<string, number> = {
  unit_test: 10,
  assignment: 5,
  project: 5,
  practical: 10,
  mid_term: 30,
  final: 40,
  internal: 0,
}

/**
 * Compute weighted aggregate percent across exams.
 * examMarks: { examType: { obtained, max } }  (status='absent' treated as 0 but notated)
 */
export interface ExamMark { obtained: number; max: number; status?: string }
export const computeWeighted = (
  examMarks: Record<string, ExamMark>,
  weights: Record<string, number> = DEFAULT_EXAM_WEIGHTS,
): { percent: number; gpa: number; grade: string; possibleOutOf: number } => {
  let totalWeighted = 0
  let totalWeight = 0
  for (const [exam, w] of Object.entries(weights)) {
    const em = examMarks[exam]
    if (!em || w <= 0) continue
    if (em.status === 'absent' || em.status === 'ufm' || em.status === 'medical') {
      // count the weight (it contributes 0)
      totalWeight += w
      continue
    }
    totalWeighted += (em.obtained / em.max) * 100 * w
    totalWeight += w
  }
  if (totalWeight === 0) return { percent: 0, gpa: 0, grade: '—', possibleOutOf: 0 }
  const percent = Math.round((totalWeighted / totalWeight) * 10) / 10
  return { percent, gpa: gpaFromMarks(percent, 100), grade: gradeFromMarks(percent, 100), possibleOutOf: totalWeight }
}

/* Simple linear predictor using the last N marks + attendance to predict final */
export interface HistoryPoint { percent: number; timestamp: number }
export const predictFinal = (
  history: HistoryPoint[],
  attendancePct = 80,
): { predicted: number; rangeLow: number; rangeHigh: number; confidence: number } => {
  const points = history.filter(p => Number.isFinite(p.percent)).sort((a,b)=>a.timestamp-b.timestamp)
  if (!points.length) return { predicted: 0, rangeLow: 0, rangeHigh: 0, confidence: 0 }
  // Linear regression over timestamp
  const n = points.length
  if (n === 1) {
    const p = points[0].percent
    const adjusted = p * 0.85 + attendancePct * 0.15
    return { predicted: Math.round(adjusted), rangeLow: Math.round(adjusted-6), rangeHigh: Math.round(adjusted+6), confidence: 0.4 }
  }
  const meanX = points.reduce((s,_p,i)=>s+i,0)/n
  const meanY = points.reduce((s,p)=>s+p.percent,0)/n
  let num=0, den=0
  points.forEach((p,i)=>{ num += (i-meanX)*(p.percent-meanY); den += (i-meanX)**2 })
  const slope = den ? num/den : 0
  const intercept = meanY - slope*meanX
  const predictedRaw = slope*n + intercept // next exam is at index n
  // Blend with attendance influence
  const attendanceBoost = (attendancePct - 75) * 0.15 // small effect
  const predicted = Math.max(0, Math.min(100, predictedRaw + attendanceBoost))
  // Confidence grows with more points and smaller variance
  const variance = points.reduce((s,p)=>s+(p.percent-meanY)**2,0)/n
  const stdev = Math.sqrt(variance)
  const margin = Math.min(12, 4 + stdev*0.5 - n*0.4)
  const confidence = Math.max(0.2, Math.min(0.95, 0.3 + n*0.12 - stdev*0.01))
  return {
    predicted: Math.round(predicted),
    rangeLow: Math.max(0, Math.round(predicted - margin)),
    rangeHigh: Math.min(100, Math.round(predicted + margin)),
    confidence: Math.round(confidence*100)/100,
  }
}

/* Class statistics */
export interface ClassStats {
  count: number
  avg: number
  median: number
  highest: number
  lowest: number
  passCount: number
  failCount: number
  passPct: number
  distribution: Record<string, number>
}
export const classStats = (marks: number[]): ClassStats => {
  const clean = marks.filter(m => Number.isFinite(m)).sort((a,b)=>a-b)
  const count = clean.length
  const avg = count ? clean.reduce((s,m)=>s+m,0)/count : 0
  const median = count ? (clean.length%2 ? clean[(clean.length-1)/2] : (clean[clean.length/2-1]+clean[clean.length/2])/2) : 0
  const highest = count ? clean[clean.length-1] : 0
  const lowest = count ? clean[0] : 0
  const passCount = clean.filter(m => m >= PASSING_PERCENT).length
  const failCount = count - passCount
  const passPct = count ? Math.round((passCount/count)*1000)/10 : 0
  const distribution: Record<string, number> = {}
  GRADE_BANDS.forEach(b => distribution[b.grade] = 0)
  clean.forEach(m => { distribution[gradeFromMarks(m,100)] = (distribution[gradeFromMarks(m,100)] || 0) + 1 })
  return { count, avg: Math.round(avg*10)/10, median, highest, lowest, passCount, failCount, passPct, distribution }
}

export const whatsappUrl = (phone:string, text:string) => {
  const clean = phone.replace(/\D/g,'')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}
