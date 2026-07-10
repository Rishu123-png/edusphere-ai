import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateSchoolCode = () => {
  return 'EDU-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const generateId = (prefix = '') => {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2,7)
}

export const formatDate = (d: Date | string | number) => {
  return new Intl.DateTimeFormat('en-IN', { year:'numeric', month:'short', day:'numeric'}).format(new Date(d))
}

export const calcPercentage = (present:number, total:number) => total ? Math.round((present/total)*1000)/10 : 0

export const gradeFromMarks = (marks:number, max=100) => {
  const p = (marks/max)*100
  if(p>=90) return 'A+'
  if(p>=80) return 'A'
  if(p>=70) return 'B+'
  if(p>=60) return 'B'
  if(p>=50) return 'C'
  if(p>=33) return 'D'
  return 'F'
}

export const whatsappUrl = (phone:string, text:string) => {
  const clean = phone.replace(/\D/g,'')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}
