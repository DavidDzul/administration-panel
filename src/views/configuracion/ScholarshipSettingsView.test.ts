// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { ScholarshipSetting } from '@/interfaces/scholarshipSetting'

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

import ScholarshipSettingsView from '@/views/configuracion/ScholarshipSettingsView.vue'
import { useScholarshipSettingsStore } from '@/stores/api/scholarshipSettingsStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'

const buildSetting = (overrides: Partial<ScholarshipSetting> = {}): ScholarshipSetting => ({
  id: 1,
  telmex_base_amount: '1000.00',
  ...overrides,
})

const mountView = () =>
  mount(ScholarshipSettingsView, {
    global: { plugins: [vuetify] },
  })

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitForm = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  await wrapper.find('form').trigger('submit')
}

// sdd/scholarship-telmex-iu-split, design D8: single-field form for the
// org-wide reference-only Telmex base amount. GET is ungated (design D9
// rationale), so this view fetches on mount regardless of permission; PUT
// requires manageScholarshipSettings, mirrored here as field/button
// disabled state, same pattern as PaymentDataDialog's editScholarshipProfile
// gating.
describe('ScholarshipSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches and pre-fills the setting on mount', async () => {
    const store = useScholarshipSettingsStore()
    vi.spyOn(store, 'fetchSetting').mockResolvedValue(buildSetting({ telmex_base_amount: '1500.00' }))

    const wrapper = mountView()
    await flushPromises()

    expect(store.fetchSetting).toHaveBeenCalled()
    expect(fieldByLabelPrefix(wrapper, 'Monto base Telmex')?.props('modelValue')).toBe(1500)
  })

  it('disables the field and submit button when manageScholarshipSettings is false', async () => {
    const store = useScholarshipSettingsStore()
    vi.spyOn(store, 'fetchSetting').mockResolvedValue(buildSetting())
    useAuthStore().permissions = []

    const wrapper = mountView()
    await flushPromises()

    expect(fieldByLabelPrefix(wrapper, 'Monto base Telmex')?.props('disabled')).toBe(true)
  })

  it('enables the field when manageScholarshipSettings is true', async () => {
    const store = useScholarshipSettingsStore()
    vi.spyOn(store, 'fetchSetting').mockResolvedValue(buildSetting())
    useAuthStore().permissions = ['ADM_MANAGE_SCHOLARSHIP_SETTINGS']

    const wrapper = mountView()
    await flushPromises()

    expect(fieldByLabelPrefix(wrapper, 'Monto base Telmex')?.props('disabled')).toBeFalsy()
  })

  it('submits the new value and shows a success alert', async () => {
    const store = useScholarshipSettingsStore()
    vi.spyOn(store, 'fetchSetting').mockResolvedValue(buildSetting({ telmex_base_amount: '1000.00' }))
    vi.spyOn(store, 'saveSetting').mockResolvedValue(buildSetting({ telmex_base_amount: '2000.00' }))
    useAuthStore().permissions = ['ADM_MANAGE_SCHOLARSHIP_SETTINGS']

    const wrapper = mountView()
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Monto base Telmex')?.setValue(2000)
    await submitForm(wrapper)
    await flushPromises()

    expect(store.saveSetting).toHaveBeenCalledWith({ telmex_base_amount: 2000 })
    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('success')
  })

  it('shows an error alert and does not swallow the failure when saveSetting rejects', async () => {
    const store = useScholarshipSettingsStore()
    vi.spyOn(store, 'fetchSetting').mockResolvedValue(buildSetting())
    vi.spyOn(store, 'saveSetting').mockRejectedValue({ response: { status: 403 } })
    useAuthStore().permissions = ['ADM_MANAGE_SCHOLARSHIP_SETTINGS']

    const wrapper = mountView()
    await flushPromises()

    await submitForm(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
  })
})
