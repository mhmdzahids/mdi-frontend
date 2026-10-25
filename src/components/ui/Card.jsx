/**
 * Komponen Card dapur terstruktur untuk stasiun kerja MES Dimsum.
 * Mendukung varian kartu aksi terkemuka dan kartu informasi pasif.
 */
export function Card({
  children,
  variant = 'default', // 'default' | 'action' | 'subtle'
  className = '',
  ...props
}) {
  const variantStyles = {
    default: 'bg-white border border-[#EDE8DF] shadow-2xs',
    action: 'bg-white border border-[#6A9DB3] ring-2 ring-[#6A9DB3]/30 shadow-xs',
    subtle: 'bg-[#EDE8DF]/60 border border-[#EDE8DF]'
  }

  return (
    <div
      className={`rounded-2xl transition-all ${variantStyles[variant] || variantStyles.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={`px-4 pt-4 pb-2.5 border-b border-[#EDE8DF] flex items-center justify-between gap-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3
      className={`text-xs font-bold text-[#2C3E50] font-heading tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p
      className={`text-[11px] text-[#6B7B8D] font-sans mt-0.5 ${className}`}
      {...props}
    >
      {children}
    </p>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`px-4 pb-4 pt-2.5 border-t border-[#EDE8DF] flex items-center justify-end gap-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
