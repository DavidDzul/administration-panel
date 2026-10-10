import type { Person } from './user'
import type { Generation } from './generation'
import type { PaymentData } from './paymentData'
import type { ScholarshipProfileConfig } from './scholarshipProfile'
import type { ScholarshipSetting } from './scholarshipSetting'
import type { AdministrationRole, AdministrationPermission } from './role'
import type { Administrator } from './administrator'
import type {
  TelmexCoverage,
  EligibleTelmexBecario,
  TelmexCoverageStatement,
  TelmexCoveragePayment,
} from './telmexCoverage'
import type {
  ExportSummary,
  GenerationPaymentSummary,
  GenerationSummaryGeneration,
  PaymentBatchBlock,
  PaymentBatchRow,
  PaymentBatchSummary,
  PaymentDocument,
} from './payment'

export interface LoginResponse {
  token: string
}

export interface PermissionsListResponse {
  permissions: string[]
}

export interface UpdateProfileResponse {
  res: boolean
  msg: string
  user: {
    first_name: string
    last_name: string
    email: string
    phone?: string
  }
}

export interface PersonsResponse {
  res: boolean
  users: Person[]
}

export interface GraduatesResponse {
  res: boolean
  graduates: Person[]
}

export interface GenerationsResponse {
  res: boolean
  generations: Generation[]
}

// Matches ScholarshipPaymentDataController's real envelope, verified by
// reading impulsou-api's controller directly (PR1b) rather than guessing:
// `data` is `null` alongside `res: false` on the 404 "not configured" path,
// and populated alongside `res: true` on 200/201.
export interface PaymentDataResponse {
  res: boolean
  data: PaymentData | null
  msg?: string
}

// Matches ScholarshipProfileController::show()/updateConfig()'s real
// envelope (design D5/D2, sdd/scholarship-profile-config-to-admin),
// verified by reading impulsou-api's controller directly — `data` is
// `null` alongside `res: false` on the 404 "not found" path, same shape as
// PaymentDataResponse above.
export interface ScholarshipProfileConfigResponse {
  res: boolean
  data: ScholarshipProfileConfig | null
  msg?: string
}

// Matches ScholarshipSettingController::show()/update()'s real envelope
// (design D8, sdd/scholarship-telmex-iu-split) — `data` is never null, the
// single settings row always exists (firstOrCreate).
export interface ScholarshipSettingResponse {
  res: boolean
  data: ScholarshipSetting
}

// Matches UserController::show's real envelope (`{ user: ... }`, no `res`
// key) — verified by reading impulsou-api/app/Http/Controllers/Admin/UserController.php
// directly rather than assuming the `{res, users}` shape used by `index()`.
export interface PersonResponse {
  user: Person
}

// Matches AdministrationRoleController's real envelopes, verified by reading
// impulsou-api/app/Http/Controllers/Admin/AdministrationRoleController.php
// directly (PR5) — every action shares the `{res, ...}` shape used elsewhere
// in this controller, and `show`'s 404 body is `{res: false, msg}` (no
// `role` key at all on that path, so `role` stays required — callers must
// check the HTTP status, not a nullable field, matching the controller).
export interface AdministrationRolesResponse {
  res: boolean
  roles: AdministrationRole[]
}

export interface AdministrationRoleResponse {
  res: boolean
  role: AdministrationRole
  msg?: string
}

export interface AdministrationPermissionsCatalogResponse {
  res: boolean
  permissions: AdministrationPermission[]
}

// Matches AdministratorController's real envelopes, verified by reading
// impulsou-api/app/Http/Controllers/Admin/AdministratorController.php
// directly (PR8) — every action shares the `{res, ...}` shape used
// elsewhere in this codebase, and `show`'s 404 body is `{res: false, msg}`
// (no `administrator` key on that path), so `administrator` stays required
// — callers must check the HTTP status, not a nullable field.
export interface AdministratorsResponse {
  res: boolean
  administrators: Administrator[]
}

export interface AdministratorResponse {
  res: boolean
  administrator: Administrator
  msg?: string
}

// Matches ScholarshipPaymentController::index()'s real envelope, verified by
// reading impulsou-api/app/Http/Controllers/Admin/ScholarshipPaymentController.php
// directly rather than guessing — `data` nests `rows`, `summary`, and the
// `batch` block (design D3, sdd/becario-payment-bank-file-export).
export interface PaymentBatchIndexResponse {
  res: boolean
  data: {
    rows: PaymentBatchRow[]
    summary: PaymentBatchSummary
    batch: PaymentBatchBlock
  }
}

// Matches ScholarshipPaymentController::exportSummary()'s real envelope
// (design D4, sdd/becario-payment-bank-file-export). The 422 (blocked rows)
// and empty-batch error bodies are NOT modeled here — they arrive as
// rejected promises and are narrowed by HTTP status in
// paymentsStore.downloadExportFile/fetchExportSummary.
export interface ExportSummaryResponse {
  res: boolean
  data: ExportSummary
}

// Matches ScholarshipPaymentController::process()'s 200 envelope. The 422
// (blocking rows) and 409 (stale expected_count/expected_total) error bodies
// are NOT modeled here — they arrive as rejected promises and are narrowed
// by HTTP status in paymentsStore.processBatch, per design's requirement
// that those two states be surfaced distinctly, not as one generic error.
export interface PaymentBatchProcessResponse {
  res: boolean
  data: {
    batch_id: number
    rows: PaymentBatchRow[]
  }
}

// Matches ScholarshipPaymentController::document()'s real envelope, verified
// by reading the controller directly (PR6) — `data` is the flat
// PaymentDocument shape, no extra nesting.
export interface PaymentDocumentResponse {
  res: boolean
  data: PaymentDocument
}

// Matches ScholarshipPaymentController::byGeneration()'s real envelope
// (sdd/pagos-por-generacion-estado-pago, spec: "Response is summary-only"
// requirement) — deliberately NO `rows` key (read-only summary slice).
// `summary` now equals `generationSummary(rows(campus, year, month,
// generationId))` (paid/pending/blocked partition), NOT `summary()`'s
// ready/blocking partition (that type is Lotes de pago's only, unchanged).
// `generation` echoes the server-resolved campus.
export interface PaymentsByGenerationResponse {
  res: boolean
  data: {
    summary: GenerationPaymentSummary
    generation: GenerationSummaryGeneration
  }
}

// Becas Telmex (sdd/telmex-cobertura-iu, PR4) — envelope shapes follow the
// `{res, msg, data}` contract from design #1920's API table. NOT yet
// verified against a live backend (PR3b lands in a parallel batch) — this is
// a contract ASSUMPTION; see the apply report for what PR3b must match.
export interface TelmexCoveragesResponse {
  res: boolean
  data: TelmexCoverage[]
}

export interface TelmexCoverageResponse {
  res: boolean
  msg?: string
  data: TelmexCoverage
}

export interface EligibleTelmexBecariosResponse {
  res: boolean
  data: EligibleTelmexBecario[]
}

export interface TelmexCoverageStatementResponse {
  res: boolean
  data: TelmexCoverageStatement
}

export interface TelmexCoveragePaymentResponse {
  res: boolean
  msg?: string
  data: TelmexCoveragePayment
}
