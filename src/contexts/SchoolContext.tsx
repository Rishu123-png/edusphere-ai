import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { School } from '@/types'

const SchoolContext = createContext<{
  school: School | null
  schoolId: string | null
  loading: boolean
} >({ school: null, schoolId: null, loading: true })

export function SchoolProvider({ children }: {children: React.ReactNode}) {
  const { profile } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=> {
    const load = async () => {
      if(!profile?.schoolId){ setSchool(null); setLoading(false); return }
      const snap = await get(ref(db, `schools/${profile.schoolId}`))
      setSchool(snap.exists()? snap.val() : null)
      setLoading(false)
    }
    load()
  }, [profile?.schoolId])

  return (
    <SchoolContext.Provider value={{ school, schoolId: profile?.schoolId || null, loading }}>
      {children}
    </SchoolContext.Provider>
  )
}

export const useSchool = () => useContext(SchoolContext)
