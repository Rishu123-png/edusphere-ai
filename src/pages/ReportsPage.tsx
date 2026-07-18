import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import PageHeader from '@/components/mobile/PageHeader'
import ModuleArchitectureBanner from '@/components/ModuleArchitectureBanner'
import { FileDown, BarChart3, Download, Sparkles, Calendar, TrendingUp, CheckCircle2, AlertTriangle, FileSpreadsheet, Printer } from 'lucide-react'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts'
import { aiDailySummary } from '@/lib/ai'

export default function ReportsPage() {
  const { schoolId, school } = useSchool()
  const { profile } = useAuth()
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({})
  const [marks, setMarks] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reportTab, setReportTab] = useState<'weekly' | 'monthly' | 'graph' | 'summary'>('weekly')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    const unsubs: any[] = []

    unsubs.push(onValue(ref(db, `schools/${schoolId}/attendance`), snap => {
      setAttendanceMap(snap.val() || {})
    }))

    unsubs.push(onValue(ref(db, `schools/${schoolId}/marks`), snap => {
      const data = snap.val() || {}
      const list = Object.values(data).flatMap((studentMarks: any) => Object.values(studentMarks || {}))
      setMarks(list)
    }))

    unsubs.push(onValue(ref(db, `schools/${schoolId}/students`), snap => {
      const data = snap.val() || {}
      setStudents(Object.values(data))
      setLoading(false)
    }))

    return () => unsubs.forEach(u => u())
  }, [schoolId])

  // Flattened attendance records
  const allAttendance = useMemo(() => {
    const list: any[] = []
    Object.entries(attendanceMap).forEach(([dateStr, dayRecords]) => {
      Object.values(dayRecords || {}).forEach((rec: any) => {
        list.push({ date: dateStr, ...rec })
      })
    })
    return list
  }, [attendanceMap])

  // Filter for Weekly (past 7 days) and Monthly (past 30 days)
  const weeklyData = useMemo(() => {
    const trend: Array<{ date: string; present: number; absent: number; late: number; rate: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const label = new Date(Date.now() - i * 86400000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })
      const dayRecs = Object.values(attendanceMap[d] || {}) as any[]
      const p = dayRecs.filter(r => ['present', 'late'].includes(r.status)).length
      const a = dayRecs.filter(r => r.status === 'absent').length
      const l = dayRecs.filter(r => r.status === 'late').length
      const rate = dayRecs.length ? Math.round((p / dayRecs.length) * 100) : (students.length ? Math.round((p / students.length) * 100) : 0)
      trend.push({ date: label, present: p, absent: a, late: l, rate })
    }
    return trend
  }, [attendanceMap, students.length])

  const monthlyData = useMemo(() => {
    const trend: Array<{ date: string; present: number; absent: number; rate: number }> = []
    for (let i = 29; i >= 0; i -= 2) {
      const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const label = new Date(Date.now() - i * 86400000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })
      const dayRecs = Object.values(attendanceMap[d] || {}) as any[]
      const p = dayRecs.filter(r => ['present', 'late'].includes(r.status)).length
      const a = dayRecs.filter(r => r.status === 'absent').length
      const rate = dayRecs.length ? Math.round((p / dayRecs.length) * 100) : 0
      trend.push({ date: label, present: p, absent: a, rate })
    }
    return trend
  }, [attendanceMap])

  const totalPresent = allAttendance.filter(a => ['present', 'late'].includes(a.status)).length
  const totalAbsent = allAttendance.filter(a => a.status === 'absent').length
  const totalLate = allAttendance.filter(a => a.status === 'late').length
  const avgMarks = marks.length ? (marks.reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0) / marks.length).toFixed(1) : '—'

  const aiSummaryLines = useMemo(() => {
    const overallRate = allAttendance.length ? Math.round((totalPresent / allAttendance.length) * 100) : 0
    return aiDailySummary({
      attendancePct: overallRate,
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate
    })
  }, [allAttendance.length, totalPresent, totalAbsent, totalLate])

  const cleanReportText = (value: unknown) => String(value ?? '').replace(/[\u0000-\u001f<>]+/g, ' ').trim()

  const generatePDFReport = async (type: 'Comprehensive' | 'Weekly' | 'Monthly' = 'Comprehensive') => {
    if (exportingPdf) return
    setExportingPdf(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({ compress: true })
      doc.setFontSize(18)
      doc.text(`EduSphere AI Vision — ${type} School Report`, 14, 20)
      doc.setFontSize(11)
      doc.text(`School: ${cleanReportText(school?.name || 'Intelligent Campus')} • Generated on ${new Date().toLocaleString('en-IN')}`, 14, 28)
      doc.text(`Generated By: ${cleanReportText(profile?.displayName || profile?.email || 'Admin')}`, 14, 34)

      autoTable(doc, {
        startY: 42,
        head: [['Metric', 'Value / Summary']],
        body: [
          ['Total Enrolled Students', `${students.length} students`],
          ['Total Verified Attendance Records', `${allAttendance.length} check-ins`],
          ['Overall Present Check-Ins', `${totalPresent}`],
          ['Overall Absent Check-Ins', `${totalAbsent}`],
          ['Overall Late Arrivals', `${totalLate}`],
          ['School Average Exam Marks', `${avgMarks}%`],
          ['Report status', 'Live data exported from the authenticated school database'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      })

      const tableData = type === 'Weekly'
        ? weeklyData.map(d => [d.date, d.present, d.absent, d.late, `${d.rate}%`])
        : type === 'Monthly'
          ? monthlyData.map(d => [d.date, d.present, d.absent, 'N/A', `${d.rate}%`])
          : weeklyData.map(d => [d.date, d.present, d.absent, d.late, `${d.rate}%`])

      autoTable(doc, {
        startY: ((doc as any).lastAutoTable?.finalY || 42) + 12,
        head: [['Date / Period', 'Present', 'Absent', 'Late', 'Attendance Rate']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      })

      const startY = ((doc as any).lastAutoTable?.finalY || 42) + 14
      doc.setFontSize(13)
      doc.text('AI Executive Summary & Recommendations:', 14, startY)
      doc.setFontSize(10)
      aiSummaryLines.forEach((line, index) => {
        doc.text(`• ${cleanReportText(line)}`, 14, startY + 8 + (index * 6))
      })

      doc.save(`EduSphere_${type}_Report_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success(`PDF Generated • ${type} Report downloaded successfully!`)
    } catch (error) {
      console.error('PDF export failed', error)
      toast.error('Could not generate PDF report. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  const generateExcelReport = async () => {
    if (exportingExcel) return
    setExportingExcel(true)
    try {
      const XLSX = await import('xlsx')
      const wsData = [
        ['Report Title', 'EduSphere AI Vision — Executive Spreadsheet Export'],
        ['Generated On', new Date().toLocaleString()],
        [],
        ['Metric', 'Count/Rate'],
        ['Enrolled Students', students.length],
        ['Total Attendance Check-Ins', allAttendance.length],
        ['Total Present Check-Ins', totalPresent],
        ['Total Absent Check-Ins', totalAbsent],
        ['Total Late Arrivals', totalLate],
        ['Average Marks', `${avgMarks}%`],
        [],
        ['Weekly Breakdown Table'],
        ['Date', 'Present', 'Absent', 'Late', 'Rate %'],
        ...weeklyData.map(w => [w.date, w.present, w.absent, w.late, w.rate])
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'School AI Report')
      XLSX.writeFile(wb, `EduSphere_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Excel spreadsheet downloaded!')
    } catch (error) {
      console.error('Excel export failed', error)
      toast.error('Could not generate Excel report. Please try again.')
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="page-container space-y-4 pb-12">
      <PageHeader 
        title="AI Report Generator" 
        subtitle="One-Click PDF & Excel Exports • Weekly & Monthly Reports • Attendance Graphs • AI Summaries" 
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="gradient" size="sm" className="rounded-full h-10 px-4 font-bold shadow" onClick={() => generatePDFReport('Comprehensive')} disabled={exportingPdf}>
              <FileDown size={15} className="mr-1.5" /> Generate PDF Report
            </Button>
            <Button variant="outline" size="sm" className="rounded-full h-10 px-4 font-bold" onClick={generateExcelReport} disabled={exportingExcel}>
              <FileSpreadsheet size={15} className="mr-1.5 text-emerald-600" /> Export Excel
            </Button>
          </div>
        } 
      />

      <ModuleArchitectureBanner />

      {/* Quick One-Click Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 rounded-[24px] bg-gradient-to-br from-indigo-600 to-violet-600 text-white cursor-pointer hover:scale-[1.02] transition shadow-md" onClick={() => generatePDFReport('Comprehensive')}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2"><FileDown size={20}/></div>
          <div className="font-black text-[15px]">Full PDF Report</div>
          <div className="text-[11px] text-indigo-100 mt-0.5">Comprehensive campus audit</div>
        </Card>
        <Card className="p-4 rounded-[24px] bg-gradient-to-br from-emerald-600 to-teal-600 text-white cursor-pointer hover:scale-[1.02] transition shadow-md" onClick={() => { setReportTab('weekly'); generatePDFReport('Weekly'); }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2"><Calendar size={20}/></div>
          <div className="font-black text-[15px]">Weekly Report</div>
          <div className="text-[11px] text-emerald-100 mt-0.5">Past 7 days breakdown PDF</div>
        </Card>
        <Card className="p-4 rounded-[24px] bg-gradient-to-br from-cyan-600 to-blue-600 text-white cursor-pointer hover:scale-[1.02] transition shadow-md" onClick={() => { setReportTab('monthly'); generatePDFReport('Monthly'); }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2"><BarChart3 size={20}/></div>
          <div className="font-black text-[15px]">Monthly Report</div>
          <div className="text-[11px] text-cyan-100 mt-0.5">30-day trend analytics PDF</div>
        </Card>
        <Card className="p-4 rounded-[24px] bg-gradient-to-br from-amber-600 to-orange-600 text-white cursor-pointer hover:scale-[1.02] transition shadow-md" onClick={() => { setReportTab('summary'); window.print(); }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2"><Sparkles size={20}/></div>
          <div className="font-black text-[15px]">AI Summary Print</div>
          <div className="text-[11px] text-amber-100 mt-0.5">Print neural brief</div>
        </Card>
      </div>

      <Tabs value={reportTab} onValueChange={(val: any) => setReportTab(val)} className="w-full">
        <TabsList className="h-12 max-w-full overflow-x-auto scrollbar-hide rounded-full bg-slate-100 dark:bg-zinc-800 p-1 flex gap-1">
          <TabsTrigger value="weekly" className="rounded-full px-5 font-bold data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900">
            <Calendar size={15} className="mr-1.5 inline"/> Weekly Report
          </TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-full px-5 font-bold data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900">
            <BarChart3 size={15} className="mr-1.5 inline"/> Monthly Report
          </TabsTrigger>
          <TabsTrigger value="graph" className="rounded-full px-5 font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white shadow">
            <TrendingUp size={15} className="mr-1.5 inline"/> Attendance Graph
          </TabsTrigger>
          <TabsTrigger value="summary" className="rounded-full px-5 font-bold data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-zinc-900">
            <Sparkles size={15} className="mr-1.5 inline"/> AI Executive Summary
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: WEEKLY REPORT */}
        <TabsContent value="weekly" className="mt-4 space-y-4">
          <Card className="rounded-[26px] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="font-extrabold text-[15px] flex items-center gap-2">📅 7-Day Weekly Attendance Breakdown</div>
              <Button size="sm" variant="outline" className="rounded-full h-8 text-xs font-bold" onClick={() => generatePDFReport('Weekly')} disabled={exportingPdf}>
                <FileDown size={13} className="mr-1"/> PDF Export
              </Button>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/60 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                    <tr>
                      <th className="p-3.5 pl-5 text-left">Day / Date</th>
                      <th className="p-3.5 text-center">Present Check-Ins</th>
                      <th className="p-3.5 text-center">Late Arrivals</th>
                      <th className="p-3.5 text-center">Absent Check-Ins</th>
                      <th className="p-3.5 pr-5 text-right">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {weeklyData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-3.5 pl-5 font-bold">{row.date}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{row.present}</td>
                        <td className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">{row.late}</td>
                        <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">{row.absent}</td>
                        <td className="p-3.5 pr-5 text-right font-black">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs ${row.rate >= 75 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                            {row.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: MONTHLY REPORT */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card className="rounded-[26px] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="font-extrabold text-[15px] flex items-center gap-2">📆 30-Day Monthly Attendance Trend Analytics</div>
              <Button size="sm" variant="outline" className="rounded-full h-8 text-xs font-bold" onClick={() => generatePDFReport('Monthly')} disabled={exportingPdf}>
                <FileDown size={13} className="mr-1"/> PDF Export
              </Button>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/60 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                    <tr>
                      <th className="p-3.5 pl-5 text-left">Date Label</th>
                      <th className="p-3.5 text-center">Present & Late</th>
                      <th className="p-3.5 text-center">Absent</th>
                      <th className="p-3.5 pr-5 text-right">Daily Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {monthlyData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-3.5 pl-5 font-bold">{row.date}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{row.present}</td>
                        <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">{row.absent}</td>
                        <td className="p-3.5 pr-5 text-right font-black">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs ${row.rate >= 75 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                            {row.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ATTENDANCE GRAPH */}
        <TabsContent value="graph" className="mt-4 space-y-4">
          <Card className="rounded-[26px] p-5 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-[16px] font-black flex items-center gap-2">📈 Interactive Campus Attendance Graph</CardTitle>
                <p className="text-[12px] text-muted-foreground mt-0.5">Visual rate visualization across historical scans and biometric check-ins.</p>
              </div>
              <Button size="sm" variant="gradient" className="rounded-full font-bold h-9 px-4" onClick={() => generatePDFReport('Comprehensive')} disabled={exportingPdf}>
                <FileDown size={14} className="mr-1.5"/> Download Graph & PDF Report
              </Button>
            </div>
            <div className="h-[280px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.6}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={12} fontStyle="bold"/>
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12}/>
                  <Tooltip contentStyle={{ borderRadius: '18px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} />
                  <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={3} fill="url(#reportGrad)" dot={{ r: 5, fill: '#10b981' }} activeDot={{ r: 7 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
{/* TAB 4: AI SUMMARY */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          <Card className="rounded-[26px] p-6 border border-slate-200 dark:border-zinc-800 space-y-4 bg-gradient-to-br from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-900/60 shadow-sm">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[18px] font-black flex items-center gap-2">
                <Sparkles className="text-cyan-500"/> AI Executive Neural Audit Summary
              </CardTitle>
              <Button size="sm" variant="outline" className="rounded-full font-bold" onClick={() => window.print()}>
                <Printer size={14} className="mr-1.5"/> Print Summary
              </Button>
            </div>
            <div className="space-y-3 pt-2 text-[14px] leading-relaxed font-medium text-foreground">
              {aiSummaryLines.map((line, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-150 dark:border-zinc-700 flex items-start gap-3 shadow-xs">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-500 font-bold flex items-center justify-center shrink-0 mt-0.5">✓</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-semibold">
              ⚡ All report metrics and AI summaries are generated in real-time right from your authenticated Firebase school database. Click &quot;Generate PDF Report&quot; anytime for a downloadable formal document.
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}