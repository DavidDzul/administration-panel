import { computed, onBeforeMount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Administrator } from '@/interfaces/administrator'

// Accesos list page composable — mirrors useRolesPage's D4 rationale:
// lifecycle lives here (a plain composable called from a view's setup()),
// not inside the Pinia store, so onBeforeMount fires on every route entry
// rather than only once per store instantiation. Consumed by PR9a's
// `AccesosView.vue`. Exposes the raw `Administrator[]` list as-is (each
// item's `roles` array included) — PR9a's `AccesosTable.vue` resolves the
// display-only `roles[0]?.name ?? '—'` column itself, mirroring how
// `useRolesPage` exposes raw roles for `RolesTable.vue` to project.
export function useAccesosPage() {
  const administratorsStore = useAdministratorsStore()
  const { allAdministrators } = storeToRefs(administratorsStore)
  const { fetchAdministrators } = administratorsStore

  const { manageAdmins } = storeToRefs(useAuthStore())

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  onBeforeMount(async () => {
    loading.value = true
    loadError.value = false
    const success = await fetchAdministrators()
    if (!success) loadError.value = true
    loading.value = false
  })

  const administrators = computed<Administrator[]>(() => [...allAdministrators.value.values()])
  const canManage = computed<boolean>(() => manageAdmins.value)

  return {
    administrators,
    loading,
    loadError,
    canManage,
  }
}
