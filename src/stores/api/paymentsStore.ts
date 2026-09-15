import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  BatchKey,
  ExportSummary,
  InvalidBankRow,
  PaymentBatchRow,
  PaymentBatchSummary,
  PaymentDocument,
} from '@/interfaces/payment'
import type {
  ExportSummaryResponse,
  PaymentBatchIndexResponse,
  PaymentBatchProcessResponse,
  PaymentDocumentResponse,
} from '@/interfaces/api'

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

// Discriminated result for downloadExportFile — same "never collapse into
// one generic error" convention as ProcessBatchResult. 'blocked' is the
// 422 all-or-nothing bank-data-validation gate (design D4); 'error' is
// everything else (network/500/403/404).
export type DownloadExportResult =
  | { status: 'success' }
  | { status: 'blocked'; invalidRows: InvalidBankRow[] }
  | { status: 'error' }

// Symfony's real Content-Disposition default is unquoted
// (`attachment; filename=X.TXT`), verified against the backend's own
// feature tests (apply-progress Decision #1) — this still tolerates a
// quoted value defensively. Server-owned filename (design D5); the SPA
// never composes one, only reads what streamDownload() actually sent.
function extractFilename(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition)
  return match ? decodeURIComponent(match[1]) : null
}

// The browser-side half of design D6 — a normal client-side Blob download,
// distinct from the auth concern above (which is about the REQUEST needing
// the Bearer header). This part never re-hits the network.
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const usePaymentsStore = defineStore('paymentsStore', () => {
  const rows = ref<PaymentBatchRow[]>([])
  const summary = ref<PaymentBatchSummary | null>(null)
  const batchId = ref<number | null>(null)
  const isPaid = ref<boolean>(false)
  const document = ref<PaymentDocument | null>(null)

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
      // D3 — this is what lets the SPA reach the export action after a page
      // reload; `batchId` is no longer only set transiently by processBatch.
      batchId.value = res.data.data.batch?.batch_id ?? null
      isPaid.value = res.data.data.batch?.is_paid ?? false
      return true
    } catch (error: unknown) {
      console.error('Error al cargar el lote de pagos:', error)
      return false
    }
  }

  // Plain JSON pre-flight (design D4) — count/total/filename computed from
  // the SAME paidRows()+BankDataValidator gate export() uses, so this can
  // never promise something the file endpoint fails to deliver.
  const fetchExportSummary = async (id: number): Promise<ExportSummary | null> => {
    try {
      const res = await axios.get<ExportSummaryResponse>(`api/admin/scholarship-payments/batches/${id}/export/summary`)
      return res.data.data
    } catch (error: unknown) {
      console.error('Error al cargar el resumen del archivo de pago:', error)
      return null
    }
  }

  // D6: responseType 'blob' is mandatory — this app's auth is a Bearer
  // header set on axios.defaults, not a cookie, so window.open/<a href>
  // would hit the endpoint unauthenticated. NON-OBVIOUS: with
  // `responseType: 'blob'` set, a 422 error body ALSO arrives as a Blob,
  // never as parsed JSON — it must be `.text()`-ed then `JSON.parse()`-d to
  // read `invalid_rows`, or blocked-row detail silently fails to surface.
  const downloadExportFile = async (id: number): Promise<DownloadExportResult> => {
    try {
      const res = await axios.get(`api/admin/scholarship-payments/batches/${id}/export`, {
        responseType: 'blob',
      })
      const contentDisposition = (res.headers as Record<string, string> | undefined)?.['content-disposition']
      const filename = extractFilename(contentDisposition) ?? `PAGO_${id}.TXT`
      triggerBlobDownload(res.data as Blob, filename)
      return { status: 'success' }
    } catch (error: unknown) {
      const status = getStatus(error)
      const errorBlob = (error as { response?: { data?: unknown } })?.response?.data

      if (status === 422 && errorBlob instanceof Blob) {
        try {
          const text = await errorBlob.text()
          const parsed = JSON.parse(text) as { data?: { invalid_rows?: InvalidBankRow[] } }
          return { status: 'blocked', invalidRows: parsed.data?.invalid_rows ?? [] }
        } catch (parseError: unknown) {
          console.error('Error al leer el detalle de becarios con datos bancarios inválidos:', parseError)
          return { status: 'blocked', invalidRows: [] }
        }
      }

      console.error('Error al descargar el archivo de pago:', error)
      return { status: 'error' }
    }
  }

  // Single-becario payment document (PR6). Same try/catch + boolean-return
  // shape as fetchBatch — never throws, the composable/view decide how to
  // surface a failed load.
  const fetchDocument = async (refrendId: number): Promise<boolean> => {
    try {
      const res = await axios.get<PaymentDocumentResponse>(`api/admin/scholarship-payments/${refrendId}/document`)
      document.value = res.data.data
      return true
    } catch (error: unknown) {
      console.error('Error al cargar el documento de pago:', error)
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
    isPaid,
    document,
    fetchBatch,
    fetchDocument,
    processBatch,
    fetchExportSummary,
    downloadExportFile,
  }
})
