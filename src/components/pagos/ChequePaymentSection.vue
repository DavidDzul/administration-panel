<template>
  <section v-if="hasAnyRows" data-testid="cheque-section">
    <h2 data-testid="cheque-heading" class="text-h6 d-flex align-center ga-2 mb-4">
      <v-icon icon="mdi-checkbook" />
      Cheques
    </h2>

    <ChequePaymentSummary :summary="summary" />

    <PaymentBatchTable
      mode="cheque"
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
// Purely presentational wrapper (pago-cheque): heading + summary cards + the
// shared PaymentBatchTable in cheque mode. PaymentsView owns the dialogs and
// calls the composable. Actions require the processPayments permission
// (`canManage`), same gate as "Pagar todos".
import { computed } from 'vue'
import ChequePaymentSummary from '@/components/pagos/ChequePaymentSummary.vue'
import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'
import type { ChequeRow, ChequeSummary } from '@/interfaces/payment'

interface Props {
  // Rows to render (may be the "Solo pendientes de revisar" subset).
  rows?: ChequeRow[]
  // Full, unfiltered cheque rows: keeps the section mounted when the filter
  // hides everything, and feeds the generación group headers. Falls back to
  // `rows` for callers that don't filter.
  groupSourceRows?: ChequeRow[]
  summary?: ChequeSummary | null
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

const fullRows = computed<ChequeRow[]>(() =>
  props.groupSourceRows.length > 0 ? props.groupSourceRows : props.rows,
)
const hasAnyRows = computed<boolean>(() => fullRows.value.length > 0)

interface Emits {
  (e: 'view', refrendId: number): void
  (e: 'mark', row: ChequeRow): void
  (e: 'revert', row: ChequeRow): void
}

const emit = defineEmits<Emits>()
</script>
