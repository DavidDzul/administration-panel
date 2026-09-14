// Masks a bank account/CLABE number for display in surfaces multiple people
// might see at once (sdd/becario-payment-batch-indicators). Always shows a
// fixed 4-bullet prefix followed by up to the last 4 real digits — never the
// full number. `null`/empty input renders a clear placeholder instead of an
// empty string, so the table cell never looks broken or accidentally blank.
export function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber) return 'Sin cuenta'

  const trimmed = accountNumber.trim()
  if (!trimmed) return 'Sin cuenta'

  const lastFour = trimmed.slice(-4)
  return `••••${lastFour}`
}
