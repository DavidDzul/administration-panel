import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { AdministrationRole, AdministrationPermission } from '@/interfaces/role'

// Roles detail page composable — deferred from PR5 (task 5.4) to PR7
// (apply-progress obs #1595). Mirrors usePersonDetailsPage.ts's D4
// rationale: lifecycle lives here, not inside the Pinia store, so it fires
// on every route entry against this view's real component instance.
//
// Both `role` (via fetchRole) and `permissionsCatalog` (via
// fetchPermissionsCatalog, a store-level cache) are fetched on mount so the
// PR7b checklist UI has everything it needs without an extra round trip.
export function useRoleDetailPage() {
  const route = useRoute()
  const rolesStore = useRolesStore()
  const { manageRoles } = storeToRefs(useAuthStore())

  const role = ref<AdministrationRole | null>(null)
  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadRole = async (): Promise<void> => {
    const id = Number(route.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      role.value = null
      loadError.value = true
      return
    }

    loading.value = true
    loadError.value = false

    const [fetchedRole, catalogLoaded] = await Promise.all([
      rolesStore.fetchRole(id),
      rolesStore.fetchPermissionsCatalog(),
    ])

    role.value = fetchedRole
    loadError.value = !fetchedRole || !catalogLoaded
    loading.value = false
  }

  onBeforeMount(loadRole)
  watch(() => route.params.id, loadRole)

  const permissionsCatalog = computed<AdministrationPermission[]>(() => rolesStore.permissionsCatalog)
  const canManage = computed<boolean>(() => manageRoles.value)

  // Deliberately does NOT catch — mirrors rolesStore's own write-op
  // uncaught-error convention (design obs #1593), so PR7b's save handler
  // decides how to surface a 422/403 with its own copy. On success, `role`
  // is refreshed with the server's authoritative response (same object
  // `rolesStore.syncRolePermissions` already wrote into `allRoles`), instead
  // of re-fetching.
  const savePermissions = async (permissionIds: number[]): Promise<void> => {
    if (!role.value) return
    role.value = await rolesStore.syncRolePermissions(role.value.id, permissionIds)
  }

  return {
    role,
    permissionsCatalog,
    loading,
    loadError,
    canManage,
    savePermissions,
  }
}
