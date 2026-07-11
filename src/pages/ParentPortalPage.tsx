import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/mobile/PageHeader'
import { db } from '@/lib/firebase'
import { ref, onValue } from 'firebase/database'
import { useSchool } from '@/contexts/SchoolContext'
import { useAuth } from '@/contexts/AuthContext'
import { todayIST } from '@/lib/rtdb'
import { toast } from 'sonner'

export default function ParentPortalPage(){
  const { schoolId } = useSchool()
  const { profile } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, any>>({})
  const [marksData, setMarksData] = useState<Record<string, any>>({})

  useEffect(()=>{
    if(!schoolId){ setStudents([]); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/students`), snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id,s]:any)=>({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setAttendance({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), snap=> setAttendance(snap.val() || {}))
    return ()=>unsub()
  }, [schoolId])

  useEffect(()=>{
    if(!schoolId){ setMarksData({}); return }
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), snap=> setMarksData(snap.val() || {}))
    return ()=>unsub()
  }, [schoolId])

  // Parent view: match by guardian phone/email when available; otherwise show empty state
  const linkedStudents = useMemo(()=>{
    const phone = (profile as any)?.phone || ''
    const email = profile?.email || ''
    return students.filter((s:any)=>{
      if (phone && s.guardianPhone && String(s.guardianPhone).replace(/\D/g,'') === String(phone).replace(/\D/g,'')) return true
      if (email && s.guardianEmail && String(s.guardianEmail).toLowerCase() === email.toLowerCase()) return true
      return false
    })
  }, [students, profile])

  const child = linkedStudents[0]
  const childRecords = useMemo(()=>{
    if(!child) return []
    return Object.values(attendance).flatMap((day:any)=> Object.values(day || {}).filter((r:any)=>r.studentId === child.id)) as any[]
  }, [attendance, child])

  const presentLike = childRecords.filter((r:any)=>['present','late'].includes(r.status)).length
  const attendancePct = childRecords.length ? Math.round((presentLike / childRecords.length) * 1000) / 10 : 0
  const absents = childRecords.filter((r:any)=>r.status==='absent').length
  const todayStatus = child ? (attendance[todayIST()]?.[child.id]?.status || 'Not marked') : '—'

  const latestMark = useMemo(()=>{
    if(!child) return null
    const entries = Object.values(marksData[child.id] || {}) as any[]
    if(!entries.length) return null
    return entries.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]
  }, [marksData, child])

  return <div className="page-container space-y-4">
    <PageHeader title="Parent Portal" subtitle="Child progress from your school records" />
    {!child ? (
      <Card className="p-10 text-center text-muted-foreground rounded-[20px]">
        No linked student found for this account. Ask school admin to save guardian phone/email on the student profile matching your login details.
      </Card>
    ) : (
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="rounded-[20px]">
          <CardTitle>Attendance</CardTitle>
          <CardContent className="text-[24px] font-extrabold">
            {childRecords.length ? `${attendancePct}%` : '—'}
            <div className="text-[12px] font-normal text-muted-foreground mt-1">
              {child.name} • Today: {todayStatus} • Absents: {absents}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardTitle>Marks</CardTitle>
          <CardContent>
            {latestMark
              ? `Latest: ${latestMark.subject} ${latestMark.marksObtained}/${latestMark.maxMarks} – ${latestMark.grade || ''}`
              : 'No marks published yet for this student.'}
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardTitle>Leave</CardTitle>
          <CardContent>
            <Button variant="gradient" size="sm" className="rounded-full w-full" onClick={()=>toast('Leave request feature will notify school admin once enabled.')}>Apply Leave</Button>
          </CardContent>
        </Card>
      </div>
    )}
  </div>
}
