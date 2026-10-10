<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center justify-space-between">
      Estado de cuenta
    </v-card-title>
    <v-data-table
      :headers="monthHeaders"
      :items="months"
      :loading="loading"
      item-value="period"
      density="compact"
      :items-per-page="-1"
      class="elevation-0"
    >
      <template #[`item.period`]="{ item }">{{ formatPeriod(item.period) }}</template>
      <template #[`item.payment_batch_id`]="{ item }">{{ item.payment_batch_id ?? '—' }}</template>
      <template #[`item.covered_amount`]="{ item }">{{ formatCurrency(item.covered_amount) }}</template>
      <template #[`item.is_paid`]="{ item }">
        <div>
          <v-chip size="small" :color="item.is_paid ? 'success' : 'warning'" variant="tonal">
            {{ item.is_paid ? 'Pagado' : 'Pendiente' }}
          </v-chip>
          <v-tooltip
            v-if="item.has_temporary_increase"
            text="Este mes también se pagó un aumento temporal. Ese aumento es dinero de IU y no forma parte de lo que el becario debe devolver."
          >
            <template #activator="{ props: tooltipProps }">
              <v-chip
                v-bind="tooltipProps"
                data-testid="coverage-increase-overlap-chip"
                size="small"
                color="warning"
                variant="tonal"
                prepend-icon="mdi-alert-outline"
                class="ml-1"
              >
                Aumento temporal
              </v-chip>
            </template>
          </v-tooltip>
        </div>
      </template>
      <template #no-data>No hay meses cubiertos registrados</template>
      <template #bottom></template>
    </v-data-table>
  </v-card>

  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      Abonos registrados
      <v-btn v-if="canRegisterPayment" color="primary" size="small" prepend-icon="mdi-cash-plus" @click="emit('register')">
        Registrar abono
      </v-btn>
    </v-card-title>
    <v-data-table
      :headers="paymentHeaders"
      :items="payments"
      :loading="loading"
      item-value="id"
      density="compact"
      :items-per-page="-1"
      class="elevation-0"
    >
      <template #[`item.paid_at`]="{ item }">{{ formatPeriod(item.paid_at) }}</template>
      <template #[`item.amount`]="{ item }">{{ formatCurrency(item.amount) }}</template>
      <template #[`item.reference`]="{ item }">{{ item.reference ?? '—' }}</template>
      <template #[`item.notes`]="{ item }">{{ item.notes ?? '—' }}</template>
      <template #[`item.is_voided`]="{ item }">
        <span v-if="item.is_voided" class="text-error">Anulado · {{ item.void_reason }}</span>
        <span v-else>—</span>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="canVoidPayment(item)"
          color="error"
          variant="text"
          size="small"
          prepend-icon="mdi-close-circle-outline"
          @click="emit('void', item)"
        >
          Anular
        </v-btn>
      </template>
      <template #no-data>No hay abonos registrados</template>
      <template #bottom></template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
// Month-by-month statement + repayments table (sdd/telmex-cobertura-iu PR5,
// task 5.2). Purely presentational — write actions (register/void) are
// emitted upward; TelmexCoverageDetailView owns the dialogs, mirrors
// TelmexCoveragesTable/TelmexCoveragesView's "table emits, view opens the
// dialog" split (PR4).
//
// "Registrar abono" is gated to EN_COBRO only (decisions-2 #1926: client
// flow — the becario repays once Telmex deposits the accumulated months,
// which only happens after "Telmex started", i.e. EN_COBRO). "Anular" is
// gated to !is_voided AND status !== CANCELADA (PR3a's
// VoidTelmexCoveragePaymentAction only rejects on CANCELADA — voiding is
// exactly how a LIQUIDADA coverage reopens to EN_COBRO, so LIQUIDADA must
// NOT block it).
//
// The warning chip for a covered month that also paid a temporary increase
// (task 5.3) reads `has_temporary_increase` from the statement endpoint.
// The increase is IU's own money and is not part of the debt (the ledger
// only sums the covered Telmex part), so the chip explains why that month's
// deposit was larger than what the becario must repay.
import { computed } from 'vue'
import type { TelmexCoverageMonth, TelmexCoveragePayment, TelmexCoverageStatus } from '@/interfaces/telmexCoverage'

interface Props {
  months?: TelmexCoverageMonth[]
  payments?: TelmexCoveragePayment[]
  coverageStatus?: TelmexCoverageStatus
  canManageRepayments?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  months: () => [],
  payments: () => [],
  coverageStatus: 'ACTIVA',
  canManageRepayments: false,
  loading: false,
})

interface Emits {
  (e: 'register'): void
  (e: 'void', payment: TelmexCoveragePayment): void
}

const emit = defineEmits<Emits>()

const monthHeaders = [
  { title: 'Periodo', key: 'period' },
  { title: 'Lote', key: 'payment_batch_id' },
  { title: 'Monto adelantado', key: 'covered_amount', align: 'end' as const },
  { title: 'Estado del pago', key: 'is_paid' },
]

const paymentHeaders = [
  { title: 'Fecha', key: 'paid_at' },
  { title: 'Monto', key: 'amount', align: 'end' as const },
  { title: 'Referencia/comprobante', key: 'reference' },
  { title: 'Notas', key: 'notes' },
  { title: 'Anulado', key: 'is_voided' },
  { title: '', key: 'actions' },
]

const canRegisterPayment = computed(
  () => props.canManageRepayments && props.coverageStatus === 'EN_COBRO',
)

const canVoidPayment = (payment: TelmexCoveragePayment): boolean =>
  props.canManageRepayments && !payment.is_voided && props.coverageStatus !== 'CANCELADA'

// `period`/`paid_at` are "YYYY-MM-DD" (date-only) — sliced directly
// instead of parsed through `Date`, same convention as
// TelmexCoveragesTable.vue's `formatPeriod` to avoid timezone-shift
// surprises on a date-only value.
const formatPeriod = (date: string): string => `${date.slice(5, 7)}/${date.slice(0, 4)}`

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))
</script>
