<template>
  <div>
    <template v-if="hasLedger">
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="ledger-section">
        Retenciones de periodos anteriores pagadas en este pago
        <div class="text-caption text-medium-emphasis mb-2">Meses liquidados en este pago</div>
        <v-list density="compact">
          <v-list-item v-for="entry in retentions.ledger_applied" :key="`${entry.withholding_id}-${entry.payment_id}`">
            <v-list-item-title class="text-body-2 font-weight-medium">
              {{ monthLabel(entry.period_year, entry.period_month) }} · Retenido {{ fmt(entry.withheld_amount) }} ·
              Se paga ahora {{ fmt(entry.amount_applied_now) }} · Restante {{ fmt(entry.remaining_amount) }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              Motivo: {{ entry.cause ?? 'Sin motivo especificado' }}
            </v-list-item-subtitle>
            <v-list-item-subtitle class="text-caption">
              Retenido el {{ formatDate(entry.withheld_at) }}<span v-if="entry.created_by"> por {{ entry.created_by }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <div class="text-body-1 font-weight-medium mt-2">
          Total aplicado en este pago: {{ fmt(retentions.ledger_applied_total) }}
        </div>
      </div>
    </template>

    <template v-if="retentions.origin_withholding">
      <v-divider v-if="hasLedger" class="mb-4"></v-divider>
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="origin-withholding-section">
        Retención generada por este refrendo — se puede pagar más adelante
        <div class="text-body-2 mt-1">
          {{ monthLabel(retentions.origin_withholding.period_year, retentions.origin_withholding.period_month) }} ·
          Retenido {{ fmt(retentions.origin_withholding.withheld_amount) }} ·
          Pagado {{ fmt(retentions.origin_withholding.paid_amount) }} ·
          Restante {{ fmt(retentions.origin_withholding.remaining_amount) }}
        </div>
        <div class="text-caption text-medium-emphasis">
          Motivo: {{ retentions.origin_withholding.cause ?? 'Sin motivo especificado' }}
        </div>
        <div class="text-caption text-medium-emphasis">
          Retenido el {{ formatDate(retentions.origin_withholding.withheld_at) }}<span
            v-if="retentions.origin_withholding.created_by"
          > por {{ retentions.origin_withholding.created_by }}</span>
        </div>
      </div>
    </template>

    <template v-if="hasAttendanceDiscounts">
      <v-divider v-if="hasLedger || retentions.origin_withholding" class="mb-4"></v-divider>
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="attendance-discounts-section">
        Descuentos por asistencia — sin monto retenido
        <div class="text-caption text-medium-emphasis mb-2">
          Este tipo de descuento no registra un monto retenido en pesos, sólo un porcentaje: no genera un saldo
          pagable más adelante.
        </div>
        <v-list density="compact">
          <v-list-item v-for="discount in retentions.attendance_discounts" :key="discount.id">
            <v-list-item-title class="text-body-2">
              {{ discountTypeLabel(discount.discount_type) }} · {{ discount.discount_percentage ?? '0.00' }}% ·
              {{ discount.description ?? 'Sin descripción' }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              Registrado el {{ formatDate(discount.created_at) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
    </template>

    <template v-if="retentions.definitive_discount">
      <v-divider v-if="hasLedger || retentions.origin_withholding || hasAttendanceDiscounts" class="mb-4"></v-divider>
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="definitive-discount-section">
        Descuento definitivo — no es un saldo pendiente de pago
        <div class="text-caption text-medium-emphasis mb-2">Este monto no se pagará más adelante.</div>
        <div class="text-body-2">
          {{ fmt(retentions.definitive_discount.discount_amount) }} ({{ retentions.definitive_discount.discount_percentage }}%)
          · Motivo: {{ retentions.definitive_discount.resolution_cause ?? 'Sin motivo especificado' }}
        </div>
      </div>
    </template>

    <div v-if="isEmpty" class="text-body-1 text-medium-emphasis" data-testid="empty-state">
      Sin retenciones ni descuentos registrados.
    </div>
  </div>
</template>

<script setup lang="ts">
// sdd/withholding-detail-display PR4 — purely presentational panel for
// PaymentDocumentDialog.vue's "Retenciones" tab. Renders the 3 structurally
// distinct retention kinds assembled server-side by
// `RefrendRetentionBreakdown::forRefrend()` (design D1-D4). Kind 1 splits
// into `ledger_applied` (money settled NOW by this refrend) and
// `origin_withholding` (a NEW retention this same refrend generated) —
// rendered as clearly separate sections so a becario who both settles past
// debt AND originates new debt in the same refrendo is never misread as one
// blended amount (D2). Kind 2 (attendance discounts) deliberately never
// formats a currency value — that column does not exist server-side. Kind 3
// (definitive discount) is explicitly labeled as never payable later. Month
// labels and currency formatting mirror psicol-panel's
// SituationPagoMesesDialog.vue convention (`monthLabel`/`Intl.NumberFormat`)
// — reference pattern only, this panel is strictly read-only.
import { computed } from 'vue'
import type { RetentionBreakdown } from '@/interfaces/payment'

interface Props {
  retentions: RetentionBreakdown
}

const props = defineProps<Props>()

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const monthLabel = (year: number, month: number): string => `${MONTH_NAMES[month - 1] ?? month} ${year}`

const fmt = (value: string | number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value))

const formatDate = (value: string): string => new Date(value).toLocaleDateString('es-MX')

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  RETARDOS: 'Retardos',
  FALTA_INJUSTIFICADA: 'Falta injustificada',
}

const discountTypeLabel = (type: string): string => DISCOUNT_TYPE_LABELS[type] ?? type

const hasLedger = computed(() => props.retentions.ledger_applied.length > 0)
const hasAttendanceDiscounts = computed(() => props.retentions.attendance_discounts.length > 0)
const isEmpty = computed(
  () =>
    !hasLedger.value &&
    !props.retentions.origin_withholding &&
    !hasAttendanceDiscounts.value &&
    !props.retentions.definitive_discount,
)
</script>
