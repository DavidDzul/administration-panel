import { computed, onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { usePersonsStore } from '@/stores/api/personsStore'
import { usePaymentDataStore } from '@/stores/api/paymentDataStore'
import { useAuthStore } from '@/stores/api/authStore'
import type { Person } from '@/interfaces/user'

// D4 (usePersonsPage.ts): lifecycle lives HERE, not inside a Pinia store, so
// it fires per route entry against this view's real component instance.
//
// PR3a scope (design obs #1583 / tasks obs #1584): identity header data via
// `personsStore.showPerson`. The panel itself is an empty PR3b placeholder
// in this batch, but `paymentDataStore.fetchPaymentData` is still called
// unconditionally on load — CRITICAL hand-off from PR2 (apply-progress obs
// #1585): `paymentDataStore.savePaymentData`'s POST-vs-PUT decision reads an
// internal `existsByUser` map that is populated ONLY by a prior
// `fetchPaymentData` call for that user id in the same store instance. If
// this composable didn't call it on load, PR3b's save dialog would default
// to POST every time, even for an already-configured user.
export function usePersonDetailsPage() {
  const route = useRoute()
  const personsStore = usePersonsStore()
  const paymentDataStore = usePaymentDataStore()
  const { editPaymentData } = storeToRefs(useAuthStore())

  const selectedPerson = ref<Person | null>(null)
  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadPerson = async (): Promise<void> => {
    const id = Number(route.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      selectedPerson.value = null
      loadError.value = true
      return
    }

    loading.value = true
    loadError.value = false

    const person = await personsStore.showPerson(id)

    try {
      await paymentDataStore.fetchPaymentData(id)
    } catch (error: unknown) {
      // Non-404 failures (network, 500) are logged but must not block
      // rendering the identity header — the payment panel is a PR3b
      // placeholder in this batch and has nothing to display yet.
      console.error('Error al cargar los datos de pago:', error)
    }

    selectedPerson.value = person
    loadError.value = !person
    loading.value = false
  }

  onBeforeMount(loadPerson)
  watch(() => route.params.id, loadPerson)

  const canEdit = computed<boolean>(() => editPaymentData.value)

  return {
    selectedPerson,
    loading,
    loadError,
    canEdit,
  }
}
