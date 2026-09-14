<template>
  <BreadCrumbs :items="links" />

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
        text="No se pudo cargar el documento de pago. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="document">
    <v-card class="mb-4">
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
        <div class="text-h6 font-weight-medium">{{ document.snapshot_name }}</div>
        <div class="text-caption text-medium-emphasis mt-4 mb-1">Matrícula</div>
        <div class="text-body-1">{{ document.enrollment ?? 'Sin matrícula' }}</div>
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title>Retenciones</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Meses retenidos</div>
            <div class="text-body-1">{{ document.carryover_months_count ?? 0 }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">% retenido</div>
            <div class="text-body-1">{{ document.carryover_percentage ?? '0.00' }}</div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Detalle</div>
            <div class="text-body-1">{{ document.carryover_months_detail ?? 'Sin detalle' }}</div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title>Incidencias</v-card-title>
      <v-card-text v-if="document.incidents.length === 0">Sin incidencias registradas.</v-card-text>
      <v-list v-else>
        <v-list-item v-for="incident in document.incidents" :key="incident.id">
          <div class="d-flex align-center ga-2 mb-1">
            <v-chip size="small" variant="tonal">{{ incident.incident_category }}</v-chip>
            <v-chip size="small" variant="tonal">{{ incident.incident_type }}</v-chip>
            <v-chip size="small" :color="incident.is_resolved ? 'success' : 'warning'" variant="tonal">
              {{ incident.is_resolved ? 'Resuelta' : 'Pendiente' }}
            </v-chip>
          </div>
          <div class="text-body-2">{{ incident.description }}</div>
        </v-list-item>
      </v-list>
    </v-card>

    <v-card class="mb-4">
      <v-card-title>Comentarios</v-card-title>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">Atención</div>
        <div class="text-body-1 mb-4">{{ document.atencion_observations ?? 'Sin comentarios' }}</div>

        <div class="text-caption text-medium-emphasis mb-1">Pedagogía</div>
        <div class="text-body-1 mb-4">{{ document.pedagogia_observations ?? 'Sin comentarios' }}</div>

        <div class="text-caption text-medium-emphasis mb-1">Resolución</div>
        <div class="text-body-1">{{ document.resolution_notes ?? 'Sin comentarios' }}</div>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>Desglose de monto</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Monto base</div>
            <div class="text-body-1">${{ document.amount_breakdown.base_amount }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">% descuento</div>
            <div class="text-body-1">{{ document.amount_breakdown.discount_percentage }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Monto descuento</div>
            <div class="text-body-1">${{ document.amount_breakdown.discount_amount }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Pendiente de periodo anterior</div>
            <div class="text-body-1">${{ document.amount_breakdown.amount_pending_from_previous }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Reembolso de periodo anterior</div>
            <div class="text-body-1">${{ document.amount_breakdown.refund_amount_from_previous }}</div>
          </v-col>
          <v-col cols="6" sm="4">
            <div class="text-caption text-medium-emphasis mb-1">Monto final</div>
            <div class="text-body-1">${{ document.amount_breakdown.final_amount }}</div>
          </v-col>
        </v-row>
        <v-divider class="my-4"></v-divider>
        <div class="text-caption text-medium-emphasis mb-1">Total a pagar</div>
        <div class="text-h5">${{ document.amount_breakdown.total_to_pay }}</div>
      </v-card-text>
    </v-card>
  </template>
</template>

<script setup lang="ts">
// Single-becario payment document view (PR6, sdd/becario-payment-file-generation).
// Read-only presentational view — administration's role here is ONLY to
// view the document before processing (spec's resolved scope), never to
// edit it: no form inputs, no save action. The 3 comentario fields
// (atención/pedagogía/resolución) are rendered as 3 separately-labeled
// blocks, never merged into one free-text blob (spec's resolved decision).
import { usePaymentDocumentPage } from '@/composables/usePaymentDocumentPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import type { LinkInterface } from '@/interfaces/link'

const { document, loading, loadError } = usePaymentDocumentPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Pagos', disabled: false, href: '/pagos' },
  { title: 'Documento de pago', disabled: true, href: '#' },
]
</script>
