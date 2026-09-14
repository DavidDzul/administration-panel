<template>
  <v-row>
    <v-col cols="12" sm="3">
      <v-select
        :items="campusOptions"
        :model-value="campus"
        item-title="text"
        item-value="value"
        label="Sede"
        clearable
        @update:model-value="onCampusChange"
      ></v-select>
    </v-col>
    <v-col cols="12" sm="3">
      <v-select
        :items="filteredGenerations"
        :model-value="generationId"
        item-title="generation_name"
        item-value="id"
        label="Generación"
        clearable
        :disabled="!campus"
        @update:model-value="(value) => emit('update:generationId', value)"
      ></v-select>
    </v-col>
    <v-col cols="12" sm="3">
      <v-select
        :items="yearOptions"
        :model-value="periodYear"
        label="Año"
        clearable
        @update:model-value="(value) => emit('update:periodYear', value)"
      ></v-select>
    </v-col>
    <v-col cols="12" sm="3">
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
// 4 fields are REQUIRED server params for a batch key. This component owns
// NO fetch/refetch logic itself (that lives in usePaymentsPage) — it is a
// pure controlled input, each field bound via its own `v-model:*` pair from
// PaymentsView.vue. Sede + Generación reuse the exact selector pattern from
// UsersTable.vue (`filteredCampus`/`filteredGenerations` sourcing).
import { computed } from 'vue'
import type { Generation } from '@/interfaces/generation'
import type { SelectOption } from '@/constants'
import { monthsArray } from '@/constants'

interface Props {
  campus: string | null
  generationId: number | null
  periodYear: number | null
  periodMonth: number | null
  generations?: Generation[]
  campusOptions?: SelectOption[]
}

const props = withDefaults(defineProps<Props>(), {
  generations: () => [],
  campusOptions: () => [],
})

interface Emits {
  (e: 'update:campus', value: string | null): void
  (e: 'update:generationId', value: number | null): void
  (e: 'update:periodYear', value: number | null): void
  (e: 'update:periodMonth', value: number | null): void
}

const emit = defineEmits<Emits>()

const filteredGenerations = computed<Generation[]>(() => props.generations.filter((g) => g.campus === props.campus))

// No fetched source for "año" exists (unlike sede/generación) — design does
// not specify one, so a small rolling window around the current year is
// generated locally. Pragmatic UI choice, easy to widen later if a real
// payroll history needs older periods.
const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

const onCampusChange = (value: string | null): void => {
  emit('update:campus', value)
  // A campus change invalidates the previously selected generación — same
  // guard as UsersTable.vue's `watch(campus, () => (generation_id = null))`.
  emit('update:generationId', null)
}
</script>
