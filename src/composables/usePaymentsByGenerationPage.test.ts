// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePaymentsByGenerationPage } from '@/composables/usePaymentsByGenerationPage'
import { usePaymentsByGenerationStore } from '@/stores/api/paymentsByGenerationStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Generation } from '@/interfaces/generation'
import type { GenerationSummaryGeneration, GenerationSummaryKey } from '@/interfaces/payment'
import type { GenerationPaymentSummary } from '@/interfaces/payment'

// Same rationale as usePersonsPage.test.ts's withSetup: onBeforeMount only
// registers against a real active component instance.
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

const buildGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 1,
  campus: 'MERIDA',
  generation_active: true,
  generation_name: 'Generación B',
  ...overrides,
})

const buildSummaryGeneration = (overrides: Partial<GenerationSummaryGeneration> = {}): GenerationSummaryGeneration => ({
  id: 1,
  generation_name: 'Generación B',
  campus: 'MERIDA',
  ...overrides,
})

const buildSummary = (overrides: Partial<GenerationPaymentSummary> = {}): GenerationPaymentSummary => ({
  total: 1,
  paid: 1,
  pending: 0,
  blocked: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  paid_amount: '1000.00',
  pending_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
  ...overrides,
})

function setRootProfile(authStore: ReturnType<typeof useAuthStore>): void {
  authStore.permissions = ['ADM_READ_PAYMENTS']
  authStore.userProfile = {
    id: 1,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@iu.org.mx',
    campus: 'MERIDA',
    roles: [{ id: 1, name: 'ROOT_ADMINISTRATION' }],
  }
}

describe('usePaymentsByGenerationPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches generations on mount and does not fetch the summary until all 3 filters are set', async () => {
    const generationStore = useGenerationStore()
    const fetchGenerationsSpy = vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
      generationStore.resGenerations = new Map([[1, buildGeneration()]])
      return undefined
    })

    const byGenerationStore = usePaymentsByGenerationStore()
    const fetchSummarySpy = vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

    const authStore = useAuthStore()
    setRootProfile(authStore)

    const result = withSetup(() => usePaymentsByGenerationPage())
    await flushPromises()

    expect(fetchGenerationsSpy).toHaveBeenCalledTimes(1)
    expect(fetchSummarySpy).not.toHaveBeenCalled()

    result.generationId.value = 1
    await flushPromises()
    expect(fetchSummarySpy).not.toHaveBeenCalled()

    result.periodYear.value = 2026
    await flushPromises()
    expect(fetchSummarySpy).not.toHaveBeenCalled()

    result.periodMonth.value = 9
    await flushPromises()

    expect(fetchSummarySpy).toHaveBeenCalledTimes(1)
    expect(fetchSummarySpy).toHaveBeenCalledWith({ generation_id: 1, period_year: 2026, period_month: 9 })
  })

  it('refetches once when a filter changes after the first complete selection', async () => {
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const byGenerationStore = usePaymentsByGenerationStore()
    const fetchSummarySpy = vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

    const authStore = useAuthStore()
    setRootProfile(authStore)

    const result = withSetup(() => usePaymentsByGenerationPage())
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()
    expect(fetchSummarySpy).toHaveBeenCalledTimes(1)

    result.periodMonth.value = 10
    await flushPromises()

    expect(fetchSummarySpy).toHaveBeenCalledTimes(2)
    expect(fetchSummarySpy).toHaveBeenLastCalledWith({ generation_id: 1, period_year: 2026, period_month: 10 } satisfies GenerationSummaryKey)
  })

  it('sets loadError=true when fetchSummary fails', async () => {
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const byGenerationStore = usePaymentsByGenerationStore()
    vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(false)

    const authStore = useAuthStore()
    setRootProfile(authStore)

    const result = withSetup(() => usePaymentsByGenerationPage())
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.loading.value).toBe(false)
  })

  it('exposes summary/generation from the store once fetched', async () => {
    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const summary = buildSummary()
    const generation = buildSummaryGeneration()
    const byGenerationStore = usePaymentsByGenerationStore()
    vi.spyOn(byGenerationStore, 'fetchSummary').mockImplementation(async () => {
      byGenerationStore.summary = summary
      byGenerationStore.generation = generation
      return true
    })

    const authStore = useAuthStore()
    setRootProfile(authStore)

    const result = withSetup(() => usePaymentsByGenerationPage())
    result.generationId.value = 1
    result.periodYear.value = 2026
    result.periodMonth.value = 9
    await flushPromises()

    expect(result.summary.value).toEqual(summary)
    expect(result.generation.value).toEqual(generation)
  })

  // Sede → Generación cascade (user decision 2026-10-08, supersedes design
  // D8's single "nombre — sede" picker). `campus` is a new client-side-only
  // filter ref; `generationOptions` is now scoped to the selected campus
  // only (both active/inactive included), labeled by generation_name alone.
  describe('campus → generationOptions cascade', () => {
    it('exposes filteredCampus (authStore) as the sede picker options, restricted for a non-ROOT admin', async () => {
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

      const byGenerationStore = usePaymentsByGenerationStore()
      vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

      const authStore = useAuthStore()
      authStore.permissions = ['ADM_READ_PAYMENTS']
      authStore.userProfile = {
        id: 2,
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@iu.org.mx',
        campus: 'MERIDA',
        roles: [{ id: 2, name: 'CAMPUS_STAFF' }],
      }

      const result = withSetup(() => usePaymentsByGenerationPage())
      await flushPromises()

      expect(result.filteredCampus.value).toEqual([{ value: 'MERIDA', text: 'Mérida' }])
    })

    it('returns no generation options until a sede is chosen', async () => {
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
        generationStore.resGenerations = new Map([[1, buildGeneration({ id: 1, campus: 'MERIDA' })]])
        return undefined
      })

      const byGenerationStore = usePaymentsByGenerationStore()
      vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

      const authStore = useAuthStore()
      setRootProfile(authStore)

      const result = withSetup(() => usePaymentsByGenerationPage())
      await flushPromises()

      expect(result.campus.value).toBeNull()
      expect(result.generationOptions.value).toEqual([])
    })

    it('labels options by generation_name only, scoped to the selected sede, sorted, including inactive', async () => {
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
        generationStore.resGenerations = new Map([
          [1, buildGeneration({ id: 1, generation_name: 'Generación B', campus: 'MERIDA', generation_active: false })],
          [2, buildGeneration({ id: 2, generation_name: 'Generación A', campus: 'MERIDA' })],
          [3, buildGeneration({ id: 3, generation_name: 'Generación C', campus: 'VALLADOLID' })],
        ])
        return undefined
      })

      const byGenerationStore = usePaymentsByGenerationStore()
      vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

      const authStore = useAuthStore()
      setRootProfile(authStore)

      const result = withSetup(() => usePaymentsByGenerationPage())
      await flushPromises()

      result.campus.value = 'MERIDA'
      await flushPromises()

      expect(result.generationOptions.value).toEqual([
        { title: 'Generación A', value: 2 },
        { title: 'Generación B', value: 1 },
      ])
    })

    it('clears the selected generation when the sede changes', async () => {
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
        generationStore.resGenerations = new Map([
          [1, buildGeneration({ id: 1, generation_name: 'Generación A', campus: 'MERIDA' })],
          [2, buildGeneration({ id: 2, generation_name: 'Generación B', campus: 'VALLADOLID' })],
        ])
        return undefined
      })

      const byGenerationStore = usePaymentsByGenerationStore()
      const fetchSummarySpy = vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

      const authStore = useAuthStore()
      setRootProfile(authStore)

      const result = withSetup(() => usePaymentsByGenerationPage())
      await flushPromises()

      result.campus.value = 'MERIDA'
      await flushPromises()
      result.generationId.value = 1
      await flushPromises()

      expect(result.generationId.value).toBe(1)

      result.campus.value = 'VALLADOLID'
      await flushPromises()

      expect(result.generationId.value).toBeNull()
      expect(result.generationOptions.value).toEqual([{ title: 'Generación B', value: 2 }])
      expect(fetchSummarySpy).not.toHaveBeenCalled()
    })

    it('clearing the sede also clears the selected generation', async () => {
      const generationStore = useGenerationStore()
      vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
        generationStore.resGenerations = new Map([[1, buildGeneration({ id: 1, campus: 'MERIDA' })]])
        return undefined
      })

      const byGenerationStore = usePaymentsByGenerationStore()
      vi.spyOn(byGenerationStore, 'fetchSummary').mockResolvedValue(true)

      const authStore = useAuthStore()
      setRootProfile(authStore)

      const result = withSetup(() => usePaymentsByGenerationPage())
      await flushPromises()

      result.campus.value = 'MERIDA'
      await flushPromises()
      result.generationId.value = 1
      await flushPromises()

      result.campus.value = null
      await flushPromises()

      expect(result.generationId.value).toBeNull()
      expect(result.generationOptions.value).toEqual([])
    })
  })
})
