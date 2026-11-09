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

    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="bbva" data-testid="tab-bbva" :disabled="bbvaTabDisabled">
        Transferencia BBVA ({{ rows.length }})
      </v-tab>
      <v-tab value="manual-transfer" data-testid="tab-manual-transfer" :disabled="manualTransferRows.length === 0">
        Transferencias a otros bancos ({{ manualTransferRows.length }})
      </v-tab>
      <v-tab value="cheques" data-testid="tab-cheques" :disabled="chequeRows.length === 0">
        Cheques ({{ chequeRows.length }})
      </v-tab>
    </v-tabs>

    <!-- eager: every pane stays mounted so switching tabs never loses a section's local state. -->
    <v-window v-model="activeTab" :touch="false">
      <v-window-item value="bbva" eager data-testid="tab-pane-bbva">
        <template v-if="!hasNoBatchRows">
          <h2 data-testid="transfers-heading" class="text-h6 d-flex align-center ga-2 mb-4">
            <v-icon icon="mdi-bank-transfer" />
            Transferencias
          </h2>

          <!-- Transfers only: payable cheques must stay visible to be marked as paid. -->
          <v-row v-if="rows.length > 0">
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

          <PaymentBatchSummary :summary="summary" />

          <v-row v-if="hasProcessPermission" justify="end">
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

          <v-row>
            <v-col cols="12">
              <PaymentBatchTable
                :rows="visibleRows"
                :group-source-rows="rows"
                :is-paid="isPaid"
                :empty-text="emptyTextFor(rows.length)"
                @view="onViewDocument"
              />
            </v-col>
          </v-row>
        </template>
      </v-window-item>

      <v-window-item value="manual-transfer" eager data-testid="tab-pane-manual-transfer">
        <ManualTransferPaymentSection
          :rows="manualTransferRows"
          :summary="manualTransferSummary"
          :can-manage="hasProcessPermission"
          @view="onViewDocument"
          @mark="onMarkManualTransfer"
          @revert="onRevertManualTransfer"
        />
      </v-window-item>

      <v-window-item value="cheques" eager data-testid="tab-pane-cheques">
        <ChequePaymentSection
          :rows="chequeRows"
          :summary="chequeSummary"
          :can-manage="hasProcessPermission"
          @view="onViewDocument"
          @mark="onMarkCheque"
          @revert="onRevertCheque"
        />
      </v-window-item>
    </v-window>
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

  <ManualTransferPaymentDialog
    v-model="manualMarkDialogOpen"
    :row="manualTarget"
    :saving="savingManualTransfer"
    :server-errors="manualMarkServerErrors"
    @submit="onSubmitManualMark"
  />

  <RevertChequePaymentDialog
    v-model="manualRevertDialogOpen"
    kind="manual_transfer"
    :row="manualTarget"
    :saving="savingManualTransfer"
    @submit="onSubmitManualRevert"
  />
</template>

<script setup lang="ts">
// Pagos list page (PR5, sdd/becario-payment-file-generation). Assembles
// filters + summary + table + confirm dialog via usePaymentsPage (D7 — this
// view/composable owns filter state; PaymentBatchTable itself is purely
// presentational).
import { computed, ref, watch } from 'vue'
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
import ManualTransferPaymentSection from '@/components/pagos/ManualTransferPaymentSection.vue'
import ManualTransferPaymentDialog from '@/components/pagos/ManualTransferPaymentDialog.vue'
import type { ChequeActionResult, ManualTransferActionResult } from '@/stores/api/paymentsStore'
import type {
  ChequeRow,
  ManualTransferRow,
  MarkChequePayload,
  MarkManualTransferPayload,
} from '@/interfaces/payment'
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
  manualTransferRows,
  manualTransferSummary,
  savingManualTransfer,
  markManualTransfer,
  revertManualTransfer,
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

// pago-cheque: the server already limits `rows`/`summary` to BBVA transfer
// becarios, so a batch with only cheques (or only other-bank transfers,
// sdd/catalogo-bancos) has an empty batch side. In that case the batch
// widgets (summary cards, "Pagar todos", filter, table) are replaced by an
// explanatory note; the manual sections are the whole page.
const hasNoBatchRows = computed<boolean>(
  () => (summary.value?.total ?? 0) === 0 && (chequeRows.value.length > 0 || manualTransferRows.value.length > 0),
)
// The explanatory note is gone: the BBVA tab is simply disabled in that case.
// When the whole batch is empty it stays enabled so the (empty) table shows.
const bbvaTabDisabled = computed<boolean>(() => hasNoBatchRows.value)

type PaymentTab = 'bbva' | 'manual-transfer' | 'cheques'
const activeTab = ref<PaymentTab>('bbva')

// Default tab = first tab with rows. Re-evaluated whenever the per-tab counts
// change (filters / batch reload), but a tab the user chose is kept as long as
// it still has rows.
const TAB_ORDER: PaymentTab[] = ['bbva', 'manual-transfer', 'cheques']
const tabHasRows = (tab: PaymentTab): boolean => {
  if (tab === 'bbva') return rows.value.length > 0
  if (tab === 'manual-transfer') return manualTransferRows.value.length > 0
  return chequeRows.value.length > 0
}
watch(
  () => [rows.value.length, manualTransferRows.value.length, chequeRows.value.length],
  () => {
    if (tabHasRows(activeTab.value)) return
    activeTab.value = TAB_ORDER.find(tabHasRows) ?? 'bbva'
  },
  { immediate: true },
)

// The transfer table emptied by the "Solo pendientes de revisar" filter says
// so; a table that is genuinely empty (no rows at all, or filter off) keeps
// the default message.
const PENDING_EMPTY_TEXT = 'No hay becarios pendientes de revisar.'
const emptyTextFor = (totalRows: number): string | undefined =>
  showOnlyPending.value && totalRows > 0 ? PENDING_EMPTY_TEXT : undefined

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

// Other-bank transfer dialogs (sdd/catalogo-bancos R7): same close policy as
// the cheque ones, with their own target/state so both flows stay independent.
const MANUAL_CLOSING_STATUSES: ReadonlySet<ManualTransferActionResult['status']> = new Set([
  'success',
  'already_paid',
  'not_manual_transfer',
  'cycle_closed',
  'telmex_repayment_exists',
])

const manualTarget = ref<ManualTransferRow | null>(null)
const manualMarkDialogOpen = ref(false)
const manualRevertDialogOpen = ref(false)
const manualMarkServerErrors = ref<Record<string, string[]>>({})

const onMarkManualTransfer = (row: ManualTransferRow): void => {
  manualTarget.value = row
  manualMarkServerErrors.value = {}
  manualMarkDialogOpen.value = true
}

const onRevertManualTransfer = (row: ManualTransferRow): void => {
  manualTarget.value = row
  manualRevertDialogOpen.value = true
}

const onSubmitManualMark = async (payload: MarkManualTransferPayload): Promise<void> => {
  if (!manualTarget.value) return
  manualMarkServerErrors.value = {}
  const result = await markManualTransfer(manualTarget.value.refrend_id, payload)
  if (MANUAL_CLOSING_STATUSES.has(result.status)) {
    manualMarkDialogOpen.value = false
  } else if (result.status === 'validation') {
    manualMarkServerErrors.value = result.errors
  } else if (result.status === 'transfer_reference_taken' && result.msg) {
    manualMarkServerErrors.value = { transfer_reference: [result.msg] }
  }
}

const onSubmitManualRevert = async (reason: string): Promise<void> => {
  if (!manualTarget.value) return
  const result = await revertManualTransfer(manualTarget.value.refrend_id, reason)
  if (MANUAL_CLOSING_STATUSES.has(result.status)) manualRevertDialogOpen.value = false
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

// The summary cards stay visible after payment; PaymentBatchSummary shows a
// caption when the API reports the money keys are PAID amounts.
</script>
