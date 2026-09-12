<template>
  <BreadCrumbs :items="links" />
  <v-row>
    <v-col cols="12">
      <v-alert
        v-if="loadError"
        type="error"
        variant="tonal"
        class="mb-4"
        title="Error al cargar la información"
        text="No se pudo cargar la lista de becarios y egresados. Intenta de nuevo más tarde."
      ></v-alert>
      <UsersTable
        :persons="persons"
        :loading="loadingTable"
        :generations="generations"
        :campus-options="filteredCampus"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { usePersonsPage } from '@/composables/usePersonsPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import UsersTable from '@/components/users/UsersTable.vue'
import type { LinkInterface } from '@/interfaces/link'

const { persons, generations, filteredCampus, loadingTable, loadError } = usePersonsPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becarios y egresados', disabled: true, href: '/becarios' },
]
</script>
