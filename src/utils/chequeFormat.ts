// Display helpers for the cheque UI (pago-cheque PR7).

/** Formats an API `YYYY-MM-DD` (or ISO datetime) date as DD/MM/YYYY; a dash when empty. */
export const formatChequeDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** Today in local time as `YYYY-MM-DD`, the format an `<input type="date">` expects. */
export const todayYmd = (): string => {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
