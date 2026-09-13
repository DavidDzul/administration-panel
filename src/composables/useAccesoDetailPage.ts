import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Administrator } from '@/interfaces/administrator'
import type { AdministrationRole } from '@/interfaces/role'

// Accesos detail page composable — mirrors useRoleDetailPage's D4 rationale:
// lifecycle lives here, not inside the Pinia store, so it fires on every
// route entry against this view's real component instance.
//
// Reuses the EXISTING rolesStore.fetchRoles/allRoles (PR5) as the role
// catalog for the assignment dropdown — deliberately NOT a duplicate/
// parallel fetch (design obs #1593, apply-progress obs #1595 flag #27's
// confirmed cross-feature dependency).
export function useAccesoDetailPage() {
  const route = useRoute()
  const administratorsStore = useAdministratorsStore()
  const rolesStore = useRolesStore()
  const { manageAdmins } = storeToRefs(useAuthStore())

  const administrator = ref<Administrator | null>(null)
  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadAdministrator = async (): Promise<void> => {
    const id = Number(route.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      administrator.value = null
      loadError.value = true
      return
    }

    loading.value = true
    loadError.value = false

    const [fetchedAdministrator, rolesLoaded] = await Promise.all([
      administratorsStore.fetchAdministrator(id),
      rolesStore.fetchRoles(),
    ])

    administrator.value = fetchedAdministrator
    loadError.value = !fetchedAdministrator || !rolesLoaded
    loading.value = false
  }

  onBeforeMount(loadAdministrator)
  watch(() => route.params.id, loadAdministrator)

  // `Administrator.roles` is an array (Spatie eager-load) even though
  // Accesos enforces one-role-per-account at the business level
  // (apply-progress obs #1595 flag #27) — resolve the current role as
  // `roles[0] ?? null` rather than assuming a singular field.
  const currentRole = computed<AdministrationRole | null>(() => administrator.value?.roles[0] ?? null)
  const availableRoles = computed<AdministrationRole[]>(() => [...rolesStore.allRoles.values()])
  const canManage = computed<boolean>(() => manageAdmins.value)

  // Deliberately does NOT catch — mirrors administratorsStore's own write-op
  // uncaught-error convention (design obs #1593), so PR10's save handler
  // decides how to surface a 403/422 (including the R4/A2 self-demotion
  // guard) with its own copy. On success, `administrator` is refreshed with
  // the server's authoritative response.
  const assignRole = async (roleId: number): Promise<void> => {
    if (!administrator.value) return
    administrator.value = await administratorsStore.assignRole(administrator.value.id, roleId)
  }

  return {
    administrator,
    currentRole,
    availableRoles,
    loading,
    loadError,
    canManage,
    assignRole,
  }
}
