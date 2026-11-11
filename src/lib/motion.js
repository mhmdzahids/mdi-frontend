import { useEffect, useState } from 'react'

/**
 * Standard Easing Curves & Durations
 * Durasi halus berkisar 0.4 - 0.7 detik dengan ease-out alami (hindari pergerakan kaku).
 */
export const EASING = {
  smooth: [0.22, 1, 0.36, 1], // Cubic bezier responsif & elegan
  gentle: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1]
}

export const DURATION = {
  instant: 0.15,
  fast: 0.3,
  normal: 0.5,
  slow: 0.75
}

/**
 * Hook untuk mendeteksi preferensi reduced motion pada browser/OS pengguna
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handler = (e) => setPrefersReducedMotion(e.matches)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler)
    } else {
      mediaQuery.addListener(handler)
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler)
      } else {
        mediaQuery.removeListener(handler)
      }
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Reusable Motion Variants (Hanya transform dan opacity)
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (custom = {}) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: custom.duration || DURATION.normal,
      delay: custom.delay || 0,
      ease: EASING.smooth
    }
  }),
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: DURATION.fast, ease: 'easeIn' }
  }
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: (custom = {}) => ({
    opacity: 1,
    transition: {
      duration: custom.duration || DURATION.normal,
      delay: custom.delay || 0,
      ease: 'easeOut'
    }
  }),
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: 'easeIn' }
  }
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (custom = {}) => ({
    opacity: 1,
    scale: 1,
    transition: {
      duration: custom.duration || DURATION.normal,
      delay: custom.delay || 0,
      ease: EASING.smooth
    }
  }),
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: DURATION.fast, ease: 'easeIn' }
  }
}

export const staggerContainer = (staggerChildren = 0.05, delayChildren = 0.04) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren
    }
  }
})

/**
 * Micro-interactions untuk tombol dan kartu sentuh HP
 */
export const tapHoverEffect = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.97 },
  transition: { duration: 0.15, ease: 'easeOut' }
}

export const cardScrollReveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-20px' },
  transition: { duration: DURATION.normal, ease: EASING.smooth }
}
