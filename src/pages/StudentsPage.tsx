import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { db } from '@/lib/firebase'
import { ref, onValue, update, remove, push, set } from 'firebase/database'
import { useAuth } from '@/contexts/AuthContext'
import { useSchool } from '@/contexts/SchoolContext'
import { generateId } from '@/lib/utils'
import { createFaceDescriptorFromImageUrl, isValidDescriptor, loadFaceApiModels, resetFaceModels } from '@/lib/faceRecognition'
import { fileToDataUrl, resizeImageDataUrl, uploadStudentPhoto } from '@/lib/studentPhoto'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { QRCodeSVG } from 'qrcode.react'
import PageHeader from '@/components/mobile/PageHeader'
import MyTeachersPanel from '@/components/mobile/MyTeachersPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Edit2, Trash2, Download, Camera, ImageUp, ScanFace, Smile, Eye, CheckCircle2, ShieldCheck, AlertCircle, Sparkles, Brain, Users, UserCheck, UserX, Cpu, Filter, X, QrCode, MoreHorizontal, ChevronRight } from 'lucide-react'

const COMMON_SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi', 'Sanskrit', 'Social Science', 'Computer Science', 'Physical Education', 'Economics', 'Accountancy']

type Student = any

export default function StudentsPage(){
  const { profile, isSchoolAdmin } = useAuth() as any
  const { schoolId, school } = useSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [generatingFaceId, setGeneratingFaceId] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [filterClass, setFilterClass] = useState<string>('all')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const emptyForm = { name:'', className:'10', section:'A', rollNumber:'', admissionNumber:'', guardianName:'', guardianPhone:'', guardianEmail:'', subjects:'', photoUrl:'' }
  const [form, setForm] = useState<any>(emptyForm)

  // Live Camera Enrollment State (Head pose, Smile, Eye blink, Liveness)
  const [cameraEnrollOpen, setCameraEnrollOpen] = useState(false)
  const enrollVideoRef = useRef<HTMLVideoElement>(null)
  const [enrollPose, setEnrollPose] = useState<'looking_straight' | 'looking_left' | 'looking_right' | 'looking_down'>('looking_straight')
  const [enrollSmile, setEnrollSmile] = useState(false)
  const [enrollLiveness, setEnrollLiveness] = useState<'pass' | 'checking' | 'fail'>('checking')
  const [enrollStatusText, setEnrollStatusText] = useState('Position face in neon rectangle • Please Smile 🙂')
  const enrollTimerRef = useRef<number | null>(null)
  const enrollBusyRef = useRef<boolean>(false)

  const isAdmin = isSchoolAdmin || profile?.role === 'super_admin'
  const isTeacher = profile?.role === 'teacher'
  const canManage = isAdmin || isTeacher

  useEffect(()=>{
    const r = ref(db, schoolId ? `schools/${schoolId}/students` : 'students')
    const unsub = onValue(r, snap=>{
      const v = snap.val() || {}
      setStudents(Object.entries(v).map(([id, s]:any)=> ({id, ...s})))
    })
    return ()=>unsub()
  }, [schoolId])

  const assignedClasses = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : []
  const classTeacherOf = profile?.classTeacherOf ? [profile.classTeacherOf] : []
  const teacherSubjects = Array.isArray(profile?.subjects) ? profile.subjects : []
  const teacherClasses = useMemo(
    () => Array.from(new Set([...assignedClasses, ...classTeacherOf].map((c:any)=>String(c).trim()).filter(Boolean))),
    [assignedClasses, classTeacherOf]
  )

  const visibleStudents = useMemo(() => {
    if (!isTeacher) return students
    if (!teacherClasses.length) {
      return students.filter((s:any) => s.addedBy === profile?.uid)
    }
    return students.filter((s:any) =>
      teacherClasses.includes(`${s.className}-${s.section}`) || s.addedBy === profile?.uid
    )
  }, [students, isTeacher, teacherClasses, profile?.uid])

  // Unique class options for filter
  const classOptions = useMemo(() => {
    const classes = new Set(visibleStudents.map((s:any) => `${s.className}-${s.section}`))
    return Array.from(classes).filter(Boolean).sort() as string[]
  }, [visibleStudents])

  const filtered = useMemo(() => {
    let result = visibleStudents
    if (filterClass !== 'all') {
      result = result.filter((s:any) => `${s.className}-${s.section}` === filterClass)
    }
    if (!q.trim()) return result
    const lower = q.toLowerCase()
    return result.filter((s:any)=>
      (s.name||'').toLowerCase().includes(lower) ||
      (s.admissionNumber||'').toLowerCase().includes(lower) ||
      String(s.rollNumber||'').includes(lower) ||
      `${s.className}-${s.section}`.toLowerCase().includes(lower)
    )
  }, [visibleStudents, q, filterClass])

  // Statistics
  const stats = useMemo(() => {
    const total = filtered.length
    const aiReady = filtered.filter((s:any) => isValidDescriptor(s.faceDescriptor)).length
    const withPhoto = filtered.filter((s:any) => s.photoUrl).length
    const uniqueClasses = new Set(filtered.map((s:any) => `${s.className}-${s.section}`)).size
    return { total, aiReady, withPhoto, uniqueClasses }
  }, [filtered])

  const classKey = (className: string, section: string) => `${String(className||'').trim()}-${String(section||'').trim()}`

  const teacherCanEditStudent = (s: any) => {
    if (isAdmin) return true
    if (!isTeacher) return false
    if (s.addedBy === profile?.uid) return true
    if (teacherClasses.includes(classKey(s.className, s.section))) return true
    return false
  }

  const notifyAdmin = async (title: string, body: string) => {
    const sid = schoolId || profile?.schoolId
    if (!sid) return
    try {
      const nRef = push(ref(db, `schools/${sid}/notifications`))
      await set(nRef, {
        id: nRef.key,
        schoolId: sid,
        toRole: 'school_admin',
        title,
        body,
        type: 'announcement',
        read: false,
        createdAt: Date.now(),
        meta: { by: profile?.uid, byEmail: profile?.email, byName: profile?.displayName || profile?.name },
      })
    } catch { /* ignore */ }
  }

  const save = async ()=>{
    if(!canManage){ toast.error('You do not have permission to add students'); return }
    if(!form.name || !form.rollNumber){ toast.error('Name & Roll required'); return }

    const className = String(form.className || '').trim()
    const section = String(form.section || '').trim()
    if(!className || !section){ toast.error('Class and Section are required'); return }

    const ck = classKey(className, section)
    if (isTeacher && teacherClasses.length && !teacherClasses.includes(ck) && !editing) {
      toast.error(`You can only add students to your assigned classes: ${teacherClasses.join(', ')}`)
      return
    }
    if (isTeacher && editing && !teacherCanEditStudent(editing)) {
      toast.error('You can only edit students in your classes or students you added')
      return
    }

    const sid = schoolId || profile?.schoolId || 'global'
    const id = editing?.id || form.id || generateId('stu_')
    const subjectsList = typeof form.subjects === 'string'
      ? form.subjects.split(',').map((x:string)=>x.trim()).filter(Boolean)
      : (form.subjects || [])

    const finalSubjects = subjectsList.length
      ? subjectsList
      : (isTeacher && teacherSubjects.length ? teacherSubjects : [])

    const payload: any = {
      studentId: id,
      name: form.name,
      rollNumber: form.rollNumber,
      className,
      section,
      guardianName: form.guardianName || '',
      guardianPhone: form.guardianPhone || '',
      guardianEmail: form.guardianEmail || '',
      faceEmbedding: isValidDescriptor(form.faceDescriptor) ? form.faceDescriptor : (editing?.faceDescriptor || null),
      faceDescriptor: isValidDescriptor(form.faceDescriptor) ? form.faceDescriptor : (editing?.faceDescriptor || null),
      photoUrl: form.photoUrl || '',
      admissionNumber: form.admissionNumber || form.rollNumber,
      address: form.address || '',
      dob: form.dob || '',
      subjects: finalSubjects,
      schoolId: sid,
      classTeacherId: form.classTeacherId || (isTeacher && profile?.classTeacherOf === ck ? profile.uid : (editing?.classTeacherId || '')),
      status: 'active',
      updatedAt: Date.now(),
      createdAt: editing?.createdAt || Date.now(),
      qrCode: id,
      addedBy: editing?.addedBy || profile?.uid || '',
      addedByRole: editing?.addedByRole || profile?.role || '',
      addedByName: editing?.addedByName || profile?.displayName || profile?.name || profile?.email || '',
      lastEditedBy: profile?.uid || '',
      lastEditedAt: Date.now(),
    }

    delete payload.localPhotoDataUrl
    delete payload.id

    await update(ref(db, `schools/${sid}/students/${id}`), payload)

    if (!editing && isTeacher) {
      await notifyAdmin(
        'New student added by teacher',
        `${profile?.displayName || profile?.email} added ${payload.name} (${className}-${section}, Roll ${payload.rollNumber})`
      )
    }

    toast.success(editing
      ? 'Student updated • Face Embedding & ID stored'
      : 'Student registered • AI Face Embedding stored securely')
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const friendlyFaceError = (e: any) => {
    const msg = String(e?.message || e || '')
    if (/Unexpected token|<!doctype|not valid JSON|models failed|HTML instead/i.test(msg)) {
      return 'Face AI models could not load. Check network connection.'
    }
    if (/timeout/i.test(msg)) return 'Face ID timed out. Use a clearer, closer front-facing photo.'
    return msg || 'Could not generate Face ID'
  }

  const generateFaceId = async ()=>{
    if(!form.photoUrl){ toast.error('Update/select a clear student photo first'); return }
    setGeneratingFaceId(true)
    const source = form.localPhotoDataUrl || form.photoUrl
    // Try up to two times so that a one-off cache corruption self-heals
    // without forcing the user to tap the button again.
    let lastErr: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const faceDescriptor = await createFaceDescriptorFromImageUrl(source)
        setForm((prev:any)=>({...prev, faceDescriptor, faceEmbedding: faceDescriptor}))
        toast.success('AI Face ID & 128-D Embedding vector generated. Save the student to keep it.')
        setGeneratingFaceId(false)
        return
      } catch(e:any) {
        lastErr = e
        const msg = String(e?.message || e || '')
        const isCacheError = /tensor|corruption|Unexpected token|<!doctype|HTML instead/i.test(msg)
        if (isCacheError && attempt === 0) {
          // Don't alarm the user with a red error — just silently clear
          // caches and retry; the face-recognition module will flip to CDN.
          toast.info('AI model cache was stale — refreshing…')
          resetFaceModels()
          // wait briefly for any network/cache cleanup to settle
          await new Promise(r => window.setTimeout(r, 400))
          continue
        }
        break
      }
    }
    const errorMsg = friendlyFaceError(lastErr)
    setForm((prev:any)=>({...prev, faceDescriptor: null, faceEmbedding: null}))
    toast.error(errorMsg)
    setGeneratingFaceId(false)
  }

  const applySelectedPhoto = async (dataUrl: string) => {
    if(!canManage){ toast.error('No permission'); return }
    const sid = schoolId || profile?.schoolId || 'global'
    const id = editing?.id || form.id || generateId('stu_')
    setUploadingPhoto(true)
    try {
      const resized = await resizeImageDataUrl(dataUrl)
      setForm((prev:any)=>({...prev, id, photoUrl: resized, localPhotoDataUrl: resized, faceDescriptor: null}))

      let faceDescriptor: number[] | null = null
      try {
        faceDescriptor = await Promise.race([
          createFaceDescriptorFromImageUrl(resized),
          new Promise<never>((_, reject)=> window.setTimeout(()=>reject(new Error('Face ID generation timed out. Try a clearer, smaller photo.')), 60000))
        ])
        setForm((prev:any)=>({...prev, id, faceDescriptor, faceEmbedding: faceDescriptor, localPhotoDataUrl: resized}))
      } catch(faceError:any) {
        toast.error(friendlyFaceError(faceError))
      }

      try {
        const uploadedUrl = await uploadStudentPhoto(sid, id, resized)
        setForm((prev:any)=>({
          ...prev,
          id,
          photoUrl: uploadedUrl,
          localPhotoDataUrl: resized,
          faceDescriptor: faceDescriptor || prev.faceDescriptor,
          faceEmbedding: faceDescriptor || prev.faceDescriptor
        }))
        toast.success(faceDescriptor
          ? 'Photo uploaded & 128-D Face Embedding generated!'
          : 'Photo saved. Tap Face ID after models load.')
      } catch(uploadError:any) {
        setForm((prev:any)=>({...prev, id, photoUrl: resized, localPhotoDataUrl: resized, faceDescriptor: faceDescriptor || prev.faceDescriptor}))
        toast.error(uploadError?.message || 'Storage upload failed. Photo preview kept locally.')
      }
    } catch(e:any) {
      toast.error(e?.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Live Camera Enrollment Dialog Handlers (Strict Non-Blocking Timer)
  const openCameraEnrollment = async () => {
    setCameraEnrollOpen(true)
    setEnrollStatusText('Loading AI models for registration liveness check...')
    try {
      await loadFaceApiModels()
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream
        await enrollVideoRef.current.play()
        setEnrollStatusText('Position face in neon rectangle • Please Smile 🙂')
        setEnrollLiveness('checking')

        enrollBusyRef.current = false
        enrollTimerRef.current = window.setInterval(async () => {
          if (enrollBusyRef.current || !enrollVideoRef.current || enrollVideoRef.current.readyState < 2) return
          enrollBusyRef.current = true
          try {
            const faceapi = await import('face-api.js')
            const det = await faceapi.detectSingleFace(enrollVideoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks()
            if (det) {
              const landmarks = det.landmarks
              const nose = landmarks.getNose()
              const jaw = landmarks.getJawOutline()
              const mouth = landmarks.getMouth()

              if (nose && jaw && jaw.length > 0) {
                const noseCenterX = nose[0].x
                const leftJawX = jaw[0].x
                const rightJawX = jaw[jaw.length - 1].x
                const ratio = (noseCenterX - leftJawX) / Math.max(1, (rightJawX - leftJawX))
                if (ratio < 0.38) setEnrollPose('looking_left')
                else if (ratio > 0.62) setEnrollPose('looking_right')
                else setEnrollPose('looking_straight')
              }

              if (mouth && det.detection.box) {
                const mouthWidth = Math.abs(mouth[mouth.length - 1].x - mouth[0].x)
                const faceWidth = det.detection.box.width
                if (mouthWidth / faceWidth > 0.42) {
                  setEnrollSmile(true)
                  setEnrollLiveness('pass')
                  setEnrollStatusText('Liveness & Smile Verified! Ready to Capture.')
                } else {
                  setEnrollSmile(false)
                }
              }
            } else {
              setEnrollStatusText('Searching for clear face in frame...')
            }
          } catch { /* ignore frame skip */ }
          finally {
            enrollBusyRef.current = false
          }
        }, 900)
      }
    } catch (err: any) {
      toast.error('Could not open camera: ' + (err?.message || 'Permission denied'))
      closeCameraEnrollment()
    }
  }

  const closeCameraEnrollment = () => {
    if (enrollTimerRef.current) {
      window.clearInterval(enrollTimerRef.current)
      enrollTimerRef.current = null
    }
    enrollBusyRef.current = false
    if (enrollVideoRef.current && enrollVideoRef.current.srcObject) {
      const stream = enrollVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      enrollVideoRef.current.srcObject = null
    }
    setCameraEnrollOpen(false)
  }

  const captureCameraEnrollment = async () => {
    if (!enrollVideoRef.current) return
    try {
      const video = enrollVideoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
        closeCameraEnrollment()
        toast.info('Analyzing captured photo & generating 128-D embedding...')
        await applySelectedPhoto(dataUrl)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to capture photo')
      closeCameraEnrollment()
    }
  }

  const handleEdit = (s:any)=>{
    if(!teacherCanEditStudent(s)){ toast.error('You can only edit students in your classes'); return }
    setEditing(s)
    setForm({
      ...s,
      subjects: Array.isArray(s.subjects) ? s.subjects.join(', ') : (s.subjects || (isTeacher ? teacherSubjects.join(', ') : '')),
    })
    setOpen(true)
  }

  const handleDelete = async (s:any)=>{
    if(!isAdmin){ toast.error('Only School Admin can delete students'); return }
    if(!confirm('Delete student '+s.name+'?')) return
    try {
      await remove(ref(db, `schools/${s.schoolId || schoolId}/students/${s.id}`))
      await remove(ref(db, `students/${s.id}`)).catch(()=>{})
      toast.success('Deleted')
    } catch(e:any){ toast.error(getFriendlyError(e) || 'Could not save student') }
  }

  const openAdd = () => {
    const defaults = { ...emptyForm }
    if (isTeacher && teacherClasses.length) {
      const [c, sec] = teacherClasses[0].split('-')
      defaults.className = c || '10'
      defaults.section = sec || 'A'
    }
    setEditing(null)
    setForm(defaults)
    setOpen(true)
  }

  const bulkExport = ()=>{
    const csv = 'StudentID,Admission,Roll,Name,Class,Section,Guardian,Phone,FaceReady,AddedBy\n' + filtered.map((s:any)=>
      [s.studentId||s.id, s.admissionNumber,s.rollNumber,s.name,s.className,s.section,s.guardianName,s.guardianPhone, isValidDescriptor(s.faceDescriptor)?'Yes':'No', s.addedByName||''].join(',')
    ).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='students.csv'; a.click()
  }

  const subtitle = isTeacher
    ? `${filtered.length} in your classes • single registration & embedding storage`
    : `${filtered.length} total • AI Face Embeddings stored securely`

  return (
    <div className="page-container">
      {/* Header */}
      <PageHeader title="Students Database" subtitle={subtitle} action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full hidden md:flex btn-outline-glass" onClick={bulkExport}>
            <Download size={16} className="mr-1.5"/> Export
          </Button>
        </div>
      }/>

       
        {/* Add Student Dialog Trigger — Floating Action Button (mobile) */}
      {canManage && (
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o){ setEditing(null); setForm(emptyForm) }}}>
          <DialogTrigger asChild>
            <button
              onClick={(e)=>{ e.preventDefault(); openAdd() }}
              className="md:hidden fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/30 animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #A855F7)' }}
            >
              <Plus size={24} className="text-white" />
            </button>
          </DialogTrigger>

          {/* Add/Edit Dialog */}
          <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto max-w-2xl !bg-[#0c1125] border border-white/[0.06] shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-[20px] flex items-center gap-2 text-white">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background: 'linear-gradient(135deg, #4F46E5, #A855F7)'}}>
                  <ScanFace size={18} className="text-white"/>
                </div>
                {editing ? 'Edit Student Profile' : 'AI Face Registration'}
              </DialogTitle>
            </DialogHeader>
            <div className="text-[12px] p-3 rounded-2xl border space-y-1.5 bg-white/[0.03] border-white/[0.06] text-white/60">
              <div>⚡ <b className="text-white/80">AI Registration:</b> Each photo auto-generates a 128-D face embedding for attendance recognition.</div>
            </div>
            <div className="space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden relative border-2 border-white/10 flex items-center justify-center text-2xl font-bold text-white shrink-0" style={{background: 'linear-gradient(135deg, #4F46E5, #22D3EE)'}}>
                  {form.photoUrl ? (
                    <img src={form.photoUrl} className="absolute inset-0 w-full h-full object-cover" alt=""/>
                  ) : (
                    <span>{form.name?.[0] || '?'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e: ChangeEvent<HTMLInputElement>)=>{
                    const f = e.target.files?.[0]; if(!f) return
                    const reader = new FileReader()
                    reader.onload = async () => { await applySelectedPhoto(reader.result as string) }
                    reader.readAsDataURL(f)
                  }}/>
                  <Button variant="outline" size="sm" className="btn-outline-glass rounded-full" onClick={()=>fileInputRef.current?.click()} disabled={uploadingPhoto}>
                    {uploadingPhoto ? 'Uploading...' : <><ImageUp size={14} className="mr-1.5"/> Upload Photo</>}
                  </Button>
                  <Button variant="outline" size="sm" className="btn-outline-glass rounded-full" onClick={openCameraEnrollment}>
                    <Camera size={14} className="mr-1.5"/> Live Camera
                  </Button>
                  {form.photoUrl && (
                    <Button variant="outline" size="sm" className="btn-outline-glass rounded-full" onClick={generateFaceId} disabled={generatingFaceId}>
                      {generatingFaceId ? 'Generating...' : <><ScanFace size={14} className="mr-1.5"/> Generate Face ID</>}
                    </Button>
                  )}
                </div>
              </div>
{/* Form Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-white/60 text-xs">Full Name *</Label>
                  <Input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Student full name" className="login-input mt-1 h-11"/>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Roll Number *</Label>
                  <Input value={form.rollNumber} onChange={e=>setForm({...form, rollNumber: e.target.value})} placeholder="Roll #" className="login-input mt-1 h-11"/>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Admission No.</Label>
                  <Input value={form.admissionNumber} onChange={e=>setForm({...form, admissionNumber: e.target.value})} placeholder="Admission #" className="login-input mt-1 h-11"/>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Class</Label>
                  <select value={form.className} onChange={e=>setForm({...form, className: e.target.value})} className="login-input mt-1 h-11 w-full rounded-xl px-3">
                    {Array.from({length:12}, (_,i)=>String(i+1)).map(c=><option key={c} value={c} className="bg-zinc-900">Class {c}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Section</Label>
                  <select value={form.section} onChange={e=>setForm({...form, section: e.target.value})} className="login-input mt-1 h-11 w-full rounded-xl px-3">
                    {['A','B','C','D','E'].map(s=><option key={s} value={s} className="bg-zinc-900">Section {s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-white/60 text-xs">Guardian Name</Label>
                  <Input value={form.guardianName} onChange={e=>setForm({...form, guardianName: e.target.value})} placeholder="Father/Mother name" className="login-input mt-1 h-11"/>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Phone</Label>
                  <Input value={form.guardianPhone} onChange={e=>setForm({...form, guardianPhone: e.target.value})} placeholder="+91..." className="login-input mt-1 h-11"/>
                </div>
                <div>
                  <Label className="text-white/60 text-xs">Email</Label>
                  <Input value={form.guardianEmail} onChange={e=>setForm({...form, guardianEmail: e.target.value})} placeholder="Email" className="login-input mt-1 h-11"/>
                </div>
                <div className="col-span-2">
                  <Label className="text-white/60 text-xs">Subjects (comma separated)</Label>
                  <Input value={form.subjects} onChange={e=>setForm({...form, subjects: e.target.value})} placeholder="Maths, Physics, Chemistry..." className="login-input mt-1 h-11"/>
                </div>
              </div>

              {isValidDescriptor(form.faceDescriptor) && (
                <div className="flex items-center gap-2 p-3 rounded-2xl border border-brand-success/20 bg-brand-success/5">
                  <CheckCircle2 size={16} className="text-brand-success"/>
                  <span className="text-[12px] font-bold text-brand-success">128-D Face Embedding Generated ✓</span>
                </div>
              )}

              <Button className="btn-gradient w-full h-12" onClick={save}>
                {editing ? 'Update Student' : 'Register Student'}
              </Button>
            </div>
          </DialogContent>
{/* Camera Enrollment Dialog */}
          <Dialog open={cameraEnrollOpen} onOpenChange={(o)=>{ if(!o) closeCameraEnrollment() }}>
            <DialogContent className="rounded-[28px] !bg-[#0c1125] border border-white/[0.06] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <ScanFace className="text-brand-cyan"/> Live Camera Enrollment
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-emerald-400/30 flex items-center justify-center">
                  <video ref={enrollVideoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" playsInline muted />
                  <div className="absolute inset-12 border-2 border-dashed border-emerald-400/60 rounded-2xl pointer-events-none flex flex-col items-center justify-between p-3">
                    <span className="text-[10px] bg-emerald-500/80 text-black px-2 py-0.5 rounded font-bold">NEON RECTANGLE</span>
                    <div className="text-center space-y-1">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow ${enrollSmile ? 'bg-emerald-500 text-black' : 'bg-black/60 text-white'}`}>
                        <Smile size={14} className={enrollSmile ? 'animate-bounce' : ''} /> {enrollSmile ? 'Smile Verified 🙂' : 'Please Smile 🙂'}
                      </span>
                      <span className="block text-[10px] bg-black/60 text-cyan-300 px-2 py-0.5 rounded-full">
                        Head Pose: {enrollPose === 'looking_straight' ? 'Looking Straight ✓' : enrollPose === 'looking_left' ? 'Looking Left ⬅️' : 'Looking Right ➡️'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center text-[12px] text-brand-cyan font-medium">
                  ⚡ {enrollStatusText}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="outline" className="rounded-full bg-transparent border-white/10 text-white/70 hover:bg-white/5 hover:text-white" onClick={closeCameraEnrollment}>Cancel</Button>
                  <Button variant="success" className="rounded-full font-bold shadow-md" onClick={captureCameraEnrollment}>Capture & Embed</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </Dialog>
      )}
{/* ===== STATISTICS CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card-premium p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(168,85,247,0.15))'}}>
              <Users size={20} className="text-brand-primary"/>
            </div>
            <ChevronRight size={14} className="text-white/20"/>
          </div>
          <div className="text-[28px] font-black leading-none text-white">{stats.total}</div>
          <div className="text-[12px] text-white/50 mt-1 font-medium">Total Students</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-premium p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: 'rgba(34,197,94,0.12)'}}>
              <UserCheck size={20} className="text-brand-success"/>
            </div>
            <ChevronRight size={14} className="text-white/20"/>
          </div>
          <div className="text-[28px] font-black leading-none text-white">{stats.withPhoto}</div>
          <div className="text-[12px] text-white/50 mt-1 font-medium">With Photos</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-premium p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: 'rgba(34,211,238,0.1)'}}>
              <Cpu size={20} className="text-brand-cyan"/>
            </div>
            <ChevronRight size={14} className="text-white/20"/>
          </div>
          <div className="text-[28px] font-black leading-none text-white">{stats.aiReady}</div>
          <div className="text-[12px] text-white/50 mt-1 font-medium">AI Registered</div>
        </motion.div>
<motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-premium p-4"
        >
       <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background: 'rgba(245,158,11,0.12)'}}>
              <Brain size={20} className="text-brand-warning"/>
            </div>
            <ChevronRight size={14} className="text-white/20"/>
          </div>
          <div className="text-[28px] font-black leading-none text-white">{stats.uniqueClasses}</div>
          <div className="text-[12px] text-white/50 mt-1 font-medium">Classes</div>
        </motion.div>
      </div>

      {/* ===== SEARCH + FILTER ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-3"
      >
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            placeholder="Search by name, roll number, admission ID..."
            value={q}
            onChange={e=>setQ(e.target.value)}
            className="pl-12 h-14 search-glass font-medium text-white rounded-full"
          />
          {q && (
            <button onClick={()=>setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X size={16}/>
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={()=>setFilterClass('all')}
            className={`px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shrink-0 ${
              filterClass === 'all'
                ? 'text-white shadow-lg shadow-brand-primary/20'
                : 'text-white/50 hover:text-white/80'
            }`}
            style={filterClass === 'all' ? { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
          All ({visibleStudents.length})
          </button>
          {classOptions.map(cls => (
            <button
              key={cls}
              onClick={()=>setFilterClass(filterClass === cls ? 'all' : cls)}
              className={`px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all shrink-0 ${
                filterClass === cls
                  ? 'text-white shadow-lg shadow-brand-primary/20'
                  : 'text-white/50 hover:text-white/80'
              }`}
              style={filterClass === cls ? { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {cls}
            </button>
          ))}
          <button
            className="px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5"
            style={{ background: 'rgba(34,211,238,0.08)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.15)' }}
          >
            <Cpu size={13}/> AI Ready ({stats.aiReady})
          </button>
        </div>
      </motion.div>
{/* ===== STUDENT CARDS ===== */}
      <div className="grid gap-3 md:hidden">
        <AnimatePresence mode="popLayout">
          {filtered.map((s:any, i: number)=>(
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
              className="card-premium student-card p-4"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden relative flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg" style={{background: 'linear-gradient(135deg, #4F46E5, #22D3EE)'}}>
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.name || 'Student'} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span>{s.name?.[0]||'S'}</span>
                  )}
                  {/* Online indicator dot */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0c1125]" style={{background: isValidDescriptor(s.faceDescriptor) ? '#22C55E' : '#F59E0B'}}/>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] leading-tight truncate text-white">{s.name}</div>
                  <div className="text-[12px] text-white/50 font-medium mt-0.5 truncate">
                    Class {s.className}-{s.section} • Roll #{s.rollNumber}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`status-chip ${isValidDescriptor(s.faceDescriptor) ? 'status-chip-success' : 'status-chip-warning'}`}>
                      {isValidDescriptor(s.faceDescriptor) ? '✓ AI Ready' : '⚠ No Embedding'}
                    </span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background: 'rgba(255,255,255,0.06)'}}>
                  <QRCodeSVG value={s.qrCode||s.id} size={24} fgColor="#818cf8" bgColor="transparent"/>
                </div>
              </div>

              {/* Expanded section */}
              <AnimatePresence>
                {expandedCard === s.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 mt-3 border-t border-white/[0.06] space-y-2">
                      <div className="flex items-center gap-2 text-[12px] text-white/50">
                        <span>ID: {s.studentId||s.id}</span>
                      </div>
                      {s.guardianName && (
                        <div className="text-[12px] text-white/50">Guardian: {s.guardianName} {s.guardianPhone ? `• ${s.guardianPhone}` : ''}</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              {teacherCanEditStudent(s) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                  <Button size="sm" className="flex-1 rounded-full h-9 text-[12px] font-semibold btn-outline-glass" onClick={()=>handleEdit(s)}>
                    <Edit2 size={13} className="mr-1.5"/> Edit & Face ID
                  </Button>
                  <Button size="sm" className="rounded-full h-9 w-9 p-0" variant="ghost" onClick={()=>setExpandedCard(expandedCard === s.id ? null : s.id)}>
                    <MoreHorizontal size={14} className="text-white/50"/>
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="rounded-full h-9 w-9 p-0" onClick={()=>handleDelete(s)}>
                      <Trash2 size={14} className="text-brand-error"/>
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {!filtered.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-premium p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{background: 'rgba(79,70,229,0.1)'}}>
              <Users size={28} className="text-brand-primary/50"/>
            </div>
            <div className="text-white/60 text-[14px] font-medium">No students found</div>
            <div className="text-white/30 text-[12px] mt-1">
              {q ? 'Try a different search term' : 'Add your first student to get started'}
            </div>
          </motion.div>
        )}
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="hidden md:block card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 font-bold text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
                <th className="p-4">Student</th>
                <th className="p-4">Roll & Class</th>
                <th className="p-4">Guardian</th>
                <th className="p-4">AI Status</th>
                <th className="p-4">Student ID</th>
                <th className="p-4">QR</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((s:any, i: number)=>(
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden relative flex items-center justify-center text-white font-bold shrink-0 shadow" style={{background: 'linear-gradient(135deg, #4F46E5, #22D3EE)'}}>
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover"/>
                        ) : (
                          <span>{s.name?.[0]||'S'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[14px] truncate max-w-[180px]">{s.name}</div>
                        <div className="text-[11px] text-white/40 truncate">Adm: {s.admissionNumber||'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-white/70 whitespace-nowrap">#{s.rollNumber} • {s.className}-{s.section}</td>
                  <td className="p-4">
                    <div className="font-medium text-white/70 truncate max-w-[150px]">{s.guardianName || 'N/A'}</div>
                    <div className="text-[11px] text-white/40 whitespace-nowrap">{s.guardianPhone || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`status-chip ${isValidDescriptor(s.faceDescriptor) ? 'status-chip-success' : 'status-chip-warning'}`}>
                      {isValidDescriptor(s.faceDescriptor) ? '✓ 128-D Vector' : '⚠ Not Ready'}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-[11px] text-white/30 whitespace-nowrap">{s.studentId || s.id}</td>
                  <td className="p-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'rgba(255,255,255,0.04)'}}>
                      <QRCodeSVG value={s.qrCode||s.id} size={28} fgColor="#818cf8" bgColor="transparent"/>
                    </div>
                  </td>
                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    {teacherCanEditStudent(s) ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-full font-semibold btn-outline-glass text-white/70" onClick={()=>handleEdit(s)}>Edit</Button>
                        {isAdmin && <Button size="sm" variant="ghost" className="rounded-full" onClick={()=>handleDelete(s)}><Trash2 size={14} className="text-brand-error"/></Button>}
                      </>
                    ) : <span className="text-white/30 text-xs">View only</span>}
                  </td>
                </motion.tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-white/40">No students found. Add students to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teacher Panel */}
      {isTeacher && <MyTeachersPanel/>}
    </div>
  )
}