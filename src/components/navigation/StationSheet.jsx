import { useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { MixerIcon, BagIcon, WrapperIcon, SauceIcon } from '../Icons'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'
import { useProduction1Store } from '../../store/production1Store'
import { canAccess } from '../../utils/rbac'

const P1_STATIONS = [
  { id: 'MEAT', label: 'Giling & Mix', shortLabel: 'Giling', icon: MixerIcon, permission: 'meat:view' },
  { id: 'SEASONING', label: 'Bumbu', shortLabel: 'Bumbu', icon: BagIcon, permission: 'seasoning:view' },
  { id: 'WRAPPER', label: 'Kulit', shortLabel: 'Kulit', icon: WrapperIcon, permission: 'wrapper:view' },
  { id: 'SAUCE', label: 'Saos', shortLabel: 'Saos', icon: SauceIcon, permission: 'sauce:view' }
]

/**
 * Bottom Sheet Pemilihan Stasiun Kerja (Minimalis).
 * Dibuka dari chip stasiun di header untuk pengguna dengan izin > 1 stasiun.
 */
export default function StationSheet({
  isOpen,
  onClose,
  activeStation,
  onSelectStation,
  stations
}) {
  const currentUser = useProduction1Store((s) => s.currentUser)
  useLockBodyScroll(isOpen)

  const visibleStations = stations || P1_STATIONS.filter((st) => canAccess(st.permission, currentUser))

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-none transition-opacity overscroll-contain select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="station-sheet-title"
      onClick={onClose}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      <div
        className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white rounded-t-[24px] border-t border-[#EDE8DF] shadow-lg p-4 pb-8 safe-bottom-padding select-text overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Bar Minimalis */}
        <div className="w-10 h-1 bg-[#EDE8DF] rounded-full mx-auto mb-3" />

        {/* Header Sheet: Hanya "Stasiun" tanpa subjudul */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE8DF]">
          <h3 id="station-sheet-title" className="text-sm font-bold font-heading text-[#2C3E50]">
            Stasiun
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#F5F1EB] transition-colors cursor-pointer focus-visible:outline-none"
            aria-label="Tutup"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Daftar Stasiun: Ikon + Nama Saja (Tanpa Deskripsi) */}
        <div className="grid grid-cols-1 gap-2 mt-3">
          {visibleStations.map((st) => {
            const Icon = st.icon
            const isActive = activeStation === st.id

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  onSelectStation(st.id)
                  onClose()
                }}
                className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none ${
                  isActive
                    ? 'bg-[#EEF5F9] border-[#6A9DB3]/50 text-[#3A6B80] shadow-2xs'
                    : 'bg-white border-[#EDE8DF] hover:bg-[#F5F1EB] text-[#2C3E50]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-[#3A6B80] text-white' : 'bg-[#EDE8DF]/60 text-[#6B7B8D]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold font-heading tracking-tight truncate">
                    {st.label}
                  </span>
                </div>

                {isActive && (
                  <Check className="w-4 h-4 text-[#2F7D5B] stroke-[2.5] shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
