// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Administrator, CreateAdministratorForm } from '@/interfaces/administrator'
import type { AdministrationRole } from '@/interfaces/role'

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

import { useAdministratorsStore } from '@/stores/api/administratorsStore'

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 1,
  name: 'SOPORTE',
  permissions: [],
  ...overrides,
})

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 1,
  first_name: 'Ana',
  last_name: 'Perez',
  email: 'ana@example.com',
  roles: [],
  ...overrides,
})

const buildCreateForm = (overrides: Partial<CreateAdministratorForm> = {}): CreateAdministratorForm => ({
  first_name: 'Ana',
  last_name: 'Perez',
  email: 'ana@example.com',
  password: 'password123',
  ...overrides,
})

describe('administratorsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPut.mockReset()
  })

  describe('fetchAdministrators', () => {
    it('fetches the Accesos-scoped administrator list and maps it by id', async () => {
      const administrator = buildAdministrator()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, administrators: [administrator] } })

      const store = useAdministratorsStore()
      const result = await store.fetchAdministrators()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/administrators')
      expect(result).toBe(true)
      expect(store.allAdministrators).toEqual(new Map([[administrator.id, administrator]]))
    })

    it('returns false and leaves allAdministrators untouched on failure', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useAdministratorsStore()
      const result = await store.fetchAdministrators()

      expect(result).toBe(false)
      expect(store.allAdministrators.size).toBe(0)
    })
  })

  describe('fetchAdministrator', () => {
    it('returns the administrator on 200', async () => {
      const administrator = buildAdministrator()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, administrator } })

      const store = useAdministratorsStore()
      const result = await store.fetchAdministrator(1)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/administrators/1')
      expect(result).toEqual(administrator)
    })

    it('returns null (does not throw) when the backend responds 404', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { status: 404, data: { res: false, msg: 'Cuenta no encontrada.' } },
      })

      const store = useAdministratorsStore()
      const result = await store.fetchAdministrator(999)

      expect(result).toBeNull()
    })
  })

  describe('createAdministrator', () => {
    it('POSTs only nombres/correo/contraseña and stores the created administrator', async () => {
      const form = buildCreateForm()
      const created = buildAdministrator({ id: 2 })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, administrator: created } })

      const store = useAdministratorsStore()
      const result = await store.createAdministrator(form)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/administrators', form)
      expect(result).toEqual(created)
      expect(store.allAdministrators.get(2)).toEqual(created)
    })

    // Surfacing contract: write ops do not catch — they propagate the
    // rejection to the caller (mirrors rolesStore.createRole/paymentDataStore
    // .savePaymentData's uncaught-write pattern), so the UI layer decides how
    // to display a 403/422.
    it('propagates a 403 (unauthorized) error to the caller instead of swallowing it', async () => {
      const error = { response: { status: 403, data: { res: false, msg: 'No autorizado.' } } }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useAdministratorsStore()

      await expect(store.createAdministrator(buildCreateForm())).rejects.toEqual(error)
      expect(store.allAdministrators.size).toBe(0)
    })

    it('propagates a 422 (validation, e.g. duplicate email) error to the caller', async () => {
      const error = {
        response: { status: 422, data: { res: false, errors: { email: ['El correo ya existe.'] } } },
      }
      mockAxiosPost.mockRejectedValueOnce(error)

      const store = useAdministratorsStore()

      await expect(store.createAdministrator(buildCreateForm())).rejects.toEqual(error)
    })
  })

  describe('assignRole', () => {
    it('PUTs role_id and stores the updated administrator', async () => {
      const role = buildRole()
      const updated = buildAdministrator({ roles: [role] })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, administrator: updated } })

      const store = useAdministratorsStore()
      const result = await store.assignRole(1, role.id)

      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/administrators/1/role', { role_id: role.id })
      expect(result).toEqual(updated)
      expect(store.allAdministrators.get(1)).toEqual(updated)
    })

    // R4/A2 self-demotion guard — surfaced by AdministratorController as a
    // 422 before any write. Store must propagate it uncaught, same as every
    // other write op, so the detail view (PR10) can show a specific message.
    it('propagates a 422 (self-demotion guard) error to the caller instead of swallowing it', async () => {
      const error = {
        response: { status: 422, data: { res: false, msg: 'No puedes modificar tu propia asignación de rol.' } },
      }
      mockAxiosPut.mockRejectedValueOnce(error)

      const store = useAdministratorsStore()

      await expect(store.assignRole(1, 2)).rejects.toEqual(error)
    })

    it('propagates a 403 (unauthorized) error to the caller', async () => {
      const error = { response: { status: 403, data: { res: false, msg: 'No autorizado.' } } }
      mockAxiosPut.mockRejectedValueOnce(error)

      const store = useAdministratorsStore()

      await expect(store.assignRole(1, 2)).rejects.toEqual(error)
    })
  })
})
