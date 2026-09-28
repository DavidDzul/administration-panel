<template>
  <div>
    <!-- Datos bancarios — unchanged logic (design D6), now scoped to its own
         subsection instead of gating the whole card. -->
    <div class="text-subtitle-2 mb-2">Datos bancarios</div>
    <v-progress-linear v-if="loadingPaymentData" indeterminate color="primary" class="mb-3" />

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
    </template>

    <v-alert v-else type="info" variant="tonal" density="compact">
      Sin datos de pago configurados.
    </v-alert>

    <v-divider class="my-4" />

    <!-- Configuración de beca — independent section (design D6). Renders
         regardless of whether `paymentData` exists: fixes the flagged
         gotcha where this whole card used to gate ALL content on
         `paymentData` truthy. -->
    <div class="text-subtitle-2 mb-2">Configuración de beca</div>
    <v-progress-linear v-if="loadingProfileConfig" indeterminate color="primary" class="mb-3" />

    <template v-else-if="profileConfig">
      <v-row dense>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">Tipo de beca</div>
          <div class="font-weight-medium">{{ profileConfig.scholarship_type }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">Monto mensual</div>
          <div class="font-weight-medium">{{ profileConfig.monthly_amount }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">Apoyo</div>
          <div class="font-weight-medium">{{ profileConfig.monto_apoyo ?? 'N/A' }}</div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis mb-1">¿Estudia en el CERT de Mérida o UNID Tizimín?</div>
          <div class="font-weight-medium">{{ profileConfig.advance_payment_eligible ? 'Sí' : 'No' }}</div>
        </v-col>
      </v-row>
    </template>

    <v-alert v-else type="info" variant="tonal" density="compact">
      Sin configurar.
    </v-alert>

    <!-- One shared "Editar" button for both sections (design D6), enabled
         if the admin holds either permission. -->
    <v-btn
      class="mt-3"
      size="small"
      variant="tonal"
      :disabled="!(editPaymentData || editScholarshipProfile)"
      @click="openDialog"
    >
      Editar
    </v-btn>

    <PaymentDataDialog v-model="dialogOpen" :user-id="props.userId" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useScholarshipProfileStore } from '@/stores/api/scholarshipProfileStore'
import { useAuthStore } from '@/stores/api/authStore'
import PaymentDataDialog from '@/components/users/PaymentDataDialog.vue'
import type { PaymentData } from '@/interfaces/paymentData'
import type { ScholarshipProfileConfig } from '@/interfaces/scholarshipProfile'

interface Props {
  userId: number
}

const props = defineProps<Props>()

// Autonomous (design D6/D7, sdd/becarios-payment-config +
// sdd/scholarship-profile-config-to-admin): fetches its own data rather
// than reading a shared cache. Both fetches below are independent of each
// other — neither gates the other's rendering.
const paymentDataStore = usePaymentDataStore()
const scholarshipProfileStore = useScholarshipProfileStore()
const { editPaymentData, editScholarshipProfile } = storeToRefs(useAuthStore())

const loadingPaymentData = ref(false)
const paymentData = ref<PaymentData | null>(null)
const loadingProfileConfig = ref(false)
const profileConfig = ref<ScholarshipProfileConfig | null>(null)
const dialogOpen = ref(false)

const loadPaymentData = async (): Promise<void> => {
  loadingPaymentData.value = true
  try {
    paymentData.value = await paymentDataStore.fetchPaymentData(props.userId)
  } catch (error: unknown) {
    console.error('Error al cargar los datos de pago:', error)
    paymentData.value = null
  } finally {
    loadingPaymentData.value = false
  }
}

const loadProfileConfig = async (): Promise<void> => {
  loadingProfileConfig.value = true
  try {
    profileConfig.value = await scholarshipProfileStore.fetchProfileConfig(props.userId)
  } catch (error: unknown) {
    console.error('Error al cargar la configuración de beca:', error)
    profileConfig.value = null
  } finally {
    loadingProfileConfig.value = false
  }
}

onMounted(() => {
  void loadPaymentData()
  void loadProfileConfig()
})

const openDialog = (): void => {
  dialogOpen.value = true
}

const onSaved = async (): Promise<void> => {
  await Promise.all([loadPaymentData(), loadProfileConfig()])
}
</script>
