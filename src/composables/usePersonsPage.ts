import { computed, onBeforeMount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePersonsStore } from '@/stores/api/personsStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Person } from '@/interfaces/user'
import type { Generation } from '@/interfaces/generation'

// D4: lifecycle lives HERE, not inside a Pinia store. `onBeforeMount` inside
// a `defineStore` setup fn (psicol-panel's usersPage.ts) only fires once, on
// first store instantiation — not on every route entry. A plain composable
// called from a view's `setup()` attaches the hook to that view's real
// component instance, so it fires correctly on each mount.
//
// Single nav entry / single mode for this panel (unlike psicol-panel's
// separate usersPage/graduatesPage split) — no mode-switching needed here.
export function usePersonsPage() {
  const personsStore = usePersonsStore()
  const { allPersons } = storeToRefs(personsStore)
  const { fetchPersons } = personsStore

  const generationStore = useGenerationStore()
  const { resGenerations } = storeToRefs(generationStore)
  const { fetchGenerations } = generationStore

  const { filteredCampus, readUsers } = storeToRefs(useAuthStore())

  const loadingTable = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  onBeforeMount(async () => {
    loadingTable.value = true
    loadError.value = false
    const success = await fetchPersons()
    if (!success) loadError.value = true
    await fetchGenerations()
    loadingTable.value = false
  })

  const persons = computed<Person[]>(() => [...allPersons.value.values()])
  const generations = computed<Generation[]>(() => [...resGenerations.value.values()])
  const canRead = computed<boolean>(() => readUsers.value)

  return {
    persons,
    generations,
    filteredCampus,
    canRead,
    loadingTable,
    loadError,
  }
}
