export type UserType = 'ADMIN'

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
