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

          <div class="text-subtitle-2 mb-2">Datos bancarios</div>
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

          <v-divider class="my-4" />

          <!-- Configuración de beca — visually separate section (design's
               requirement + D6), gated field-by-field on
               editScholarshipProfile so a partially-permissioned admin sees
               (but cannot change) these values. -->
          <div class="text-subtitle-2 mb-2">Configuración de beca</div>
          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="configForm.scholarship_type"
                :items="scholarshipTypeOptions"
                item-title="text"
                item-value="value"
                label="Tipo de beca *"
                :rules="[requiredRule]"
                :disabled="!editScholarshipProfile"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-switch
                v-model="configForm.advance_payment_eligible"
                label="¿Estudia en el CERT de Mérida o UNID Tizimín?"
                :disabled="!editScholarshipProfile"
              ></v-switch>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="configForm.monthly_amount"
                type="number"
                label="Monto mensual *"
                :rules="[nonNegativeNumberRule]"
                :disabled="!editScholarshipProfile"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="configForm.monto_apoyo"
                type="number"
                label="Apoyo *"
                :rules="[nonNegativeNumberRule]"
                :disabled="!editScholarshipProfile"
              ></v-text-field>
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
import { storeToRefs } from 'pinia'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useScholarshipProfileStore } from '@/stores/api/scholarshipProfileStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'
import type { PaymentDataForm } from '@/interfaces/paymentData'
import type { ScholarshipProfileConfigForm } from '@/interfaces/scholarshipProfile'
import type { SelectOption } from '@/constants'

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
const scholarshipProfileStore = useScholarshipProfileStore()
const { editScholarshipProfile } = storeToRefs(useAuthStore())
const { showAlert } = useAlertStore()

const formRef = ref()
const loading = ref(false)
const saving = ref(false)

const scholarshipTypeOptions: SelectOption[] = [
  { value: 'IU', text: 'IU' },
  { value: 'TELMEX', text: 'TELMEX' },
]

const emptyForm = (): PaymentDataForm => ({
  bank_name: '',
  account_number: '',
  curp: '',
  rfc: '',
})

const emptyConfigForm = (): ScholarshipProfileConfigForm => ({
  scholarship_type: 'IU',
  monthly_amount: 0,
  monto_apoyo: 0,
  advance_payment_eligible: false,
})

const form = reactive<PaymentDataForm>(emptyForm())
const configForm = reactive<ScholarshipProfileConfigForm>(emptyConfigForm())

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

// Spec requirement: monthly_amount/monto_apoyo must allow $0 — no
// positive-only client validation. `min: 0` on the backend (design's
// UpdateScholarshipProfileConfigRequest), so 0 is valid and only a blank or
// negative value is rejected here.
const nonNegativeNumberRule = (v: unknown): true | string => {
  if (v === null || v === undefined || v === '') return 'Campo requerido.'
  const num = Number(v)
  if (Number.isNaN(num)) return 'Debe ser un número.'
  return num >= 0 || 'Debe ser mayor o igual a 0.'
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
    const [existing, existingConfig] = await Promise.all([
      paymentDataStore.fetchPaymentData(userId),
      scholarshipProfileStore.fetchProfileConfig(userId),
    ])

    if (existing) {
      form.bank_name = existing.bank_name
      form.account_number = existing.account_number
      form.curp = existing.curp
      form.rfc = existing.rfc ?? ''
    } else {
      Object.assign(form, emptyForm())
    }

    if (existingConfig) {
      configForm.scholarship_type = existingConfig.scholarship_type
      configForm.monthly_amount = Number(existingConfig.monthly_amount)
      configForm.monto_apoyo = existingConfig.monto_apoyo !== null ? Number(existingConfig.monto_apoyo) : 0
      configForm.advance_payment_eligible = existingConfig.advance_payment_eligible
    } else {
      Object.assign(configForm, emptyConfigForm())
    }
  } catch (error: unknown) {
    console.error('Error al cargar los datos de pago:', error)
    Object.assign(form, emptyForm())
    Object.assign(configForm, emptyConfigForm())
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

// Two sequential, independently-caught saves (design D6): a failure in one
// section must not roll back or mask the other's success. The config save
// is skipped entirely (not attempted) when the admin lacks
// editScholarshipProfile — avoids a needless 403 for a
// partially-permissioned admin.
const onSubmit = async (): Promise<void> => {
  if (props.userId === null) return

  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true

  let paymentDataOk = true
  try {
    await paymentDataStore.savePaymentData(props.userId, {
      bank_name: form.bank_name,
      account_number: form.account_number,
      curp: form.curp,
      rfc: form.rfc || null,
    })
  } catch (error: unknown) {
    paymentDataOk = false
    console.error('Error al guardar los datos de pago:', error)
    showAlert({ title: 'Error al guardar los datos de pago, intenta nuevamente.', status: 'error' })
  }

  let configOk = true
  if (editScholarshipProfile.value) {
    try {
      await scholarshipProfileStore.saveProfileConfig(props.userId, {
        scholarship_type: configForm.scholarship_type,
        monthly_amount: configForm.monthly_amount,
        monto_apoyo: configForm.monto_apoyo,
        advance_payment_eligible: configForm.advance_payment_eligible,
      })
    } catch (error: unknown) {
      configOk = false
      console.error('Error al guardar la configuración de beca:', error)
      showAlert({ title: 'Error al guardar la configuración de beca, intenta nuevamente.', status: 'error' })
    }
  }

  saving.value = false

  if (paymentDataOk && configOk) {
    showAlert({ title: 'Datos de pago guardados exitosamente.', status: 'success' })
    emit('saved')
    close()
  }
}
</script>
