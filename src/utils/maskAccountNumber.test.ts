import { describe, expect, it } from 'vitest'
import { maskAccountNumber } from '@/utils/maskAccountNumber'

// Follow-up to becario-payment-file-generation (sdd/becario-payment-batch-indicators):
// the payments table can be seen by multiple people during a batch review
// session, so the full bank account number must never be shown in the row —
// only the last 4 digits, with a clear placeholder when there is no account
// on file at all.
describe('maskAccountNumber', () => {
  it('returns "Sin cuenta" when the account number is null', () => {
    expect(maskAccountNumber(null)).toBe('Sin cuenta')
  })

  it('returns "Sin cuenta" when the account number is an empty string', () => {
    expect(maskAccountNumber('')).toBe('Sin cuenta')
  })

  it('masks a short string (fewer than 4 digits) showing all of it after the bullets', () => {
    expect(maskAccountNumber('12')).toBe('••••12')
  })

  it('masks an account number that is exactly 4 digits long', () => {
    expect(maskAccountNumber('1234')).toBe('••••1234')
  })

  it('masks a longer account number, keeping only the last 4 digits visible', () => {
    expect(maskAccountNumber('012180001234567895')).toBe('••••7895')
  })
})
