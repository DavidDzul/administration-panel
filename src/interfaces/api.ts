import type { Person } from './user'
import type { Generation } from './generation'

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
