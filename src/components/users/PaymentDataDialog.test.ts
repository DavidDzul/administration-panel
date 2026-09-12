// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { PaymentData } from '@/interfaces/paymentData'

if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const vuetify = createVuetify()

import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useAlertStore } from '@/stores/alert'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'

const buildPaymentData = (overrides: Partial<PaymentData> = {}): PaymentData => ({
  id: 1,
  user_id: 5,
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  curp: 'AAAA000101HDFRRR01',
  rfc: 'AAAA000101AAA',
  ...overrides,
})

const mountDialog = (props: { modelValue: boolean; userId: number | null }) =>
  mount(PaymentDataDialog, {
    props,
    global: { plugins: [vuetify] },
  })

// v-dialog content teleports to `document.body`, outside the mounted
// wrapper's own DOM subtree — same gotcha documented in psicol-panel's
// ScholarshipProfileCard.test.ts for its replace-confirmation dialog.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('PaymentDataDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('pre-fills the form when opened for a user with existing payment data', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())

    const wrapper = mountDialog({ modelValue: true, userId: 5 })
    await flushPromises()

    expect(paymentDataStore.fetchPaymentData).toHaveBeenCalledWith(5)
    expect(fieldByLabelPrefix(wrapper, 'Banco')?.props('modelValue')).toBe('BBVA')
    expect(fieldByLabelPrefix(wrapper, 'Número de cuenta')?.props('modelValue')).toBe('012180001234567895')
    expect(fieldByLabelPrefix(wrapper, 'CURP')?.props('modelValue')).toBe('AAAA000101HDFRRR01')
    expect(fieldByLabelPrefix(wrapper, 'RFC')?.props('modelValue')).toBe('AAAA000101AAA')
  })

  it('leaves the form blank when opened for a user with no existing payment data', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    expect(fieldByLabelPrefix(wrapper, 'Banco')?.props('modelValue')).toBe('')
    expect(fieldByLabelPrefix(wrapper, 'CURP')?.props('modelValue')).toBe('')
  })

  it('does not submit and does not call savePaymentData when required fields are missing', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    const saveSpy = vi.spyOn(paymentDataStore, 'savePaymentData')

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(saveSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('rejects a CURP that is not exactly 18 uppercase alphanumeric characters', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    const saveSpy = vi.spyOn(paymentDataStore, 'savePaymentData')

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
    await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
    await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('TOOSHORT')

    await submitForm()
    await flushPromises()

    expect(saveSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('18 caracteres')
  })

  it('rejects an RFC that is present but not 12-13 uppercase alphanumeric characters', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    const saveSpy = vi.spyOn(paymentDataStore, 'savePaymentData')

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
    await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
    await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
    await fieldByLabelPrefix(wrapper, 'RFC')?.setValue('SHORT')

    await submitForm()
    await flushPromises()

    expect(saveSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('12 o 13 caracteres')
  })

  it('accepts a blank RFC (optional field) and submits successfully', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData({ rfc: null }))

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
    await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
    await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

    await submitForm()
    await flushPromises()

    expect(paymentDataStore.savePaymentData).toHaveBeenCalledWith(9, {
      bank_name: 'BBVA',
      account_number: '012180001234567895',
      curp: 'AAAA000101HDFRRR01',
      rfc: null,
    })
  })

  it('submits valid data, calls savePaymentData with the correct payload, and emits saved', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())

    const wrapper = mountDialog({ modelValue: true, userId: 5 })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
    await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
    await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
    await fieldByLabelPrefix(wrapper, 'RFC')?.setValue('AAAA000101AAA')

    await submitForm()
    await flushPromises()

    expect(paymentDataStore.savePaymentData).toHaveBeenCalledWith(5, {
      bank_name: 'BBVA',
      account_number: '012180001234567895',
      curp: 'AAAA000101HDFRRR01',
      rfc: 'AAAA000101AAA',
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows an error alert and does not emit saved when savePaymentData fails', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    vi.spyOn(paymentDataStore, 'savePaymentData').mockRejectedValue(new Error('network error'))

    const wrapper = mountDialog({ modelValue: true, userId: 5 })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
    await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
    await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.show).toBe(true)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
