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
                      :aria-label="`Ayuda: ${card.label}`"
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

// difference_amount is the TRUE discounts and retentions
// (sdd/tabla-montos-por-generacion): every nominal component, including
// temporary increases and pending/advance, minus the total to pay. It no
// longer goes negative because of increases or released months.
const DIFFERENCE_HELP = 'Descuentos académicos, penalizaciones y retenciones aplicadas'
const TELMEX_WITHOUT_IU_HELP = 'Becarios Telmex a quienes IU no realiza pago este mes'

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

interface CardGroup {
  cols: number
  // `true` = equal-width columns (Vuetify auto layout), used when a row has
  // a variable number of cards.
  sm: number | boolean
  cards: SummaryCard[]
}

// 3 rows (design D6): paid/pending/blocked counts (+ the conditional
// "Telmex sin pago IU" count), nominal components, payment-state money. Rows
// with a fixed card count use explicit column widths; the two rows that gain
// cards use equal-width columns so they always fill the line.
const cardGroups = computed<CardGroup[]>(() => {
  const s = props.summary
  if (!s) return []

  const hasTelmexWithoutIu = Number(s.telmex_without_iu_payment ?? 0) > 0

  const countCards = [
    card('Total becarios', s.total, 'mdi-account-group-outline'),
    card('Pagados', s.paid, 'mdi-check-decagram-outline', 'success'),
    card('Por pagar', s.pending, 'mdi-clock-outline', 'primary'),
    card('Bloqueados', s.blocked, 'mdi-alert-circle-outline', 'error'),
  ]
  // Pure TELMEX becarios IU does not pay this month; they are listed in the
  // table but excluded from every figure, so surface their count here.
  if (hasTelmexWithoutIu) {
    countCards.push(
      card(
        'Telmex sin pago IU',
        s.telmex_without_iu_payment,
        'mdi-account-cancel-outline',
        'grey',
        TELMEX_WITHOUT_IU_HELP,
      ),
    )
  }

  const groups: CardGroup[] = [
    {
      cols: 6,
      sm: hasTelmexWithoutIu ? true : 3,
      cards: countCards,
    },
    {
      cols: 6,
      sm: true,
      cards: [
        card('Monto total de beca', formatAmount(s.beca_amount), 'mdi-school-outline', 'info'),
        card('Monto total de apoyo', formatAmount(s.apoyo_amount), 'mdi-hand-heart-outline', 'info'),
        card('Monto total Pago IU', formatAmount(s.pago_iu_amount), 'mdi-cash-sync', 'info'),
        card('Aumentos temporales', formatAmount(s.temporary_increase_amount), 'mdi-trending-up', 'info'),
        card('Pendientes y adelantos', formatAmount(s.pending_and_advance_amount), 'mdi-cash-fast', 'info'),
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

  // "Adelanto Telmex" card (sdd/telmex-cobertura-iu PR5, task 5.6) — same
  // conditional 4th row as PaymentBatchSummary.vue's copy: shown ONLY when
  // telmex_coverage_amount is present and > 0, so the 3-row/10-card layout
  // stays byte-identical for every generación without a covered row.
  if (Number(s.telmex_coverage_amount ?? 0) > 0) {
    groups.push({
      cols: 12,
      sm: 12,
      cards: [card('Adelanto Telmex', formatAmount(s.telmex_coverage_amount as string), 'mdi-hand-coin-outline', 'teal')],
    })
  }

  return groups
})
</script>

<style scoped>
.payment-summary-card {
  height: 100%;
}
</style>
