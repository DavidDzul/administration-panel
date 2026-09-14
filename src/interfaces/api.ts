import type { Person } from './user'
import type { Generation } from './generation'
import type { PaymentData } from './paymentData'
import type { AdministrationRole, AdministrationPermission } from './role'
import type { Administrator } from './administrator'
import type { PaymentBatchRow, PaymentBatchSummary, PaymentDocument } from './payment'

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
// directly rather than guessing — `data` nests both `rows` and `summary`.
export interface PaymentBatchIndexResponse {
  res: boolean
  data: {
    rows: PaymentBatchRow[]
    summary: PaymentBatchSummary
  }
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
