<template>
  <v-data-table :headers="tableHeaders" :items="administrators" class="elevation-1" :loading="loading" item-value="id">
    <template #[`item.name`]="{ item }">
      {{ item.first_name }} {{ item.last_name }}
    </template>

    <template #[`item.role`]="{ item }">
      {{ item.roles[0]?.name ?? '—' }}
    </template>

    <!--
      Mirrors RolesTable.vue's actions-column convention: the eye icon only
      navigates to the read-only detail view. No pencil/delete icon here —
      role assignment happens in the detail view (PR10), and administrator
      deletion is out of scope.
    -->
    <template #[`item.actions`]="{ item }">
      <div style="width: 100%; text-align: right">
        <v-tooltip text="Visualizar" location="bottom">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="warning"
                density="comfortable"
                icon="mdi-eye"
                size="small"
                @click="router.push(`/control/accesos/${item.id}`)"
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
import { useRouter } from 'vue-router'
import type { Administrator } from '@/interfaces/administrator'

interface Props {
  administrators?: Administrator[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  administrators: () => [],
  loading: false,
})

const router = useRouter()

const tableHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Correo', key: 'email' },
  { title: 'Rol actual', key: 'role' },
  { title: '', key: 'actions' },
]
</script>
