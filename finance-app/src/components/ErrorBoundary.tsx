import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

// Останній рубіж — якщо будь-який екран впаде рендером (напр. "Maximum
// update depth exceeded" на Огляді/Акціях інвестицій), без цього весь
// застосунок лишається білим/непрацездатним екраном без жодного способу
// вийти, крім закриття вкладки. Ловить помилку, показує дружній екран з
// кнопкою "Перезавантажити" замість краху всього SPA.
//
// Клас-компонент — componentDidCatch/getDerivedStateFromError досі нема
// хук-еквіваленту в React.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary spіймав помилку рендеру:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6 text-center"
          style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
        >
          <p className="text-base font-semibold">Щось пішло не так</p>
          <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Сталася непередбачена помилка під час відображення екрана. Спробуй перезавантажити —
            дані на диску не постраждали.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
          >
            <RefreshCw size={16} />
            Перезавантажити
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
