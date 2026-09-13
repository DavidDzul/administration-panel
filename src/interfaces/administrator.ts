import type { AdministrationRole } from './role'

// Control (Accesos) — administrator account shape, mirrors psicol-panel's
// `Person`/`User` shapes but scoped to ADMINISTRATION-type accounts (design
// obs #1593, PR3a/PR3b's `AdministratorController`). Verified against the
// real controller directly (not guessed): `index`/`show` both return the
// account with its Spatie `roles` relation eager-loaded as an ARRAY, even
// though Accesos enforces "one role per account" at the business level
// (`assignRole` always REPLACES via `syncRoles([$role])`, never appends).
// Modeled faithfully to the actual JSON shape rather than assuming a
// singular `role` field the backend never sends.
export interface Administrator {
  id: number
  first_name: string
  last_name: string
  email: string
  roles: AdministrationRole[]
}

// Matches `User::createRulesAdministrator()` exactly — `role`/`role_id` are
// deliberately absent, the backend never reads them at creation time (spec
// R3): a freshly created administrator always holds zero roles.
export interface CreateAdministratorForm {
  first_name: string
  last_name: string
  email: string
  password: string
}
