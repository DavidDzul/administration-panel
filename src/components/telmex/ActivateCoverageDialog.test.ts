// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField, VSelect } from 'vuetify/components'
import type { TelmexCoverage, EligibleTelmexBecario } from '@/interfaces/telmexCoverage'

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
import ActivateCoverageDialog from '@/components/telmex/ActivateCoverageDialog.vue'

const buildEligible = (overrides: Partial<EligibleTelmexBecario> = {}): EligibleTelmexBecario => ({
  id: 10,
  name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type: 'TELMEX',
  ...overrides,
})

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

const mountDialog = (props: { modelValue: boolean; eligibleBecarios?: EligibleTelmexBecario[] }) =>
  mount(ActivateCoverageDialog, {
    props: { eligibleBecarios: [buildEligible()], ...props },
    global: { plugins: [vuetify] },
  })

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

// VSelect renders an internal VTextField-shaped sub-component, so a bare
// `findComponent(VTextField)` matches that nested one instead of our real
// "Mes de inicio" field — mirrors CreateRoleDialog.test.ts's
// `fieldByLabelPrefix` disambiguation-by-label precedent.
const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

describe('ActivateCoverageDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit when no becario or start_period is selected', async () => {
    const store = useTelmexCoverageStore()
    const activateSpy = vi.spyOn(store, 'activateCoverage')

    mountDialog({ modelValue: true })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(activateSpy).not.toHaveBeenCalled()
  })

  it('calls activateCoverage with the selected becario and normalized start_period, emits activated', async () => {
    const store = useTelmexCoverageStore()
    const created = buildCoverage()
    vi.spyOn(store, 'activateCoverage').mockResolvedValue(created)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await wrapper.findComponent(VSelect).setValue(10)
    await fieldByLabelPrefix(wrapper, 'Mes de inicio')?.setValue('2026-01')
    await submitForm()
    await flushPromises()

    expect(store.activateCoverage).toHaveBeenCalledWith({
      user_id: 10,
      start_period: '2026-01-01',
    })
    expect(wrapper.emitted('activated')?.[0]).toEqual([created])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows a server-provided error message and does not close the dialog on failure', async () => {
    const store = useTelmexCoverageStore()
    const error = { response: { status: 422, data: { res: false, msg: 'El becario no es elegible.' } } }
    vi.spyOn(store, 'activateCoverage').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await wrapper.findComponent(VSelect).setValue(10)
    await fieldByLabelPrefix(wrapper, 'Mes de inicio')?.setValue('2026-01')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('El becario no es elegible.')
    expect(wrapper.emitted('activated')).toBeUndefined()
  })
})
