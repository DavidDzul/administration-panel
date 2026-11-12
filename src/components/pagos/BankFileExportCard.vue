<template>
  <template v-if="exportSummary">
    <v-row class="mb-2">
      <v-col v-for="file in files" :key="file.concept" cols="12" md="6">
        <v-card variant="flat" :data-testid="`export-file-${file.concept}`">
          <v-card-title class="text-subtitle-1">{{ file.title }}</v-card-title>
          <v-card-text class="d-flex flex-column ga-2">
            <div class="text-body-1">
              <strong>{{ file.summary.count }}</strong> Becarios
              &middot; <strong>${{ file.summary.total_amount }}</strong>
            </div>
            <div class="text-caption text-medium-emphasis">{{ file.summary.filename }}</div>
            <div v-if="file.summary.count === 0" class="text-caption">
              No hay montos de {{ file.concept }} por dispersar en este lote.
            </div>
            <div>
              <v-btn
                color="primary"
                :loading="loadingExport[file.concept]"
                :disabled="file.summary.count === 0"
                @click="emit('download', file.concept)"
              >
                {{ file.label }}
              </v-btn>
            </div>
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
// Bank-file export summary + download actions (design D8,
// sdd/becario-payment-bank-file-export; split into two files by
// sdd/archivo-pago-beca-apoyo) — mounted in PaymentsView once
// `isPaid && hasExportPermission`. Purely presentational, same convention
// as PaymentBatchSummary/PaymentBatchTable: state and the actual download
// call live in usePaymentsPage, this component only renders + emits intent.
// The combined "Becarios a Dispersar" / "Cantidad Total a Dispersar" card was
// removed: on the paid basis it repeated PaymentBatchSummary's "Pagados" and
// "Monto total pagado" (same rows, same totalToPay formula).
import { computed } from 'vue'
import type { BankFileConcept, ExportFileSummary, ExportSummary, InvalidBankRow } from '@/interfaces/payment'

interface Props {
  exportSummary?: ExportSummary | null
  loadingExport?: Record<BankFileConcept, boolean>
  exportError?: 'blocked' | 'error' | null
  invalidRows?: InvalidBankRow[]
}

const props = withDefaults(defineProps<Props>(), {
  exportSummary: null,
  loadingExport: () => ({ beca: false, apoyo: false }),
  exportError: null,
  invalidRows: () => [],
})

interface Emits {
  (e: 'download', concept: BankFileConcept): void
}

const emit = defineEmits<Emits>()

interface FileCard {
  concept: BankFileConcept
  title: string
  label: string
  summary: ExportFileSummary
}

const files = computed<FileCard[]>(() => {
  const summary = props.exportSummary
  if (!summary) return []
  return [
    { concept: 'beca', title: 'Archivo Beca', label: 'Descargar archivo Beca', summary: summary.files.beca },
    { concept: 'apoyo', title: 'Archivo Apoyo', label: 'Descargar archivo Apoyo', summary: summary.files.apoyo },
  ]
})
</script>
