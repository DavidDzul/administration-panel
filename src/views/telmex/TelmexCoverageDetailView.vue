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
        text="No se pudo cargar la información de esta cobertura Telmex. Intenta de nuevo más tarde."
      ></v-alert>
    </v-col>
  </v-row>

  <template v-else-if="coverage">
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis mb-1">Becario</div>
            <div class="text-h6 font-weight-medium">{{ coverage.becario_name }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis mb-1">Tipo</div>
            <v-chip size="small" variant="tonal" color="teal">{{ typeLabel }}</v-chip>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis mb-1">Estado</div>
            <v-chip size="small" :color="telmexCoverageStatusMeta(coverage.status).color" variant="flat">
              {{ telmexCoverageStatusMeta(coverage.status).label }}
            </v-chip>
          </v-col>
          <v-col cols="12">
            <div class="text-caption text-medium-emphasis mb-1">Periodo cubierto</div>
            <div class="text-body-1">{{ periodLabel }}</div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-row class="mb-2">
      <v-col cols="12" sm="4">
        <v-card variant="tonal" color="info">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Adelantado</div>
            <div class="text-h5 font-weight-medium">{{ formatCurrency(coverage.advanced) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="tonal" color="success">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">Devuelto</div>
            <div class="text-h5 font-weight-medium">{{ formatCurrency(coverage.repaid) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="tonal" :color="coverage.status === 'CANCELADA' ? 'blue-grey' : 'warning'">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">
              Saldo{{ coverage.status === 'CANCELADA' ? ' (cancelado)' : '' }}
            </div>
            <div class="text-h5 font-weight-medium">{{ formatCurrency(coverage.balance) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <CoverageStatement
      :months="months"
      :payments="payments"
      :coverage-status="coverage.status"
      :can-manage-repayments="canManageRepayments"
      @register="registerDialogOpen = true"
      @void="openVoidDialog"
    />
  </template>

  <RegisterRepaymentDialog
    v-model="registerDialogOpen"
    :coverage-id="coverage?.id ?? null"
    :balance="coverage?.balance ?? '0'"
    @registered="onRegistered"
  />
  <VoidRepaymentDialog
    v-model="voidDialogOpen"
    :coverage-id="coverage?.id ?? null"
    :payment="selectedPayment"
    @voided="onVoided"
  />
</template>

<script setup lang="ts">
// Becas Telmex detail view (sdd/telmex-cobertura-iu, PR5, task 5.1) —
// mirrors AccesoDetailView.vue's loading/error/populated branching and
// useAlertStore-free convention here (the dialogs themselves show their
// own alerts, same split as TelmexCoveragesView.vue's PR4 dialogs). Header
// + 3 summary cards (Adelantado/Devuelto/Saldo) per the UX notes; Saldo is
// labeled "(cancelado)" when the coverage is CANCELADA (amendment #1918:
// "display the remaining balance as cancelled, not active debt") — the
// NUMBER itself is still shown (never hidden), only the label changes.
import { computed, ref } from 'vue'
import { useTelmexCoverageDetailPage } from '@/composables/useTelmexCoverageDetailPage'
import { telmexCoverageStatusMeta } from '@/utils/telmexCoverageStatusMeta'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import CoverageStatement from '@/components/telmex/CoverageStatement.vue'
import RegisterRepaymentDialog from '@/components/telmex/RegisterRepaymentDialog.vue'
import VoidRepaymentDialog from '@/components/telmex/VoidRepaymentDialog.vue'
import type { LinkInterface } from '@/interfaces/link'
import type { TelmexCoveragePayment } from '@/interfaces/telmexCoverage'

const { coverage, months, payments, loading, loadError, canManageRepayments, refresh } =
  useTelmexCoverageDetailPage()

const links = computed<LinkInterface[]>(() => [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Becas Telmex', disabled: false, href: '/becas-telmex' },
  { title: coverage.value?.becario_name ?? 'Detalle', disabled: true, href: '#' },
])

const typeLabel = computed(() => (coverage.value?.scholarship_type_at_activation === 'TELMEX_IU' ? 'Telmex - IU' : 'Telmex'))

// `start_period`/`end_period` are "YYYY-MM-DD" — sliced directly, same
// convention as TelmexCoveragesTable.vue's `formatPeriod`.
const formatPeriod = (period: string): string => `${period.slice(5, 7)}/${period.slice(0, 4)}`

const periodLabel = computed(() => {
  const c = coverage.value
  if (!c) return ''
  return `${formatPeriod(c.start_period)} — ${c.end_period ? formatPeriod(c.end_period) : 'Presente'}`
})

const formatCurrency = (amount: string | number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const registerDialogOpen = ref(false)
const voidDialogOpen = ref(false)
const selectedPayment = ref<TelmexCoveragePayment | null>(null)

const openVoidDialog = (payment: TelmexCoveragePayment): void => {
  selectedPayment.value = payment
  voidDialogOpen.value = true
}

// The ledger (advanced/repaid/balance/status) is entirely server-derived
// (design D8) — re-fetching the whole statement after a successful write
// is simpler and safer than trying to recompute it client-side.
const onRegistered = async (): Promise<void> => {
  registerDialogOpen.value = false
  await refresh()
}

const onVoided = async (): Promise<void> => {
  voidDialogOpen.value = false
  await refresh()
}
</script>
