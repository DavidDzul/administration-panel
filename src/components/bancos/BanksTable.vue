<template>
  <v-data-table :headers="tableHeaders" :items="banks" class="elevation-1" item-value="id">
    <template #[`item.is_active`]="{ item }">
      <v-chip :color="item.is_active ? 'success' : 'grey'" size="small" variant="tonal">
        {{ item.is_active ? 'Activo' : 'Inactivo' }}
      </v-chip>
    </template>

    <template #[`item.actions`]="{ item }">
      <div v-if="canManage" style="width: 100%; text-align: right">
        <v-tooltip text="Editar" location="bottom">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                data-test="edit-bank"
                variant="text"
                color="warning"
                density="comfortable"
                icon="mdi-pencil"
                size="small"
                @click="emit('edit', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>

        <v-tooltip :text="toggleTooltip(item)" location="bottom">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                data-test="toggle-bank"
                variant="text"
                :color="item.is_active ? 'grey' : 'success'"
                density="comfortable"
                :icon="item.is_active ? 'mdi-cancel' : 'mdi-check-circle-outline'"
                size="small"
                :disabled="item.is_system"
                @click="emit('toggle', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>

        <v-tooltip :text="deleteTooltip(item)" location="bottom">
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                data-test="delete-bank"
                variant="text"
                color="error"
                density="comfortable"
                icon="mdi-delete"
                size="small"
                :disabled="item.is_system"
                @click="emit('delete', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>
      </div>
    </template>
    <template #no-data>No existen datos registrados</template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { Bank } from '@/interfaces/bank'

interface Props {
  banks?: Bank[]
  canManage?: boolean
}

withDefaults(defineProps<Props>(), {
  banks: () => [],
  canManage: false,
})

interface Emits {
  (e: 'edit', bank: Bank): void
  (e: 'toggle', bank: Bank): void
  (e: 'delete', bank: Bank): void
}

const emit = defineEmits<Emits>()

const SYSTEM_BANK_TOOLTIP = 'BBVA es un banco del sistema y no se puede desactivar ni eliminar.'

const toggleTooltip = (bank: Bank): string => {
  if (bank.is_system) return SYSTEM_BANK_TOOLTIP
  return bank.is_active ? 'Desactivar' : 'Activar'
}

const deleteTooltip = (bank: Bank): string => (bank.is_system ? SYSTEM_BANK_TOOLTIP : 'Eliminar')

const tableHeaders = [
  { title: 'Código', key: 'code' },
  { title: 'Nombre', key: 'name' },
  { title: 'Estado', key: 'is_active' },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]
</script>
