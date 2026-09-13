// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useAccesoDetailPage } from '@/composables/useAccesoDetailPage'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Administrator } from '@/interfaces/administrator'
import type { AdministrationRole } from '@/interfaces/role'

// Mirrors useRoleDetailPage.test.ts's withSetup helper (D4: lifecycle lives
// in the composable, only fires against a real mounted component instance),
// extended with a router plugin since this composable reads the `:id` route
// param.
function withSetup<T>(composable: () => T, router: Router): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  return result
}

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 5,
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana@example.com',
  roles: [{ id: 1, name: 'SOPORTE', permissions: [] }],
  ...overrides,
})

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 2,
  name: 'ROOT_ADMINISTRATION',
  permissions: [],
  ...overrides,
})

const buildRouter = async (id: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/control/accesos/:id', component: { template: '<div />' } }],
  })
  await router.push(`/control/accesos/${id}`)
  return router
}

describe('useAccesoDetailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the administrator and the shared roles catalog on mount, resolving currentRole from roles[0]', async () => {
    const administrator = buildAdministrator()
    const role = buildRole()
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    const fetchAdministratorSpy = vi
      .spyOn(administratorsStore, 'fetchAdministrator')
      .mockResolvedValue(administrator)
    const fetchRolesSpy = vi.spyOn(rolesStore, 'fetchRoles').mockImplementation(async () => {
      rolesStore.allRoles = new Map([[role.id, role]])
      return true
    })

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_ADMINS']

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(fetchAdministratorSpy).toHaveBeenCalledWith(5)
    // Confirms the SHARED rolesStore.fetchRoles is reused, not a
    // duplicate/parallel catalog fetch (design obs #1593, apply-progress
    // obs #1595 flag #27).
    expect(fetchRolesSpy).toHaveBeenCalledTimes(1)
    expect(result.administrator.value).toEqual(administrator)
    expect(result.currentRole.value).toEqual(administrator.roles[0])
    expect(result.availableRoles.value).toEqual([role])
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
    expect(result.canManage.value).toBe(true)
  })

  it('resolves currentRole=null when the administrator holds no role yet', async () => {
    const administrator = buildAdministrator({ roles: [] })
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(administrator)
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    expect(result.currentRole.value).toBeNull()
    expect(result.loadError.value).toBe(false)
  })

  it('sets loadError=true when fetchAdministrator resolves null (e.g. a 404)', async () => {
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(null)
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)

    const router = await buildRouter('999')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.administrator.value).toBeNull()
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true when rolesStore.fetchRoles fails, even if fetchAdministrator succeeds', async () => {
    const administrator = buildAdministrator()
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(administrator)
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(false)

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.administrator.value).toEqual(administrator)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true for an invalid route id without calling either store', async () => {
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    const fetchAdministratorSpy = vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(null)
    const fetchRolesSpy = vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)

    const router = await buildRouter('not-a-number')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    expect(fetchAdministratorSpy).not.toHaveBeenCalled()
    expect(fetchRolesSpy).not.toHaveBeenCalled()
    expect(result.loadError.value).toBe(true)
  })

  it('canManage reflects authStore.manageAdmins=false when the permission is absent', async () => {
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(buildAdministrator())
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)

    const authStore = useAuthStore()
    authStore.permissions = []

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    expect(result.canManage.value).toBe(false)
  })

  it('assignRole delegates to administratorsStore.assignRole with the administrator id and role id, and refreshes administrator with the result', async () => {
    const administrator = buildAdministrator()
    const updatedAdministrator = buildAdministrator({ roles: [buildRole()] })
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(administrator)
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)
    const assignRoleSpy = vi.spyOn(administratorsStore, 'assignRole').mockResolvedValue(updatedAdministrator)

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    await result.assignRole(2)

    expect(assignRoleSpy).toHaveBeenCalledWith(5, 2)
    expect(result.administrator.value).toEqual(updatedAdministrator)
  })

  it('assignRole propagates a rejection without catching it, and does not overwrite administrator', async () => {
    const administrator = buildAdministrator()
    const administratorsStore = useAdministratorsStore()
    const rolesStore = useRolesStore()
    vi.spyOn(administratorsStore, 'fetchAdministrator').mockResolvedValue(administrator)
    vi.spyOn(rolesStore, 'fetchRoles').mockResolvedValue(true)
    vi.spyOn(administratorsStore, 'assignRole').mockRejectedValue(new Error('422'))

    const router = await buildRouter('5')
    const result = withSetup(() => useAccesoDetailPage(), router)
    await flushPromises()

    await expect(result.assignRole(2)).rejects.toThrow('422')
    expect(result.administrator.value).toEqual(administrator)
  })
})
