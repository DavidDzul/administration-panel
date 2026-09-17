<template>
  <v-data-table :headers="headers" :items="rows" :loading="loading" item-value="refrend_id" class="elevation-1">
    <template #[`item.total_to_pay`]="{ item }"> ${{ item.total_to_pay }} </template>

    <template #[`item.account_number`]="{ item }">
      {{ maskAccountNumber(item.account_number) }}
    </template>

    <template #[`item.flags`]="{ item }">
      <v-chip
        v-if="item.has_incident"
        size="small"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-alert-circle-outline"
        class="mr-1 mb-1"
      >
        Incidencia registrada
      </v-chip>
      <v-chip
        v-if="item.has_pending_from_previous"
        size="small"
        color="info"
        variant="tonal"
        prepend-icon="mdi-cash-clock"
        class="mb-1"
      >
        {{ item.only_pending_from_previous ? 'Solo mes retenido' : 'Incluye mes retenido' }}
      </v-chip>
      <v-tooltip v-if="resolutionMeta(item.resolution_type)" :text="resolutionAriaLabel(item)">
        <template #activator="{ props: tooltipProps }">
          <v-chip
            v-bind="tooltipProps"
            data-testid="resolution-chip"
            :aria-label="resolutionAriaLabel(item)"
            size="small"
            :color="resolutionMeta(item.resolution_type)?.color"
            variant="tonal"
            :prepend-icon="resolutionMeta(item.resolution_type)?.icon"
            class="mb-1"
          >
            {{ resolutionMeta(item.resolution_type)?.label }}
          </v-chip>
        </template>
      </v-tooltip>
    </template>

    <template #[`item.status`]="{ item }">
      <v-chip :color="item.is_payable ? 'success' : 'error'" size="small" variant="tonal">
        {{ item.is_payable ? 'Listo' : 'Bloqueado' }}
      </v-chip>
    </template>

    <template #[`item.reason`]="{ item }">
      <span v-if="!item.is_payable" class="text-caption" :class="isOnlyAlreadyPaid(item) ? 'text-medium-emphasis' : 'text-error'">
        {{ item.blocking_reasons.map((reason) => reason.message).join(', ') }}
      </span>
      <span v-else>—</span>
    </template>

    <template #[`item.actions`]="{ item }">
      <v-btn variant="text" color="warning" density="comfortable" size="small" @click="onView(item.refrend_id)">
        Ver
      </v-btn>
    </template>

    <template #no-data>No hay becarios en este lote</template>
  </v-data-table>
</template>

<script setup lang="ts">
// Purely presentational (D7) — receives rows as props, no internal
// fetching. Filter state + refetch live in usePaymentsPage/PaymentsView.
// "Ver" emits an intent upward instead of navigating (sdd/becario-payment-
// batch-indicators): the document moved from a routed page to a dialog, and
// PaymentsView owns the dialog's open/refrendId state, same as it already
// owns ProcessPaymentDialog's `dialogOpen`. `has_incident` /
// `has_pending_from_previous` and the masked account number are quick-glance
// additions for a reviewer going through a whole batch (impulsou-api commit
// eba5c3d) — purely informational, they never affect `is_payable`.
// `Motivo` is its own column (sdd/becario-payment-review-filter) so `Estado`
// only ever renders the chip — a mixed-length caption under the chip made
// row height uneven across a whole batch. Payable rows show "—" instead of
// repeating "Listo" (that's already communicated by the adjacent chip).
import { maskAccountNumber } from '@/utils/maskAccountNumber'
import { resolutionMeta } from '@/utils/resolutionMeta'
import type { PaymentBatchRow } from '@/interfaces/payment'

interface Props {
  rows?: PaymentBatchRow[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  rows: () => [],
  loading: false,
})

interface Emits {
  (e: 'view', refrendId: number): void
}

const emit = defineEmits<Emits>()

const headers = [
  { title: 'Nombre', key: 'snapshot_name' },
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'Cuenta', key: 'account_number' },
  { title: 'Monto', key: 'total_to_pay' },
  { title: '', key: 'flags' },
  { title: 'Estado', key: 'status' },
  { title: 'Motivo', key: 'reason' },
  { title: '', key: 'actions' },
]

const onView = (refrendId: number): void => {
  emit('view', refrendId)
}

// Chip shows icon + label text directly (user override of design D4's
// icon-only choice — hover-only text wasn't discoverable enough). The
// tooltip/aria-label still carries the resolution_cause detail: label alone,
// or "{label} · Motivo: {resolution_cause}" when a cause is present.
// resolution_cause is a raw backend code (no CAUSE_LABELS equivalent here —
// deliberately out of scope, see design's Open Questions).
const resolutionAriaLabel = (row: PaymentBatchRow): string => {
  const meta = resolutionMeta(row.resolution_type)
  if (!meta) return ''
  return row.resolution_cause ? `${meta.label} · Motivo: ${row.resolution_cause}` : meta.label
}

// ALREADY_PAID is not an error to flag in red — it just means the payment
// already happened. Only style "Motivo" as an error when a *real* blocking
// reason is present, alone or alongside ALREADY_PAID.
const isOnlyAlreadyPaid = (row: PaymentBatchRow): boolean =>
  row.blocking_reasons.length === 1 && row.blocking_reasons[0].code === 'ALREADY_PAID'
</script>
