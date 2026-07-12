import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth, db, googleProvider } from '@/lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, User } from 'firebase/auth'
import { ref, get, set, update, onDisconnect } from 'firebase/database'
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

/** Write isOnline on both users/ and schools/.../teachers/ so admin dashboard stays live */
async function setPresence(uid: string, schoolId: string | undefined, online: boolean) {
  const stamp = Date.now()
  const userPatch: any = online
    ? { isOnline: true, lastLogin: stamp, lastSeen: stamp }
    : { isOnline: false, lastSeen: stamp }
  try {
    await update(ref(db, `users/${uid}`), userPatch)
  } catch {
      // Best-effort browser/Firebase operation; safe to ignore.
    }
  if (schoolId) {
    try {
      await update(ref(db, `schools/${schoolId}/teachers/${uid}`), {
        isOnline: online,
        lastSeen: stamp,
        ...(online ? { lastLogin: stamp } : {}),
      })
    } catch {
      // Best-effort browser/Firebase operation; safe to ignore.
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (u: User) => {
    try {
      const snap = await get(ref(db, `users/${u.uid}`))
      if (snap.exists()) {
        const p = snap.val() as AppUser
        setProfile(p)
        // Mark online on user + teacher record
        await setPresence(u.uid, p.schoolId, true)
        // Auto offline if tab/app closes unexpectedly
        try {
          await onDisconnect(ref(db, `users/${u.uid}/isOnline`)).set(false)
          await onDisconnect(ref(db, `users/${u.uid}/lastSeen`)).set(Date.now())
          if (p.schoolId) {
            await onDisconnect(ref(db, `schools/${p.schoolId}/teachers/${u.uid}/isOnline`)).set(false)
            await onDisconnect(ref(db, `schools/${p.schoolId}/teachers/${u.uid}/lastSeen`)).set(Date.now())
          }
        } catch {
      // Best-effort browser/Firebase operation; safe to ignore.
    }
        return p
      } else {
        const newProfile: AppUser = {
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || u.email?.split('@')[0] || 'New User',
          role: 'teacher',
          createdAt: Date.now(),
          isOnline: true,
          lastLogin: Date.now()
        }
        if (u.photoURL) newProfile.photoURL = u.photoURL
        await set(ref(db, `users/${u.uid}`), newProfile)
        setProfile(newProfile)
        return newProfile
      }
    } catch(e){
      console.error('loadProfile error', e)
      return null
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await loadProfile(u)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [loadProfile])

  // Heartbeat while app is open so admin sees Active
  useEffect(() => {
    if (!user || !profile) return
    const beat = () => {
      setPresence(user.uid, profile.schoolId, true).catch(()=>{
        // Best-effort cleanup; safe to ignore.
      })
    }
    const id = window.setInterval(beat, 45000)
    const onVis = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user, profile?.schoolId, profile?.uid])

  const login = async (email:string, password:string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email:string, password:string, displayName?:string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(cred.user, { displayName })
    await sendEmailVerification(cred.user)
  }

  const loginGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    try {
      if (user) await setPresence(user.uid, profile?.schoolId, false)
    } catch {
      // Best-effort browser/Firebase operation; safe to ignore.
    }
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
      setUser({ ...auth.currentUser } as any)
      await loadProfile(auth.currentUser as any)
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
