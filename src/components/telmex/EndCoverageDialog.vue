<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="500px"
    persistent
  >
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-toolbar dark>
          <v-toolbar-title>Marcar inicio de pago Telmex</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row v-if="coverage">
            <v-col cols="12">
              <p class="text-body-2">
                Becario: <strong>{{ coverage.becario_name }}</strong>
              </p>
              <p class="text-body-2 text-medium-emphasis">
                Indica el mes en que Telmex empezó a pagar directamente. El mes anterior será el último cubierto por
                IU.
              </p>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="telmexStartPeriod"
                type="month"
                label="Telmex empezó a pagar en *"
                :rules="[requiredRule]"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="close">Cancelar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving">Confirmar</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// End ("Telmex empezó a pagar") dialog (sdd/telmex-cobertura-iu, PR4, task
// 4.6). `end_period` is derived server-side as `telmex_start_period - 1
// month` (design's Debt/Lifecycle section) — this dialog only collects the
// month Telmex itself started paying, never the derived end_period, so
// staff can't accidentally submit an off-by-one month.
import { ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoverage } from '@/interfaces/telmexCoverage'

interface Props {
  modelValue: boolean
  coverage: TelmexCoverage | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'ended', coverage: TelmexCoverage): void
}

const emit = defineEmits<Emits>()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const telmexStartPeriod = ref('')

const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

const resetForm = (): void => {
  telmexStartPeriod.value = ''
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

const toMonthStart = (value: string): string => `${value}-01`

const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { msg?: string; errors?: Record<string, string[]> } } }
  const fieldError = err.response?.data?.errors
    ? Object.values(err.response.data.errors)[0]?.[0]
    : undefined
  return fieldError ?? err.response?.data?.msg ?? 'Error al registrar el inicio de pago Telmex, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || !props.coverage) return

  saving.value = true
  try {
    const coverage = await telmexCoverageStore.endCoverage(props.coverage.id, {
      telmex_start_period: toMonthStart(telmexStartPeriod.value),
    })
    showAlert({ title: 'Inicio de pago Telmex registrado exitosamente.', status: 'success' })
    resetForm()
    emit('ended', coverage)
    close()
  } catch (error: unknown) {
    console.error('Error al registrar el inicio de pago Telmex:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
