// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// The real router imports the real authStore, which itself imports axios
// and vue-router's useRouter. Mock authStore entirely so the guard is
// exercised against a controllable `loggedUser`/`getProfile`, per design's
// "memory-history router + mocked store" testing strategy. `loggedUser` is
// a real `ref` so `storeToRefs()` in router/index.ts unwraps it correctly.
const mockGetProfile = vi.fn()
const mockLoggedUser = ref(false)
vi.mock('@/stores/api/authStore', () => ({
  useAuthStore: () => ({
    getProfile: mockGetProfile,
    loggedUser: mockLoggedUser,
  }),
}))

// `vi.mock` calls are hoisted above imports by Vitest, so this static import
// of the real router already resolves against the mocked authStore above.
import router from '@/router'

describe('router auth guard', () => {
  beforeEach(async () => {
    localStorage.clear()
    mockGetProfile.mockReset()
    mockLoggedUser.value = false
    // Reset to a neutral route not covered by the guard under test, so each
    // `push` below is a genuine navigation (vue-router throws on pushing to
    // the exact same location).
    await router.replace('/404')
  })

  it('redirects unauthenticated access to a requiresAuth route to /auth/login', async () => {
    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/auth/login')
    expect(mockGetProfile).not.toHaveBeenCalled()
  })

  it('allows access when a valid token exists and getProfile rehydrates the session', async () => {
    localStorage.setItem('token', 'stored-token')
    mockGetProfile.mockImplementation(async () => {
      mockLoggedUser.value = true
    })

    await router.push('/')

    expect(mockGetProfile).toHaveBeenCalledWith('stored-token')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects to /auth/login when a stored token fails to rehydrate a session', async () => {
    localStorage.setItem('token', 'expired-token')
    mockGetProfile.mockImplementation(async () => {
      // Simulates an expired/invalid token: profile call resolves without
      // authenticating the user.
      mockLoggedUser.value = false
    })

    await router.push('/')

    expect(mockGetProfile).toHaveBeenCalledWith('expired-token')
    expect(router.currentRoute.value.path).toBe('/auth/login')
  })

  it('allows direct access to a route without meta.requiresAuth regardless of auth state', async () => {
    await router.push('/404')

    expect(router.currentRoute.value.path).toBe('/404')
    expect(mockGetProfile).not.toHaveBeenCalled()
  })
})
