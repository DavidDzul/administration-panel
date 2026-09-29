// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ScholarshipSetting, ScholarshipSettingForm } from '@/interfaces/scholarshipSetting'

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

import { useScholarshipSettingsStore } from '@/stores/api/scholarshipSettingsStore'

const buildSetting = (overrides: Partial<ScholarshipSetting> = {}): ScholarshipSetting => ({
  id: 1,
  telmex_base_amount: '1000.00',
  ...overrides,
})

const buildForm = (overrides: Partial<ScholarshipSettingForm> = {}): ScholarshipSettingForm => ({
  telmex_base_amount: 1000,
  ...overrides,
})

// Design D8 (sdd/scholarship-telmex-iu-split): GET is ungated (shared
// reference data for both this settings view and PaymentDataDialog's hint);
// PUT is gated server-side behind ADM_MANAGE_SCHOLARSHIP_SETTINGS. Mirrors
// scholarshipProfileStore.test.ts's structure exactly.
describe('scholarshipSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPut.mockReset()
  })

  describe('fetchSetting', () => {
    it('returns the setting on 200', async () => {
      const data = buildSetting()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data } })

      const store = useScholarshipSettingsStore()
      const result = await store.fetchSetting()

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-settings')
      expect(result).toEqual(data)
    })

    it('rethrows on a network/server error (no special-case handling, unlike scholarshipProfileStore)', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = useScholarshipSettingsStore()

      await expect(store.fetchSetting()).rejects.toThrow('network error')
    })
  })

  describe('saveSetting', () => {
    it('PUTs to the scholarship-settings route with the submitted form and returns the saved setting', async () => {
      const saved = buildSetting({ telmex_base_amount: '1500.00' })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, data: saved } })

      const store = useScholarshipSettingsStore()
      const form = buildForm({ telmex_base_amount: 1500 })
      const result = await store.saveSetting(form)

      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/scholarship-settings', form)
      expect(result).toEqual(saved)
    })

    it('rejects and does not swallow the error when the backend rejects the save (e.g. 403)', async () => {
      mockAxiosPut.mockRejectedValueOnce({ response: { status: 403, data: { res: false, msg: 'No autorizado.' } } })

      const store = useScholarshipSettingsStore()

      await expect(store.saveSetting(buildForm())).rejects.toBeTruthy()
    })
  })
})
