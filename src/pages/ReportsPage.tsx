import { useEffect, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import { FileDown, BarChart3, Download } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportsPage() {
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const [attendance, setAttendance] = useState<any[]>([])
  const [marks, setMarks] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId) return

    const unsubs: any[] = []

    // Attendance
    unsubs.push(onValue(ref(db, `schools/${schoolId}/attendance`), snap => {
      const data = snap.val() || {}
      const list = Object.values(data).flatMap((day: any) => Object.values(day || {}))
      setAttendance(list)
    }))

    // Marks
    unsubs.push(onValue(ref(db, `schools/${schoolId}/marks`), snap => {
      const data = snap.val() || {}
      const list = Object.values(data).flatMap((studentMarks: any) => Object.values(studentMarks || {}))
      setMarks(list)
    }))

    // Students
    unsubs.push(onValue(ref(db, `schools/${schoolId}/students`), snap => {
      const data = snap.val() || {}
      setStudents(Object.values(data))
      setLoading(false)
    }))

    return () => unsubs.forEach(u => u())
  }, [schoolId])

  const totalPresent = attendance.filter((a: any) => a.status === 'present').length
  const totalAbsent = attendance.length - totalPresent
  const avgMarks = marks.length ? (marks.reduce((sum: number, m: any) => sum + (m.marksObtained || 0), 0) / marks.length).toFixed(1) : '—'

  const exportToExcel = () => {
    const wsData = [
      ['Report Type', 'Total Records', 'Present/Avg', 'Generated On'],
      ['Attendance', attendance.length, `${totalPresent} Present`, new Date().toLocaleDateString()],
      ['Marks', marks.length, `${avgMarks}% Average`, new Date().toLocaleDateString()],
      ['Students', students.length, '—', new Date().toLocaleDateString()],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'School Report')
    XLSX.writeFile(wb, `EduSphere_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Excel report downloaded!')
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    doc.text('EduSphere AI - School Report', 14, 20)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total Students', students.length],
        ['Total Attendance Records', attendance.length],
        ['Present', totalPresent],
        ['Absent', totalAbsent],
        ['Average Marks', `${avgMarks}%`],
      ]
    })

    doc.save(`EduSphere_Report_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF report downloaded!')
  }

  return (
    <div className="page-container space-y-4">
      <PageHeader 
        title="Reports" 
        subtitle="Analytics • Export PDF/Excel/CSV" 
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full h-9" onClick={exportToPDF}>
              <FileDown size={14} className="mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-9" onClick={exportToExcel}>
              <Download size={14} className="mr-1" /> Excel
            </Button>
          </div>
        } 
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { title: 'Daily', value: attendance.length, desc: 'Attendance records' },
          { title: 'Weekly', value: Math.floor(attendance.length / 7), desc: 'Avg weekly' },
          { title: 'Monthly', value: Math.floor(attendance.length / 30), desc: 'This month' },
          { title: 'Student Performance', value: students.length, desc: `${avgMarks}% avg` },
          { title: 'Teacher Reports', value: marks.length, desc: 'Marks entries' },
          { title: 'Overall School', value: totalPresent, desc: `${totalAbsent} absent` },
        ].map((r, i) => (
          <Card key={i} className="rounded-[20px] hover:shadow-md transition p-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <BarChart3 size={16} /> {r.title}
            </CardTitle>
            <CardContent className="text-[12px] text-muted-foreground mt-1">
              {r.value} • {r.desc}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[20px]">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-4xl">📊</div>
          <div className="font-bold">Live School Analytics</div>
          <p className="text-sm text-muted-foreground">
            Real-time data from Attendance & Marks. Export buttons above generate actual files.
          </p>
          <div className="text-xs text-muted-foreground">
            {loading ? 'Loading data...' : `${attendance.length} attendance + ${marks.length} marks records`}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}