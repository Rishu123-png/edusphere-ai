import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { db } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { School } from '@/types'

type SchoolContextValue = {
  school: School | null
  schoolId: string | null
  loading: boolean
  error: string | null
}

const SchoolContext = createContext<SchoolContextValue>({
  school: null,
  schoolId: null,
  loading: true,
  error: null,
})

export function SchoolProvider({ children }: {children: React.ReactNode}) {
  const { profile, loading: authLoading } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(()=> {
    let active = true

    const load = async () => {
      if (authLoading) return
      setLoading(true)
      setError(null)

      if(!profile?.schoolId){
        if (active) {
          setSchool(null)
          setLoading(false)
        }
        return
      }

      try {
        const snap = await get(ref(db, `schools/${profile.schoolId}`))
        if (active) {
          setSchool(snap.exists()? snap.val() : null)
        }
      } catch (err) {
        console.error('Failed to load school profile', err)
        if (active) {
          setSchool(null)
          setError('Unable to load school profile')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [authLoading, profile?.schoolId])

  return (
    <SchoolContext.Provider value={{ school, schoolId: profile?.schoolId || null, loading, error }}>
      {children}
    </SchoolContext.Provider>
  )
}

export const useSchool = () => useContext(SchoolContext)
