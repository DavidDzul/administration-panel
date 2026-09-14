import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentsStore } from '@/stores/api/paymentsStore'
import type { ProcessBatchResult } from '@/stores/api/paymentsStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { BatchKey, PaymentBatchRow } from '@/interfaces/payment'
import type { Generation } from '@/interfaces/generation'

// D7: unlike usePersonsPage's client-side-filter pattern (UsersTable.vue owns
// its own generación/sede filters over an already client-fetched list),
// Pagos CANNOT pre-fetch — generation_id/campus/period_year/period_month
// are all REQUIRED server params (design D1) and nothing is fetched until
// every one of the four is chosen. So filter state + the refetch trigger
// live HERE, not in a presentational table component; PaymentBatchTable.vue
// stays purely presentational (rows as props, no internal fetching).
export function usePaymentsPage() {
  const paymentsStore = usePaymentsStore()
  const { rows, summary } = storeToRefs(paymentsStore)
  const { fetchBatch, processBatch } = paymentsStore

  const generationStore = useGenerationStore()
  const { resGenerations } = storeToRefs(generationStore)
  const { fetchGenerations } = generationStore

  const { filteredCampus, readPayments, processPayments } = storeToRefs(useAuthStore())

  const campus = ref<string | null>(null)
  const generationId = ref<number | null>(null)
  const periodYear = ref<number | null>(null)
  const periodMonth = ref<number | null>(null)

  const loadingBatch = ref<boolean>(false)
  const loadError = ref<boolean>(false)
  const processing = ref<boolean>(false)
  const processResult = ref<ProcessBatchResult | null>(null)

  // Purely client-side visual filter (sdd/becario-payment-review-filter) —
  // never triggers a refetch, only narrows what PaymentBatchTable renders.
  // "Pendiente de revisar" = genuinely blocked OR payable-but-flagged
  // (incidencia / withheld-month settlement) worth a second look before
  // confirming the batch. `canProcess`/`summary` below stay derived from
  // `summary` (the full-batch server aggregate), never from `visibleRows` —
  // hiding rows here must never mask a still-blocking row from the
  // all-or-nothing "Pagar todos" gate.
  const showOnlyPending = ref<boolean>(false)

  const isPendingReview = (row: PaymentBatchRow): boolean =>
    !row.is_payable || row.has_incident || row.has_pending_from_previous

  const visibleRows = computed<PaymentBatchRow[]>(() =>
    showOnlyPending.value ? rows.value.filter(isPendingReview) : rows.value,
  )

  const generations = computed<Generation[]>(() => [...resGenerations.value.values()])

  const filtersComplete = computed<boolean>(
    () => campus.value !== null && generationId.value !== null && periodYear.value !== null && periodMonth.value !== null,
  )

  const currentKey = computed<BatchKey | null>(() =>
    filtersComplete.value
      ? {
          generation_id: generationId.value as number,
          campus: campus.value as string,
          period_year: periodYear.value as number,
          period_month: periodMonth.value as number,
        }
      : null,
  )

  const loadBatch = async (): Promise<void> => {
    if (!currentKey.value) return
    loadingBatch.value = true
    loadError.value = false
    const success = await fetchBatch(currentKey.value)
    if (!success) loadError.value = true
    loadingBatch.value = false
  }

  watch([campus, generationId, periodYear, periodMonth], () => {
    if (filtersComplete.value) void loadBatch()
  })

  onBeforeMount(async () => {
    await fetchGenerations()
  })

  // "All rows loaded" is checked as rows.length === summary.total rather
  // than trusting loadingBatch alone, so a stale/partial summary can never
  // flip this true (design's explicit "AND all rows loaded" requirement).
  const canProcess = computed<boolean>(
    () =>
      !loadingBatch.value &&
      summary.value !== null &&
      summary.value.blocking === 0 &&
      summary.value.total > 0 &&
      rows.value.length === summary.value.total,
  )

  const confirmProcess = async (): Promise<ProcessBatchResult | null> => {
    if (!currentKey.value || !summary.value) return null
    processing.value = true
    const result = await processBatch(currentKey.value, summary.value.total, summary.value.total_amount)
    processResult.value = result
    processing.value = false
    // On success the rows/summary now reflect the outcome; on stale (409)
    // the batch changed server-side — reload it so the UI reflects reality.
    if (result.status === 'success' || result.status === 'stale') {
      await loadBatch()
    }
    return result
  }

  return {
    campus,
    generationId,
    periodYear,
    periodMonth,
    generations,
    filteredCampus,
    rows,
    visibleRows,
    showOnlyPending,
    summary,
    loadingBatch,
    loadError,
    canProcess,
    processing,
    processResult,
    confirmProcess,
    canRead: readPayments,
    hasProcessPermission: processPayments,
  }
}
