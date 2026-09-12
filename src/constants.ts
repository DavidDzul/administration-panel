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
} as const
