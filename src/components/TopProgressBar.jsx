import { useState, useEffect, useRef } from 'react'
import { subscribeToLoading } from '../utils/api'

/**
 * TopProgressBar: Garis loading tipis profesional di puncak viewport (YouTube / GitHub / Linear style).
 * Merespons setiap request API aktif secara global tanpa memblokir interaksi pengguna.
 */
export default function TopProgressBar() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const timerRef = useRef([])

  const clearTimers = () => {
    timerRef.current.forEach((t) => clearTimeout(t))
    timerRef.current = []
  }

  useEffect(() => {
    const unsubscribe = subscribeToLoading((isLoading) => {
      clearTimers()

      if (isLoading) {
        setVisible(true)
        setOpacity(1)
        setProgress((prev) => (prev > 0 && prev < 85 ? prev : 15))

        // Animasi progress progresif saat menunggu server
        const t1 = setTimeout(() => {
          setProgress((p) => Math.max(p, 45))
        }, 120)

        const t2 = setTimeout(() => {
          setProgress((p) => Math.max(p, 75))
        }, 300)

        const t3 = setTimeout(() => {
          setProgress((p) => Math.max(p, 88))
        }, 700)

        timerRef.current = [t1, t2, t3]
      } else {
        // Request selesai: melesat ke 100% lalu fade out
        setProgress(100)

        const tFade = setTimeout(() => {
          setOpacity(0)
        }, 200)

        const tReset = setTimeout(() => {
          setVisible(false)
          setProgress(0)
          setOpacity(1)
        }, 450)

        timerRef.current = [tFade, tReset]
      }
    })

    return () => {
      unsubscribe()
      clearTimers()
    }
  }, [])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none bg-transparent overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-[#4685ac] via-[#3A6B80] to-[#2F7D5B] shadow-[0_0_10px_rgba(70,133,172,0.8)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity
        }}
      />
    </div>
  )
}
