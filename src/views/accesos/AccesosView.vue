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
        text="No se pudo cargar la lista de accesos. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12">
      <AccesosTable :administrators="administrators" />
    </v-col>
  </v-row>

  <CreateAccesoDialog v-model="createDialogOpen" @created="onCreated" />
</template>

<script setup lang="ts">
// Accesos list page. PR9a landed the list/table. PR9b adds the "Agregar"
// create-dialog affordance, gated on `canManage` (authStore.manageAdmins via
// useAccesosPage), per sdd/control-accesos-administration-panel/tasks Phase 9b.
import { ref } from 'vue'
import { useAccesosPage } from '@/composables/useAccesosPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import AccesosTable from '@/components/accesos/AccesosTable.vue'
import CreateAccesoDialog from '@/components/accesos/CreateAccesoDialog.vue'
import type { LinkInterface } from '@/interfaces/link'

const { administrators, loading, loadError, canManage } = useAccesosPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Accesos', disabled: true, href: '/control/accesos' },
]

const createDialogOpen = ref(false)

// No explicit re-fetch — see RolesView.vue's identical note for the full
// rationale. The equivalent bug here (AdministratorController::store() not
// eager-loading `roles`, crashing AccesosTable.vue's
// `item.roles[0]?.name`) is fixed server-side.
const onCreated = (): void => {
  createDialogOpen.value = false
}
</script>
