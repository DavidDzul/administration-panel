// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useTelmexCoveragesPage } from '@/composables/useTelmexCoveragesPage'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverage, EligibleTelmexBecario } from '@/interfaces/telmexCoverage'

// Same rationale as useAccesosPage.test.ts's withSetup: onBeforeMount inside
// a plain composable only fires against a real component instance.
function withSetup<T>(composable: () => T): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  return result
}

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

const buildEligible = (overrides: Partial<EligibleTelmexBecario> = {}): EligibleTelmexBecario => ({
  id: 10,
  name: 'Juan Pérez',
  campus: 'MERIDA',
  generation: 'Gen 2024',
  scholarship_type: 'TELMEX',
  ...overrides,
})

describe('useTelmexCoveragesPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches coverages and eligible becarios on mount, with loading true then false', async () => {
    const coverage = buildCoverage()
    const eligible = buildEligible()
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
      store.allCoverages = new Map([[coverage.id, coverage]])
      return true
    })
    vi.spyOn(store, 'fetchEligibleBecarios').mockImplementation(async () => {
      store.eligibleBecarios = [eligible]
      return true
    })

    const result = withSetup(() => useTelmexCoveragesPage())

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(store.fetchCoverages).toHaveBeenCalledTimes(1)
    expect(store.fetchEligibleBecarios).toHaveBeenCalledTimes(1)
    expect(result.coverages.value).toEqual([coverage])
    expect(result.eligibleBecarios.value).toEqual([eligible])
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true when fetchCoverages fails', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockResolvedValue(false)
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('sets eligibleLoadError=true when fetchEligibleBecarios fails, without blocking the list', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockResolvedValue(true)
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(false)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.eligibleLoadError.value).toBe(true)
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
  })

  it('starts both fetches at the same time instead of one after the other', async () => {
    const store = useTelmexCoverageStore()
    let resolveCoverages: (value: boolean) => void = () => {}
    vi.spyOn(store, 'fetchCoverages').mockImplementation(
      () => new Promise<boolean>((resolve) => { resolveCoverages = resolve }),
    )
    const eligibleSpy = vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    withSetup(() => useTelmexCoveragesPage())
    await Promise.resolve()

    expect(eligibleSpy).toHaveBeenCalledTimes(1)
    resolveCoverages(true)
    await flushPromises()
  })

  it('filters the exposed coverages list by status', async () => {
    const activa = buildCoverage({ id: 1, status: 'ACTIVA' })
    const cancelada = buildCoverage({ id: 2, status: 'CANCELADA' })
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
      store.allCoverages = new Map([
        [activa.id, activa],
        [cancelada.id, cancelada],
      ])
      return true
    })
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.coverages.value).toHaveLength(2)

    result.statusFilter.value = 'CANCELADA'

    expect(result.coverages.value).toEqual([cancelada])
  })

  it('exposes canManage/canManageRepayments from authStore permissions', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockResolvedValue(true)
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_TELMEX_COVERAGE']

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.canManage.value).toBe(true)
    expect(result.canManageRepayments.value).toBe(false)
  })
})
