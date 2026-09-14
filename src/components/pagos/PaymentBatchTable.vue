<template>
  <v-data-table :headers="headers" :items="rows" :loading="loading" item-value="refrend_id" class="elevation-1">
    <template #[`item.total_to_pay`]="{ item }"> ${{ item.total_to_pay }} </template>

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
// "Ver" only expresses navigation intent toward the PR6 document route
// (`/pagos/:refrendId`); that route does not need to exist yet for this
// batch.
import { useRouter } from 'vue-router'
import type { PaymentBatchRow } from '@/interfaces/payment'

interface Props {
  rows?: PaymentBatchRow[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  rows: () => [],
  loading: false,
})

const router = useRouter()

const headers = [
  { title: 'Nombre', key: 'snapshot_name' },
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'Monto', key: 'total_to_pay' },
  { title: 'Estado', key: 'status' },
  { title: '', key: 'actions' },
]

const onView = (refrendId: number): void => {
  router.push(`/pagos/${refrendId}`)
}
</script>
