import { useState } from 'react'
import { useProduction1Store, calculatePlanMetrics } from '../store/production1Store'
import { getTodayIndonesian, filterAndSortLots } from '../utils/dateFilter'
import { CheckIcon, PrinterIcon } from './Icons'
import { Card, CardContent } from './ui/Card'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { SegmentedControl } from './ui/SegmentedControl'

export default function ProductionPlanView() {
  const dailyPlan = useProduction1Store((s) => s.dailyPlan)
  const activePlanId = useProduction1Store((s) => s.activePlanId)
  const setDailyPlan = useProduction1Store((s) => s.setDailyPlan)
  const setStation = useProduction1Store((s) => s.setStation)
  const userRole = useProduction1Store((s) => s.userRole)
  const meatLots = useProduction1Store((s) => s.meatLots) || []
  const doughLots = useProduction1Store((s) => s.doughLots) || []
  const ppicExternalWrapperMode = useProduction1Store((s) => s.ppicExternalWrapperMode)
  const createWrapperLot = useProduction1Store((s) => s.createWrapperLot)

  const [isWrapperModalOpen, setIsWrapperModalOpen] = useState(false)
  const [wrapperType, setWrapperType] = useState('KULIT_9CM')
  const [balQty, setBalQty] = useState('1')
  const [supplierName, setSupplierName] = useState('')

  const getInitialForm = (plan) => {
    const orderMika = plan?.orderMika !== undefined
      ? plan.orderMika
      : ((plan?.onlineMika || 0) + (plan?.offlineMika || 0))
    const orderVakum = plan?.orderVakum !== undefined
      ? plan.orderVakum
      : ((plan?.onlineVakum || 0) + (plan?.offlineVakum || 0))
    const bumperMika = plan?.bumperMika ?? ''
    const bumperVakum = plan?.bumperVakum ?? ''

    let manualGilingan = ''
    if (plan?.manualGilingan !== undefined && plan?.manualGilingan !== null && plan?.manualGilingan !== '') {
      manualGilingan = String(plan.manualGilingan)
    } else if (plan?.totalPcs > 0 && plan?.targetGilingan) {
      manualGilingan = String(plan.targetGilingan)
    }

    let manualBumbuKarung = ''
    if (plan?.manualBumbuKarung !== undefined && plan?.manualBumbuKarung !== null && plan?.manualBumbuKarung !== '') {
      manualBumbuKarung = String(plan.manualBumbuKarung)
    } else if (plan?.totalPcs > 0 && plan?.targetBumbuKarung) {
      manualBumbuKarung = String(plan.targetBumbuKarung)
    }

    return {
      orderMika: orderMika ? String(orderMika) : '',
      orderVakum: orderVakum ? String(orderVakum) : '',
      bumperMika: bumperMika ? String(bumperMika) : '',
      bumperVakum: bumperVakum ? String(bumperVakum) : '',
      manualGilingan,
      manualBumbuKarung
    }
  }

  const [form, setForm] = useState(() => getInitialForm(dailyPlan))
  const [isSaved, setIsSaved] = useState(false)
  const [prevPlanId, setPrevPlanId] = useState(activePlanId)

  // Pola resmi React: sinkronisasi state saat ID rencana berganti (misal ganti hari)
  if (activePlanId && activePlanId !== prevPlanId) {
    setPrevPlanId(activePlanId)
    setForm(getInitialForm(dailyPlan))
  }

  const metrics = calculatePlanMetrics(form)
  const todayStr = getTodayIndonesian()

  // Nilai aktif gilingan & bumbu yang direncanakan PPIC
  const plannedGilingan = form.manualGilingan !== ''
    ? (parseInt(form.manualGilingan, 10) || 0)
    : (metrics.recommendedGilingan || metrics.targetGilingan || 0)

  const plannedKarung = form.manualBumbuKarung !== ''
    ? (parseInt(form.manualBumbuKarung, 10) || 0)
    : (plannedGilingan > 0 ? Math.ceil(plannedGilingan / 20) : (metrics.recommendedBumbuKarung || 0))

  // Realisasi aktual fisik gilingan & adonan hari ini
  const todayMeatLots = filterAndSortLots([...doughLots, ...meatLots], 'TODAY', 'OPERATOR')
  const aktualDaging = todayMeatLots.length
  const sisaDaging = Math.max(0, plannedGilingan - aktualDaging)
  const pctDaging = plannedGilingan > 0
    ? Math.min(100, Math.round((aktualDaging / plannedGilingan) * 100))
    : 0

  const handleChange = (field, val) => {
    const clean = val.replace(/[^0-9]/g, '')
    setForm((prev) => ({ ...prev, [field]: clean }))
    setIsSaved(false)
  }

  const handleApplyRecommendation = () => {
    setForm((prev) => ({
      ...prev,
      manualGilingan: String(metrics.recommendedGilingan || 0),
      manualBumbuKarung: String(metrics.recommendedBumbuKarung || 0)
    }))
    setIsSaved(false)
  }

  const handleSave = (e) => {
    e.preventDefault()
    const payload = {
      orderMika: parseInt(form.orderMika, 10) || 0,
      orderVakum: parseInt(form.orderVakum, 10) || 0,
      bumperMika: parseInt(form.bumperMika, 10) || 0,
      bumperVakum: parseInt(form.bumperVakum, 10) || 0,
      manualGilingan: form.manualGilingan,
      manualBumbuKarung: form.manualBumbuKarung,
      targetGilingan: plannedGilingan,
      targetBumbuKarung: plannedKarung,
      targetBumbuKresek: plannedKarung * 20
    }
    setDailyPlan(payload)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const isPIC = userRole === 'STAKEHOLDER' || userRole === 'PIC'
  const isStakeholder = isPIC

  const wrapperOptions = [
    { value: 'KULIT_7CM', label: '7 cm (Vakum)' },
    { value: 'KULIT_9CM', label: '9 cm (Mika)' }
  ]

  return (
    <div className="space-y-3.5 pb-24">
      <form onSubmit={handleSave} className="space-y-3.5">
        {/* 1. Kartu Target Pesanan Hari Ini */}
        <Card className="border-[#EDE8DF] bg-white shadow-2xs">
          <CardContent className="p-4 space-y-3.5">
            <div className="border-b border-[#EDE8DF] pb-2.5">
              <h2 className="text-xs font-bold text-[#2C3E50]">
                Target pesanan
              </h2>
              <p className="text-[11px] text-[#6B7B8D] mt-0.5">
                Tanggal: {todayStr}
              </p>
            </div>

            {/* Tabel Matriks Pesanan Ergonomis */}
            <div className="border border-[#EDE8DF] rounded-xl overflow-hidden bg-white shadow-2xs">
              {/* Header Kolom */}
              <div className="grid grid-cols-12 bg-[#F5F1EB] text-[11px] font-bold text-[#2C3E50] p-2.5 border-b border-[#EDE8DF] text-center">
                <span className="col-span-6 text-left">Kategori</span>
                <span className="col-span-3">Mika (50 pcs)</span>
                <span className="col-span-3">Vakum (25 pcs)</span>
              </div>

              {/* Baris 1: Pesanan (Gabungan Online & Offline) */}
              <div className="grid grid-cols-12 items-center p-2.5 border-b border-[#EDE8DF] gap-2 bg-white">
                <div className="col-span-6">
                  <span className="text-xs font-bold text-[#2C3E50] block leading-tight">
                    Pesanan
                  </span>
                  <span className="text-[11px] text-[#6B7B8D] italic block mt-0.5">
                    Online & Offline
                  </span>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.orderMika}
                    placeholder="0"
                    onChange={(e) => handleChange('orderMika', e.target.value)}
                    className="w-full h-11 px-2 bg-white border border-[#EDE8DF] rounded-xl text-xs tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.orderVakum}
                    placeholder="0"
                    onChange={(e) => handleChange('orderVakum', e.target.value)}
                    className="w-full h-11 px-2 bg-white border border-[#EDE8DF] rounded-xl text-xs tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              {/* Baris 2: Cadangan Freezer */}
              <div className="grid grid-cols-12 items-center p-2.5 border-b border-[#EDE8DF] gap-2 bg-white">
                <div className="col-span-6">
                  <span className="text-xs font-bold text-[#2C3E50] block leading-tight">
                    Cadangan
                  </span>
                  <span className="text-[11px] text-[#6B7B8D] italic block mt-0.5">
                    Stok freezer
                  </span>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.bumperMika}
                    placeholder="0"
                    onChange={(e) => handleChange('bumperMika', e.target.value)}
                    className="w-full h-11 px-2 bg-white border border-[#EDE8DF] rounded-xl text-xs tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.bumperVakum}
                    placeholder="0"
                    onChange={(e) => handleChange('bumperVakum', e.target.value)}
                    className="w-full h-11 px-2 bg-white border border-[#EDE8DF] rounded-xl text-xs tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                </div>
              </div>

              {/* Baris 3: Total Target */}
              <div className="grid grid-cols-12 items-center p-2.5 bg-[#F5F1EB] text-center font-bold text-xs text-[#2C3E50]">
                <span className="col-span-6 text-left text-xs font-bold">
                  Total target
                </span>
                <span className="col-span-3 tabular-nums font-bold text-[#2C3E50]">
                  {metrics.totalMika} pack
                </span>
                <span className="col-span-3 tabular-nums font-bold text-[#2C3E50]">
                  {metrics.totalVakum} pack
                </span>
              </div>
            </div>

            {/* Estimasi & Rekomendasi Sistem dari Pax Dimsum */}
            <div className="p-3 bg-[#F5F1EB]/80 border border-[#EDE8DF] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#2C3E50]">
                    Estimasi kebutuhan (rekomendasi sistem)
                  </span>
                </div>
                {isStakeholder && (metrics.recommendedGilingan > 0 || metrics.recommendedBumbuKarung > 0) && (
                  <button
                    type="button"
                    onClick={handleApplyRecommendation}
                    className="text-[11px] font-semibold text-[#4685ac] hover:text-[#366887] hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Terapkan ke rencana ↓</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-[#EDE8DF]">
                  <span className="text-[10px] text-[#6B7B8D] block font-medium">Total Dimsum</span>
                  <span className="text-xs font-bold text-[#2C3E50] tabular-nums block mt-0.5">
                    {metrics.totalPcs.toLocaleString('id-ID')} butir
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#EDE8DF]">
                  <span className="text-[10px] text-[#6B7B8D] block font-medium">Saran Gilingan</span>
                  <span className="text-xs font-bold text-[#4685ac] tabular-nums block mt-0.5">
                    {metrics.recommendedGilingan} gilingan
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#EDE8DF]">
                  <span className="text-[10px] text-[#6B7B8D] block font-medium">Saran Bumbu</span>
                  <span className="text-xs font-bold text-[#4685ac] tabular-nums block mt-0.5">
                    {metrics.recommendedBumbuKarung} karung
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Kartu Perkiraan Bahan & Realisasi Dapur */}
        <Card variant="action" className="border-[#D1E4EF] bg-white">
          <CardContent className="p-4 space-y-3.5">
            <span className="text-xs font-bold text-[#2C3E50] block">
              Perkiraan bahan yang di butuhkan
            </span>

            {/* 2 Kolom Input Manual Rencana Bahan */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Input Manual Gilingan Daging */}
              <div className="bg-[#F5F1EB] rounded-xl p-3 border border-[#EDE8DF] space-y-1.5">
                <label className="text-[11px] text-[#2C3E50] font-bold block">
                  Daging giling
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.manualGilingan}
                    placeholder={String(metrics.recommendedGilingan || 0)}
                    onChange={(e) => handleChange('manualGilingan', e.target.value)}
                    className="w-full h-11 px-2.5 bg-white border border-[#EDE8DF] rounded-xl text-base tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                  <span className="text-xs font-medium text-[#6B7B8D] shrink-0">gilingan</span>
                </div>
                <span className="text-[11px] text-[#6B7B8D] tabular-nums block text-center">
                  = {plannedGilingan * 15} kg daging
                </span>
              </div>

              {/* Input Manual Karung Bumbu */}
              <div className="bg-[#F5F1EB] rounded-xl p-3 border border-[#EDE8DF] space-y-1.5">
                <label className="text-[11px] text-[#2C3E50] font-bold block">
                  Bumbu karung
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={!isStakeholder}
                    value={form.manualBumbuKarung}
                    placeholder={String(metrics.recommendedBumbuKarung || (plannedGilingan > 0 ? Math.ceil(plannedGilingan / 20) : 0))}
                    onChange={(e) => handleChange('manualBumbuKarung', e.target.value)}
                    className="w-full h-11 px-2.5 bg-white border border-[#EDE8DF] rounded-xl text-base tabular-nums font-bold text-[#2C3E50] text-center focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 disabled:opacity-60 transition-colors shadow-2xs"
                  />
                  <span className="text-xs font-medium text-[#6B7B8D] shrink-0">karung</span>
                </div>
                <span className="text-[11px] text-[#6B7B8D] tabular-nums block text-center">
                  = {plannedKarung * 20} kresek (@20)
                </span>
              </div>
            </div>

            {/* Status Realisasi Daging di Dapur */}
            <div className="pt-2 border-t border-[#EDE8DF] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#2C3E50] font-semibold">Progres gilingan dapur:</span>
                <span className="tabular-nums font-bold text-[#2C3E50]">
                  {aktualDaging} dari {plannedGilingan} ({pctDaging}%)
                </span>
              </div>

              <div className="w-full bg-[#EDE8DF] h-2.5 rounded-full overflow-hidden border border-[#EDE8DF]/60">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    pctDaging >= 100 ? 'bg-[#15803D]' : 'bg-[#4685ac]'
                  }`}
                  style={{ width: `${pctDaging}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-[#6B7B8D] tabular-nums">
                <span>Sudah giling: {aktualDaging}</span>
                <span>Kurang: {sisaDaging} gilingan</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tombol Simpan 56px (Khusus PIC) */}
        {isPIC ? (
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
          >
            {isSaved ? (
              <>
                <CheckIcon className="w-4 h-4 text-white" />
                <span>Rencana & target berhasil disimpan</span>
              </>
            ) : (
              <span>Simpan target & rencana produksi</span>
            )}
          </Button>
        ) : (
          <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 text-center text-xs text-[#6B7B8D] font-medium">
            Mode Pegawai (hanya baca). Beralih ke PIC untuk mengubah rencana.
          </div>
        )}
      </form>

      {/* Akses Cepat PPIC: Terima Kulit Luar */}
      {isStakeholder && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => {
            if (ppicExternalWrapperMode === 'REDIRECT') {
              setStation('WRAPPER')
            } else {
              setIsWrapperModalOpen(true)
            }
          }}
        >
          Terima kulit supplier luar (PPIC)
        </Button>
      )}

      {/* Modal Langsung Penerimaan Kulit Supplier Luar */}
      <Modal
        isOpen={isWrapperModalOpen}
        onClose={() => setIsWrapperModalOpen(false)}
        title="Terima kulit supplier luar"
        subtitle="Input penerimaan & terbitkan label bal"
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const count = Math.max(1, parseInt(balQty, 10) || 1)
            createWrapperLot(wrapperType, count, 'EXTERNAL', supplierName)
            setIsWrapperModalOpen(false)
            setBalQty('1')
            setSupplierName('')
          }}
          className="space-y-3.5"
        >
          {/* Ukuran Kulit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2C3E50]">
              Ukuran kulit
            </label>
            <SegmentedControl
              options={wrapperOptions}
              value={wrapperType}
              onChange={(val) => setWrapperType(val)}
            />
          </div>

          {/* Jumlah Bal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-[#2C3E50]">
                Jumlah bal
              </label>
              <span className="tabular-nums font-medium text-[#6B7B8D]">
                {(parseInt(balQty, 10) || 1) * 15} kg ({parseInt(balQty, 10) || 1} bal)
              </span>
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={balQty}
              onChange={(e) => setBalQty(e.target.value)}
              className="w-full h-12 px-3.5 tabular-nums font-bold text-base border border-[#EDE8DF] rounded-xl bg-white text-[#2C3E50] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 transition-colors shadow-2xs"
              required
            />
          </div>

          {/* Nama Supplier (Opsional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2C3E50]">
              Nama supplier (opsional)
            </label>
            <input
              type="text"
              placeholder="Nama supplier / toko luar..."
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full h-11 px-3.5 text-xs border border-[#EDE8DF] rounded-xl bg-white text-[#2C3E50] focus:outline-none focus:border-[#4685ac] focus:ring-2 focus:ring-[#4685ac]/20 transition-colors shadow-2xs placeholder-[#6B7B8D]"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="flex gap-2 pt-2 border-t border-[#EDE8DF]">
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setIsWrapperModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              icon={PrinterIcon}
            >
              Cetak label
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
