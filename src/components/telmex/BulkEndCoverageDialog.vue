<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="560px"
    persistent
  >
    <v-card>
      <v-toolbar dark>
        <v-toolbar-title>Telmex empezó a pagar</v-toolbar-title>
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
                Se registrará que Telmex empezó a pagar a <strong>{{ coverages.length }}</strong> becario(s).
              </p>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="telmexStartPeriod"
                type="month"
                label="¿Cuál es el primer mes que pagó Telmex? *"
                :rules="[requiredRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12" v-if="consequence">
              <v-alert type="info" variant="tonal" density="compact">{{ consequence }}</v-alert>
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
// Bulk "Telmex empezó a pagar" dialog (sdd/telmex-cobertura-lote, PR3,
// task 8.2). Mirrors EndCoverageDialog.vue's month field + requiredRule +
// toMonthStart + getErrorMessage pattern (design #1931 D11/D12), but adds a
// `step: 'confirm' | 'results'` instead of closing immediately on success —
// the bulk endpoint always returns 200 with a per-coverage outcome list, so
// staff need to see which becarios actually got marked.
import { computed, ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import { monthInWords, previousMonthInWords } from '@/utils/monthInWords'
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

// Coverages in a batch start in different months, so the consequence names
// only the cut-off: everything IU covered before the chosen month is owed.
// Telmex - IU becarios keep receiving their IU part.
const consequence = computed<string>(() => {
  const chosen = telmexStartPeriod.value
  if (!monthInWords(chosen)) return ''
  return (
    `A partir de ${monthInWords(chosen)} IU deja de pagar la parte de Telmex ` +
    `(en becas Telmex - IU, la parte de IU se sigue pagando). ` +
    `Los meses que IU cubrió hasta ${previousMonthInWords(chosen)} quedan como adelanto por devolver.`
  )
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
  return fieldError ?? err.response?.data?.msg ?? 'Error al registrar que Telmex empezó a pagar, intenta nuevamente.'
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
    console.error('Error al registrar en lote que Telmex empezó a pagar:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
