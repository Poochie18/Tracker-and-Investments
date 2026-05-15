import { useRef, useState } from 'react'

interface SwipeToRevealProps {
  children: React.ReactNode
  /** Content of the revealed action panel */
  action: (close: () => void) => React.ReactNode
  /** Width of the revealed action panel in px */
  actionWidth?: number
}

// Swipe-to-reveal: drag child content left to expose an action panel on the right.
// Uses pointer events so it works on both touch and mouse.
export function SwipeToReveal({ children, action, actionWidth = 80 }: SwipeToRevealProps) {
  const [offsetX, setOffsetX] = useState(0)
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)

  const close = () => setOffsetX(0)

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    isDraggingRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const delta = startXRef.current - e.clientX
    setOffsetX(Math.max(0, Math.min(delta, actionWidth)))
  }

  const onPointerUp = () => {
    isDraggingRef.current = false
    // Snap: open if dragged past half the action width
    setOffsetX((prev) => (prev > actionWidth / 2 ? actionWidth : 0))
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Action panel — always rendered behind the content */}
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

      {/* Main content — slides left on swipe */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(-${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
          userSelect: 'none',
          cursor: offsetX > 0 ? 'default' : 'grab',
        }}
      >
        {children}
      </div>
    </div>
  )
}
