import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Елемент #root не знайдено в index.html')

createRoot(rootEl).render(
  <StrictMode>
    {/* Найширша межа помилки — ловить краш ще ДО AppLayout (напр. на
        екрані логіну чи в AuthGuard), не лише всередині захищених
        маршрутів (там своя, вужча межа — AppLayout.tsx). */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
