<template>
  <v-data-table :headers="tableHeaders" :items="coverages" class="elevation-1" :loading="loading" item-value="id">
    <template #[`item.becario_name`]="{ item }">
      <button
        type="button"
        class="telmex-coverage-name-link"
        data-testid="telmex-coverage-name-link"
        :aria-label="`Ver detalle de cobertura Telmex de ${item.becario_name}`"
        @click="router.push(`/becas-telmex/${item.id}`)"
      >
        {{ item.becario_name }}
      </button>
    </template>

    <template #[`item.campus`]="{ item }">
      {{ campusLabel(item.campus) }}
    </template>

    <template #[`item.generation`]="{ item }">
      {{ item.generation ?? '—' }}
    </template>

    <template #[`item.type`]="{ item }">
      <v-chip size="small" variant="tonal" color="teal">{{ typeLabel(item.scholarship_type_at_activation) }}</v-chip>
    </template>

    <template #[`item.status`]="{ item }">
      <v-chip size="small" :color="telmexCoverageStatusMeta(item.status).color" variant="flat">
        {{ telmexCoverageStatusMeta(item.status).label }}
      </v-chip>
    </template>

    <template #[`item.period`]="{ item }">
      {{ formatPeriod(item.start_period) }} — {{ item.end_period ? formatPeriod(item.end_period) : 'Presente' }}
    </template>

    <template #[`item.advanced`]="{ item }">{{ formatCurrency(item.advanced) }}</template>
    <template #[`item.repaid`]="{ item }">{{ formatCurrency(item.repaid) }}</template>
    <template #[`item.balance`]="{ item }">{{ formatCurrency(item.balance) }}</template>

    <!--
      Three row actions, each gated on `canManage` AND the lifecycle state
      that makes it valid (spec: "Lifecycle" requirement; decisions-2 #1921
      dec3 for reactivate). No dedicated dialog here for reactivate — it
      needs no input beyond confirmation, so the view confirms inline
      (mirrors RolesTable/AccesosTable's "eye-only, no extra dialog"
      precedent for actions that don't need a form).
    -->
    <template #[`item.actions`]="{ item }">
      <div style="width: 100%; text-align: right">
        <v-tooltip v-if="canManage && item.status === 'ACTIVA'" text="Marcar inicio de pago Telmex" location="bottom">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="primary"
                density="comfortable"
                icon="mdi-cash-check"
                size="small"
                @click="emit('end', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>

        <v-tooltip v-if="canManage && (item.status === 'ACTIVA' || item.status === 'EN_COBRO')" text="Cancelar" location="bottom">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="error"
                density="comfortable"
                icon="mdi-close-circle-outline"
                size="small"
                @click="emit('cancel', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>

        <v-tooltip
          v-if="canManage && item.status === 'CANCELADA' && !item.has_paid_covered_month"
          text="Reactivar"
          location="bottom"
        >
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="success"
                density="comfortable"
                icon="mdi-restore"
                size="small"
                @click="emit('reactivate', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>
      </div>
    </template>
    <template #no-data>No existen datos registrados</template>
  </v-data-table>
</template>

<script setup lang="ts">
// Becario name is a clickable link to the detail route (sdd/telmex-
// cobertura-iu PR5, task 5.1, UX notes: "becario name as link, like
// Lotes"). Styled as a link (mirrors PaymentBatchTable.vue's
// `.payment-name-link` button), but NAVIGATES via router.push — unlike
// Lotes' name link (which opens a dialog) — because PR5 introduces a real
// routed detail view, mirroring AccesosTable.vue's eye-icon
// `router.push` precedent instead.
import { useRouter } from 'vue-router'
import { campusMap } from '@/constants'
import { telmexCoverageStatusMeta } from '@/utils/telmexCoverageStatusMeta'
import type { TelmexCoverage, TelmexCoverageScholarshipType } from '@/interfaces/telmexCoverage'

const router = useRouter()

interface Props {
  coverages?: TelmexCoverage[]
  loading?: boolean
  canManage?: boolean
}

withDefaults(defineProps<Props>(), {
  coverages: () => [],
  loading: false,
  canManage: false,
})

interface Emits {
  (e: 'end', coverage: TelmexCoverage): void
  (e: 'cancel', coverage: TelmexCoverage): void
  (e: 'reactivate', coverage: TelmexCoverage): void
}

const emit = defineEmits<Emits>()

const tableHeaders = [
  { title: 'Becario', key: 'becario_name' },
  { title: 'Sede', key: 'campus' },
  { title: 'Generación', key: 'generation' },
  { title: 'Tipo', key: 'type' },
  { title: 'Estado', key: 'status' },
  { title: 'Periodo cubierto', key: 'period' },
  { title: 'Adelantado', key: 'advanced' },
  { title: 'Devuelto', key: 'repaid' },
  { title: 'Saldo', key: 'balance' },
  { title: '', key: 'actions' },
]

const campusLabel = (campus: string): string => campusMap.get(campus)?.text ?? campus

const typeLabel = (type: TelmexCoverageScholarshipType): string => (type === 'TELMEX_IU' ? 'Telmex - IU' : 'Telmex')

// `start_period`/`end_period` are "YYYY-MM-DD" (1st of month, design's data
// model) — sliced directly instead of parsed through `Date` to avoid any
// timezone-shift surprises on a date-only value.
const formatPeriod = (period: string): string => `${period.slice(5, 7)}/${period.slice(0, 4)}`

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))
</script>

<style scoped>
/* Becario name cell (PR5, task 5.1) — mirrors PaymentBatchTable.vue's
   `.payment-name-link` button styling exactly, but this one navigates. */
.telmex-coverage-name-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  text-align: left;
}

.telmex-coverage-name-link:hover {
  text-decoration: underline;
}

.telmex-coverage-name-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
