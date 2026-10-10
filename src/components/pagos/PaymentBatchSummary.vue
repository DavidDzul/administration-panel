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
import { computed } from 'vue'
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

// 3 rows (design D14): counts (cols=6 sm=4), nominal components
// (cols=6 sm=4), aggregates (cols=12 sm=6) — each divides cleanly into the
// Vuetify 12-col grid at every breakpoint.
const cardGroups = computed(() => {
  const s = props.summary
  if (!s) return []

  const groups = [
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
      sm: 4,
      cards: [
        { label: 'Monto total de beca', value: formatAmount(s.beca_amount), icon: 'mdi-school-outline', color: 'info' },
        { label: 'Monto total de apoyo', value: formatAmount(s.apoyo_amount), icon: 'mdi-hand-heart-outline', color: 'info' },
        { label: 'Monto total Pago IU', value: formatAmount(s.pago_iu_amount), icon: 'mdi-cash-sync', color: 'info' },
      ],
    },
    {
      cols: 12,
      sm: 6,
      cards: [
        { label: 'Monto total a pagar', value: formatAmount(s.total_amount), icon: 'mdi-cash-multiple', color: 'primary' },
        { label: 'Diferencia por descuentos y retenciones', value: formatAmount(s.difference_amount), icon: 'mdi-cash-minus', color: 'warning' },
      ],
    },
  ]

  // "Adelanto Telmex" card (sdd/telmex-cobertura-iu PR5, task 5.6) — a 4th
  // row, shown ONLY when telmex_coverage_amount is present and > 0, so the
  // 3-row/8-card layout stays byte-identical for every batch without a
  // covered row (`telmex_coverage_amount` is OPTIONAL — see interfaces/
  // payment.ts's rationale).
  if (Number(s.telmex_coverage_amount ?? 0) > 0) {
    groups.push({
      cols: 12,
      sm: 12,
      cards: [
        {
          label: 'Adelanto Telmex',
          value: formatAmount(s.telmex_coverage_amount as string),
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
