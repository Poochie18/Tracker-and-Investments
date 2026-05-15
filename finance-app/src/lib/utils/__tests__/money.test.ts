import { describe, it, expect } from 'vitest'
import { Money, sumMoney } from '../money'

// ============================================================
// Тести для класу Money.
// Запуск: npm run test (або npm run test:run для одноразово)
// ============================================================

describe('Money.fromUah', () => {
  it('перетворює гривні в копійки', () => {
    expect(Money.fromUah(1).toKopiyky()).toBe(100)
    expect(Money.fromUah(12.5).toKopiyky()).toBe(1250)
    expect(Money.fromUah(1234.56).toKopiyky()).toBe(123456)
  })

  it('округлює дробові копійки', () => {
    // 0.1 + 0.2 = 0.30000000000000004 у float — клас має впоратись
    expect(Money.fromUah(0.1).toKopiyky()).toBe(10)
    expect(Money.fromUah(0.005).toKopiyky()).toBe(1) // Math.round
  })
})

describe('Money.fromKopiyky', () => {
  it('зберігає копійки як є', () => {
    expect(Money.fromKopiyky(1250).toKopiyky()).toBe(1250)
    expect(Money.fromKopiyky(0).toKopiyky()).toBe(0)
  })

  it('кидає помилку якщо передати float', () => {
    expect(() => Money.fromKopiyky(12.5)).toThrow()
  })
})

describe('Money.toUah', () => {
  it('правильно конвертує назад у гривні', () => {
    expect(Money.fromKopiyky(1250).toUah()).toBe(12.5)
    expect(Money.fromKopiyky(100).toUah()).toBe(1)
  })
})

describe('Money.format', () => {
  it('форматує суму з символом гривні', () => {
    const result = Money.fromUah(1234.56).format()
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
    expect(result).toContain('₴')
  })

  it('форматує нуль', () => {
    expect(Money.zero().format()).toContain('0')
  })
})

describe('Money арифметика', () => {
  it('додає дві суми', () => {
    const a = Money.fromUah(10)
    const b = Money.fromUah(5.5)
    expect(a.add(b).toKopiyky()).toBe(1550)
  })

  it('віднімає суми', () => {
    const a = Money.fromUah(10)
    const b = Money.fromUah(3)
    expect(a.subtract(b).toKopiyky()).toBe(700)
  })

  it('заперечення', () => {
    expect(Money.fromUah(5).negate().toKopiyky()).toBe(-500)
  })

  it('не дає помилки при великих сумах', () => {
    const big = Money.fromUah(999999.99)
    expect(big.add(big).toKopiyky()).toBe(199999998)
  })
})

describe('Money порівняння', () => {
  it('isZero', () => {
    expect(Money.zero().isZero()).toBe(true)
    expect(Money.fromUah(1).isZero()).toBe(false)
  })

  it('isPositive / isNegative', () => {
    expect(Money.fromUah(1).isPositive()).toBe(true)
    expect(Money.fromUah(1).negate().isNegative()).toBe(true)
  })

  it('equals', () => {
    expect(Money.fromUah(5).equals(Money.fromKopiyky(500))).toBe(true)
    expect(Money.fromUah(5).equals(Money.fromUah(6))).toBe(false)
  })

  it('greaterThan', () => {
    expect(Money.fromUah(10).greaterThan(Money.fromUah(5))).toBe(true)
    expect(Money.fromUah(5).greaterThan(Money.fromUah(10))).toBe(false)
  })
})

describe('sumMoney', () => {
  it('підсумовує масив', () => {
    const amounts = [Money.fromUah(10), Money.fromUah(20), Money.fromUah(5)]
    expect(sumMoney(amounts).toKopiyky()).toBe(3500)
  })

  it('повертає нуль для порожнього масиву', () => {
    expect(sumMoney([]).isZero()).toBe(true)
  })
})
