<template>
  <v-card v-if="rows.length > 0" data-testid="cheque-section" class="mb-4">
    <v-card-title>Cheques</v-card-title>
    <v-card-subtitle v-if="summary" data-testid="cheque-summary">
      {{ summary.total }} becarios · {{ summary.ready }} por emitir · {{ summary.paid }} pagados
    </v-card-subtitle>
    <v-card-text v-if="summary" class="d-flex flex-wrap ga-6 pb-0">
      <span>Por emitir: <strong>{{ formatAmount(summary.ready_amount) }}</strong></span>
      <span>Pagado: <strong>{{ formatAmount(summary.paid_amount) }}</strong></span>
    </v-card-text>

    <v-data-table
      :headers="headers"
      :items="rows"
      item-value="refrend_id"
      density="compact"
      disable-sort
      :items-per-page="-1"
    >
      <template #[`item.beneficiary`]="{ item }">
        {{ item.cheque_beneficiary || 'Becario' }}
      </template>

      <template #[`item.total_to_pay`]="{ item }">{{ formatAmount(item.total_to_pay) }}</template>

      <template #[`item.status`]="{ item }">
        <v-chip v-if="isPaid(item)" color="success" size="small" variant="tonal">Pagado (cheque)</v-chip>
        <v-chip v-else-if="item.is_payable" color="info" size="small" variant="tonal">Por emitir</v-chip>
        <template v-else>
          <v-chip color="error" size="small" variant="tonal">Bloqueado</v-chip>
          <div v-if="item.blocking_reasons.length > 0" class="text-caption text-error">
            {{ item.blocking_reasons.map((reason) => reason.message).join(', ') }}
          </div>
        </template>
      </template>

      <template #[`item.cheque`]="{ item }">
        <v-tooltip v-if="isPaid(item) && item.cheque_notes" :text="item.cheque_notes">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" data-testid="cheque-info">
              {{ item.cheque_number }} · {{ formatChequeDate(item.cheque_delivered_at) }}
            </span>
          </template>
        </v-tooltip>
        <span v-else-if="isPaid(item)" data-testid="cheque-info">
          {{ item.cheque_number }} · {{ formatChequeDate(item.cheque_delivered_at) }}
        </span>
        <span v-else>—</span>
      </template>

      <template #[`item.actions`]="{ item }">
        <template v-if="canManage">
          <v-btn
            v-if="isPaid(item)"
            size="small"
            variant="text"
            color="error"
            :aria-label="`Revertir pago con cheque de ${item.snapshot_name}`"
            @click="emit('revert', item)"
          >
            Revertir
          </v-btn>
          <v-btn
            v-else-if="item.is_payable"
            size="small"
            variant="text"
            color="primary"
            :aria-label="`Marcar como pagado con cheque a ${item.snapshot_name}`"
            @click="emit('mark', item)"
          >
            Marcar como pagado
          </v-btn>
        </template>
      </template>

      <template #bottom></template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
// Purely presentational (pago-cheque PR7): rows/summary as props, intents
// emitted upward. PaymentsView owns the dialogs and calls the composable.
// Actions require the processPayments permission (`canManage`), same gate
// as "Pagar todos". A row counts as paid by cheque only when the server
// status is PAID (cheque_rows never contain transfer-paid rows).
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import { formatChequeDate } from '@/utils/chequeFormat'
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
  (e: 'mark', row: ChequeRow): void
  (e: 'revert', row: ChequeRow): void
}

const emit = defineEmits<Emits>()

const isPaid = (row: ChequeRow): boolean => row.status === 'PAID'

const headers = [
  { title: 'Nombre', key: 'snapshot_name' },
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'A nombre de', key: 'beneficiary' },
  { title: 'Total a pagar', key: 'total_to_pay', align: 'end' as const },
  { title: 'Estado', key: 'status' },
  { title: 'Cheque', key: 'cheque' },
  { title: 'Acciones', key: 'actions', align: 'end' as const },
]
</script>
