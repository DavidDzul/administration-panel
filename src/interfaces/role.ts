// Control (Roles) — administration-panel's own role/permission shapes,
// isolated from psicol-panel's roles by the backend's `type='ADMINISTRATION'`
// scoping (design obs #1593). Every endpoint that returns these is already
// filtered server-side to `type='ADMINISTRATION'` — the frontend never
// re-filters by type, it just consumes the (already-scoped) catalog.
export interface AdministrationPermission {
  id: number
  name: string
  // Optional AND nullable by design (D2): optional covers a frontend build
  // running against a pre-migration API (the rollback plan treats the two
  // deploys as independent); nullable covers PS_*/client-tier rows that are
  // never populated. Every read site must fall back — see D2.
  description?: string | null
  module?: string | null
}

export interface AdministrationRole {
  id: number
  name: string
  permissions: AdministrationPermission[]
}
