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
          <v-alert
            v-if="formErrors.length > 0"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
            data-testid="manual-transfer-dialog-form-error"
          >
            {{ formErrors.join(' ') }}
          </v-alert>
          <ConceptReferenceFields
            v-model="form.references"
            :split="row?.concept_split"
            reference-label="Folio / referencia"
            :server-errors="serverErrors"
          />
          <v-text-field
            v-model="form.paid_at"
            label="Fecha de pago"
            type="date"
            :max="today"
            :rules="[notFutureRule]"
            :error-messages="fieldErrors('paid_at')"
          ></v-text-field>
          <v-textarea
            v-model="form.notes"
            label="Notas"
            rows="2"
            counter="500"
            :rules="[notesMaxRule]"
            :error-messages="fieldErrors('notes')"
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
// one modal captures BOTH references (Beca / Apoyo) — each REQUIRED for a
// concept with amount > 0 — and emits the payload with the row's frozen
// `expected_amounts`. PaymentsView calls the composable and feeds
// `serverErrors` back (`references.{concept}` / validation / `form`).
import { computed, reactive, ref, watch } from 'vue'
import ConceptReferenceFields from '@/components/pagos/ConceptReferenceFields.vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import { todayYmd } from '@/utils/chequeFormat'
import { activeConcepts } from '@/utils/manualPayment'
import type { ManualPaymentConcept, ManualTransferRow, MarkManualTransferPayload } from '@/interfaces/payment'

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
const form = reactive<{ references: Partial<Record<ManualPaymentConcept, string>>; paid_at: string; notes: string }>({
  references: {},
  paid_at: today,
  notes: '',
})
const dismissedErrors = ref<Set<string>>(new Set())

const resetForm = (): void => {
  form.references = {}
  form.paid_at = todayYmd()
  form.notes = ''
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

const formErrors = computed<string[]>(() => props.serverErrors.form ?? [])

const notesMaxRule = (value: string): boolean | string =>
  (value ?? '').length <= NOTES_MAX || `Máximo ${NOTES_MAX} caracteres`
const notFutureRule = (value: string): boolean | string =>
  !value || value <= todayYmd() || 'No puede ser una fecha futura'

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || !props.row?.concept_split) return
  const references: Partial<Record<ManualPaymentConcept, string>> = {}
  for (const concept of activeConcepts(props.row.concept_split)) {
    references[concept] = (form.references[concept] ?? '').trim()
  }
  const notes = form.notes.trim()
  emit('submit', {
    references,
    expected_amounts: { ...props.row.concept_split },
    paid_at: form.paid_at || undefined,
    notes: notes.length > 0 ? notes : undefined,
  })
}
</script>
