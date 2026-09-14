import { ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePaymentsStore } from '@/stores/api/paymentsStore'

// Single-becario payment document page. Mirrors useAccesoDetailPage's D4
// rationale (lifecycle lives here, not inside the Pinia store, so it fires
// against this composable's own real reactive source), simplified: one
// fetch, no secondary catalog, no writes — this is a read-only view (spec:
// administration only VIEWS the document before processing).
//
// sdd/becario-payment-batch-indicators: the document view moved from a
// routed page (`/pagos/:refrendId`) to a dialog opened from the batch table,
// so this composable no longer reads `useRoute()` — it takes the refrendId
// as a reactive source from its caller (the dialog's `refrendId` prop,
// `null` while the dialog is closed / no becario is selected). This is the
// one signature change the dialog conversion required.
export function usePaymentDocumentPage(refrendId: Ref<number | null>) {
  const paymentsStore = usePaymentsStore()
  const { document } = storeToRefs(paymentsStore)

  const loading = ref<boolean>(false)
  const loadError = ref<boolean>(false)

  const loadDocument = async (id: number | null): Promise<void> => {
    if (id === null || !Number.isFinite(id) || id <= 0) {
      document.value = null
      loadError.value = false
      loading.value = false
      return
    }

    loading.value = true
    loadError.value = false

    const success = await paymentsStore.fetchDocument(id)
    if (!success) loadError.value = true
    loading.value = false
  }

  watch(refrendId, (id) => void loadDocument(id), { immediate: true })

  return {
    document,
    loading,
    loadError,
  }
}
