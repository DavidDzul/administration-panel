<template>
  <BreadCrumbs :items="links" />

  <v-row v-if="canManage" justify="end">
    <v-col cols="auto">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Agregar</v-btn>
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
        text="No se pudo cargar el catálogo de bancos. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12">
      <BanksTable
        :banks="banks"
        :can-manage="canManage"
        @edit="openEdit"
        @toggle="onToggle"
        @delete="askDelete"
      />
    </v-col>
  </v-row>

  <BankFormDialog v-model="formDialogOpen" :bank="editingBank" />

  <v-dialog v-model="deleteDialogOpen" max-width="440px" persistent>
    <v-card>
      <v-card-title>Eliminar banco</v-card-title>
      <v-card-text>
        ¿Seguro que quieres eliminar {{ bankToDelete?.name }}? Si ya está asignado a algún becario, se
        desactivará en lugar de eliminarse.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="deleteDialogOpen = false">Cancelar</v-btn>
        <v-btn
          data-test="confirm-delete-bank"
          color="error"
          variant="text"
          :loading="deleting"
          @click="confirmDelete"
        >
          Eliminar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Control > Bancos (sdd/catalogo-bancos PR5). List gated on ADM_READ_BANKS at
// the nav/route level; every mutating affordance is gated on ADM_MANAGE_BANKS.
import { onBeforeMount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import BanksTable from '@/components/bancos/BanksTable.vue'
import BankFormDialog from '@/components/bancos/BankFormDialog.vue'
import { useBanksStore } from '@/stores/api/banksStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'
import type { Bank } from '@/interfaces/bank'
import type { LinkInterface } from '@/interfaces/link'

const banksStore = useBanksStore()
const { banks } = storeToRefs(banksStore)
const { manageBanks: canManage } = storeToRefs(useAuthStore())
const { showAlert } = useAlertStore()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Bancos', disabled: true, href: '/control/bancos' },
]

const loading = ref(false)
const loadError = ref(false)

onBeforeMount(async () => {
  loading.value = true
  loadError.value = false
  loadError.value = !(await banksStore.fetchBanks())
  loading.value = false
})

const formDialogOpen = ref(false)
const editingBank = ref<Bank | null>(null)

const openCreate = (): void => {
  editingBank.value = null
  formDialogOpen.value = true
}

const openEdit = (bank: Bank): void => {
  editingBank.value = bank
  formDialogOpen.value = true
}

type ApiError = { response?: { data?: { msg?: string } } }

const errorMessage = (error: unknown, fallback: string): string =>
  (error as ApiError).response?.data?.msg ?? fallback

const onToggle = async (bank: Bank): Promise<void> => {
  try {
    await banksStore.updateBank(bank.id, { code: bank.code, name: bank.name, is_active: !bank.is_active })
    showAlert({ title: bank.is_active ? 'Banco desactivado.' : 'Banco activado.', status: 'success' })
  } catch (error: unknown) {
    console.error('Error al cambiar el estado del banco:', error)
    showAlert({ title: errorMessage(error, 'No se pudo cambiar el estado del banco.'), status: 'error' })
  }
}

const deleteDialogOpen = ref(false)
const bankToDelete = ref<Bank | null>(null)
const deleting = ref(false)

const askDelete = (bank: Bank): void => {
  bankToDelete.value = bank
  deleteDialogOpen.value = true
}

// When the bank is referenced the API deactivates it instead of deleting;
// its message explains that, so it is shown verbatim.
const confirmDelete = async (): Promise<void> => {
  if (!bankToDelete.value) return
  deleting.value = true
  try {
    const result = await banksStore.deleteBank(bankToDelete.value.id)
    showAlert({ title: result.msg, status: result.deleted ? 'success' : 'warning' })
    deleteDialogOpen.value = false
  } catch (error: unknown) {
    console.error('Error al eliminar el banco:', error)
    showAlert({ title: errorMessage(error, 'No se pudo eliminar el banco.'), status: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>
