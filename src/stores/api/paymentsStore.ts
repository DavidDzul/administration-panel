import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  BatchKey,
  BlockingReason,
  ChequePaymentData,
  ChequeRow,
  ChequeSummary,
  ExportSummary,
  MarkChequePayload,
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
// 'already_processed' is the OTHER 409 case (bug fix): the backend also
// returns 409 when a batch already exists for this campus+year+month
// (`data.batch_id`, no `count`/`total_amount`) — collapsing it into 'stale'
// showed a misleading count 0 / $0.00 result instead of the real reason.
export type ProcessBatchResult =
  | { status: 'success'; batchId: number; rows: PaymentBatchRow[] }
  | { status: 'blocking'; blockingRows: PaymentBatchRow[] }
  | { status: 'stale'; count: number; totalAmount: string }
  | { status: 'already_processed'; batchId: number }
  // 422 EMPTY_BATCH (pago-cheque): the sede has no transfer rows (e.g. only
  // cheques) — distinct from 'blocking', which carries blocking rows.
  | { status: 'empty_batch'; msg: string | null }
  | { status: 'error' }

// Discriminated result shared by markChequePaid / revertChequePayment. Every
// failure carries the server `msg` (null only when the server sent none, e.g.
// a network failure) so the caller can show it verbatim.
export type ChequeActionResult =
  | { status: 'success'; data: ChequePaymentData }
  | { status: 'already_paid'; msg: string | null }
  | { status: 'not_payable'; msg: string | null; reasons: BlockingReason[] }
  | { status: 'not_cheque'; msg: string | null }
  | { status: 'cheque_number_taken'; msg: string | null }
  | { status: 'cycle_closed'; msg: string | null }
  | { status: 'telmex_repayment_exists'; msg: string | null }
  | { status: 'validation'; msg: string | null; errors: Record<string, string[]> }
  | { status: 'error'; msg: string | null }

// Maps the envelope `code` of a failed cheque action to its result status.
// Unknown/absent codes (404 NOT_FOUND, 403, CHEQUE_LOG_MISSING, 500) fall
// through to 'error' with the server msg.
const CHEQUE_CODE_STATUS: Record<string, 'already_paid' | 'not_cheque' | 'cheque_number_taken' | 'cycle_closed' | 'telmex_repayment_exists'> = {
  ALREADY_PAID: 'already_paid',
  NOT_CHEQUE_METHOD: 'not_cheque',
  NOT_CHEQUE_PAID: 'not_cheque',
  CHEQUE_NUMBER_TAKEN: 'cheque_number_taken',
  CYCLE_CLOSED: 'cycle_closed',
  TELMEX_REPAYMENT_EXISTS: 'telmex_repayment_exists',
}

interface ErrorBody {
  msg?: string
  message?: string
  code?: string
  errors?: Record<string, string[]>
  data?: { reasons?: BlockingReason[] } | null
}

function getErrorBody(error: unknown): ErrorBody | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { data?: ErrorBody } }).response?.data
  }
  return undefined
}

function mapChequeError(error: unknown): ChequeActionResult {
  const body = getErrorBody(error)
  const msg = body?.msg ?? body?.message ?? null

  if (body?.code === 'NOT_PAYABLE') {
    return { status: 'not_payable', msg, reasons: body.data?.reasons ?? [] }
  }

  const mapped = body?.code ? CHEQUE_CODE_STATUS[body.code] : undefined
  if (mapped) return { status: mapped, msg }

  // Laravel validation body: no envelope code, has field `errors`.
  if (getStatus(error) === 422 && body?.errors) {
    return { status: 'validation', msg, errors: body.errors }
  }

  return { status: 'error', msg }
}

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
  const chequeRows = ref<ChequeRow[]>([])
  const chequeSummary = ref<ChequeSummary | null>(null)
  const batchId = ref<number | null>(null)
  const isPaid = ref<boolean>(false)
  const document = ref<PaymentDocument | null>(null)

  // Never called unless all 3 BatchKey fields are known — that gate lives in
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
      chequeRows.value = res.data.data.cheque_rows ?? []
      chequeSummary.value = res.data.data.cheque_summary ?? null
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
        const body = getErrorBody(error)
        if (body?.code === 'EMPTY_BATCH') {
          return { status: 'empty_batch', msg: body.msg ?? null }
        }
        return { status: 'blocking', blockingRows: (data?.blocking_rows as PaymentBatchRow[] | undefined) ?? [] }
      }

      if (status === 409) {
        const existingBatchId = data?.batch_id

        if (typeof existingBatchId === 'number') {
          return { status: 'already_processed', batchId: existingBatchId }
        }

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

  const markChequePaid = async (refrendId: number, payload: MarkChequePayload): Promise<ChequeActionResult> => {
    try {
      const res = await axios.post<{ res: boolean; data: ChequePaymentData }>(
        `api/admin/scholarship-payments/${refrendId}/cheque-payment`,
        payload,
      )
      return { status: 'success', data: res.data.data }
    } catch (error: unknown) {
      return mapChequeError(error)
    }
  }

  const revertChequePayment = async (refrendId: number, reason: string): Promise<ChequeActionResult> => {
    try {
      const res = await axios.post<{ res: boolean; data: ChequePaymentData }>(
        `api/admin/scholarship-payments/${refrendId}/cheque-payment/revert`,
        { reason },
      )
      return { status: 'success', data: res.data.data }
    } catch (error: unknown) {
      return mapChequeError(error)
    }
  }

  return {
    rows,
    summary,
    chequeRows,
    chequeSummary,
    batchId,
    isPaid,
    document,
    markChequePaid,
    revertChequePayment,
    fetchBatch,
    fetchDocument,
    processBatch,
    fetchExportSummary,
    downloadExportFile,
  }
})
