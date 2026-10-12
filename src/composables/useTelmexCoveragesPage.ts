import { computed, onBeforeMount, ref, watch } from 'vue'
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
  // Client-side filters (spec: "Generación and sede filters"), same rationale
  // as statusFilter/search above — filtered over the already-fetched list.
  const generationFilter = ref<string | null>(null)
  const campusFilter = ref<string | null>(null)

  const reloadCoverages = async (): Promise<void> => {
    loading.value = true
    loadError.value = false
    const coveragesLoaded = await fetchCoverages()
    if (!coveragesLoaded) loadError.value = true
    loading.value = false
  }

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

  // Sorted, non-null options derived from the loaded list (design #1931,
  // Panel file changes table) rather than a fixed catalog — mirrors
  // usePersonsPage's `filteredCampus` precedent of deriving filter choices
  // from what's actually there instead of a static source that could drift.
  const generationOptions = computed<string[]>(() => {
    const values = new Set(
      allCoveragesList.value
        .map((coverage) => coverage.generation)
        .filter((generation): generation is string => generation !== null),
    )
    return [...values].sort((a, b) => a.localeCompare(b))
  })

  const campusOptions = computed<string[]>(() => {
    const values = new Set(allCoveragesList.value.map((coverage) => coverage.campus))
    return [...values].sort((a, b) => a.localeCompare(b))
  })

  const coverages = computed<TelmexCoverage[]>(() => {
    const normalizedSearch = search.value.trim().toLowerCase()
    return allCoveragesList.value.filter((coverage) => {
      const matchesStatus = statusFilter.value === null || coverage.status === statusFilter.value
      const matchesGeneration = generationFilter.value === null || coverage.generation === generationFilter.value
      const matchesCampus = campusFilter.value === null || coverage.campus === campusFilter.value
      const matchesSearch =
        normalizedSearch === '' || coverage.becario_name.toLowerCase().includes(normalizedSearch)
      return matchesStatus && matchesGeneration && matchesCampus && matchesSearch
    })
  })

  // Bulk selection (spec: "Row selection restricted to ACTIVA", "Bulk action
  // trigger and feedback"; design #1931 D9). Selection is plain coverage ids
  // — `selectedCoverages` below is the actual submission payload source,
  // intersected against the currently visible ACTIVA rows so a stale id
  // (hidden by a filter, or no longer ACTIVA) is never sent.
  const selectedIds = ref<number[]>([])

  watch([statusFilter, generationFilter, campusFilter, search], () => {
    selectedIds.value = []
  })

  const selectedCoverages = computed<TelmexCoverage[]>(() =>
    coverages.value.filter((coverage) => coverage.status === 'ACTIVA' && selectedIds.value.includes(coverage.id)),
  )

  const canBulkEnd = computed<boolean>(() => selectedCoverages.value.length > 0)

  const clearSelection = (): void => {
    selectedIds.value = []
  }

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
    generationFilter,
    campusFilter,
    generationOptions,
    campusOptions,
    canManage,
    canManageRepayments,
    selectedIds,
    selectedCoverages,
    canBulkEnd,
    clearSelection,
    reloadCoverages,
  }
}
