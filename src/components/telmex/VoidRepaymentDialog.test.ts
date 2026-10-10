// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextarea } from 'vuetify/components'
import VoidRepaymentDialog from '@/components/telmex/VoidRepaymentDialog.vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { createPinia, setActivePinia } from 'pinia'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoveragePayment } from '@/interfaces/telmexCoverage'

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

const body = () => new DOMWrapper(document.body)

const buildPayment = (overrides: Partial<TelmexCoveragePayment> = {}): TelmexCoveragePayment => ({
  id: 9,
  coverage_id: 5,
  amount: '300.00',
  paid_at: '2026-02-01',
  reference: 'DEP-002',
  notes: null,
  is_voided: false,
  voided_at: null,
  void_reason: null,
  created_at: '2026-02-01T00:00:00Z',
  ...overrides,
})

const mountDialog = (props: { modelValue?: boolean; coverageId?: number | null; payment?: TelmexCoveragePayment | null } = {}) =>
  mount(VoidRepaymentDialog, {
    props: { modelValue: true, coverageId: 5, payment: buildPayment(), ...props },
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

// Mirrors CancelCoverageDialog.vue's own-store-call + mandatory-reason
// convention exactly (PR3a's VoidTelmexCoveragePaymentAction: reason
// required else 422).
describe('VoidRepaymentDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit when the reason is empty', async () => {
    const store = useTelmexCoverageStore()
    const voidSpy = vi.spyOn(store, 'voidPayment')

    mountDialog()
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(voidSpy).not.toHaveBeenCalled()
  })

  it('shows the payment amount being voided', async () => {
    mountDialog({ payment: buildPayment({ amount: '300.00' }) })
    await flushPromises()

    expect(body().text()).toContain('$300.00')
  })

  it('calls telmexCoverageStore.voidPayment with coverage/payment ids and the reason, then emits "voided"', async () => {
    const store = useTelmexCoverageStore()
    const voided = buildPayment({ is_voided: true, void_reason: 'Depósito duplicado por error' })
    const voidSpy = vi.spyOn(store, 'voidPayment').mockResolvedValue(voided)

    const wrapper = mountDialog({ coverageId: 5, payment: buildPayment({ id: 9 }) })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Depósito duplicado por error')
    await submitForm()
    await flushPromises()

    expect(voidSpy).toHaveBeenCalledWith(5, 9, { void_reason: 'Depósito duplicado por error' })
    expect(wrapper.emitted('voided')?.[0]).toEqual([voided])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows a server-provided error message and does not close the dialog on failure', async () => {
    const store = useTelmexCoverageStore()
    const error = { response: { data: { msg: 'No se puede anular en una cobertura cancelada.' } } }
    vi.spyOn(store, 'voidPayment').mockRejectedValue(error)

    const wrapper = mountDialog({ coverageId: 5, payment: buildPayment({ id: 9 }) })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Motivo de prueba suficientemente largo.')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('No se puede anular en una cobertura cancelada.')
    expect(wrapper.emitted('voided')).toBeUndefined()
  })
})
