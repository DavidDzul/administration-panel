// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePersonsPage } from '@/composables/usePersonsPage'
import { usePersonsStore } from '@/stores/api/personsStore'
import { useGenerationStore } from '@/stores/api/generationStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Person } from '@/interfaces/user'
import type { Generation } from '@/interfaces/generation'

// `onBeforeMount` inside a plain composable only registers against a real
// active component instance (that is the whole point of D4 — moving
// lifecycle out of the Pinia store and into the composable so it fires per
// route entry). To test it we must call the composable from inside an actual
// component's setup(), not invoke it as a bare function.
function withSetup<T>(composable: () => T): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  return result
}

const buildPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 1,
  enrollment: 'A0001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@iu.org.mx',
  phone: '9990000000',
  user_type: 'BEC_ACTIVE',
  campus: 'MERIDA',
  generation_id: 1,
  active: true,
  ...overrides,
})

const buildGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 1,
  campus: 'MERIDA',
  generation_active: true,
  generation_name: 'Generación 1',
  ...overrides,
})

describe('usePersonsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches persons and generations on mount and exposes the merged, mapped data', async () => {
    const person = buildPerson()
    const generation = buildGeneration()

    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'fetchPersons').mockImplementation(async () => {
      personsStore.allPersons = new Map([[person.id, person]])
      return true
    })

    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockImplementation(async () => {
      generationStore.resGenerations = new Map([[generation.id, generation]])
      return { res: true, generations: [generation] }
    })

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_READ_USERS']
    authStore.userProfile = {
      id: 1,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@iu.org.mx',
      campus: 'MERIDA',
      roles: [{ id: 1, name: 'ROOT_ADMINISTRATION' }],
    }

    const result = withSetup(() => usePersonsPage())

    expect(result.loadingTable.value).toBe(true)
    await flushPromises()

    expect(personsStore.fetchPersons).toHaveBeenCalledTimes(1)
    expect(generationStore.fetchGenerations).toHaveBeenCalledTimes(1)
    expect(result.persons.value).toEqual([person])
    expect(result.generations.value).toEqual([generation])
    expect(result.canRead.value).toBe(true)
    expect(result.loadError.value).toBe(false)
    expect(result.loadingTable.value).toBe(false)
  })

  it('sets loadError=true when fetchPersons fails, without blocking the generations fetch', async () => {
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'fetchPersons').mockResolvedValue(false)

    const generationStore = useGenerationStore()
    const fetchGenerationsSpy = vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const result = withSetup(() => usePersonsPage())
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(fetchGenerationsSpy).toHaveBeenCalledTimes(1)
    expect(result.loadingTable.value).toBe(false)
  })

  it('canRead reflects authStore.readUsers=false when the permission is absent', async () => {
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'fetchPersons').mockResolvedValue(true)

    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const authStore = useAuthStore()
    authStore.permissions = []

    const result = withSetup(() => usePersonsPage())
    await flushPromises()

    expect(result.canRead.value).toBe(false)
  })

  it('exposes filteredCampus mirrored from authStore', async () => {
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'fetchPersons').mockResolvedValue(true)

    const generationStore = useGenerationStore()
    vi.spyOn(generationStore, 'fetchGenerations').mockResolvedValue(undefined)

    const authStore = useAuthStore()
    authStore.userProfile = {
      id: 2,
      first_name: 'Grace',
      last_name: 'Hopper',
      email: 'grace@iu.org.mx',
      campus: 'VALLADOLID',
      roles: [{ id: 2, name: 'CAMPUS_STAFF' }],
    }

    const result = withSetup(() => usePersonsPage())
    await flushPromises()

    expect(result.filteredCampus.value).toEqual([{ value: 'VALLADOLID', text: 'Valladolid' }])
  })
})
