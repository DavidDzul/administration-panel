<template>
  <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-card-title>Registrar transferencia a otro banco</v-card-title>
        <v-card-subtitle v-if="row" data-testid="manual-transfer-dialog-subtitle" class="text-wrap">
          <div>{{ row.snapshot_name }}</div>
          <div>Banco: {{ row.bank_name ?? '—' }}</div>
          <div>CLABE: {{ row.account_number ?? '—' }}</div>
          <div>Monto: {{ formatAmount(row.total_to_pay) }}</div>
        </v-card-subtitle>
        <v-card-text class="pt-4">
          <v-text-field
            v-model="form.transfer_reference"
            label="Folio / referencia *"
            :rules="[requiredRule, referenceMaxRule]"
            :error-messages="fieldErrors('transfer_reference')"
            @update:model-value="clearServerError('transfer_reference')"
          ></v-text-field>
          <v-text-field
            v-model="form.transfer_paid_at"
            label="Fecha de pago"
            type="date"
            :max="today"
            :rules="[notFutureRule]"
            :error-messages="fieldErrors('transfer_paid_at')"
          ></v-text-field>
          <v-textarea
            v-model="form.transfer_notes"
            label="Notas"
            rows="2"
            counter="500"
            :rules="[notesMaxRule]"
            :error-messages="fieldErrors('transfer_notes')"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="emit('update:modelValue', false)">Cancelar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving">Registrar pago</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Presentational (sdd/catalogo-bancos R7), mirror of ChequePaymentDialog:
// validates input and emits the payload. PaymentsView calls the composable
// and feeds `serverErrors` back so the dialog stays open with inline errors
// (validation / transfer_reference_taken). The reference is REQUIRED.
import { reactive, ref, watch } from 'vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import { todayYmd } from '@/utils/chequeFormat'
import type { ManualTransferRow, MarkManualTransferPayload } from '@/interfaces/payment'

const REFERENCE_MAX = 50
const NOTES_MAX = 500

interface Props {
  modelValue: boolean
  row: ManualTransferRow | null
  saving?: boolean
  serverErrors?: Record<string, string[]>
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
  serverErrors: () => ({}),
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: MarkManualTransferPayload): void
}

const emit = defineEmits<Emits>()

const today = todayYmd()
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const form = reactive({ transfer_reference: '', transfer_paid_at: today, transfer_notes: '' })
const dismissedErrors = ref<Set<string>>(new Set())

const resetForm = (): void => {
  form.transfer_reference = ''
  form.transfer_paid_at = todayYmd()
  form.transfer_notes = ''
  dismissedErrors.value = new Set()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  },
)

// A new server response re-enables its messages.
watch(
  () => props.serverErrors,
  () => {
    dismissedErrors.value = new Set()
  },
)

const fieldErrors = (field: string): string[] =>
  dismissedErrors.value.has(field) ? [] : (props.serverErrors[field] ?? [])

const clearServerError = (field: string): void => {
  dismissedErrors.value = new Set(dismissedErrors.value).add(field)
}

const requiredRule = (value: string): boolean | string =>
  (value ?? '').trim().length > 0 || 'Captura el folio o la referencia de la transferencia.'
const referenceMaxRule = (value: string): boolean | string =>
  (value ?? '').trim().length <= REFERENCE_MAX || `Máximo ${REFERENCE_MAX} caracteres`
const notesMaxRule = (value: string): boolean | string =>
  (value ?? '').length <= NOTES_MAX || `Máximo ${NOTES_MAX} caracteres`
const notFutureRule = (value: string): boolean | string =>
  !value || value <= todayYmd() || 'No puede ser una fecha futura'

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return
  const notes = form.transfer_notes.trim()
  emit('submit', {
    transfer_reference: form.transfer_reference.trim(),
    transfer_paid_at: form.transfer_paid_at || undefined,
    transfer_notes: notes.length > 0 ? notes : undefined,
  })
}
</script>
