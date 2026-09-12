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
        text="No se pudo cargar la información de este becario. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="selectedPerson">
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis mb-1">Nombre</div>
            <div class="font-weight-medium">
              {{ selectedPerson.first_name }} {{ selectedPerson.last_name }}
            </div>
          </v-col>
          <v-col cols="6" md="2">
            <div class="text-caption text-medium-emphasis mb-1">Matrícula</div>
            <div class="font-weight-medium">{{ selectedPerson.enrollment || 'N/A' }}</div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis mb-1">Sede</div>
            <div class="font-weight-medium">{{ selectedPerson.campus }}</div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-caption text-medium-emphasis mb-1">Tipo</div>
            <div class="font-weight-medium">
              {{ selectedPerson.user_type === 'BEC_ACTIVE' ? 'Becario activo' : 'Becario inactivo' }}
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-row>
      <v-col cols="12">
        <!-- Single panel per spec R6 — no calificaciones/documentos/historial
             here. `model-value="0"` opens it by default: this is the whole
             reason an admin navigates to /becarios/:id, so payment data
             should be visible immediately, not hidden behind an extra
             click. -->
        <v-expansion-panels model-value="0">
          <v-expansion-panel title="Datos de pago">
            <v-expansion-panel-text>
              <div data-testid="payment-data-panel-placeholder"></div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </template>
</template>

<script setup lang="ts">
import { usePersonDetailsPage } from '@/composables/usePersonDetailsPage'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import type { LinkInterface } from '@/interfaces/link'

const { selectedPerson, loading, loadError } = usePersonDetailsPage()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becarios y egresados', disabled: false, href: '/becarios' },
  { title: 'Detalles del becario', disabled: true, href: '#' },
]
</script>
