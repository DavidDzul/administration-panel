<template>
  <v-row>
    <v-col cols="12" sm="4">
      <v-select
        :items="generationOptions"
        :model-value="generationId"
        item-title="title"
        item-value="value"
        label="Generación"
        clearable
        @update:model-value="(value) => emit('update:generationId', value)"
      ></v-select>
    </v-col>
    <v-col cols="12" sm="4">
      <v-select
        :items="yearOptions"
        :model-value="periodYear"
        label="Año"
        clearable
        @update:model-value="(value) => emit('update:periodYear', value)"
      ></v-select>
    </v-col>
    <v-col cols="12" sm="4">
      <v-select
        :items="monthsArray"
        :model-value="periodMonth"
        item-title="text"
        item-value="value"
        label="Mes"
        clearable
        @update:model-value="(value) => emit('update:periodMonth', value)"
      ></v-select>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Pagos-por-generación filters (sdd/pagos-consulta-por-generacion, design
// File Changes, task 4.2). Pure controlled input, same shape as
// PaymentBatchFilters.vue — this component owns NO fetch/refetch logic
// (that lives in usePaymentsByGenerationPage), each field bound via its own
// `v-model:*` pair from PaymentsByGenerationView.vue. Year window +
// monthsArray copied verbatim from PaymentBatchFilters.vue:70-71.
import { monthsArray } from '@/constants'
import type { GenerationOption } from '@/composables/usePaymentsByGenerationPage'

interface Props {
  generationId: number | null
  periodYear: number | null
  periodMonth: number | null
  generationOptions?: GenerationOption[]
}

withDefaults(defineProps<Props>(), {
  generationOptions: () => [],
})

interface Emits {
  (e: 'update:generationId', value: number | null): void
  (e: 'update:periodYear', value: number | null): void
  (e: 'update:periodMonth', value: number | null): void
}

const emit = defineEmits<Emits>()

// Same rationale as PaymentBatchFilters.vue: no fetched source for "año"
// exists, so a small rolling window around the current year is generated
// locally.
const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
</script>
