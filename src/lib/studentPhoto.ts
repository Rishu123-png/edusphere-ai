import { storage } from './firebase'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'

export function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function resizeImageDataUrl(dataUrl: string, maxSize = 900, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1)
      const width = Math.round(image.width * ratio)
      const height = Math.round(image.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not prepare photo'))
      ctx.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    image.onerror = () => reject(new Error('Could not read selected photo'))
    image.src = dataUrl
  })
}

export async function uploadStudentPhoto(schoolId: string, studentId: string, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl)
  const path = `schools/${schoolId}/student-photos/${studentId}/${Date.now()}.jpg`
  const snap = await uploadBytes(storageRef(storage, path), blob, { contentType: blob.type || 'image/jpeg' })
  return getDownloadURL(snap.ref)
}
