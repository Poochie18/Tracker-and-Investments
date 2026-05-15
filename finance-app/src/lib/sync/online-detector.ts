// ============================================================
// Детектор стану мережі.
// navigator.onLine — ненадійний (може бути true навіть при відсутності інтернету),
// але для PWA це прийнятно: перший реальний збій виявимо при спробі синку.
// ============================================================

type OnlineChangeCallback = (isOnline: boolean) => void

class OnlineDetector {
  private callbacks: Set<OnlineChangeCallback> = new Set()

  constructor() {
    window.addEventListener('online', () => this.notify(true))
    window.addEventListener('offline', () => this.notify(false))
  }

  get isOnline(): boolean {
    return navigator.onLine
  }

  // Підписка на зміну стану. Повертає функцію для відписки.
  subscribe(cb: OnlineChangeCallback): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  private notify(isOnline: boolean) {
    for (const cb of this.callbacks) cb(isOnline)
  }
}

// Singleton — один детектор на весь додаток
export const onlineDetector = new OnlineDetector()
