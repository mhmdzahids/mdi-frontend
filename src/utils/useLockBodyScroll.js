import { useEffect } from 'react'

let activeLocksCount = 0
let originalBodyOverflow = ''
let originalHtmlOverflow = ''

export function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (activeLocksCount === 0) {
    originalBodyOverflow = document.body.style.overflow || ''
    originalHtmlOverflow = document.documentElement.style.overflow || ''

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  activeLocksCount++
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  activeLocksCount = Math.max(0, activeLocksCount - 1)
  if (activeLocksCount === 0) {
    document.body.style.overflow = originalBodyOverflow
    document.documentElement.style.overflow = originalHtmlOverflow
  }
}

export function useLockBodyScroll(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return

    lockBodyScroll()
    return () => {
      unlockBodyScroll()
    }
  }, [isLocked])
}
