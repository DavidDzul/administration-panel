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

  it('filters the exposed coverages list by generación', async () => {
    const gen2024 = buildCoverage({ id: 1, generation: 'Gen 2024' })
    const gen2025 = buildCoverage({ id: 2, generation: 'Gen 2025' })
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
      store.allCoverages = new Map([
        [gen2024.id, gen2024],
        [gen2025.id, gen2025],
      ])
      return true
    })
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.coverages.value).toHaveLength(2)

    result.generationFilter.value = 'Gen 2025'

    expect(result.coverages.value).toEqual([gen2025])
  })

  it('filters the exposed coverages list by sede', async () => {
    const merida = buildCoverage({ id: 1, campus: 'MERIDA' })
    const valladolid = buildCoverage({ id: 2, campus: 'VALLADOLID' })
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
      store.allCoverages = new Map([
        [merida.id, merida],
        [valladolid.id, valladolid],
      ])
      return true
    })
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    result.campusFilter.value = 'VALLADOLID'

    expect(result.coverages.value).toEqual([valladolid])
  })

  it('exposes sorted, non-null generación and sede options derived from the loaded list', async () => {
    const a = buildCoverage({ id: 1, generation: 'Gen 2025', campus: 'VALLADOLID' })
    const b = buildCoverage({ id: 2, generation: 'Gen 2024', campus: 'MERIDA' })
    const c = buildCoverage({ id: 3, generation: null, campus: 'MERIDA' })
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
      store.allCoverages = new Map([
        [a.id, a],
        [b.id, b],
        [c.id, c],
      ])
      return true
    })
    vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

    const result = withSetup(() => useTelmexCoveragesPage())
    await flushPromises()

    expect(result.generationOptions.value).toEqual(['Gen 2024', 'Gen 2025'])
    expect(result.campusOptions.value).toEqual(['MERIDA', 'VALLADOLID'])
  })

  describe('bulk selection', () => {
    it('selectedCoverages only includes selected ids that are currently visible and ACTIVA', async () => {
      const activa = buildCoverage({ id: 1, status: 'ACTIVA' })
      const enCobro = buildCoverage({ id: 2, status: 'EN_COBRO' })
      const store = useTelmexCoverageStore()
      vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
        store.allCoverages = new Map([
          [activa.id, activa],
          [enCobro.id, enCobro],
        ])
        return true
      })
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()

      result.selectedIds.value = [1, 2, 999]

      expect(result.selectedCoverages.value).toEqual([activa])
      expect(result.canBulkEnd.value).toBe(true)
    })

    it('excludes a selected ACTIVA row that is hidden by the current filters', async () => {
      const activaMerida = buildCoverage({ id: 1, status: 'ACTIVA', campus: 'MERIDA' })
      const activaValladolid = buildCoverage({ id: 2, status: 'ACTIVA', campus: 'VALLADOLID' })
      const store = useTelmexCoverageStore()
      vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
        store.allCoverages = new Map([
          [activaMerida.id, activaMerida],
          [activaValladolid.id, activaValladolid],
        ])
        return true
      })
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()

      result.selectedIds.value = [1, 2]
      result.campusFilter.value = 'MERIDA'
      await flushPromises()

      // Changing a filter clears the selection (see below), but this also
      // guards selectedCoverages itself against stale ids if it didn't.
      expect(result.selectedCoverages.value).toEqual([])
    })

    it('clears the selection when any filter changes (status, generación, sede, or search)', async () => {
      const activa = buildCoverage({ id: 1, status: 'ACTIVA' })
      const store = useTelmexCoverageStore()
      vi.spyOn(store, 'fetchCoverages').mockImplementation(async () => {
        store.allCoverages = new Map([[activa.id, activa]])
        return true
      })
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()

      result.selectedIds.value = [1]
      expect(result.selectedIds.value).toEqual([1])

      result.statusFilter.value = 'ACTIVA'
      await flushPromises()
      expect(result.selectedIds.value).toEqual([])

      result.selectedIds.value = [1]
      result.generationFilter.value = 'Gen 2024'
      await flushPromises()
      expect(result.selectedIds.value).toEqual([])

      result.selectedIds.value = [1]
      result.campusFilter.value = 'MERIDA'
      await flushPromises()
      expect(result.selectedIds.value).toEqual([])

      result.selectedIds.value = [1]
      result.search.value = 'Juan'
      await flushPromises()
      expect(result.selectedIds.value).toEqual([])
    })

    it('clearSelection empties the selection', async () => {
      const store = useTelmexCoverageStore()
      vi.spyOn(store, 'fetchCoverages').mockResolvedValue(true)
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()

      result.selectedIds.value = [1, 2]
      result.clearSelection()

      expect(result.selectedIds.value).toEqual([])
    })

    it('canBulkEnd is false when nothing is selected', async () => {
      const store = useTelmexCoverageStore()
      vi.spyOn(store, 'fetchCoverages').mockResolvedValue(true)
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()

      expect(result.canBulkEnd.value).toBe(false)
    })

    it('reloadCoverages re-fetches the coverage list and surfaces load errors', async () => {
      const store = useTelmexCoverageStore()
      const fetchCoveragesSpy = vi.spyOn(store, 'fetchCoverages').mockResolvedValue(true)
      vi.spyOn(store, 'fetchEligibleBecarios').mockResolvedValue(true)

      const result = withSetup(() => useTelmexCoveragesPage())
      await flushPromises()
      fetchCoveragesSpy.mockClear()

      fetchCoveragesSpy.mockResolvedValueOnce(false)
      await result.reloadCoverages()

      expect(fetchCoveragesSpy).toHaveBeenCalledTimes(1)
      expect(result.loadError.value).toBe(true)

      fetchCoveragesSpy.mockResolvedValueOnce(true)
      await result.reloadCoverages()

      expect(result.loadError.value).toBe(false)
    })
  })
})
