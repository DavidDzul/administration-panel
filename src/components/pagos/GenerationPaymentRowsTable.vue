<template>
  <div class="mt-4" data-testid="generation-rows-table">
    <v-alert
      v-if="hasPendingNoIu"
      data-testid="no-iu-pending-alert"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
      text="Hay becarios Telmex sin pago IU con montos pendientes de meses anteriores. Revisa su situación antes de cerrar el periodo."
    ></v-alert>
    <v-data-table
      v-model:sort-by="sortBy"
      :headers="headers"
      :items="rows"
      :custom-key-sort="customKeySort"
      :row-props="rowProps"
      density="compact"
      fixed-header
      height="60vh"
      :items-per-page="-1"
      item-value="refrend_id"
      class="elevation-1"
    >
      <template #[`item.enrollment`]="{ item }">
        <span>{{ item.enrollment || '—' }}</span>
      </template>

      <template #[`item.scholarship_type`]="{ item }">
        {{ typeLabel(item.scholarship_type) }}
      </template>

      <template v-for="key in plainMoneyKeys" #[`item.${key}`]="{ item }" :key="key">
        <span :data-testid="`cell-${key}`" :class="mutedClass(item[key])">{{ formatAmount(item[key]) }}</span>
      </template>

      <template #[`item.discounts`]="{ item }">
        <span data-testid="cell-discounts" :class="mutedClass(item.discounts)">{{ discountText(item.discounts) }}</span>
      </template>

      <template #[`item.total_to_pay`]="{ item }">
        <span data-testid="cell-total_to_pay" :class="mutedClass(item.total_to_pay)">
          {{ formatAmount(item.total_to_pay) }}
        </span>
      </template>

      <template #[`item.state`]="{ item }">
        <v-tooltip v-if="chipFor(item).help" :text="chipFor(item).help" location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              data-testid="state-chip"
              :color="chipFor(item).color"
              size="small"
              variant="tonal"
              tabindex="0"
            >
              {{ chipFor(item).label }}
            </v-chip>
          </template>
        </v-tooltip>
        <v-chip v-else data-testid="state-chip" :color="chipFor(item).color" size="small" variant="tonal">
          {{ chipFor(item).label }}
        </v-chip>
      </template>

      <template #no-data>No hay becarios para mostrar</template>

      <template #bottom></template>

      <template #tfoot>
        <tr class="generation-rows-totals" data-testid="totals-row">
          <td class="font-weight-bold" colspan="3">Totales</td>
          <td v-for="column in totalColumns" :key="column.key" class="text-end font-weight-bold">
            <span :data-testid="`total-${column.key}`">{{ column.text }}</span>
          </td>
          <td></td>
        </tr>
      </template>
    </v-data-table>

    <p class="text-caption text-medium-emphasis mt-2" data-testid="totals-caption">
      Los totales no incluyen becarios bloqueados ni Telmex sin pago IU.
    </p>
  </div>
</template>

<script setup lang="ts">
// Per-becario amounts table of "Resumen por generación"
// (sdd/tabla-montos-por-generacion). Purely presentational: rows come from
// the API already reconciled (beca + apoyo + pago IU + aumento temporal +
// cobertura Telmex - descuentos + pendiente/adelanto = total a pagar).
//
// The "Totales" footer is computed here from the rows, over PAID + PENDING
// only — the same scope the cards use — so BLOCKED and NO_IU_PAYMENT rows
// never inflate it. The summary cards are the source of truth; a test locks
// both to the same fixture.
import { computed, ref } from 'vue'
import type { DataTableCompareFunction } from 'vuetify'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import type { GenerationPaymentRow, GenerationPaymentRowState } from '@/interfaces/payment'

interface Props {
  rows?: GenerationPaymentRow[]
}

const props = withDefaults(defineProps<Props>(), { rows: () => [] })

type MoneyKey =
  | 'beca'
  | 'apoyo'
  | 'pago_iu'
  | 'temporary_increase'
  | 'telmex_coverage'
  | 'discounts'
  | 'pending_and_advance'
  | 'total_to_pay'

const NO_IU_PAYMENT_HELP = 'Telmex paga directamente su beca; IU no realiza pago este mes'
const NO_IU_PENDING_HELP = 'Telmex sin pago IU con monto pendiente de meses anteriores'

const TYPE_LABELS: Record<GenerationPaymentRow['scholarship_type'], string> = {
  IU: 'IU',
  TELMEX_IU: 'Telmex-IU',
  TELMEX: 'Telmex',
}

const typeLabel = (type: GenerationPaymentRow['scholarship_type']): string => TYPE_LABELS[type] ?? type

const stateMeta: Record<GenerationPaymentRowState, { label: string; color: string }> = {
  PAID: { label: 'Pagado', color: 'success' },
  PENDING: { label: 'Por pagar', color: 'info' },
  BLOCKED: { label: 'Bloqueado', color: 'error' },
  NO_IU_PAYMENT: { label: 'Sin pago IU', color: 'grey' },
}

// A pure Telmex refrend IU does not pay this month can still carry money
// pending/advanced from other months. Such a row needs a human look, so it is
// neither muted nor labelled as a plain "Sin pago IU".
const isPendingNoIu = (row: GenerationPaymentRow): boolean =>
  row.state === 'NO_IU_PAYMENT' && toCents(row.total_to_pay) > 0

const hasPendingNoIu = computed(() => props.rows.some(isPendingNoIu))

const chipFor = (row: GenerationPaymentRow): { label: string; color: string; help?: string } => {
  if (isPendingNoIu(row)) return { label: 'Revisar pendiente', color: 'warning', help: NO_IU_PENDING_HELP }
  if (row.state === 'NO_IU_PAYMENT') return { ...stateMeta.NO_IU_PAYMENT, help: NO_IU_PAYMENT_HELP }
  return stateMeta[row.state]
}

const money = (key: string, title: string) => ({ title, key, align: 'end' as const, sortable: true })

const headers = [
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'Nombre completo', key: 'full_name' },
  { title: 'Tipo de beca', key: 'scholarship_type' },
  money('beca', 'Beca'),
  money('apoyo', 'Apoyo'),
  money('pago_iu', 'Pago IU'),
  money('temporary_increase', 'Aumento temporal'),
  money('telmex_coverage', 'Cobertura Telmex'),
  money('discounts', 'Descuentos y retenciones'),
  money('pending_and_advance', 'Pendiente / adelanto'),
  money('total_to_pay', 'Total a pagar'),
  { title: 'Estado', key: 'state' },
]

// `discounts` and `total_to_pay` have their own templates (sign / emphasis).
const plainMoneyKeys: MoneyKey[] = [
  'beca',
  'apoyo',
  'pago_iu',
  'temporary_increase',
  'telmex_coverage',
  'pending_and_advance',
]

// Default order: full name, Spanish locale-aware (accents and case ignored).
const sortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'full_name', order: 'asc' }])

const compareMoney: DataTableCompareFunction = (a, b) => Number(a) - Number(b)

const customKeySort: Record<string, DataTableCompareFunction> = {
  full_name: (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'es', { sensitivity: 'base' }),
  beca: compareMoney,
  apoyo: compareMoney,
  pago_iu: compareMoney,
  temporary_increase: compareMoney,
  telmex_coverage: compareMoney,
  discounts: compareMoney,
  pending_and_advance: compareMoney,
  total_to_pay: compareMoney,
}

const toCents = (amount: string | number | null | undefined): number => {
  const value = Number(amount ?? 0)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

const mutedClass = (amount: string): string | undefined => (toCents(amount) === 0 ? 'text-disabled' : undefined)

// "−" (U+2212) prefix for a positive discount; a negative one (a manual
// override that RAISED the amount) shows as "+" so it can't be misread.
const discountText = (amount: string): string => {
  const cents = toCents(amount)
  if (cents > 0) return `−${formatAmount(cents / 100)}`
  if (cents < 0) return `+${formatAmount(Math.abs(cents) / 100)}`
  return formatAmount(0)
}

const rowProps = ({ item }: { item: GenerationPaymentRow }) =>
  item.state === 'NO_IU_PAYMENT' && !isPendingNoIu(item) ? { class: 'generation-row-muted text-disabled' } : {}

const totalColumns = computed(() => {
  const counted = props.rows.filter((row) => row.state === 'PAID' || row.state === 'PENDING')
  const keys: MoneyKey[] = [
    'beca',
    'apoyo',
    'pago_iu',
    'temporary_increase',
    'telmex_coverage',
    'discounts',
    'pending_and_advance',
    'total_to_pay',
  ]
  return keys.map((key) => {
    const cents = counted.reduce((sum, row) => sum + toCents(row[key]), 0)
    return { key, cents, text: key === 'discounts' ? discountText(String(cents / 100)) : formatAmount(cents / 100) }
  })
})
</script>

<style scoped>
.generation-rows-totals td {
  border-top: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
  white-space: nowrap;
}
</style>
