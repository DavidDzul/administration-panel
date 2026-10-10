import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverage, TelmexCoverageMonth, TelmexCoveragePayment } from '@/interfaces/telmexCoverage'

// Becas Telmex detail page composable (sdd/telmex-cobertura-iu, PR5, task
// 5.1) — mirrors useAccesoDetailPage's D4 rationale: lifecycle lives here,
// not inside the Pinia store, so it fires on every route entry against
// this view's real component instance. Statement/repayment WRITE actions
// (register/void) are called directly from their dialogs (mirrors
// CancelCoverageDialog.vue's own-store-call convention, PR4) — this
// composable's only write-adjacent surface is `refresh()`, which the
// detail view calls after a dialog emits success, since the ledger
// (advanced/repaid/balance/status) is entirely server-derived and must be
// re-fetched rather than guessed client-side.
export function useTelmexCoverageDetailPage() {
  const route = useRoute()
  const telmexCoverageStore = useTelmexCoverageStore()
  const { manageTelmexRepayments } = storeToRefs(useAuthStore())

  const statement = ref<{ coverage: TelmexCoverage; months: TelmexCoverageMonth[]; payments: TelmexCoveragePayment[] } | null>(
    null,
  )
  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadStatement = async (): Promise<void> => {
    const id = Number(route.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      statement.value = null
      loadError.value = true
      return
    }

    loading.value = true
    loadError.value = false

    const result = await telmexCoverageStore.fetchCoverageStatement(id)
    statement.value = result
    loadError.value = result === null
    loading.value = false
  }

  onBeforeMount(loadStatement)
  watch(() => route.params.id, loadStatement)

  const coverage = computed<TelmexCoverage | null>(() => statement.value?.coverage ?? null)
  const months = computed<TelmexCoverageMonth[]>(() => statement.value?.months ?? [])
  const payments = computed<TelmexCoveragePayment[]>(() => statement.value?.payments ?? [])
  const canManageRepayments = computed<boolean>(() => manageTelmexRepayments.value)

  return {
    coverage,
    months,
    payments,
    loading,
    loadError,
    canManageRepayments,
    refresh: loadStatement,
  }
}
