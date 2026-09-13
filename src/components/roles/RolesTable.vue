<template>
  <v-data-table :headers="tableHeaders" :items="roles" class="elevation-1" :loading="loading" item-value="id">
    <template #[`item.permissionCount`]="{ item }">
      {{ item.permissions.length }}
    </template>

    <!--
      Mirrors UsersTable.vue's actions-column convention: the eye icon only
      navigates to the read-only detail view. No pencil/delete icon here —
      permission editing happens in the detail view (PR7), and role
      deletion is out of scope (R6, no DELETE endpoint).
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
                @click="router.push(`/control/roles/${item.id}`)"
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
import type { AdministrationRole } from '@/interfaces/role'

interface Props {
  roles?: AdministrationRole[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  roles: () => [],
  loading: false,
})

const router = useRouter()

const tableHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Permisos', key: 'permissionCount' },
  { title: '', key: 'actions' },
]
</script>
