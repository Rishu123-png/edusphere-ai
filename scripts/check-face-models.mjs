#!/usr/bin/env node
/**
 * EduSphere AI — Face model preflight
 *
 * Runs automatically before `npm run dev` / `npm run build` (see package.json
 * "predev" / "prebuild"). It NEVER fails the build: the app has a CDN fallback
 * in src/lib/faceRecognition.ts, so a missing model folder just means relying
 * on jsDelivr at runtime. If every required file is present in public/models,
 * Vercel serves the neural nets from your own deployment — fully offline-
 * capable biometric attendance.
 */
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
]

const modelsDir = join(root, 'public', 'models')
const missing = REQUIRED.filter(name => {
  try {
    return !existsSync(join(modelsDir, name)) || statSync(join(modelsDir, name)).size === 0
  } catch {
    return true
  }
})

if (missing.length === 0) {
  console.log(`[edusphere] ✓ Face AI models present (${REQUIRED.length} files in public/models) — self-hosted biometrics will ship in this build.`)
} else {
  console.warn(`[edusphere] ⚠ Face AI model files missing from public/models:\n  - ${missing.join('\n  - ')}\n  The app will fall back to the public CDN at runtime, so the build is still safe.`)
}
