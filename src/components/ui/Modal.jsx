import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { XIcon } from '../Icons'
import { lockBodyScroll, unlockBodyScroll } from '../../utils/useLockBodyScroll'

/**
 * Modal dialog dasar dengan aksesibilitas keyboard (Escape), backdrop klik,
 * penguncian scroll background (body scroll lock), dan pencegahan auto-focus
 * agar virtual keyboard HP tidak otomatis muncul.
 */
export function Modal({
  isOpen = false,
  onClose,
  title,
  subtitle,
  children,
  size = 'md', // 'sm' | 'md' | 'lg' | 'full'
  className = ''
}) {
  useEffect(() => {
    if (!isOpen) return

    // 1. Kunci scroll background halaman di belakang pop up modal
    lockBodyScroll()

    // 2. Pastikan input tidak langsung terselect/fokus otomatis agar keyboard HP tidak muncul sebelum diklik
    const blurTimer = requestAnimationFrame(() => {
      const activeEl = document.activeElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur()
      }
    })

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(blurTimer)
      unlockBodyScroll()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
    full: 'max-w-full m-3'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 overscroll-contain select-none"
        >
          {/* Backdrop gelap dengan fade transition */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 -z-10 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
          />

          {/* Dialog Container dengan scale + y entrance & exit */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={
              'w-full bg-white rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden flex flex-col max-h-[92vh] select-text overscroll-contain ' +
              (sizeClasses[size] || sizeClasses.md) +
              ' ' +
              className
            }
          >
            {/* Header Modal */}
            {(title || onClose) && (
              <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between shrink-0 bg-[#F5F1EB]/70">
                <div>
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-xs font-bold text-[#2C3E50] font-heading"
                    >
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-[11px] text-[#6B7B8D] font-sans mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>

                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup dialog"
                    className="w-10 h-10 -mr-1 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Isi Modal */}
            <div className="p-4 overflow-y-auto flex-1 overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
