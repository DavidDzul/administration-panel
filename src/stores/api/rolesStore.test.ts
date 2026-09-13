// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AdministrationRole, AdministrationPermission } from '@/interfaces/role'

const { mockAxiosGet, mockAxiosPost, mockAxiosPut } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosPut: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
    put: mockAxiosPut,
  },
}))

import { useRolesStore } from '@/stores/api/rolesStore'

const buildPermission = (overrides: Partial<AdministrationPermission> = {}): AdministrationPermission => ({
  id: 1,
  name: 'ADM_READ_ROLES',
  ...overrides,
})

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 1,
  name: 'SOPORTE',
  permissions: [buildPermission()],
  ...overrides,
})

describe('rolesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPut.mockReset()
  })

  describe('fetchRoles', () => {
    it('fetches the ADMINISTRATION-type role catalog and maps it by id', async () => {
      const role = buildRole()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, roles: [role] } })

      const store = useRolesStore()
      const result = await store.fetchRoles()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/administration-roles')
      expect(result).toBe(true)
      expect(store.allRoles).toEqual(new Map([[role.id, role]]))
    })

    it('returns false and leaves allRoles untouched on failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useRolesStore()
      const result = await store.fetchRoles()

      expect(result).toBe(false)
      expect(store.allRoles.size).toBe(0)
    })
  })

  describe('fetchRole', () => {
    it('returns the role on 200', async () => {
      const role = buildRole()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, role } })

      const store = useRolesStore()
      const result = await store.fetchRole(1)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/administration-roles/1')
      expect(result).toEqual(role)
    })

    it('returns null (does not throw) when the backend responds 404', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { status: 404, data: { res: false, msg: 'Rol no encontrado.' } },
      })

      const store = useRolesStore()
      const result = await store.fetchRole(999)

      expect(result).toBeNull()
    })
  })

  describe('fetchPermissionsCatalog', () => {
    it('fetches the ADMINISTRATION-type permissions catalog', async () => {
      const permission = buildPermission()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, permissions: [permission] } })

      const store = useRolesStore()
      const result = await store.fetchPermissionsCatalog()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/administration-roles/permissions')
      expect(result).toBe(true)
      expect(store.permissionsCatalog).toEqual([permission])
    })

    it('returns false on failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useRolesStore()
      const result = await store.fetchPermissionsCatalog()

      expect(result).toBe(false)
      expect(store.permissionsCatalog).toEqual([])
    })
  })

  describe('createRole', () => {
    it('POSTs only the name (no type field) and stores the created role', async () => {
      const created = buildRole({ id: 2, name: 'NUEVO_ROL', permissions: [] })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, role: created } })

      const store = useRolesStore()
      const result = await store.createRole('NUEVO_ROL')

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/administration-roles', { name: 'NUEVO_ROL' })
      expect(result).toEqual(created)
      expect(store.allRoles.get(2)).toEqual(created)
    })

    // Surfacing contract: write ops do not catch — they propagate the
    // rejection to the caller (mirrors paymentDataStore.savePaymentData),
    // so the UI layer decides how to display a 403/422.
    it('propagates a 403 (unauthorized) error to the caller instead of swallowing it', async () => {
      const error = { response: { status: 403, data: { res: false, msg: 'No autorizado.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useRolesStore()

      await expect(store.createRole('NUEVO_ROL')).rejects.toEqual(error)
      expect(store.allRoles.size).toBe(0)
    })

    it('propagates a 422 (validation) error to the caller instead of swallowing it', async () => {
      const error = {
        response: { status: 422, data: { res: false, errors: { name: ['El nombre ya existe.'] } } },
      }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useRolesStore()

      await expect(store.createRole('DUPLICADO')).rejects.toEqual(error)
    })
  })

  describe('syncRolePermissions', () => {
    it('PUTs permissions_ids and stores the updated role', async () => {
      const updated = buildRole({ permissions: [buildPermission(), buildPermission({ id: 2, name: 'ADM_MANAGE_ROLES' })] })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, role: updated } })

      const store = useRolesStore()
      const result = await store.syncRolePermissions(1, [1, 2])

      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/administration-roles/1/permissions', {
        permissions_ids: [1, 2],
      })
      expect(result).toEqual(updated)
      expect(store.allRoles.get(1)).toEqual(updated)
    })

    it('propagates a 422 (a permission id not of type ADMINISTRATION) error to the caller', async () => {
      const error = {
        response: { status: 422, data: { res: false, errors: { 'permissions_ids.0': ['Inválido.'] } } },
      }
      mockAxiosPut.mockRejectedValueOnce(error)

      const store = useRolesStore()

      await expect(store.syncRolePermissions(1, [999])).rejects.toEqual(error)
    })

    it('propagates a 403 (unauthorized) error to the caller', async () => {
      const error = { response: { status: 403, data: { res: false, msg: 'No autorizado.' } } }
      mockAxiosPut.mockRejectedValueOnce(error)

      const store = useRolesStore()

      await expect(store.syncRolePermissions(1, [1])).rejects.toEqual(error)
    })
  })
})
