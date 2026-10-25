export type PaymentMethod = 'TRANSFER' | 'CHEQUE'

export interface PaymentData {
  id: number
  user_id: number
  // Bank fields are null for CHEQUE rows (the server nulls them).
  bank_name: string | null
  account_number: string | null
  curp: string
  rfc: string | null
  payment_method: PaymentMethod
  cheque_beneficiary: string | null
  created_at?: string
  updated_at?: string
}

// Submission shape for both create (POST) and update (PUT). `rfc` stays
// optional here — required: false at the type level mirrors the backend's
// nullable column and the spec's "rfc is the only optional field" decision
// (obs #1582, R2 "required fields enforced on submit").
export interface PaymentDataForm {
  bank_name: string | null
  account_number: string | null
  curp: string
  rfc?: string | null
  payment_method: PaymentMethod
  cheque_beneficiary: string | null
}
