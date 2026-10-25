import { useProduction1Store } from '../store/production1Store'
import { ArrowLeftRight } from 'lucide-react'

/**
 * Switcher Tahap Produksi terintegrasi (Produksi 1 vs Produksi 2).
 * Tidak lagi mengambang menutupi konten (floating button dihapus sesuai aturan UX mobile pabrik).
 */
export default function ProductionStageToggle({ className = '' }) {
  const activeProductionStage = useProduction1Store((s) => s.activeProductionStage)
  const toggleProductionStage = useProduction1Store((s) => s.toggleProductionStage)

  const isProd1 = activeProductionStage === 'PROD_1'

  return (
    <button
      type="button"
      onClick={toggleProductionStage}
      className={`h-9 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border ${
        isProd1
          ? 'bg-[#EEF5F9] text-[#4685ac] border-[#D1E4EF] hover:bg-[#EEF5F9]'
          : 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE] hover:bg-[#DBEAFE]'
      } ${className}`}
      title={isProd1 ? 'Beralih ke MES Produksi 2' : 'Beralih ke MES Produksi 1'}
    >
      <ArrowLeftRight className="w-3.5 h-3.5" />
      <span>{isProd1 ? 'Ke Produksi 2' : 'Ke Produksi 1'}</span>
    </button>
  )
}
