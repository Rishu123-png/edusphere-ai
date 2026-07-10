import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, db, googleProvider } from '@/lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, User } from 'firebase/auth'
import { ref, get, set, update } from 'firebase/database'
import { AppUser, UserRole } from '@/types'

type AuthContextType = {
  user: User | null
  profile: AppUser | null
  loading: boolean
  login: (email:string, password:string) => Promise<void>
  loginGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email:string) => Promise<void>
  hasRole: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await get(ref(db, `users/${u.uid}`))
        if (snap.exists()) {
          const p = snap.val() as AppUser
          setProfile(p)
          // mark online
          update(ref(db, `users/${u.uid}`), { isOnline: true, lastLogin: Date.now() })
          // presence disconnect handling could be added
        } else {
          // first login bootstrap as super_admin if none exists?
          const newProfile: AppUser = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || u.email?.split('@')[0],
            photoURL: u.photoURL || undefined,
            role: 'school_admin',
            createdAt: Date.now(),
            isOnline: true,
            lastLogin: Date.now()
          }
          await set(ref(db, `users/${u.uid}`), newProfile)
          setProfile(newProfile)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const login = async (email:string, password:string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }
  const loginGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }
  const logout = async () => {
    if (user) await update(ref(db, `users/${user.uid}`), { isOnline: false, lastSeen: Date.now() })
    await signOut(auth)
  }
  const resetPassword = (email:string) => sendPasswordResetEmail(auth, email)

  const hasRole = (roles: UserRole[]) => profile ? roles.includes(profile.role) : false

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginGoogle, logout, resetPassword, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if(!ctx) throw new Error('useAuth outside provider')
  return ctx
}
