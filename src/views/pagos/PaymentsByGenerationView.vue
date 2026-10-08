<template>
  <BreadCrumbs :items="links" />

  <GenerationSummaryFilters
    :campus="campus"
    :generation-id="generationId"
    :period-year="periodYear"
    :period-month="periodMonth"
    :campus-options="filteredCampus"
    :generation-options="generationOptions"
    @update:campus="campus = $event"
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
    <v-row v-if="summary.total === 0">
      <v-col cols="12">
        <v-alert
          type="info"
          variant="tonal"
          text="Sin refrendos para esta generación en el periodo seleccionado."
        ></v-alert>
      </v-col>
    </v-row>

    <GenerationPaymentSummary :summary="summary" />
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
// `GenerationPaymentSummary.vue` (sdd/pagos-por-generacion-estado-pago,
// design D6) replaces `PaymentBatchSummary.vue` in this view ONLY — Lotes
// de pago keeps rendering the unmodified `PaymentBatchSummary.vue`. The
// `summary.total === 0` empty-state check below stays valid: `total` is
// still present and still the row count on the new paid/pending/blocked
// shape.
//
// Sede → Generación cascade (user decision 2026-10-08, supersedes design
// D8's single picker): clearing `campus` clears `generationId` too (inside
// the composable), which already falls through `filtersComplete`'s existing
// guard above — no separate sede check needed here.
import { usePaymentsByGenerationPage } from '@/composables/usePaymentsByGenerationPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import GenerationSummaryFilters from '@/components/pagos/GenerationSummaryFilters.vue'
import GenerationPaymentSummary from '@/components/pagos/GenerationPaymentSummary.vue'
import type { LinkInterface } from '@/interfaces/link'

// `generation` (the server-echoed sede/generación block) is intentionally
// NOT destructured here — the standalone label row that used to render it
// was removed (user decision 2026-10-08 follow-up) as redundant with the
// filters above. The composable/store still expose it unchanged; this view
// just stops consuming it.
const {
  campus,
  filteredCampus,
  generationId,
  periodYear,
  periodMonth,
  generationOptions,
  filtersComplete,
  loading,
  loadError,
  summary,
} = usePaymentsByGenerationPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Pagos', disabled: false, href: '/pagos' },
  { title: 'Resumen por generación', disabled: true, href: '/pagos/por-generacion' },
]
</script>
