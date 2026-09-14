export const API_URL = import.meta.env.VITE_API_URL

export interface SelectOption {
  value: string
  text: string
}

export const campusArray: SelectOption[] = [
  { value: 'MERIDA', text: 'Mérida' },
  { value: 'VALLADOLID', text: 'Valladolid' },
  { value: 'TIZIMIN', text: 'Tizimín' },
  { value: 'OXKUTZCAB', text: 'Oxkutzcab' },
]

export const campusMap = new Map<string, SelectOption>([
  ['MERIDA', { value: 'MERIDA', text: 'Mérida' }],
  ['VALLADOLID', { value: 'VALLADOLID', text: 'Valladolid' }],
  ['TIZIMIN', { value: 'TIZIMIN', text: 'Tizimín' }],
  ['OXKUTZCAB', { value: 'OXKUTZCAB', text: 'Oxkutzcab' }],
])

export const becTypeArray: SelectOption[] = [
  { value: 'BEC_ACTIVE', text: 'Becario/a' },
  { value: 'BEC_INACTIVE', text: 'Egresado/a' },
]

// Pagos batch key requires `period_month` as an integer 1-12 (design D1,
// matches ScholarshipPaymentController's validation). Kept as its own
// `{value: number, text: string}` shape rather than `SelectOption` — the
// latter's `value: string` is load-bearing for campus codes elsewhere, and
// `periodMonth` in usePaymentsPage is a real `number | null`, not a string.
export interface NumericSelectOption {
  value: number
  text: string
}

export const monthsArray: NumericSelectOption[] = [
  { value: 1, text: 'Enero' },
  { value: 2, text: 'Febrero' },
  { value: 3, text: 'Marzo' },
  { value: 4, text: 'Abril' },
  { value: 5, text: 'Mayo' },
  { value: 6, text: 'Junio' },
  { value: 7, text: 'Julio' },
  { value: 8, text: 'Agosto' },
  { value: 9, text: 'Septiembre' },
  { value: 10, text: 'Octubre' },
  { value: 11, text: 'Noviembre' },
  { value: 12, text: 'Diciembre' },
]

// Single permission gates the nav entry, the route, and both backing fetches
// (users + graduates) — see spec's YAGNI resolution against ADM_READ_GRADUATES
// and the nav-gating pair. Kept as one module so a future split only touches
// this object + the seeder.
export const PERMISSIONS = {
  READ_USERS: 'ADM_READ_USERS',
  // Read/write split for `scholarship_payment_data` (becario payment config)
  // — mirrors the ADM_<ACTION>_<RESOURCE> naming precedent above; see design
  // D5 (sdd/becarios-payment-config) for the read/edit split rationale.
  READ_PAYMENT_DATA: 'ADM_READ_PAYMENT_DATA',
  EDIT_PAYMENT_DATA: 'ADM_EDIT_PAYMENT_DATA',
  // Control (Roles + Accesos) — read/manage split per resource, same naming
  // convention as above. Values must match the seeded `ADM_*` permission
  // names exactly (see sdd/control-accesos-administration-panel/design).
  READ_ROLES: 'ADM_READ_ROLES',
  MANAGE_ROLES: 'ADM_MANAGE_ROLES',
  READ_ADMINS: 'ADM_READ_ADMINS',
  MANAGE_ADMINS: 'ADM_MANAGE_ADMINS',
  // Pagos — read/process split per resource, same naming convention as
  // above. Values must match the seeded `ADM_*` permission names exactly
  // (see sdd/becario-payment-file-generation/design, "New Permissions").
  READ_PAYMENTS: 'ADM_READ_PAYMENTS',
  PROCESS_PAYMENTS: 'ADM_PROCESS_PAYMENTS',
} as const
