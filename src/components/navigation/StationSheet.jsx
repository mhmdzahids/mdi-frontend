import { useEffect } from 'react'
import { X } from 'lucide-react'
import { MixerIcon, BagIcon, WrapperIcon, SauceIcon } from '../Icons'
import { useLockBodyScroll } from '../../utils/useLockBodyScroll'

const STATIONS = [
  { id: 'MEAT', label: 'Giling & Mix', description: 'Pengolahan adonan daging', icon: MixerIcon },
  { id: 'SEASONING', label: 'Bumbu', description: 'Penyiapan paket bumbu', icon: BagIcon },
  { id: 'WRAPPER', label: 'Kulit', description: 'Penerimaan & potong kulit', icon: WrapperIcon },
  { id: 'SAUCE', label: 'Saos', description: 'Pengemasan saos & minyak', icon: SauceIcon }
]

/**
 * Bottom Sheet Pemilihan Stasiun Produksi 1.
 * Muncul saat tab "Stasiun" ditekan pada akun dengan > 6 navigasi (Supervisor / PIC).
 * Setiap baris stasiun memiliki tinggi minimal 56px untuk ergonomi sentuh pekerja pabrik.
 */
export default function StationSheet({
  isOpen,
  onClose,
  activeStation,
  onSelectStation
}) {
  useLockBodyScroll(isOpen)

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

        {/* Header Sheet */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EDE8DF]">
          <div>
            <h3 id="station-sheet-title" className="text-sm font-bold font-heading text-[#2C3E50]">
              Pilih Stasiun Kerja
            </h3>
            <p className="text-[11px] text-[#6B7B8D] mt-0.5">
              Stasiun hulu Produksi 1 Dimsum
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#F5F1EB] transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Daftar Stasiun */}
        <div className="grid grid-cols-1 gap-2.5 mt-3.5">
          {STATIONS.map((st) => {
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
                className={`w-full min-h-[56px] px-3.5 py-2.5 rounded-xl border flex items-center gap-3.5 text-left transition-all cursor-pointer active:scale-[0.99] ${
                  isActive
                    ? 'bg-[#EEF5F9] border-[#6A9DB3]/50 text-[#3A6B80] shadow-2xs'
                    : 'bg-white border-[#EDE8DF] hover:bg-[#F5F1EB] text-[#2C3E50]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-[#4685ac] text-white' : 'bg-[#EDE8DF]/60 text-[#6B7B8D]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-heading tracking-tight">
                      {st.label}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-semibold text-[#4685ac] bg-white px-2 py-0.5 rounded-md border border-[#D1E4EF]">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7B8D] truncate mt-0.5">
                    {st.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
