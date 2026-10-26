<template>
  <section v-if="rows.length > 0" data-testid="cheque-section">
    <h2 data-testid="cheque-heading" class="text-h6 d-flex align-center ga-2 mb-4">
      <v-icon icon="mdi-checkbook" />
      Cheques
    </h2>

    <ChequePaymentSummary :summary="summary" />

    <PaymentBatchTable
      mode="cheque"
      :rows="rows"
      :group-source-rows="rows"
      :can-manage="canManage"
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
import ChequePaymentSummary from '@/components/pagos/ChequePaymentSummary.vue'
import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'
import type { ChequeRow, ChequeSummary } from '@/interfaces/payment'

interface Props {
  rows?: ChequeRow[]
  summary?: ChequeSummary | null
  canManage?: boolean
}

withDefaults(defineProps<Props>(), {
  rows: () => [],
  summary: null,
  canManage: false,
})

interface Emits {
  (e: 'view', refrendId: number): void
  (e: 'mark', row: ChequeRow): void
  (e: 'revert', row: ChequeRow): void
}

const emit = defineEmits<Emits>()
</script>
