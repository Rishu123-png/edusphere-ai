let faceApiPromise: Promise<any> | null = null
let loadedModelBase: string | null = null

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
/**
 * Reject tiny boxes on ENROLLMENT photos — the enrollment flow needs one
 * large, close, front-facing face, so a strict 6% of frame is correct here.
 */
export const MIN_FACE_BOX_RATIO = 0.06
/**
 * Reject tiny boxes during LIVE classroom scans. A real student seated 1–3 m
 * from the teacher's phone covers roughly 1.5–3% of the frame, while a face
 * on a hand-held spoofing photo is usually far smaller AND fails the passive
 * liveness motion check. The old shared 6% value silently filtered out every
 * legit student in a classroom frame — that made "Move closer" fire for
 * everyone. 2% + liveness is the right balance for class coverage.
 */
export const LIVE_FACE_MIN_AREA_RATIO = 0.02

/**
 * Live camera detection runs every ~0.9 s on a phone, so a smaller detector
 * input keeps scanning fluid (inputSize 416 was the main cause of the
 * "camera hangs" complaint — detection took longer than the scan loop).
 * Classroom faces at 1–3 m still land far above the detector's ~40px floor.
 * Enrollment photos keep using the slower-but-stronger SSD detector.
 */
export const LIVE_DETECTOR_INPUT_SIZE = 320

/**
 * Prefer local models. If host rewrites missing files to index.html (SPA),
 * face-api tries to JSON.parse HTML → "Unexpected token '<'".
 * We probe the manifest first and fall back to a public CDN.
 */
function joinUrl(base: string, path: string) {
  const b = (base || '/').endsWith('/') ? (base || '/') : `${base || '/'}/`
  return `${b}${path.replace(/^\//, '')}`
}
const LOCAL_MODEL_BASE = joinUrl(String(import.meta.env.BASE_URL || '/'), 'models')
const CDN_MODEL_BASE = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'

async function isValidModelBase(base: string): Promise<boolean> {
  try {
    const url = `${base.replace(/\/$/, '')}/tiny_face_detector_model-weights_manifest.json`
    const res = await fetch(url, { method: 'GET', cache: 'force-cache' })
    if (!res.ok) return false
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    // SPA fallback often returns text/html with 200
    if (contentType.includes('text/html')) return false
    const text = await res.text()
    const trimmed = text.trim()
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return false
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

async function resolveModelBase(): Promise<string> {
  if (loadedModelBase) return loadedModelBase
  
  // Try local models first
  if (await isValidModelBase(LOCAL_MODEL_BASE)) {
    console.log('[EduSphere] Using local models from:', LOCAL_MODEL_BASE)
    loadedModelBase = LOCAL_MODEL_BASE
    return loadedModelBase
  }
  
  console.log('[EduSphere] Local models not available, trying CDN fallback...')
  
  // Fallback to CDN
  if (await isValidModelBase(CDN_MODEL_BASE)) {
    console.log('[EduSphere] Using CDN models from:', CDN_MODEL_BASE)
    loadedModelBase = CDN_MODEL_BASE
    return loadedModelBase
  }
  
  throw new Error(
    'Face AI models could not load from local or CDN. Check your network connection and try again.'
  )
}

export async function loadFaceApiModels() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      let faceapi: any
      try {
        faceapi = await import('face-api.js')
      } catch (e: any) {
        throw new Error('Failed to import face-api.js library. Check your network connection.')
      }

      const modelUrl = await resolveModelBase()
      console.log('[EduSphere] Loading face AI models from:', modelUrl)

      const modelsToLoad = [
        { name: 'tinyFaceDetector', net: faceapi.nets.tinyFaceDetector },
        { name: 'faceLandmark68TinyNet', net: faceapi.nets.faceLandmark68TinyNet },
        { name: 'faceRecognitionNet', net: faceapi.nets.faceRecognitionNet },
        { name: 'ssdMobilenetv1', net: faceapi.nets.ssdMobilenetv1 },
      ]

      for (const { name, net } of modelsToLoad) {
        try {
          await net.loadFromUri(modelUrl)
          console.log(`[EduSphere] ✓ ${name} loaded successfully`)
        } catch (e: any) {
          console.error(`[EduSphere]  ${name} failed to load:`, e.message)
          // Clear any partially loaded state
          faceApiPromise = null
          loadedModelBase = null

          const msg = String(e?.message || e || '')
          if (msg.includes('Unexpected token') || msg.includes('<!doctype') || msg.includes('is not valid JSON')) {
            throw new Error(
              'Face AI models failed to load (server returned HTML instead of model files). The models will be loaded from CDN on next attempt.'
            )
          }
          if (msg.includes('tensor') && msg.includes('should have')) {
            throw new Error(
              'Face AI model corruption detected. Clearing cache and retrying from CDN...'
            )
          }
          throw e instanceof Error ? e : new Error(msg || `Failed to load ${name}`)
        }
      }

      console.log('[EduSphere] ✓ All face AI models loaded successfully')
      return faceapi
    })()
  }
  return faceApiPromise
}

/** Force reload models from scratch (useful after tensor corruption errors) */
export function resetFaceModels() {
  faceApiPromise = null
  loadedModelBase = null
  console.log('[EduSphere] Face model cache cleared - will reload on next use')
}

/**
 * Optional background warm-up: downloads + compiles the neural nets while the
 * teacher is still on the page, so pressing "Start AI Camera" feels instant.
 * Safe to call anywhere — failures are swallowed (the normal loader still
 * retries on demand and surfaces a real error message then).
 */
export function warmUpFaceModels(delayMs = 1200) {
  if (typeof window === 'undefined') return
  const start = () => { loadFaceApiModels().catch(() => {}) }
  const idle = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback
  if (typeof idle === 'function') {
    idle.call(window, start, { timeout: delayMs + 4000 })
  } else {
    window.setTimeout(start, delayMs)
  }
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
    inputSize: LIVE_DETECTOR_INPUT_SIZE,
    scoreThreshold: FACE_SCORE_THRESHOLD,
  })
}

function isAcceptableFaceBox(
  box: { width: number; height: number },
  frameW: number,
  frameH: number,
  minAreaRatio: number = MIN_FACE_BOX_RATIO,
) {
  if (!box || !frameW || !frameH) return false
  const areaRatio = (box.width * box.height) / (frameW * frameH)
  const aspect = box.width / Math.max(1, box.height)
  // Real faces in attendance camera are reasonably large and roughly portrait
  if (areaRatio < minAreaRatio) return false
  if (aspect < 0.45 || aspect > 1.8) return false
  return true
}

/** Load image from data URL / blob / http without relying only on faceapi.fetchImage */
async function loadImageElement(photoUrl: string): Promise<HTMLImageElement> {
  // data: and blob: load fine without CORS; remote URLs need crossOrigin
  const isLocal = photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!isLocal) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the photo. Try another clear face image.'))
    img.src = photoUrl
  })
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
  if (!photoUrl) throw new Error('No photo selected')
  // Ensure models are ready first (clear error if SPA returns HTML for models)
  await loadFaceApiModels()
  const img = await loadImageElement(photoUrl)
  // Wait a frame so dimensions are reliable
  if (!img.naturalWidth) {
    await new Promise(r => setTimeout(r, 30))
  }
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
    .filter((d: any) => isAcceptableFaceBox(d.detection.box, frameW, frameH, LIVE_FACE_MIN_AREA_RATIO))
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
