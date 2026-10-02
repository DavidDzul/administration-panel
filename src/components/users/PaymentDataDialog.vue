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
                color="primary"
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
            <!-- "Pago IU" (sdd/scholarship-telmex-iu-split, design D2/spec
                 "iu_payment_amount field"): visible and required ONLY when
                 scholarship_type is TELMEX_IU — hidden entirely otherwise, so
                 v-form never registers/validates it for IU/TELMEX profiles. -->
            <v-col v-if="configForm.scholarship_type === 'TELMEX_IU'" cols="12" md="6">
              <v-text-field
                v-model.number="configForm.iu_payment_amount"
                type="number"
                label="Pago IU *"
                :rules="[nonNegativeNumberRule]"
                :disabled="!editScholarshipProfile"
              ></v-text-field>
            </v-col>
            <!-- Reference-only "Monto base Telmex" hint (design D9's
                 informational-hint requirement): purely display, never
                 coupled to validation or auto-fill. Shown for TELMEX and
                 TELMEX_IU only — this money is never payable for those
                 types, so the reference value helps staff sanity-check
                 monthly_amount/monto_apoyo. -->
            <v-col
              v-if="configForm.scholarship_type === 'TELMEX' || configForm.scholarship_type === 'TELMEX_IU'"
              cols="12"
            >
              <div class="text-caption text-medium-emphasis">
                Monto base Telmex (referencia): {{ telmexBaseAmount ?? 'N/A' }}
              </div>
            </v-col>
            <!-- Temporary-increase read-only block (sdd/temporary-increase-visibility,
                 design D3): shown whenever Number(amount) > 0, regardless of
                 current vigencia — an expired/future increase still explains
                 past/upcoming figures. No v-text-field, no v-form
                 registration — purely informational. -->
            <v-col v-if="temporaryIncrease" cols="12">
              <div class="text-caption text-medium-emphasis">
                Aumento temporal (solo lectura): {{ temporaryIncrease.amount }}
                · {{ temporaryIncrease.range }}
                <v-chip size="x-small" variant="tonal" :color="temporaryIncrease.stateColor" class="ml-1">
                  {{ temporaryIncrease.stateLabel }}
                </v-chip>
              </div>
              <div v-if="temporaryIncrease.reason" class="text-caption text-medium-emphasis">
                Motivo: {{ temporaryIncrease.reason }}
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

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
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useScholarshipProfileStore } from '@/stores/api/scholarshipProfileStore'
import { useScholarshipSettingsStore } from '@/stores/api/scholarshipSettingsStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'
import { temporaryIncreaseDisplay } from '@/utils/temporaryIncreaseVigencia'
import type { PaymentDataForm } from '@/interfaces/paymentData'
import type { ScholarshipProfileConfig, ScholarshipProfileConfigForm } from '@/interfaces/scholarshipProfile'
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
const scholarshipSettingsStore = useScholarshipSettingsStore()
const { editScholarshipProfile } = storeToRefs(useAuthStore())
const { showAlert } = useAlertStore()

const formRef = ref()
const loading = ref(false)
const saving = ref(false)
// Reference-only Telmex base amount (design D8/D9) — fetched independently
// of the bank-data/config loads below (see loadTelmexBaseAmount) so a
// failure here never blocks or resets the rest of the dialog. `null` while
// loading or if the fetch fails.
const telmexBaseAmount = ref<string | null>(null)
// Raw response holder (sdd/temporary-increase-visibility, design's flagged
// gotcha): `configForm` is a form DTO with no increase fields, so the
// temporary-increase block needs the raw profile config kept separately.
// Reset to `null` in BOTH the `else` (no existing config) and `catch`
// (fetch error) branches of loadExisting() — missing the catch-branch reset
// would leave a stale block visible after a failed reload.
const profileConfig = ref<ScholarshipProfileConfig | null>(null)

const scholarshipTypeOptions: SelectOption[] = [
  { value: 'IU', text: 'IU' },
  { value: 'TELMEX', text: 'TELMEX' },
  { value: 'TELMEX_IU', text: 'Telmex - IU' },
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
  iu_payment_amount: 0,
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
      configForm.iu_payment_amount =
        existingConfig.iu_payment_amount !== null ? Number(existingConfig.iu_payment_amount) : 0
      profileConfig.value = existingConfig
    } else {
      Object.assign(configForm, emptyConfigForm())
      profileConfig.value = null
    }
  } catch (error: unknown) {
    console.error('Error al cargar los datos de pago:', error)
    Object.assign(form, emptyForm())
    Object.assign(configForm, emptyConfigForm())
    profileConfig.value = null
  } finally {
    loading.value = false
  }
}

// Independent of loadExisting's try/catch (design D9's "purely
// informational" invariant) — a failure fetching the reference hint must
// never reset the bank-data/config forms the admin is actively editing.
const loadTelmexBaseAmount = async (): Promise<void> => {
  try {
    const setting = await scholarshipSettingsStore.fetchSetting()
    telmexBaseAmount.value = setting.telmex_base_amount
  } catch (error: unknown) {
    console.error('Error al cargar el monto base Telmex:', error)
    telmexBaseAmount.value = null
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.userId !== null) {
      void loadExisting(props.userId)
      void loadTelmexBaseAmount()
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

const temporaryIncrease = computed(() =>
  profileConfig.value ? temporaryIncreaseDisplay(profileConfig.value) : null,
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
        iu_payment_amount: configForm.iu_payment_amount,
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
