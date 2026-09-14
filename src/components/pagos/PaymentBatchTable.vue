<template>
  <v-data-table :headers="headers" :items="rows" :loading="loading" item-value="refrend_id" class="elevation-1">
    <template #[`item.total_to_pay`]="{ item }"> ${{ item.total_to_pay }} </template>

    <template #[`item.account_number`]="{ item }">
      {{ maskAccountNumber(item.account_number) }}
    </template>

    <template #[`item.flags`]="{ item }">
      <v-chip
        v-if="item.has_incident"
        size="small"
        color="warning"
        variant="tonal"
        prepend-icon="mdi-alert-circle-outline"
        class="mr-1 mb-1"
      >
        Incidencia registrada
      </v-chip>
      <v-chip
        v-if="item.has_pending_from_previous"
        size="small"
        color="info"
        variant="tonal"
        prepend-icon="mdi-cash-clock"
        class="mb-1"
      >
        Incluye mes retenido
      </v-chip>
    </template>

    <template #[`item.status`]="{ item }">
      <v-chip :color="item.is_payable ? 'success' : 'error'" size="small" variant="tonal">
        {{ item.is_payable ? 'Listo' : 'Bloqueado' }}
      </v-chip>
      <div v-if="!item.is_payable" class="text-caption text-error mt-1">
        {{ item.blocking_reasons.map((reason) => reason.message).join(', ') }}
      </div>
    </template>

    <template #[`item.actions`]="{ item }">
      <v-btn variant="text" color="warning" density="comfortable" size="small" @click="onView(item.refrend_id)">
        Ver
      </v-btn>
    </template>

    <template #no-data>No hay becarios en este lote</template>
  </v-data-table>
</template>

<script setup lang="ts">
// Purely presentational (D7) — receives rows as props, no internal
// fetching. Filter state + refetch live in usePaymentsPage/PaymentsView.
// "Ver" emits an intent upward instead of navigating (sdd/becario-payment-
// batch-indicators): the document moved from a routed page to a dialog, and
// PaymentsView owns the dialog's open/refrendId state, same as it already
// owns ProcessPaymentDialog's `dialogOpen`. `has_incident` /
// `has_pending_from_previous` and the masked account number are quick-glance
// additions for a reviewer going through a whole batch (impulsou-api commit
// eba5c3d) — purely informational, they never affect `is_payable`.
import { maskAccountNumber } from '@/utils/maskAccountNumber'
import type { PaymentBatchRow } from '@/interfaces/payment'

interface Props {
  rows?: PaymentBatchRow[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  rows: () => [],
  loading: false,
})

interface Emits {
  (e: 'view', refrendId: number): void
}

const emit = defineEmits<Emits>()

const headers = [
  { title: 'Nombre', key: 'snapshot_name' },
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'Cuenta', key: 'account_number' },
  { title: 'Monto', key: 'total_to_pay' },
  { title: '', key: 'flags' },
  { title: 'Estado', key: 'status' },
  { title: '', key: 'actions' },
]

const onView = (refrendId: number): void => {
  emit('view', refrendId)
}
</script>
