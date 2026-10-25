import { MinusIcon, PlusIcon } from '../Icons'
import { ChoiceChip } from './ChoiceChip'

/**
 * Komponen Stepper kuantitas yang kokoh dan ergonomis untuk mobile MES pabrik:
 * - Tombol -/+ minimal 48px dengan border 1.5px kontras tinggi (#B7C3CE)
 * - Input angka tabular besar dan tegas
 * - Chip angka preset 48px menggunakan komponen ChoiceChip
 * - Baris bantu konversi dinamis di bawah kontrol
 */
export function Stepper({
  label,
  value = 1,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  unit = '',
  presets = [],
  presetSuffix = '',
  conversionText = '',
  disabled = false,
  className = ''
}) {
  const numValue = Math.max(min, Math.min(max, parseInt(value, 10) || min))

  const handleMinus = () => {
    if (disabled || numValue <= min) return
    onChange(Math.max(min, numValue - step))
  }

  const handlePlus = () => {
    if (disabled || numValue >= max) return
    onChange(Math.min(max, numValue + step))
  }

  const handleInputChange = (e) => {
    const parsed = parseInt(e.target.value, 10)
    if (isNaN(parsed)) {
      onChange(min)
    } else {
      onChange(Math.max(min, Math.min(max, parsed)))
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-[#2C3E50] font-heading tracking-tight block">
          {label}
        </label>
      )}

      {/* Baris Tombol Stepper 48px */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleMinus}
          disabled={disabled || numValue <= min}
          aria-label="Kurangi satu"
          className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer shrink-0 flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
        >
          <MinusIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <input
            type="number"
            min={min}
            max={max}
            value={numValue}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-full h-12 text-center tabular-nums font-bold text-lg border-[1.5px] border-[#B7C3CE] rounded-xl bg-white text-[#2C3E50] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 transition-colors shadow-2xs"
          />
          {unit && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7B8D] pointer-events-none select-none font-medium">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handlePlus}
          disabled={disabled || numValue >= max}
          aria-label="Tambah satu"
          className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer shrink-0 flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Baris Bantu Konversi Dinamis Tepat di Bawah Input */}
      {conversionText && (
        <p className="text-[11px] font-medium text-[#6B7B8D] pl-1">
          {conversionText}
        </p>
      )}

      {/* Preset Cepat Ergonomis 48px */}
      {presets.length > 0 && (
        <div className="grid grid-cols-4 gap-2 pt-0.5">
          {presets.map((preset) => (
            <ChoiceChip
              key={preset}
              selected={numValue === preset}
              onClick={() => onChange(preset)}
              disabled={disabled}
            >
              {preset}{presetSuffix ? ` ${presetSuffix}` : ''}
            </ChoiceChip>
          ))}
        </div>
      )}
    </div>
  )
}
