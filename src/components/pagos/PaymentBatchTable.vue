<template>
  <v-data-table
    :headers="headers"
    :items="groupedItems"
    :group-by="groupBy"
    open-all
    disable-sort
    density="compact"
    fixed-header
    height="70vh"
    :items-per-page="-1"
    :loading="loading"
    item-value="refrend_id"
    class="elevation-1"
  >
    <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
      <tr data-testid="payment-group-header" class="payment-group-header-row">
        <td :colspan="columns.length">
          <v-btn
            size="small"
            variant="text"
            density="comfortable"
            :icon="isGroupOpen(item) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            :aria-label="isGroupOpen(item) ? 'Contraer' : 'Expandir'"
            @click="toggleGroup(item)"
          />
          <span class="font-weight-medium">{{ groupHeaderText(item.value as string) }}</span>
        </td>
      </tr>
    </template>

    <template #[`item.snapshot_name`]="{ item }">
      <button
        type="button"
        class="payment-name-link"
        :aria-label="`Ver documento de pago de ${item.snapshot_name}`"
        @click="onView(item.refrend_id)"
      >
        {{ item.snapshot_name }}
      </button>
    </template>

    <template #[`item.monthly_amount`]="{ item }">
      <span data-testid="cell-monthly-amount">{{ monthlyAmount(item) }}</span>
    </template>

    <template #[`item.support_amount`]="{ item }">
      <span data-testid="cell-support-amount">{{ amountOrDash(item.snapshot_monto_apoyo) }}</span>
    </template>

    <template #[`item.iu_payment_amount`]="{ item }">
      <span data-testid="cell-iu-payment-amount">{{ iuPaymentAmount(item) }}</span>
    </template>

    <template #[`item.breakdown_base_amount`]="{ item }">
      <div data-testid="cell-base-amount">
        <div>{{ baseAmount(item) }}</div>
        <div v-if="baseDiscountNote(item)" class="text-caption text-medium-emphasis">
          {{ baseDiscountNote(item) }}
        </div>
      </div>
    </template>

    <template #[`item.discount_percent`]="{ item }">
      <span data-testid="cell-discount-percent" :class="discountPercent(item).isPositive ? 'text-error' : undefined">
        {{ discountPercent(item).text }}
      </span>
    </template>

    <template #[`item.final_breakdown_amount`]="{ item }">
      <div data-testid="cell-final-amount">
        <div>{{ formatAmount(item.final_amount) }}</div>
        <div
          v-for="adjustment in finalAdjustments(item)"
          :key="adjustment.label"
          class="text-caption text-medium-emphasis"
        >
          + {{ adjustment.label }} {{ adjustment.amount }}
        </div>
      </div>
    </template>

    <template #[`item.total_to_pay`]="{ item }">
      <span data-testid="cell-total-to-pay">{{ formatAmount(item.total_to_pay) }}</span>
    </template>

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

    <template #no-data>No hay becarios en este lote</template>

    <template #bottom></template>
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
import { computed } from 'vue'
import { maskAccountNumber } from '@/utils/maskAccountNumber'
import { resolutionMeta } from '@/utils/resolutionMeta'
import {
  advancePaymentChip,
  advancePaymentDivergenceChip,
  advancePaymentRegisteredChip,
} from '@/utils/advancePaymentMeta'
import { telmexExportExclusionChip } from '@/utils/telmexExportMeta'
import { temporaryIncreaseChip } from '@/utils/temporaryIncreaseMeta'
import {
  amountOrDash,
  baseAmount,
  baseDiscountNote,
  discountPercent,
  finalAdjustments,
  formatAmount,
  iuPaymentAmount,
  monthlyAmount,
} from '@/utils/paymentBreakdownMeta'
import { buildGroupHeaders, generationLabel, toGroupedItems } from '@/utils/paymentGenerationGroups'
import type { PaymentBatchRow } from '@/interfaces/payment'

interface Props {
  rows?: PaymentBatchRow[]
  // Full, unfiltered batch rows — used ONLY to compute group-header counts/
  // sums (design D4). Deliberately a SEPARATE prop from `rows` (which may be
  // the "Solo pendientes de revisar"-filtered subset): header text must
  // never change when that filter is toggled (spec invariant).
  groupSourceRows?: PaymentBatchRow[]
  isPaid?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rows: () => [],
  groupSourceRows: () => [],
  isPaid: false,
  loading: false,
})

interface Emits {
  (e: 'view', refrendId: number): void
}

const emit = defineEmits<Emits>()

// "Total a pagar" stays the last money column, key/behavior unchanged
// (spec) — only its title changed from the old bare "Monto" now that it
// sits alongside five other money columns (Monto mensual/Apoyo/Pago IU/
// Base/Final) instead of being the only one.
const headers = [
  // Declared explicitly (title '') so Vuetify doesn't auto-prepend its own
  // "Group" column header once group-by is active.
  { title: '', key: 'data-table-group' },
  { title: 'Nombre', key: 'snapshot_name' },
  { title: 'Cuenta', key: 'account_number' },
  { title: 'Monto mensual', key: 'monthly_amount', width: 110, align: 'end' as const },
  { title: 'Apoyo', key: 'support_amount', width: 90, align: 'end' as const },
  { title: 'Pago IU', key: 'iu_payment_amount', width: 100, align: 'end' as const },
  { title: 'Base', key: 'breakdown_base_amount', width: 110, align: 'end' as const },
  { title: 'Desc.%', key: 'discount_percent', width: 70, align: 'end' as const },
  { title: 'Final', key: 'final_breakdown_amount', width: 130, align: 'end' as const },
  { title: 'Total a pagar', key: 'total_to_pay', width: 120, align: 'end' as const },
  { title: '', key: 'flags' },
  { title: 'Estado', key: 'status' },
  { title: 'Motivo', key: 'reason' },
]

// Rows grouped by generación (spec "Rows grouped by generación with paid/
// unpaid header", design D1/D3) — `toGroupedItems` maps each row to a
// non-null `generation_group` sentinel key and pre-sorts the whole list
// (numeric collator, sentinel last); `disable-sort` on the table relies on
// this order being final.
const groupedItems = computed(() => toGroupedItems(props.rows))
const groupBy = [{ key: 'generation_group' }]

// ALWAYS computed from `groupSourceRows` (the full batch), never from
// `rows`/`groupedItems` — spec invariant: group counts/sums must not change
// when "Solo pendientes de revisar" narrows what's rendered.
const groupHeaders = computed(() => buildGroupHeaders(props.groupSourceRows, props.isPaid))

// A group absent from `groupSourceRows` (e.g. a test that only sets `rows`)
// falls back to the label alone (design's documented fallback).
const groupHeaderText = (key: string): string => groupHeaders.value.get(key) ?? generationLabel(key)

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

<style scoped>
/* Becario name cell (spec "Becario name opens the payment document", design
   D7) — a native <button> styled to read as a link, never navigates. */
.payment-name-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  text-align: left;
}

.payment-name-link:hover {
  text-decoration: underline;
}

.payment-name-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 2px;
}

.payment-group-header-row {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
