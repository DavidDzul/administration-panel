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

  return [
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
})
</script>

<style scoped>
.payment-summary-card {
  height: 100%;
}
</style>
