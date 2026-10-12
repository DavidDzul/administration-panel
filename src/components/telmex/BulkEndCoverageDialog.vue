<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="560px"
    persistent
  >
    <v-card>
      <v-toolbar dark>
        <v-toolbar-title>Marcar inicio de pago Telmex</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-toolbar-items v-if="step === 'confirm'">
          <v-btn icon :disabled="saving" @click="close"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-form v-if="step === 'confirm'" ref="formRef" @submit.prevent="onConfirm">
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <p class="text-body-2">
                Se marcará el inicio de pago Telmex para <strong>{{ coverages.length }}</strong> becario(s).
              </p>
              <p class="text-body-2 text-medium-emphasis">
                Elige el PRIMER mes en que Telmex empieza a pagar directamente. A partir de ese mes, IU deja de
                pagar la parte de Telmex; en becas Telmex - IU, la parte de IU se sigue pagando.
              </p>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="telmexStartPeriod"
                type="month"
                label="Telmex empieza a pagar en *"
                :rules="[requiredRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12" v-if="monthInWords">
              <p class="text-body-2">
                Mes seleccionado: <strong>{{ monthInWords }}</strong>
              </p>
              <p class="text-body-2 text-medium-emphasis">Último mes cubierto por IU: {{ lastIuMonthLabel }}</p>
            </v-col>
            <v-col cols="12">
              <v-list density="compact" max-height="200" class="overflow-y-auto border rounded">
                <v-list-item v-for="coverage in coverages" :key="coverage.id" :title="coverage.becario_name" />
              </v-list>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" :disabled="saving" @click="close">Cancelar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving" :disabled="saving">Confirmar</v-btn>
        </v-card-actions>
      </v-form>

      <template v-else>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <p class="text-subtitle-1">Marcados ({{ result?.ended.length ?? 0 }})</p>
              <v-list density="compact">
                <v-list-item v-for="item in result?.ended ?? []" :key="`ended-${item.coverage_id}`">
                  <template #prepend><v-icon color="success">mdi-check-circle</v-icon></template>
                  {{ item.becario_name ?? `Cobertura #${item.coverage_id}` }}
                </v-list-item>
              </v-list>
            </v-col>
            <v-col cols="12" v-if="(result?.failed.length ?? 0) > 0">
              <p class="text-subtitle-1">No marcados ({{ result?.failed.length }})</p>
              <v-list density="compact">
                <v-list-item v-for="item in result?.failed ?? []" :key="`failed-${item.coverage_id}`">
                  <template #prepend><v-icon color="warning">mdi-alert</v-icon></template>
                  {{ item.becario_name ?? `Cobertura #${item.coverage_id}` }} — {{ item.reason }}
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="finish">Cerrar</v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Bulk "Marcar inicio de pago Telmex" dialog (sdd/telmex-cobertura-lote, PR3,
// task 8.2). Mirrors EndCoverageDialog.vue's month field + requiredRule +
// toMonthStart + getErrorMessage pattern (design #1931 D11/D12), but adds a
// `step: 'confirm' | 'results'` instead of closing immediately on success —
// the bulk endpoint always returns 200 with a per-coverage outcome list, so
// staff need to see which becarios actually got marked.
import { computed, ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoverage, BulkEndTelmexCoveragesResult } from '@/interfaces/telmexCoverage'

interface Props {
  modelValue: boolean
  coverages: TelmexCoverage[]
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'completed', result: BulkEndTelmexCoveragesResult): void
}

const emit = defineEmits<Emits>()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const telmexStartPeriod = ref('')
const step = ref<'confirm' | 'results'>('confirm')
const result = ref<BulkEndTelmexCoveragesResult | null>(null)

const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const monthInWords = computed<string>(() => {
  const value = telmexStartPeriod.value
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return ''
  return `${MONTH_NAMES[month - 1]} ${year}`
})

const lastIuMonthLabel = computed<string>(() => {
  const value = telmexStartPeriod.value
  if (!value) return ''
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return ''
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${String(prevMonth).padStart(2, '0')}/${prevYear}`
})

const resetForm = (): void => {
  telmexStartPeriod.value = ''
  step.value = 'confirm'
  result.value = null
  formRef.value?.resetValidation()
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetForm()
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}

const finish = (): void => {
  emit('completed', result.value ?? { ended: [], failed: [] })
  emit('update:modelValue', false)
}

const toMonthStart = (value: string): string => `${value}-01`

const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { msg?: string; errors?: Record<string, string[]> } } }
  const fieldError = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : undefined
  return fieldError ?? err.response?.data?.msg ?? 'Error al marcar el inicio de pago Telmex, intenta nuevamente.'
}

const onConfirm = async (): Promise<void> => {
  if (saving.value) return
  saving.value = true
  try {
    const valid = await formRef.value?.validate()
    if (!valid?.valid) return

    result.value = await telmexCoverageStore.endCoveragesBulk({
      coverage_ids: props.coverages.map((coverage) => coverage.id),
      telmex_start_period: toMonthStart(telmexStartPeriod.value),
    })
    step.value = 'results'
  } catch (error: unknown) {
    console.error('Error al marcar el inicio de pago Telmex en lote:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
