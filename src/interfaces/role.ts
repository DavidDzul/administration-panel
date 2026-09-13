// Control (Roles) — administration-panel's own role/permission shapes,
// isolated from psicol-panel's roles by the backend's `type='ADMINISTRATION'`
// scoping (design obs #1593). Every endpoint that returns these is already
// filtered server-side to `type='ADMINISTRATION'` — the frontend never
// re-filters by type, it just consumes the (already-scoped) catalog.
export interface AdministrationPermission {
  id: number
  name: string
}

export interface AdministrationRole {
  id: number
  name: string
  permissions: AdministrationPermission[]
}
