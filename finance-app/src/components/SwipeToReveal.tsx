import { useRef, useState } from 'react'

interface SwipeToRevealProps {
  children: React.ReactNode
  /** Content of the action panel revealed on swipe LEFT (right-side panel) */
  action: (close: () => void) => React.ReactNode
  /** Width of the right action panel in px */
  actionWidth?: number
  /** Content of the action panel revealed on swipe RIGHT (left-side panel). Optional — omit to disable. */
  leftAction?: (close: () => void) => React.ReactNode
  /** Width of the left action panel in px */
  leftActionWidth?: number
}

// Swipe-to-reveal: drag child content left to expose a right-side action panel,
// or drag right to expose a left-side action panel (if leftAction provided).
// Uses pointer events so it works on both touch and mouse.
export function SwipeToReveal({
  children,
  action,
  actionWidth = 80,
  leftAction,
  leftActionWidth = 80,
}: SwipeToRevealProps) {
  // Positive = right panel revealed (swiped left). Negative = left panel revealed (swiped right).
  const [offsetX, setOffsetX] = useState(0)
  // isDragging як state — потрібен у render (для transition), а ref поруч —
  // для синхронної перевірки всередині onPointerMove без стейл-замикань.
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)

  const close = () => setOffsetX(0)

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    isDraggingRef.current = true
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const delta = startXRef.current - e.clientX
    const min = leftAction ? -leftActionWidth : 0
    setOffsetX(Math.max(min, Math.min(delta, actionWidth)))
  }

  const onPointerUp = () => {
    isDraggingRef.current = false
    setIsDragging(false)
    // Snap: open if dragged past half the corresponding action width
    setOffsetX((prev) => {
      if (prev > actionWidth / 2) return actionWidth
      if (leftAction && prev < -leftActionWidth / 2) return -leftActionWidth
      return 0
    })
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Left action panel — revealed on swipe right */}
      {leftAction && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: leftActionWidth,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {leftAction(close)}
        </div>
      )}

      {/* Right action panel — always rendered behind the content */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: actionWidth,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {action(close)}
      </div>

      {/* Main content — slides left/right on swipe */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${-offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
          userSelect: 'none',
          cursor: offsetX !== 0 ? 'default' : 'grab',
        }}
      >
        {children}
      </div>
    </div>
  )
}
