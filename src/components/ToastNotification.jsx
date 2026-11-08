import { useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { CheckIcon, AlertIcon, XIcon } from './Icons'
import { Info } from 'lucide-react'

export default function ToastNotification() {
  const actionFeedback = useProduction1Store((s) => s.actionFeedback)
  const clearFeedback = useProduction1Store((s) => s.clearFeedback)

  // Auto-dismiss setelah 3.5 detik + Haptic getar di smartphone
  useEffect(() => {
    if (!actionFeedback) return

    // Haptic feedback jika didukung perangkat (misal HP Android di dapur pabrik)
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (actionFeedback.type === 'error') {
          navigator.vibrate([60, 50, 60])
        } else {
          navigator.vibrate(40)
        }
      }
    } catch {
      // ignore
    }

    const timer = setTimeout(() => {
      clearFeedback()
    }, 3500)
    return () => clearTimeout(timer)
  }, [actionFeedback, clearFeedback])

  if (!actionFeedback) return null

  const isError = actionFeedback.type === 'error'
  const isInfo = actionFeedback.type === 'info'

  return (
    <aside
      aria-label="Notifikasi sistem"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm px-4 pointer-events-none transition-all duration-200"
    >
      <div
        className={`pointer-events-auto relative overflow-hidden flex items-center justify-between text-xs px-3.5 py-3 rounded-2xl border shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-3 duration-200 ${
          isError
            ? 'bg-rose-50/95 text-rose-950 border-rose-300'
            : isInfo
              ? 'bg-amber-50/95 text-amber-950 border-amber-300'
              : 'bg-emerald-50/95 text-emerald-950 border-emerald-300'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate pr-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              isError
                ? 'bg-rose-100 text-rose-700'
                : isInfo
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isError ? (
              <AlertIcon className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            ) : isInfo ? (
              <Info className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            ) : (
              <CheckIcon className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            )}
          </div>
          <span className="truncate font-semibold text-xs leading-snug">
            {actionFeedback.message}
          </span>
        </div>

        <button
          type="button"
          onClick={clearFeedback}
          className="w-7 h-7 flex items-center justify-center hover:bg-black/5 rounded-lg text-neutral-500 hover:text-neutral-900 shrink-0 cursor-pointer transition-colors"
          title="Tutup"
          aria-label="Tutup notifikasi"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>

        {/* Garis Countdown Timer Halus */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-[2.5px] ${
            isError ? 'bg-rose-400' : isInfo ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{
            animation: 'shrinkWidth 3.5s linear forwards'
          }}
        />
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </aside>
  )
}
