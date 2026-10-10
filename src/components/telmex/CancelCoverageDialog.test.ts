// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextarea } from 'vuetify/components'
import type { TelmexCoverage } from '@/interfaces/telmexCoverage'

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

import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import CancelCoverageDialog from '@/components/telmex/CancelCoverageDialog.vue'

const buildCoverage = (overrides: Partial<TelmexCoverage> = {}): TelmexCoverage => ({
  id: 1,
  user_id: 10,
  becario_name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type_at_activation: 'TELMEX',
  status: 'EN_COBRO',
  start_period: '2026-01-01',
  end_period: '2026-03-01',
  notes: null,
  cancel_reason: null,
  advanced: '1000.00',
  repaid: '400.00',
  balance: '600.00',
  has_paid_covered_month: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const body = () => new DOMWrapper(document.body)

const mountDialog = (props: { modelValue: boolean; coverage: TelmexCoverage | null }) =>
  mount(CancelCoverageDialog, {
    props,
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('CancelCoverageDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit when the reason is empty', async () => {
    const store = useTelmexCoverageStore()
    const cancelSpy = vi.spyOn(store, 'cancelCoverage')

    mountDialog({ modelValue: true, coverage: buildCoverage() })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(cancelSpy).not.toHaveBeenCalled()
  })

  it('rejects a reason shorter than 10 characters', async () => {
    const store = useTelmexCoverageStore()
    const cancelSpy = vi.spyOn(store, 'cancelCoverage')

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage() })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Corto')
    await submitForm()
    await flushPromises()

    expect(cancelSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('al menos 10 caracteres')
  })

  it('rejects a reason longer than 500 characters', async () => {
    const store = useTelmexCoverageStore()
    const cancelSpy = vi.spyOn(store, 'cancelCoverage')

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage() })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('A'.repeat(501))
    await submitForm()
    await flushPromises()

    expect(cancelSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('500 caracteres')
  })

  it('shows a warning that the remaining balance will display as cancelled when balance > 0', async () => {
    mountDialog({ modelValue: true, coverage: buildCoverage({ balance: '600.00' }) })
    await flushPromises()

    expect(body().text()).toContain('saldo')
    expect(body().text()).toContain('cancelado')
  })

  it('calls cancelCoverage with the reason and emits cancelled', async () => {
    const store = useTelmexCoverageStore()
    const cancelled = buildCoverage({ status: 'CANCELADA', cancel_reason: 'Becario egresó de IU.' })
    vi.spyOn(store, 'cancelCoverage').mockResolvedValue(cancelled)

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage({ id: 9 }) })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Becario egresó de IU.')
    await submitForm()
    await flushPromises()

    expect(store.cancelCoverage).toHaveBeenCalledWith(9, { reason: 'Becario egresó de IU.' })
    expect(wrapper.emitted('cancelled')?.[0]).toEqual([cancelled])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows a server-provided error message and does not close the dialog on failure', async () => {
    const store = useTelmexCoverageStore()
    const error = { response: { status: 422, data: { res: false, errors: { reason: ['Campo requerido.'] } } } }
    vi.spyOn(store, 'cancelCoverage').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage({ id: 9 }) })
    await flushPromises()

    await wrapper.findComponent(VTextarea).setValue('Becario egresó de IU.')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('Campo requerido.')
    expect(wrapper.emitted('cancelled')).toBeUndefined()
  })
})
