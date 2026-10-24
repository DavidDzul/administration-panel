<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="900px"
    scrollable
  >
    <v-card>
      <v-toolbar dark>
        <v-toolbar-title>Documento de pago</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-toolbar-items>
          <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-card-text>
        <v-row v-if="loading">
          <v-col cols="12" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate color="primary" />
          </v-col>
        </v-row>

        <v-row v-else-if="loadError">
          <v-col cols="12">
            <v-alert
              type="error"
              variant="tonal"
              title="Error al cargar la información"
              text="No se pudo cargar el documento de pago. Intenta de nuevo más tarde."
            ></v-alert>
          </v-col>
        </v-row>

        <template v-else-if="document">
          <v-tabs v-model="tab">
            <v-tab value="resumen">Resumen</v-tab>
            <v-tab value="incidencias">Incidencias</v-tab>
            <v-tab value="comentarios">Comentarios</v-tab>
            <v-tab value="desglose">Desglose de monto</v-tab>
            <v-tab value="retenciones">Retenciones</v-tab>
            <v-tab value="adelanto">Pago adelantado</v-tab>
          </v-tabs>

          <v-window v-model="tab" class="mt-4">
            <v-window-item value="resumen">
              <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
              <div class="text-h6 font-weight-medium">{{ document.snapshot_name }}</div>
              <div class="text-caption text-medium-emphasis mt-4 mb-1">Matrícula</div>
              <div class="text-body-1 mb-4">{{ document.enrollment ?? 'Sin matrícula' }}</div>

              <v-divider class="mb-4"></v-divider>

              <div class="text-subtitle-1 font-weight-medium mb-2">Retenciones</div>
              <v-row>
                <v-col cols="6" sm="4">
                  <div class="text-caption text-medium-emphasis mb-1">Meses retenidos</div>
                  <div class="text-body-1">{{ document.carryover_months_count ?? 0 }}</div>
                </v-col>
                <v-col cols="12" sm="8">
                  <div class="text-caption text-medium-emphasis mb-1">Detalle</div>
                  <div class="text-body-1">{{ document.carryover_months_detail ?? 'Sin detalle' }}</div>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="incidencias">
              <div v-if="document.incidents.length === 0">Sin incidencias registradas.</div>
              <v-list v-else>
                <v-list-item v-for="incident in document.incidents" :key="incident.id">
                  <div class="d-flex align-center ga-2 mb-1">
                    <v-chip size="small" variant="tonal">{{ incident.incident_category }}</v-chip>
                    <v-chip size="small" variant="tonal">{{ incident.incident_type }}</v-chip>
                  </div>
                  <div class="text-body-2">{{ incident.description }}</div>
                </v-list-item>
              </v-list>
            </v-window-item>

            <v-window-item value="comentarios">
              <div class="text-caption text-medium-emphasis mb-1">Atención</div>
              <div class="text-body-1 mb-4">{{ document.atencion_observations ?? 'Sin comentarios' }}</div>

              <div class="text-caption text-medium-emphasis mb-1">Pedagogía</div>
              <div class="text-body-1 mb-4">{{ document.pedagogia_observations ?? 'Sin comentarios' }}</div>

              <div class="text-caption text-medium-emphasis mb-1">Resolución</div>
              <div class="text-body-1">{{ document.resolution_notes ?? 'Sin comentarios' }}</div>
            </v-window-item>

            <v-window-item value="desglose">
              <div class="amount-breakdown" data-testid="amount-breakdown">
                <template v-for="row in breakdownRows" :key="row.key">
                  <v-divider v-if="row.subtotal" class="my-2"></v-divider>
                  <div
                    class="d-flex justify-space-between align-start py-1"
                    :class="{ 'font-weight-bold': row.subtotal }"
                    :data-testid="`breakdown-row-${row.key}`"
                  >
                    <div>
                      <div class="d-flex align-center ga-2" :class="row.subtotal ? 'text-body-1' : 'text-body-2'">
                        <v-icon v-if="row.icon" :icon="row.icon" :color="row.color" size="small" />
                        <span>{{ row.label }}</span>
                      </div>
                      <div v-if="row.caption" class="text-caption text-medium-emphasis">{{ row.caption }}</div>
                    </div>
                    <div :class="[row.subtotal ? 'text-body-1' : 'text-body-2', row.color ? `text-${row.color}` : '']">
                      {{ row.amount }}
                    </div>
                  </div>
                </template>
              </div>
              <v-divider class="my-4"></v-divider>
              <div class="d-flex justify-space-between align-center" data-testid="breakdown-row-total">
                <div class="text-h5">Total a pagar</div>
                <div class="text-h5">${{ breakdown.total_to_pay }}</div>
              </div>
            </v-window-item>

            <v-window-item value="retenciones">
              <RetentionBreakdownPanel :retentions="document.retentions" />
            </v-window-item>

            <v-window-item value="adelanto">
              <AdvancePaymentPanel :advance-payment="document.advance_payment" />
            </v-window-item>
          </v-window>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Follow-up to PR6 (sdd/becario-payment-file-generation): the single-becario
// payment document moved from a routed page (`/pagos/:refrendId`,
// PaymentDocumentView.vue, now deleted) to this modal, opened directly from
// PaymentBatchTable's "Ver" action, so a reviewer can go through a whole
// batch without losing the table's filter/scroll context. Content below is
// the same verified field mapping from PaymentDocumentView.vue, only
// redistributed across tabs — never re-derived. Still read-only: no form
// inputs, no save action, and the 3 comentario fields
// (atención/pedagogía/resolución) stay separately labeled, never merged.
import { computed, ref, toRef, watch } from 'vue'
import { usePaymentDocumentPage } from '@/composables/usePaymentDocumentPage'
import RetentionBreakdownPanel from '@/components/pagos/RetentionBreakdownPanel.vue'
import AdvancePaymentPanel from '@/components/pagos/AdvancePaymentPanel.vue'
import { TEMPORARY_INCREASE_META } from '@/utils/temporaryIncreaseMeta'

interface Props {
  modelValue: boolean
  refrendId: number | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const emit = defineEmits<Emits>()

const { document, loading, loadError } = usePaymentDocumentPage(toRef(props, 'refrendId'))

const tab = ref('resumen')

type BreakdownRow = {
  key: string
  label: string
  amount: string
  subtotal?: boolean
  caption?: string
  color?: string
  icon?: string
}

// Non-zero / non-null guard for the optional rows. "0.00" and malformed
// strings are truthy, so coerce numerically, never test the string itself.
const isPresent = (value: string | null | undefined): value is string => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n !== 0
}

const money = (value: string | null | undefined): string => `$${value ?? '0.00'}`
const signed = (sign: '+' | '−', value: string | null | undefined): string => `${sign}${money(value)}`

// "30.00" -> "30", "12.50" -> "12.5": percentages read better without padding.
const percent = (value: string | null | undefined): string => String(Number(value ?? 0))

// Signed manual adjustment: the API already carries the sign ("-220.00").
const manualAmount = (value: string): string => {
  const n = Number(value)
  const abs = Math.abs(n).toFixed(2)
  return `${n < 0 ? '−' : '+'}$${abs}`
}

// Vertical reconciliation list: every non-subtotal row is shown ONLY when its
// amount is non-zero/non-null; the subtotals (Monto bruto, Monto final) are
// always shown. Order mirrors RefrendAmountBreakdown's invariants:
//   base + apoyo + aumento = bruto
//   bruto - academico - descuento + cobertura + ajuste = final
const breakdown = computed(() => document.value!.amount_breakdown)

const breakdownRows = computed<BreakdownRow[]>(() => {
  const b = breakdown.value
  const rows: BreakdownRow[] = []

  if (isPresent(b.base_amount)) {
    rows.push({ key: 'base', label: 'Monto base', amount: money(b.base_amount) })
  }
  if (isPresent(b.monto_apoyo)) {
    rows.push({ key: 'apoyo', label: '+ Monto de apoyo', amount: signed('+', b.monto_apoyo) })
  }
  if (isPresent(b.temporary_increase_amount)) {
    rows.push({
      key: 'aumento',
      label: '+ Aumento temporal',
      amount: signed('+', b.temporary_increase_amount),
      caption: b.temporary_increase_reason ? `Motivo: ${b.temporary_increase_reason}` : undefined,
      color: TEMPORARY_INCREASE_META.color,
      icon: TEMPORARY_INCREASE_META.icon,
    })
  }

  rows.push({ key: 'bruto', label: 'Monto bruto', amount: money(b.gross_amount ?? b.base_amount), subtotal: true })

  if (isPresent(b.academic_discount_amount)) {
    rows.push({
      key: 'academico',
      label: `− Descuento académico (${percent(b.academic_discount_percentage)}%)`,
      amount: signed('−', b.academic_discount_amount),
      caption: b.academic_discount_reason ? `Motivo: ${b.academic_discount_reason}` : undefined,
    })
  }
  if (isPresent(b.discount_amount)) {
    const label = b.discount_label ?? 'Descuentos por penalizaciones'
    const pct = Number(b.discount_percentage ?? 0)
    rows.push({
      key: 'descuento',
      label: pct > 0 ? `− ${label} (${percent(b.discount_percentage)}%)` : `− ${label}`,
      amount: signed('−', b.discount_amount),
    })
  }
  if (isPresent(b.telmex_covered_amount)) {
    rows.push({ key: 'telmex', label: '+ Cobertura Telmex', amount: signed('+', b.telmex_covered_amount) })
  }
  if (isPresent(b.manual_adjustment)) {
    rows.push({
      key: 'ajuste',
      label: '± Ajuste manual',
      amount: manualAmount(b.manual_adjustment),
      caption: 'Diferencia por edición manual del monto final',
      color: 'warning',
    })
  }

  rows.push({ key: 'final', label: 'Monto final', amount: money(b.final_amount), subtotal: true })

  if (isPresent(b.amount_pending_from_previous)) {
    rows.push({
      key: 'pendiente',
      label: '+ Pendiente de periodo anterior',
      amount: signed('+', b.amount_pending_from_previous),
    })
  }
  if (isPresent(b.advance_payment_amount)) {
    rows.push({ key: 'adelanto', label: '+ Pago adelantado', amount: signed('+', b.advance_payment_amount) })
  }

  return rows
})

// Always starts on the first tab for each becario, same "reset on open"
// convention as CreateAccesoDialog.vue's resetForm().
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) tab.value = 'resumen'
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}
</script>
