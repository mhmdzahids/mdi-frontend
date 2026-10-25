import { useRef, useCallback } from 'react'

/**
 * Hook untuk menangani gestur Press & Hold (Long-Press) pada mobile touch dan desktop mouse.
 * 
 * @param {Function} onLongPress - Callback saat ditahan selama `delay` ms
 * @param {Function} [onClick] - Callback saat diklik/tap singkat
 * @param {Object} [options]
 * @param {number} [options.delay=500] - Durasi tahan (default 500ms)
 * @param {number} [options.moveThreshold=10] - Toleransi geser scroll dalam pixel (default 10px)
 */
export function useLongPress(onLongPress, onClick, { delay = 500, moveThreshold = 10 } = {}) {
  const timerRef = useRef(null)
  const isLongPressRef = useRef(false)
  const isMovedRef = useRef(false)
  const startCoordsRef = useRef({ x: 0, y: 0 })

  const start = useCallback(
    (e) => {
      isLongPressRef.current = false
      isMovedRef.current = false
      if (e.touches && e.touches[0]) {
        startCoordsRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else {
        startCoordsRef.current = { x: e.clientX, y: e.clientY }
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          try {
            navigator.vibrate(50)
          } catch {
            // Abaikan jika tidak didukung platform
          }
        }
        onLongPress?.(e)
      }, delay)
    },
    [onLongPress, delay]
  )

  const move = useCallback(
    (e) => {
      const curX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX
      const curY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY
      const diffX = Math.abs(curX - startCoordsRef.current.x)
      const diffY = Math.abs(curY - startCoordsRef.current.y)

      // Jika jari bergeser melebihi threshold, ini adalah aksi scroll halaman, batalkan timer & tandai isMoved
      if (diffX > moveThreshold || diffY > moveThreshold) {
        isMovedRef.current = true
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
      }
    },
    [moveThreshold]
  )

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    isMovedRef.current = false
    cancelTimer()
  }, [cancelTimer])

  const handleClick = useCallback(
    (e) => {
      // Jika gesture adalah long press, cegah click event
      if (isLongPressRef.current) {
        e.preventDefault()
        e.stopPropagation()
        isLongPressRef.current = false
        return
      }
      // Jika gesture adalah scroll/gerak, cegah click event
      if (isMovedRef.current) {
        e.preventDefault()
        e.stopPropagation()
        isMovedRef.current = false
        return
      }
      onClick?.(e)
    },
    [onClick]
  )

  return {
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: cancelTimer,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: cancelTimer,
    onTouchCancel: cancel,
    onClick: handleClick,
    onContextMenu: (e) => {
      if (isLongPressRef.current) {
        e.preventDefault()
      }
    }
  }
}
