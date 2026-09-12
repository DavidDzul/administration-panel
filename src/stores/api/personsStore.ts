import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Person } from '@/interfaces/user'
import type { PersonsResponse, GraduatesResponse, PersonResponse } from '@/interfaces/api'

export const usePersonsStore = defineStore('personsStore', () => {
  const allPersons = ref<Map<number, Person>>(new Map())

  // Read-only (no create/update/show per spec's out-of-scope boundary for
  // this slice — CRUD is out of scope). Fetches both users (becarios) and
  // graduates (egresados) and merges them into a single Map keyed by id,
  // mirroring psicol-panel's personsStore.fetchPersons.
  //
  // Uses Promise.all, so if either request rejects the whole call rejects —
  // fail-fast, no partial merge — matching psicol-panel's exact behavior
  // (its catch block only logs and leaves `allPersons` untouched). This
  // store additionally returns a boolean success flag (psicol's version
  // returns void) so the composable layer can surface an error state per
  // this change's spec requirement for a visible error state on API failure.
  //
  // On an id collision between a user and a graduate row, the graduate
  // entry wins: `combined` spreads users first and graduates last, and
  // `new Map(combined.map(...))` keeps the last write for a given key.
  const fetchPersons = async (): Promise<boolean> => {
    try {
      const [usersRes, graduatesRes] = await Promise.all([
        axios.get<PersonsResponse>('api/admin/users', {
          headers: { accept: 'application/json' },
        }),
        axios.get<GraduatesResponse>('api/admin/graduates', {
          headers: { accept: 'application/json' },
        }),
      ])
      const combined: Person[] = [...usersRes.data.users, ...graduatesRes.data.graduates]
      allPersons.value = new Map(combined.map((p) => [p.id, p]))
      return true
    } catch (error: unknown) {
      console.error('Error al cargar personas:', error)
      return false
    }
  }

  // D6 (sdd/becarios-payment-config): the ONLY addition this store gains for
  // the payment-config feature — read-only, per this store's documented
  // invariant (no create/update/show for payment data lives here; that's
  // paymentDataStore's job). Used by the detail view's hard-reload case,
  // when `allPersons` is still an empty Map. Matches `UserController::show`'s
  // real `{ user: ... }` envelope (verified directly against the controller).
  const showPerson = async (id: number): Promise<Person | null> => {
    try {
      const res = await axios.get<PersonResponse>(`api/admin/users/${id}`, {
        headers: { accept: 'application/json' },
      })
      return res.data.user
    } catch (error: unknown) {
      console.error('Error al cargar la persona:', error)
      return null
    }
  }

  return {
    allPersons,
    fetchPersons,
    showPerson,
  }
})
