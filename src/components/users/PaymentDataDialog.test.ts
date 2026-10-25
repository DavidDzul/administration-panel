// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VRadioGroup, VSelect, VSwitch, VTextField } from 'vuetify/components'
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
import { useScholarshipSettingsStore } from '@/stores/api/scholarshipSettingsStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'
import type { ScholarshipSetting } from '@/interfaces/scholarshipSetting'

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

const buildSetting = (overrides: Partial<ScholarshipSetting> = {}): ScholarshipSetting => ({
  id: 1,
  telmex_base_amount: '1000.00',
  ...overrides,
})

const mountDialog = (props: {
  modelValue: boolean
  userId: number | null
  person?: { first_name: string; last_name: string; enrollment?: string | null } | null
}) =>
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

const selectByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VSelect).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const methodGroup = (wrapper: ReturnType<typeof mountDialog>) =>
  wrapper.findAllComponents(VRadioGroup).find((g) => g.props('label') === 'Medio de pago')

const switchByLabel = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VSwitch).find((f) => f.props('label') === label)

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

// Every test stubs fetchProfileConfig (and, per
// sdd/scholarship-telmex-iu-split, fetchSetting) to a resolved default unless
// a specific test overrides it, so no test accidentally issues a real,
// unmocked axios call for the config section or the Telmex base-amount hint.
const stubProfileConfigDefaults = () => {
  const scholarshipProfileStore = useScholarshipProfileStore()
  vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(null)
  const scholarshipSettingsStore = useScholarshipSettingsStore()
  vi.spyOn(scholarshipSettingsStore, 'fetchSetting').mockResolvedValue(buildSetting())
  return scholarshipProfileStore
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
    stubProfileConfigDefaults()

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
    stubProfileConfigDefaults()

    const wrapper = mountDialog({ modelValue: true, userId: 9 })
    await flushPromises()

    expect(fieldByLabelPrefix(wrapper, 'Banco')?.props('modelValue')).toBe('')
    expect(fieldByLabelPrefix(wrapper, 'CURP')?.props('modelValue')).toBe('')
  })

  it('does not submit and does not call savePaymentData when required fields are missing', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    stubProfileConfigDefaults()
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
    stubProfileConfigDefaults()
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
    stubProfileConfigDefaults()
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
    stubProfileConfigDefaults()

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
      payment_method: 'TRANSFER',
      cheque_beneficiary: null,
    })
  })

  it('submits valid data, calls savePaymentData with the correct payload, and emits saved', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
    stubProfileConfigDefaults()

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
      payment_method: 'TRANSFER',
      cheque_beneficiary: null,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows an error alert and does not emit saved when savePaymentData fails', async () => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    vi.spyOn(paymentDataStore, 'savePaymentData').mockRejectedValue(new Error('network error'))
    stubProfileConfigDefaults()

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

  // Shared by both "Configuración de beca section" and the Telmex/IU split
  // describe blocks below.
  const openWithConfig = async (config: ScholarshipProfileConfig | null, userId = 5) => {
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
    const scholarshipProfileStore = useScholarshipProfileStore()
    vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(config)
    const scholarshipSettingsStore = useScholarshipSettingsStore()
    vi.spyOn(scholarshipSettingsStore, 'fetchSetting').mockResolvedValue(buildSetting())

    const wrapper = mountDialog({ modelValue: true, userId })
    await flushPromises()
    return { wrapper, scholarshipProfileStore, paymentDataStore, scholarshipSettingsStore }
  }

  // Task 5.2/6.3 (design D6, sdd/scholarship-profile-config-to-admin): new
  // "Configuración de beca" section, independent from the bank-data one.
  describe('Configuración de beca section', () => {

    it('pre-fills the config form when opened for a user with an existing profile', async () => {
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('modelValue')).toBe('IU')
      expect(fieldByLabelPrefix(wrapper, 'Beca')?.props('modelValue')).toBe(1500)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('modelValue')).toBe(200)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('modelValue')).toBe(true)
    })

    it('leaves the config form at defaults when opened for a user with no existing scholarship profile', async () => {
      const { wrapper } = await openWithConfig(null)

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('modelValue')).toBe('IU')
      expect(fieldByLabelPrefix(wrapper, 'Beca')?.props('modelValue')).toBe(0)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('modelValue')).toBe(0)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('modelValue')).toBe(false)
    })

    it('disables the config fields when authStore.editScholarshipProfile is false', async () => {
      const authStore = useAuthStore()
      authStore.permissions = []
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('disabled')).toBe(true)
      expect(fieldByLabelPrefix(wrapper, 'Beca')?.props('disabled')).toBe(true)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('disabled')).toBe(true)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('disabled')).toBe(true)
    })

    it('enables the config fields when authStore.editScholarshipProfile is true', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('disabled')).toBeFalsy()
      expect(fieldByLabelPrefix(wrapper, 'Beca')?.props('disabled')).toBeFalsy()
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('disabled')).toBeFalsy()
    })

    it('allows monthly_amount = 0 with no positive-only client validation, and includes it in the save payload', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(buildProfileConfig())
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'saveProfileConfig').mockResolvedValue(buildProfileConfig({ monthly_amount: '0.00' }))

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Beca')?.setValue(0)
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue(200)

      await submitForm()
      await flushPromises()

      expect(body().text()).not.toContain('mayor a 0')
      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ monthly_amount: 0, monto_apoyo: 200 }),
      )
    })

    it('requires monto_apoyo — blocks submit and does not call saveProfileConfig when it is blank', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(buildProfileConfig())
      const saveConfigSpy = vi.spyOn(scholarshipProfileStore, 'saveProfileConfig')
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue('')

      await submitForm()
      await flushPromises()

      expect(saveConfigSpy).not.toHaveBeenCalled()
    })

    it('submits valid config data, calls saveProfileConfig with the correct payload', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(buildProfileConfig())
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'saveProfileConfig').mockResolvedValue(buildProfileConfig())

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Beca')?.setValue(1500)
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue(200)

      await submitForm()
      await flushPromises()

      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalledWith(5, {
        scholarship_type: 'IU',
        monthly_amount: 1500,
        monto_apoyo: 200,
        advance_payment_eligible: true,
        iu_payment_amount: 0,
      })
      expect(wrapper.emitted('saved')).toHaveLength(1)
    })

    it('saves the config for a becario with no scholarship profile (fetch -> null) and emits saved', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(null)
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'saveProfileConfig').mockResolvedValue(buildProfileConfig())

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Beca')?.setValue(1200)
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue(0)

      await submitForm()
      await flushPromises()

      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalledWith(5, {
        scholarship_type: 'IU',
        monthly_amount: 1200,
        monto_apoyo: 0,
        advance_payment_eligible: false,
        iu_payment_amount: 0,
      })
      expect(wrapper.emitted('saved')).toHaveLength(1)
    })

    it('skips saveProfileConfig entirely when editScholarshipProfile is false (no needless 403)', async () => {
      const authStore = useAuthStore()
      authStore.permissions = []
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(buildProfileConfig())
      const saveConfigSpy = vi.spyOn(scholarshipProfileStore, 'saveProfileConfig')
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(saveConfigSpy).not.toHaveBeenCalled()
      expect(paymentDataStore.savePaymentData).toHaveBeenCalled()
      expect(wrapper.emitted('saved')).toHaveLength(1)
    })

    it('reports the config save error independently without masking a successful bank-data save', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(buildProfileConfig())
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'saveProfileConfig').mockRejectedValue(new Error('monto_apoyo inválido'))

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Beca')?.setValue(1500)
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue(200)

      await submitForm()
      await flushPromises()

      // Both saves were attempted independently — the config failure did not
      // prevent or roll back the bank-data save.
      expect(paymentDataStore.savePaymentData).toHaveBeenCalled()
      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalled()
      const alertStore = useAlertStore()
      expect(alertStore.config.status).toBe('error')
      // Not fully successful — stays open so the admin can retry the failed section.
      expect(wrapper.emitted('saved')).toBeUndefined()
    })
  })

  // sdd/scholarship-telmex-iu-split, design D2/D9: TELMEX_IU scholarship
  // type, conditional "Pago IU" field, and the reference-only "Monto base
  // Telmex" hint.
  describe('Telmex/IU split (scholarship_type=TELMEX_IU)', () => {
    it('includes "Telmex - IU" as a scholarship_type option', async () => {
      stubProfileConfigDefaults()
      const wrapper = mountDialog({ modelValue: true, userId: 5 })
      await flushPromises()

      const select = selectByLabelPrefix(wrapper, 'Tipo de beca')
      const items = select?.props('items') as Array<{ value: string; text: string }> | undefined
      expect(items).toContainEqual({ value: 'TELMEX_IU', text: 'Telmex - IU' })
    })

    it('does not show the "Pago IU" field when scholarship_type is IU', async () => {
      const { wrapper } = await openWithConfig(buildProfileConfig({ scholarship_type: 'IU' }))

      expect(fieldByLabelPrefix(wrapper, 'Pago IU')).toBeUndefined()
    })

    it('does not show the "Pago IU" field when scholarship_type is TELMEX', async () => {
      const { wrapper } = await openWithConfig(buildProfileConfig({ scholarship_type: 'TELMEX' }))

      expect(fieldByLabelPrefix(wrapper, 'Pago IU')).toBeUndefined()
    })

    it('shows and pre-fills the "Pago IU" field when scholarship_type is TELMEX_IU', async () => {
      const { wrapper } = await openWithConfig(
        buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }),
      )

      const field = fieldByLabelPrefix(wrapper, 'Pago IU')
      expect(field).toBeDefined()
      expect(field?.props('modelValue')).toBe(300)
    })

    it('requires "Pago IU" — blocks submit when TELMEX_IU and the field is blank', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(
        buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }),
      )
      const saveConfigSpy = vi.spyOn(scholarshipProfileStore, 'saveProfileConfig')
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')
      await fieldByLabelPrefix(wrapper, 'Pago IU')?.setValue('')

      await submitForm()
      await flushPromises()

      expect(saveConfigSpy).not.toHaveBeenCalled()
    })

    it('includes iu_payment_amount in the save payload when scholarship_type is TELMEX_IU', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper, scholarshipProfileStore, paymentDataStore } = await openWithConfig(
        buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }),
      )
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      vi.spyOn(scholarshipProfileStore, 'saveProfileConfig').mockResolvedValue(
        buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }),
      )

      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ scholarship_type: 'TELMEX_IU', iu_payment_amount: 300 }),
      )
    })

    it('shows no reference hint when scholarship_type is IU', async () => {
      await openWithConfig(buildProfileConfig({ scholarship_type: 'IU' }))

      expect(body().text()).not.toContain('Monto base Telmex')
    })

    it('shows the "Monto base Telmex" reference hint when scholarship_type is TELMEX', async () => {
      await openWithConfig(buildProfileConfig({ scholarship_type: 'TELMEX' }), 5)

      expect(body().text()).toContain('Monto base Telmex')
      expect(body().text()).toContain('1000.00')
    })

    it('shows the "Monto base Telmex" reference hint when scholarship_type is TELMEX_IU', async () => {
      await openWithConfig(buildProfileConfig({ scholarship_type: 'TELMEX_IU', iu_payment_amount: '300.00' }))

      expect(body().text()).toContain('Monto base Telmex')
      expect(body().text()).toContain('1000.00')
    })
  })

  // sdd/temporary-increase-visibility, spec "Read-only vigencia block in
  // PaymentDataDialog/Card": renders whenever Number(amount) > 0, regardless
  // of current vigencia, always labeled explicitly.
  describe('Temporary increase display (sdd/temporary-increase-visibility)', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows amount, range, reason, and "Vigente" when the increase is currently active', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0)) // local 2026-10-15

      await openWithConfig(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
          temporary_increase_reason: 'Ajuste especial',
        }),
      )

      expect(body().text()).toContain('Aumento temporal')
      expect(body().text()).toContain('500.00')
      expect(body().text()).toContain('Vigente')
      expect(body().text()).toContain('Ajuste especial')
    })

    it('still shows the block labeled "Expirado" when valid_until is in the past', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0)) // local 2027-01-15

      await openWithConfig(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
          temporary_increase_reason: 'Ajuste especial',
        }),
      )

      expect(body().text()).toContain('Aumento temporal')
      expect(body().text()).toContain('500.00')
      expect(body().text()).toContain('Expirado')
    })

    it('shows "Programado" when valid_from is in the future', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 7, 1, 12, 0, 0)) // local 2026-08-01

      await openWithConfig(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
        }),
      )

      expect(body().text()).toContain('Programado')
    })

    it('does not render the block when temporary_increase_amount is null', async () => {
      await openWithConfig(buildProfileConfig({ temporary_increase_amount: null }))

      expect(body().text()).not.toContain('Aumento temporal')
    })

    it('does not render the block when temporary_increase_amount is "0.00"', async () => {
      await openWithConfig(buildProfileConfig({ temporary_increase_amount: '0.00' }))

      expect(body().text()).not.toContain('Aumento temporal')
    })

    it('does not render the block when the profile has no existing config at all', async () => {
      await openWithConfig(null)

      expect(body().text()).not.toContain('Aumento temporal')
    })

    // Design-flagged gotcha: profileConfig must reset to null on a FAILED
    // reload (catch branch), not just when there is no existing config
    // (else branch) — otherwise a stale block could survive a failed fetch.
    it('clears the temporary-increase block after a failed reload (catch branch reset)', async () => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      const scholarshipProfileStore = useScholarshipProfileStore()
      const scholarshipSettingsStore = useScholarshipSettingsStore()
      vi.spyOn(scholarshipSettingsStore, 'fetchSetting').mockResolvedValue(buildSetting())
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValueOnce(
        buildProfileConfig({
          temporary_increase_amount: '500.00',
          temporary_increase_valid_from: '2026-01-01T00:00:00.000000Z',
          temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
        }),
      )

      const wrapper = mountDialog({ modelValue: true, userId: 5 })
      await flushPromises()
      expect(body().text()).toContain('Aumento temporal')

      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockRejectedValueOnce(new Error('network error'))
      await wrapper.setProps({ modelValue: false })
      await wrapper.setProps({ modelValue: true })
      await flushPromises()

      expect(body().text()).not.toContain('Aumento temporal')
    })
  })

  describe('person header', () => {
    it('renders the full name and matricula when person is passed', async () => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      stubProfileConfigDefaults()

      mountDialog({
        modelValue: true,
        userId: 5,
        person: { first_name: 'Ada', last_name: 'Lovelace', enrollment: 'A0001' },
      })
      await flushPromises()

      expect(body().text()).toContain('Ada Lovelace')
      expect(body().text()).toContain('Matrícula: A0001')
    })

    it('renders neither name nor matricula when person is not passed', async () => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      stubProfileConfigDefaults()

      mountDialog({ modelValue: true, userId: 5 })
      await flushPromises()

      expect(body().text()).not.toContain('Matrícula')
      expect(body().find('[data-testid="payment-dialog-person"]').exists()).toBe(false)
    })

    it('omits the matricula line when enrollment is empty', async () => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      stubProfileConfigDefaults()

      mountDialog({
        modelValue: true,
        userId: 5,
        person: { first_name: 'Ada', last_name: 'Lovelace', enrollment: null },
      })
      await flushPromises()

      expect(body().text()).toContain('Ada Lovelace')
      expect(body().text()).not.toContain('Matrícula')
    })
  })

  describe('Medio de pago (sdd/pago-cheque)', () => {
    const openDialog = async (existing: PaymentData | null = null, userId = 5) => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(existing)
      vi.spyOn(paymentDataStore, 'savePaymentData').mockResolvedValue(buildPaymentData())
      stubProfileConfigDefaults()
      const wrapper = mountDialog({ modelValue: true, userId })
      await flushPromises()
      return { wrapper, paymentDataStore }
    }

    it('defaults to Transferencia and shows the bank inputs', async () => {
      const { wrapper } = await openDialog()

      expect(methodGroup(wrapper)?.props('modelValue')).toBe('TRANSFER')
      expect(body().text()).toContain('Transferencia')
      expect(body().text()).toContain('Cheque')
      expect(fieldByLabelPrefix(wrapper, 'Banco')).toBeDefined()
      expect(fieldByLabelPrefix(wrapper, 'Número de cuenta')).toBeDefined()
      expect(fieldByLabelPrefix(wrapper, 'A nombre de')).toBeUndefined()
    })

    it('hides the bank inputs and shows the optional "A nombre de" field with its hint for Cheque', async () => {
      const { wrapper } = await openDialog()

      await methodGroup(wrapper)?.setValue('CHEQUE')
      await flushPromises()

      expect(fieldByLabelPrefix(wrapper, 'Banco')).toBeUndefined()
      expect(fieldByLabelPrefix(wrapper, 'Número de cuenta')).toBeUndefined()
      const beneficiary = fieldByLabelPrefix(wrapper, 'A nombre de')
      expect(beneficiary).toBeDefined()
      expect(body().find('input[maxlength="150"]').exists()).toBe(true)
      expect(beneficiary?.props('hint')).toBe(
        'Padre, madre o tutor. Si se deja vacío, el cheque se emite a nombre del becario.',
      )
      expect(fieldByLabelPrefix(wrapper, 'CURP')).toBeDefined()
      expect(fieldByLabelPrefix(wrapper, 'RFC')).toBeDefined()
    })

    it('submits Cheque without bank values and without applying the bank rules', async () => {
      const { wrapper, paymentDataStore } = await openDialog()
      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')

      await methodGroup(wrapper)?.setValue('CHEQUE')
      await flushPromises()
      await fieldByLabelPrefix(wrapper, 'A nombre de')?.setValue('Maria Lopez')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(paymentDataStore.savePaymentData).toHaveBeenCalledWith(5, {
        bank_name: null,
        account_number: null,
        curp: 'AAAA000101HDFRRR01',
        rfc: null,
        payment_method: 'CHEQUE',
        cheque_beneficiary: 'Maria Lopez',
      })
      expect(wrapper.emitted('saved')).toHaveLength(1)
    })

    it('submits Cheque with a blank beneficiary as null', async () => {
      const { wrapper, paymentDataStore } = await openDialog()
      await methodGroup(wrapper)?.setValue('CHEQUE')
      await flushPromises()
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(paymentDataStore.savePaymentData).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ payment_method: 'CHEQUE', cheque_beneficiary: null, bank_name: null }),
      )
    })

    it('still requires CURP for Cheque', async () => {
      const { wrapper, paymentDataStore } = await openDialog()
      await methodGroup(wrapper)?.setValue('CHEQUE')
      await flushPromises()

      await submitForm()
      await flushPromises()

      expect(paymentDataStore.savePaymentData).not.toHaveBeenCalled()
    })

    it('still requires the bank fields for Transferencia', async () => {
      const { wrapper, paymentDataStore } = await openDialog()
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(paymentDataStore.savePaymentData).not.toHaveBeenCalled()
    })

    it('does not send a beneficiary typed before switching back to Transferencia', async () => {
      const { wrapper, paymentDataStore } = await openDialog()
      await methodGroup(wrapper)?.setValue('CHEQUE')
      await flushPromises()
      await fieldByLabelPrefix(wrapper, 'A nombre de')?.setValue('Maria Lopez')
      await methodGroup(wrapper)?.setValue('TRANSFER')
      await flushPromises()
      await fieldByLabelPrefix(wrapper, 'Banco')?.setValue('BBVA')
      await fieldByLabelPrefix(wrapper, 'Número de cuenta')?.setValue('012180001234567895')
      await fieldByLabelPrefix(wrapper, 'CURP')?.setValue('AAAA000101HDFRRR01')

      await submitForm()
      await flushPromises()

      expect(paymentDataStore.savePaymentData).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ payment_method: 'TRANSFER', cheque_beneficiary: null, bank_name: 'BBVA' }),
      )
    })

    it('pre-fills the method and beneficiary when editing a Cheque record', async () => {
      const { wrapper } = await openDialog(
        buildPaymentData({
          payment_method: 'CHEQUE',
          bank_name: null,
          account_number: null,
          cheque_beneficiary: 'Maria Lopez',
        }),
      )

      expect(methodGroup(wrapper)?.props('modelValue')).toBe('CHEQUE')
      expect(fieldByLabelPrefix(wrapper, 'A nombre de')?.props('modelValue')).toBe('Maria Lopez')
      expect(fieldByLabelPrefix(wrapper, 'Banco')).toBeUndefined()
    })

    it('pre-fills Transferencia when editing a Transfer record', async () => {
      const { wrapper } = await openDialog(buildPaymentData())

      expect(methodGroup(wrapper)?.props('modelValue')).toBe('TRANSFER')
      expect(fieldByLabelPrefix(wrapper, 'Banco')?.props('modelValue')).toBe('BBVA')
    })
  })
})
