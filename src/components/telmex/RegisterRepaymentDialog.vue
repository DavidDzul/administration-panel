<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="500px" persistent>
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-toolbar dark>
          <v-toolbar-title>Registrar abono</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <p class="text-body-2">Saldo pendiente: <strong>{{ formatCurrency(balance) }}</strong></p>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model.number="amount"
                name="amount"
                type="number"
                label="Monto *"
                :rules="[amountRequiredRule, amountMaxRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <!-- Optional (PR3b's final contract: `paid_at?`) — the
                   server defaults it to "now" when omitted. -->
              <v-text-field v-model="paidAt" name="paid_at" type="date" label="Fecha"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="reference" label="Referencia/comprobante"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="notes" label="Notas" rows="2"></v-textarea>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="close">Cerrar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving">Registrar abono</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Register repayment dialog (sdd/telmex-cobertura-iu, PR5, task 5.2;
// decisions-2 #1926, spec's "Repayments" requirement). amount > 0 and <=
// balance, validated client-side (mirrors CancelCoverageDialog.vue's
// client-first-validation precedent) before the 422 round-trip. Calls the
// store DIRECTLY (own-store-call convention, PR4's dialogs) — no
// composable indirection; the parent view's `refresh()` re-fetches the
// statement after a successful registration, since the ledger (balance/
// status) is entirely server-derived (status may move EN_COBRO ↔
// LIQUIDADA).
//
// ALIGNED to PR3b's final, implemented contract (confirmed by the
// orchestrator after PR3b landed): `POST {coverage}/payments {amount,
// paid_at?, reference?, notes?}` — `paid_at` is OPTIONAL, the server
// defaults it when omitted, so the field has no required rule and no
// asterisk. 422 (`{res:false, msg}`) is returned when the coverage status
// isn't EN_COBRO or amount exceeds balance; Laravel validation errors use
// `{message, errors}` — `getErrorMessage` below checks `data.errors` first
// (validation shape), then falls back to `data.msg` (domain-error shape).
import { ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoveragePayment, RegisterTelmexCoveragePaymentPayload } from '@/interfaces/telmexCoverage'

interface Props {
  modelValue: boolean
  coverageId: number | null
  balance: string
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'registered', payment: TelmexCoveragePayment): void
}

const emit = defineEmits<Emits>()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const amount = ref<number | null>(null)
const paidAt = ref('')
const reference = ref('')
const notes = ref('')

const amountRequiredRule = (v: unknown): true | string => (Number(v) > 0 ? true : 'El monto debe ser mayor a 0.')

const amountMaxRule = (v: unknown): true | string =>
  Number(v) <= Number(props.balance) || `El monto no puede exceder el saldo pendiente (${formatCurrency(props.balance)}).`

const formatCurrency = (value: string | number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value))

const resetForm = (): void => {
  amount.value = null
  paidAt.value = ''
  reference.value = ''
  notes.value = ''
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
  return fieldError ?? err.response?.data?.msg ?? 'Error al registrar el abono, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || props.coverageId === null || amount.value === null) return

  const payload: RegisterTelmexCoveragePaymentPayload = {
    amount: amount.value,
    paid_at: paidAt.value.trim() === '' ? undefined : paidAt.value,
    reference: reference.value.trim() === '' ? undefined : reference.value.trim(),
    notes: notes.value.trim() === '' ? undefined : notes.value.trim(),
  }

  saving.value = true
  try {
    const payment = await telmexCoverageStore.registerPayment(props.coverageId, payload)
    showAlert({ title: 'Abono registrado exitosamente.', status: 'success' })
    resetForm()
    emit('registered', payment)
    close()
  } catch (error: unknown) {
    console.error('Error al registrar el abono:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
