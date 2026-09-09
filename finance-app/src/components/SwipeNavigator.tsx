import { useRef, useState } from 'react'

interface SwipeNavigatorProps {
  children: React.ReactNode
  /** Свайп пальцем вліво (типово — перехід до наступного періоду) */
  onSwipeLeft: () => void
  /** Свайп пальцем вправо (типово — перехід до попереднього періоду) */
  onSwipeRight: () => void
  /** Мінімальний зсув по X (px), після якого свайп зараховується */
  threshold?: number
}

// Горизонтальний свайп для перелистування між періодами (день/тиждень/...)
// на екрані "Огляд". Використовує Pointer Events — працює і на тач, і мишкою.
// Напрямок жесту (гор./верт.) визначається один раз на початку руху, щоб
// вертикальний скрол сторінки не конфліктував зі свайпом і навпаки.
export function SwipeNavigator({ children, onSwipeLeft, onSwipeRight, threshold = 60 }: SwipeNavigatorProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isHorizontalRef = useRef<boolean | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    isDraggingRef.current = true
    isHorizontalRef.current = null
    setIsDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const deltaX = e.clientX - startXRef.current
    const deltaY = e.clientY - startYRef.current

    if (isHorizontalRef.current === null) {
      // Чекаємо, поки жест стане однозначним — щоб не "з'їдати" перші пікселі
      // звичайного вертикального скролу.
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return
      isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY)
    }
    if (!isHorizontalRef.current) return

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setOffsetX(deltaX)
  }

  const finishDrag = () => {
    isDraggingRef.current = false
    setIsDragging(false)
    if (isHorizontalRef.current) {
      if (offsetX < -threshold) onSwipeLeft()
      else if (offsetX > threshold) onSwipeRight()
    }
    isHorizontalRef.current = null
    setOffsetX(0)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{
        width: '100%',
        transform: `translateX(${offsetX}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease',
        touchAction: 'pan-y',
      }}
    >
      {children}
    </div>
  )
}
