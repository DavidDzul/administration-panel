<template>
  <template v-if="exportSummary">
    <v-row class="mb-2">
      <v-col cols="12">
        <v-card variant="tonal" color="primary">
          <v-card-text class="d-flex flex-wrap align-center ga-4">
            <div class="text-body-1">
              <strong>{{ exportSummary.count }}</strong> Empleados a Dispersar
              &middot; <strong>${{ exportSummary.total_amount }}</strong> Cantidad Total a Dispersar
            </div>
            <v-spacer></v-spacer>
            <v-btn color="primary" :loading="loadingExport" @click="emit('download')">
              Descargar archivo de pago
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </template>

  <v-row v-if="exportError === 'blocked'">
    <v-col cols="12">
      <v-alert type="error" variant="tonal" title="No se puede generar el archivo de pago" density="compact">
        <p class="mb-2">Los siguientes becarios tienen datos bancarios inválidos:</p>
        <ul>
          <li v-for="row in invalidRows" :key="row.refrend_id">
            <strong>{{ row.snapshot_name }}</strong>: {{ row.reasons.map((reason) => reason.message).join(', ') }}
          </li>
        </ul>
      </v-alert>
    </v-col>
  </v-row>

  <v-row v-else-if="exportError === 'error'">
    <v-col cols="12">
      <v-alert
        type="error"
        variant="tonal"
        density="compact"
        title="Error al descargar el archivo"
        text="No se pudo descargar el archivo de pago. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Bank-file export summary + download action (design D8,
// sdd/becario-payment-bank-file-export) — mounted in PaymentsView once
// `isPaid && hasExportPermission`. Purely presentational, same convention
// as PaymentBatchSummary/PaymentBatchTable: state and the actual download
// call live in usePaymentsPage, this component only renders + emits intent.
// "Empleados a Dispersar" / "Cantidad Total a Dispersar" mirrors the bank's
// own xls convention (explicit business request), not this app's existing
// "Total becarios" / "Monto total" copy in PaymentBatchSummary.
import type { ExportSummary, InvalidBankRow } from '@/interfaces/payment'

interface Props {
  exportSummary?: ExportSummary | null
  loadingExport?: boolean
  exportError?: 'blocked' | 'error' | null
  invalidRows?: InvalidBankRow[]
}

withDefaults(defineProps<Props>(), {
  exportSummary: null,
  loadingExport: false,
  exportError: null,
  invalidRows: () => [],
})

interface Emits {
  (e: 'download'): void
}

const emit = defineEmits<Emits>()
</script>
