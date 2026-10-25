import { useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { CheckIcon, AlertIcon, XIcon } from './Icons'

export default function ToastNotification() {
  const actionFeedback = useProduction1Store((s) => s.actionFeedback)
  const clearFeedback = useProduction1Store((s) => s.clearFeedback)

  // Auto-dismiss setelah 4 detik
  useEffect(() => {
    if (!actionFeedback) return
    const timer = setTimeout(() => {
      clearFeedback()
    }, 4000)
    return () => clearTimeout(timer)
  }, [actionFeedback, clearFeedback])

  if (!actionFeedback) return null

  const isError = actionFeedback.type === 'error'

  return (
    <aside aria-label="Notifikasi sistem" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none transition-all duration-200">
      <div
        className={`pointer-events-auto flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border shadow-lg animate-in fade-in slide-in-from-top-2 duration-150 ${
          isError
            ? 'bg-rose-50 text-rose-950 border-rose-300'
            : 'bg-emerald-50 text-emerald-950 border-emerald-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {isError ? (
            <AlertIcon className="w-4 h-4 shrink-0 text-rose-700" />
          ) : (
            <CheckIcon className="w-4 h-4 shrink-0 text-emerald-700" />
          )}
          <span className="truncate font-semibold text-xs">{actionFeedback.message}</span>
        </div>
        <button
          type="button"
          onClick={clearFeedback}
          className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-lg text-neutral-600 hover:text-neutral-900 shrink-0 cursor-pointer transition-colors"
          title="Tutup"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  )
}
