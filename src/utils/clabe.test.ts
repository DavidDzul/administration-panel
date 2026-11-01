import { describe, expect, it } from 'vitest'
import { bankCode, isValid } from '@/utils/clabe'

// Mirrors impulsou-api tests/Unit/ClabeTest.php so both validators agree.
describe('clabe', () => {
  describe('isValid', () => {
    it('accepts a CLABE with a valid check digit', () => {
      expect(isValid('012180000112345671')).toBe(true)
      expect(isValid('072000000000000009')).toBe(true)
    })

    it('rejects a wrong check digit', () => {
      expect(isValid('012180000112345670')).toBe(false)
    })

    it('rejects wrong length, non-digits and empty values', () => {
      expect(isValid('01218000011234567')).toBe(false)
      expect(isValid('0121800001123456711')).toBe(false)
      expect(isValid('01218000011234567A')).toBe(false)
      expect(isValid('')).toBe(false)
      expect(isValid(null)).toBe(false)
      expect(isValid(undefined)).toBe(false)
    })
  })

  describe('bankCode', () => {
    it('extracts the 3-digit bank code prefix', () => {
      expect(bankCode('012180000112345671')).toBe('012')
      expect(bankCode('072000000000000009')).toBe('072')
    })

    it('returns null when the prefix cannot be read', () => {
      expect(bankCode('12')).toBeNull()
      expect(bankCode('')).toBeNull()
      expect(bankCode(null)).toBeNull()
    })
  })
})
