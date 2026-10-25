import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots, groupLotsByDay } from '../utils/dateFilter'
import { PrinterIcon, ScanIcon } from './Icons'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import { Card, CardContent } from './ui/Card'
import { Stepper } from './ui/Stepper'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { groupStationLots } from '../utils/scanMode'
import { canOpenQr, canManualDispatch } from '../utils/permissions'

function SeasoningLotCard({
  lot,
  isReady,
  isTransit,
  isMixing,
  isSelected,
  portionText,
  isSelecting,
  isEligible = true,
  onToggle,
  onStartSelecting,
  canOpenQr: hasQrPermission = false,
  onPrint
}) {
  const longPressHandlers = useLongPress(
    () => {
      if (!isEligible) return
      if (!isSelecting) {
        onStartSelecting()
      }
      onToggle()
    },
    () => {
      if (isSelecting) {
        if (isEligible) onToggle()
      } else if (hasQrPermission) {
        onPrint()
      }
    }
  )

  return (
    <div
      {...(isEligible ? longPressHandlers : {})}
      className={`bg-[#F5F1EB] border rounded-xl p-3 flex items-center justify-between text-xs transition-all duration-150 select-none ${
        isSelected
          ? 'border-[#4685ac] bg-[#EEF5F9] ring-1 ring-[#4685ac]'
          : 'border-[#EDE8DF]'
      } ${isEligible ? 'cursor-pointer active:scale-[0.99]' : 'opacity-85'}`}
    >
      <div className="flex items-center gap-2">
        {isSelecting && isEligible && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
          />
        )}
        <div>
          <span className="tabular-nums font-bold text-[#2C3E50] block text-xs">
            {lot.lotCode}
          </span>
          <span className="text-[11px] text-[#6B7B8D] tabular-nums">
            {portionText}
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        <Badge
          variant={
            isReady
              ? 'warning'
              : isTransit
              ? 'info'
              : isMixing
              ? 'info'
              : 'neutral'
          }
          size="sm"
        >
          {isReady
            ? 'Siap'
            : isTransit
            ? 'Dikirim'
            : isMixing
            ? 'Di mixer'
            : 'Habis'}
        </Badge>

        {hasQrPermission && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPrint()
            }}
            className="w-10 h-10 rounded-xl border border-[#B7C3CE] bg-white hover:bg-[#F5F1EB] flex items-center justify-center text-[#2C3E50] transition-colors duration-150 active:scale-[0.98] cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
            title="Cetak ulang barcode"
            aria-label="Cetak ulang barcode"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function SeasoningStation() {
  const userRole = useProduction1Store((s) => s.userRole)
  const isPIC = userRole === 'STAKEHOLDER' || userRole === 'PIC'
  const seasoningLots = useProduction1Store((s) => s.seasoningLots)
  const dailyPlan = useProduction1Store((s) => s.dailyPlan) || {}
  const targetGilinganStore = useProduction1Store((s) => s.targetGilingan)
  const generateSeasoningSacks = useProduction1Store((s) => s.generateSeasoningSacks)
  const scanOutSeasoningBatch = useProduction1Store((s) => s.scanOutSeasoningBatch)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)

  // Target Bumbu Harian (Sistem Karung: 1 karung = 20 kresek = 20 gilingan)
  const targetGilingan = dailyPlan.targetGilingan || targetGilinganStore || 40
  const targetBumbuKarung = dailyPlan.targetBumbuKarung || (targetGilingan > 0 ? Math.ceil(targetGilingan / 20) : 0)
  const targetBumbuKresek = dailyPlan.targetBumbuKresek || targetGilingan

  const [sackInput, setSackInput] = useState(() => Math.max(1, targetBumbuKarung || 2))
  const [isSending, setIsSending] = useState(false)

  const filteredSeasoningLots = filterAndSortLots(seasoningLots, 'TODAY', 'OPERATOR')

  const { mode: scanMode, pendingConfirmation, onHandStock } = groupStationLots(
    filteredSeasoningLots,
    'SEASONING_STATION',
    scanModeSettings
  )
  const readyLots = onHandStock

  // Hanya lot yang siap di stasiun bumbu yang memenuhi syarat untuk di-scan out
  const eligibleSeasoningLots = filteredSeasoningLots.filter(
    (l) =>
      l.status === 'READY_IN_SEASONING_STATION' ||
      (scanMode === '1X' && l.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleSeasoningLots.map((l) => l.lotCode))
  const seasoningSelect = useLotMultiSelect(eligibleSeasoningLots)
  const transitLots = filteredSeasoningLots.filter((l) => l.status === 'IN_TRANSIT_TO_MEAT_MIXING')
  const terkirimLots = filteredSeasoningLots.filter(
    (l) =>
      l.status === 'IN_TRANSIT_TO_MEAT_MIXING' ||
      l.status === 'IN_MEAT_MIXING_STATION' ||
      l.status === 'READY_IN_MEAT_MIXING_STATION' ||
      l.status === 'CONSUMED' ||
      l.status === 'CLOSED'
  )
  const terkirimCount = terkirimLots.length
  const sisaBumbuKarung = targetBumbuKarung > 0
    ? Math.max(0, targetBumbuKarung - terkirimCount)
    : Math.max(0, readyLots.length)

  const sackCount = Math.max(1, parseInt(sackInput, 10) || 1)
  const totalPortions = sackCount * 20

  const handleGenerate = (e) => {
    e.preventDefault()
    if (sackCount <= 0) return
    generateSeasoningSacks(sackCount, 20)
  }

  const handleSendSelected = async () => {
    if (isSending || seasoningSelect.selectedCount === 0) return
    setIsSending(true)
    try {
      const selectedCodes = Array.from(seasoningSelect.selectedCodes)
      await scanOutSeasoningBatch(selectedCodes)
      seasoningSelect.clearSelection()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Tampilan Khusus PIC: Cetak Karung Bumbu */}
      {isPIC ? (
        <Card variant="action" className="border-[#B7C3CE] bg-white">
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
              <span className="text-xs font-bold text-[#2C3E50] font-heading">
                Cetak label bumbu
              </span>
              {targetBumbuKarung > 0 && (
                <span className="text-[11px] text-[#6B7B8D] font-medium">
                  Target: <strong className="text-[#2C3E50] font-bold">{targetBumbuKarung} karung</strong> ({targetBumbuKresek} kresek)
                </span>
              )}
            </div>

            {/* Stepper Karung Tanpa Satuan Berulang pada Chip */}
            <Stepper
              label="Jumlah karung"
              value={sackCount}
              onChange={(val) => setSackInput(val)}
              min={1}
              max={20}
              presets={[1, 2, 3, 4]}
              conversionText={`= ${totalPortions} kresek`}
            />

            {/* Tombol Cetak Utama 56px */}
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleGenerate}
              icon={PrinterIcon}
            >
              Cetak label
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* 2. Tampilan Khusus Pegawai: Status & Kirim ke Mixer */
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Card 1: Target */}
            <Card className="border-[#EDE8DF] bg-white shadow-2xs">
              <CardContent className="p-2.5 sm:p-4 text-center space-y-1">
                <span className="text-[11px] sm:text-xs text-[#6B7B8D] font-medium block leading-tight">
                  Target
                </span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-[#2C3E50] block">
                  {targetBumbuKarung} <span className="text-[11px] sm:text-xs font-normal text-[#6B7B8D]">karung</span>
                </span>
              </CardContent>
            </Card>

            {/* Card 2: Terkirim */}
            <Card className="border-[#EDE8DF] bg-white shadow-2xs">
              <CardContent className="p-2.5 sm:p-4 text-center space-y-1">
                <span className="text-[11px] sm:text-xs text-[#6B7B8D] font-medium block leading-tight">
                  Terkirim
                </span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-[#2C3E50] block">
                  {terkirimCount} <span className="text-[11px] sm:text-xs font-normal text-[#6B7B8D]">karung</span>
                </span>
              </CardContent>
            </Card>

            {/* Card 3: Sisa (Menggantikan QR Terdaftar) */}
            <Card className="border-[#EDE8DF] bg-white shadow-2xs">
              <CardContent className="p-2.5 sm:p-4 text-center space-y-1">
                <span className="text-[11px] sm:text-xs text-[#6B7B8D] font-medium block leading-tight">
                  Sisa
                </span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold tabular-nums text-[#2C3E50] block">
                  {sisaBumbuKarung} <span className="text-[11px] sm:text-xs font-normal text-[#6B7B8D]">karung</span>
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Tombol Scan Out Bumbu ke Mixer Khusus Operator (48px) */}
          {readyLots.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              onClick={() =>
                openCameraScanner({
                  mode: 'UNIVERSAL',
                  title: 'Scan Out Karung Bumbu ke Mixer'
                })
              }
              icon={ScanIcon}
            >
              Scan Out Bumbu ke Mixer ({readyLots.length} siap)
            </Button>
          )}

          {transitLots.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] text-[#A8862E] rounded-xl p-3 text-center text-xs font-semibold">
              {transitLots.length} karung sedang diantar ke mixer
            </div>
          )}
        </div>
      )}

      {/* 3. Daftar Karung Bumbu Terbaru */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2C3E50] font-heading">
                Daftar karung bumbu
              </span>
              <Badge variant="neutral" size="sm" tabular>
                {filteredSeasoningLots.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              {lastBatchPrintModal?.lotList?.length > 1 && (
                <button
                  type="button"
                  onClick={reopenLastBatchPrintModal}
                  className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#E2DDD3] border border-[#EDE8DF] rounded-lg px-2.5 py-1 cursor-pointer transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
                  title="Buka kembali QR batch terakhir"
                >
                  Rekap ({lastBatchPrintModal.lotList.length})
                </button>
              )}

              {filteredSeasoningLots.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    seasoningSelect.isSelecting
                      ? seasoningSelect.clearSelection()
                      : seasoningSelect.startSelecting()
                  }
                  className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-colors duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac] ${
                    seasoningSelect.isSelecting
                      ? 'bg-[#4685ac] text-white border-[#4685ac]'
                      : 'bg-white text-[#2C3E50] border-[#B7C3CE] hover:bg-[#F5F1EB]'
                  }`}
                >
                  {seasoningSelect.isSelecting ? 'Selesai' : 'Pilih'}
                </button>
              )}
            </div>
          </div>

          {/* Section Menunggu Konfirmasi jika Mode 2x aktif */}
          {scanMode === '2X' && pendingConfirmation.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-[#F3E5C1] pb-2">
                <span className="text-xs font-bold text-[#A8862E]">
                  Menunggu Konfirmasi Stok ({pendingConfirmation.length} karung)
                </span>
                <Badge variant="warning" size="sm">
                  Perlu Scan Masuk
                </Badge>
              </div>
              <div className="space-y-1.5">
                {pendingConfirmation.map((lot) => (
                  <div
                    key={lot.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{lot.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        Karung bumbu · {lot.quantity !== undefined ? `${lot.quantity} porsi` : '20 porsi'}
                      </span>
                    </div>
                    <Badge variant="warning" size="sm">
                      Belum di-scan
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredSeasoningLots.length === 0 ? (
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-5 text-center text-[#6B7B8D] text-xs">
              Belum ada karung bumbu hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada lot yang memenuhi syarat) */}
              {seasoningSelect.isSelecting && eligibleSeasoningLots.length > 0 && (
                <div
                  onClick={() =>
                    seasoningSelect.isAllSelected
                      ? seasoningSelect.clearSelection()
                      : seasoningSelect.selectAll()
                  }
                  className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={seasoningSelect.isAllSelected}
                      onChange={() =>
                        seasoningSelect.isAllSelected
                          ? seasoningSelect.clearSelection()
                          : seasoningSelect.selectAll()
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
                    />
                    <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                  </div>
                  <Badge variant="neutral" size="sm" tabular>
                    {eligibleSeasoningLots.length} siap
                  </Badge>
                </div>
              )}

              {groupLotsByDay(filteredSeasoningLots).map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-0.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D]">
                      {group.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                      {group.items.length} karung
                    </span>
                  </div>

                  {group.items.map((lot) => {
                    const isReady = lot.status === 'READY_IN_SEASONING_STATION'
                    const isTransit = lot.status === 'IN_TRANSIT_TO_MEAT_MIXING'
                    const isMixing = lot.status === 'IN_MEAT_MIXING_STATION'
                    const isSelected = seasoningSelect.selectedCodes.has(lot.lotCode)
                    const portionText = lot.quantity !== undefined ? `${lot.quantity} porsi` : '20 porsi'

                    return (
                      <SeasoningLotCard
                        key={lot.lotCode}
                        lot={lot}
                        isReady={isReady}
                        isTransit={isTransit}
                        isMixing={isMixing}
                        isSelected={isSelected}
                        portionText={portionText}
                        isSelecting={seasoningSelect.isSelecting}
                        isEligible={eligibleCodesSet.has(lot.lotCode)}
                        onToggle={() => seasoningSelect.toggleSelect(lot.lotCode)}
                        onStartSelecting={() => seasoningSelect.startSelecting()}
                        canOpenQr={canOpenQr(userRole)}
                        onPrint={() =>
                          setPrintModal({
                            lotCode: lot.lotCode,
                            title: 'KARUNG BUMBU RACIK',
                            detail: `Kapasitas: ${portionText} Gilingan`,
                            weight: '1 Karung',
                            createdAt: lot.createdAt
                          })
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Bar untuk Cetak Batch QR / Scan Out / Manual Kirim */}
      <BatchPrintSelectionBar
        selectedCount={seasoningSelect.selectedCount}
        canOpenQr={canOpenQr(userRole)}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: 'Scan Out Karung Bumbu ke Mixer'
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={canManualDispatch(userRole) ? handleSendSelected : undefined}
        manualDispatchLabel="Kirim terpilih"
        onPrint={() => openBatchPrintModal(seasoningSelect.selectedLots, 'KARUNG BUMBU RACIK')}
      />
    </div>
  )
}
