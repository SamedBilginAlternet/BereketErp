import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney } from './format'

describe('formatMoney', () => {
  it('formats integer as Turkish lira', () => {
    expect(formatMoney(1250)).toContain('1.250')
  })
  it('formats decimal correctly', () => {
    expect(formatMoney(1250.5)).toContain('1.250,50')
  })
  it('accepts string input', () => {
    expect(formatMoney('500')).toContain('500')
  })
})

describe('formatDate', () => {
  it('formats ISO date as DD.MM.YYYY', () => {
    expect(formatDate('2024-11-15')).toBe('15.11.2024')
  })
  it('accepts Date object', () => {
    expect(formatDate(new Date('2024-01-05'))).toBe('05.01.2024')
  })
})
