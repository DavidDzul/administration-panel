import { computed, onBeforeMount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverage, EligibleTelmexBecario, TelmexCoverageStatus } from '@/interfaces/telmexCoverage'

// Becas Telmex list page composable (sdd/telmex-cobertura-iu, PR4) — mirrors
// useAccesosPage's D4 rationale: lifecycle lives here (a plain composable
// called from a view's setup()), not inside the Pinia store, so
// onBeforeMount fires on every route entry rather than only once per store
// instantiation. Consumed by `TelmexCoveragesView.vue`.
//
// Filtering is client-side over the already-fetched list (mirrors
// usePersonsPage's `filteredCampus` precedent) rather than a server
// round-trip per filter change — the full list is small (one row per
// TELMEX/TELMEX_IU becario with a coverage) and this keeps the UI
// responsive without re-fetching on every keystroke/selection.
export function useTelmexCoveragesPage() {
  const telmexCoverageStore = useTelmexCoverageStore()
  const { allCoverages, eligibleBecarios: storeEligibleBecarios } = storeToRefs(telmexCoverageStore)
  const { fetchCoverages, fetchEligibleBecarios } = telmexCoverageStore

  const { manageTelmexCoverage, manageTelmexRepayments } = storeToRefs(useAuthStore())

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)
  // Separate from loadError: the coverage list still works without the
  // eligible becarios; only "Activar cobertura" depends on them, and the
  // view tells staff why its becario list would be empty.
  const eligibleLoadError = ref<boolean>(false)
  const statusFilter = ref<TelmexCoverageStatus | null>(null)
  const search = ref<string>('')

  onBeforeMount(async () => {
    loading.value = true
    loadError.value = false
    eligibleLoadError.value = false
    const [coveragesLoaded, eligibleLoaded] = await Promise.all([fetchCoverages(), fetchEligibleBecarios()])
    if (!coveragesLoaded) loadError.value = true
    if (!eligibleLoaded) eligibleLoadError.value = true
    loading.value = false
  })

  const allCoveragesList = computed<TelmexCoverage[]>(() => [...allCoverages.value.values()])

  const coverages = computed<TelmexCoverage[]>(() => {
    const normalizedSearch = search.value.trim().toLowerCase()
    return allCoveragesList.value.filter((coverage) => {
      const matchesStatus = statusFilter.value === null || coverage.status === statusFilter.value
      const matchesSearch =
        normalizedSearch === '' || coverage.becario_name.toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  })

  const eligibleBecarios = computed<EligibleTelmexBecario[]>(() => storeEligibleBecarios.value)
  const canManage = computed<boolean>(() => manageTelmexCoverage.value)
  const canManageRepayments = computed<boolean>(() => manageTelmexRepayments.value)

  return {
    coverages,
    eligibleBecarios,
    loading,
    loadError,
    eligibleLoadError,
    statusFilter,
    search,
    canManage,
    canManageRepayments,
  }
}
