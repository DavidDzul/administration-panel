<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="500px"
    persistent
  >
    <v-card>
      <v-form ref="formRef" @submit.prevent="onSubmit">
        <v-toolbar dark>
          <v-toolbar-title>Activar cobertura Telmex</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-select
                v-model="userId"
                label="Becario *"
                :items="becarioOptions"
                item-title="text"
                item-value="value"
                :rules="[requiredRule]"
              ></v-select>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="startPeriod"
                type="month"
                label="Mes de inicio *"
                :rules="[requiredRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="notes" label="Notas (opcional)" rows="2"></v-textarea>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="close">Cancelar</v-btn>
          <v-btn color="primary" variant="text" type="submit" :loading="saving">Activar</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// Activate dialog (sdd/telmex-cobertura-iu, PR4, task 4.6). Only
// TELMEX/TELMEX_IU becarios without a non-CANCELADA coverage are offered
// (spec's "Coverage record, scope and uniqueness" requirement) — the
// `eligibleBecarios` list is fetched once by the page composable and passed
// down, mirroring CreateRoleDialog's "store call stays outside the dialog
// except for the write" convention.
import { computed, ref, watch } from 'vue'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAlertStore } from '@/stores/alert'
import type { TelmexCoverage, EligibleTelmexBecario } from '@/interfaces/telmexCoverage'

interface Props {
  modelValue: boolean
  eligibleBecarios?: EligibleTelmexBecario[]
}

const props = withDefaults(defineProps<Props>(), {
  eligibleBecarios: () => [],
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'activated', coverage: TelmexCoverage): void
}

const emit = defineEmits<Emits>()

const telmexCoverageStore = useTelmexCoverageStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const userId = ref<number | null>(null)
const startPeriod = ref('')
const notes = ref('')

const requiredRule = (v: unknown): true | string => (v !== null && v !== undefined && v !== '') || 'Campo requerido.'

const becarioOptions = computed(() =>
  props.eligibleBecarios.map((b) => ({
    value: b.id,
    text: `${b.name} — ${b.campus}${b.generation ? ` (${b.generation})` : ''}`,
  })),
)

const resetForm = (): void => {
  userId.value = null
  startPeriod.value = ''
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

// `v-text-field[type=month]` yields "YYYY-MM" — normalized to the backend's
// "1st of month" date shape (design's data model) before posting.
const toMonthStart = (value: string): string => `${value}-01`

const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { msg?: string; errors?: Record<string, string[]> } } }
  const fieldError = err.response?.data?.errors
    ? Object.values(err.response.data.errors)[0]?.[0]
    : undefined
  return fieldError ?? err.response?.data?.msg ?? 'Error al activar la cobertura, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid || userId.value === null) return

  saving.value = true
  try {
    const coverage = await telmexCoverageStore.activateCoverage({
      user_id: userId.value,
      start_period: toMonthStart(startPeriod.value),
      ...(notes.value.trim() !== '' ? { notes: notes.value.trim() } : {}),
    })
    showAlert({ title: 'Cobertura Telmex activada exitosamente.', status: 'success' })
    resetForm()
    emit('activated', coverage)
    close()
  } catch (error: unknown) {
    console.error('Error al activar la cobertura Telmex:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
