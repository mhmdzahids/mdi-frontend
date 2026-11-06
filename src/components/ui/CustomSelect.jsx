import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Komponen Dropdown Select kustom yang konsisten dengan Design System MDI:
 * - Warna netral hangat (#EDE8DF, #F5F1EB, #1E293B, aksen #4685ac)
 * - Rounded-xl, elevasi halus (shadow-2xs & shadow-lg untuk popover)
 * - Dukungan placeholder saat belum ada nilai terpilih (uncontrolled/controlled empty value)
 * - Aksesibilitas keyboard (Escape), penutupan otomatis saat klik di luar
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih...',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  id,
  ariaLabel
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Normalisasi opsi ke struktur { value, label, selectedLabel }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label !== undefined ? opt.label : opt.name || String(opt.value || opt.id),
        selectedLabel: opt.selectedLabel || opt.shortLabel
      }
    }
    return { value: String(opt), label: String(opt) }
  })

  const selectedOption = normalizedOptions.find((opt) => opt.value === value)

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (val) => {
    if (onChange) onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-11 px-3.5 rounded-xl border bg-white flex items-center justify-between text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer select-none ${
          disabled ? 'opacity-60 cursor-not-allowed bg-[#F5F1EB]' : 'hover:border-[#D5CEBF]'
        } ${
          isOpen
            ? 'border-[#4685ac] ring-2 ring-[#4685ac]/15'
            : 'border-[#EDE8DF]'
        } ${buttonClassName}`}
      >
        <span className={`truncate text-left ${selectedOption ? 'text-[#1E293B]' : 'text-[#94A3B8] font-normal'}`}>
          {selectedOption ? (selectedOption.selectedLabel || selectedOption.label) : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-150 ml-1.5 ${
            isOpen ? 'rotate-180 text-[#4685ac]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-[#EDE8DF] rounded-xl shadow-lg overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 overscroll-contain ${menuClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#4685ac]/10 text-[#4685ac]'
                    : 'text-[#1E293B] hover:bg-[#F5F1EB]'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-[#4685ac] shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

