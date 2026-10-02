<template>
  <v-data-table :headers="headers" :items="rows" :loading="loading" item-value="refrend_id" class="elevation-1">
    <template #[`item.total_to_pay`]="{ item }"> ${{ item.total_to_pay }} </template>

    <template #[`item.account_number`]="{ item }">
      {{ maskAccountNumber(item.account_number) }}
    </template>

    <template #[`item.flags`]="{ item }">
      <div class="py-2">
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
        <v-tooltip v-if="advancePaymentChip(item)" :text="advancePaymentChip(item)?.ariaLabel">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="advance-paid-chip"
              :aria-label="advancePaymentChip(item)?.ariaLabel"
              size="small"
              :color="advancePaymentChip(item)?.color"
              variant="tonal"
              :prepend-icon="advancePaymentChip(item)?.icon"
              class="mb-1"
            >
              {{ advancePaymentChip(item)?.label }}
            </v-chip>
          </template>
        </v-tooltip>
        <v-tooltip
          v-if="advancePaymentRegisteredChip(item)"
          :text="advancePaymentRegisteredChip(item)?.ariaLabel"
        >
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="advance-payment-registered-chip"
              :aria-label="advancePaymentRegisteredChip(item)?.ariaLabel"
              size="small"
              :color="advancePaymentRegisteredChip(item)?.color"
              variant="tonal"
              :prepend-icon="advancePaymentRegisteredChip(item)?.icon"
              class="mb-1"
            >
              {{ advancePaymentRegisteredChip(item)?.label }}
            </v-chip>
          </template>
        </v-tooltip>
        <v-tooltip
          v-if="advancePaymentDivergenceChip(item)"
          :text="advancePaymentDivergenceChip(item)?.ariaLabel"
        >
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="advance-payment-divergence-chip"
              :aria-label="advancePaymentDivergenceChip(item)?.ariaLabel"
              size="small"
              :color="advancePaymentDivergenceChip(item)?.color"
              variant="tonal"
              :prepend-icon="advancePaymentDivergenceChip(item)?.icon"
              class="mb-1"
            >
              {{ advancePaymentDivergenceChip(item)?.label }}
            </v-chip>
          </template>
        </v-tooltip>
        <v-tooltip v-if="telmexExportExclusionChip(item)" :text="telmexExportExclusionChip(item)?.ariaLabel">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="telmex-exclusion-chip"
              :aria-label="telmexExportExclusionChip(item)?.ariaLabel"
              size="small"
              :color="telmexExportExclusionChip(item)?.color"
              variant="tonal"
              :prepend-icon="telmexExportExclusionChip(item)?.icon"
              class="mb-1"
            >
              {{ telmexExportExclusionChip(item)?.label }}
            </v-chip>
          </template>
        </v-tooltip>
        <v-tooltip v-if="temporaryIncreaseChip(item)" :text="temporaryIncreaseChip(item)?.ariaLabel">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="temporary-increase-chip"
              :aria-label="temporaryIncreaseChip(item)?.ariaLabel"
              size="small"
              :color="temporaryIncreaseChip(item)?.color"
              variant="tonal"
              :prepend-icon="temporaryIncreaseChip(item)?.icon"
              class="mb-1"
            >
              {{ temporaryIncreaseChip(item)?.label }}
            </v-chip>
          </template>
        </v-tooltip>
      </div>
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
// The advance-paid chip (sdd/pago-adelantado PR7b) lives in the same `flags`
// column, same non-interactive tonal-chip pattern as the resolution chip —
// purely informational, it never affects `is_payable`/`blocking_reasons`
// (design's explicit invariant). The advance-payment-registered chip
// (sdd/pago-adelantado PR8) is the OPPOSITE indicator: it marks the ORIGIN
// refrend a batch was recorded FROM, rather than a settled future month — see
// advancePaymentMeta.ts's header comment for the full distinction. Both chips
// can render on the same row simultaneously and must never displace each
// other. The telmex-exclusion chip (sdd/scholarship-telmex-iu-split, design
// D9) is the newest addition — same non-interactive tonal-chip pattern,
// server-computed via `excluded_from_bank_file`, and it too must never
// displace or be displaced by any other chip in this column. The
// temporary-increase chip (sdd/temporary-increase-visibility, design D6/D8)
// is the newest addition — same non-interactive tonal-chip pattern, sourced
// ONLY from `snapshot_temporary_increase_amount`/`_reason` (never
// `has_incident` or any incident-related field), and it too must never
// displace or be displaced by any other chip in this column.
import { maskAccountNumber } from '@/utils/maskAccountNumber'
import { resolutionMeta } from '@/utils/resolutionMeta'
import {
  advancePaymentChip,
  advancePaymentDivergenceChip,
  advancePaymentRegisteredChip,
} from '@/utils/advancePaymentMeta'
import { telmexExportExclusionChip } from '@/utils/telmexExportMeta'
import { temporaryIncreaseChip } from '@/utils/temporaryIncreaseMeta'
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
