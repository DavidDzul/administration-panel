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
              <div class="text-caption text-medium-emphasis">{{ card.label }}</div>
              <div class="text-h5 font-weight-medium">{{ card.value }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </template>
</template>

<script setup lang="ts">
// Cheque counterpart of PaymentBatchSummary: same card markup/style, two
// rows (counts, then amounts), each dividing cleanly into the 12-col grid.
// Also serves the other-bank transfer section (`kind` only changes wording).
import { computed } from 'vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import type { ChequeSummary } from '@/interfaces/payment'

interface Props {
  summary?: ChequeSummary | null
  kind?: 'cheque' | 'manual_transfer'
}

const props = withDefaults(defineProps<Props>(), { summary: null, kind: 'cheque' })

const WORDING = {
  cheque: { total: 'Becarios con cheque', ready: 'Por emitir', readyAmount: 'Monto por emitir' },
  manual_transfer: { total: 'Becarios con transferencia', ready: 'Por pagar', readyAmount: 'Monto por pagar' },
} as const

const splitCards = (s: ChequeSummary, words: (typeof WORDING)[keyof typeof WORDING]) => [
  { label: `${words.readyAmount} · Cuenta Beca`, value: formatAmount(s.ready_beca_amount), icon: 'mdi-cash-clock', color: 'primary' },
  { label: `${words.readyAmount} · Cuenta Apoyo`, value: formatAmount(s.ready_apoyo_amount), icon: 'mdi-cash-clock', color: 'primary' },
  { label: 'Monto pagado · Cuenta Beca', value: formatAmount(s.paid_beca_amount), icon: 'mdi-cash-check', color: 'success' },
  { label: 'Monto pagado · Cuenta Apoyo', value: formatAmount(s.paid_apoyo_amount), icon: 'mdi-cash-check', color: 'success' },
]

const cardGroups = computed(() => {
  const s = props.summary
  if (!s) return []
  const words = WORDING[props.kind]

  return [
    {
      cols: 6,
      sm: 3,
      cards: [
        { label: words.total, value: s.total, icon: 'mdi-account-group-outline', color: undefined },
        { label: words.ready, value: s.ready, icon: 'mdi-checkbook', color: 'info' },
        { label: 'Pagados', value: s.paid, icon: 'mdi-check-circle-outline', color: 'success' },
        { label: 'Bloqueados', value: s.blocking, icon: 'mdi-alert-circle-outline', color: 'error' },
      ],
    },
    {
      cols: 12,
      sm: 6,
      cards: [
        { label: words.readyAmount, value: formatAmount(s.ready_amount), icon: 'mdi-cash-clock', color: 'primary' },
        { label: 'Monto pagado', value: formatAmount(s.paid_amount), icon: 'mdi-cash-check', color: 'success' },
      ],
    },
    { cols: 12, sm: 3, cards: splitCards(s, words) },
  ]
})
</script>

<style scoped>
.payment-summary-card {
  height: 100%;
}
</style>
