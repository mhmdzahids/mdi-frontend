import { useRef } from 'react'

/**
 * Komponen Segmented Control mobile-first untuk pemilihan opsi/tab instan.
 * Kontras tinggi dan terbaca jelas (WCAG 2.1 AA):
 * - Track ber-border kuat (#B7C3CE)
 * - Segmen non-aktif: berlatar putih dengan border terdefinisi, teks text-primary (#2C3E50)
 * - Segmen aktif: solid brand-blue-dark (#3A6B80) dengan teks putih
 * - Navigasi keyboard panah kiri/kanan sesuai spesifikasi WAI-ARIA tablist
 * - Tinggi minimal 48px pada ukuran md (default) untuk touch target aman
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md', // 'sm' | 'md' | 'lg'
  fullWidth = true,
  className = ''
}) {
  const containerRef = useRef(null)

  const heightClass =
    size === 'lg'
      ? 'min-h-[56px] text-xs'
      : size === 'sm'
      ? 'min-h-[44px] text-xs'
      : 'min-h-[48px] text-xs'

  const handleKeyDown = (e, index) => {
    let targetIndex = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      targetIndex = (index + 1) % options.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      targetIndex = (index - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      targetIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      targetIndex = options.length - 1
    }

    if (targetIndex >= 0 && options[targetIndex]) {
      onChange(options[targetIndex].value)
      const buttons = containerRef.current?.querySelectorAll('button[role="tab"]')
      buttons?.[targetIndex]?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-orientation="horizontal"
      className={
        'p-1 bg-[#EDE8DF] rounded-xl border-[1.5px] border-[#B7C3CE] grid gap-1.5 select-none ' +
        (fullWidth ? 'w-full ' : 'inline-grid ') +
        className
      }
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))`
      }}
    >
      {options.map((opt, index) => {
        const isSelected = value === opt.value
        const IconComponent = opt.icon

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={
              `${heightClass} px-3 rounded-lg flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer ` +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3A6B80] focus-visible:ring-offset-1 active:scale-[0.98] ' +
              (isSelected
                ? 'bg-[#3A6B80] text-white font-bold shadow-xs border border-[#3A6B80]'
                : 'bg-white/85 hover:bg-white text-[#2C3E50] font-semibold border border-[#B7C3CE]/70 shadow-2xs')
            }
          >
            {IconComponent && <IconComponent className="w-4 h-4 shrink-0" />}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={
                  'text-[10px] tabular-nums px-2 py-0.5 rounded-full font-bold ' +
                  (isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EDE8DF] text-[#2C3E50]')
                }
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
