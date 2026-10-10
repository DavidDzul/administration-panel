<template>
  <BreadCrumbs :items="links" />

  <v-row v-if="canManage" justify="end">
    <v-col cols="auto">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="activateDialogOpen = true">Activar cobertura</v-btn>
    </v-col>
  </v-row>

  <v-row v-if="canManage && eligibleLoadError">
    <v-col cols="12">
      <v-alert
        type="warning"
        variant="tonal"
        density="compact"
        text="No se pudo cargar la lista de becarios para activar una cobertura. Recarga la página antes de activar una."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-if="!loading && !loadError">
    <v-col cols="12" sm="4">
      <v-select
        v-model="statusFilter"
        label="Estado"
        :items="statusOptions"
        item-title="text"
        item-value="value"
        clearable
      ></v-select>
    </v-col>
    <v-col cols="12" sm="8">
      <v-text-field v-model="search" label="Buscar becario" prepend-inner-icon="mdi-magnify" clearable></v-text-field>
    </v-col>
  </v-row>

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
        text="No se pudo cargar la lista de coberturas Telmex. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12">
      <TelmexCoveragesTable
        :coverages="coverages"
        :can-manage="canManage"
        @end="openEndDialog"
        @cancel="openCancelDialog"
        @reactivate="openReactivateConfirm"
      />
    </v-col>
  </v-row>

  <ActivateCoverageDialog
    v-model="activateDialogOpen"
    :eligible-becarios="eligibleBecarios"
    @activated="onActivated"
  />
  <EndCoverageDialog v-model="endDialogOpen" :coverage="selectedCoverage" @ended="onEnded" />
  <CancelCoverageDialog v-model="cancelDialogOpen" :coverage="selectedCoverage" @cancelled="onCancelled" />

  <!--
    Reactivate needs no form input beyond confirmation (decisions-2 #1921
    dec3), so it is a plain confirm dialog here instead of a 4th dedicated
    dialog component — mirrors RolesTable/AccesosTable's "no extra dialog for
    actions that don't need a form" precedent.
  -->
  <v-dialog v-model="reactivateDialogOpen" max-width="420px">
    <v-card v-if="selectedCoverage">
      <v-card-title>Reactivar cobertura</v-card-title>
      <v-card-text>
        ¿Reactivar la cobertura Telmex de <strong>{{ selectedCoverage.becario_name }}</strong
        >? No hubo meses pagados, así que se puede reactivar sin afectar el historial.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="reactivateDialogOpen = false">Cerrar</v-btn>
        <v-btn color="success" variant="text" :loading="reactivating" @click="confirmReactivate">Reactivar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Becas Telmex list view (sdd/telmex-cobertura-iu, PR4, tasks 4.4/4.7).
// Mirrors AccesosView.vue's structure: composable owns fetch + filters, this
// view only wires the table and the 3 form dialogs + 1 confirm-only action.
import { ref } from 'vue'
import { useTelmexCoveragesPage } from '@/composables/useTelmexCoveragesPage'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import TelmexCoveragesTable from '@/components/telmex/TelmexCoveragesTable.vue'
import ActivateCoverageDialog from '@/components/telmex/ActivateCoverageDialog.vue'
import EndCoverageDialog from '@/components/telmex/EndCoverageDialog.vue'
import CancelCoverageDialog from '@/components/telmex/CancelCoverageDialog.vue'
import type { LinkInterface } from '@/interfaces/link'
import type { TelmexCoverage } from '@/interfaces/telmexCoverage'

const { coverages, eligibleBecarios, loading, loadError, eligibleLoadError, statusFilter, search, canManage } =
  useTelmexCoveragesPage()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becas Telmex', disabled: true, href: '/becas-telmex' },
]

const statusOptions = [
  { value: 'ACTIVA', text: 'Activa' },
  { value: 'EN_COBRO', text: 'En cobro' },
  { value: 'LIQUIDADA', text: 'Liquidada' },
  { value: 'CANCELADA', text: 'Cancelada' },
]

const activateDialogOpen = ref(false)
const endDialogOpen = ref(false)
const cancelDialogOpen = ref(false)
const reactivateDialogOpen = ref(false)
const reactivating = ref(false)
const selectedCoverage = ref<TelmexCoverage | null>(null)

const onActivated = (): void => {
  activateDialogOpen.value = false
}

const openEndDialog = (coverage: TelmexCoverage): void => {
  selectedCoverage.value = coverage
  endDialogOpen.value = true
}

const onEnded = (): void => {
  endDialogOpen.value = false
}

const openCancelDialog = (coverage: TelmexCoverage): void => {
  selectedCoverage.value = coverage
  cancelDialogOpen.value = true
}

const onCancelled = (): void => {
  cancelDialogOpen.value = false
}

const openReactivateConfirm = (coverage: TelmexCoverage): void => {
  selectedCoverage.value = coverage
  reactivateDialogOpen.value = true
}

const confirmReactivate = async (): Promise<void> => {
  if (!selectedCoverage.value) return

  reactivating.value = true
  try {
    await telmexCoverageStore.reactivateCoverage(selectedCoverage.value.id)
    showAlert({ title: 'Cobertura Telmex reactivada exitosamente.', status: 'success' })
    reactivateDialogOpen.value = false
  } catch (error: unknown) {
    console.error('Error al reactivar la cobertura Telmex:', error)
    const err = error as { response?: { data?: { msg?: string } } }
    showAlert({
      title: err.response?.data?.msg ?? 'Error al reactivar la cobertura, intenta nuevamente.',
      status: 'error',
    })
  } finally {
    reactivating.value = false
  }
}
</script>
