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
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'

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

const buildProfileConfig = (overrides: Partial<ScholarshipProfileConfig> = {}): ScholarshipProfileConfig => ({
  scholarship_type: 'IU',
  monthly_amount: '1500.00',
  monto_apoyo: '200.00',
  advance_payment_eligible: true,
  iu_payment_amount: null,
  temporary_increase_amount: null,
  temporary_increase_valid_from: null,
  temporary_increase_valid_until: null,
  temporary_increase_reason: null,
  cycle_closed_period: null,
  cycle_closure_reason: null,
  config_set_at: '2026-10-01T12:00:00Z',
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

  describe('Medio de pago (sdd/pago-cheque)', () => {
    it('shows "Transferencia" and the bank rows for a transfer record', async () => {
      const { paymentDataStore } = stubDefaults()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(buildPaymentData())

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Medio de pago')
      expect(wrapper.text()).toContain('Transferencia')
      expect(wrapper.text()).toContain('Banco')
      expect(wrapper.text()).not.toContain('A nombre de')
    })

    it('shows "Cheque" with the beneficiary and hides the bank rows for a cheque record', async () => {
      const { paymentDataStore } = stubDefaults()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(
        buildPaymentData({
          payment_method: 'CHEQUE',
          bank_name: null,
          account_number: null,
          cheque_beneficiary: 'Maria Lopez',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Medio de pago')
      expect(wrapper.text()).toContain('Cheque')
      expect(wrapper.text()).toContain('A nombre de')
      expect(wrapper.text()).toContain('Maria Lopez')
      expect(wrapper.text()).not.toContain('Banco')
      expect(wrapper.text()).not.toContain('Número de cuenta')
      expect(wrapper.text()).toContain('AAAA000101HDFRRR01')
    })

    it('shows "A nombre del becario" when a cheque record has no beneficiary', async () => {
      const { paymentDataStore } = stubDefaults()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(
        buildPaymentData({ payment_method: 'CHEQUE', bank_name: null, account_number: null }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('A nombre del becario')
    })
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

    it('shows the pending-amounts warning when the profile exists but config_set_at is null', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ config_set_at: null }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Montos pendientes de configurar')
      expect(wrapper.text()).toContain('1500.00')
    })

    it('hides the pending-amounts warning when config_set_at is set', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(buildProfileConfig())

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Montos pendientes')
    })

    it('prompts to configure when there is no scholarship profile at all', async () => {
      stubDefaults()

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Montos pendientes de configurar')
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

  // sdd/temporary-increase-visibility, spec "Read-only vigencia block in
  // PaymentDataDialog/Card": same show condition and labeling as the dialog.
  describe('Temporary increase display (sdd/temporary-increase-visibility)', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows amount, range, reason, and "Vigente" when the increase is currently active', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0)) // local 2026-10-15
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
          temporary_increase_reason: 'Ajuste especial',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Aumento temporal')
      expect(wrapper.text()).toContain('500.00')
      expect(wrapper.text()).toContain('Vigente')
      expect(wrapper.text()).toContain('Ajuste especial')
    })

    it('still shows the block labeled "Expirado" when valid_until is in the past', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0)) // local 2027-01-15
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Aumento temporal')
      expect(wrapper.text()).toContain('Expirado')
    })

    it('shows "Programado" when valid_from is in the future', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 7, 1, 12, 0, 0)) // local 2026-08-01
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Programado')
    })

    it('does not render the block when temporary_increase_amount is null', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ temporary_increase_amount: null }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Aumento temporal')
    })

    it('does not render the block when temporary_increase_amount is "0.00"', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({ temporary_increase_amount: '0.00' }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Aumento temporal')
    })

    it('does not render the block when the profile has no existing config at all', async () => {
      stubDefaults()

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Aumento temporal')
    })
  })

  // sdd/egresado-baja-definitiva (PR4, task 4.2): read-only stop-marker chip,
  // mirrors psicol-panel's ScholarshipProfileCard.vue chip exactly (same
  // label format, same string-slicing of the ISO-8601 timestamp — see
  // amendment #1988/design note: cycle_closed_period must NEVER be parsed
  // via Date/dayjs).
  describe('Cycle closure chip (sdd/egresado-baja-definitiva)', () => {
    it('shows "Ciclo cerrado: 10/2026 · Egresado" when cycle_closed_period/reason are set to EGRESADO', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({
          cycle_closed_period: '2026-10-01T06:00:00Z',
          cycle_closure_reason: 'EGRESADO',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Ciclo cerrado: 10/2026 · Egresado')
    })

    it('shows "Baja definitiva" as the reason label when cycle_closure_reason is BAJA_DEFINITIVA', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(
        buildProfileConfig({
          cycle_closed_period: '2026-01-01T06:00:00Z',
          cycle_closure_reason: 'BAJA_DEFINITIVA',
        }),
      )

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).toContain('Ciclo cerrado: 01/2026 · Baja definitiva')
    })

    it('does not render the chip when cycle_closed_period is null', async () => {
      const { scholarshipProfileStore } = stubDefaults()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(buildProfileConfig())

      const wrapper = mountCard(5)
      await flushPromises()

      expect(wrapper.text()).not.toContain('Ciclo cerrado')
    })
  })

  describe('person forwarding', () => {
    it('forwards the person prop to PaymentDataDialog', async () => {
      stubDefaults()
      const person = { first_name: 'Ada', last_name: 'Lovelace', enrollment: 'A0001' }

      const wrapper = mount(PaymentDataCard, {
        props: { userId: 5, person },
        global: { plugins: [vuetify] },
      })
      await flushPromises()

      expect(wrapper.findComponent(PaymentDataDialog).props('person')).toEqual(person)
    })
  })
})
