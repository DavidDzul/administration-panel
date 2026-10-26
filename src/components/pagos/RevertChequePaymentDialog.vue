<template>
  <v-dialog :model-value="modelValue" max-width="520" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-card-title>Revertir pago con cheque</v-card-title>
        <v-card-text>
          <div v-if="row" class="mb-4" data-testid="revert-dialog-details">
            <div class="text-subtitle-1">{{ row.snapshot_name }}</div>
            <div class="text-body-2">
              Cheque {{ row.cheque_number }} · {{ formatChequeDate(row.cheque_delivered_at) }}
            </div>
          </div>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            El refrendo volverá a quedar pendiente de pago.
          </v-alert>
          <v-textarea v-model="reason" label="Motivo *" rows="3" counter="500" :rules="[reasonRule]"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="emit('update:modelValue', false)">Cancelar</v-btn>
          <v-btn color="error" variant="text" type="submit" :loading="saving">Revertir pago</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Presentational (pago-cheque PR7): validates the reason (10-500 chars) and
// emits it; PaymentsView calls revertCheque and decides when to close.
import { ref, watch } from 'vue'
import { formatChequeDate } from '@/utils/chequeFormat'
import type { ChequeRow } from '@/interfaces/payment'

const REASON_MIN = 10
const REASON_MAX = 500

interface Props {
  modelValue: boolean
  row: ChequeRow | null
  saving?: boolean
}

const props = withDefaults(defineProps<Props>(), { saving: false })

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', reason: string): void
}

const emit = defineEmits<Emits>()

const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const reason = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) reason.value = ''
  },
)

const reasonRule = (value: string): boolean | string => {
  const length = (value ?? '').trim().length
  if (length === 0) return 'Campo requerido'
  if (length < REASON_MIN) return `Mínimo ${REASON_MIN} caracteres`
  return (value ?? '').length <= REASON_MAX || `Máximo ${REASON_MAX} caracteres`
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return
  emit('submit', reason.value.trim())
}
</script>
