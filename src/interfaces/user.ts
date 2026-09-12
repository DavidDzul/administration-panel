export type UserType = 'ADMIN'

export type PersonType = 'BEC_ACTIVE' | 'BEC_INACTIVE'

export interface Person {
  id: number
  // Deviation from design doc's literal snippet (obs #1574): psicol-panel's
  // actual `User.enrollment` (interfaces/user.ts) is `string | null`, not
  // `string`. Following the real backend/psicol shape rather than the design
  // snippet, per this task's "do not guess — read the actual source" rule.
  enrollment: string | null
  first_name: string
  last_name: string
  email: string
  phone?: string
  user_type: PersonType
  campus: string
  generation_id: number | string | null
  active: boolean
}

export interface UserRole {
  id: number
  name: string
}

export interface UserProfile {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  workstation?: string
  campus?: string
  user_type?: UserType
  roles: UserRole[]
}

export interface UserProfileForm {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  confirmation: string
}
