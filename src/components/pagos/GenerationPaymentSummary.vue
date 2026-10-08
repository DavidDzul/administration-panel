<template>
  <template v-for="(group, i) in cardGroups" :key="i">
    <v-row class="mb-2">
      <v-col v-for="card in group.cards" :key="card.label" :cols="group.cols" :sm="group.sm">
        <v-card variant="tonal" :color="card.color" class="payment-summary-card">
          <v-card-text class="d-flex align-center ga-3">
            <v-avatar :color="card.color" variant="flat" size="40">
              <v-icon :icon="card.icon" size="22"></v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ card.label }}
                <v-tooltip v-if="card.help" :text="card.help" location="top">
                  <template v-slot:activator="{ props: tooltipProps }">
                    <v-icon
                      v-bind="tooltipProps"
                      icon="mdi-information-outline"
                      size="small"
                      tabindex="0"
                      aria-label="Ayuda: diferencia"
                    ></v-icon>
                  </template>
                </v-tooltip>
              </div>
              <div class="text-h5 font-weight-medium">{{ card.value }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GenerationPaymentSummary } from '@/interfaces/payment'

interface Props {
  summary?: GenerationPaymentSummary | null
}

const props = withDefaults(defineProps<Props>(), { summary: null })

// Self-contained, matches PaymentBatchSummary.vue's convention of not
// sharing a money formatter across files (design D6's copy of D13). Intl
// renders negative amounts sign-aware natively (e.g. `-$500.00`) — never
// produce this by prefixing a literal '-' to an already-formatted positive
// string (which yields the incorrect `$-500.00`).
const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const DIFFERENCE_HELP =
  'Diferencia entre lo que corresponde por beca y apoyo, y lo que se paga. Positiva: descuentos y retenciones aplicadas. Negativa: se pagó de más este mes por aumentos temporales, meses retenidos liberados, reembolsos o adelantos.'

interface SummaryCard {
  label: string
  value: string | number
  icon: string
  color: string | undefined
  help?: string
}

const card = (
  label: string,
  value: string | number,
  icon: string,
  color?: string,
  help?: string,
): SummaryCard => ({ label, value, icon, color, help })

// 3 rows (design D6): paid/pending/blocked counts (cols=6 sm=3), nominal
// components (cols=6 sm=4), payment-state money (cols=12 sm=4) — each
// divides cleanly into the Vuetify 12-col grid at every breakpoint.
const cardGroups = computed(() => {
  const s = props.summary
  if (!s) return []

  return [
    {
      cols: 6,
      sm: 3,
      cards: [
        card('Total becarios', s.total, 'mdi-account-group-outline'),
        card('Pagados', s.paid, 'mdi-check-decagram-outline', 'success'),
        card('Por pagar', s.pending, 'mdi-clock-outline', 'primary'),
        card('Bloqueados', s.blocked, 'mdi-alert-circle-outline', 'error'),
      ],
    },
    {
      cols: 6,
      sm: 4,
      cards: [
        card('Monto total de beca', formatAmount(s.beca_amount), 'mdi-school-outline', 'info'),
        card('Monto total de apoyo', formatAmount(s.apoyo_amount), 'mdi-hand-heart-outline', 'info'),
        card('Monto total Pago IU', formatAmount(s.pago_iu_amount), 'mdi-cash-sync', 'info'),
      ],
    },
    {
      cols: 12,
      sm: 4,
      cards: [
        card('Monto pagado', formatAmount(s.paid_amount), 'mdi-cash-check', 'success'),
        card('Monto por pagar', formatAmount(s.pending_amount), 'mdi-cash-clock', 'primary'),
        card(
          'Diferencia por descuentos y retenciones',
          formatAmount(s.difference_amount),
          'mdi-cash-minus',
          'warning',
          DIFFERENCE_HELP,
        ),
      ],
    },
  ]
})
</script>

<style scoped>
.payment-summary-card {
  height: 100%;
}
</style>
