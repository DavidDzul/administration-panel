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
          <v-toolbar-title>Cancelar cobertura Telmex</v-toolbar-title>
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
              <v-alert v-if="coverage.balance > 0" type="warning" variant="tonal" density="compact">
                Esta cobertura tiene un saldo pendiente de {{ formatCurrency(coverage.balance) }}. Al cancelar, el
                saldo se mostrará como cancelado, no como deuda activa.
              </v-alert>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="reason"
                label="Motivo de cancelación *"
                rows="3"
                :rules="[requiredRule, minLengthRule, maxLengthRule]"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="close">Cerrar</v-btn>
          <v-btn color="error" variant="text" type="submit" :loading="saving">Cancelar cobertura</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Cancel dialog (sdd/telmex-cobertura-iu, PR4, task 4.6). Reason is
// mandatory and length-bounded 10-500 (amendment #1918: "mandatory reason";
// tasks #1922 3a.6: "10-500, else 422") — validated client-side first so
// staff doesn't round-trip for an obviously-too-short reason, mirroring
// CreateRoleDialog's maxLengthRule precedent.
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
  (e: 'cancelled', coverage: TelmexCoverage): void
}

const emit = defineEmits<Emits>()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const reason = ref('')

const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

const minLengthRule = (v: unknown): true | string =>
  String(v ?? '').trim().length >= 10 || 'El motivo debe tener al menos 10 caracteres.'

const maxLengthRule = (v: unknown): true | string =>
  String(v ?? '').length <= 500 || 'El motivo no puede exceder 500 caracteres.'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const resetForm = (): void => {
  reason.value = ''
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

const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { msg?: string; errors?: Record<string, string[]> } } }
  const fieldError = err.response?.data?.errors
    ? Object.values(err.response.data.errors)[0]?.[0]
    : undefined
  return fieldError ?? err.response?.data?.msg ?? 'Error al cancelar la cobertura, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || !props.coverage) return

  saving.value = true
  try {
    const coverage = await telmexCoverageStore.cancelCoverage(props.coverage.id, { reason: reason.value.trim() })
    showAlert({ title: 'Cobertura Telmex cancelada exitosamente.', status: 'success' })
    resetForm()
    emit('cancelled', coverage)
    close()
  } catch (error: unknown) {
    console.error('Error al cancelar la cobertura Telmex:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
