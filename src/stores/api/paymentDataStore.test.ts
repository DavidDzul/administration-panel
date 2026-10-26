// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PaymentData, PaymentDataForm } from '@/interfaces/paymentData'

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

import { usePaymentDataStore } from '@/stores/api/paymentDataStore'

const buildPaymentData = (overrides: Partial<PaymentData> = {}): PaymentData => ({
  id: 1,
  user_id: 5,
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  curp: 'AAAA000101HDFRRR01',
  rfc: 'AAAA000101AAA',
  payment_method: 'TRANSFER',
  cheque_beneficiary: null,
  ...overrides,
})

const buildForm = (overrides: Partial<PaymentDataForm> = {}): PaymentDataForm => ({
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  curp: 'AAAA000101HDFRRR01',
  rfc: 'AAAA000101AAA',
  payment_method: 'TRANSFER',
  cheque_beneficiary: null,
  ...overrides,
})

describe('paymentDataStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPut.mockReset()
  })

  describe('fetchPaymentData', () => {
    it('returns the payment data on 200', async () => {
      const data = buildPaymentData()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data } })

      const store = usePaymentDataStore()
      const result = await store.fetchPaymentData(5)

      expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payment-data/5')
      expect(result).toEqual(data)
    })

    // Spec R1 "user can exist with no payment-data row" / R2 read scenario:
    // a 404 here means "not configured yet" — a normal, expected state, not
    // an error. Must resolve to `null`, never throw or surface as an error.
    it('returns null (not an error) when the backend responds 404', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { status: 404, data: { res: false, data: null, msg: 'Datos de pago no configurados.' } },
      })

      const store = usePaymentDataStore()
      const result = await store.fetchPaymentData(5)

      expect(result).toBeNull()
    })

    it('rethrows on a non-404 error (e.g. network failure or 500)', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

      const store = usePaymentDataStore()

      await expect(store.fetchPaymentData(5)).rejects.toThrow('network error')
    })
  })

  describe('savePaymentData', () => {
    it('POSTs to create when no prior fetch found an existing row', async () => {
      mockAxiosGet.mockRejectedValueOnce({ response: { status: 404, data: { res: false, data: null } } })
      const created = buildPaymentData()
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: created } })

      const store = usePaymentDataStore()
      await store.fetchPaymentData(5) // establishes "no existing row" for user 5
      const form = buildForm()
      const result = await store.savePaymentData(5, form)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payment-data', {
        user_id: 5,
        ...form,
      })
      expect(mockAxiosPut).not.toHaveBeenCalled()
      expect(result).toEqual(created)
    })

    it('PUTs to update when a prior fetch found an existing row', async () => {
      const existing = buildPaymentData()
      mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: existing } })
      const updated = buildPaymentData({ bank_name: 'Santander' })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, data: updated } })

      const store = usePaymentDataStore()
      await store.fetchPaymentData(5) // establishes "existing row" for user 5
      const form = buildForm({ bank_name: 'Santander' })
      const result = await store.savePaymentData(5, form)

      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/scholarship-payment-data/5', form)
      expect(mockAxiosPost).not.toHaveBeenCalled()
      expect(result).toEqual(updated)
    })

    it('defaults to POST when savePaymentData is called for a user with no prior fetch', async () => {
      const created = buildPaymentData({ user_id: 9 })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: created } })

      const store = usePaymentDataStore()
      const form = buildForm()
      const result = await store.savePaymentData(9, form)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payment-data', {
        user_id: 9,
        ...form,
      })
      expect(result).toEqual(created)
    })

    it('remembers a row created via savePaymentData, so a second save PUTs', async () => {
      const created = buildPaymentData({ user_id: 9 })
      mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: created } })
      const updated = buildPaymentData({ user_id: 9, bank_name: 'Santander' })
      mockAxiosPut.mockResolvedValueOnce({ data: { res: true, data: updated } })

      const store = usePaymentDataStore()
      await store.savePaymentData(9, buildForm())
      await store.savePaymentData(9, buildForm({ bank_name: 'Santander' }))

      expect(mockAxiosPost).toHaveBeenCalledTimes(1)
      expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/scholarship-payment-data/9', buildForm({ bank_name: 'Santander' }))
    })

    describe('payment method payload', () => {
      it('sends payment_method and a null cheque_beneficiary for TRANSFER', async () => {
        mockAxiosPost.mockResolvedValueOnce({ data: { res: true, data: buildPaymentData() } })

        const store = usePaymentDataStore()
        await store.savePaymentData(5, buildForm({ cheque_beneficiary: 'Maria Lopez' }))

        expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payment-data', {
          user_id: 5,
          bank_name: 'BBVA',
          account_number: '012180001234567895',
          curp: 'AAAA000101HDFRRR01',
          rfc: 'AAAA000101AAA',
          payment_method: 'TRANSFER',
          cheque_beneficiary: null,
        })
      })

      it('sends CHEQUE with the beneficiary and null bank fields', async () => {
        mockAxiosPost.mockResolvedValueOnce({
          data: { res: true, data: buildPaymentData({ payment_method: 'CHEQUE', bank_name: null, account_number: null }) },
        })

        const store = usePaymentDataStore()
        await store.savePaymentData(
          5,
          buildForm({ payment_method: 'CHEQUE', cheque_beneficiary: 'Maria Lopez', bank_name: 'BBVA', account_number: '123' }),
        )

        expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payment-data', {
          user_id: 5,
          bank_name: null,
          account_number: null,
          curp: 'AAAA000101HDFRRR01',
          rfc: 'AAAA000101AAA',
          payment_method: 'CHEQUE',
          cheque_beneficiary: 'Maria Lopez',
        })
      })

      it('PUTs CHEQUE data with null bank fields too', async () => {
        mockAxiosGet.mockResolvedValueOnce({ data: { res: true, data: buildPaymentData() } })
        mockAxiosPut.mockResolvedValueOnce({ data: { res: true, data: buildPaymentData({ payment_method: 'CHEQUE' }) } })

        const store = usePaymentDataStore()
        await store.fetchPaymentData(5)
        await store.savePaymentData(5, buildForm({ payment_method: 'CHEQUE', cheque_beneficiary: null }))

        expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/scholarship-payment-data/5', {
          bank_name: null,
          account_number: null,
          curp: 'AAAA000101HDFRRR01',
          rfc: 'AAAA000101AAA',
          payment_method: 'CHEQUE',
          cheque_beneficiary: null,
        })
      })
    })
  })
})
