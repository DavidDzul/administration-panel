<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="(value) => emit('update:modelValue', value)">
    <v-card>
      <v-card-title>Confirmar pago del lote</v-card-title>
      <v-card-text>
        <p class="mb-4">
          Se procesará el pago de <strong>{{ count }}</strong> becario{{ count === 1 ? '' : 's' }} por un monto
          total de <strong>${{ totalAmount }}</strong>.
        </p>
        <v-alert type="warning" variant="tonal" density="compact">
          Esta acción es irreversible: una vez procesado, el lote no puede revertirse ni deshacerse desde este
          panel.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancelar</v-btn>
        <v-btn color="primary" :loading="processing" @click="emit('confirm')">Confirmar pago</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Atomic, all-or-nothing confirmation — spec's requirement for an explicit
// irreversibility warning (no partial commit, no reversal in this change).
interface Props {
  modelValue: boolean
  count?: number
  totalAmount?: string
  processing?: boolean
}

withDefaults(defineProps<Props>(), {
  count: 0,
  totalAmount: '0.00',
  processing: false,
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}

const emit = defineEmits<Emits>()
</script>
