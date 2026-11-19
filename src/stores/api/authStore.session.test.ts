import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { post, get, headers, push, showAlert } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  headers: { common: {} as Record<string, string> },
  push: vi.fn(),
  showAlert: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: {
    get,
    post,
    defaults: { headers },
  },
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/stores/alert', () => ({ useAlertStore: () => ({ showAlert }) }))

import { useAuthStore } from '@/stores/api/authStore'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
})

beforeEach(() => {
  setActivePinia(createPinia())
  ;[post, get, push, showAlert].forEach((m) => m.mockReset())
  storage.clear()
  headers.common = {}
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const loggedIn = () => {
  const store = useAuthStore()
  store.token = 'abc'
  store.loggedUser = true
  store.permissions = ['ADM_X']
  storage.set('token', 'abc')
  headers.common['Authorization'] = 'Bearer abc'
  return store
}

describe('authStore.handleUnauthorized', () => {
  it('clears the session, shows the server msg and redirects to login', () => {
    const store = loggedIn()

    store.handleUnauthorized('Tu cuenta está desactivada.')

    expect(store.token).toBe('')
    expect(store.loggedUser).toBe(false)
    expect(store.userProfile).toBeUndefined()
    expect(store.permissions).toEqual([])
    expect(storage.has('token')).toBe(false)
    expect(headers.common['Authorization']).toBeUndefined()
    expect(showAlert).toHaveBeenCalledWith({ title: 'Tu cuenta está desactivada.', status: 'error' })
    expect(push).toHaveBeenCalledWith('/auth/login')
  })

  it('falls back to a generic session-expired message', () => {
    const store = loggedIn()
    store.handleUnauthorized()
    expect(showAlert).toHaveBeenCalledWith({
      title: 'Tu sesión expiró. Inicia sesión nuevamente.',
      status: 'error',
    })
  })

  it('does nothing when there is no session (several 401s in flight)', () => {
    const store = useAuthStore()
    store.handleUnauthorized('x')
    expect(showAlert).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('only handles the first of several concurrent 401s', () => {
    const store = loggedIn()
    store.handleUnauthorized('a')
    store.handleUnauthorized('b')
    expect(showAlert).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledTimes(1)
  })
})

describe('authStore.login throttling', () => {
  it('shows the throttle message on a 429', async () => {
    get.mockResolvedValue({})
    post.mockRejectedValue({ isAxiosError: true, response: { status: 429, data: {} } })
    const store = useAuthStore()

    await store.login('a@b.c', 'pw')

    expect(showAlert).toHaveBeenCalledWith({
      title: 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
      status: 'error',
    })
  })

  it('keeps the credentials message for a 422', async () => {
    get.mockResolvedValue({})
    post.mockRejectedValue({ isAxiosError: true, response: { status: 422, data: {} } })
    const store = useAuthStore()

    await store.login('a@b.c', 'pw')

    expect(showAlert).toHaveBeenCalledWith({
      title: 'Error al iniciar sesión, verifica tu usuario y/o contraseña.',
      status: 'error',
    })
    expect(push).not.toHaveBeenCalled()
  })
})
