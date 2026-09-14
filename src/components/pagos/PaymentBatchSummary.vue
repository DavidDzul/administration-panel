<template>
  <v-row v-if="summary" class="mb-2">
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">Total becarios</div>
          <div class="text-h5">{{ summary.total }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="success">
        <v-card-text>
          <div class="text-caption">Listos</div>
          <div class="text-h5">{{ summary.ready }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="error">
        <v-card-text>
          <div class="text-caption">Bloqueados</div>
          <div class="text-h5">{{ summary.blocking }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">Monto total</div>
          <div class="text-h5">${{ summary.total_amount }}</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { PaymentBatchSummary } from '@/interfaces/payment'

interface Props {
  summary?: PaymentBatchSummary | null
}

withDefaults(defineProps<Props>(), { summary: null })
</script>
