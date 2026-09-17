<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="900px"
    scrollable
  >
    <v-card>
      <v-toolbar dark>
        <v-toolbar-title>Documento de pago</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-toolbar-items>
          <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-card-text>
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
          <v-tabs v-model="tab">
            <v-tab value="resumen">Resumen</v-tab>
            <v-tab value="incidencias">Incidencias</v-tab>
            <v-tab value="comentarios">Comentarios</v-tab>
            <v-tab value="desglose">Desglose de monto</v-tab>
            <v-tab value="retenciones">Retenciones</v-tab>
          </v-tabs>

          <v-window v-model="tab" class="mt-4">
            <v-window-item value="resumen">
              <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
              <div class="text-h6 font-weight-medium">{{ document.snapshot_name }}</div>
              <div class="text-caption text-medium-emphasis mt-4 mb-1">Matrícula</div>
              <div class="text-body-1 mb-4">{{ document.enrollment ?? 'Sin matrícula' }}</div>

              <v-divider class="mb-4"></v-divider>

              <div class="text-subtitle-1 font-weight-medium mb-2">Retenciones</div>
              <v-row>
                <v-col cols="6" sm="4">
                  <div class="text-caption text-medium-emphasis mb-1">Meses retenidos</div>
                  <div class="text-body-1">{{ document.carryover_months_count ?? 0 }}</div>
                </v-col>
                <v-col cols="12" sm="8">
                  <div class="text-caption text-medium-emphasis mb-1">Detalle</div>
                  <div class="text-body-1">{{ document.carryover_months_detail ?? 'Sin detalle' }}</div>
                </v-col>
              </v-row>
            </v-window-item>

            <v-window-item value="incidencias">
              <div v-if="document.incidents.length === 0">Sin incidencias registradas.</div>
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
            </v-window-item>

            <v-window-item value="comentarios">
              <div class="text-caption text-medium-emphasis mb-1">Atención</div>
              <div class="text-body-1 mb-4">{{ document.atencion_observations ?? 'Sin comentarios' }}</div>

              <div class="text-caption text-medium-emphasis mb-1">Pedagogía</div>
              <div class="text-body-1 mb-4">{{ document.pedagogia_observations ?? 'Sin comentarios' }}</div>

              <div class="text-caption text-medium-emphasis mb-1">Resolución</div>
              <div class="text-body-1">{{ document.resolution_notes ?? 'Sin comentarios' }}</div>
            </v-window-item>

            <v-window-item value="desglose">
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
            </v-window-item>

            <v-window-item value="retenciones">
              <RetentionBreakdownPanel :retentions="document.retentions" />
            </v-window-item>
          </v-window>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Follow-up to PR6 (sdd/becario-payment-file-generation): the single-becario
// payment document moved from a routed page (`/pagos/:refrendId`,
// PaymentDocumentView.vue, now deleted) to this modal, opened directly from
// PaymentBatchTable's "Ver" action, so a reviewer can go through a whole
// batch without losing the table's filter/scroll context. Content below is
// the same verified field mapping from PaymentDocumentView.vue, only
// redistributed across tabs — never re-derived. Still read-only: no form
// inputs, no save action, and the 3 comentario fields
// (atención/pedagogía/resolución) stay separately labeled, never merged.
import { ref, toRef, watch } from 'vue'
import { usePaymentDocumentPage } from '@/composables/usePaymentDocumentPage'
import RetentionBreakdownPanel from '@/components/pagos/RetentionBreakdownPanel.vue'

interface Props {
  modelValue: boolean
  refrendId: number | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const emit = defineEmits<Emits>()

const { document, loading, loadError } = usePaymentDocumentPage(toRef(props, 'refrendId'))

const tab = ref('resumen')

// Always starts on the first tab for each becario, same "reset on open"
// convention as CreateAccesoDialog.vue's resetForm().
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) tab.value = 'resumen'
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}
</script>
