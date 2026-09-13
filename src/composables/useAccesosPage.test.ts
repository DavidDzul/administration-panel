// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useAccesosPage } from '@/composables/useAccesosPage'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Administrator } from '@/interfaces/administrator'

// Same rationale as useRolesPage.test.ts's withSetup: onBeforeMount inside a
// plain composable only fires against a real component instance.
function withSetup<T>(composable: () => T): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  return result
}

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 1,
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana@example.com',
  roles: [],
  ...overrides,
})

describe('useAccesosPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches administrators on mount and exposes the mapped list, with loading true then false', async () => {
    const administrator = buildAdministrator()
    const administratorsStore = useAdministratorsStore()
    vi.spyOn(administratorsStore, 'fetchAdministrators').mockImplementation(async () => {
      administratorsStore.allAdministrators = new Map([[administrator.id, administrator]])
      return true
    })

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_ADMINS']

    const result = withSetup(() => useAccesosPage())

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(administratorsStore.fetchAdministrators).toHaveBeenCalledTimes(1)
    expect(result.administrators.value).toEqual([administrator])
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
    expect(result.canManage.value).toBe(true)
  })

  it('sets loadError=true when fetchAdministrators fails', async () => {
    const administratorsStore = useAdministratorsStore()
    vi.spyOn(administratorsStore, 'fetchAdministrators').mockResolvedValue(false)

    const result = withSetup(() => useAccesosPage())
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('canManage reflects authStore.manageAdmins=false when the permission is absent', async () => {
    const administratorsStore = useAdministratorsStore()
    vi.spyOn(administratorsStore, 'fetchAdministrators').mockResolvedValue(true)

    const authStore = useAuthStore()
    authStore.permissions = []

    const result = withSetup(() => useAccesosPage())
    await flushPromises()

    expect(result.canManage.value).toBe(false)
  })
})
