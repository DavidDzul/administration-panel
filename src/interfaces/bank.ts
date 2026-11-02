// Matches `App\Models\Bank` (sdd/catalogo-bancos). `code` is the 3-digit
// Banxico code (CLABE prefix). `is_system` marks the locked batch bank
// (BBVA, 012): its code cannot change and it cannot be deactivated/deleted.
export interface Bank {
  id: number
  code: string
  name: string
  is_active: boolean
  is_system: boolean
}

// Submission shape for POST/PUT `admin/banks` (SaveBankRequest).
export interface BankForm {
  code: string
  name: string
  is_active: boolean
}

// Result of DELETE `admin/banks/{id}`: a referenced bank is deactivated
// instead of deleted, and the API says so in `msg`.
export interface BankDeleteResult {
  deleted: boolean
  msg: string
}
