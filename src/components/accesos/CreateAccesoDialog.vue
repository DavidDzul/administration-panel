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
          <v-toolbar-title>Nuevo acceso</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="firstName"
                label="Nombre(s) *"
                :rules="[requiredRule, maxLengthRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="lastName"
                label="Apellido(s) *"
                :rules="[requiredRule, maxLengthRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="email"
                label="Correo *"
                type="email"
                :rules="[requiredRule, maxLengthRule, emailRule]"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="password"
                label="Contraseña *"
                type="password"
                :rules="[requiredRule, passwordMinLengthRule]"
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
import { ref, watch } from 'vue'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useAlertStore } from '@/stores/alert'
import type { Administrator } from '@/interfaces/administrator'

// PR9b: Accesos create dialog. Only nombres/correo/contraseña are submitted
// — no role field is exposed here. A freshly created administrator always
// holds zero roles server-side (User::createRulesAdministrator() never reads
// role/role_id, spec R3); role assignment happens later in the detail view
// (PR10), mirroring CreateRoleDialog.vue's PR6b precedent of never exposing
// server-hardcoded/deferred fields in the create form.
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', administrator: Administrator): void
}

const emit = defineEmits<Emits>()

const administratorsStore = useAdministratorsStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')

const requiredRule = (v: unknown): true | string => (!!v && String(v).trim() !== '') || 'Campo requerido.'

// Mirrors User::createRulesAdministrator()'s `max:255` rule (first_name,
// last_name, email) exactly (impulsou-api/app/Models/User.php).
const maxLengthRule = (v: unknown): true | string =>
  String(v ?? '').length <= 255 || 'No puede exceder 255 caracteres.'

// Mirrors the `email` format rule from the same backend validator.
const emailRule = (v: unknown): true | string =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '')) || 'Correo electrónico inválido.'

// Mirrors User::createRulesAdministrator()'s `password` => 'min:8' rule.
const passwordMinLengthRule = (v: unknown): true | string =>
  String(v ?? '').length >= 8 || 'La contraseña debe tener al menos 8 caracteres.'

const resetForm = (): void => {
  firstName.value = ''
  lastName.value = ''
  email.value = ''
  password.value = ''
  formRef.value?.resetValidation()
}

// Always starts blank on open, same as CreateRoleDialog.vue.
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetForm()
  },
)

const close = (): void => {
  emit('update:modelValue', false)
}

// The backend's `email` uniqueness rule (unique:users,email) surfaces as a
// standard Laravel 422 with `errors.email`. Everything else (403, network)
// falls back to a generic message — mirrors CreateRoleDialog.vue's
// catch-and-show-generic pattern.
const getErrorMessage = (error: unknown): string => {
  const err = error as { response?: { data?: { errors?: Record<string, string[]> } } }
  const emailError = err.response?.data?.errors?.email?.[0]
  return emailError ?? 'Error al crear el administrador, intenta nuevamente.'
}

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    const administrator = await administratorsStore.createAdministrator({
      first_name: firstName.value,
      last_name: lastName.value,
      email: email.value,
      password: password.value,
    })
    showAlert({ title: 'Administrador creado exitosamente.', status: 'success' })
    resetForm()
    emit('created', administrator)
    close()
  } catch (error: unknown) {
    console.error('Error al crear el administrador:', error)
    showAlert({ title: getErrorMessage(error), status: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
