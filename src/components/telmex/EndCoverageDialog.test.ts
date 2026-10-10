// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
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
import EndCoverageDialog from '@/components/telmex/EndCoverageDialog.vue'

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
  advanced: 0,
  repaid: 0,
  balance: 0,
  has_paid_covered_month: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const body = () => new DOMWrapper(document.body)

const mountDialog = (props: { modelValue: boolean; coverage: TelmexCoverage | null }) =>
  mount(EndCoverageDialog, {
    props,
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('EndCoverageDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit when no month is selected', async () => {
    const store = useTelmexCoverageStore()
    const endSpy = vi.spyOn(store, 'endCoverage')

    mountDialog({ modelValue: true, coverage: buildCoverage() })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(endSpy).not.toHaveBeenCalled()
  })

  it('shows the becario name so staff confirms the right coverage', async () => {
    mountDialog({ modelValue: true, coverage: buildCoverage({ becario_name: 'Ada Lovelace' }) })
    await flushPromises()

    expect(body().text()).toContain('Ada Lovelace')
  })

  it('calls endCoverage with the normalized telmex_start_period, emits ended', async () => {
    const store = useTelmexCoverageStore()
    const updated = buildCoverage({ status: 'EN_COBRO', end_period: '2026-02-28' })
    vi.spyOn(store, 'endCoverage').mockResolvedValue(updated)

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage({ id: 7 }) })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2026-03')
    await submitForm()
    await flushPromises()

    expect(store.endCoverage).toHaveBeenCalledWith(7, { telmex_start_period: '2026-03-01' })
    expect(wrapper.emitted('ended')?.[0]).toEqual([updated])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows a server-provided error message and does not close the dialog on failure', async () => {
    const store = useTelmexCoverageStore()
    const error = { response: { status: 422, data: { res: false, msg: 'El periodo es inválido.' } } }
    vi.spyOn(store, 'endCoverage').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true, coverage: buildCoverage({ id: 7 }) })
    await flushPromises()

    await wrapper.findComponent(VTextField).setValue('2025-01')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('El periodo es inválido.')
    expect(wrapper.emitted('ended')).toBeUndefined()
  })
})
