// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useRoleDetailPage } from '@/composables/useRoleDetailPage'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { AdministrationRole, AdministrationPermission } from '@/interfaces/role'

// Mirrors usePersonDetailsPage.test.ts's withSetup helper (D4: lifecycle
// lives in the composable, only fires against a real mounted component
// instance), extended with a router plugin since this composable reads the
// `:id` route param.
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

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 5,
  name: 'SOPORTE',
  permissions: [{ id: 1, name: 'ADM_READ_ROLES' }],
  ...overrides,
})

const buildCatalog = (): AdministrationPermission[] => [
  { id: 1, name: 'ADM_READ_ROLES' },
  { id: 2, name: 'ADM_MANAGE_ROLES' },
]

const buildRouter = async (id: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/control/roles/:id', component: { template: '<div />' } }],
  })
  await router.push(`/control/roles/${id}`)
  return router
}

describe('useRoleDetailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the role and permissions catalog on mount, exposing the loaded state', async () => {
    const role = buildRole()
    const catalog = buildCatalog()
    const rolesStore = useRolesStore()
    const fetchRoleSpy = vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(role)
    const fetchCatalogSpy = vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockImplementation(async () => {
      rolesStore.permissionsCatalog = catalog
      return true
    })

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_ROLES']

    const router = await buildRouter('5')
    const result = withSetup(() => useRoleDetailPage(), router)

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(fetchRoleSpy).toHaveBeenCalledWith(5)
    expect(fetchCatalogSpy).toHaveBeenCalledTimes(1)
    expect(result.role.value).toEqual(role)
    expect(result.permissionsCatalog.value).toEqual(catalog)
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
    expect(result.canManage.value).toBe(true)
  })

  it('sets loadError=true when fetchRole resolves null (e.g. a 404)', async () => {
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(null)
    vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(true)

    const router = await buildRouter('999')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.role.value).toBeNull()
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true when fetchPermissionsCatalog fails, even if fetchRole succeeds', async () => {
    const role = buildRole()
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(role)
    vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(false)

    const router = await buildRouter('5')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.role.value).toEqual(role)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true for an invalid route id without calling either store', async () => {
    const rolesStore = useRolesStore()
    const fetchRoleSpy = vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(null)
    const fetchCatalogSpy = vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(true)

    const router = await buildRouter('not-a-number')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    expect(fetchRoleSpy).not.toHaveBeenCalled()
    expect(fetchCatalogSpy).not.toHaveBeenCalled()
    expect(result.loadError.value).toBe(true)
  })

  it('canManage reflects authStore.manageRoles=false when the permission is absent', async () => {
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(buildRole())
    vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(true)

    const authStore = useAuthStore()
    authStore.permissions = []

    const router = await buildRouter('5')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    expect(result.canManage.value).toBe(false)
  })

  it('savePermissions delegates to rolesStore.syncRolePermissions with the role id and ids, and refreshes role with the result', async () => {
    const role = buildRole()
    const updatedRole = buildRole({ permissions: buildCatalog() })
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(role)
    vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(true)
    const syncSpy = vi.spyOn(rolesStore, 'syncRolePermissions').mockResolvedValue(updatedRole)

    const router = await buildRouter('5')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    await result.savePermissions([1, 2])

    expect(syncSpy).toHaveBeenCalledWith(5, [1, 2])
    expect(result.role.value).toEqual(updatedRole)
  })

  it('savePermissions propagates a rejection without catching it, and does not overwrite role', async () => {
    const role = buildRole()
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(role)
    vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockResolvedValue(true)
    vi.spyOn(rolesStore, 'syncRolePermissions').mockRejectedValue(new Error('422'))

    const router = await buildRouter('5')
    const result = withSetup(() => useRoleDetailPage(), router)
    await flushPromises()

    await expect(result.savePermissions([1])).rejects.toThrow('422')
    expect(result.role.value).toEqual(role)
  })

  // permissionsByModule (permission-descriptions-modules, design obs #1601 D3/D4):
  // grouping/sorting derived state, additive alongside permissionsCatalog.
  describe('permissionsByModule', () => {
    const setupWithCatalog = async (catalog: AdministrationPermission[]) => {
      const rolesStore = useRolesStore()
      vi.spyOn(rolesStore, 'fetchRole').mockResolvedValue(buildRole())
      vi.spyOn(rolesStore, 'fetchPermissionsCatalog').mockImplementation(async () => {
        rolesStore.permissionsCatalog = catalog
        return true
      })

      const router = await buildRouter('5')
      const result = withSetup(() => useRoleDetailPage(), router)
      await flushPromises()
      return result
    }

    it('groups permissions by module, sorted alphabetically (es), keeping server order within each group', async () => {
      // Deliberately interleaved, mirroring the server's orderBy('name') output.
      const catalog: AdministrationPermission[] = [
        { id: 1, name: 'ADM_EDIT_PAYMENT_DATA', module: 'Datos de pago', description: 'Editar los datos de pago de un becario' },
        { id: 2, name: 'ADM_MANAGE_ADMINS', module: 'Accesos', description: 'Crear administradores y asignarles un rol' },
        { id: 3, name: 'ADM_MANAGE_ROLES', module: 'Roles', description: 'Crear roles y editar sus permisos' },
        { id: 4, name: 'ADM_READ_ADMINS', module: 'Accesos', description: 'Ver la lista de administradores' },
        { id: 5, name: 'ADM_READ_PAYMENT_DATA', module: 'Datos de pago', description: 'Ver los datos de pago de un becario' },
        { id: 6, name: 'ADM_READ_ROLES', module: 'Roles', description: 'Ver la lista de roles y sus permisos' },
        { id: 7, name: 'ADM_READ_USERS', module: 'Usuarios', description: 'Ver la lista de becarios y egresados' },
      ]

      const result = await setupWithCatalog(catalog)

      const groups = result.permissionsByModule.value
      expect(groups.map((g) => g.module)).toEqual(['Accesos', 'Datos de pago', 'Roles', 'Usuarios'])

      const accesos = groups.find((g) => g.module === 'Accesos')
      expect(accesos?.permissions.map((p) => p.id)).toEqual([2, 4])

      const datosDePago = groups.find((g) => g.module === 'Datos de pago')
      expect(datosDePago?.permissions.map((p) => p.id)).toEqual([1, 5])
    })

    it('groups null, undefined, and blank module values into a single trailing "Otros" group', async () => {
      const catalog: AdministrationPermission[] = [
        { id: 1, name: 'ADM_READ_ROLES', module: 'Roles', description: 'Ver la lista de roles y sus permisos' },
        { id: 2, name: 'LEGACY_NULL_MODULE', module: null, description: null },
        { id: 3, name: 'LEGACY_UNDEFINED_MODULE' },
        { id: 4, name: 'LEGACY_BLANK_MODULE', module: '   ' },
      ]

      const result = await setupWithCatalog(catalog)

      const groups = result.permissionsByModule.value
      expect(groups.map((g) => g.module)).toEqual(['Roles', 'Otros'])

      const otros = groups.find((g) => g.module === 'Otros')
      expect(otros?.permissions.map((p) => p.id)).toEqual([2, 3, 4])
    })

    it('returns an empty array for an empty catalog, without throwing', async () => {
      const result = await setupWithCatalog([])

      expect(result.permissionsByModule.value).toEqual([])
    })
  })
})
