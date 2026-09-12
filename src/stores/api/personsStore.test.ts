// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Person } from '@/interfaces/user'

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))

vi.mock('@/axiosConfig', () => ({
  default: {
    get: mockAxiosGet,
  },
}))

import { usePersonsStore } from '@/stores/api/personsStore'

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

describe('personsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  it('fetches api/admin/users and api/admin/graduates and merges them into a single Map keyed by id', async () => {
    const user = buildPerson({ id: 1, user_type: 'BEC_ACTIVE' })
    const graduate = buildPerson({ id: 2, user_type: 'BEC_INACTIVE' })
    mockAxiosGet
      .mockResolvedValueOnce({ data: { res: true, users: [user] } })
      .mockResolvedValueOnce({ data: { res: true, graduates: [graduate] } })

    const store = usePersonsStore()
    const result = await store.fetchPersons()

    expect(result).toBe(true)
    expect(mockAxiosGet).toHaveBeenNthCalledWith(1, 'api/admin/users', {
      headers: { accept: 'application/json' },
    })
    expect(mockAxiosGet).toHaveBeenNthCalledWith(2, 'api/admin/graduates', {
      headers: { accept: 'application/json' },
    })
    expect(store.allPersons.size).toBe(2)
    expect(store.allPersons.get(1)).toEqual(user)
    expect(store.allPersons.get(2)).toEqual(graduate)
  })

  it('resolves an id collision in favor of the graduates entry (last write wins)', async () => {
    const user = buildPerson({ id: 1, user_type: 'BEC_ACTIVE', first_name: 'AsUser' })
    const graduate = buildPerson({ id: 1, user_type: 'BEC_INACTIVE', first_name: 'AsGraduate' })
    mockAxiosGet
      .mockResolvedValueOnce({ data: { res: true, users: [user] } })
      .mockResolvedValueOnce({ data: { res: true, graduates: [graduate] } })

    const store = usePersonsStore()
    await store.fetchPersons()

    expect(store.allPersons.size).toBe(1)
    expect(store.allPersons.get(1)?.first_name).toBe('AsGraduate')
  })

  it('leaves allPersons unchanged and returns false when one of the two requests fails (partial failure)', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { res: true, users: [buildPerson({ id: 1 })] } })
      .mockRejectedValueOnce(new Error('network error'))

    const store = usePersonsStore()
    const result = await store.fetchPersons()

    expect(result).toBe(false)
    expect(store.allPersons.size).toBe(0)
  })

  it('returns false and does not throw when both requests fail', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'))

    const store = usePersonsStore()

    await expect(store.fetchPersons()).resolves.toBe(false)
    expect(store.allPersons.size).toBe(0)
  })

  // Task 2.6 (PR2) — showPerson(id) only, per design D6. Fetches a single
  // person's identity data for the detail view's hard-reload case. Matches
  // UserController::show's real `{ user: ... }` envelope (verified by
  // reading impulsou-api's controller directly, not the `{res, users}`
  // shape used by `index()`).
  it('showPerson fetches api/admin/users/{id} and returns the person', async () => {
    const person = buildPerson({ id: 5 })
    mockAxiosGet.mockResolvedValueOnce({ data: { user: person } })

    const store = usePersonsStore()
    const result = await store.showPerson(5)

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/users/5', {
      headers: { accept: 'application/json' },
    })
    expect(result).toEqual(person)
  })

  it('showPerson returns null and does not throw when the request fails', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'))

    const store = usePersonsStore()
    const result = await store.showPerson(5)

    expect(result).toBeNull()
  })
})
