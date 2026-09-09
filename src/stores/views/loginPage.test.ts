import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// loginPage.ts is a thin wrapper around authStore.login — mock authStore
// entirely so this file tests only the delegation/loading-state contract,
// not the HTTP flow (covered by authStore.test.ts).
const mockLogin = vi.fn()
vi.mock('@/stores/api/authStore', () => ({
  useAuthStore: () => ({ login: mockLogin }),
}))

import { useLoginPageStore } from '@/stores/views/loginPage'

describe('loginPage store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockLogin.mockReset()
  })

  it('delegates to authStore.login with the entered email and password', async () => {
    mockLogin.mockResolvedValue(undefined)

    const store = useLoginPageStore()
    store.email = 'administracion@iu.org.mx'
    store.password = 'abc123'

    await store.onLogin()

    expect(mockLogin).toHaveBeenCalledWith('administracion@iu.org.mx', 'abc123')
  })

  it('does not call login when email is empty', async () => {
    const store = useLoginPageStore()
    store.email = ''
    store.password = 'abc123'

    await store.onLogin()

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('does not call login when password is empty', async () => {
    const store = useLoginPageStore()
    store.email = 'administracion@iu.org.mx'
    store.password = ''

    await store.onLogin()

    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('surfaces loading=true to the view while onLogin is in flight, then resets to false', async () => {
    let resolveLogin: () => void = () => {}
    mockLogin.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve
        }),
    )

    const store = useLoginPageStore()
    store.email = 'administracion@iu.org.mx'
    store.password = 'abc123'

    const pending = store.onLogin()
    expect(store.loading).toBe(true)

    resolveLogin()
    await pending

    expect(store.loading).toBe(false)
  })

  it('resets loading to false even when login rejects', async () => {
    mockLogin.mockRejectedValue(new Error('network error'))

    const store = useLoginPageStore()
    store.email = 'administracion@iu.org.mx'
    store.password = 'abc123'

    await store.onLogin()

    expect(store.loading).toBe(false)
  })
})
