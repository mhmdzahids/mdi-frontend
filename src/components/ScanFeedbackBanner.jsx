import { useState, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { CheckIcon, AlertIcon, XIcon, RefreshIcon } from './Icons'

export default function ScanFeedbackBanner() {
  const banner = useProduction1Store((s) => s.scanFeedbackBanner)
  const clearBanner = useProduction1Store((s) => s.clearScanFeedbackBanner)
  const triggerScanUndo = useProduction1Store((s) => s.triggerScanUndo)

  const [timeLeft, setTimeLeft] = useState(15)
  const [isUndoing, setIsUndoing] = useState(false)

  useEffect(() => {
    if (!banner?.canUndo || !banner?.expiresAt) return

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((banner.expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearBanner()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 500)
    return () => clearInterval(interval)
  }, [banner, clearBanner])

  if (!banner) return null

  const isSuccess = banner.type === 'success'
  const isWarning = banner.type === 'warning'
  const isDanger = banner.type === 'danger'

  // Semantic styles
  let containerStyle = 'bg-[#EEF5F9] border-[#D1E4EF] text-[#3A6B80]' // info (default)
  let badgeStyle = 'bg-[#4685ac] text-white'
  let Icon = CheckIcon

  if (isDanger) {
    containerStyle = 'bg-[#FDEDEC] border-[#FADBD8] text-[#E8352D]'
    badgeStyle = 'bg-[#E8352D] text-white'
    Icon = AlertIcon
  } else if (isWarning) {
    containerStyle = 'bg-[#FAF4E6] border-[#F3E5C1] text-[#A8862E]'
    badgeStyle = 'bg-[#C9A23D] text-white'
    Icon = CheckIcon
  } else if (isSuccess) {
    containerStyle = 'bg-[#EAF5EE] border-[#BCE3CF] text-[#2F7D5B]'
    badgeStyle = 'bg-[#2F7D5B] text-white'
    Icon = CheckIcon
  }

  const handleUndo = async () => {
    if (isUndoing || !banner.code) return
    setIsUndoing(true)
    try {
      await triggerScanUndo(banner.code)
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <div className="px-3.5 py-2 animate-in slide-in-from-top duration-200">
      <div
        className={`w-full rounded-2xl border-[1.5px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${containerStyle}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-2.5">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider block">
                {banner.title || (isDanger ? 'Ditolak' : 'Hasil Scan')}
              </span>
              {banner.code && (
                <span className="font-mono text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-white/70 border border-current/20">
                  {banner.code}
                </span>
              )}
            </div>
            <p className="text-xs font-medium leading-relaxed">
              {banner.message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 self-end sm:self-center shrink-0">
          {banner.canUndo && timeLeft > 0 && (
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleUndo}
              className="h-10 px-3.5 rounded-xl bg-white hover:bg-neutral-50 active:bg-neutral-100 text-[#2C3E50] border border-current/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
              <span>{isUndoing ? 'Membatalkan...' : `Batalkan (${timeLeft}s)`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={clearBanner}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <XIcon className="w-4 h-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
      </div>
    </div>
  )
}
