import { onBeforeMount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { usePaymentsStore } from '@/stores/api/paymentsStore'

// Single-refrend payment document page (PR6). Mirrors useAccesoDetailPage's
// D4 rationale (lifecycle lives here, not inside the Pinia store, so it
// fires on every route entry against this view's real component instance),
// simplified: one fetch, no secondary catalog, no writes — this is a
// read-only view (spec: administration only VIEWS the document before
// processing, it does not edit it here).
export function usePaymentDocumentPage() {
  const route = useRoute()
  const paymentsStore = usePaymentsStore()
  const { document } = storeToRefs(paymentsStore)

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadDocument = async (): Promise<void> => {
    const refrendId = Number(route.params.refrendId)

    if (!Number.isFinite(refrendId) || refrendId <= 0) {
      document.value = null
      loadError.value = true
      return
    }

    loading.value = true
    loadError.value = false

    const success = await paymentsStore.fetchDocument(refrendId)
    if (!success) loadError.value = true
    loading.value = false
  }

  onBeforeMount(loadDocument)
  watch(() => route.params.refrendId, loadDocument)

  return {
    document,
    loading,
    loadError,
  }
}
