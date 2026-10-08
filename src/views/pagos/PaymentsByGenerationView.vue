<template>
  <BreadCrumbs :items="links" />

  <GenerationSummaryFilters
    :generation-id="generationId"
    :period-year="periodYear"
    :period-month="periodMonth"
    :generation-options="generationOptions"
    @update:generation-id="generationId = $event"
    @update:period-year="periodYear = $event"
    @update:period-month="periodMonth = $event"
  />

  <v-row v-if="loading">
    <v-col cols="12" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-col>
  </v-row>

  <v-row v-else-if="loadError">
    <v-col cols="12">
      <v-alert
        type="error"
        variant="tonal"
        title="Error al cargar la información"
        text="No se pudo cargar el resumen de pagos. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-else-if="!filtersComplete || !summary">
    <v-col cols="12">
      <v-alert
        type="info"
        variant="tonal"
        text="Selecciona una generación, año y mes para ver el resumen."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else>
    <v-row v-if="generation">
      <v-col cols="12">
        <div class="text-subtitle-2 text-medium-emphasis mb-2">{{ generation.generation_name }} — {{ generation.campus }}</div>
      </v-col>
    </v-row>

    <v-row v-if="summary.total === 0">
      <v-col cols="12">
        <v-alert
          type="info"
          variant="tonal"
          text="Sin refrendos para esta generación en el periodo seleccionado."
        ></v-alert>
      </v-col>
    </v-row>

    <PaymentBatchSummary :summary="summary" />
  </template>
</template>

<script setup lang="ts">
// Pagos-por-generación read-only view (sdd/pagos-consulta-por-generacion,
// design D9, task 4.4). State ladder mirrors PaymentsView.vue:14-31 exactly,
// with one extra rung inserted BEFORE the empty-state check: `!summary`
// covers both "filters not complete yet" (neutral prompt, per spec) and
// handles the general shape — `loading`/`loadError` are checked first so a
// stale `summary` from a previous successful fetch can never leak through
// once a later fetch fails (store never clears `summary` on failure).
// `filtersComplete` guards the same stale `summary` when a clearable filter
// is emptied after a successful load: no refetch fires, so the previous
// generación's cards would otherwise stay on screen.
// `PaymentBatchSummary.vue` is reused completely unmodified.
import { usePaymentsByGenerationPage } from '@/composables/usePaymentsByGenerationPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import GenerationSummaryFilters from '@/components/pagos/GenerationSummaryFilters.vue'
import PaymentBatchSummary from '@/components/pagos/PaymentBatchSummary.vue'
import type { LinkInterface } from '@/interfaces/link'

const {
  generationId,
  periodYear,
  periodMonth,
  generationOptions,
  filtersComplete,
  loading,
  loadError,
  summary,
  generation,
} = usePaymentsByGenerationPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Pagos', disabled: false, href: '/pagos' },
  { title: 'Resumen por generación', disabled: true, href: '/pagos/por-generacion' },
]
</script>
