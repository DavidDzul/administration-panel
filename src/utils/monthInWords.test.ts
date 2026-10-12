import { describe, expect, it } from 'vitest'
import { isMonthBefore, monthInWords, previousMonthInWords } from '@/utils/monthInWords'

describe('monthInWords', () => {
  it('formats YYYY-MM and YYYY-MM-DD values in Spanish', () => {
    expect(monthInWords('2026-12')).toBe('diciembre 2026')
    expect(monthInWords('2026-09-01')).toBe('septiembre 2026')
  })

  it('returns an empty string for empty or invalid values', () => {
    expect(monthInWords('')).toBe('')
    expect(monthInWords(null)).toBe('')
    expect(monthInWords('2026-13')).toBe('')
  })
})

describe('previousMonthInWords', () => {
  it('returns the previous month, crossing the year boundary', () => {
    expect(previousMonthInWords('2026-12')).toBe('noviembre 2026')
    expect(previousMonthInWords('2027-01')).toBe('diciembre 2026')
  })
})

describe('isMonthBefore', () => {
  it('compares months regardless of the day part', () => {
    expect(isMonthBefore('2026-09-01', '2026-12')).toBe(true)
    expect(isMonthBefore('2026-09-01', '2026-09')).toBe(false)
    expect(isMonthBefore('2026-12', '2026-09-01')).toBe(false)
  })
})
