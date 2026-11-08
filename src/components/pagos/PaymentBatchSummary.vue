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
              <div v-if="card.nominal" class="text-caption text-medium-emphasis">Nominal {{ card.nominal }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { netTotal } from '@/utils/paymentBreakdownMeta'
import type { PaymentBatchSummary } from '@/interfaces/payment'

interface Props {
  summary?: PaymentBatchSummary | null
}

const props = withDefaults(defineProps<Props>(), { summary: null })

// Self-contained, matches temporaryIncreaseMeta.ts's/advancePaymentMeta.ts's
// convention of not sharing a money formatter across files (design D13).
// Intl renders negative amounts sign-aware natively (e.g. `-$500.00`) —
// never produce this by prefixing a literal '-' to an already-formatted
// positive string (which yields the incorrect `$-500.00`).
const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

interface SummaryCard {
  label: string
  value: string | number
  icon: string
  color: string | undefined
  // Nominal caption shown under a net total when it differs.
  nominal?: string | null
}

interface CardGroup {
  cols: number
  sm: number
  cards: SummaryCard[]
}

const netCard = (label: string, net: string | undefined, nominal: string, icon: string): SummaryCard => {
  const total = netTotal(net, nominal)
  return { label, value: total.value, icon, color: 'info', nominal: total.nominal }
}

// 3 rows (design D14): counts (cols=6 sm=4), net components (cols=6 sm=4),
// aggregates (cols=12 sm=6, or sm=4 once the Ret./Adelanto card is present) —
// each divides cleanly into the Vuetify 12-col grid at every breakpoint.
const cardGroups = computed<CardGroup[]>(() => {
  const s = props.summary
  if (!s) return []

  const hasRetentionAdvance = s.pending_and_advance_amount !== undefined

  // "Aumento neto" joins the net components only when an increase exists, so
  // batches without one keep the 3-card row; with it the 4 cards fill the
  // grid at sm=3. Together with Telmex and Ret./Adelanto the net cards add up
  // to "Monto total a pagar".
  const nominalIncrease = s.temporary_increase_amount ?? '0.00'
  const hasIncrease = Number(s.net_temporary_increase_amount ?? nominalIncrease) > 0 || Number(nominalIncrease) > 0
  const netComponents: SummaryCard[] = [
    netCard('Total de beca', s.net_beca_amount, s.beca_amount, 'mdi-school-outline'),
    netCard('Total de apoyo', s.net_apoyo_amount, s.apoyo_amount, 'mdi-hand-heart-outline'),
    netCard('Total Pago IU', s.net_pago_iu_amount, s.pago_iu_amount, 'mdi-cash-sync'),
  ]
  if (hasIncrease) {
    netComponents.push(netCard('Aumento neto', s.net_temporary_increase_amount, nominalIncrease, 'mdi-trending-up'))
  }

  const groups: CardGroup[] = [
    {
      cols: 6,
      sm: 4,
      cards: [
        { label: 'Total becarios', value: s.total, icon: 'mdi-account-group-outline', color: undefined },
        { label: 'Listos', value: s.ready, icon: 'mdi-check-circle-outline', color: 'success' },
        { label: 'Bloqueados', value: s.blocking, icon: 'mdi-alert-circle-outline', color: 'error' },
      ],
    },
    {
      cols: 6,
      sm: hasIncrease ? 3 : 4,
      cards: netComponents,
    },
    {
      cols: 12,
      sm: hasRetentionAdvance ? 4 : 6,
      cards: [
        { label: 'Monto total a pagar', value: formatAmount(s.total_amount), icon: 'mdi-cash-multiple', color: 'primary' },
        { label: 'Diferencia por descuentos y retenciones', value: formatAmount(s.difference_amount), icon: 'mdi-cash-minus', color: 'warning' },
      ],
    },
  ]

  if (s.pending_and_advance_amount !== undefined) {
    groups[2].cards.push({
      label: 'Ret./Adelanto',
      value: formatAmount(s.pending_and_advance_amount),
      icon: 'mdi-cash-fast',
      color: 'info',
    })
  }

  // "Adelanto Telmex" card (sdd/telmex-cobertura-iu PR5, task 5.6) — a 4th
  // row, shown ONLY when telmex_coverage_amount is present and > 0, so the
  // 3-row/8-card layout stays byte-identical for every batch without a
  // covered row (`telmex_coverage_amount` is OPTIONAL — see interfaces/
  // payment.ts's rationale).
  const telmexCoverage = s.net_telmex_coverage_amount ?? s.telmex_coverage_amount
  if (Number(telmexCoverage ?? 0) > 0) {
    groups.push({
      cols: 12,
      sm: 12,
      cards: [
        {
          label: 'Adelanto Telmex',
          value: formatAmount(telmexCoverage as string),
          icon: 'mdi-hand-coin-outline',
          color: 'teal',
        },
      ],
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
