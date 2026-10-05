<template>
  <v-row>
    <v-col cols="12" sm="4">
      <v-select
        :items="campusOptions"
        :model-value="campus"
        item-title="text"
        item-value="value"
        label="Sede"
        clearable
        @update:model-value="(value) => emit('update:campus', value)"
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
// Pagos batch filters — D7 (sdd/becario-payment-file-generation/design): all
// 3 fields are REQUIRED server params for a batch key (sdd/pagos-batch-sede-
// totals: batch key is campus+period only, generation_id/Generación selector
// removed). This component owns NO fetch/refetch logic itself (that lives in
// usePaymentsPage) — it is a pure controlled input, each field bound via its
// own `v-model:*` pair from PaymentsView.vue.
import type { SelectOption } from '@/constants'
import { monthsArray } from '@/constants'

interface Props {
  campus: string | null
  periodYear: number | null
  periodMonth: number | null
  campusOptions?: SelectOption[]
}

withDefaults(defineProps<Props>(), {
  campusOptions: () => [],
})

interface Emits {
  (e: 'update:campus', value: string | null): void
  (e: 'update:periodYear', value: number | null): void
  (e: 'update:periodMonth', value: number | null): void
}

const emit = defineEmits<Emits>()

// No fetched source for "año" exists (unlike sede) — design does not specify
// one, so a small rolling window around the current year is generated
// locally. Pragmatic UI choice, easy to widen later if a real payroll
// history needs older periods.
const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]
</script>
