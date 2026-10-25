import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Komponen Button bersistem desain dapur profesional untuk mobile MES.
 * Tap target sentuh jempol terstandarisasi (minimal 48px untuk ukuran md, 56px untuk lg/primary CTA).
 */
export const Button = forwardRef(function Button(
  {
    children,
    type = 'button',
    variant = 'primary', // 'primary' | 'secondary' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'dark'
    size = 'md', // 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'
    fullWidth = false,
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    className = '',
    onClick,
    ...props
  },
  ref
) {
  // Gaya Varian dengan Palet Brand (@theme)
  const variantStyles = {
    primary:
      'bg-[#4685ac] text-white hover:bg-[#3A6B80] active:bg-[#2E5466] border border-[#4685ac] shadow-xs disabled:bg-[#EDE8DF] disabled:border-[#EDE8DF] disabled:text-[#6B7B8D]/50',
    secondary:
      'bg-white text-[#2C3E50] hover:bg-[#EDE8DF]/50 active:bg-[#EDE8DF] border border-[#EDE8DF] shadow-2xs disabled:bg-[#F5F1EB] disabled:text-[#6B7B8D]/50 disabled:border-[#EDE8DF]',
    tonal:
      'bg-[#EDE8DF]/70 text-[#2C3E50] hover:bg-[#EDE8DF] active:bg-[#E2DDD3] border border-[#EDE8DF] disabled:bg-[#F5F1EB] disabled:text-[#6B7B8D]/50',
    outline:
      'bg-white text-[#2C3E50] hover:bg-[#EDE8DF]/50 active:bg-[#EDE8DF] border border-[#EDE8DF] disabled:bg-[#F5F1EB] disabled:text-[#6B7B8D]/50 disabled:border-[#EDE8DF]',
    ghost:
      'bg-transparent text-[#6B7B8D] hover:text-[#2C3E50] hover:bg-[#EDE8DF]/50 active:bg-[#EDE8DF] border border-transparent disabled:text-[#6B7B8D]/50',
    danger:
      'bg-[#FDEDEC] text-[#E8352D] hover:bg-[#FADBD8] active:bg-[#F5B7B1] border border-[#FADBD8] disabled:bg-[#F5F1EB] disabled:text-[#6B7B8D]/50',
    dark:
      'bg-[#2C3E50] text-white hover:bg-[#1E2B37] active:bg-[#151E27] border border-[#2C3E50] disabled:bg-[#EDE8DF] disabled:text-[#6B7B8D]/50',
    gold:
      'bg-[#C9A23D] text-white hover:bg-[#A8862E] active:bg-[#876B24] border border-[#C9A23D] disabled:bg-[#EDE8DF] disabled:text-[#6B7B8D]/50'
  }

  // Ukuran Ergonomis Sentuhan Jempol (48px dan 56px)
  const sizeStyles = {
    sm: 'h-9 px-3 text-xs gap-1.5 rounded-lg min-w-[36px]',
    md: 'h-12 px-4 text-xs font-semibold gap-2 rounded-xl min-w-[48px]',
    lg: 'h-14 px-5 text-sm font-bold gap-2.5 rounded-xl min-w-[56px]',
    icon: 'w-12 h-12 p-0 flex items-center justify-center rounded-xl shrink-0',
    'icon-sm': 'w-9 h-9 p-0 flex items-center justify-center rounded-lg shrink-0'
  }

  const baseClasses =
    'inline-flex items-center justify-center select-none font-medium transition-all duration-150 cursor-pointer ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] focus-visible:ring-offset-2 ' +
    'active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed ' +
    (fullWidth ? 'w-full ' : '') +
    (variantStyles[variant] || variantStyles.primary) +
    ' ' +
    (sizeStyles[size] || sizeStyles.md) +
    ' ' +
    className

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={baseClasses}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
          {typeof children === 'string' ? <span>{children}</span> : children}
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className="w-4 h-4 shrink-0" />
          )}
          {children}
          {Icon && iconPosition === 'right' && (
            <Icon className="w-4 h-4 shrink-0" />
          )}
        </>
      )}
    </button>
  )
})
