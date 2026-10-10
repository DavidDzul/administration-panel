// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useTelmexCoverageDetailPage } from '@/composables/useTelmexCoverageDetailPage'
import { useTelmexCoverageStore } from '@/stores/api/telmexCoverageStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { TelmexCoverageStatement } from '@/interfaces/telmexCoverage'

// Mirrors useAccesoDetailPage.test.ts's withSetup helper exactly (D4:
// lifecycle lives in the composable, fires against a real mounted
// component instance, with a router plugin since this composable reads the
// `:id` route param).
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

const buildStatement = (overrides: Partial<TelmexCoverageStatement> = {}): TelmexCoverageStatement => ({
  coverage: {
    id: 5,
    user_id: 10,
    becario_name: 'Juan Pérez',
    campus: 'MERIDA',
    generation: 'Gen 2024',
    scholarship_type_at_activation: 'TELMEX',
    status: 'EN_COBRO',
    start_period: '2026-01-01',
    end_period: '2026-03-01',
    notes: null,
    cancel_reason: null,
    advanced: '1000.00',
    repaid: '400.00',
    balance: '600.00',
    has_paid_covered_month: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  months: [{ period: '2026-01-01', covered_amount: 500, is_paid: true, payment_batch_id: 3 }],
  payments: [
    {
      id: 1,
      coverage_id: 5,
      amount: '400.00',
      paid_at: '2026-02-01',
      reference: 'DEP-001',
      notes: null,
      is_voided: false,
      voided_at: null,
      void_reason: null,
      created_at: '2026-02-01T00:00:00Z',
    },
  ],
  ...overrides,
})

const buildRouter = async (id: string): Promise<Router> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/becas-telmex/:id', component: { template: '<div />' } }],
  })
  await router.push(`/becas-telmex/${id}`)
  return router
}

describe('useTelmexCoverageDetailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads the statement on mount and exposes coverage/months/payments', async () => {
    const statement = buildStatement()
    const store = useTelmexCoverageStore()
    const fetchSpy = vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(statement)

    const router = await buildRouter('5')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)

    expect(result.loading.value).toBe(true)
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(5)
    expect(result.coverage.value).toEqual(statement.coverage)
    expect(result.months.value).toEqual(statement.months)
    expect(result.payments.value).toEqual(statement.payments)
    expect(result.loadError.value).toBe(false)
    expect(result.loading.value).toBe(false)
  })

  it('sets loadError=true when fetchCoverageStatement resolves null (e.g. a 404)', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(null)

    const router = await buildRouter('999')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)
    await flushPromises()

    expect(result.loadError.value).toBe(true)
    expect(result.coverage.value).toBeNull()
    expect(result.months.value).toEqual([])
    expect(result.payments.value).toEqual([])
  })

  it('sets loadError=true for an invalid route id without calling the store', async () => {
    const store = useTelmexCoverageStore()
    const fetchSpy = vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(null)

    const router = await buildRouter('not-a-number')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)
    await flushPromises()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.loadError.value).toBe(true)
  })

  it('canManageRepayments reflects authStore.manageTelmexRepayments', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(buildStatement())

    const authStore = useAuthStore()
    authStore.permissions = ['ADM_MANAGE_TELMEX_REPAYMENTS']

    const router = await buildRouter('5')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)
    await flushPromises()

    expect(result.canManageRepayments.value).toBe(true)
  })

  it('canManageRepayments is false when the permission is absent', async () => {
    const store = useTelmexCoverageStore()
    vi.spyOn(store, 'fetchCoverageStatement').mockResolvedValue(buildStatement())

    const authStore = useAuthStore()
    authStore.permissions = []

    const router = await buildRouter('5')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)
    await flushPromises()

    expect(result.canManageRepayments.value).toBe(false)
  })

  it('refresh() re-fetches the statement for the current route id', async () => {
    const firstStatement = buildStatement()
    const secondStatement = buildStatement({
      coverage: { ...firstStatement.coverage, repaid: '600.00', balance: '400.00' },
    })
    const store = useTelmexCoverageStore()
    const fetchSpy = vi
      .spyOn(store, 'fetchCoverageStatement')
      .mockResolvedValueOnce(firstStatement)
      .mockResolvedValueOnce(secondStatement)

    const router = await buildRouter('5')
    const result = withSetup(() => useTelmexCoverageDetailPage(), router)
    await flushPromises()

    expect(result.coverage.value?.balance).toBe('600.00')

    await result.refresh()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.coverage.value?.balance).toBe('400.00')
  })
})
