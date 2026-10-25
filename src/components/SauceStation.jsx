import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { filterAndSortLots, groupLotsByDay } from '../utils/dateFilter'
import { PrinterIcon, ScanIcon } from './Icons'
import BatchPrintSelectionBar from './BatchPrintSelectionBar'
import { useLotMultiSelect } from '../hooks/useLotMultiSelect'
import { useLongPress } from '../hooks/useLongPress'
import { Card, CardContent } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { groupStationLots } from '../utils/scanMode'
import { canOpenQr, canManualDispatch } from '../utils/permissions'

function SauceLotCard({
  lot,
  variantLabel,
  countDesc,
  isReady,
  isSelected,
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
          <span className="text-[11px] text-[#6B7B8D] tabular-nums block mt-0.5">
            {variantLabel} · 1 bal ({countDesc})
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-2"
        onClick={(e) => isSelecting && e.stopPropagation()}
      >
        <Badge
          variant={isReady ? 'warning' : 'success'}
          size="sm"
        >
          {isReady ? 'Siap' : 'Terkirim'}
        </Badge>

        {hasQrPermission && (
          <button
            type="button"
            onClick={onPrint}
            className="w-10 h-10 rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#EDE8DF] flex items-center justify-center text-[#2C3E50] hover:text-[#2C3E50] transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Cetak Ulang Barcode"
            aria-label="Cetak ulang barcode"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function SauceStation() {
  const [sauceType, setSauceType] = useState('REGULER')
  const [balQty, setBalQty] = useState('1')
  const [isSending, setIsSending] = useState(false)

  const userRole = useProduction1Store((s) => s.userRole)
  const isPIC = canManualDispatch(userRole)
  const hasQrPermission = canOpenQr(userRole)
  const sauceLots = useProduction1Store((s) => s.sauceLots)
  const createSauceLot = useProduction1Store((s) => s.createSauceLot)
  const scanOutSauceLot = useProduction1Store((s) => s.scanOutSauceLot)
  const setPrintModal = useProduction1Store((s) => s.setPrintModal)
  const lastBatchPrintModal = useProduction1Store((s) => s.lastBatchPrintModal)
  const reopenLastBatchPrintModal = useProduction1Store((s) => s.reopenLastBatchPrintModal)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)
  const openCameraScanner = useProduction1Store((s) => s.openCameraScanner)

  const scanModeSettings = useProduction1Store((s) => s.scanModeSettings)

  const filteredSauceLots = filterAndSortLots(sauceLots, 'TODAY', 'OPERATOR')

  const { mode: scanMode, pendingConfirmation, onHandStock } = groupStationLots(
    filteredSauceLots,
    'SAUCE_STATION',
    scanModeSettings
  )
  const readySauces = onHandStock

  // Hanya lot yang siap di stasiun saos yang memenuhi syarat untuk di-scan out
  const eligibleSauceLots = filteredSauceLots.filter(
    (s) =>
      s.status === 'READY_IN_SAUCE_STATION' ||
      (scanMode === '1X' && s.status === 'PRINTED_PENDING_STOCK_IN')
  )
  const eligibleCodesSet = new Set(eligibleSauceLots.map((s) => s.lotCode))
  const sauceSelect = useLotMultiSelect(eligibleSauceLots)

  const parsedBal = Math.max(1, parseInt(balQty, 10) || 1)
  const isMini = sauceType === 'MINI'
  const pcsPerBal = isMini ? 200 : 50
  const totalPcs = parsedBal * pcsPerBal

  const handleCreate = (e) => {
    e.preventDefault()
    if (parsedBal <= 0) return
    createSauceLot(sauceType, parsedBal)
  }

  const handleSendSelected = async () => {
    if (isSending || sauceSelect.selectedCount === 0) return
    setIsSending(true)
    try {
      for (const s of sauceSelect.selectedLots) {
        await scanOutSauceLot(s.lotCode)
      }
      sauceSelect.clearSelection()
    } finally {
      setIsSending(false)
    }
  }

  const sauceOptions = [
    { value: 'REGULER', label: 'Reguler' },
    { value: 'MINI', label: 'Mini' }
  ]

  return (
    <div className="space-y-3.5 pb-24">
      {/* 1. Tampilan Khusus PIC: Cetak Label Saos */}
      {isPIC ? (
        <Card variant="action" className="border-[#B7C3CE] bg-white">
          <CardContent className="p-4 space-y-3.5">
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
                <span className="text-xs font-bold text-[#2C3E50] font-heading">
                  Cetak label saos
                </span>
              </div>

              {/* Segmented Varian Saos */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C3E50] font-heading block">
                  Varian saos
                </label>
                <SegmentedControl
                  options={sauceOptions}
                  value={sauceType}
                  onChange={(val) => setSauceType(val)}
                />
              </div>

              {/* Input Jumlah Bal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C3E50] font-heading block">
                  Jumlah bal
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={balQty}
                  onChange={(e) => setBalQty(e.target.value)}
                  className="w-full h-12 px-3.5 tabular-nums font-bold text-base border-[1.5px] border-[#B7C3CE] rounded-xl bg-white text-[#2C3E50] focus-visible:outline-none focus-visible:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 transition-colors shadow-2xs"
                  required
                />
                <p className="text-[11px] font-medium text-[#6B7B8D] pl-1">
                  = {totalPcs} {sauceType === 'REGULER' ? 'pouch' : 'plastik'}
                </p>
              </div>

              {/* Tombol Cetak Utama 56px */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                icon={PrinterIcon}
              >
                Cetak label
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* 2. Tampilan Khusus Pegawai: Status & Scan Out ke Finishing */
        <div className="space-y-3">
          <Card className="border-[#EDE8DF] bg-white shadow-2xs">
            <CardContent className="p-4 text-center space-y-1">
              <span className="text-xs text-[#6B7B8D] font-medium block">
                Saos siap kirim ke finishing
              </span>
              <span className="text-3xl font-bold tabular-nums text-[#2C3E50] block">
                {readySauces.length} <span className="text-base font-normal text-[#6B7B8D]">bal</span>
              </span>
            </CardContent>
          </Card>

          {/* Tombol Scan Out Saos ke Finishing */}
          {readySauces.length > 0 && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() =>
                openCameraScanner({
                  mode: 'UNIVERSAL',
                  title: 'Scan Out Saos ke Finishing'
                })
              }
              icon={ScanIcon}
            >
              Scan Out Saos ke Finishing ({readySauces.length} siap)
            </Button>
          )}
        </div>
      )}

      {/* 3. Daftar Lot Saos Dimsum */}
      <Card className="border-[#EDE8DF] bg-white shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2C3E50]">
                Daftar saos
              </span>
              <Badge variant="neutral" size="sm" tabular>
                {filteredSauceLots.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              {lastBatchPrintModal?.lotList?.length > 1 && (
                <button
                  type="button"
                  onClick={reopenLastBatchPrintModal}
                  className="text-[11px] font-semibold text-[#6B7B8D] hover:text-[#2C3E50] bg-[#EDE8DF] hover:bg-[#EFE6D9] border border-[#EDE8DF] rounded-lg px-2.5 py-1 cursor-pointer transition-all active:scale-95"
                  title="Buka kembali QR batch terakhir"
                >
                  Rekap ({lastBatchPrintModal.lotList.length})
                </button>
              )}

              {filteredSauceLots.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    sauceSelect.isSelecting
                      ? sauceSelect.clearSelection()
                      : sauceSelect.startSelecting()
                  }
                  className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer active:scale-95 ${
                    sauceSelect.isSelecting
                      ? 'bg-[#4685ac] text-white border-[#4685ac]'
                      : 'bg-white text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                  }`}
                >
                  {sauceSelect.isSelecting ? 'Selesai' : 'Pilih'}
                </button>
              )}
            </div>
          </div>

          {/* Section Menunggu Konfirmasi jika Mode 2x aktif */}
          {scanMode === '2X' && pendingConfirmation.length > 0 && (
            <div className="bg-[#FAF4E6] border border-[#F3E5C1] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-[#F3E5C1] pb-2">
                <span className="text-xs font-bold text-[#A8862E]">
                  Menunggu Konfirmasi Stok ({pendingConfirmation.length} bal)
                </span>
                <Badge variant="warning" size="sm">
                  Perlu Scan Masuk
                </Badge>
              </div>
              <div className="space-y-1.5">
                {pendingConfirmation.map((s) => (
                  <div
                    key={s.lotCode}
                    className="bg-white/90 border border-[#F3E5C1] rounded-xl p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="tabular-nums font-bold text-[#2C3E50] block">{s.lotCode}</span>
                      <span className="text-[11px] text-[#6B7B8D]">
                        {s.typeName || (s.type === 'MINI' ? 'Saos mini' : 'Saos reguler')} · 1 bal
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

          {filteredSauceLots.length === 0 ? (
            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-5 text-center text-[#6B7B8D] text-xs">
              Belum ada data saos hari ini.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Baris 1: Pilih Semua (Hanya saat mode pilih aktif & ada lot yang memenuhi syarat) */}
              {sauceSelect.isSelecting && eligibleSauceLots.length > 0 && (
                <div
                  onClick={() =>
                    sauceSelect.isAllSelected
                      ? sauceSelect.clearSelection()
                      : sauceSelect.selectAll()
                  }
                  className="bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sauceSelect.isAllSelected}
                      onChange={() =>
                        sauceSelect.isAllSelected
                          ? sauceSelect.clearSelection()
                          : sauceSelect.selectAll()
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#EDE8DF] text-[#4685ac] focus:ring-0 accent-[#4685ac] cursor-pointer"
                    />
                    <span className="font-bold text-[#2C3E50]">Pilih semua</span>
                  </div>
                  <Badge variant="neutral" size="sm" tabular>
                    {eligibleSauceLots.length} siap
                  </Badge>
                </div>
              )}

              {groupLotsByDay(filteredSauceLots).map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-0.5 pt-1">
                    <span className="text-[11px] font-bold text-[#6B7B8D]">
                      {group.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-[#6B7B8D]">
                      {group.items.length} bal
                    </span>
                  </div>

                  {group.items.map((s) => {
                    const isReady = s.status === 'READY_IN_SAUCE_STATION'
                    const itemIsMini = s.type === 'MINI'
                    const variantLabel = itemIsMini ? 'Mini' : 'Reguler'
                    const countDesc = itemIsMini ? '200 plastik' : '50 pouch'

                    return (
                      <SauceLotCard
                        key={s.lotCode}
                        lot={s}
                        variantLabel={variantLabel}
                        countDesc={countDesc}
                        isReady={isReady}
                        isSelected={sauceSelect.selectedCodes.has(s.lotCode)}
                        isSelecting={sauceSelect.isSelecting}
                        isEligible={eligibleCodesSet.has(s.lotCode)}
                        onToggle={() => sauceSelect.toggleSelect(s.lotCode)}
                        onStartSelecting={() => sauceSelect.startSelecting()}
                        canOpenQr={hasQrPermission}
                        onPrint={() =>
                          setPrintModal({
                            lotCode: s.lotCode,
                            title: 'LOT SAOS DIMSUM',
                            detail:
                              s.typeName ||
                              (itemIsMini
                                ? 'Saos Dimsum Mini (200 Plastik)'
                                : 'Saos Dimsum Reguler (50 Pouch)'),
                            weight: `1 Bal (${countDesc})`,
                            createdAt: s.createdAt,
                            lotList: [
                              {
                                lotCode: s.lotCode,
                                title: 'LOT SAOS DIMSUM',
                                detail:
                                  s.typeName ||
                                  (itemIsMini
                                    ? 'Saos Dimsum Mini (200 Plastik)'
                                    : 'Saos Dimsum Reguler (50 Pouch)'),
                                weight: `1 Bal (${countDesc})`,
                                createdAt: s.createdAt
                              }
                            ]
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

      {/* Floating Action Bar untuk Cetak Batch QR & Aksi Pengiriman */}
      <BatchPrintSelectionBar
        selectedCount={sauceSelect.selectedCount}
        canOpenQr={hasQrPermission}
        onPrint={() => openBatchPrintModal(sauceSelect.selectedLots, 'LOT SAOS DIMSUM')}
        onScanOut={() =>
          openCameraScanner({
            mode: 'UNIVERSAL',
            title: `Scan out ${sauceSelect.selectedCount} saos terpilih`
          })
        }
        scanOutLabel="Scan out"
        onManualDispatch={isPIC ? handleSendSelected : undefined}
      />
    </div>
  )
}
