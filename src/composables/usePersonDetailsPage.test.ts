// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { usePersonDetailsPage } from '@/composables/usePersonDetailsPage'
import { usePersonsStore } from '@/stores/api/personsStore'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Person } from '@/interfaces/user'

// Mirrors usePersonsPage.test.ts's withSetup helper (D4: lifecycle lives in
// the composable, only fires against a real mounted component instance),
// extended with a router plugin since this composable reads route params.
function withSetup<T>(composable: () => T, router: Router): T {
  let result!: T
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  return result
}

const buildPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 5,
  enrollment: 'A0005',
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

const buildRouter = async (id: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/becarios/:id', component: { template: '<div />' } }],
  })
  await router.push(`/becarios/${id}`)
  return router
}

describe('usePersonDetailsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the person and payment data on mount, exposing the loaded state', async () => {
    const person = buildPerson()
    const personsStore = usePersonsStore()
    const showPersonSpy = vi.spyOn(personsStore, 'showPerson').mockResolvedValue(person)

    const paymentDataStore = usePaymentDataStore()
    const fetchPaymentDataSpy = vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_EDIT_PAYMENT_DATA']

    const router = await buildRouter('5')
    const result = withSetup(() => usePersonDetailsPage(), router)

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(showPersonSpy).toHaveBeenCalledWith(5)
    // CRITICAL (PR2 hand-off, see apply-progress obs #1585): fetchPaymentData
    // MUST run on load so paymentDataStore's existsByUser map is populated
    // before PR3b's save flow can decide POST-vs-PUT correctly.
    expect(fetchPaymentDataSpy).toHaveBeenCalledWith(5)
    expect(result.selectedPerson.value).toEqual(person)
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
    expect(result.canEdit.value).toBe(true)
  })

  it('sets loadError=true when showPerson resolves null (e.g. a 404)', async () => {
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'showPerson').mockResolvedValue(null)

    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const router = await buildRouter('999')
    const result = withSetup(() => usePersonDetailsPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.selectedPerson.value).toBeNull()
    expect(result.loading.value).toBe(false)
  })

  it('still calls fetchPaymentData even when it rejects, without blocking the identity load', async () => {
    const person = buildPerson()
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'showPerson').mockResolvedValue(person)

    const paymentDataStore = usePaymentDataStore()
    const fetchPaymentDataSpy = vi
      .spyOn(paymentDataStore, 'fetchPaymentData')
      .mockRejectedValue(new Error('network'))

    const router = await buildRouter('5')
    const result = withSetup(() => usePersonDetailsPage(), router)
    await flushPromises()

    expect(fetchPaymentDataSpy).toHaveBeenCalledWith(5)
    expect(result.selectedPerson.value).toEqual(person)
    expect(result.loadError.value).toBe(false)
  })

  it('sets loadError=true for an invalid route id without calling either store', async () => {
    const personsStore = usePersonsStore()
    const showPersonSpy = vi.spyOn(personsStore, 'showPerson').mockResolvedValue(null)
    const paymentDataStore = usePaymentDataStore()
    const fetchPaymentDataSpy = vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const router = await buildRouter('not-a-number')
    const result = withSetup(() => usePersonDetailsPage(), router)
    await flushPromises()

    expect(showPersonSpy).not.toHaveBeenCalled()
    expect(fetchPaymentDataSpy).not.toHaveBeenCalled()
    expect(result.loadError.value).toBe(true)
  })

  it('canEdit reflects authStore.editPaymentData=false when the permission is absent', async () => {
    const personsStore = usePersonsStore()
    vi.spyOn(personsStore, 'showPerson').mockResolvedValue(buildPerson())
    const paymentDataStore = usePaymentDataStore()
    vi.spyOn(paymentDataStore, 'fetchPaymentData').mockResolvedValue(null)

    const authStore = useAuthStore()
    authStore.permissions = []

    const router = await buildRouter('5')
    const result = withSetup(() => usePersonDetailsPage(), router)
    await flushPromises()

    expect(result.canEdit.value).toBe(false)
  })
})
