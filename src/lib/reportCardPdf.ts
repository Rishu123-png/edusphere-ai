
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { gradeFromMarks, gpaFromMarks, PASSING_PERCENT, type GradeBand, GRADE_BANDS } from './utils'

export interface SubjectMark { subject: string; examType: string; obtained: number; max: number; remarks?: string }

export interface ReportCardInput {
  schoolName: string
  schoolAddress?: string
  studentName: string
  rollNumber: string
  className: string
  section: string
  guardianName?: string
  examName: string // e.g. "Mid-Term Examination 2026"
  attendancePct?: number
  subjects: SubjectMark[]
  teacherRemarks?: string
  principalSignLine?: string
  classTeacherSignLine?: string
  issueDate?: string
}

export function generateReportCard(input: ReportCardInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  // Header band
  doc.setFillColor(79, 70, 229) // indigo
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(input.schoolName, pageW / 2, 12, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(input.examName, pageW / 2, 19, { align: 'center' })
  if (input.schoolAddress) {
    doc.setFontSize(8)
    doc.text(input.schoolAddress, pageW / 2, 23.5, { align: 'center' })
  }

  y = 32
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('REPORT CARD', margin, y)
  y += 6

  // Student info block
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const info: Array<[string, string]> = [
    ['Student Name', input.studentName],
    ['Roll Number', input.rollNumber],
    ['Class & Section', `${input.className}-${input.section}`],
    ['Guardian', input.guardianName || '—'],
    ['Attendance', input.attendancePct != null ? `${input.attendancePct}%` : '—'],
    ['Issued', input.issueDate || new Date().toLocaleDateString('en-IN')],
  ]
  info.forEach(([k, v], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = margin + col * ((pageW - margin * 2) / 2)
    const yy = y + row * 6
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}: `, x, yy)
    doc.setFont('helvetica', 'normal')
    doc.text(String(v), x + 32, yy)
  })
  y += Math.ceil(info.length / 2) * 6 + 4

  // Marks table
  const body = input.subjects.map(s => {
    const pct = s.max ? Math.round((s.obtained / s.max) * 1000) / 10 : 0
    const grade = gradeFromMarks(s.obtained, s.max)
    const gpa = gpaFromMarks(s.obtained, s.max).toFixed(1)
    const pass = pct >= PASSING_PERCENT ? 'PASS' : 'FAIL'
    return [s.subject, s.examType.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), s.obtained, s.max, `${pct}%`, grade, gpa, pass]
  })
  const totalMax = input.subjects.reduce((s,x)=>s+x.max,0)
  const totalObt = input.subjects.reduce((s,x)=>s+x.obtained,0)
  const totalPct = totalMax ? Math.round((totalObt/totalMax)*1000)/10 : 0
  const overallGrade = gradeFromMarks(totalObt, totalMax)
  const overallGpa = gpaFromMarks(totalObt, totalMax).toFixed(2)

  autoTable(doc, {
    startY: y,
    head: [['Subject', 'Exam', 'Marks', 'Max', '%', 'Grade', 'GPA', 'Result']],
    body,
    foot: [['TOTAL', '', String(totalObt), String(totalMax), `${totalPct}%`, overallGrade, overallGpa, totalPct >= PASSING_PERCENT ? 'PASS' : 'FAIL']],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    footStyles: { fillColor: [238, 242, 255], textColor: 15, fontSize: 9, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  })

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 8

  // Grading scale
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Grading Scale', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const bands = GRADE_BANDS.slice().reverse()
  const bandText = bands.map((b: GradeBand) => `${b.grade}≥${b.min}% (GPA ${b.gpa})`).join('   ')
  doc.text(bandText, margin, y, { maxWidth: pageW - margin * 2 })
  y += 6

  // Remarks
  if (input.teacherRemarks) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Teacher Remarks', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const remarkLines = doc.splitTextToSize(input.teacherRemarks, pageW - margin * 2)
    doc.text(remarkLines, margin, y)
    y += remarkLines.length * 4.5 + 4
  }

  // Signature lines
  y = Math.max(y + 6, doc.internal.pageSize.getHeight() - 36)
  doc.setDrawColor(100, 116, 139)
  doc.line(margin, y, margin + 50, y)
  doc.line(pageW - margin - 50, y, pageW - margin, y)
  doc.line(pageW / 2 - 25, y, pageW / 2 + 25, y)
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Class Teacher', margin + 12, y + 4)
  doc.text('Principal', pageW / 2, y + 4, { align: 'center' })
  doc.text('Parent Signature', pageW - margin - 18, y + 4, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Generated by EduSphere AI • Smart School Management', pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' })

  return doc
}

export function downloadReportCard(input: ReportCardInput, filename?: string) {
  const pdf = generateReportCard(input)
  pdf.save(filename || `Report-${input.studentName.replace(/\s+/g,'_')}-${input.examName.replace(/\s+/g,'_')}.pdf`)
}
