import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Administrator, CreateAdministratorForm } from '@/interfaces/administrator'
import type { AdministratorsResponse, AdministratorResponse } from '@/interfaces/api'

// Control (Accesos) — administration-panel's own administrator-account
// store, calling the `administrators` endpoints (design obs #1593, PR3a/PR3b's
// AdministratorController). List/show scoping (A1: ADMIN-type accounts that
// either hold an ADMINISTRATION-type role or hold zero roles) is entirely
// server-side — this store just calls the endpoint as-is, it never
// re-filters or re-scopes on the client.
export const useAdministratorsStore = defineStore('administratorsStore', () => {
  const allAdministrators = ref<Map<number, Administrator>>(new Map())

  // Read (list) — mirrors rolesStore.fetchRoles: catches, logs, returns a
  // success boolean so the composable layer can surface a loadError state.
  const fetchAdministrators = async (): Promise<boolean> => {
    try {
      const res = await axios.get<AdministratorsResponse>('api/admin/administrators')
      allAdministrators.value = new Map(res.data.administrators.map((a) => [a.id, a]))
      return true
    } catch (error: unknown) {
      console.error('Error al cargar administradores:', error)
      return false
    }
  }

  // Read (show) — mirrors rolesStore.fetchRole: used by the detail page
  // composable (PR8b). A missing/404 administrator resolves to `null`
  // rather than throwing.
  const fetchAdministrator = async (id: number): Promise<Administrator | null> => {
    try {
      const res = await axios.get<AdministratorResponse>(`api/admin/administrators/${id}`)
      return res.data.administrator
    } catch (error: unknown) {
      console.error('Error al cargar el administrador:', error)
      return null
    }
  }

  // Write operations deliberately do NOT catch — errors propagate to the
  // caller (mirrors rolesStore.createRole/syncRolePermissions's
  // uncaught-write pattern), so the UI layer (PR9b/PR10) decides how to
  // surface a 403/422 (including the R4/A2 self-demotion guard's 422) with
  // its own copy, instead of this store picking a generic message.
  //
  // `role`/`role_id` are never sent from the client at creation time —
  // AdministratorController::store()/User::createRulesAdministrator() never
  // read them (spec R3): a freshly created administrator always holds zero
  // roles, assigned later via assignRole below.
  const createAdministrator = async (form: CreateAdministratorForm): Promise<Administrator> => {
    const res = await axios.post<AdministratorResponse>('api/admin/administrators', form)
    allAdministrators.value.set(res.data.administrator.id, res.data.administrator)
    return res.data.administrator
  }

  // Assigns (replaces) the single ADMINISTRATION-type role held by an
  // administrator account. `role_id` is the exact field name validated by
  // User::assignAdministrationRoleRules() — verified by reading the
  // controller/model directly, not guessed.
  const assignRole = async (id: number, roleId: number): Promise<Administrator> => {
    const res = await axios.put<AdministratorResponse>(`api/admin/administrators/${id}/role`, {
      role_id: roleId,
    })
    allAdministrators.value.set(id, res.data.administrator)
    return res.data.administrator
  }

  return {
    allAdministrators,
    fetchAdministrators,
    fetchAdministrator,
    createAdministrator,
    assignRole,
  }
})
