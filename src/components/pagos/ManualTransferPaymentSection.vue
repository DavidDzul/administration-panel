<template>
  <section v-if="hasAnyRows" data-testid="manual-transfer-section">
    <h2 data-testid="manual-transfer-heading" class="text-h6 d-flex align-center ga-2 mb-4">
      <v-icon icon="mdi-bank-transfer-out" />
      Transferencias a otros bancos
    </h2>

    <ChequePaymentSummary :summary="summary" kind="manual_transfer" />

    <PaymentBatchTable
      mode="manual_transfer"
      :rows="rows"
      :group-source-rows="fullRows"
      :can-manage="canManage"
      :empty-text="emptyText"
      @view="emit('view', $event)"
      @mark="emit('mark', $event)"
      @revert="emit('revert', $event)"
    />
  </section>
</template>

<script setup lang="ts">
// Purely presentational (sdd/catalogo-bancos R7), mirror of
// ChequePaymentSection: heading + summary cards + the shared
// PaymentBatchTable in manual_transfer mode. PaymentsView owns the dialogs
// and calls the composable. Actions require the processPayments permission
// (`canManage`), same gate as "Pagar todos".
import { computed } from 'vue'
import ChequePaymentSummary from '@/components/pagos/ChequePaymentSummary.vue'
import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'
import type { ManualTransferRow, ManualTransferSummary } from '@/interfaces/payment'

interface Props {
  // Rows to render (may be the "Solo pendientes de revisar" subset).
  rows?: ManualTransferRow[]
  // Full, unfiltered rows: keeps the section mounted when the filter hides
  // everything and feeds the generación group headers.
  groupSourceRows?: ManualTransferRow[]
  summary?: ManualTransferSummary | null
  canManage?: boolean
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  rows: () => [],
  groupSourceRows: () => [],
  summary: null,
  canManage: false,
  emptyText: 'No hay becarios en este lote',
})

const fullRows = computed<ManualTransferRow[]>(() =>
  props.groupSourceRows.length > 0 ? props.groupSourceRows : props.rows,
)
const hasAnyRows = computed<boolean>(() => fullRows.value.length > 0)

interface Emits {
  (e: 'view', refrendId: number): void
  (e: 'mark', row: ManualTransferRow): void
  (e: 'revert', row: ManualTransferRow): void
}

const emit = defineEmits<Emits>()
</script>
