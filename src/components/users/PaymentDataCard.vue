<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />

    <template v-else-if="paymentData">
      <v-row dense>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">Banco</div>
          <div class="font-weight-medium">{{ paymentData.bank_name }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">Número de cuenta / CLABE</div>
          <div class="font-weight-medium">{{ paymentData.account_number }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">CURP</div>
          <div class="font-weight-medium">{{ paymentData.curp }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">RFC</div>
          <div class="font-weight-medium">{{ paymentData.rfc || 'N/A' }}</div>
        </v-col>
      </v-row>
      <v-btn class="mt-3" size="small" variant="tonal" :disabled="!editPaymentData" @click="openDialog">
        Editar
      </v-btn>
    </template>

    <v-alert v-else type="info" variant="tonal" density="compact">
      Sin datos de pago configurados.
      <template #append>
        <v-btn size="small" variant="text" :disabled="!editPaymentData" @click="openDialog">Configurar</v-btn>
      </template>
    </v-alert>

    <PaymentDataDialog v-model="dialogOpen" :user-id="props.userId" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useAuthStore } from '@/stores/api/authStore'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'
import type { PaymentData } from '@/interfaces/paymentData'

interface Props {
  userId: number
}

const props = defineProps<Props>()

// Autonomous (design D6/D7, sdd/becarios-payment-config): fetches its own
// data rather than reading a shared cache. `paymentDataStore` exposes only
// action functions (`fetchPaymentData`/`savePaymentData`), no reactive
// `data` ref — there is nothing to "read" from the store besides calling
// the fetch again. `usePersonDetailsPage` already called
// `fetchPaymentData` once for this same user id on route load (PR3a
// hand-off), but a GET here is idempotent/cheap, and re-fetching on this
// card's own mount keeps it reusable outside that exact route flow too.
const paymentDataStore = usePaymentDataStore()
const { editPaymentData } = storeToRefs(useAuthStore())

const loading = ref(false)
const paymentData = ref<PaymentData | null>(null)
const dialogOpen = ref(false)

const load = async (): Promise<void> => {
  loading.value = true
  try {
    paymentData.value = await paymentDataStore.fetchPaymentData(props.userId)
  } catch (error: unknown) {
    console.error('Error al cargar los datos de pago:', error)
    paymentData.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

const openDialog = (): void => {
  dialogOpen.value = true
}

const onSaved = async (): Promise<void> => {
  await load()
}
</script>
