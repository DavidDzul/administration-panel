<template>
  <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-card-title>Registrar pago con cheque</v-card-title>
        <v-card-subtitle v-if="row" data-testid="cheque-dialog-subtitle" class="text-wrap">
          <div>{{ row.snapshot_name }}</div>
          <div>A nombre de: {{ row.cheque_beneficiary || row.snapshot_name }}</div>
          <div>Monto: {{ formatAmount(row.total_to_pay) }}</div>
        </v-card-subtitle>
        <v-card-text class="pt-4">
          <v-text-field
            v-model="form.cheque_number"
            label="Número de cheque *"
            :rules="[requiredRule, numberMaxRule]"
            :error-messages="fieldErrors('cheque_number')"
            @update:model-value="clearServerError('cheque_number')"
          ></v-text-field>
          <v-text-field
            v-model="form.cheque_delivered_at"
            label="Fecha de entrega"
            type="date"
            :max="today"
            :rules="[notFutureRule]"
            :error-messages="fieldErrors('cheque_delivered_at')"
          ></v-text-field>
          <v-textarea
            v-model="form.cheque_notes"
            label="Notas"
            rows="2"
            counter="500"
            :rules="[notesMaxRule]"
            :error-messages="fieldErrors('cheque_notes')"
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
// Presentational (pago-cheque PR7): validates input and emits the payload.
// PaymentsView calls the composable and feeds `serverErrors` back so the
// dialog stays open with inline errors (validation / cheque_number_taken).
import { reactive, ref, watch } from 'vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import { todayYmd } from '@/utils/chequeFormat'
import type { ChequeRow, MarkChequePayload } from '@/interfaces/payment'

const CHEQUE_NUMBER_MAX = 50
const NOTES_MAX = 500

interface Props {
  modelValue: boolean
  row: ChequeRow | null
  saving?: boolean
  serverErrors?: Record<string, string[]>
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
  serverErrors: () => ({}),
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: MarkChequePayload): void
}

const emit = defineEmits<Emits>()

const today = todayYmd()
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const form = reactive({ cheque_number: '', cheque_delivered_at: today, cheque_notes: '' })
const dismissedErrors = ref<Set<string>>(new Set())

const resetForm = (): void => {
  form.cheque_number = ''
  form.cheque_delivered_at = todayYmd()
  form.cheque_notes = ''
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

const requiredRule = (value: string): boolean | string => (value ?? '').trim().length > 0 || 'Campo requerido'
const numberMaxRule = (value: string): boolean | string =>
  (value ?? '').trim().length <= CHEQUE_NUMBER_MAX || `Máximo ${CHEQUE_NUMBER_MAX} caracteres`
const notesMaxRule = (value: string): boolean | string =>
  (value ?? '').length <= NOTES_MAX || `Máximo ${NOTES_MAX} caracteres`
const notFutureRule = (value: string): boolean | string =>
  !value || value <= todayYmd() || 'No puede ser una fecha futura'

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return
  const notes = form.cheque_notes.trim()
  emit('submit', {
    cheque_number: form.cheque_number.trim(),
    cheque_delivered_at: form.cheque_delivered_at || undefined,
    cheque_notes: notes.length > 0 ? notes : undefined,
  })
}
</script>
