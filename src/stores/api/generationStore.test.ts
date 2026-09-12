// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
  },
}))

import { useGenerationStore } from '@/stores/api/generationStore'

describe('generationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  it('fetches api/admin/generations and stores them in a Map keyed by id', async () => {
    const generation = { id: 1, campus: 'MERIDA', generation_active: true, generation_name: 'Generación 1' }
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, generations: [generation] } })

    const store = useGenerationStore()
    const result = await store.fetchGenerations()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/generations', {
      headers: { accept: 'application/json' },
    })
    expect(result?.generations).toEqual([generation])
    expect(store.resGenerations.get(1)).toEqual(generation)
  })

  it('returns undefined and does not throw when the request fails', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

    const store = useGenerationStore()
    const result = await store.fetchGenerations()

    expect(result).toBeUndefined()
    expect(store.resGenerations.size).toBe(0)
  })
})
