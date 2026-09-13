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
          <v-toolbar-title>Nuevo rol</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-text-field v-model="name" label="Nombre *" :rules="[requiredRule, maxLengthRule]"></v-text-field>
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
import { ref, watch } from 'vue'
import { useRolesStore } from '@/stores/api/rolesStore'
import { useAlertStore } from '@/stores/alert'
import type { AdministrationRole } from '@/interfaces/role'

// PR6b: Roles create dialog. Only `name` is submitted — `type` is never
// exposed here because the backend hardcodes it to 'ADMINISTRATION' server
// side (design obs #1593, spec R2, AdministrationRoleController::store()).
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', role: AdministrationRole): void
}

const emit = defineEmits<Emits>()

const rolesStore = useRolesStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const name = ref('')

const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

// Mirrors Role::createAdministrationRules()'s `max:255` rule exactly (see
// impulsou-api/app/Models/Role.php) so an over-length name is rejected
// client-side before a round-trip.
const maxLengthRule = (v: unknown): true | string =>
  String(v ?? '').length <= 255 || 'El nombre no puede exceder 255 caracteres.'

const resetForm = (): void => {
  name.value = ''
  formRef.value?.resetValidation()
}

// Unlike PaymentDataDialog (which pre-fills from an existing record), this
// dialog always starts blank — so reopening it just needs a clean reset,
// not a fetch.
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetForm()
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}

// The backend's `name` uniqueness rule (Rule::unique('roles','name')
// ->where('type','ADMINISTRATION')) surfaces as a standard Laravel 422 with
// `errors.name`. Everything else (403, network) falls back to a generic
// message — mirrors PaymentDataDialog's catch-and-show-generic pattern,
// extended just enough to surface the one field-specific case this task
// explicitly calls out.
const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { errors?: Record<string, string[]> } } }
  const nameError = err.response?.data?.errors?.name?.[0]
  return nameError ?? 'Error al crear el rol, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    const role = await rolesStore.createRole(name.value)
    showAlert({ title: 'Rol creado exitosamente.', status: 'success' })
    resetForm()
    emit('created', role)
    close()
  } catch (error: unknown) {
    console.error('Error al crear el rol:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
