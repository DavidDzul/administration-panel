// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect, VSwitch, VTextField } from 'vuetify/components'
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

const buildProfileConfig = (overrides: Partial<ScholarshipProfileConfig> = {}): ScholarshipProfileConfig => ({
  scholarship_type: 'IU',
  monthly_amount: '1500.00',
  monto_apoyo: '200.00',
  advance_payment_eligible: true,
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

const selectByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VSelect).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const switchByLabel = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VSwitch).find((f) => f.props('label') === label)

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

// Every test stubs fetchProfileConfig to a resolved default unless a
// specific test overrides it, so no test accidentally issues a real,
// unmocked axios call for the new independent config section.
const stubProfileConfigDefaults = () => {
  const scholarshipProfileStore = useScholarshipProfileStore()
  vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(null)
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

  // Task 5.2/6.3 (design D6, sdd/scholarship-profile-config-to-admin): new
  // "Configuración de beca" section, independent from the bank-data one.
  describe('Configuración de beca section', () => {
    const openWithConfig = async (config: ScholarshipProfileConfig | null, userId = 5) => {
      const paymentDataStore = usePaymentDataStore()
      vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)
      const scholarshipProfileStore = useScholarshipProfileStore()
      vi.spyOn(scholarshipProfileStore, 'fetchProfileConfig').mockResolvedValue(config)

      const wrapper = mountDialog({ modelValue: true, userId })
      await flushPromises()
      return { wrapper, scholarshipProfileStore, paymentDataStore }
    }

    it('pre-fills the config form when opened for a user with an existing profile', async () => {
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('modelValue')).toBe('IU')
      expect(fieldByLabelPrefix(wrapper, 'Monto mensual')?.props('modelValue')).toBe(1500)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('modelValue')).toBe(200)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('modelValue')).toBe(true)
    })

    it('leaves the config form at defaults when opened for a user with no existing scholarship profile', async () => {
      const { wrapper } = await openWithConfig(null)

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('modelValue')).toBe('IU')
      expect(fieldByLabelPrefix(wrapper, 'Monto mensual')?.props('modelValue')).toBe(0)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('modelValue')).toBe(0)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('modelValue')).toBe(false)
    })

    it('disables the config fields when authStore.editScholarshipProfile is false', async () => {
      const authStore = useAuthStore()
      authStore.permissions = []
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('disabled')).toBe(true)
      expect(fieldByLabelPrefix(wrapper, 'Monto mensual')?.props('disabled')).toBe(true)
      expect(fieldByLabelPrefix(wrapper, 'Apoyo')?.props('disabled')).toBe(true)
      expect(switchByLabel(wrapper, '¿Estudia en el CERT de Mérida o UNID Tizimín?')?.props('disabled')).toBe(true)
    })

    it('enables the config fields when authStore.editScholarshipProfile is true', async () => {
      const authStore = useAuthStore()
      authStore.permissions = ['ADM_EDIT_SCHOLARSHIP_PROFILE']
      const { wrapper } = await openWithConfig(buildProfileConfig())

      expect(selectByLabelPrefix(wrapper, 'Tipo de beca')?.props('disabled')).toBeFalsy()
      expect(fieldByLabelPrefix(wrapper, 'Monto mensual')?.props('disabled')).toBeFalsy()
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
      await fieldByLabelPrefix(wrapper, 'Monto mensual')?.setValue(0)
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
      await fieldByLabelPrefix(wrapper, 'Monto mensual')?.setValue(1500)
      await fieldByLabelPrefix(wrapper, 'Apoyo')?.setValue(200)

      await submitForm()
      await flushPromises()

      expect(scholarshipProfileStore.saveProfileConfig).toHaveBeenCalledWith(5, {
        scholarship_type: 'IU',
        monthly_amount: 1500,
        monto_apoyo: 200,
        advance_payment_eligible: true,
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
      await fieldByLabelPrefix(wrapper, 'Monto mensual')?.setValue(1500)
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
})
