// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Bank } from '@/interfaces/bank'

const { mockAxiosGet, mockAxiosPost, mockAxiosPut, mockAxiosDelete } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosPut: vi.fn(),
  mockAxiosDelete: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost, put: mockAxiosPut, delete: mockAxiosDelete },
}))

import { useBanksStore } from '@/stores/api/banksStore'

const buildBank = (overrides: Partial<Bank> = {}): Bank => ({
  id: 2,
  code: '014',
  name: 'Santander',
  is_active: true,
  is_system: false,
  ...overrides,
})

describe('banksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPut.mockReset()
    mockAxiosDelete.mockReset()
  })

  it('fetchBanks loads the catalog keyed by id and returns true', async () => {
    const bank = buildBank()
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [bank] } })

    const store = useBanksStore()
    const ok = await store.fetchBanks()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/banks')
    expect(ok).toBe(true)
    expect(store.banks).toEqual([bank])
  })

  it('fetchBanks returns false and keeps the list on failure', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const store = useBanksStore()
    expect(await store.fetchBanks()).toBe(false)
    expect(store.banks).toEqual([])
  })

  it('createBank posts the payload and adds the bank to the list', async () => {
    const bank = buildBank({ id: 9, code: '999', name: 'Nuevo' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, bank } })

    const store = useBanksStore()
    const created = await store.createBank({ code: '999', name: 'Nuevo', is_active: true })

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/banks', { code: '999', name: 'Nuevo', is_active: true })
    expect(created).toEqual(bank)
    expect(store.banks).toEqual([bank])
  })

  it('updateBank puts the payload and replaces the bank in the list', async () => {
    const old = buildBank()
    const updated = buildBank({ name: 'Santander México' })
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [old] } })
    mockAxiosPut.mockResolvedValueOnce({ data: { res: true, bank: updated } })

    const store = useBanksStore()
    await store.fetchBanks()
    await store.updateBank(old.id, { code: '014', name: 'Santander México', is_active: true })

    expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/banks/2', {
      code: '014',
      name: 'Santander México',
      is_active: true,
    })
    expect(store.banks).toEqual([updated])
  })

  it('deleteBank removes the bank when it was actually deleted', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [buildBank()] } })
    mockAxiosDelete.mockResolvedValueOnce({ data: { res: true, deleted: true, msg: 'Banco eliminado.' } })

    const store = useBanksStore()
    await store.fetchBanks()
    const result = await store.deleteBank(2)

    expect(mockAxiosDelete).toHaveBeenCalledWith('api/admin/banks/2')
    expect(result).toEqual({ deleted: true, msg: 'Banco eliminado.' })
    expect(store.banks).toEqual([])
  })

  it('deleteBank keeps the bank (deactivated) when it is referenced and returns the API message', async () => {
    const deactivated = buildBank({ is_active: false })
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [buildBank()] } })
    mockAxiosDelete.mockResolvedValueOnce({
      data: { res: true, deleted: false, msg: 'El banco está en uso, por lo que se desactivó en lugar de eliminarse.', bank: deactivated },
    })

    const store = useBanksStore()
    await store.fetchBanks()
    const result = await store.deleteBank(2)

    expect(result.deleted).toBe(false)
    expect(result.msg).toContain('desactivó')
    expect(store.banks).toEqual([deactivated])
  })
})
