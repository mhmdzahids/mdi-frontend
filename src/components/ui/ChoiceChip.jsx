/**
 * Komponen ChoiceChip untuk pilihan nilai preset cepat (mis. angka 1, 2, 3, 4).
 * Standar ergonomi pabrik:
 * - Tinggi minimal 48px
 * - Kontras tajam terhadap background kartu putih (border 1.5px #B7C3CE)
 * - Teks aktif: putih di atas brand-blue (#4685ac)
 * - Teks non-aktif: text-primary (#2C3E50) yang tegas (bukan abu pucat)
 */
export function ChoiceChip({
  children,
  selected = false,
  onClick,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'min-h-[48px] px-3.5 py-2 rounded-xl text-xs font-bold tabular-nums flex items-center justify-center ' +
        'transition-colors duration-150 cursor-pointer select-none active:scale-[0.98] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] focus-visible:ring-offset-1 ' +
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ' +
        (selected
          ? 'bg-[#4685ac] text-white border-[1.5px] border-[#4685ac] shadow-xs '
          : 'bg-white hover:bg-[#F5F1EB] text-[#2C3E50] border-[1.5px] border-[#B7C3CE] shadow-2xs ') +
        className
      }
      {...props}
    >
      {children}
    </button>
  )
}
