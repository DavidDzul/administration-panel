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
import { campusArray, PERMISSIONS } from '@/constants'

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockPush.mockReset()
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
  })

  it('persists the token, loads permissions, sets the Authorization header, and navigates on successful login', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({}) // inert sanctum/csrf-cookie precall
      .mockResolvedValueOnce({ data: { permissions: ['ADM_READ_USERS'] } }) // api/admin/permissions
    mockAxiosPost.mockResolvedValue({ data: { token: 'abc123' } })

    const authStore = useAuthStore()
    await authStore.login('administracion@iu.org.mx', 'abc123')

    expect(mockAxiosPost).toHaveBeenCalledWith(
      'api/admin/login',
      { email: 'administracion@iu.org.mx', password: 'abc123' },
      { headers: { accept: 'application/json' } },
    )
    expect(mockAxiosGet).toHaveBeenNthCalledWith(2, 'api/admin/permissions', {
      headers: { Authorization: 'Bearer abc123' },
    })
    expect(authStore.token).toBe('abc123')
    expect(authStore.permissions).toEqual(['ADM_READ_USERS'])
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

  it('does not persist a token or navigate on invalid user_type (403)', async () => {
    mockAxiosGet.mockResolvedValue({})
    mockAxiosPost.mockRejectedValue({
      response: { status: 403, data: { res: false, msg: 'Acceso denegado. Este usuario no tiene permisos de administrador.' } },
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

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/logout')
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

  it('calls getProfile against api/admin/admin, loads permissions, and rehydrates the session on success', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({}) // inert sanctum/csrf-cookie precall
      .mockResolvedValueOnce({
        data: {
          id: 1,
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@iu.org.mx',
          roles: [{ id: 1, name: 'ROOT_ADMINISTRATION' }],
        },
      })
      .mockResolvedValueOnce({ data: { permissions: ['ADM_READ_USERS'] } }) // api/admin/permissions

    const authStore = useAuthStore()
    await authStore.getProfile('stored-token')

    expect(mockAxiosGet).toHaveBeenNthCalledWith(2, 'api/admin/admin')
    expect(mockAxiosGet).toHaveBeenNthCalledWith(3, 'api/admin/permissions', {
      headers: { Authorization: 'Bearer stored-token' },
    })
    expect(authStore.loggedUser).toBe(true)
    expect(authStore.token).toBe('stored-token')
    expect(authStore.permissions).toEqual(['ADM_READ_USERS'])
    expect(authStore.fullName).toBe('Ada Lovelace')
  })

  it('does not rehydrate the session when getProfile fails', async () => {
    mockAxiosGet.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('unauthorized'))

    const authStore = useAuthStore()
    await authStore.getProfile('expired-token')

    expect(authStore.loggedUser).toBe(false)
  })

  it('fetches permissions from api/admin/permissions and stores them', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { permissions: ['ADM_READ_USERS'] } })

    const authStore = useAuthStore()
    const result = await authStore.getPermissions('abc123')

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/permissions', {
      headers: { Authorization: 'Bearer abc123' },
    })
    expect(result).toEqual(['ADM_READ_USERS'])
    expect(authStore.permissions).toEqual(['ADM_READ_USERS'])
  })

  it('returns an empty array and does not throw when getPermissions fails', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

    const authStore = useAuthStore()
    const result = await authStore.getPermissions('abc123')

    expect(result).toEqual([])
    expect(authStore.permissions).toEqual([])
  })

  it('updates the profile via api/admin/updateProfile and shows a success alert', async () => {
    mockAxiosPost.mockResolvedValueOnce({
      data: {
        res: true,
        msg: 'Usuario actualizado correctamente',
        user: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@iu.org.mx', phone: '9911071509' },
      },
    })

    const authStore = useAuthStore()
    const alertStore = useAlertStore()

    await authStore.updateProfile({
      id: 1,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@iu.org.mx',
      phone: '9911071509',
      password: '',
      confirmation: '',
    })

    expect(mockAxiosPost).toHaveBeenCalledWith(
      'api/admin/updateProfile',
      expect.objectContaining({ id: 1, email: 'ada@iu.org.mx' }),
      { headers: { accept: 'application/json' } },
    )
    expect(authStore.userProfile?.first_name).toBe('Ada')
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('success')
  })

  it('shows an error alert and rethrows when updateProfile fails', async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error('network error'))

    const authStore = useAuthStore()
    const alertStore = useAlertStore()

    await expect(
      authStore.updateProfile({
        id: 1,
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@iu.org.mx',
        phone: '9911071509',
        password: '',
        confirmation: '',
      }),
    ).rejects.toThrow('network error')

    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
  })

  // Task 3.4 — filteredCampus / readUsers additions (PR3). These are pure
  // computed properties: no axios calls involved, so no mock setup needed
  // beyond the existing store instantiation.
  it('readUsers is true when permissions include ADM_READ_USERS', () => {
    const authStore = useAuthStore()
    authStore.permissions = [PERMISSIONS.READ_USERS]

    expect(authStore.readUsers).toBe(true)
  })

  it('readUsers is false when the permission is absent', () => {
    const authStore = useAuthStore()
    authStore.permissions = []

    expect(authStore.readUsers).toBe(false)
  })

  it('filteredCampus returns every campus for a ROOT_ADMINISTRATION user', () => {
    const authStore = useAuthStore()
    authStore.userProfile = {
      id: 1,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@iu.org.mx',
      campus: 'MERIDA',
      roles: [{ id: 1, name: 'ROOT_ADMINISTRATION' }],
    }

    expect(authStore.filteredCampus).toEqual(campusArray)
  })

  it('filteredCampus returns every campus for a ROOT user', () => {
    const authStore = useAuthStore()
    authStore.userProfile = {
      id: 1,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@iu.org.mx',
      campus: 'MERIDA',
      roles: [{ id: 1, name: 'ROOT' }],
    }

    expect(authStore.filteredCampus).toEqual(campusArray)
  })

  it('filteredCampus narrows to the own campus for a non-root user', () => {
    const authStore = useAuthStore()
    authStore.userProfile = {
      id: 2,
      first_name: 'Grace',
      last_name: 'Hopper',
      email: 'grace@iu.org.mx',
      campus: 'VALLADOLID',
      roles: [{ id: 2, name: 'CAMPUS_STAFF' }],
    }

    expect(authStore.filteredCampus).toEqual(campusArray.filter((c) => c.value === 'VALLADOLID'))
  })

  it('filteredCampus is empty when there is no userProfile yet', () => {
    const authStore = useAuthStore()

    expect(authStore.filteredCampus).toEqual([])
  })
})
