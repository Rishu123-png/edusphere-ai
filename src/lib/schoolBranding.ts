// Simple per-school branding helpers (logo stored as base64 in localStorage
// so it works without new Firebase storage permissions).
const KEY = (schoolId:string) => `edusphere_branding_${schoolId}`

export type SchoolBranding = {
  logoDataUrl?: string
  principalName?: string
  principalSignature?: string // base64 PNG
  schoolAddress?: string
  whatsappAutoSend?: boolean
  whatsappAutoSendTime?: string // "15:00"
}

export function loadBranding(schoolId?: string): SchoolBranding {
  if (!schoolId) return {}
  try { return JSON.parse(localStorage.getItem(KEY(schoolId)) || '{}') } catch { return {} }
}

export function saveBranding(schoolId: string, b: SchoolBranding) {
  try { localStorage.setItem(KEY(schoolId), JSON.stringify(b)) } catch {}
}

export function fileToDataUrl(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => resolve(String(reader.result))
      img.onload = () => {
        const scale = Math.min(1, maxDim/Math.max(img.width, img.height))
        const w = Math.round(img.width*scale), h = Math.round(img.height*scale)
        const c = document.createElement('canvas')
        c.width=w; c.height=h
        c.getContext('2d')!.drawImage(img,0,0,w,h)
        resolve(c.toDataURL('image/png',0.85))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
