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
        :can-edit="editPaymentData"
        @edit="onEdit"
      />
    </v-col>
  </v-row>

  <PaymentDataDialog v-model="editDialogOpen" :user-id="editingPerson?.id ?? null" :person="editingPerson" @saved="onSaved" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePersonsStore } from '@/stores/api/personsStore'
import { usePersonsPage } from '@/composables/usePersonsPage'
import { useAuthStore } from '@/stores/api/authStore'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import UsersTable from '@/components/users/UsersTable.vue'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'
import type { LinkInterface } from '@/interfaces/link'
import type { Person } from '@/interfaces/user'

const { persons, generations, filteredCampus, loadingTable, loadError } = usePersonsPage()
const { editPaymentData } = storeToRefs(useAuthStore())
const { markAmountsConfigured } = usePersonsStore()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becarios y egresados', disabled: true, href: '/becarios' },
]

// D7 (sdd/becarios-payment-config): hosts the SAME PaymentDataDialog used by
// PaymentDataCard on /becarios/:id — one dialog, two entry points. The table
// itself never shows payment data, but it does show the "Montos pendientes"
// chip (amounts_configured). When the dialog also saved the scholarship
// config, the API stamped config_set_at, so we patch that person locally
// instead of refetching the whole list.
const editDialogOpen = ref(false)
const editingPerson = ref<Person | null>(null)

const onEdit = (person: Person): void => {
  editingPerson.value = person
  editDialogOpen.value = true
}

const onSaved = (payload?: { configSaved: boolean }): void => {
  if (payload?.configSaved && editingPerson.value) {
    markAmountsConfigured(editingPerson.value.id)
  }
  editDialogOpen.value = false
}
</script>
