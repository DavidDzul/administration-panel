import { isAxiosError } from 'axios'
import type { AxiosInstance } from 'axios'

// Requests whose 401 means "bad credentials / no cookie", not "session lost".
// Intercepting them would loop the login screen back into itself.
const EXEMPT_URLS = ['api/admin/login', 'sanctum/csrf-cookie']

const isExempt = (url: string | undefined): boolean => {
  const path = (url ?? '').replace(/^\/+/, '')
  return EXEMPT_URLS.some((exempt) => path.endsWith(exempt))
}

const serverMessage = (data: unknown): string | undefined => {
  const msg = (data as { msg?: unknown } | undefined)?.msg
  return typeof msg === 'string' && msg ? msg : undefined
}

/**
 * On a 401 from an authenticated API call, hand the server `msg` (if any) to
 * `onUnauthorized` so the session can be cleared. The error is always re-thrown
 * so callers keep their own failure handling.
 */
export const installUnauthorizedInterceptor = (
  instance: AxiosInstance,
  onUnauthorized: (message?: string) => void,
): number =>
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 401 && !isExempt(error.config?.url)) {
        onUnauthorized(serverMessage(error.response.data))
      }
      return Promise.reject(error)
    },
  )
