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

  <PaymentDataDialog v-model="editDialogOpen" :user-id="editingPersonId" @saved="onSaved" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePersonsPage } from '@/composables/usePersonsPage'
import { useAuthStore } from '@/stores/api/authStore'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import UsersTable from '@/components/users/UsersTable.vue'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'
import type { LinkInterface } from '@/interfaces/link'
import type { Person } from '@/interfaces/user'

const { persons, generations, filteredCampus, loadingTable, loadError } = usePersonsPage()
const { editPaymentData } = storeToRefs(useAuthStore())

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becarios y egresados', disabled: true, href: '/becarios' },
]

// D7 (sdd/becarios-payment-config): hosts the SAME PaymentDataDialog used by
// PaymentDataCard on /becarios/:id — one dialog, two entry points. The table
// itself never shows payment data, so there is nothing in `persons` to
// refresh after a save; the dialog's own `savePaymentData` call + alert is
// the only side effect needed here.
const editDialogOpen = ref(false)
const editingPersonId = ref<number | null>(null)

const onEdit = (person: Person): void => {
  editingPersonId.value = person.id
  editDialogOpen.value = true
}

const onSaved = (): void => {
  editDialogOpen.value = false
}
</script>
