import { useMemo } from 'react'
import { Cake, Gift } from 'lucide-react'

type Student = { id: string; name?: string; firstName?: string; dob?: string; dateOfBirth?: string; className?: string; section?: string }

function matchToday(dob?: string) {
  if (!dob) return false
  // Accept formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, ISO
  const clean = dob.replace(/[^0-9]/g, '')
  if (clean.length < 4) return false
  const d = new Date()
  const nowM = d.getMonth() + 1, nowD = d.getDate()
  // Try YYYYMMDD
  if (clean.length === 8) {
    const m = parseInt(clean.substring(4,6),10), dd = parseInt(clean.substring(6,8),10)
    return m === nowM && dd === nowD
  }
  // Try DDMMYYYY or MMDDYYYY ambiguous — check both
  const a = parseInt(clean.substring(0,2),10), b = parseInt(clean.substring(2,4),10)
  return (a === nowM && b === nowD) || (b === nowM && a === nowD)
}

export default function BirthdayBanner({ students }: { students: Student[] }) {
  const birthdays = useMemo(() => students.filter(s => matchToday(s.dob || s.dateOfBirth)), [students])
  if (!birthdays.length) return null
  const names = birthdays.map(s => s.name || s.firstName || 'Friend')
  const label = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0,2).join(', ')} and ${names.length-2} others`
  return (
    <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-fuchsia-500/15 backdrop-blur px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shrink-0">
        <Cake size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-white">Happy Birthday, {label}!</div>
        <div className="text-[11px] text-white/70 mt-0.5">Wish them well when you see them today.</div>
      </div>
      <Gift size={18} className="text-amber-300 shrink-0" />
    </div>
  )
}
