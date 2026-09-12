import type { Person } from './user'
import type { Generation } from './generation'
import type { PaymentData } from './paymentData'

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
