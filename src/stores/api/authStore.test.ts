// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `vi.mock` factories are hoisted above ALL module code, including real
// `import` statements (which the ESM spec always evaluates before other
// top-level statements). `vi.hoisted` guarantees these mock fns exist by
// the time `@/stores/api/authStore` (and its own imports) load — relying on
// plain `const` + Vitest's automatic hoisting detection was unreliable once
// more than one mock var preceded a single `vi.mock` call.
const { mockPush, mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    defaults: { headers: { common: {} as Record<string, string> } },
  },
}))

import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockPush.mockReset()
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
  })

  it('persists the token, sets the Authorization header, and navigates on successful login', async () => {
    mockAxiosGet.mockResolvedValue({})
    mockAxiosPost.mockResolvedValue({ data: { token: 'abc123' } })

    const authStore = useAuthStore()
    await authStore.login('administracion@iu.org.mx', 'abc123')

    expect(mockAxiosPost).toHaveBeenCalledWith(
      'api/administration/login',
      { email: 'administracion@iu.org.mx', password: 'abc123' },
      { headers: { accept: 'application/json' } },
    )
    expect(authStore.token).toBe('abc123')
    expect(localStorage.getItem('token')).toBe('abc123')
    expect(mockPush).toHaveBeenCalledWith({ path: '/' })
  })

  it('does not persist a token or navigate on invalid credentials (422)', async () => {
    mockAxiosGet.mockResolvedValue({})
    mockAxiosPost.mockRejectedValue({ response: { status: 422, data: { msg: 'Las credenciales son incorrectas.' } } })

    const authStore = useAuthStore()
    const alertStore = useAlertStore()

    await authStore.login('administracion@iu.org.mx', 'wrong-password')

    expect(authStore.token).toBe('')
    expect(localStorage.getItem('token')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
  })

  it('does not persist a token or navigate when the double gate rejects (403 — wrong user_type or missing ADMINISTRATION role)', async () => {
    mockAxiosGet.mockResolvedValue({})
    mockAxiosPost.mockRejectedValue({
      response: { status: 403, data: { res: false, msg: 'Acceso denegado.' } },
    })

    const authStore = useAuthStore()
    const alertStore = useAlertStore()

    await authStore.login('staff@iu.org.mx', 'abc123')

    expect(authStore.token).toBe('')
    expect(localStorage.getItem('token')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
  })

  it('clears the token on logout', async () => {
    mockAxiosPost.mockResolvedValue({})

    const authStore = useAuthStore()
    authStore.token = 'abc123'
    authStore.loggedUser = true
    localStorage.setItem('token', 'abc123')

    await authStore.logout()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/administration/logout')
    expect(authStore.token).toBe('')
    expect(authStore.loggedUser).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
    // NOTE: logout() also assigns `window.location.href = '/auth/login'`.
    // jsdom logs a harmless "Not implemented: navigation" warning for that
    // assignment and does not actually navigate — asserting on it here would
    // be testing jsdom's stub, not our code, so it is intentionally omitted.
  })

  it('shows an alert and does not clear existing state when logout fails', async () => {
    mockAxiosPost.mockRejectedValue(new Error('network error'))

    const authStore = useAuthStore()
    const alertStore = useAlertStore()
    authStore.token = 'abc123'
    localStorage.setItem('token', 'abc123')

    await authStore.logout()

    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(authStore.token).toBe('abc123')
    expect(localStorage.getItem('token')).toBe('abc123')
  })

  it('calls getProfile with a single token argument and rehydrates the session on success', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({}) // inert sanctum/csrf-cookie precall
      .mockResolvedValueOnce({
        data: {
          id: 1,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@iu.org.mx',
          roles: [{ id: 1, name: 'ADMINISTRATION' }],
        },
      })

    const authStore = useAuthStore()
    await authStore.getProfile('stored-token')

    expect(mockAxiosGet).toHaveBeenNthCalledWith(2, 'api/administration/administration')
    expect(authStore.loggedUser).toBe(true)
    expect(authStore.token).toBe('stored-token')
    expect(authStore.fullName).toBe('Ada Lovelace')
  })

  it('does not rehydrate the session when getProfile fails', async () => {
    mockAxiosGet.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('unauthorized'))

    const authStore = useAuthStore()
    await authStore.getProfile('expired-token')

    expect(authStore.loggedUser).toBe(false)
  })
})
