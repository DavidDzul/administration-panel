// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ScholarshipProfileConfig, ScholarshipProfileConfigForm } from '@/interfaces/scholarshipProfile'

const { mockAxiosGet, mockAxiosPut } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPut: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
    put: mockAxiosPut,
  },
}))

import { useScholarshipProfileStore } from '@/stores/api/scholarshipProfileStore'

const buildConfig = (overrides: Partial<ScholarshipProfileConfig> = {}): ScholarshipProfileConfig => ({
  scholarship_type: 'IU',
  monthly_amount: '1500.00',
  monto_apoyo: '200.00',
  advance_payment_eligible: true,
  iu_payment_amount: null,
  ...overrides,
})

const buildForm = (overrides: Partial<ScholarshipProfileConfigForm> = {}): ScholarshipProfileConfigForm => ({
  scholarship_type: 'IU',
  monthly_amount: 1500,
  monto_apoyo: 200,
  advance_payment_eligible: true,
  iu_payment_amount: 0,
  ...overrides,
})

describe('scholarshipProfileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPut.mockReset()
  })

  describe('fetchProfileConfig', () => {
    it('returns the config on 200', async () => {
      const data = buildConfig()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data } })

      const store = useScholarshipProfileStore()
      const result = await store.fetchProfileConfig(5)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-profiles/5')
      expect(result).toEqual(data)
    })

    // Design D5: 404 means "not yet configured" — a normal, expected state,
    // never an error. Must resolve to `null`, same pattern as
    // paymentDataStore.fetchPaymentData.
    it('returns null (not an error) when the backend responds 404', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { status: 404, data: { res: false, data: null, msg: 'Perfil no encontrado.' } },
      })

      const store = useScholarshipProfileStore()
      const result = await store.fetchProfileConfig(5)

      expect(result).toBeNull()
    })

    it('rethrows on a non-404 error (e.g. network failure or 500)', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useScholarshipProfileStore()

      await expect(store.fetchProfileConfig(5)).rejects.toThrow('network error')
    })
  })

  describe('saveProfileConfig', () => {
    it('PUTs to the /config route with the submitted form and returns the saved config', async () => {
      const saved = buildConfig({ monthly_amount: '0.00' })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, data: saved } })

      const store = useScholarshipProfileStore()
      const form = buildForm({ monthly_amount: 0 })
      const result = await store.saveProfileConfig(5, form)

      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/scholarship-profiles/5/config', form)
      expect(result).toEqual(saved)
    })

    it('rejects and does not swallow the error when the backend rejects the save', async () => {
      mockAxiosPut.mockRejectedValueOnce({ response: { status: 422, data: { res: false, msg: 'monto_apoyo es requerido.' } } })

      const store = useScholarshipProfileStore()

      await expect(store.saveProfileConfig(5, buildForm())).rejects.toBeTruthy()
    })
  })
})
