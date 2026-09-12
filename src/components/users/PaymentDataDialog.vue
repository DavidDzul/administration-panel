<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="600px"
    persistent
  >
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-toolbar dark>
          <v-toolbar-title>Datos de pago</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />
          <v-row>
            <v-col cols="12">
              <v-text-field v-model="form.bank_name" label="Banco *" :rules="[requiredRule]"></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.account_number"
                label="Número de cuenta / CLABE *"
                :rules="[requiredRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.curp" label="CURP *" :rules="[requiredRule, curpRule]"></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.rfc" label="RFC" :rules="[rfcRule]" clearable></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="close">Cancelar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving">Guardar</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useAlertStore } from '@/stores/alert'
import type { PaymentDataForm } from '@/interfaces/paymentData'

interface Props {
  modelValue: boolean
  // Nullable: the table's `edit` emit and the card both resolve a user id
  // asynchronously (route param / row click), so the dialog must tolerate a
  // transient `null` before either caller sets it.
  userId: number | null
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}

const emit = defineEmits<Emits>()

const paymentDataStore = usePaymentDataStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const loading = ref(false)
const saving = ref(false)

const emptyForm = (): PaymentDataForm => ({
  bank_name: '',
  account_number: '',
  curp: '',
  rfc: '',
})

const form = reactive<PaymentDataForm>(emptyForm())

// Mirrors impulsou-api's App\Rules\Curp / App\Rules\Rfc bounded
// length+charset validation exactly (design D3, spec obs #1582's explicit
// YAGNI resolution) — no RENAPO/SAT checksum, only length + charset.
const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

const curpRule = (v: unknown): true | string =>
  /^[A-Z0-9]{18}$/.test(String(v ?? '')) || 'La CURP debe tener exactamente 18 caracteres alfanuméricos en mayúsculas.'

const rfcRule = (v: unknown): true | string => {
  if (!v) return true
  return (
    /^[A-Z0-9]{12,13}$/.test(String(v)) || 'El RFC debe tener 12 o 13 caracteres alfanuméricos en mayúsculas.'
  )
}

// D7: this dialog is the ONE edit surface for BOTH entry points (table
// pencil, card "Editar" button). The pencil only ever has the row's Person —
// never a pre-fetched payment-data row — so the dialog fetches for itself on
// every open rather than relying on a caller-supplied `initial-data` prop.
// This also (re-)establishes paymentDataStore's internal
// `existsByUser[userId]` right before save, so `savePaymentData` picks
// POST/PUT correctly even if the card's own mount-time fetch is stale.
const loadExisting = async (userId: number): Promise<void> => {
  loading.value = true
  try {
    const existing = await paymentDataStore.fetchPaymentData(userId)
    if (existing) {
      form.bank_name = existing.bank_name
      form.account_number = existing.account_number
      form.curp = existing.curp
      form.rfc = existing.rfc ?? ''
    } else {
      Object.assign(form, emptyForm())
    }
  } catch (error: unknown) {
    console.error('Error al cargar los datos de pago:', error)
    Object.assign(form, emptyForm())
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.userId !== null) {
      void loadExisting(props.userId)
    }
  },
  { immediate: true },
)

watch(
  () => form.curp,
  (value) => {
    if (typeof value === 'string' && value !== value.toUpperCase()) {
      form.curp = value.toUpperCase()
    }
  },
)

watch(
  () => form.rfc,
  (value) => {
    if (typeof value === 'string' && value !== value.toUpperCase()) {
      form.rfc = value.toUpperCase()
    }
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}

const onSubmit = async (): Promise<void> => {
  if (props.userId === null) return

  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    await paymentDataStore.savePaymentData(props.userId, {
      bank_name: form.bank_name,
      account_number: form.account_number,
      curp: form.curp,
      rfc: form.rfc || null,
    })
    showAlert({ title: 'Datos de pago guardados exitosamente.', status: 'success' })
    emit('saved')
    close()
  } catch (error: unknown) {
    console.error('Error al guardar los datos de pago:', error)
    showAlert({ title: 'Error al guardar los datos de pago, intenta nuevamente.', status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
