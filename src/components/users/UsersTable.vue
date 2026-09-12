<template>
  <v-data-table
    :headers="tableHeaders"
    :items="filteredPersons"
    class="elevation-1"
    :loading="loading"
    :search="search"
    item-value="id"
  >
    <template #top>
      <v-toolbar :flat="true">
        <v-text-field
          class="ml-5 mr-3"
          v-model="search"
          hide-details
          prepend-icon="mdi-magnify"
          density="compact"
          single-line
          label="Buscar"
          :clearable="true"
        ></v-text-field>
        <v-menu min-width="280px" :close-on-content-click="false">
          <template v-slot:activator="{ props }">
            <v-tooltip location="top">
              <template v-slot:activator="{ props: tooltip }">
                <v-btn
                  color="warning"
                  v-bind="mergeProps(props, tooltip)"
                  variant="text"
                  icon="mdi-filter"
                />
              </template>
              <span>Filtros</span>
            </v-tooltip>
          </template>

          <v-card>
            <v-card-title><small>Seleccionar filtros</small></v-card-title>
            <v-divider></v-divider>
            <v-card-text>
              <v-row>
                <v-col cols="12">
                  <v-select
                    clearable
                    :items="userTypeOptions"
                    v-model="userTypeFilter"
                    item-title="text"
                    item-value="value"
                    label="Tipo"
                  ></v-select>
                  <v-select
                    clearable
                    :items="campusOptions"
                    v-model="campus"
                    item-title="text"
                    item-value="value"
                    label="Sede"
                  ></v-select>
                  <v-select
                    clearable
                    :items="filteredGenerations"
                    v-model="generation_id"
                    item-title="generation_name"
                    item-value="id"
                    label="Generación"
                  ></v-select>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-menu>
      </v-toolbar>

      <div class="d-flex align-center px-4 py-2 bg-grey-lighten-5 border-b">
        <v-icon class="mr-2" size="small" color="medium-emphasis">mdi-account-group</v-icon>
        <span class="text-subtitle-2 font-weight-medium">{{ filterLabel }}</span>
        <v-chip class="ml-auto" size="x-small" variant="tonal" :color="filterChipColor">
          {{ filteredPersons.length }} {{ filteredPersons.length === 1 ? 'persona' : 'personas' }}
        </v-chip>
      </div>
    </template>

    <template #[`item.user_type`]="{ item }">
      <v-chip :color="item.user_type === 'BEC_ACTIVE' ? 'primary' : 'secondary'" size="small" variant="tonal">
        {{ userTypeLabelMap[item.user_type] ?? item.user_type }}
      </v-chip>
    </template>

    <template #[`item.active`]="{ item }">
      <v-icon v-if="item.active" color="success">mdi-check</v-icon>
      <v-icon v-else color="error">mdi-close</v-icon>
    </template>

    <!--
      D6/PR3b (sdd/becarios-payment-config): eye is always enabled — it only
      navigates to the read-only detail view, gated at a higher level by the
      table even being visible (canRead). Pencil is gated on `canEdit`
      (authStore.editPaymentData) since it opens the payment-data edit
      dialog, a write action. Each icon stays wrapped in a <span> because
      Vuetify's disabled v-btn sets `pointer-events: none`, which otherwise
      silently suppresses the v-tooltip activator's hover trigger — a
      well-known Vuetify gotcha, still relevant now that pencil can be
      conditionally disabled.
    -->
    <template #[`item.actions`]="{ item }">
      <div style="width: 100%; text-align: right">
        <v-tooltip text="Editar" location="bottom">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="warning"
                density="comfortable"
                icon="mdi-pencil"
                class="mr-2"
                size="small"
                :disabled="!canEdit"
                @click="emit('edit', item)"
              ></v-btn>
            </span>
          </template>
        </v-tooltip>
        <v-tooltip text="Visualizar" location="bottom">
          <template v-slot:activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" style="display: inline-block">
              <v-btn
                variant="text"
                color="warning"
                density="comfortable"
                icon="mdi-eye"
                class="mr-2"
                size="small"
                @click="router.push(`/becarios/${item.id}`)"
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
import { computed, ref, mergeProps, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Person, PersonType } from '@/interfaces/user'
import type { Generation } from '@/interfaces/generation'
import type { SelectOption } from '@/constants'
import { becTypeArray } from '@/constants'

interface Props {
  persons?: Person[]
  loading?: boolean
  generations?: Generation[]
  campusOptions?: SelectOption[]
  // Gates the pencil (payment-data edit) icon only — mirrors
  // authStore.editPaymentData, threaded down from PersonsView (design D5/D7,
  // sdd/becarios-payment-config). The eye icon is NOT gated by this prop —
  // it only navigates to the read-only detail view.
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  persons: () => [],
  loading: false,
  generations: () => [],
  campusOptions: () => [],
  canEdit: false,
})

interface Emits {
  (e: 'edit', person: Person): void
}

const emit = defineEmits<Emits>()
const router = useRouter()

const search = ref('')
const generation_id = ref<number | null>(null)
const campus = ref<string | null>(null)
const userTypeFilter = ref<PersonType | null>(null)

// Used for individual row chips (singular).
const userTypeLabelMap: Record<string, string> = {
  BEC_ACTIVE: 'Becario/a',
  BEC_INACTIVE: 'Egresado/a',
}

// Used for the group title bar (plural).
const filterGroupLabel: Record<string, string> = {
  BEC_ACTIVE: 'Becarios',
  BEC_INACTIVE: 'Egresados',
}

const userTypeOptions: SelectOption[] = becTypeArray

const filterLabel = computed<string>(() =>
  userTypeFilter.value ? (filterGroupLabel[userTypeFilter.value] ?? userTypeFilter.value) : 'Todas las personas',
)

const filterChipColor = computed<string>(() => {
  switch (userTypeFilter.value) {
    case 'BEC_ACTIVE':
      return 'primary'
    case 'BEC_INACTIVE':
      return 'secondary'
    default:
      return 'default'
  }
})

const showTypeColumn = computed(() => userTypeFilter.value === null)

const baseHeaders = [
  { title: 'ID', key: 'id' },
  { title: 'Matrícula', key: 'enrollment' },
  { title: 'Nombre(s)', key: 'first_name' },
  { title: 'Apellido(s)', key: 'last_name' },
  { title: 'Activo', key: 'active' },
  { title: '', key: 'actions' },
]

const typeHeader = { title: 'Tipo', key: 'user_type' }

const tableHeaders = computed(() =>
  showTypeColumn.value
    ? [baseHeaders[0], baseHeaders[1], baseHeaders[2], baseHeaders[3], typeHeader, baseHeaders[4], baseHeaders[5]]
    : baseHeaders,
)

const filteredGenerations = computed(() => props.generations.filter((gen) => gen.campus === campus.value))

const filteredPersons = computed(() =>
  props.persons.filter((person) => {
    const typeMatch = userTypeFilter.value ? person.user_type === userTypeFilter.value : true
    const campusMatch = campus.value ? person.campus === campus.value : true
    const generationMatch = generation_id.value ? Number(person.generation_id) === generation_id.value : true
    return typeMatch && campusMatch && generationMatch
  }),
)

watch(campus, () => {
  generation_id.value = null
})
</script>
