<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="500px" persistent>
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-toolbar dark>
          <v-toolbar-title>Anular abono</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row v-if="payment">
            <v-col cols="12">
              <p class="text-body-2">
                Abono por <strong>{{ formatCurrency(payment.amount) }}</strong> registrado el
                {{ formatPeriod(payment.paid_at) }}. Al anularlo, el saldo pendiente aumentará nuevamente.
              </p>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="reason"
                label="Motivo de anulación *"
                rows="3"
                :rules="[requiredRule, minLengthRule, maxLengthRule]"
              ></v-textarea>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="close">Cerrar</v-btn>
          <v-btn color="error" variant="text" type="submit" :loading="saving">Anular abono</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Void repayment dialog (sdd/telmex-cobertura-iu, PR5, task 5.2; PR3a's
// VoidTelmexCoveragePaymentAction: reason required else 422). Mirrors
// CancelCoverageDialog.vue's mandatory-reason + own-store-call convention
// exactly — reason length-bounded 10-500 client-side first, same as
// cancel's rule, so staff doesn't round-trip for an obviously-too-short
// reason.
import { ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoveragePayment } from '@/interfaces/telmexCoverage'

interface Props {
  modelValue: boolean
  coverageId: number | null
  payment: TelmexCoveragePayment | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'voided', payment: TelmexCoveragePayment): void
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

const formatCurrency = (amount: string | number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))

const formatPeriod = (date: string): string => `${date.slice(5, 7)}/${date.slice(0, 4)}`

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
  const fieldError = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : undefined
  return fieldError ?? err.response?.data?.msg ?? 'Error al anular el abono, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || props.coverageId === null || !props.payment) return

  saving.value = true
  try {
    const payment = await telmexCoverageStore.voidPayment(props.coverageId, props.payment.id, {
      void_reason: reason.value.trim(),
    })
    showAlert({ title: 'Abono anulado exitosamente.', status: 'success' })
    resetForm()
    emit('voided', payment)
    close()
  } catch (error: unknown) {
    console.error('Error al anular el abono:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
