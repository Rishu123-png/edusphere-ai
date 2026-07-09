import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, sendPasswordResetEmail, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, Role } from '@/types';

type Ctx = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email:string, pass:string)=>Promise<void>;
  register: (p:{email:string;password:string;name:string;role:Role;schoolCode?:string;schoolName?:string})=>Promise<void>;
  googleLogin: ()=>Promise<void>;
  logout: ()=>Promise<void>;
  resetPassword: (email:string)=>Promise<void>;
};

const AuthCtx = createContext<Ctx>(null!);

export const AuthProvider = ({children}:{children: React.ReactNode}) => {
  const [user, setUser] = useState<User|null>(null);
  const [profile, setProfile] = useState<UserProfile|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) {
      const snap = await getDoc(doc(db, 'users', u.uid));
      setProfile(snap.exists() ? snap.data() as UserProfile : null);
    } else setProfile(null);
    setLoading(false);
  }), []);

  const login = async (email:string, pass:string) => { await signInWithEmailAndPassword(auth, email, pass); };

  const googleLogin = async () => {
    const res = await signInWithPopup(auth, googleProvider);
    const uref = doc(db, 'users', res.user.uid);
    const snap = await getDoc(uref);
    if (!snap.exists()) {
      // New google users land as school_admin pending school join, or need to create school
      await setDoc(uref, {
        uid: res.user.uid, email: res.user.email, name: res.user.displayName || 'User',
        role: 'school_admin', schoolId: '', active: true, photoURL: res.user.photoURL || '',
        createdAt: Date.now()
      });
    }
  };

  const register = async ({email, password, name, role, schoolCode, schoolName}:{email:string;password:string;name:string;role:Role;schoolCode?:string;schoolName?:string}) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    let schoolId = '';
    if (role === 'school_admin' && schoolName) {
      // create school
      const sCode = (await import('@/lib/utils')).generateSchoolCode();
      schoolId = sCode.toLowerCase();
      await setDoc(doc(db, 'schools', schoolId), {
        id: schoolId, name: schoolName, schoolCode: sCode,
        createdBy: cred.user.uid, createdAt: Date.now()
      });
    } else if (schoolCode) {
      // join by school code
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'schools'), where('schoolCode', '==', schoolCode.toUpperCase()));
      const s = await getDocs(q);
      if (!s.empty) schoolId = s.docs[0].id;
    }
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, email, name, role, schoolId,
      active: true, createdAt: Date.now()
    });
  };

  const logout = () => signOut(auth);
  const resetPassword = (email:string) => sendPasswordResetEmail(auth, email);

  return <AuthCtx.Provider value={{user, profile, loading, login, register, googleLogin, logout, resetPassword}}>{children}</AuthCtx.Provider>
};

export const useAuth = () => useContext(AuthCtx);
