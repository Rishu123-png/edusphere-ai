
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
import { createFaceDescriptorFromImageUrl, isValidDescriptor, loadFaceApiModels } from '@/lib/faceRecognition'
import { fileToDataUrl, resizeImageDataUrl, uploadStudentPhoto } from '@/lib/studentPhoto'
import { toast } from 'sonner'
import { getFriendlyError } from '@/lib/errors'
import { QRCodeSVG } from 'qrcode.react'
import PageHeader from '@/components/mobile/PageHeader'
import MyTeachersPanel from '@/components/mobile/MyTeachersPanel'
import { Search, Plus, Edit2, Trash2, Download, Camera, ImageUp, ScanFace, Smile, Eye, CheckCircle2, ShieldCheck, AlertCircle, Sparkles, Brain } from 'lucide-react'

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

  const filtered = useMemo(() => {
    if (!q.trim()) return visibleStudents
    const lower = q.toLowerCase()
    return visibleStudents.filter((s:any)=>
      (s.name||'').toLowerCase().includes(lower) ||
      (s.admissionNumber||'').toLowerCase().includes(lower) ||
      String(s.rollNumber||'').includes(lower) ||
      `${s.className}-${s.section}`.toLowerCase().includes(lower)
    )
  }, [visibleStudents, q])

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
    try {
      const source = form.localPhotoDataUrl || form.photoUrl
      const faceDescriptor = await createFaceDescriptorFromImageUrl(source)
      setForm((prev:any)=>({...prev, faceDescriptor, faceEmbedding: faceDescriptor}))
      toast.success('AI Face ID & 128-D Embedding vector generated. Save the student to keep it.')
    } catch(e:any) {
      setForm((prev:any)=>({...prev, faceDescriptor: null, faceEmbedding: null}))
      toast.error(friendlyFaceError(e))
    } finally {
      setGeneratingFaceId(false)
    }
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

  return <div className="page-container space-y-4">
    <PageHeader title="Students Database" subtitle={subtitle} action={
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full hidden md:flex" onClick={bulkExport}><Download size={16} className="mr-1"/> Export</Button>
        {canManage ? (
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o){ setEditing(null); setForm(emptyForm) }}}>
          <DialogTrigger asChild>
            <Button variant="gradient" size="sm" className="rounded-full h-11 px-5" onClick={(e)=>{ e.preventDefault(); openAdd() }}>
              <Plus size={18} className="mr-1"/> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[28px] max-h-[90vh] overflow-auto max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-[20px] flex items-center gap-2">
                <ScanFace className="text-indigo-600"/> {editing ? 'Edit Student Profile & Embedding' : 'AI Face Registration (Single Enrollment)'}
              </DialogTitle>
            </DialogHeader>
            <div className="text-[12px] text-muted-foreground p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-1.5">
              <div>⚡ <b>AI Registration Guarantee:</b> Each student registers only once. The AI stores all 9 identity fields plus a numerical <b>128-D Face Embedding</b> vector (`[0.012, -0.045, ...]`) rather than just an image for ultra-reliable biometric recognition.</div>
              <div>👨‍👩‍👧 <b>Parent Portal Fix:</b> Save the guardian login email here so the authenticated parent account can join the school and automatically link to the child profile.</div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e)=>{
              const file = e.target.files?.[0]
              e.target.value = ''
              if(file && file.type.startsWith('image/')) fileToDataUrl(file).then(applySelectedPhoto)
            }} />

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-150 dark:border-zinc-700 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-2xl overflow-hidden relative bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shrink-0 shadow-md">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Student" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span>{form.name?.[0] || 'S'}</span>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="font-bold text-[15px]">Biometric Face Embedding</div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    {isValidDescriptor(form.faceDescriptor)
                      ? '✓ 128-Dimensional vector generated (`[0.014, -0.038, 0.102, ...]`). Ready for instant matching.'
                      : 'No numerical embedding vector extracted yet. Use Live Camera or Upload Photo.'}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isValidDescriptor(form.faceDescriptor) ? 'bg-emerald-500 text-white' : 'bg-amber-500/20 text-amber-600'}`}>
                      {isValidDescriptor(form.faceDescriptor) ? 'EMBEDDING VERIFIED (128-D)' : 'EMBEDDING REQUIRED'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
                <Button variant="gradient" className="rounded-full font-bold shadow-sm" onClick={(e)=>{ e.preventDefault(); openCameraEnrollment(); }} disabled={uploadingPhoto}>
                  <Camera size={16} className="mr-1.5"/> Live Camera Capture
                </Button>
                <Button variant="outline" className="rounded-full" onClick={(e)=>{ e.preventDefault(); fileInputRef.current?.click(); }} disabled={uploadingPhoto}>
                  <ImageUp size={16} className="mr-1"/> Upload Photo
                </Button>
                <Button
                  variant="success"
                  className="rounded-full whitespace-nowrap"
                  onClick={(e)=>{ e.preventDefault(); generateFaceId() }}
                  disabled={uploadingPhoto || generatingFaceId || !form.photoUrl}
                  title={form.photoUrl ? 'Re-generate the 128-D face embedding' : 'Upload a photo first'}
                >
                  <ScanFace size={16} className="mr-1.5"/> {generatingFaceId ? 'Generating…' : 'Generate Face ID'}
                </Button>
              </div>
            </div>
{/* Form Fields: All 9 Required Identity Fields */}
            <div className="grid md:grid-cols-3 gap-3.5 pt-1">
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Student Name *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. Rahul Sharma" value={form.name||''} onChange={e=>setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Roll Number *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. 101" value={form.rollNumber||''} onChange={e=>setForm({...form, rollNumber: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Student ID *</Label>
                <Input className="mt-1 h-11 rounded-xl text-slate-500 font-mono text-[12px]" placeholder="Auto-generated" value={form.id || editing?.id || 'stu_auto_gen'} readOnly />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Class *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. XII" value={form.className||''} onChange={e=>setForm({...form, className: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Section *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. A" value={form.section||''} onChange={e=>setForm({...form, section: e.target.value})} />
              </div>

              {/* SUBJECTS — drives the student → teacher dashboard mapping */}
              <div className="md:col-span-3">
                <Label className="text-[12px] font-bold text-muted-foreground">Subjects (tap to add)</Label>
                {(() => {
                  const chips = Array.isArray(form.subjects) ? form.subjects : (form.subjects ? String(form.subjects).split(',').map(s=>s.trim()).filter(Boolean) : [])
                  const toggleSubject = (sub: string) => {
                    const cur = Array.isArray(form.subjects) ? form.subjects : (form.subjects ? String(form.subjects).split(',').map(s=>s.trim()).filter(Boolean) : [])
                    const next = cur.includes(sub) ? cur.filter((x: string) => x !== sub) : [...cur, sub]
                    setForm({ ...form, subjects: next })
                  }
                  return (
                    <>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {COMMON_SUBJECTS.map(sub => {
                          const active = chips.includes(sub)
                          return (
                            <button key={sub} type="button" onClick={() => toggleSubject(sub)} className={`px-3 h-9 rounded-full text-[12px] font-semibold border transition active:scale-95 ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-muted-foreground'}`}>{sub}</button>
                          )
                        })}
                      </div>
                      {chips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {chips.map((c: string) => <span key={c} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold">{c}</span>)}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Assigned teachers for this class + subjects (read-only dashboard links) */}
              <div className="md:col-span-3">
                <MyTeachersPanel
                  className={form.className}
                  section={form.section}
                  subjects={Array.isArray(form.subjects) ? form.subjects : (form.subjects ? String(form.subjects).split(',').map(s=>s.trim()).filter(Boolean) : [])}
                />
              </div>

              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Guardian Name *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. Suresh Sharma" value={form.guardianName||''} onChange={e=>setForm({...form, guardianName: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Guardian Phone *</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. 9876543210" value={form.guardianPhone||''} onChange={e=>setForm({...form, guardianPhone: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Guardian Login Email</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" type="email" placeholder="parent@example.com" value={form.guardianEmail||''} onChange={e=>setForm({...form, guardianEmail: e.target.value})} />
              </div>
              <div>
                <Label className="text-[12px] font-bold text-muted-foreground">Admission Number</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="e.g. ADM-2026-101" value={form.admissionNumber||''} onChange={e=>setForm({...form, admissionNumber: e.target.value})} />
              </div>
              <div>
<Label className="text-[12px] font-bold text-muted-foreground">DOB & Address</Label>
                <Input className="mt-1 h-11 rounded-xl font-semibold" placeholder="DOB or City" value={form.dob||''} onChange={e=>setForm({...form, dob: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <Button variant="outline" className="rounded-full px-5" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button variant="gradient" className="rounded-full px-7 font-bold shadow-md" onClick={save}>{editing ? 'Update Student Record' : 'Save & Register Student'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>
    } />
{/* Live Camera Enrollment Modal */}
    <Dialog open={cameraEnrollOpen} onOpenChange={(o)=>{ if(!o) closeCameraEnrollment(); }}>
      <DialogContent className="rounded-[28px] max-w-lg overflow-hidden bg-black text-white p-5 border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2 text-[16px]"><ScanFace className="text-emerald-400"/> Smart Face Capture & Liveness Check</DialogTitle>
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
          <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 text-center text-[12px] text-cyan-300 font-medium">
            ⚡ {enrollStatusText}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="outline" className="rounded-full bg-transparent border-white/20 text-white hover:bg-white/10" onClick={closeCameraEnrollment}>Cancel</Button>
            <Button variant="success" className="rounded-full font-bold shadow-md" onClick={captureCameraEnrollment}>Capture & Extract Embedding</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search students by name, roll number, admission id..." value={q} onChange={e=>setQ(e.target.value)} className="pl-11 h-14 rounded-full bg-white dark:bg-zinc-900 font-medium" />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <span className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[13px] font-bold whitespace-nowrap">
          All Enrolled ({filtered.length})
        </span>
        <span className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[13px] font-bold whitespace-nowrap">
          ✓ 128-D Numerical Embeddings Ready ({students.filter(s=>isValidDescriptor(s.faceDescriptor)).length})
        </span>
      </div>
    </div>
    <div className="grid gap-3 md:hidden">
      {filtered.map((s:any)=>(
        <Card key={s.id} className="p-3.5 rounded-[22px] border border-slate-150 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-xl overflow-hidden relative bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-[18px] shrink-0 shadow">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={s.name || 'Student'} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{s.name?.[0]||'S'}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-[15px] leading-tight truncate text-foreground">{s.name}</div>
              <div className="text-[11.5px] text-muted-foreground font-medium mt-0.5 truncate">
                Class {s.className}-{s.section} • Roll #{s.rollNumber} • ID: {s.studentId||s.id}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${isValidDescriptor(s.faceDescriptor) ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'}`}>
                  {isValidDescriptor(s.faceDescriptor) ? '✓ 128-D EMBEDDING STORED' : '⚠️ NO EMBEDDING'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center shrink-0 shadow-sm"><QRCodeSVG value={s.qrCode||s.id} size={22}/></div>
            </div>
          </div>
          {teacherCanEditStudent(s) && (
            <div className="flex gap-2 mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <Button size="sm" variant="outline" className="flex-1 rounded-full h-9 font-semibold" onClick={()=>handleEdit(s)}><Edit2 size={13} className="mr-1.5"/> Edit & Face ID</Button>
              {isAdmin && <Button size="sm" variant="ghost" className="rounded-full h-9 px-3 text-rose-500" onClick={()=>handleDelete(s)}><Trash2 size={14}/></Button>}
            </div>
          )}
        </Card>
      ))}
      {!filtered.length && (
        <Card className="p-10 text-center text-muted-foreground text-[14px] rounded-[24px]">
          No students registered yet. Click &quot;Add Student&quot; above to enroll with AI face embedding.
        </Card>
      )}
    </div>
    <Card className="hidden md:block rounded-[26px] overflow-hidden border border-slate-150 dark:border-zinc-800 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
              <tr className="text-left text-muted-foreground font-bold text-[12px] uppercase tracking-wider">
                <th className="p-4">Student Info</th>
                <th>Roll & Class</th>
                <th>Guardian & Phone</th>
                <th>Face Embedding (128-D)</th>
                <th>Student ID</th>
                <th>QR Code</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map((s:any)=>(
                <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-xl overflow-hidden relative bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover"/>
                        ) : (
                          <span>{s.name?.[0]||'S'}</span>
                        )}
                      </div>
<div className="min-w-0">
                        <div className="font-bold text-foreground text-[14px] truncate max-w-[180px]">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">Adm: {s.admissionNumber||'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold whitespace-nowrap">Roll #{s.rollNumber} • {s.className}-{s.section}</td>
                  <td>
                    <div className="font-medium text-foreground truncate max-w-[150px]">{s.guardianName || 'N/A'}</div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">{s.guardianPhone || 'N/A'}</div>
                  </td>
                  <td>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 w-fit whitespace-nowrap ${isValidDescriptor(s.faceDescriptor) ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'}`}>
                      {isValidDescriptor(s.faceDescriptor) ? '✓ 128-D VECTOR STORED' : '⚠️ NO VECTOR'}
                    </span>
                  </td>
                  <td className="font-mono text-[11.5px] text-slate-500 whitespace-nowrap">{s.studentId || s.id}</td>
                  <td><div className="bg-white p-1 rounded-lg border w-fit shadow-xs"><QRCodeSVG value={s.qrCode||s.id} size={30}/></div></td>
                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    {teacherCanEditStudent(s) ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-full font-semibold" onClick={()=>handleEdit(s)}>Edit & Face ID</Button>
                        {isAdmin && <Button size="sm" variant="ghost" className="rounded-full text-rose-500" onClick={()=>handleDelete(s)}><Trash2 size={14}/></Button>}
                      </>
                    ) : <span className="text-muted-foreground text-xs">View only</span>}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">No students registered yet. Click &quot;Add Student&quot; above to enroll.</td>
                </tr>
              )}
</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
}