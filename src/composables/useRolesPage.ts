import { computed, onBeforeMount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { AdministrationRole } from '@/interfaces/role'

// Roles list page composable — mirrors usePersonsPage's D4 rationale:
// lifecycle lives here (a plain composable called from a view's setup()),
// not inside the Pinia store, so onBeforeMount fires on every route entry
// rather than only once per store instantiation. Consumed by PR6a's
// `RolesView.vue`.
export function useRolesPage() {
  const rolesStore = useRolesStore()
  const { allRoles } = storeToRefs(rolesStore)
  const { fetchRoles } = rolesStore

  const { manageRoles } = storeToRefs(useAuthStore())

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  onBeforeMount(async () => {
    loading.value = true
    loadError.value = false
    const success = await fetchRoles()
    if (!success) loadError.value = true
    loading.value = false
  })

  const roles = computed<AdministrationRole[]>(() => [...allRoles.value.values()])
  const canManage = computed<boolean>(() => manageRoles.value)

  return {
    roles,
    loading,
    loadError,
    canManage,
  }
}
