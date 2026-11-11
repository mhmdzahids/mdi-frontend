import { useEffect, useRef, useState, useMemo } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SmoothScrollContext } from './SmoothScrollContext'

// Daftarkan ScrollTrigger satu kali di tingkat modul dan konfigurasi untuk mobile
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
  ScrollTrigger.config({
    ignoreMobileResize: true,
    autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load'
  })
}

export default function SmoothScroll({ children }) {
  const lenisRef = useRef(null)

  const [isReducedMotion, setIsReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Deteksi prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = (e) => {
      setIsReducedMotion(e.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMotionChange)
    } else {
      mediaQuery.addListener(handleMotionChange)
    }

    // Deteksi perangkat layar sentuh / mobile
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches

    // Jika pengguna mengaktifkan reduced motion atau memakai perangkat touch,
    // biarkan browser memakai native scroll (lebih responsif, tanpa konflik momentum sentuhan).
    if (mediaQuery.matches || isTouch) {
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleMotionChange)
        } else {
          mediaQuery.removeListener(handleMotionChange)
        }
      }
    }

    // Inisialisasi Lenis hanya untuk desktop / pointer wheel
    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      infinite: false
    })

    lenisRef.current = lenis

    // 1. Sinkronisasi Lenis scroll dengan ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)

    // 2. Tautkan Lenis render loop ke GSAP ticker
    const updateTicker = (time) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(updateTicker)
    gsap.ticker.lagSmoothing(0)

    // 3. Perbaiki anchor link internal (href="#id") agar tetap smooth scroll,
    //    dengan mengabaikan hash route sistem (seperti #/meat, #/plan)
    const handleAnchorClick = (e) => {
      const anchor = e.target.closest('a[href^="#"]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href === '#' || href.startsWith('#/')) return

      const targetEl = document.querySelector(href)
      if (targetEl) {
        e.preventDefault()
        lenis.scrollTo(targetEl, { offset: -70 })
      }
    }
    document.addEventListener('click', handleAnchorClick)

    // Cleanup saat unmount
    return () => {
      document.removeEventListener('click', handleAnchorClick)
      if (lenisRef.current) {
        lenis.off('scroll', ScrollTrigger.update)
        gsap.ticker.remove(updateTicker)
        lenis.destroy()
        lenisRef.current = null
      }
      ScrollTrigger.getAll().forEach((t) => t.kill())
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMotionChange)
      } else {
        mediaQuery.removeListener(handleMotionChange)
      }
    }
  }, [])

  const contextValue = useMemo(() => ({
    getLenis: () => lenisRef.current,
    isReducedMotion
  }), [isReducedMotion])

  return (
    <SmoothScrollContext.Provider value={contextValue}>
      {children}
    </SmoothScrollContext.Provider>
  )
}
