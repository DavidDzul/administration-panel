import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentsByGenerationStore } from '@/stores/api/paymentsByGenerationStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { GenerationSummaryKey } from '@/interfaces/payment'

export interface GenerationOption {
  title: string
  value: number
}

// D7/D8 (sdd/pagos-consulta-por-generacion): mirrors usePaymentsPage's "no
// pre-fetch, filter state + refetch trigger live here" pattern — the 3
// filters (generación/año/mes) are all required server params, and nothing
// is fetched until every one is chosen. Unlike usePaymentsPage, the
// generation picker itself is populated here too, mirroring
// usePersonsPage's onBeforeMount generation fetch.
export function usePaymentsByGenerationPage() {
  const paymentsByGenerationStore = usePaymentsByGenerationStore()
  const { summary, generation } = storeToRefs(paymentsByGenerationStore)
  const { fetchSummary } = paymentsByGenerationStore

  const generationStore = useGenerationStore()
  const { resGenerations } = storeToRefs(generationStore)
  const { fetchGenerations } = generationStore

  const { filteredCampus, readPayments } = storeToRefs(useAuthStore())

  const generationId = ref<number | null>(null)
  const periodYear = ref<number | null>(null)
  const periodMonth = ref<number | null>(null)

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  // D8: client-side-only sede scoping — the same list a non-ROOT admin
  // already sees in the Lotes picker (authStore.filteredCampus), not a
  // server-enforced restriction (byGeneration() has none either, same as
  // index()). Both active and inactive generations are included — unlike
  // Lotes, there's no "active only" requirement for this read-only summary.
  const generationOptions = computed<GenerationOption[]>(() => {
    const allowedCampus = new Set(filteredCampus.value.map((c) => c.value))
    return [...resGenerations.value.values()]
      .filter((g) => allowedCampus.has(g.campus))
      .sort((a, b) => a.generation_name.localeCompare(b.generation_name))
      .map((g) => ({ title: `${g.generation_name} — ${g.campus}`, value: g.id }))
  })

  const filtersComplete = computed<boolean>(
    () => generationId.value !== null && periodYear.value !== null && periodMonth.value !== null,
  )

  const currentKey = computed<GenerationSummaryKey | null>(() =>
    filtersComplete.value
      ? {
          generation_id: generationId.value as number,
          period_year: periodYear.value as number,
          period_month: periodMonth.value as number,
        }
      : null,
  )

  const load = async (): Promise<void> => {
    if (!currentKey.value) return
    loading.value = true
    loadError.value = false
    const success = await fetchSummary(currentKey.value)
    if (!success) loadError.value = true
    loading.value = false
  }

  watch([generationId, periodYear, periodMonth], () => {
    if (filtersComplete.value) void load()
  })

  onBeforeMount(async () => {
    await fetchGenerations()
  })

  return {
    generationId,
    periodYear,
    periodMonth,
    generationOptions,
    loading,
    loadError,
    summary,
    generation,
    canRead: readPayments,
  }
}
