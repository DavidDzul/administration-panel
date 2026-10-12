// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { TelmexCoverage, BulkEndTelmexCoveragesResult } from '@/interfaces/telmexCoverage'

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
import BulkEndCoverageDialog from '@/components/telmex/BulkEndCoverageDialog.vue'

const buildCoverage = (overrides: Partial<TelmexCoverage> = {}): TelmexCoverage => ({
  id: 1,
  user_id: 10,
  becario_name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type_at_activation: 'TELMEX',
  status: 'ACTIVA',
  start_period: '2026-01-01',
  end_period: null,
  notes: null,
  cancel_reason: null,
  advanced: '0.00',
  repaid: '0.00',
  balance: '0.00',
  has_paid_covered_month: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const body = () => new DOMWrapper(document.body)

const mountDialog = (props: { modelValue: boolean; coverages: TelmexCoverage[] }) =>
  mount(BulkEndCoverageDialog, {
    props,
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('BulkEndCoverageDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit when no month is selected', async () => {
    const store = useTelmexCoverageStore()
    const bulkSpy = vi.spyOn(store, 'endCoveragesBulk')

    mountDialog({ modelValue: true, coverages: [buildCoverage()] })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(bulkSpy).not.toHaveBeenCalled()
  })

  it('shows the selection count and the chosen month in words before confirming', async () => {
    const wrapper = mountDialog({
      modelValue: true,
      coverages: [buildCoverage({ id: 1 }), buildCoverage({ id: 2 }), buildCoverage({ id: 3 })],
    })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2026-12')
    await flushPromises()

    expect(body().text()).toContain('3')
    expect(body().text()).toContain('diciembre 2026')
  })

  it('explains that IU only stops paying the Telmex part, not the whole scholarship', async () => {
    mountDialog({ modelValue: true, coverages: [buildCoverage({ id: 1 })] })
    await flushPromises()

    expect(body().text()).toContain('Elige el PRIMER mes en que Telmex empieza a pagar')
    expect(body().text()).toContain('IU deja de pagar la parte de Telmex')
    expect(body().text()).not.toContain('IU deja de pagar la beca')
  })

  it('calls endCoveragesBulk once even on a rapid double submit', async () => {
    const store = useTelmexCoverageStore()
    const result: BulkEndTelmexCoveragesResult = {
      ended: [{ coverage_id: 1, user_id: 10, becario_name: 'Juan Pérez' }],
      failed: [],
    }
    let resolveBulk!: (value: BulkEndTelmexCoveragesResult) => void
    const bulkSpy = vi.spyOn(store, 'endCoveragesBulk').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBulk = resolve
        }),
    )

    const wrapper = mountDialog({ modelValue: true, coverages: [buildCoverage({ id: 1 })] })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2026-12')

    const form = body().find('form')
    const submit1 = form.trigger('submit')
    const submit2 = form.trigger('submit')
    await Promise.all([submit1, submit2])

    expect(bulkSpy).toHaveBeenCalledTimes(1)

    resolveBulk(result)
    await flushPromises()
  })

  it('shows the results list with ended and failed becarios, and emits completed on close', async () => {
    const store = useTelmexCoverageStore()
    const result: BulkEndTelmexCoveragesResult = {
      ended: [{ coverage_id: 1, user_id: 10, becario_name: 'Ada Lovelace' }],
      failed: [{ coverage_id: 2, user_id: 20, becario_name: 'Marie Curie', reason: 'Ya no está activa' }],
    }
    vi.spyOn(store, 'endCoveragesBulk').mockResolvedValue(result)

    const wrapper = mountDialog({
      modelValue: true,
      coverages: [
        buildCoverage({ id: 1, becario_name: 'Ada Lovelace' }),
        buildCoverage({ id: 2, becario_name: 'Marie Curie' }),
      ],
    })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2026-12')
    await submitForm()
    await flushPromises()

    expect(body().text()).toContain('Marcados (1)')
    expect(body().text()).toContain('Ada Lovelace')
    expect(body().text()).toContain('No marcados (1)')
    expect(body().text()).toContain('Marie Curie')
    expect(body().text()).toContain('Ya no está activa')

    const closeButtons = body()
      .findAll('button')
      .filter((b) => b.text() === 'Cerrar')
    expect(closeButtons.length).toBeGreaterThan(0)
    await closeButtons[0].trigger('click')

    expect(wrapper.emitted('completed')?.[0]).toEqual([result])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows a server error, stays on the confirm step, and does not emit completed', async () => {
    const store = useTelmexCoverageStore()
    const error = { response: { status: 422, data: { res: false, msg: 'Periodo inválido.' } } }
    vi.spyOn(store, 'endCoveragesBulk').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true, coverages: [buildCoverage({ id: 1 })] })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2026-12')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('Periodo inválido.')
    expect(wrapper.emitted('completed')).toBeUndefined()
    expect(body().find('form').exists()).toBe(true)
  })
})
