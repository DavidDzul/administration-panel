<template>
  <BreadCrumbs :items="links" />

  <PaymentBatchFilters
    :campus="campus"
    :generation-id="generationId"
    :period-year="periodYear"
    :period-month="periodMonth"
    :generations="generations"
    :campus-options="filteredCampus"
    @update:campus="campus = $event"
    @update:generation-id="generationId = $event"
    @update:period-year="periodYear = $event"
    @update:period-month="periodMonth = $event"
  />

  <v-row v-if="loadingBatch">
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
        text="No se pudo cargar el lote de pagos. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="summary">
    <PaymentBatchSummary :summary="summary" />

    <v-row v-if="hasProcessPermission" justify="end">
      <v-col cols="auto">
        <v-btn color="primary" :disabled="!canProcess" @click="dialogOpen = true">Pagar todos</v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <PaymentBatchTable :rows="rows" />
      </v-col>
    </v-row>
  </template>

  <ProcessPaymentDialog
    v-model="dialogOpen"
    :count="summary?.total ?? 0"
    :total-amount="summary?.total_amount ?? '0.00'"
    :processing="processing"
    @confirm="onConfirm"
  />
</template>

<script setup lang="ts">
// Pagos list page (PR5, sdd/becario-payment-file-generation). Assembles
// filters + summary + table + confirm dialog via usePaymentsPage (D7 — this
// view/composable owns filter state; PaymentBatchTable itself is purely
// presentational).
import { ref } from 'vue'
import { usePaymentsPage } from '@/composables/usePaymentsPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import PaymentBatchFilters from '@/components/pagos/PaymentBatchFilters.vue'
import PaymentBatchSummary from '@/components/pagos/PaymentBatchSummary.vue'
import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'
import ProcessPaymentDialog from '@/components/pagos/ProcessPaymentDialog.vue'
import type { LinkInterface } from '@/interfaces/link'

const {
  campus,
  generationId,
  periodYear,
  periodMonth,
  generations,
  filteredCampus,
  rows,
  summary,
  loadingBatch,
  loadError,
  canProcess,
  processing,
  hasProcessPermission,
  confirmProcess,
} = usePaymentsPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Pagos', disabled: true, href: '/pagos' },
]

const dialogOpen = ref(false)

const onConfirm = async (): Promise<void> => {
  await confirmProcess()
  dialogOpen.value = false
}
</script>
