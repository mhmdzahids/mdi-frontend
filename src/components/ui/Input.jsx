import { forwardRef } from 'react'

/**
 * Komponen Input terstandarisasi untuk form stasiun kerja MES.
 * Ukuran tap sentuh nyaman (h-11) dengan focus indicator yang jelas.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    id,
    type = 'text',
    className = '',
    inputClassName = '',
    fullWidth = true,
    icon: Icon,
    ...props
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[#6B7B8D] mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7B8D]">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          className={
            'h-12 w-full rounded-xl border bg-white px-3.5 text-xs text-[#2C3E50] transition-colors ' +
            (Icon ? 'pl-10 ' : '') +
            (error
              ? 'border-rose-400 focus:border-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500/20 '
              : 'border-[#EDE8DF] hover:border-[#D5CEBF] focus:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 ') +
            'focus-visible:outline-none disabled:bg-[#EDE8DF]/50 disabled:text-[#6B7B8D]/50 disabled:cursor-not-allowed ' +
            inputClassName
          }
          {...props}
        />
      </div>

      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-[#6B7B8D] font-sans">{helperText}</p>
      ) : null}
    </div>
  )
})
