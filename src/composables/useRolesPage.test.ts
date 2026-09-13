// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useRolesPage } from '@/composables/useRolesPage'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { AdministrationRole } from '@/interfaces/role'

// Same rationale as usePersonsPage.test.ts's withSetup: onBeforeMount inside
// a plain composable only fires against a real component instance.
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

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 1,
  name: 'SOPORTE',
  permissions: [],
  ...overrides,
})

describe('useRolesPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches roles on mount and exposes the mapped list, with loading true then false', async () => {
    const role = buildRole()
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRoles').mockImplementation(async () => {
      rolesStore.allRoles = new Map([[role.id, role]])
      return true
    })

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_ROLES']

    const result = withSetup(() => useRolesPage())

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(rolesStore.fetchRoles).toHaveBeenCalledTimes(1)
    expect(result.roles.value).toEqual([role])
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
    expect(result.canManage.value).toBe(true)
  })

  it('sets loadError=true when fetchRoles fails', async () => {
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(false)

    const result = withSetup(() => useRolesPage())
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('canManage reflects authStore.manageRoles=false when the permission is absent', async () => {
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)

    const authStore = useAuthStore()
    authStore.permissions = []

    const result = withSetup(() => useRolesPage())
    await flushPromises()

    expect(result.canManage.value).toBe(false)
  })
})
