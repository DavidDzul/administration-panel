<template>
  <div>
    <template v-if="advancePayment.settled_as_advance">
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="settled-as-advance-section">
        Este mes ya fue pagado por adelantado
        <div class="text-body-2 mt-1">
          Adelantado desde {{ monthLabel(advancePayment.origin_period_year!, advancePayment.origin_period_month!) }}
          · Monto {{ fmt(advancePayment.settled_amount!) }}
        </div>
        <div v-if="advancePayment.settled_status === 'PENDING'" class="text-caption text-medium-emphasis">
          Aún no se resuelve la situación de este mes.
        </div>
        <template v-else>
          <div class="text-caption text-medium-emphasis">
            Resuelto como {{ advancePayment.settled_resolution_type ?? 'Sin especificar' }}<span
              v-if="advancePayment.reached_at"
            > el {{ formatDate(advancePayment.reached_at) }}</span>
          </div>
          <div v-if="advancePayment.divergence_reason" class="text-body-2 mt-1">
            <strong>Motivo de divergencia:</strong> {{ advancePayment.divergence_reason }}
          </div>
        </template>
      </div>
    </template>

    <template v-if="advancePayment.has_registered_batch">
      <v-divider v-if="advancePayment.settled_as_advance" class="my-4"></v-divider>
      <div class="text-subtitle-1 font-weight-medium mb-1" data-testid="registered-batch-section">
        Este refrendo registró un pago adelantado
        <div class="text-body-2 mt-1">
          {{ advancePayment.registered_months_count }} mes(es) adelantado(s) · Total
          {{ fmt(advancePayment.registered_total_amount!) }}
        </div>
        <div class="text-caption text-medium-emphasis">
          Motivo: {{ advancePayment.registered_cause ?? 'Sin motivo especificado' }}
        </div>
        <div v-if="advancePayment.registered_notes" class="text-caption text-medium-emphasis">
          Notas: {{ advancePayment.registered_notes }}
        </div>
      </div>
    </template>

    <div v-if="isEmpty" class="text-body-1 text-medium-emphasis" data-testid="empty-state">
      Sin actividad de pago adelantado registrada.
    </div>
  </div>
</template>

<script setup lang="ts">
// sdd/pago-adelantado — purely presentational panel for
// PaymentDocumentDialog.vue's "Pago adelantado" tab (added 2026-09-27,
// mirrors RetentionBreakdownPanel.vue's exact structure/conventions).
// Renders the two structurally distinct, independent directions assembled
// server-side by `AdvancePaymentDocumentContext::forRefrend()`:
// settled_as_advance (this refrend IS one of the future months an EARLIER
// batch settled — includes the divergence reason when staff overrode the
// safe $0 outcome) and has_registered_batch (this refrend itself HAS a NEW
// batch registered against it). Both can render at once for the same
// refrend; never conflated into one section.
import { computed } from 'vue'
import type { AdvancePaymentDocumentInfo } from '@/interfaces/payment'

interface Props {
  advancePayment: AdvancePaymentDocumentInfo
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

const isEmpty = computed(
  () => !props.advancePayment.settled_as_advance && !props.advancePayment.has_registered_batch,
)
</script>
