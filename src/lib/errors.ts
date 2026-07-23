
// ============================================================================
// Friendly error mapping
// ----------------------------------------------------------------------------
// Backend internals (Firebase auth codes, raw exception strings) must never
// reach the UI. They confuse teachers and leak implementation details. Map
// them to calm, actionable, white-labeled copy here.
// ============================================================================

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address looks incorrect. Please check and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact your school administrator.',
  'auth/user-not-found': 'Login failed. We could not find an account with that email.',
  'auth/wrong-password': 'Login failed. The password you entered is incorrect.',
  'auth/invalid-credential': 'Login failed. The email or password you entered is incorrect.',
  'auth/invalid-login-credentials': 'Login failed. The email or password you entered is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/popup-closed-by-user': 'The sign-in popup was closed. Please try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Contact your administrator.',
  'auth/requires-recent-login': 'For your security, please sign in again to continue.',
  'auth/expired-action-code': 'This action link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This action link is invalid. Please request a new one.',
  'permission-denied': 'You do not have permission to complete that action.',
  'storage/unauthorized': 'Photo upload was not permitted. Please contact your school administrator.',
  'storage/unauthenticated': 'Your session has expired. Please sign in again.',
  'storage/retry-limit-exceeded': 'Photo upload is taking too long. Please check your connection and try again.',
  'storage/canceled': 'Photo upload was cancelled.',
}

/**
 * Returns a clean, teacher-friendly message. Falls back to a safe generic
 * string instead of leaking raw backend text.
 */
export function getFriendlyError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.'
  const raw = error instanceof Error ? error.message : String(error)
  if (raw && AUTH_MESSAGES[raw]) return AUTH_MESSAGES[raw]

  const code = (error as { code?: string } | null)?.code
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]

  const match = raw?.match(/(?:auth|storage)\/[a-z-]+/)
  if (match && AUTH_MESSAGES[match[0]]) return AUTH_MESSAGES[match[0]]

  if (/permission|not authorized|insufficient permissions/i.test(raw)) return 'You do not have permission to complete that action.'
  if (/network|offline|failed to fetch/i.test(raw)) return 'Network error. Please check your connection and try again.'

  return 'We could not complete that action. Please try again in a moment.'
}

/** Sanitize + rethrow so callers can `catch (e) { throw new Error(getFriendlyError(e)) }`. */
export function toFriendlyError(error: unknown): Error {
  return new Error(getFriendlyError(error))
}
