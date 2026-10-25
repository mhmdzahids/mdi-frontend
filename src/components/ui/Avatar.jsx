import { User } from 'lucide-react'

/**
 * Komponen Avatar Tunggal.
 * Digunakan seragam di Halaman Profile (size="lg") dan Bottom Navigation (size="sm").
 *
 * Props:
 * - size: 'sm' (28px untuk nav) | 'md' (40px) | 'lg' (96px untuk halaman profil)
 * - active: boolean (menampilkan active ring aksen brand-blue saat tab profil aktif)
 * - className: string tambahan styling opsional
 */
export function Avatar({
  size = 'md',
  active = false,
  className = ''
}) {
  const sizeStyles = {
    sm: 'w-[26px] h-[26px] border-[1.5px]',
    md: 'w-10 h-10 border-2',
    lg: 'w-24 h-24 border-[3.5px]'
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-12 h-12'
  }

  // Border kontras terhadap latar halaman (krem #F5F1EB) atau state nav aktif
  const borderStyles = size === 'lg'
    ? 'border-[#3A6B80] ring-4 ring-[#EEF5F9] shadow-xs'
    : active
    ? 'border-[#4685ac] ring-2 ring-[#4685ac]/30'
    : 'border-[#B7C3CE]'

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden bg-[#4685ac] text-white transition-all ${sizeStyles[size] || sizeStyles.md} ${borderStyles} ${className}`}
      aria-hidden="true"
    >
      <User className={`${iconSizes[size] || iconSizes.md} text-white stroke-[2.2]`} />
    </div>
  )
}

export default Avatar
