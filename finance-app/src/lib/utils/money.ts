// ============================================================
// Клас Money — єдиний спосіб роботи з грошовими сумами.
// Внутрішньо зберігає суму у КОПІЙКАХ (ціле число).
// Це виключає помилки округлення float: 0.1 + 0.2 !== 0.3.
// ============================================================

export class Money {
  // Приватне поле — зовні не можна змінити напряму
  private readonly kopiyky: number

  private constructor(kopiyky: number) {
    if (!Number.isInteger(kopiyky)) {
      throw new Error(`Money очікує ціле число копійок, отримано: ${kopiyky}`)
    }
    this.kopiyky = kopiyky
  }

  // ── Конструктори ──────────────────────────────────────────

  // Створити з гривень (наприклад, 12.5 → 1250 коп.)
  static fromUah(uah: number): Money {
    return new Money(Math.round(uah * 100))
  }

  // Створити з копійок (з БД або Dexie)
  static fromKopiyky(kopiyky: number): Money {
    return new Money(kopiyky)
  }

  static zero(): Money {
    return new Money(0)
  }

  // ── Читання ───────────────────────────────────────────────

  toKopiyky(): number {
    return this.kopiyky
  }

  toUah(): number {
    return this.kopiyky / 100
  }

  // Форматування: "1 234,56 ₴"
  format(currency = '₴'): string {
    const uah = Math.abs(this.kopiyky) / 100
    const formatted = uah.toLocaleString('uk-UA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const sign = this.kopiyky < 0 ? '−' : ''
    return `${sign}${formatted} ${currency}`
  }

  // Форматування без копійок, якщо вони рівні нулю: "1 234 ₴" або "1 234,50 ₴"
  formatCompact(currency = '₴'): string {
    const uah = Math.abs(this.kopiyky) / 100
    const hasCents = this.kopiyky % 100 !== 0
    const formatted = uah.toLocaleString('uk-UA', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    })
    const sign = this.kopiyky < 0 ? '−' : ''
    return `${sign}${formatted} ${currency}`
  }

  // ── Математика ────────────────────────────────────────────

  add(other: Money): Money {
    return new Money(this.kopiyky + other.kopiyky)
  }

  subtract(other: Money): Money {
    return new Money(this.kopiyky - other.kopiyky)
  }

  negate(): Money {
    return new Money(-this.kopiyky)
  }

  // ── Порівняння ────────────────────────────────────────────

  isZero(): boolean {
    return this.kopiyky === 0
  }

  isPositive(): boolean {
    return this.kopiyky > 0
  }

  isNegative(): boolean {
    return this.kopiyky < 0
  }

  equals(other: Money): boolean {
    return this.kopiyky === other.kopiyky
  }

  greaterThan(other: Money): boolean {
    return this.kopiyky > other.kopiyky
  }
}

// Зручна функція для підсумовування масиву транзакцій
export function sumMoney(amounts: Money[]): Money {
  return amounts.reduce((acc, m) => acc.add(m), Money.zero())
}
