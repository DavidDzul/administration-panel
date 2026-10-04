import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { temporaryIncreaseDisplay } from '@/utils/temporaryIncreaseVigencia'

// sdd/temporary-increase-visibility, design D1/D2: pure vigencia helper.
// Date comparison MUST be ISO-string slicing + lexicographic compare, NEVER
// `new Date()` arithmetic — Laravel's `date` cast serializes as
// "...T00:00:00.000000Z", and naive `new Date()` parsing + local-component
// extraction in a UTC-6 environment resolves that to the PREVIOUS day. The
// TZ override below makes that bug class observable if ever reintroduced.
process.env.TZ = 'America/Mexico_City'

const buildFields = (overrides: Partial<Parameters<typeof temporaryIncreaseDisplay>[0]> = {}) => ({
  temporary_increase_amount: '500.00',
  temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
  temporary_increase_valid_until: '2026-12-31T00:00:00.000000Z',
  temporary_increase_reason: 'Ajuste especial',
  ...overrides,
})

describe('temporaryIncreaseDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when temporary_increase_amount is null', () => {
    expect(
      temporaryIncreaseDisplay(
        buildFields({ temporary_increase_amount: null }),
      ),
    ).toBeNull()
  })

  it('returns null when temporary_increase_amount is "0.00"', () => {
    expect(
      temporaryIncreaseDisplay(
        buildFields({ temporary_increase_amount: '0.00' }),
      ),
    ).toBeNull()
  })

  it('returns null when temporary_increase_amount is malformed/non-finite', () => {
    expect(
      temporaryIncreaseDisplay(
        buildFields({ temporary_increase_amount: 'not-a-number' }),
      ),
    ).toBeNull()
  })

  it('classifies VIGENTE when today is within [valid_from, valid_until] inclusive', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0)) // local 2026-10-15

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.state).toBe('VIGENTE')
    expect(result?.stateLabel).toBe('Vigente')
    expect(result?.stateColor).toBe('success')
  })

  it('classifies PROGRAMADO when today is before valid_from', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 12, 0, 0)) // local 2026-08-01, before 2026-09-01

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.state).toBe('PROGRAMADO')
    expect(result?.stateLabel).toBe('Programado')
    expect(result?.stateColor).toBe('info')
  })

  it('classifies EXPIRADO when today is after valid_until', () => {
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0)) // local 2027-01-15, after 2026-12-31

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.state).toBe('EXPIRADO')
    expect(result?.stateLabel).toBe('Expirado')
    expect(result?.stateColor).toBe('grey')
  })

  it('classifies SIN_RANGO when valid_from is null', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(
      buildFields({ temporary_increase_valid_from: null }),
    )

    expect(result?.state).toBe('SIN_RANGO')
    expect(result?.stateLabel).toBe('Sin vigencia')
    expect(result?.stateColor).toBe('warning')
  })

  it('classifies SIN_RANGO when valid_until is null', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(
      buildFields({ temporary_increase_valid_until: null }),
    )

    expect(result?.state).toBe('SIN_RANGO')
  })

  it('boundary: today === valid_from is VIGENTE (inclusive)', () => {
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0)) // local 2026-09-01, exactly valid_from

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.state).toBe('VIGENTE')
  })

  it('boundary: today === valid_until is VIGENTE (inclusive)', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0)) // local 2026-12-31, exactly valid_until

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.state).toBe('VIGENTE')
  })

  // UTC-6 off-by-one regression (design D2's exact flagged risk): the
  // increase's last valid day is 2026-10-01 (serialized with a bogus
  // "T00:00:00.000000Z" time component). With the machine/test TZ set to
  // America/Mexico_City (UTC-6), `new Date("2026-10-01T00:00:00.000000Z")`
  // resolves to 2026-09-30 18:00 LOCAL — so any logic that extracts the
  // local calendar day from that Date object (getDate()/getMonth()/
  // getFullYear(), or toLocaleDateString()) would see the range as ending
  // 2026-09-30, one day early. On today = 2026-10-01 local, that bug would
  // misclassify this as EXPIRADO. The correct ISO-slice implementation must
  // resolve VIGENTE instead.
  it('UTC-6 off-by-one: valid_until day boundary resolves VIGENTE, not EXPIRADO, under naive Date arithmetic', () => {
    vi.setSystemTime(new Date(2026, 9, 1, 10, 0, 0)) // local 2026-10-01, 10:00 CST

    const result = temporaryIncreaseDisplay(
      buildFields({
        temporary_increase_valid_from: '2026-09-01T00:00:00.000000Z',
        temporary_increase_valid_until: '2026-10-01T00:00:00.000000Z',
      }),
    )

    expect(result?.state).toBe('VIGENTE')
  })

  it('coerces a string amount and formats it as MXN currency', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(buildFields({ temporary_increase_amount: '500.00' }))

    expect(result?.amount).toContain('500.00')
  })

  it('formats the range as DD/MM/YYYY — DD/MM/YYYY', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(buildFields())

    expect(result?.range).toBe('01/09/2026 — 31/12/2026')
  })

  it('returns "Sin rango definido" as the range when valid_from or valid_until is null', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(
      buildFields({ temporary_increase_valid_from: null }),
    )

    expect(result?.range).toBe('Sin rango definido')
  })

  it('passes through the reason field untouched', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(buildFields({ temporary_increase_reason: 'Beca extraordinaria' }))

    expect(result?.reason).toBe('Beca extraordinaria')
  })

  it('reason is null when not provided', () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0))

    const result = temporaryIncreaseDisplay(buildFields({ temporary_increase_reason: null }))

    expect(result?.reason).toBeNull()
  })
})
