// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
// NOTE: `mountCard` intentionally does NOT pass a `createPinia()` instance
// into `global.plugins` — doing so would give the mounted component tree a
// DIFFERENT Pinia instance than the one `setActivePinia` made active in
// `beforeEach`, so `vi.spyOn(paymentDataStore, ...)` (called against the
// active-pinia instance) would silently spy on a store the component never
// talks to. Relying on the globally active pinia (same pattern as
// usePersonDetailsPage.test.ts's `withSetup` helper) keeps both sides on the
// same store instance.
import { VBtn } from 'vuetify/components'
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
import { useAuthStore } from '@/stores/api/authStore'
import PaymentDataCard from '@/components/users/PaymentDataCard.vue'

const buildPaymentData = (overrides: Partial<PaymentData> = {}): PaymentData => ({
  id: 1,
  user_id: 5,
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  curp: 'AAAA000101HDFRRR01',
  rfc: 'AAAA000101AAA',
  ...overrides,
})

// PaymentDataDialog (mounted internally, per design D7) opens a v-dialog
// that teleports to document.body — same gotcha as
// PaymentDataDialog.test.ts / psicol-panel's ScholarshipProfileCard.test.ts.
const body = () => new DOMWrapper(document.body)

const mountCard = (userId = 5) =>
  mount(PaymentDataCard, {
    props: { userId },
    global: { plugins: [vuetify] },
  })

describe('PaymentDataCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches payment data for the given user id on mount', () => {
    const paymentDataStore = usePaymentDataStore()
    const fetchSpy = vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    mountCard(5)

    expect(fetchSpy).toHaveBeenCalledWith(5)
  })

  it('shows the "not configured" empty state when fetchPaymentData resolves null', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const wrapper = mountCard(5)
    await flushPromises()

    expect(wrapper.text()).toContain('Sin datos de pago configurados')
    expect(wrapper.text()).not.toContain('BBVA')
  })

  it('displays the existing payment data when fetchPaymentData resolves a row', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())

    const wrapper = mountCard(5)
    await flushPromises()

    expect(wrapper.text()).toContain('BBVA')
    expect(wrapper.text()).toContain('012180001234567895')
    expect(wrapper.text()).toContain('AAAA000101HDFRRR01')
    expect(wrapper.text()).toContain('AAAA000101AAA')
    expect(wrapper.text()).not.toContain('Sin datos de pago configurados')
  })

  it('disables the "Editar" button when authStore.editPaymentData is false', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())
    const authStore = useAuthStore()
    authStore.permissions = []

    const wrapper = mountCard(5)
    await flushPromises()

    const editButton = wrapper.findAllComponents(VBtn).find((b) => b.text().includes('Editar'))
    expect(editButton?.props('disabled')).toBe(true)
  })

  it('enables the "Editar" button and opens the shared PaymentDataDialog when authStore.editPaymentData is true', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_EDIT_PAYMENT_DATA']

    const wrapper = mountCard(5)
    await flushPromises()

    const editButton = wrapper.findAllComponents(VBtn).find((b) => b.text().includes('Editar'))
    expect(editButton?.props('disabled')).toBeFalsy()

    await editButton?.trigger('click')
    await flushPromises()

    expect(body().text()).toContain('Datos de pago')
    expect(body().find('input').exists()).toBe(true)
  })

  it('re-fetches payment data after the dialog emits saved', async () => {
    const paymentDataStore = usePaymentDataStore()
    const fetchSpy = vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_EDIT_PAYMENT_DATA']

    const wrapper = mountCard(5)
    await flushPromises()
    fetchSpy.mockClear()

    const dialog = wrapper.findComponent({ name: 'PaymentDataDialog' })
    dialog.vm.$emit('saved')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(5)
  })
})
