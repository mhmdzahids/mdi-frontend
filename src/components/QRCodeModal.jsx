import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { useProduction1Store } from '../store/production1Store'
import { DEFAULT_CALIBRATION, loadCalibrationProfile, saveCalibrationProfile, canvasToEscPosRaster } from '../utils/escposRaster'
import { canvasToTsplRaster } from '../utils/tsplRaster'
import { createBarcode1DCanvas, getSupermarketBarcodeData } from '../utils/barcode1d'
import { bluetoothPrinter } from '../utils/bluetoothPrinter'
import { PrinterIcon, XIcon, CalibrateIcon, CheckIcon, AlertIcon } from './Icons'
import { SegmentedControl } from './ui/SegmentedControl'
import { useLockBodyScroll } from '../utils/useLockBodyScroll'

function Barcode1DPreview({ value }) {
  const svgRef = useRef(null)
  const smData = getSupermarketBarcodeData(value)

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, String(value).trim(), {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000'
        })
      } catch (err) {
        console.warn('JsBarcode SVG error:', err)
      }
    }
  }, [value])

  return (
    <div className="flex flex-col items-center justify-center py-1">
      <svg ref={svgRef} className="max-w-full h-12" />
      <span className="font-mono text-xs font-bold text-neutral-900 mt-1 tracking-widest">
        {smData.formattedText}
      </span>
    </div>
  )
}

export default function QRCodeModal() {
  const activePrintModal = useProduction1Store((s) => s.activePrintModal)
  useLockBodyScroll(Boolean(activePrintModal))
  const closePrintModal = useProduction1Store((s) => s.closePrintModal)
  const setStation = useProduction1Store((s) => s.setStation)

  const [btStatus, setBtStatus] = useState('DISCONNECTED')
  const [btDeviceName, setBtDeviceName] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isJobPrinting, setIsJobPrinting] = useState(false)
  const [printProgress, setPrintProgress] = useState(0)
  const [printMessage, setPrintMessage] = useState(null)
  const [selectedLotIndex, setSelectedLotIndex] = useState(0)
  const [printLayoutMode, setPrintLayoutMode] = useState('single') // 'single' (1 stiker per wadah) | 'duplicate' (kembar 2 stiker per baris)
  const [calibProfile, setCalibProfile] = useState(() => loadCalibrationProfile())
  const [barcodeType, setBarcodeType] = useState(() => calibProfile.barcodeType || 'qr')

  // Sync profile & lot index when activePrintModal changes without cascading effect
  const [prevModal, setPrevModal] = useState(activePrintModal)
  if (activePrintModal !== prevModal) {
    setPrevModal(activePrintModal)
    if (activePrintModal) {
      const p = loadCalibrationProfile()
      setCalibProfile(p)
      setBarcodeType(p.barcodeType || 'qr')
    }
  }

  const [prevLotCode, setPrevLotCode] = useState(activePrintModal?.lotCode)
  if (activePrintModal?.lotCode !== prevLotCode) {
    setPrevLotCode(activePrintModal?.lotCode)
    setSelectedLotIndex(0)
  }

  const isBusyPrinting = isJobPrinting || isPrinting

  const offscreenCanvasRef = useRef(null)
  const qrCanvasRef = useRef(null)

  useEffect(() => {
    const unsub = bluetoothPrinter.subscribe((st) => {
      setBtStatus(st.status)
      setBtDeviceName(st.deviceName)
      setIsPrinting(st.isPrinting)
    })
    return () => unsub()
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!activePrintModal) return

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isBusyPrinting) {
        closePrintModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activePrintModal, closePrintModal, isBusyPrinting])

  if (!activePrintModal) return null

  const lotList = activePrintModal.lotList && activePrintModal.lotList.length > 0
    ? activePrintModal.lotList
    : [activePrintModal]

  const currentLot = lotList[selectedLotIndex] || activePrintModal

  const handlePrintBluetoothCalibrated = async (targetLots = null) => {
    try {
      setIsJobPrinting(true)
      setPrintMessage(null)
      if (btStatus !== 'CONNECTED') {
        await bluetoothPrinter.connect()
      }

      const profile = loadCalibrationProfile()
      setCalibProfile(profile)
      const isTspl = (profile.printerProtocol || 'TSPL') === 'TSPL'
      const dpm = profile.dotsPerMm || 8
      const width = profile.headDots || 576
      const baseMarginLeft = (profile.marginLeftMm || 0) + (profile.xOffsetMm || 0)
      const marginLeftDots = Math.round(baseMarginLeft * dpm)
      const labelWidthDots = Math.round(profile.labelWidthMm * dpm)
      const labelHeightDots = Math.round(profile.labelHeightMm * dpm)
      const colGapDots = Math.round(profile.colGapMm * dpm)
      const verticalGapDots = Math.round(profile.verticalGapMm * dpm)
      const pitchDots = labelHeightDots + verticalGapDots
      const rowHeightDots = isTspl ? labelHeightDots : pitchDots
      const globalOffsetYDots = Math.round(((profile.offsetYMm || 0) + (profile.yOffsetMm || 0)) * dpm)

      const canvas = offscreenCanvasRef.current
      if (!canvas) throw new Error('Kanvas belum siap.')

      canvas.width = width
      canvas.height = rowHeightDots
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false

      const innerPad = Math.round(profile.innerPaddingMm * dpm)
      const qrSizeDots = Math.round(profile.qrSizeMm * dpm)

      const drawSingleSticker = (lotData, stkX, stkY) => {
        if (!lotData) return
        const sx = Math.round(stkX)
        const sy = Math.round(stkY)
        const sw = Math.round(labelWidthDots)
        const sh = Math.round(labelHeightDots)

        // Cetak garis bingkai luar hanya jika opsi showBorder aktif di kalibrasi
        if (profile.showBorder) {
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 1
          ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1)
        }

        const drawSharpText = (text, x, y, maxW) => {
          if (!text) return
          const rx = Math.round(x)
          const ry = Math.round(y)
          ctx.fillStyle = '#000000'
          ctx.fillText(text, rx, ry, maxW ? Math.round(maxW) : undefined)
        }

        if (barcodeType === 'barcode1d') {
          // MODE 2: BARCODE GARIS 1D (CODE 128)
          const titleWeight = profile.titleFontWeight || 'bold'
          const titleSize = profile.titleFontSize || 9.5
          ctx.font = `${titleWeight} ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
          ctx.textAlign = 'center'
          drawSharpText(lotData.title, sx + sw / 2, sy + innerPad + 11, sw - innerPad * 2 - 4)

          const barWidth = profile.barcodeBarWidth || 2
          const barHeight = profile.barcodeHeight || 44
          const quietZone = profile.barcodeQuietZone !== undefined ? profile.barcodeQuietZone : 6
          const bcCanvas = createBarcode1DCanvas(lotData.lotCode, {
            height: barHeight,
            width: barWidth,
            margin: quietZone,
            maxWidth: sw - innerPad * 2
          })
          if (bcCanvas && bcCanvas.width > 0) {
            ctx.imageSmoothingEnabled = false
            const bcW = Math.min(bcCanvas.width, sw - innerPad * 2)
            const bcX = Math.round(sx + (sw - bcW) / 2)
            const bcY = Math.round(sy + innerPad + 15)
            ctx.drawImage(bcCanvas, 0, 0, bcCanvas.width, bcCanvas.height, bcX, bcY, bcW, barHeight)
          }

          const smData = getSupermarketBarcodeData(lotData.lotCode)
          const lotWeight = profile.lotFontWeight || 'bold'
          const lotSize = Math.max(9, profile.lotFontSize || 11.5)
          ctx.font = `${lotWeight} ${lotSize}px "Consolas", "Courier New", monospace`
          ctx.textAlign = 'center'
          const bcBottom = sy + innerPad + 15 + barHeight
          const availableSpace = (sy + sh - innerPad) - bcBottom
          const textY = availableSpace > lotSize
            ? Math.round(bcBottom + availableSpace / 2 + lotSize * 0.35)
            : Math.round(Math.min(sy + sh - innerPad - 2, bcBottom + lotSize + 2))
          drawSharpText(smData.formattedText, sx + sw / 2, textY, sw - innerPad * 2 - 4)
        } else {
          // MODE 1: QR CODE 2D
          const qrX = Math.round(sx + innerPad)
          const qrY = Math.round(sy + (sh - qrSizeDots) / 2)
          const qrCanvas = document.getElementById(`qr-cache-${lotData.lotCode}`) || qrCanvasRef.current
          if (qrCanvas) {
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(qrCanvas, qrX, qrY, Math.round(qrSizeDots), Math.round(qrSizeDots))
          }

          const textOffsetX = profile.textOffsetX ?? 6
          const textOffsetY = profile.textOffsetY ?? 0
          const lineSpacing = profile.textLineSpacing ?? 13

          const textStartX = Math.round(qrX + qrSizeDots + textOffsetX)
          const maxTextWidth = Math.max(10, Math.round(sx + sw - innerPad - textStartX))
          const textCenterX = Math.round(textStartX + maxTextWidth / 2)

          const lotWeight = profile.lotFontWeight || 'bold'
          const lotSize = profile.lotFontSize ?? 11.0
          const titleWeight = profile.titleFontWeight || 'bold'
          const titleSize = profile.titleFontSize ?? 11.5

          const totalTextH = lotSize + titleSize + (lineSpacing * 0.7)
          const textCenterY = sy + sh / 2 + textOffsetY
          const line1Y = Math.round(textCenterY - totalTextH / 2 + lotSize * 0.8)
          const line2Y = Math.round(line1Y + Math.max(lineSpacing, titleSize + 4))

          ctx.fillStyle = '#000000'
          ctx.textAlign = 'center'

          ctx.font = `${lotWeight} ${lotSize}px "Consolas", "Courier New", monospace`
          drawSharpText(lotData.lotCode, textCenterX, line1Y, maxTextWidth)

          ctx.font = `${titleWeight} ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
          drawSharpText(lotData.title, textCenterX, line2Y, maxTextWidth)
        }
      }

      // Render dan cetak 1 baris fisik (Slot Kiri & Slot Kanan)
      const printRowForPair = async (leftLot, rightLot, isContinuation = false) => {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, rowHeightDots)

        if (leftLot) {
          const stk1X = marginLeftDots + (profile.col1OffsetX || 0)
          const stk1Y = globalOffsetYDots + (profile.col1OffsetY || 0)
          drawSingleSticker(leftLot, stk1X, stk1Y)
        }

        if (rightLot) {
          const stk2X = marginLeftDots + labelWidthDots + colGapDots + (profile.col2OffsetX || 0)
          const stk2Y = globalOffsetYDots + (profile.col2OffsetY || 0)
          drawSingleSticker(rightLot, stk2X, stk2Y)
        }

        const printBuffer = isTspl
          ? canvasToTsplRaster(canvas, {
              threshold: profile.threshold ?? DEFAULT_CALIBRATION.threshold,
              invert: profile.invert,
              labelHeightMm: profile.labelHeightMm,
              paperWidthMm: profile.paperWidthMm,
              verticalGapMm: profile.verticalGapMm,
              speed: profile.speed ?? 3,
              density: profile.darkness ? Math.round(profile.darkness * 2.5) : 8,
              direction: 0,
              isContinuation
            })
          : canvasToEscPosRaster(canvas, {
              threshold: profile.threshold ?? DEFAULT_CALIBRATION.threshold,
              invert: profile.invert
            })

        await bluetoothPrinter.print(printBuffer)
      }

      const queue = targetLots || (lotList.length > 1 ? lotList : [currentLot])

      if (printLayoutMode === 'duplicate') {
        const totalRows = queue.length
        for (let i = 0; i < totalRows; i++) {
          const isContinuation = i > 0
          await printRowForPair(queue[i], queue[i], isContinuation)
          setPrintProgress(Math.round(((i + 1) / totalRows) * 100))
          if (i < totalRows - 1) {
            const intervalMs = profile.printIntervalMs ?? 800
            await new Promise((r) => setTimeout(r, intervalMs))
          }
        }
        setPrintMessage({ type: 'success', text: `Selesai dicetak: ${queue.length} wadah (${totalRows} baris kembar)` })
      } else {
        const totalRows = Math.ceil(queue.length / 2)
        let rowIndex = 0
        for (let i = 0; i < queue.length; i += 2) {
          const leftLot = queue[i]
          const rightLot = queue[i + 1] || null
          const isContinuation = rowIndex > 0
          await printRowForPair(leftLot, rightLot, isContinuation)
          rowIndex++
          setPrintProgress(Math.round((rowIndex / totalRows) * 100))
          if (i + 2 < queue.length) {
            const intervalMs = profile.printIntervalMs ?? 800
            await new Promise((r) => setTimeout(r, intervalMs))
          }
        }
        setPrintMessage({ type: 'success', text: `Selesai dicetak: ${queue.length} wadah (${totalRows} baris label)` })
      }
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setPrintMessage({ type: 'error', text: `Gagal: ${err.message}` })
      }
    } finally {
      setIsJobPrinting(false)
    }
  }

  const handleBrowserPrint = () => {
    window.print()
  }

  const handleGoToCalibration = () => {
    closePrintModal()
    setStation('CALIBRATION')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overscroll-contain select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusyPrinting) {
          closePrintModal()
        }
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      {/* Hidden offscreen canvas untuk rendering ESC/POS */}
      <div className="hidden">
        {lotList.map((item, idx) => (
          <QRCodeCanvas
            key={item.lotCode || idx}
            id={`qr-cache-${item.lotCode}`}
            value={item.lotCode}
            size={Math.round((calibProfile.qrSizeMm || 10.5) * (calibProfile.dotsPerMm || 8))}
            level="M"
            includeMargin={false}
          />
        ))}
        <canvas ref={offscreenCanvasRef} />
      </div>

      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-2xl border border-[#EDE8DF] space-y-3.5 max-h-[92vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
          <div className="flex items-center gap-2">
            <PrinterIcon className="w-4 h-4 text-[#2C3E50]" />
            <span className="text-xs font-bold text-[#2C3E50]">
              Cetak label
            </span>
          </div>
          <button
            type="button"
            onClick={closePrintModal}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F1EB] rounded-lg text-[#6B7B8D] hover:text-[#2C3E50] transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Status Bluetooth */}
        <div className="flex items-center justify-between bg-[#F5F1EB] px-3 py-2 rounded-2xl border border-[#EDE8DF] text-xs">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                btStatus === 'CONNECTED' ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-neutral-400'
              }`}
            />
            <span className="text-[#2C3E50] truncate font-medium">
              {btStatus === 'CONNECTED' ? btDeviceName : 'Bluetooth mati'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleGoToCalibration}
            className="min-h-[44px] px-2 text-[#6B7B8D] hover:text-[#2C3E50] font-semibold text-xs flex items-center gap-1 shrink-0 ml-2 cursor-pointer transition-colors"
          >
            <CalibrateIcon className="w-3.5 h-3.5 text-[#6B7B8D]" />
            <span>Kalibrasi</span>
          </button>
        </div>

        {/* Ringkasan Profil Kalibrasi Aktif */}
        <div className="bg-[#F5F1EB] px-3 py-2 rounded-2xl border border-[#EDE8DF] flex items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-1.5 text-[#6B7B8D] truncate">
            <span className="font-bold text-[#2C3E50]">Kalibrasi:</span>
            <span className="truncate tabular-nums font-medium">
              {calibProfile.labelWidthMm}x{calibProfile.labelHeightMm}mm (Speed {calibProfile.speed || 3} ips, Jeda {calibProfile.printIntervalMs || 800}ms, Celah {calibProfile.verticalGapMm}mm, {calibProfile.printerProtocol || 'TSPL'})
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
            calibProfile.showBorder
              ? 'bg-[#2C3E50] text-white border-[#2C3E50]'
              : 'bg-white text-[#6B7B8D] border-[#EDE8DF]'
          }`}>
            Border: {calibProfile.showBorder ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Feedback Alert */}
        {printMessage && (
          <div
            className={`p-2.5 rounded-2xl text-xs flex items-center gap-2 border ${
              printMessage.type === 'success'
                ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
            }`}
          >
            {printMessage.type === 'success' ? (
              <CheckIcon className="w-4 h-4 text-[#065F46] shrink-0" />
            ) : (
              <AlertIcon className="w-4 h-4 text-[#991B1B] shrink-0" />
            )}
            <span className="font-semibold truncate">{printMessage.text}</span>
          </div>
        )}

        {/* Switcher Navigasi Stiker jika Batch > 1 */}
        {lotList.length > 1 && (
          <div className="flex items-center justify-between bg-[#EDE8DF] p-1.5 rounded-2xl text-xs border border-[#EDE8DF]">
            <button
              type="button"
              disabled={selectedLotIndex === 0}
              onClick={() => setSelectedLotIndex((i) => Math.max(0, i - 1))}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-[#EDE8DF] bg-white disabled:opacity-40 text-[#2C3E50] text-xs font-semibold hover:bg-[#F5F1EB] cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              Prev
            </button>
            <span className="font-bold text-[#2C3E50] text-xs tabular-nums">
              Stiker {selectedLotIndex + 1} / {lotList.length}
            </span>
            <button
              type="button"
              disabled={selectedLotIndex === lotList.length - 1}
              onClick={() => setSelectedLotIndex((i) => Math.min(lotList.length - 1, i + 1))}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-[#EDE8DF] bg-white disabled:opacity-40 text-[#2C3E50] text-xs font-semibold hover:bg-[#F5F1EB] cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              Next
            </button>
          </div>
        )}

        {/* Pilihan Format Barcode: QR Code 2D vs Barcode Garis 1D (Middle Center & Kontras Tinggi) */}
        <SegmentedControl
          options={[
            { value: 'qr', label: 'QR Code (2D)' },
            { value: 'barcode1d', label: 'Barcode garis (1D)' }
          ]}
          value={barcodeType}
          onChange={(val) => {
            setBarcodeType(val)
            const updated = { ...calibProfile, barcodeType: val }
            saveCalibrationProfile(updated)
            setCalibProfile(updated)
          }}
        />

        {/* Area Print Label Preview */}
        <div className="border border-[#EDE8DF] p-4 rounded-2xl text-center bg-[#F5F1EB] space-y-2.5">
          <span className="text-xs font-bold text-[#6B7B8D] block">
            {currentLot.title}
          </span>
          {barcodeType !== 'barcode1d' && (
            <span className="text-sm font-bold text-[#2C3E50] tabular-nums block">
              {currentLot.lotCode}
            </span>
          )}

          <div className="flex justify-center py-1">
            {barcodeType === 'barcode1d' ? (
              <Barcode1DPreview value={currentLot.lotCode} />
            ) : (
              <QRCodeSVG
                value={currentLot.lotCode}
                size={110}
                level="M"
                includeMargin={false}
              />
            )}
          </div>

          <div className="text-xs text-[#2C3E50] space-y-1 border-t border-[#EDE8DF] pt-2 text-left tabular-nums">
            <div className="flex justify-between">
              <span className="text-[#6B7B8D]">Detail:</span>
              <span className="font-semibold text-[#2C3E50]">{currentLot.detail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7B8D]">Berat:</span>
              <span className="font-bold text-[#2C3E50]">{currentLot.weight}</span>
            </div>
          </div>
        </div>

        {/* Pilihan Tata Letak Stiker (2-Line Roll) */}
        <div className="bg-[#F5F1EB] p-3 rounded-2xl border border-[#EDE8DF] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2C3E50]">
            <span>Tata letak stiker (2-Line):</span>
            <span className="text-[#6B7B8D] text-[11px] tabular-nums font-medium">
              {printLayoutMode === 'single'
                ? `${Math.ceil((lotList.length || 1) / 2)} baris (1 label/wadah)`
                : `${lotList.length || 1} baris (2 label/wadah)`}
            </span>
          </div>
          <SegmentedControl
            options={[
              { value: 'single', label: '1 Label / wadah' },
              { value: 'duplicate', label: '2 Label kembar' }
            ]}
            value={printLayoutMode}
            onChange={(val) => setPrintLayoutMode(val)}
          />
        </div>

        {/* Pilihan Kecepatan Cetak Printer (Dynamic Speed) */}
        <div className="bg-[#F5F1EB] p-3 rounded-2xl border border-[#EDE8DF] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2C3E50]">
            <span>Kecepatan cetak (speed):</span>
            <span className="text-[#2C3E50] text-[11px] font-bold tabular-nums">
              {calibProfile.speed || 3} ips ({(calibProfile.speed || 3) <= 2 ? 'Pelan' : (calibProfile.speed || 3) <= 3.5 ? 'Standar' : 'Cepat'})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[
              { val: 2.0, label: '2.0 ips', desc: 'Pelan & pekat' },
              { val: 3.0, label: '3.0 ips', desc: 'Standar' },
              { val: 4.0, label: '4.0 ips', desc: 'Cepat' }
            ].map((s) => (
              <button
                key={s.val}
                type="button"
                onClick={() => {
                  const updated = { ...calibProfile, speed: s.val }
                  saveCalibrationProfile(updated)
                  setCalibProfile(updated)
                }}
                className={`min-h-[44px] py-1.5 px-1 rounded-xl text-center transition-all font-medium text-xs cursor-pointer flex flex-col items-center justify-center ${
                  (calibProfile.speed || 3) === s.val
                    ? 'bg-[#2C3E50] text-white shadow-xs font-bold'
                    : 'bg-white text-[#6B7B8D] hover:bg-[#F5F1EB] border border-[#EDE8DF]'
                }`}
              >
                <div className="font-bold leading-tight tabular-nums">{s.label}</div>
                <div className={`text-[10px] ${((calibProfile.speed || 3) === s.val) ? 'text-[#EDE8DF]' : 'text-[#6B7B8D]'}`}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pilihan Jeda Interval Antar Baris (Print Delay) */}
        <div className="bg-[#F5F1EB] p-3 rounded-2xl border border-[#EDE8DF] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2C3E50]">
            <span>Jeda antar baris (interval):</span>
            <span className="text-[#2C3E50] text-[11px] font-bold tabular-nums">
              {calibProfile.printIntervalMs || 800} ms ({((calibProfile.printIntervalMs || 800) / 1000).toFixed(1)}s)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {[
              { val: 100, label: '100ms', desc: 'Instan' },
              { val: 400, label: '400ms', desc: 'Cepat' },
              { val: 800, label: '800ms', desc: 'Standar' },
              { val: 1200, label: '1.2s', desc: 'Aman' }
            ].map((intv) => (
              <button
                key={intv.val}
                type="button"
                onClick={() => {
                  const updated = { ...calibProfile, printIntervalMs: intv.val }
                  saveCalibrationProfile(updated)
                  setCalibProfile(updated)
                }}
                className={`min-h-[44px] py-1 px-1 rounded-xl text-center transition-all font-medium text-xs cursor-pointer flex flex-col items-center justify-center ${
                  (calibProfile.printIntervalMs || 800) === intv.val
                    ? 'bg-[#2C3E50] text-white shadow-xs font-bold'
                    : 'bg-white text-[#6B7B8D] hover:bg-[#F5F1EB] border border-[#EDE8DF]'
                }`}
              >
                <div className="font-bold leading-tight tabular-nums">{intv.label}</div>
                <div className={`text-[10px] ${((calibProfile.printIntervalMs || 800) === intv.val) ? 'text-[#EDE8DF]' : 'text-[#6B7B8D]'}`}>{intv.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar saat cetak batch */}
        {isBusyPrinting && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-[#6B7B8D] tabular-nums">
              <span>Proses mencetak...</span>
              <span className="font-bold text-[#2C3E50]">{printProgress}%</span>
            </div>
            <div className="w-full bg-[#EDE8DF] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#4685ac] h-2 rounded-full transition-all duration-300"
                style={{ width: `${printProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => handlePrintBluetoothCalibrated(lotList.length > 1 ? lotList : [currentLot])}
            disabled={isBusyPrinting}
            className="w-full min-h-[52px] bg-[#4685ac] hover:bg-[#3A6B80] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <PrinterIcon className="w-4 h-4" />
            <span>
              {isBusyPrinting
                ? `Mencetak (${printProgress}%)...`
                : lotList.length > 1
                ? `Cetak semua (${lotList.length} stiker)`
                : 'Cetak label'}
            </span>
          </button>

          {lotList.length > 1 && (
            <button
              type="button"
              onClick={() => handlePrintBluetoothCalibrated([currentLot])}
              disabled={isBusyPrinting}
              className="w-full min-h-[48px] bg-white hover:bg-[#F5F1EB] text-[#2C3E50] border border-[#EDE8DF] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>Cetak stiker #{selectedLotIndex + 1} saja</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="min-h-[48px] rounded-xl border border-[#EDE8DF] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PrinterIcon className="w-3.5 h-3.5 text-[#6B7B8D]" />
              <span>Browser</span>
            </button>
            <button
              type="button"
              onClick={closePrintModal}
              className="min-h-[48px] rounded-xl border border-[#EDE8DF] bg-white hover:bg-[#F5F1EB] text-[#2C3E50] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5 text-[#6B7B8D]" />
              <span>Tutup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
