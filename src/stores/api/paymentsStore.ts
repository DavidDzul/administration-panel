import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BatchKey, PaymentBatchRow, PaymentBatchSummary } from '@/interfaces/payment'
import type { PaymentBatchIndexResponse, PaymentBatchProcessResponse } from '@/interfaces/api'

// Duck-types the HTTP status off a rejected request — same approach as
// paymentDataStore's getStatus, for the same reason: a caller re-throwing
// `{ response: { status } }` (impulsou-api's real error body) is not always
// a real AxiosError instance, so axios.isAxiosError can't be relied on.
function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}

function getErrorData(error: unknown): Record<string, unknown> | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { data?: { data?: Record<string, unknown> } } }).response?.data?.data
  }
  return undefined
}

// Discriminated result for processBatch — design's explicit requirement:
// 422 (blocking rows) and 409 (stale expected_count/expected_total) must be
// surfaced DISTINCTLY, never collapsed into one generic error state.
export type ProcessBatchResult =
  | { status: 'success'; batchId: number; rows: PaymentBatchRow[] }
  | { status: 'blocking'; blockingRows: PaymentBatchRow[] }
  | { status: 'stale'; count: number; totalAmount: string }
  | { status: 'error' }

export const usePaymentsStore = defineStore('paymentsStore', () => {
  const rows = ref<PaymentBatchRow[]>([])
  const summary = ref<PaymentBatchSummary | null>(null)
  const batchId = ref<number | null>(null)

  // Never called unless all 4 BatchKey fields are known — that gate lives in
  // usePaymentsPage (D7), not here. This store is a thin HTTP layer over the
  // server's single source of truth for readiness (PaymentBatchService).
  const fetchBatch = async (key: BatchKey): Promise<boolean> => {
    try {
      const res = await axios.get<PaymentBatchIndexResponse>('api/admin/scholarship-payments', {
        params: key,
        headers: { accept: 'application/json' },
      })
      rows.value = res.data.data.rows
      summary.value = res.data.data.summary
      return true
    } catch (error: unknown) {
      console.error('Error al cargar el lote de pagos:', error)
      return false
    }
  }

  // Always posts the batch KEY + expected_count/expected_total, never
  // ids[] (design D2) — the all-or-nothing gate is a server invariant, the
  // UI's disabled button is only a convenience.
  const processBatch = async (
    key: BatchKey,
    expectedCount: number,
    expectedTotal: string,
  ): Promise<ProcessBatchResult> => {
    try {
      const res = await axios.post<PaymentBatchProcessResponse>('api/admin/scholarship-payments/process', {
        ...key,
        expected_count: expectedCount,
        expected_total: expectedTotal,
      })
      rows.value = res.data.data.rows
      batchId.value = res.data.data.batch_id
      return { status: 'success', batchId: res.data.data.batch_id, rows: res.data.data.rows }
    } catch (error: unknown) {
      const status = getStatus(error)
      const data = getErrorData(error)

      if (status === 422) {
        return { status: 'blocking', blockingRows: (data?.blocking_rows as PaymentBatchRow[] | undefined) ?? [] }
      }

      if (status === 409) {
        return {
          status: 'stale',
          count: (data?.count as number | undefined) ?? 0,
          totalAmount: (data?.total_amount as string | undefined) ?? '0.00',
        }
      }

      console.error('Error al procesar el lote de pagos:', error)
      return { status: 'error' }
    }
  }

  return {
    rows,
    summary,
    batchId,
    fetchBatch,
    processBatch,
  }
})
