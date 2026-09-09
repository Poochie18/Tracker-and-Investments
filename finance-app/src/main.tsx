import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import App from './App.tsx'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Елемент #root не знайдено в index.html')

// Тимчасово (діагностика "Maximum update depth exceeded" на Огляді
// інвестицій/Акціях) — V8 за замовчуванням обрізає Error.stack до 10
// кадрів, а всі 10 кадрів React-овий внутрішній рендер-цикл займає сам
// (react-dom-client.production.js), тож наш компонент-винуватець у трейс
// не влазить. TODO: прибрати цей рядок після знаходження причини.
;(Error as unknown as { stackTraceLimit: number }).stackTraceLimit = 50

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
