import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AdministrationRole, AdministrationPermission } from '@/interfaces/role'
import type {
  AdministrationRolesResponse,
  AdministrationRoleResponse,
  AdministrationPermissionsCatalogResponse,
} from '@/interfaces/api'

// Control (Roles) — administration-panel's own role store, calling the
// `administration-roles` endpoints (design obs #1593, PR2's
// AdministrationRoleController), isolated from psicol-panel's roles by the
// backend's `type='ADMINISTRATION'` scoping.
//
// Deliberately generic in shape: `allRoles`/`fetchRoles` expose the full
// ADMINISTRATION-type role catalog as-is, not a Roles-view-specific
// projection, so PR10's Accesos-detail role-select dropdown can reuse
// `fetchRoles`/`allRoles` directly without introducing a second store or
// coupling this one to Roles-view-only concerns.
export const useRolesStore = defineStore('rolesStore', () => {
  const allRoles = ref<Map<number, AdministrationRole>>(new Map())
  const permissionsCatalog = ref<AdministrationPermission[]>([])

  // Read (list) — mirrors personsStore.fetchPersons: catches, logs, returns
  // a success boolean so the composable layer can surface a loadError state.
  const fetchRoles = async (): Promise<boolean> => {
    try {
      const res = await axios.get<AdministrationRolesResponse>('api/admin/administration-roles')
      allRoles.value = new Map(res.data.roles.map((r) => [r.id, r]))
      return true
    } catch (error: unknown) {
      console.error('Error al cargar roles:', error)
      return false
    }
  }

  // Read (show) — mirrors personsStore.showPerson: used by the detail view's
  // (PR7) hard-reload fallback when `allRoles` is still an empty Map. A
  // missing/404 role resolves to `null` rather than throwing.
  const fetchRole = async (id: number): Promise<AdministrationRole | null> => {
    try {
      const res = await axios.get<AdministrationRoleResponse>(`api/admin/administration-roles/${id}`)
      return res.data.role
    } catch (error: unknown) {
      console.error('Error al cargar el rol:', error)
      return null
    }
  }

  // Read (permissions catalog) — same catch-and-return-boolean shape as
  // fetchRoles, for the PR7 checklist UI's own loading/error state.
  const fetchPermissionsCatalog = async (): Promise<boolean> => {
    try {
      const res = await axios.get<AdministrationPermissionsCatalogResponse>(
        'api/admin/administration-roles/permissions',
      )
      permissionsCatalog.value = res.data.permissions
      return true
    } catch (error: unknown) {
      console.error('Error al cargar el catálogo de permisos:', error)
      return false
    }
  }

  // Write operations deliberately do NOT catch — errors propagate to the
  // caller (mirrors paymentDataStore.savePaymentData's uncaught-write
  // pattern), so the UI layer (PR6b/PR7) decides how to surface a 403/422
  // with its own copy, instead of this store picking a generic message.
  //
  // `type` is never sent from the client — the backend hardcodes it to
  // 'ADMINISTRATION' server-side (design obs #1593, spec R2), so only `name`
  // is submitted here.
  const createRole = async (name: string): Promise<AdministrationRole> => {
    const res = await axios.post<AdministrationRoleResponse>('api/admin/administration-roles', { name })
    allRoles.value.set(res.data.role.id, res.data.role)
    return res.data.role
  }

  const syncRolePermissions = async (roleId: number, permissionIds: number[]): Promise<AdministrationRole> => {
    const res = await axios.put<AdministrationRoleResponse>(
      `api/admin/administration-roles/${roleId}/permissions`,
      { permissions_ids: permissionIds },
    )
    allRoles.value.set(roleId, res.data.role)
    return res.data.role
  }

  return {
    allRoles,
    permissionsCatalog,
    fetchRoles,
    fetchRole,
    fetchPermissionsCatalog,
    createRole,
    syncRolePermissions,
  }
})
