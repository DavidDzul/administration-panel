<template>
  <v-row v-if="summary" class="mb-2">
    <v-col v-for="card in cards" :key="card.label" cols="6" sm="3">
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

<script setup lang="ts">
import { computed } from 'vue'
import type { PaymentBatchSummary } from '@/interfaces/payment'

interface Props {
  summary?: PaymentBatchSummary | null
}

const props = withDefaults(defineProps<Props>(), { summary: null })

// Icon + color per card, matching the vocabulary already used elsewhere in
// Pagos (BankFileExportCard/PaymentBatchTable): success=ready, error=blocked,
// primary=money. "Total becarios" stays neutral since it's not a status.
const cards = computed(() => {
  const s = props.summary
  if (!s) return []
  return [
    { label: 'Total becarios', value: s.total, icon: 'mdi-account-group-outline', color: undefined },
    { label: 'Listos', value: s.ready, icon: 'mdi-check-circle-outline', color: 'success' },
    { label: 'Bloqueados', value: s.blocking, icon: 'mdi-alert-circle-outline', color: 'error' },
    { label: 'Monto total', value: `$${s.total_amount}`, icon: 'mdi-cash-multiple', color: 'primary' },
  ]
})
</script>

<style scoped>
.payment-summary-card {
  height: 100%;
}
</style>
