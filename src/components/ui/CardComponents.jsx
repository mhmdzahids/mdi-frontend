/**
 * Reusable Card Design System Components
 * Mengikuti bahasa desain yang sama dengan kartu riwayat Barang Masuk:
 * struktur zona, spacing, tipografi, radius, shadow, dan token warna brand.
 */

export function CardShell({ children, isExpanded = false, variant = 'default', className = '' }) {
  const expandClasses = isExpanded
    ? variant === 'outbound'
      ? 'border-rose-400 ring-1 ring-rose-400/30 bg-[#FFFDFD]'
      : variant === 'inventory'
      ? 'border-[#3A6B80] ring-1 ring-[#3A6B80]/30 bg-[#FBFDFE]'
      : 'border-[#4685ac] ring-1 ring-[#4685ac]/30 bg-[#FBFDFE]'
    : 'border-[#EDE8DF] hover:border-[#D5CEBF]'

  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-3.5 ${expandClasses} ${className}`}
    >
      {children}
    </div>
  )
}

export function TypeBadge({ type = 'MASUK', label, className = '' }) {
  if (type === 'MASUK') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#EAF5EE] text-[#2F7D5B] border border-[#CBEAD6] ${className}`}
      >
        {label || 'MASUK'}
      </span>
    )
  }

  if (type === 'KELUAR') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FDEDEC] text-[#D9383A] border border-[#FADBD8] ${className}`}
      >
        {label || 'KELUAR'}
      </span>
    )
  }

  // Badge Kategori (Neutral Brand Tint)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FAF7F2] text-[#3A6B80] border border-[#EDE8DF] ${className}`}
    >
      {label || type}
    </span>
  )
}

export function QtyBlock({
  value,
  unit,
  prefix = '',
  colorClass = 'text-[#1E293B]',
  topLabel = null,
  subLabel = null
}) {
  return (
    <div className="text-right shrink-0">
      {topLabel && (
        <span className="text-[10px] text-[#6B7B8D] block uppercase font-bold tracking-wider mb-0.5">
          {topLabel}
        </span>
      )}
      <div className="flex items-baseline justify-end">
        <span
          className={`text-2xl sm:text-[26px] font-black tabular-nums tracking-tight ${colorClass}`}
        >
          {prefix}{value}
        </span>
        <span className="text-xs font-bold text-[#6B7B8D] ml-1 uppercase">
          {unit}
        </span>
      </div>
      {subLabel}
    </div>
  )
}

export function FieldGrid({ items = [], children }) {
  if (children) {
    return <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-0.5">{children}</div>
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-0.5">
      {items.map((item, idx) => {
        const isFullWidth = item.colSpan === 2 || item.fullWidth
        return (
          <div
            key={idx}
            className={`space-y-0.5 min-w-0 ${isFullWidth ? 'col-span-2' : ''}`}
          >
            <span className="text-xs text-[#6B7B8D] font-medium block">
              {item.label}
            </span>
            <div
              className="text-sm font-semibold text-[#1E293B] truncate"
              title={item.title || (typeof item.value === 'string' ? item.value : undefined)}
            >
              {item.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StatusChip({ status = 'habis', label, className = '' }) {
  if (status === 'habis') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 ${className}`}
      >
        {label || 'Stok Habis'}
      </span>
    )
  }

  if (status === 'warning') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
      >
        {label || 'Stok Menipis'}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF7F2] text-[#6B7B8D] border border-[#EDE8DF] ${className}`}
    >
      {label || status}
    </span>
  )
}
