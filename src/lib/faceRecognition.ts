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
  confidence: number
}

/** Stricter match = fewer false positives from photos/screens/wrong people */
export const FACE_MATCH_THRESHOLD = 0.48
/** Minimum detector confidence for a face box to count */
export const FACE_SCORE_THRESHOLD = 0.55
/** Reject tiny boxes (phone-in-hand photos / distant noise) */
export const MIN_FACE_BOX_RATIO = 0.06

export async function loadFaceApiModels() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import('face-api.js')
      // Local weights only — never load remote models in production
      const modelUrl = `${import.meta.env.BASE_URL}models`
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
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
  let second = Number.POSITIVE_INFINITY
  for (const item of enrolled) {
    const distance = descriptorDistance(descriptor, item.descriptor)
    if (!best || distance < best.distance) {
      second = best ? best.distance : second
      best = {
        id: item.id,
        name: item.name,
        distance,
        confidence: Math.max(0, Math.min(1, 1 - distance)),
      }
    } else if (distance < second) {
      second = distance
    }
  }
  // Require a clear winner so two similar faces don't swap identities
  if (best && Number.isFinite(second) && second - best.distance < 0.05 && second < FACE_MATCH_THRESHOLD + 0.08) {
    return null
  }
  return best
}

function detectorOptions(faceapi: any, mode: 'enroll' | 'live') {
  // SSD is more reliable for enrollment photos; Tiny is faster for live camera
  if (mode === 'enroll') {
    return new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_SCORE_THRESHOLD })
  }
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: FACE_SCORE_THRESHOLD,
  })
}

function isAcceptableFaceBox(box: { width: number; height: number }, frameW: number, frameH: number) {
  if (!box || !frameW || !frameH) return false
  const areaRatio = (box.width * box.height) / (frameW * frameH)
  const aspect = box.width / Math.max(1, box.height)
  // Real faces in attendance camera are reasonably large and roughly portrait
  if (areaRatio < MIN_FACE_BOX_RATIO) return false
  if (aspect < 0.45 || aspect > 1.8) return false
  return true
}

async function detectSingleFromSource(source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, mode: 'enroll' | 'live') {
  const faceapi = await loadFaceApiModels()
  const result = await faceapi
    .detectSingleFace(source, detectorOptions(faceapi, mode))
    .withFaceLandmarks(true)
    .withFaceDescriptor()

  if (!result?.descriptor || !result.detection?.box) {
    throw new Error('No clear face found. Use a front-facing photo of one real person with good lighting.')
  }

  const box = result.detection.box
  const w = (source as any).naturalWidth || (source as any).videoWidth || (source as any).width || 0
  const h = (source as any).naturalHeight || (source as any).videoHeight || (source as any).height || 0
  if (mode === 'enroll' && w && h && !isAcceptableFaceBox(box, w, h)) {
    throw new Error('Face is too small or unclear. Use a closer, front-facing student photo.')
  }
  if (result.detection.score < FACE_SCORE_THRESHOLD) {
    throw new Error('Face confidence too low. Retake a clearer photo of the real student.')
  }

  return result
}

export async function createFaceDescriptorFromImageUrl(photoUrl: string): Promise<FaceDescriptor> {
  const faceapi = await loadFaceApiModels()
  const img = await faceapi.fetchImage(photoUrl)
  const result = await detectSingleFromSource(img, 'enroll')
  return Array.from(result.descriptor)
}

export async function createFaceDescriptorFromVideo(video: HTMLVideoElement): Promise<FaceDescriptor> {
  const result = await detectSingleFromSource(video, 'live')
  return Array.from(result.descriptor)
}

export interface LiveFaceDetection {
  descriptor: FaceDescriptor
  box: { x: number; y: number; width: number; height: number }
  score: number
}

/**
 * Live multi-face detect from camera video.
 * Filters low-score / tiny faces so phone screens and posters are less likely to match.
 */
export async function detectFacesWithDescriptors(video: HTMLVideoElement): Promise<LiveFaceDetection[]> {
  if (!video || video.readyState < 2 || !video.videoWidth) return []
  const faceapi = await loadFaceApiModels()
  const detections = await faceapi
    .detectAllFaces(video, detectorOptions(faceapi, 'live'))
    .withFaceLandmarks(true)
    .withFaceDescriptors()

  const frameW = video.videoWidth
  const frameH = video.videoHeight

  return (detections || [])
    .filter((d: any) => d?.descriptor && d?.detection?.box)
    .filter((d: any) => (d.detection.score || 0) >= FACE_SCORE_THRESHOLD)
    .filter((d: any) => isAcceptableFaceBox(d.detection.box, frameW, frameH))
    .map((d: any) => ({
      descriptor: Array.from(d.descriptor) as FaceDescriptor,
      box: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      score: d.detection.score || 0,
    }))
}

/** Keep canvas boxes aligned with the displayed video (object-cover / object-contain). */
export function mapBoxToCanvas(
  box: { x: number; y: number; width: number; height: number },
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  objectFit: 'cover' | 'contain' = 'cover'
) {
  const vw = video.videoWidth || 1
  const vh = video.videoHeight || 1
  const cw = canvas.width || canvas.clientWidth || 1
  const ch = canvas.height || canvas.clientHeight || 1

  const scale = objectFit === 'cover'
    ? Math.max(cw / vw, ch / vh)
    : Math.min(cw / vw, ch / vh)

  const drawnW = vw * scale
  const drawnH = vh * scale
  const offsetX = (cw - drawnW) / 2
  const offsetY = (ch - drawnH) / 2

  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: box.width * scale,
    height: box.height * scale,
  }
}
