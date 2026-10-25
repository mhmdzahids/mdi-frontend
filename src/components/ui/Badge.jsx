/**
 * Komponen Badge Semantik Tunggal.
 * Warna ditentukan oleh MAKNA data, bukan oleh stasiun atau halaman:
 * - neutral (default): hitungan biasa, 0, 0%, jumlah item di daftar, status stabil
 * - info: informasi konteks aktif di card aksi / proses kerja
 * - warning: hal yang butuh perhatian (stok menipis, menunggu diproses, perlu diterima)
 * - danger: HANYA error dan bahaya (dilarang untuk angka biasa)
 * - success: selesai, berhasil, fisik sudah diterima, online
 */
export function Badge({
  children,
  variant = 'neutral', // 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  size = 'md', // 'sm' | 'md'
  dot = false,
  icon: Icon = null,
  tabular = false,
  className = ''
}) {
  const variantStyles = {
    // 1. NEUTRAL (Default)
    neutral: 'bg-[#EDE8DF] text-[#6B7B8D] border-[#D5CEBF]',

    // 2. INFO (Brand Blue tint ~12%)
    info: 'bg-[#EEF5F9] text-[#3A6B80] border-[#D1E4EF]',

    // 3. WARNING (Brand Gold tint ~15%)
    warning: 'bg-[#FAF4E6] text-[#A8862E] border-[#F3E5C1]',

    // 4. DANGER (Brand Red tint ~12%)
    danger: 'bg-[#FDEDEC] text-[#E8352D] border-[#FADBD8]',

    // 5. SUCCESS (Jade Green #2F7D5B)
    success: 'bg-[#EAF5EE] text-[#2F7D5B] border-[#BCE3CF]',

    // Aliases semantik pengaman backward-compatibility
    dark: 'bg-[#EDE8DF] text-[#2C3E50] border-[#D5CEBF]',
    meat: 'bg-[#EEF5F9] text-[#3A6B80] border-[#D1E4EF]',
    seasoning: 'bg-[#FAF4E6] text-[#A8862E] border-[#F3E5C1]',
    wrapper: 'bg-[#EEF5F9] text-[#3A6B80] border-[#D1E4EF]',
    sauce: 'bg-[#EEF5F9] text-[#3A6B80] border-[#D1E4EF]'
  }

  const dotColors = {
    neutral: 'bg-[#6B7B8D]',
    info: 'bg-[#3A6B80]',
    warning: 'bg-[#A8862E]',
    danger: 'bg-[#E8352D]',
    success: 'bg-[#2F7D5B]',
    dark: 'bg-[#2C3E50]',
    meat: 'bg-[#3A6B80]',
    seasoning: 'bg-[#A8862E]',
    wrapper: 'bg-[#3A6B80]',
    sauce: 'bg-[#3A6B80]'
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-md gap-1 font-medium',
    md: 'text-[11px] px-2.5 py-1 rounded-lg gap-1.5 font-semibold'
  }

  return (
    <span
      className={
        'inline-flex items-center border select-none leading-none ' +
        (tabular ? 'tabular-nums ' : '') +
        (variantStyles[variant] || variantStyles.neutral) +
        ' ' +
        (sizeStyles[size] || sizeStyles.md) +
        ' ' +
        className
      }
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            dotColors[variant] || 'bg-current'
          }`}
        />
      )}
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  )
}
