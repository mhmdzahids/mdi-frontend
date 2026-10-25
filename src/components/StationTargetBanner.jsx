import { useProduction1Store } from '../store/production1Store'
import { getLotDateString, getDaysDiffFromToday } from '../utils/dateFilter'
import { Card, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'

export default function StationTargetBanner({ type = 'MEAT' }) {
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isGlobalSupervisor =
    currentUser?.username === 'supervisor' ||
    currentUser?.operator_id?.includes('YOSI') ||
    currentUser?.division?.toLowerCase().includes('ppic') ||
    currentUser?.division?.toLowerCase().includes('supervisor')
  const canEditPlan = isDevMode || isGlobalSupervisor
  const setStation = useProduction1Store((s) => s.setStation)
  const dailyPlan = useProduction1Store((s) => s.dailyPlan) || {}
  const meatLots = useProduction1Store((s) => s.meatLots) || []
  const doughLots = useProduction1Store((s) => s.doughLots) || []
  const finishedGoodsLots = useProduction1Store((s) => s.finishedGoodsLots) || []
  const targetGilinganStore = useProduction1Store((s) => s.targetGilingan)

  // Tanggal kalender hari ini (WIB/Lokal)
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const todayDateStr = `${yyyy}-${mm}-${dd}`
  const todayCodeStr = `${yyyy}${mm}${dd}`

  const targetGilingan = dailyPlan.targetGilingan || targetGilinganStore || 40

  // 1. Tampilan Stasiun Daging & Mixer (Giling & Mix)
  if (type === 'MEAT') {
    // Hitung seluruh adonan kalis (AD-) dan gilingan (DG-) yang diproses HARI INI
    const allGilinganLots = [...doughLots, ...meatLots]
    const todayGilinganLots = allGilinganLots.filter((lot) => {
      const code = String(lot.lotCode || lot.lot_qr_code || '')
      if (code.includes(`-${todayCodeStr}-`)) return true
      const dStr = getLotDateString(lot)
      if (dStr === todayDateStr) return true
      return getDaysDiffFromToday(dStr) === 0
    })

    const totalDibuat = todayGilinganLots.length
    const pct = targetGilingan > 0 ? Math.min(100, Math.round((totalDibuat / targetGilingan) * 100)) : 0
    const isCompleted = pct >= 100

    return (
      <Card className="border border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-3.5 space-y-2">
          {/* Baris Ringkasan Target Tunggal (2 Detik Comprehension) */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-[#2C3E50] font-heading">
                Target gilingan
              </span>
              <span className="text-sm font-bold tabular-nums text-[#2C3E50]">
                {totalDibuat} <span className="text-xs font-normal text-[#6B7B8D]">dari {targetGilingan} terdaftar</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={isCompleted ? 'success' : pct > 0 ? 'info' : 'neutral'}
                size="sm"
                tabular
              >
                {pct}%
              </Badge>

              {canEditPlan && (
                <button
                  type="button"
                  onClick={() => setStation('PLAN')}
                  className="text-[11px] text-[#6B7B8D] hover:text-[#4685ac] underline underline-offset-2 cursor-pointer focus-visible:outline-none rounded transition-colors"
                >
                  Ubah
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Tunggal Horizontal */}
          <div className="w-full bg-[#EDE8DF] h-2.5 rounded-full overflow-hidden border border-[#EDE8DF]/60">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isCompleted ? 'bg-[#2F7D5B]' : 'bg-[#4685ac]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // 2. Tampilan Stasiun Produksi 2 (Meja Cetak Finished Goods)
  if (type === 'PROD_2') {
    const totalMika = dailyPlan.totalMika || dailyPlan.targetMikaPax || 0
    const totalVakum = dailyPlan.totalVakum || dailyPlan.targetVakumPax || 0

    // Filter produk jadi yang diproduksi hari ini
    const todayFgLots = finishedGoodsLots.filter((fg) => {
      const code = String(fg.lotCode || fg.lot_qr_code || '')
      if (code.includes(`-${todayCodeStr}-`)) return true
      const dStr = getLotDateString(fg)
      if (dStr === todayDateStr) return true
      return getDaysDiffFromToday(dStr) === 0
    })

    const dibuatMika = todayFgLots.filter(
      (fg) => fg.productType === 'FG_MIKA' || String(fg.lotCode).includes('MIKA')
    ).length

    const dibuatVakum = todayFgLots.filter(
      (fg) => fg.productType === 'FG_VAKUM' || String(fg.lotCode).includes('VAKUM')
    ).length

    const pctMika = totalMika > 0 ? Math.min(100, Math.round((dibuatMika / totalMika) * 100)) : 0
    const pctVakum = totalVakum > 0 ? Math.min(100, Math.round((dibuatVakum / totalVakum) * 100)) : 0

    return (
      <Card className="border border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2C3E50] font-heading">
              Target kemas hari ini
            </span>
            {canEditPlan && (
              <button
                type="button"
                onClick={() => setStation('PLAN')}
                className="text-[11px] text-[#6B7B8D] hover:text-[#4685ac] underline underline-offset-2 cursor-pointer focus-visible:outline-none rounded transition-colors"
              >
                Ubah
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Mika */}
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-2.5 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[#2C3E50] text-xs">Mika</span>
                <span className="tabular-nums text-xs font-bold text-[#2C3E50]">
                  {dibuatMika} <span className="text-[11px] font-normal text-[#6B7B8D]">/ {totalMika}</span>
                </span>
              </div>
              <div className="w-full bg-[#EDE8DF] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#4685ac] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pctMika}%` }}
                />
              </div>
            </div>

            {/* Vakum */}
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-2.5 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[#2C3E50] text-xs">Vakum</span>
                <span className="tabular-nums text-xs font-bold text-[#2C3E50]">
                  {dibuatVakum} <span className="text-[11px] font-normal text-[#6B7B8D]">/ {totalVakum}</span>
                </span>
              </div>
              <div className="w-full bg-[#EDE8DF] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#4685ac] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pctVakum}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
