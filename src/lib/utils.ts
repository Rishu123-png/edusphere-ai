import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateSchoolCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "EDU-" + Array.from({length:4}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

export const todayISO = () => new Date().toISOString().slice(0,10);
