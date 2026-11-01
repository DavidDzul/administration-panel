// Mirrors impulsou-api App\Support\Banking\Clabe: 18 digits, bank code (3) +
// plaza (3) + account (11) + check digit (weights 3,7,1 mod 10).
const WEIGHTS = [3, 7, 1] as const

export const CLABE_LENGTH = 18

export function isValid(value: string | null | undefined): boolean {
  if (value == null || !/^\d{18}$/.test(value)) return false

  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += (Number(value[i]) * WEIGHTS[i % 3]) % 10
  }

  return Number(value[17]) === (10 - (sum % 10)) % 10
}

// Banxico bank code (first 3 digits), or null when it cannot be read.
export function bankCode(value: string | null | undefined): string | null {
  if (value == null || !/^\d{3}/.test(value)) return null
  return value.slice(0, 3)
}
