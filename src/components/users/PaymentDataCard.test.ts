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
import type { ScholarshipProfileConfig } from '@/interfaces/scholarshipProfile'

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
import { useScholarshipProfileStore } from '@/stores/api/scholarshipProfileStore'
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

const buildProfileConfig = (overrides: Partial<ScholarshipProfileConfig> = {}): ScholarshipProfileConfig => ({
  scholarship_type: 'IU',
  monthly_amount: '1500.00',
  monto_apoyo: '200.00',
  advance_payment_eligible: true,
  iu_payment_amount: null,
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

// Default: every test stubs both independent fetches unless a specific test
// overrides one, so no test accidentally issues a real, unmocked axios call.
const stubDefaults = () => {
  const paymentDataStore = usePaymentDataStore()
  const scholarshipProfileStore = useScholarshipProfileStore()
  vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
  vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(null)
  return { paymentDataStore, scholarshipProfileStore }
}

describe('PaymentDataCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches payment data for the given user id on mount', () => {
    const { paymentDataStore } = stubDefaults()
    const fetchSpy = vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    mountCard(5)

    expect(fetchSpy).toHaveBeenCalledWith(5)
  })

  it('shows the "not configured" empty state when fetchPaymentData resolves null', async () => {
    stubDefaults()

    const wrapper = mountCard(5)
    await flushPromises()

    expect(wrapper.text()).toContain('Sin datos de pago configurados')
    expect(wrapper.text()).not.toContain('BBVA')
  })

  it('displays the existing payment data when fetchPaymentData resolves a row', async () => {
    const { paymentDataStore } = stubDefaults()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())

    const wrapper = mountCard(5)
    await flushPromises()

    expect(wrapper.text()).toContain('BBVA')
    expect(wrapper.text()).toContain('012180001234567895')
    expect(wrapper.text()).toContain('AAAA000101HDFRRR01')
    expect(wrapper.text()).toContain('AAAA000101AAA')
    expect(wrapper.text()).not.toContain('Sin datos de pago configurados')
  })

  it('disables the "Editar" button when both editPaymentData and editScholarshipProfile are false', async () => {
    const { paymentDataStore } = stubDefaults()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())
    const authStore = useAuthStore()
    authStore.permissions = []

    const wrapper = mountCard(5)
    await flushPromises()

    const editButton = wrapper.findAllComponents(VBtn).find((b) => b.text().includes('Editar'))
    expect(editButton?.props('disabled')).toBe(true)
  })

  it('enables the "Editar" button and opens the shared PaymentDataDialog when authStore.editPaymentData is true', async () => {
    const { paymentDataStore } = stubDefaults()
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

  // Design D9: a partially-permissioned admin (only the scholarship-profile
  // config permission, not bank-data) must still be able to reach the
  // dialog — the shared button is gated by EITHER permission.
  it('enables the "Editar" button when only authStore.editScholarshipProfile is true', async () => {
    stubDefaults()
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']

    const wrapper = mountCard(5)
    await flushPromises()

    const editButton = wrapper.findAllComponents(VBtn).find((b) => b.text().includes('Editar'))
    expect(editButton?.props('disabled')).toBeFalsy()
  })

  it('re-fetches payment data after the dialog emits saved', async () => {
    const { paymentDataStore } = stubDefaults()
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

  // Task 6.2 — direct regression for the flagged gotcha (design D6):
  // PaymentDataCard used to gate ALL content on `paymentData` truthy, which
  // hid the config section entirely for a becario with no bank data yet.
  describe('Configuración de beca (independent section, design D6)', () => {
    it('fetches the scholarship-profile config for the given user id on mount', () => {
      const { scholarshipProfileStore } = stubDefaults()
      const fetchSpy = vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(null)

      mountCard(7)

      expect(fetchSpy).toHaveBeenCalledWith(7)
    })

    it('renders the config section with real values EVEN WHEN paymentData is null (no bank data yet)', async () => {
      const { paymentDataStore, scholarshipProfileStore } = stubDefaults()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(buildProfileConfig())

      const wrapper = mountCard(5)
      await flushPromises()

      // Bank section still shows its own independent empty state...
      expect(wrapper.text()).toContain('Sin datos de pago configurados')
      // ...while the config section renders fully regardless.
      expect(wrapper.text()).toContain('Configuración de beca')
      expect(wrapper.text()).toContain('IU')
      expect(wrapper.text()).toContain('1500.00')
      expect(wrapper.text()).toContain('200.00')
      expect(wrapper.text()).toContain('¿Estudia en el CERT de Mérida o UNID Tizimín?')
    })

    it('renders the config section even when paymentData exists (both sections independent)', async () => {
      const { paymentDataStore, scholarshipProfileStore } = stubDefaults()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(buildProfileConfig())

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('BBVA')
      expect(wrapper.text()).toContain('Configuración de beca')
      expect(wrapper.text()).toContain('IU')
    })

    it('shows a "Sin configurar" state when the scholarship profile itself 404s', async () => {
      stubDefaults()

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Sin configurar')
    })

    it('re-fetches the scholarship-profile config after the dialog emits saved', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      const fetchSpy = vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(null)
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']

      const wrapper = mountCard(5)
      await flushPromises()
      fetchSpy.mockClear()

      const dialog = wrapper.findComponent({ name: 'PaymentDataDialog' })
      dialog.vm.$emit('saved')
      await flushPromises()

      expect(fetchSpy).toHaveBeenCalledWith(5)
    })
  })

  // sdd/scholarship-telmex-iu-split, design's Interfaces section: the type
  // label map (`{ IU: 'IU', TELMEX: 'TELMEX', TELMEX_IU: 'Telmex - IU' }`)
  // and the read-only "Pago IU" row.
  describe('Telmex/IU split (scholarship_type=TELMEX_IU)', () => {
    it.each([
      ['IU', 'IU'],
      ['TELMEX', 'TELMEX'],
      ['TELMEX_IU', 'Telmex - IU'],
    ])('displays "%s" as "%s" for the Tipo de beca value', async (rawType, displayLabel) => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ scholarship_type: rawType as ScholarshipProfileConfig['scholarship_type'] }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain(displayLabel)
      expect(wrapper.text()).not.toContain('TELMEX_IU')
    })

    it('does not render a "Pago IU" row when scholarship_type is IU', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ scholarship_type: 'IU' }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Pago IU')
    })

    it('renders the "Pago IU" row with its value when scholarship_type is TELMEX_IU', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Pago IU')
      expect(wrapper.text()).toContain('300.00')
    })
  })
})
