// Month helpers for the "Telmex empezó a pagar" dialogs (single and bulk).
// Inputs are `type="month"` values ('YYYY-MM') or period dates
// ('YYYY-MM-DD'); outputs are Spanish words like "diciembre 2026".

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const parseYearMonth = (value: string | null | undefined): { year: number; month: number } | null => {
  if (!value) return null
  const [year, month] = value.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return null
  return { year, month }
}

/** 'YYYY-MM' or 'YYYY-MM-DD' → "diciembre 2026"; '' when invalid. */
export const monthInWords = (value: string | null | undefined): string => {
  const parsed = parseYearMonth(value)
  return parsed ? `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` : ''
}

/** The month before `value`, in words ('2026-12' → "noviembre 2026"). */
export const previousMonthInWords = (value: string | null | undefined): string => {
  const parsed = parseYearMonth(value)
  if (!parsed) return ''
  const month = parsed.month === 1 ? 12 : parsed.month - 1
  const year = parsed.month === 1 ? parsed.year - 1 : parsed.year
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** True when `a` is strictly before `b` (both 'YYYY-MM' or 'YYYY-MM-DD'). */
export const isMonthBefore = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const first = parseYearMonth(a)
  const second = parseYearMonth(b)
  if (!first || !second) return false
  return first.year * 12 + first.month < second.year * 12 + second.month
}
