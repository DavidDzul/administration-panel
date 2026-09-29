<template>
  <BreadCrumbs :items="links" />

  <v-row v-if="loading">
    <v-col cols="12" class="d-flex justify-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12" md="6">
      <v-card>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Monto de referencia usado únicamente como guía informativa para becas Telmex y Telmex - IU. No afecta
            ningún cálculo de pago, descuento o exportación bancaria.
          </p>
          <v-form ref="formRef" @submit.prevent="onSubmit">
            <v-text-field
              v-model.number="form.telmex_base_amount"
              type="number"
              label="Monto base Telmex *"
              :rules="[nonNegativeNumberRule]"
              :disabled="!manageScholarshipSettings"
            ></v-text-field>
            <v-card-actions class="pl-0">
              <v-btn
                color="primary"
                type="submit"
                :loading="saving"
                :disabled="!manageScholarshipSettings"
              >
                Guardar
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
// Minimal single-field settings surface (design D8, sdd/scholarship-telmex-iu-split):
// ONE editable org-wide reference value, not a general settings framework
// (YAGNI, per design). GET is ungated server-side (shared reference data),
// so this view always fetches on mount; PUT is gated behind
// manageScholarshipSettings, mirrored client-side as disabled field/button
// state, same pattern as PaymentDataDialog's editScholarshipProfile gating.
import { onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useScholarshipSettingsStore } from '@/stores/api/scholarshipSettingsStore'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'
import BreadCrumbs from '@/components/shared/BreadCrumbs.vue'
import type { LinkInterface } from '@/interfaces/link'
import type { ScholarshipSettingForm } from '@/interfaces/scholarshipSetting'

const scholarshipSettingsStore = useScholarshipSettingsStore()
const { manageScholarshipSettings } = storeToRefs(useAuthStore())
const { showAlert } = useAlertStore()

const links: LinkInterface[] = [
  { title: 'Inicio', disabled: false, href: '/' },
  { title: 'Configuración de becas', disabled: true, href: '/control/becas' },
]

const formRef = ref()
const loading = ref(false)
const saving = ref(false)

const form = reactive<ScholarshipSettingForm>({ telmex_base_amount: 0 })

// Same non-negative rule as PaymentDataDialog's config fields (spec-level
// convention: 0 is valid, only blank/negative is rejected).
const nonNegativeNumberRule = (v: unknown): true | string => {
  if (v === null || v === undefined || v === '') return 'Campo requerido.'
  const num = Number(v)
  if (Number.isNaN(num)) return 'Debe ser un número.'
  return num >= 0 || 'Debe ser mayor o igual a 0.'
}

const load = async (): Promise<void> => {
  loading.value = true
  try {
    const setting = await scholarshipSettingsStore.fetchSetting()
    form.telmex_base_amount = Number(setting.telmex_base_amount)
  } catch (error: unknown) {
    console.error('Error al cargar la configuración de becas:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    await scholarshipSettingsStore.saveSetting({ telmex_base_amount: form.telmex_base_amount })
    showAlert({ title: 'Configuración guardada exitosamente.', status: 'success' })
  } catch (error: unknown) {
    console.error('Error al guardar la configuración de becas:', error)
    showAlert({ title: 'Error al guardar la configuración, intenta nuevamente.', status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
