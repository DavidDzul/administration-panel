// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import RegisterRepaymentDialog from '@/components/telmex/RegisterRepaymentDialog.vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { createPinia, setActivePinia } from 'pinia'
import { useAlertStore } from '@/stores/alert'

// v-dialog teleports its content to document.body — same jsdom gotcha
// documented in CancelCoverageDialog.test.ts. `findComponent` still works
// because it walks the component tree, not the rendered DOM location;
// form submission and text assertions go through `body()`.
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

const mountDialog = (props: { modelValue?: boolean; coverageId?: number | null; balance?: string } = {}) =>
  mount(RegisterRepaymentDialog, {
    props: { modelValue: true, coverageId: 5, balance: '600.00', ...props },
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

const amountField = (wrapper: ReturnType<typeof mountDialog>) =>
  wrapper.findAllComponents(VTextField).filter((f) => f.props('label') === 'Monto *')[0]

const paidAtField = (wrapper: ReturnType<typeof mountDialog>) =>
  wrapper.findAllComponents(VTextField).filter((f) => f.props('label') === 'Fecha')[0]

// Mirrors CancelCoverageDialog.vue's own-store-call convention (PR4): the
// dialog calls telmexCoverageStore.registerPayment directly, no composable
// indirection, and does not catch — the dialog's own handler decides how
// to surface a 403/422 (same uncaught-write convention as every other
// write method in this store).
describe('RegisterRepaymentDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('rejects amount <= 0', async () => {
    const store = useTelmexCoverageStore()
    const registerSpy = vi.spyOn(store, 'registerPayment')

    const wrapper = mountDialog({ balance: '600.00' })
    await flushPromises()

    await amountField(wrapper).setValue(0)
    await paidAtField(wrapper).setValue('2026-02-01')
    await submitForm()
    await flushPromises()

    expect(registerSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('mayor a 0')
  })

  it('rejects amount greater than balance', async () => {
    const store = useTelmexCoverageStore()
    const registerSpy = vi.spyOn(store, 'registerPayment')

    const wrapper = mountDialog({ balance: '500.00' })
    await flushPromises()

    await amountField(wrapper).setValue(600)
    await paidAtField(wrapper).setValue('2026-02-01')
    await submitForm()
    await flushPromises()

    expect(registerSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('no puede exceder el saldo')
  })

  // Money fields come from the API as 2-decimal strings (e.g. "1000.00") —
  // the max rule must compare Number(v) <= Number(props.balance), not a
  // direct string/number comparison.
  it('enforces the max rule against a string balance (Number(v) <= Number(balance))', async () => {
    const store = useTelmexCoverageStore()
    const registerSpy = vi.spyOn(store, 'registerPayment').mockResolvedValue({
      id: 3,
      coverage_id: 5,
      amount: '1000.00',
      paid_at: '2026-02-01',
      reference: null,
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-02-01T00:00:00Z',
    })

    const wrapper = mountDialog({ balance: '1000.00' })
    await flushPromises()

    await amountField(wrapper).setValue(1000.01)
    await paidAtField(wrapper).setValue('2026-02-01')
    await submitForm()
    await flushPromises()

    expect(registerSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('no puede exceder el saldo')

    await amountField(wrapper).setValue(1000)
    await submitForm()
    await flushPromises()

    expect(registerSpy).toHaveBeenCalled()
  })

  // PR3b's final, implemented contract: `paid_at` is OPTIONAL — the server
  // defaults it when omitted. Confirmed via the coordinator's backend
  // report after PR3b landed.
  it('submits successfully without paid_at (server defaults it)', async () => {
    const store = useTelmexCoverageStore()
    const payment = {
      id: 2,
      coverage_id: 5,
      amount: '250.00',
      paid_at: '2026-02-05',
      reference: null,
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-02-05 10:00:00',
    }
    const registerSpy = vi.spyOn(store, 'registerPayment').mockResolvedValue(payment)

    const wrapper = mountDialog({ coverageId: 5, balance: '600.00' })
    await flushPromises()

    await amountField(wrapper).setValue(250)
    await submitForm()
    await flushPromises()

    expect(registerSpy).toHaveBeenCalledWith(5, expect.objectContaining({ amount: 250, paid_at: undefined }))
    expect(wrapper.emitted('registered')?.[0]).toEqual([payment])
  })

  it('calls telmexCoverageStore.registerPayment with the coverage id and payload, then emits "registered"', async () => {
    const store = useTelmexCoverageStore()
    const payment = {
      id: 1,
      coverage_id: 5,
      amount: '300.00',
      paid_at: '2026-02-01',
      reference: 'DEP-002',
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-02-01T00:00:00Z',
    }
    const registerSpy = vi.spyOn(store, 'registerPayment').mockResolvedValue(payment)

    const wrapper = mountDialog({ coverageId: 5, balance: '600.00' })
    await flushPromises()

    await amountField(wrapper).setValue(300)
    await paidAtField(wrapper).setValue('2026-02-01')
    await submitForm()
    await flushPromises()

    expect(registerSpy).toHaveBeenCalledWith(5, expect.objectContaining({ amount: 300, paid_at: '2026-02-01' }))
    expect(wrapper.emitted('registered')?.[0]).toEqual([payment])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows an alert and does not emit "registered" when the store call rejects', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'registerPayment').mockRejectedValue({
      response: { data: { msg: 'El monto excede el saldo pendiente.' } },
    })

    const wrapper = mountDialog({ coverageId: 5, balance: '600.00' })
    await flushPromises()

    await amountField(wrapper).setValue(300)
    await paidAtField(wrapper).setValue('2026-02-01')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('El monto excede el saldo pendiente.')
    expect(wrapper.emitted('registered')).toBeUndefined()
  })
})
