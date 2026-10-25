/**
 * Komponen Segmented Control mobile-first untuk pemilihan opsi/tab instan.
 * Kontras tinggi dan terbaca jelas:
 * - Track ber-border kuat (#B7C3CE)
 * - Segmen non-aktif: berlatar putih dengan border terdefinisi, teks text-primary (#2C3E50)
 * - Segmen aktif: solid brand-blue (#4685ac) dengan teks putih
 * - Tinggi minimal 48px pada ukuran md (default)
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md', // 'sm' | 'md' | 'lg'
  fullWidth = true,
  className = ''
}) {
  const heightClass =
    size === 'lg'
      ? 'min-h-[56px] text-xs'
      : size === 'sm'
      ? 'min-h-[40px] text-xs'
      : 'min-h-[48px] text-xs'

  return (
    <div
      role="tablist"
      className={
        'p-1 bg-[#EDE8DF] rounded-xl border-[1.5px] border-[#B7C3CE] grid gap-1.5 select-none ' +
        (fullWidth ? 'w-full ' : 'inline-grid ') +
        className
      }
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))`
      }}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value
        const IconComponent = opt.icon

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(opt.value)}
            className={
              `${heightClass} px-3 rounded-lg flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer ` +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] focus-visible:ring-offset-1 active:scale-[0.98] ' +
              (isSelected
                ? 'bg-[#4685ac] text-white font-bold shadow-xs border border-[#4685ac]'
                : 'bg-white/85 hover:bg-white text-[#2C3E50] font-semibold border border-[#B7C3CE]/70 shadow-2xs')
            }
          >
            {IconComponent && <IconComponent className="w-5 h-5 shrink-0" />}
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
