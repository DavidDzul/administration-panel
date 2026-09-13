<template>
  <BreadCrumbs :items="links" />

  <v-row v-if="canManage" justify="end">
    <v-col cols="auto">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="createDialogOpen = true">Agregar</v-btn>
    </v-col>
  </v-row>

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
        text="No se pudo cargar la lista de roles. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12">
      <RolesTable :roles="roles" />
    </v-col>
  </v-row>

  <CreateRoleDialog v-model="createDialogOpen" @created="onCreated" />
</template>

<script setup lang="ts">
// Roles list page. PR6a landed the list/table. PR6b adds the "Agregar"
// create-dialog affordance, gated on `canManage` (authStore.manageRoles via
// useRolesPage) per sdd/control-accesos-administration-panel/tasks Phase 6b.
import { ref } from 'vue'
import { useRolesPage } from '@/composables/useRolesPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import RolesTable from '@/components/roles/RolesTable.vue'
import CreateRoleDialog from '@/components/roles/CreateRoleDialog.vue'
import type { LinkInterface } from '@/interfaces/link'

const { roles, loading, loadError, canManage } = useRolesPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Roles', disabled: true, href: '/control/roles' },
]

const createDialogOpen = ref(false)

// No explicit re-fetch call is needed here: rolesStore.createRole already
// inserts the new role into the shared `allRoles` Map (see rolesStore.ts),
// and `roles` (from useRolesPage) is a computed view over that exact same
// reactive Map — so the table reflects the new role as soon as the dialog's
// own `createRole` call resolves. This mirrors the convention
// syncRolePermissions already established (no re-fetch there either).
const onCreated = (): void => {
  createDialogOpen.value = false
}
</script>
