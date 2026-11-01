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
          <v-toolbar-title>{{ isEdit ? 'Editar banco' : 'Nuevo banco' }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-toolbar-items>
            <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
          </v-toolbar-items>
        </v-toolbar>
        <v-card-text>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="code"
                label="Código *"
                maxlength="3"
                inputmode="numeric"
                :disabled="isSystem"
                :hint="codeHint"
                persistent-hint
                :rules="[codeRule]"
                :error-messages="serverErrors.code"
                @update:model-value="serverErrors.code = []"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="name"
                label="Nombre *"
                :rules="[nameRule]"
                :error-messages="serverErrors.name"
                @update:model-value="serverErrors.name = []"
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
import { computed, reactive, ref, watch } from 'vue'
import { useBanksStore } from '@/stores/api/banksStore'
import { useAlertStore } from '@/stores/alert'
import type { Bank } from '@/interfaces/bank'

// Create/edit dialog for the bank catalog. `bank === null` means create.
// Field rules mirror SaveBankRequest (code ^\d{3}$, name required, max 100);
// uniqueness is only knowable server-side and surfaces from the 422.
interface Props {
  modelValue: boolean
  bank?: Bank | null
}

const props = withDefaults(defineProps<Props>(), { bank: null })

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', bank: Bank): void
}

const emit = defineEmits<Emits>()

const banksStore = useBanksStore()
const { showAlert } = useAlertStore()

const formRef = ref()
const saving = ref(false)
const code = ref('')
const name = ref('')
const serverErrors = reactive<{ code: string[]; name: string[] }>({ code: [], name: [] })

const isEdit = computed<boolean>(() => props.bank !== null)
const isSystem = computed<boolean>(() => props.bank?.is_system === true)
const codeHint = computed<string>(() =>
  isSystem.value
    ? 'El código de BBVA no se puede cambiar.'
    : 'Código de 3 dígitos de Banxico (por ejemplo, 014).',
)

const codeRule = (v: unknown): true | string =>
  /^\d{3}$/.test(String(v ?? '').trim()) || 'El código debe tener exactamente 3 dígitos.'

const nameRule = (v: unknown): true | string => {
  const value = String(v ?? '').trim()
  if (value === '') return 'El nombre es obligatorio.'
  return value.length <= 100 || 'El nombre no puede tener más de 100 caracteres.'
}

const resetForm = (): void => {
  code.value = props.bank?.code ?? ''
  name.value = props.bank?.name ?? ''
  serverErrors.code = []
  serverErrors.name = []
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

type ApiError = { response?: { data?: { errors?: Record<string, string[]>; msg?: string } } }

const onSubmit = async (): Promise<void> => {
  const result = await formRef.value?.validate()
  if (!result?.valid) return

  saving.value = true
  try {
    const form = {
      code: code.value.trim(),
      name: name.value.trim(),
      is_active: props.bank?.is_active ?? true,
    }
    const saved = props.bank
      ? await banksStore.updateBank(props.bank.id, form)
      : await banksStore.createBank(form)
    showAlert({ title: isEdit.value ? 'Banco actualizado.' : 'Banco creado.', status: 'success' })
    emit('saved', saved)
    close()
  } catch (error: unknown) {
    console.error('Error al guardar el banco:', error)
    const data = (error as ApiError).response?.data
    serverErrors.code = data?.errors?.code ?? []
    serverErrors.name = data?.errors?.name ?? []
    if (serverErrors.code.length === 0 && serverErrors.name.length === 0) {
      showAlert({ title: data?.msg ?? 'No se pudo guardar el banco. Intenta de nuevo.', status: 'error' })
    }
  } finally {
    saving.value = false
  }
}
</script>
