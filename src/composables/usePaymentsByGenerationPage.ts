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

  // Sede → Generación cascade (user decision 2026-10-08, supersedes design
  // D8's single "nombre — sede" picker). `campus` is a new client-side-only
  // filter: it narrows `generationOptions` but is never sent to the server
  // (the fetch key below stays generation_id/period_year/period_month only,
  // unchanged from D1/D3 — campus is still always server-resolved).
  const campus = ref<string | null>(null)
  const generationId = ref<number | null>(null)
  const periodYear = ref<number | null>(null)
  const periodMonth = ref<number | null>(null)

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  // Generación options are now scoped to the selected sede only (empty
  // until a sede is chosen), labeled by generation_name alone — the
  // "— sede" suffix is redundant once the sede is already picked via its
  // own select above. Both active and inactive generations are included —
  // unlike Lotes, there's no "active only" requirement for this read-only
  // summary. `filteredCampus` (below) is what restricts the Sede picker
  // itself to the admin's allowed sedes, so a disallowed campus can never
  // reach this filter.
  const generationOptions = computed<GenerationOption[]>(() => {
    if (campus.value === null) return []
    return [...resGenerations.value.values()]
      .filter((g) => g.campus === campus.value)
      .sort((a, b) => a.generation_name.localeCompare(b.generation_name))
      .map((g) => ({ title: g.generation_name, value: g.id }))
  })

  // Changing (or clearing) the sede clears the selected generación — it may
  // no longer belong to generationOptions' new scope. This naturally hides
  // the cards too: filtersComplete below requires generationId, so clearing
  // it already falls through to the existing "Selecciona…" guard.
  watch(campus, () => {
    generationId.value = null
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
    campus,
    filteredCampus,
    generationId,
    periodYear,
    periodMonth,
    generationOptions,
    filtersComplete,
    loading,
    loadError,
    summary,
    generation,
    canRead: readPayments,
  }
}
