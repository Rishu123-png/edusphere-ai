import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth, db, googleProvider } from '@/lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, User } from 'firebase/auth'
import { ref, get, set, update } from 'firebase/database'
import { AppUser, UserRole } from '@/types'

type AuthContextType = {
  user: User | null
  profile: AppUser | null
  loading: boolean
  login: (email:string, password:string) => Promise<void>
  loginGoogle: () => Promise<void>
  signup: (email:string, password:string, displayName?:string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email:string) => Promise<void>
  resendVerification: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (roles: UserRole[]) => boolean
  isSchoolAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (u: User) => {
    const snap = await get(ref(db, `users/${u.uid}`))
    if (snap.exists()) {
      const p = snap.val() as AppUser
      setProfile(p)
      await update(ref(db, `users/${u.uid}`), { isOnline: true, lastLogin: Date.now(), emailVerified: u.emailVerified })
      return p
    } else {
      // First-time user – create pending profile, role = teacher by default, school must be joined via onboarding
      const newProfile: AppUser = {
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || u.email?.split('@')[0] || 'New User',
        photoURL: u.photoURL || undefined,
        role: 'teacher', // default lowest – upgrade to school_admin via onboarding
        createdAt: Date.now(),
        isOnline: true,
        lastLogin: Date.now()
      }
      await set(ref(db, `users/${u.uid}`), newProfile)
      setProfile(newProfile)
      return newProfile
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await loadProfile(u)
        // force email verification reminder – do NOT block login, but UI will gate school creation
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [loadProfile])

  const login = async (email:string, password:string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email:string, password:string, displayName?:string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(cred.user, { displayName })
    await sendEmailVerification(cred.user)
    // profile created via onAuthStateChanged
  }

  const loginGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    if (user) await update(ref(db, `users/${user.uid}`), { isOnline: false, lastSeen: Date.now() })
    await signOut(auth)
  }

  const resetPassword = (email:string) => sendPasswordResetEmail(auth, email)

  const resendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser)
    }
  }

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
      await loadProfile(auth.currentUser)
    }
  }

  const hasRole = (roles: UserRole[]) => profile ? roles.includes(profile.role) : false
  const isSchoolAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginGoogle, signup, logout, resetPassword, resendVerification, refreshProfile, hasRole, isSchoolAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if(!ctx) throw new Error('useAuth outside provider')
  return ctx
}
