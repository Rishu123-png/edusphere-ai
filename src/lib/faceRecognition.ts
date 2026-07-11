let faceApiPromise: Promise<any> | null = null

export type FaceDescriptor = number[]

export interface EnrolledFace {
  id: string
  name: string
  descriptor: FaceDescriptor
}

export interface FaceMatch {
  id: string
  name: string
  distance: number
}

export async function loadFaceApiModels() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import('face-api.js')
      const modelUrl = '/models'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ])
      return faceapi
    })()
  }
  return faceApiPromise
}

export function isValidDescriptor(value: unknown): value is FaceDescriptor {
  return Array.isArray(value) && value.length === 128 && value.every(n => typeof n === 'number' && Number.isFinite(n))
}

export function descriptorDistance(a: FaceDescriptor, b: FaceDescriptor) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export function findBestFaceMatch(descriptor: FaceDescriptor, enrolled: EnrolledFace[]): FaceMatch | null {
  let best: FaceMatch | null = null
  for (const item of enrolled) {
    const distance = descriptorDistance(descriptor, item.descriptor)
    if (!best || distance < best.distance) best = { id: item.id, name: item.name, distance }
  }
  return best
}

export async function createFaceDescriptorFromImageUrl(photoUrl: string): Promise<FaceDescriptor> {
  const faceapi = await loadFaceApiModels()
  const img = await faceapi.fetchImage(photoUrl)
  const result = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor()

  if (!result?.descriptor) {
    throw new Error('No clear face found in this photo. Use a front-facing photo with one student only.')
  }

  return Array.from(result.descriptor)
}

export async function detectFacesWithDescriptors(video: HTMLVideoElement) {
  const faceapi = await loadFaceApiModels()
  return faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptors()
}
