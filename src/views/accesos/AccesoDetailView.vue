<template>
  <BreadCrumbs :items="links" />

  <v-row v-if="loading">
    <v-col cols="12" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-col>
  </v-row>

  <v-row v-else-if="loadError">
    <v-col cols="12">
      <v-alert
        type="error"
        variant="tonal"
        title="Error al cargar la información"
        text="No se pudo cargar la información de este acceso. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="administrator">
    <v-card class="mb-4">
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
        <div class="text-h6 font-weight-medium">{{ administrator.first_name }} {{ administrator.last_name }}</div>
        <div class="text-caption text-medium-emphasis mt-4 mb-1">Correo</div>
        <div class="text-body-1">{{ administrator.email }}</div>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>Rol</v-card-title>
      <v-card-text>
        <v-select
          v-model="selectedRoleId"
          :items="availableRoles"
          item-title="name"
          item-value="id"
          label="Rol asignado"
          placeholder="Sin rol asignado"
          :disabled="!canManage"
          hide-details
        ></v-select>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-tooltip v-if="!canManage" text="No tienes permiso para modificar accesos" location="top">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn color="primary" disabled>Guardar</v-btn>
            </span>
          </template>
        </v-tooltip>
        <v-btn
          v-else
          color="primary"
          :loading="saving"
          :disabled="selectedRoleId === null"
          @click="onSave"
        >
          Guardar
        </v-btn>
      </v-card-actions>
    </v-card>
  </template>
</template>

<script setup lang="ts">
// Accesos detail view — identity header + role assignment (PR10, FINAL,
// replacing the PR4 stub). Mirrors RoleDetailView.vue's loading/error/
// populated branching (design obs #1593, tasks obs #1594 Phase 10) and its
// useAlertStore-based success/error feedback convention, plus
// UsersTable.vue's per-record tooltip+disabled convention for the Guardar
// action (a per-record write, not a page-level one — PR7's resolved split,
// apply-progress obs #1595 flag #22).
import { ref, watch } from 'vue'
import { useAccesoDetailPage } from '@/composables/useAccesoDetailPage'
import { useAlertStore } from '@/stores/alert'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import type { LinkInterface } from '@/interfaces/link'

const { administrator, currentRole, availableRoles, loading, loadError, canManage, assignRole } =
  useAccesoDetailPage()
const { showAlert } = useAlertStore()

const saving = ref(false)
// `number | null` — null is the valid "sin rol" initial state (administrator
// has no ADMINISTRATION-type role yet), not an error condition. Re-derived
// whenever the loaded administrator's current role changes, same pattern as
// RoleDetailView.vue's `checkedIds` watch.
const selectedRoleId = ref<number | null>(null)

watch(
  currentRole,
  (newRole) => {
    selectedRoleId.value = newRole ? newRole.id : null
  },
  { immediate: true },
)

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Accesos', disabled: false, href: '/control/accesos' },
  { title: 'Detalle de acceso', disabled: true, href: '#' },
]

// Extracts the backend's own message when available before falling back to a
// generic one — surfaces both the self-demotion guard's custom `{res,msg}`
// 422 shape (AdministratorController::assignRole, R4/A2) AND the standard
// Laravel validation-error shape for a rejected role type
// (User::assignAdministrationRoleRules()'s `role_id` field), verified
// directly against the real controller/model rather than guessed.
const getErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: { data?: { msg?: string; errors?: Record<string, string[]> } }
  }
  const selfDemotionMessage = err.response?.data?.msg
  const roleValidationMessage = err.response?.data?.errors?.role_id?.[0]
  return selfDemotionMessage ?? roleValidationMessage ?? 'Error al asignar el rol, intenta nuevamente.'
}

// assignRole (useAccesoDetailPage) deliberately does not catch its own
// errors (mirrors administratorsStore's uncaught-write convention) — this
// handler decides how to surface a 403/422. On rejection, `administrator`
// (and therefore `currentRole`/`selectedRoleId` via the watcher above) is
// never touched by the composable, so no optimistic update is ever applied.
const onSave = async (): Promise<void> => {
  if (selectedRoleId.value === null) return

  saving.value = true
  try {
    await assignRole(selectedRoleId.value)
    showAlert({ title: 'Rol asignado exitosamente.', status: 'success' })
  } catch (error: unknown) {
    console.error('Error al asignar el rol:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
