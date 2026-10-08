import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GenerationSummaryGeneration, GenerationSummaryKey, PaymentBatchSummary } from '@/interfaces/payment'
import type { PaymentsByGenerationResponse } from '@/interfaces/api'

// Read-only summary slice (sdd/pagos-consulta-por-generacion, design D6) —
// a dedicated store instead of reusing paymentsStore so two routed views
// (Lotes de pago vs Resumen por generación) never mutate the same shared
// `summary` ref. Mirrors paymentsStore.fetchBatch's try/catch +
// boolean-return convention exactly: never throws, the composable/view
// decide how to surface a failed load.
export const usePaymentsByGenerationStore = defineStore('paymentsByGenerationStore', () => {
  const summary = ref<PaymentBatchSummary | null>(null)
  const generation = ref<GenerationSummaryGeneration | null>(null)

  const fetchSummary = async (key: GenerationSummaryKey): Promise<boolean> => {
    try {
      const res = await axios.get<PaymentsByGenerationResponse>('api/admin/scholarship-payments/by-generation', {
        params: key,
        headers: { accept: 'application/json' },
      })
      summary.value = res.data.data.summary
      generation.value = res.data.data.generation
      return true
    } catch (error: unknown) {
      console.error('Error al cargar el resumen de pagos por generación:', error)
      return false
    }
  }

  return {
    summary,
    generation,
    fetchSummary,
  }
})
