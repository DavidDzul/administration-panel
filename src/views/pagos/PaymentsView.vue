<template>
  <BreadCrumbs :items="links" />

  <PaymentBatchFilters
    :campus="campus"
    :period-year="periodYear"
    :period-month="periodMonth"
    :batch-type="batchType"
    :campus-options="filteredCampus"
    @update:campus="campus = $event"
    @update:period-year="periodYear = $event"
    @update:period-month="periodMonth = $event"
    @update:batch-type="batchType = $event"
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
    <v-row>
      <v-col cols="12">
        <v-chip data-testid="batch-type-chip" color="primary" variant="tonal" size="small">
          {{ batchTypeLabel }}
        </v-chip>
      </v-col>
    </v-row>

    <v-row v-if="onlyCheques">
      <v-col cols="12">
        <v-alert type="info" variant="tonal" density="compact" data-testid="only-cheques-alert">
          No hay becarios con pago por transferencia en este lote.
        </v-alert>
      </v-col>
    </v-row>

    <h2 v-if="!onlyCheques" data-testid="transfers-heading" class="text-h6 d-flex align-center ga-2 mb-4">
      <v-icon icon="mdi-bank-transfer" />
      Transferencias
    </h2>

    <PaymentBatchSummary v-if="!isPaid && !onlyCheques" :summary="summary" />

    <v-row v-if="hasProcessPermission && !onlyCheques" justify="end">
      <v-col cols="auto">
        <v-btn color="primary" :disabled="!canProcess" @click="dialogOpen = true">Pagar todos</v-btn>
      </v-col>
    </v-row>

    <v-row v-if="processResult?.status === 'already_processed'">
      <v-col cols="12">
        <v-alert type="error" variant="tonal" density="compact" title="No se pudo procesar el pago">
          Este lote ya fue procesado anteriormente.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else-if="processResult?.status === 'stale'">
      <v-col cols="12">
        <v-alert type="error" variant="tonal" density="compact" title="No se pudo procesar el pago">
          El lote cambió desde que se cargó la pantalla. Vuelve a cargarla.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-else-if="processResult?.status === 'error'">
      <v-col cols="12">
        <v-alert
          type="error"
          variant="tonal"
          density="compact"
          title="Error al procesar el pago"
          text="No se pudo procesar el lote de pagos. Intenta de nuevo más tarde."
        ></v-alert>
      </v-col>
    </v-row>

    <BankFileExportCard
      v-if="isPaid && hasExportPermission"
      :export-summary="exportSummary"
      :loading-export="loadingExport"
      :export-error="exportError"
      :invalid-rows="invalidBankRows"
      @download="confirmExport"
    />

    <v-row v-if="!onlyCheques">
      <v-col cols="12" sm="6" md="4">
        <v-switch
          v-model="showOnlyPending"
          label="Solo pendientes de revisar"
          color="primary"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>

    <v-row v-if="!onlyCheques">
      <v-col cols="12">
        <PaymentBatchTable
          :rows="visibleRows"
          :group-source-rows="rows"
          :is-paid="isPaid"
          @view="onViewDocument"
        />
      </v-col>
    </v-row>

    <v-divider v-if="!onlyCheques && chequeRows.length > 0" data-testid="section-divider" class="mt-10 mb-8" />

    <ChequePaymentSection
      :rows="chequeRows"
      :summary="chequeSummary"
      :can-manage="hasProcessPermission"
      @view="onViewDocument"
      @mark="onMarkCheque"
      @revert="onRevertCheque"
    />
  </template>

  <ProcessPaymentDialog
    v-model="dialogOpen"
    :count="summary?.total ?? 0"
    :total-amount="summary?.total_amount ?? '0.00'"
    :processing="processing"
    @confirm="onConfirm"
  />

  <PaymentDocumentDialog v-model="documentDialogOpen" :refrend-id="viewingRefrendId" />

  <ChequePaymentDialog
    v-model="markDialogOpen"
    :row="chequeTarget"
    :saving="savingCheque"
    :server-errors="markServerErrors"
    @submit="onSubmitMark"
  />

  <RevertChequePaymentDialog
    v-model="revertDialogOpen"
    :row="chequeTarget"
    :saving="savingCheque"
    @submit="onSubmitRevert"
  />
</template>

<script setup lang="ts">
// Pagos list page (PR5, sdd/becario-payment-file-generation). Assembles
// filters + summary + table + confirm dialog via usePaymentsPage (D7 — this
// view/composable owns filter state; PaymentBatchTable itself is purely
// presentational).
import { computed, ref } from 'vue'
import { usePaymentsPage } from '@/composables/usePaymentsPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import PaymentBatchFilters from '@/components/pagos/PaymentBatchFilters.vue'
import PaymentBatchSummary from '@/components/pagos/PaymentBatchSummary.vue'
import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'
import ProcessPaymentDialog from '@/components/pagos/ProcessPaymentDialog.vue'
import PaymentDocumentDialog from '@/components/pagos/PaymentDocumentDialog.vue'
import BankFileExportCard from '@/components/pagos/BankFileExportCard.vue'
import ChequePaymentSection from '@/components/pagos/ChequePaymentSection.vue'
import ChequePaymentDialog from '@/components/pagos/ChequePaymentDialog.vue'
import RevertChequePaymentDialog from '@/components/pagos/RevertChequePaymentDialog.vue'
import type { ChequeActionResult } from '@/stores/api/paymentsStore'
import type { ChequeRow, MarkChequePayload } from '@/interfaces/payment'
import type { LinkInterface } from '@/interfaces/link'
import { batchTypeMap } from '@/constants'

const {
  campus,
  periodYear,
  periodMonth,
  batchType,
  filteredCampus,
  rows,
  visibleRows,
  showOnlyPending,
  summary,
  chequeRows,
  chequeSummary,
  savingCheque,
  markCheque,
  revertCheque,
  loadingBatch,
  loadError,
  canProcess,
  processing,
  processResult,
  hasProcessPermission,
  confirmProcess,
  isPaid,
  exportSummary,
  loadingExport,
  exportError,
  invalidBankRows,
  confirmExport,
  hasExportPermission,
} = usePaymentsPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Pagos', disabled: true, href: '/pagos' },
]

const dialogOpen = ref(false)

// Purely a local display label (sdd/pagos-lote-pago-adelantado) — derived
// from the already-selected filter, never from a server echo, since the
// filter itself is the single source of truth for which type is loaded.
const batchTypeLabel = computed(() => (batchType.value ? (batchTypeMap.get(batchType.value)?.text ?? '') : ''))

const onConfirm = async (): Promise<void> => {
  await confirmProcess()
  dialogOpen.value = false
}

// PaymentBatchTable's "Ver" now opens this dialog instead of navigating to
// `/pagos/:refrendId` (sdd/becario-payment-batch-indicators) — PaymentsView
// owns the open state + selected refrendId, same pattern already used for
// ProcessPaymentDialog's `dialogOpen`.
const documentDialogOpen = ref(false)
const viewingRefrendId = ref<number | null>(null)

const onViewDocument = (refrendId: number): void => {
  viewingRefrendId.value = refrendId
  documentDialogOpen.value = true
}

// pago-cheque: the server already limits `rows`/`summary` to transfer
// becarios, so a batch with cheques only has an empty transfer side. In that
// case the transfer widgets (summary cards, "Pagar todos", filter, table)
// are replaced by an explanatory note; the cheque section is the whole page.
const onlyCheques = computed<boolean>(() => (summary.value?.total ?? 0) === 0 && chequeRows.value.length > 0)

// Cheque dialogs. Both close on every outcome where the composable reloaded
// the batch (the row may no longer be in the state the dialog assumed) and
// stay open — with inline errors for the register dialog — on pure input
// problems so the admin can correct and retry.
const CLOSING_STATUSES: ReadonlySet<ChequeActionResult['status']> = new Set([
  'success',
  'already_paid',
  'not_cheque',
  'cycle_closed',
  'telmex_repayment_exists',
])

const chequeTarget = ref<ChequeRow | null>(null)
const markDialogOpen = ref(false)
const revertDialogOpen = ref(false)
const markServerErrors = ref<Record<string, string[]>>({})

const onMarkCheque = (row: ChequeRow): void => {
  chequeTarget.value = row
  markServerErrors.value = {}
  markDialogOpen.value = true
}

const onRevertCheque = (row: ChequeRow): void => {
  chequeTarget.value = row
  revertDialogOpen.value = true
}

const onSubmitMark = async (payload: MarkChequePayload): Promise<void> => {
  if (!chequeTarget.value) return
  markServerErrors.value = {}
  const result = await markCheque(chequeTarget.value.refrend_id, payload)
  if (CLOSING_STATUSES.has(result.status)) {
    markDialogOpen.value = false
  } else if (result.status === 'validation') {
    markServerErrors.value = result.errors
  } else if (result.status === 'cheque_number_taken' && result.msg) {
    markServerErrors.value = { cheque_number: [result.msg] }
  }
}

const onSubmitRevert = async (reason: string): Promise<void> => {
  if (!chequeTarget.value) return
  const result = await revertCheque(chequeTarget.value.refrend_id, reason)
  if (CLOSING_STATUSES.has(result.status)) revertDialogOpen.value = false
}

// "Solo pendientes de revisar" (sdd/becario-payment-review-filter) is a
// purely client-side row filter over the already-loaded batch — no refetch.
// The table receives `visibleRows`, never raw `rows`, but `summary`/
// `canProcess` above stay wired to the composable's full-batch values, so
// this toggle can never hide a still-blocking row from the "Pagar todos"
// gate. Same reasoning extends to the generación group headers
// (sdd/lotes-pago-generacion-desglose): `group-source-rows` below is always
// the FULL `rows`, never `visibleRows`, so toggling this filter can never
// change a group header's count/sum — only which rows render under it.

// Once the batch is paid, the ready/blocking/total-amount cards no longer
// mean anything actionable — user-requested cleanup. The table, "Pagar
// todos" (now disabled), and the export card stay, since those still
// matter after payment.
</script>
