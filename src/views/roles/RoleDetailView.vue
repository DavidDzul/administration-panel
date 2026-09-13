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
        text="No se pudo cargar la información de este rol. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="role">
    <v-card class="mb-4">
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
        <div class="text-h6 font-weight-medium">{{ role.name }}</div>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>Permisos</v-card-title>
      <v-card-text>
        <template v-for="(group, index) in permissionsByModule" :key="group.module">
          <div
            class="text-caption text-medium-emphasis font-weight-medium mb-1"
            :class="{ 'mt-4': index > 0 }"
          >
            {{ group.module }}
          </div>

          <v-checkbox
            v-for="permission in group.permissions"
            :key="permission.id"
            v-model="checkedIds"
            :value="permission.id"
            :disabled="!canManage"
            hide-details
            density="compact"
          >
            <template v-slot:label>
              <div>
                <div>{{ permission.description || permission.name }}</div>
                <div v-if="permission.description" class="text-caption text-medium-emphasis">
                  {{ permission.name }}
                </div>
              </div>
            </template>
          </v-checkbox>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-tooltip v-if="!canManage" text="No tienes permiso para modificar roles" location="top">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn color="primary" disabled>Guardar</v-btn>
            </span>
          </template>
        </v-tooltip>
        <v-btn v-else color="primary" :loading="saving" @click="onSave">Guardar</v-btn>
      </v-card-actions>
    </v-card>
  </template>
</template>

<script setup lang="ts">
// Roles detail view — permission checklist (PR7, replacing the PR4 stub).
// Checklist is rendered inline (not a separate PermissionChecklist.vue
// component) per this batch's explicit scope. Mirrors PersonDetailsView.vue's
// loading/error/populated branching (design obs #1593, tasks obs #1594
// Phase 7) and RolesView.vue/CreateRoleDialog.vue's useAlertStore-based
// success/error feedback convention.
import { ref, watch } from 'vue'
import { useRoleDetailPage } from '@/composables/useRoleDetailPage'
import { useAlertStore } from '@/stores/alert'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import type { LinkInterface } from '@/interfaces/link'

const { role, permissionsByModule, loading, loadError, canManage, savePermissions } = useRoleDetailPage()
const { showAlert } = useAlertStore()

const saving = ref(false)
const checkedIds = ref<number[]>([])

// Re-derives the checked set whenever the loaded role changes — covers both
// the initial load and the refreshed role savePermissions writes back after
// a successful save (composable's own contract, obs #1595's
// useRoleDetailPage.ts).
watch(
  role,
  (newRole) => {
    checkedIds.value = newRole ? newRole.permissions.map((p) => p.id) : []
  },
  { immediate: true },
)

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Roles', disabled: false, href: '/control/roles' },
  { title: 'Detalle de rol', disabled: true, href: '#' },
]

// savePermissions (useRoleDetailPage) deliberately does not catch its own
// errors (mirrors rolesStore's uncaught-write convention) — this handler is
// the layer that decides how to surface a 403/422, same shape as
// CreateRoleDialog.vue's onSubmit.
const onSave = async (): Promise<void> => {
  saving.value = true
  try {
    await savePermissions(checkedIds.value)
    showAlert({ title: 'Permisos actualizados exitosamente.', status: 'success' })
  } catch (error: unknown) {
    console.error('Error al actualizar permisos:', error)
    showAlert({ title: 'Error al actualizar los permisos, intenta nuevamente.', status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
