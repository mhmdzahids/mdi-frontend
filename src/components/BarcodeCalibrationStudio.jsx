import { useState, useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  DEFAULT_CALIBRATION,
  loadCalibrationProfile,
  saveCalibrationProfile,
  canvasToEscPosRaster,
  downloadBinaryFile
} from '../utils/escposRaster'
import { canvasToTsplRaster } from '../utils/tsplRaster'
import { createBarcode1DCanvas, getSupermarketBarcodeData } from '../utils/barcode1d'
import { bluetoothPrinter } from '../utils/bluetoothPrinter'
import { useProduction1Store } from '../store/production1Store'
import { PrinterIcon, BluetoothIcon, RefreshIcon, CheckIcon, XIcon, CalibrateIcon, AlertIcon } from './Icons'
import { Trash2, AlertTriangle, Lock } from 'lucide-react'
import { Modal } from './ui/Modal'
import ScanModeSettingsCard from './ScanModeSettingsCard'

export default function BarcodeCalibrationStudio() {
  const employeeDateScope = useProduction1Store((s) => s.employeeDateScope)
  const setEmployeeDateScope = useProduction1Store((s) => s.setEmployeeDateScope)
  const ppicExternalWrapperMode = useProduction1Store((s) => s.ppicExternalWrapperMode)
  const setPpicExternalWrapperMode = useProduction1Store((s) => s.setPpicExternalWrapperMode)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isPpicUser = useProduction1Store((s) => s.isPpicUser)
  const wipeDatabase = useProduction1Store((s) => s.wipeDatabase)

  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false)
  const [isWiping, setIsWiping] = useState(false)

  const isPPIC = isPpicUser ? isPpicUser() : Boolean(
    currentUser && (
      currentUser.username === 'supervisor' ||
      (currentUser.division && currentUser.division.toLowerCase().includes('ppic')) ||
      (currentUser.operator_id && currentUser.operator_id.toUpperCase().includes('YOSI')) ||
      (currentUser.division && currentUser.division.toLowerCase().includes('supervisor'))
    )
  )

  const handleConfirmWipe = async () => {
    setIsWiping(true)
    try {
      await wipeDatabase()
      setIsWipeModalOpen(false)
      setFeedback({ type: 'success', text: 'Database berhasil di-wipe dan data operasional telah direset.' })
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || 'Gagal melakukan wipe database.' })
    } finally {
      setIsWiping(false)
    }
  }

  const [profile, setProfile] = useState(() => loadCalibrationProfile())
  const [btStatus, setBtStatus] = useState('DISCONNECTED')
  const [btDeviceName, setBtDeviceName] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isJobPrinting, setIsJobPrinting] = useState(false)
  const [printProgress, setPrintProgress] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [previewZoom, setPreviewZoom] = useState(1.5)
  const [activeTab, setActiveTab] = useState('paper')

  const isBusyPrinting = isJobPrinting || isPrinting

  const masterCanvasRef = useRef(null)
  const qrCanvasLeftRef = useRef(null)
  const qrCanvasRightRef = useRef(null)

  // Pantau status koneksi bluetooth
  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((state) => {
      setBtStatus(state.status)
      setBtDeviceName(state.deviceName)
      setIsPrinting(state.isPrinting)
      if (state.error) {
        setFeedback({ type: 'error', text: state.error })
      }
    })
    return () => unsubscribe()
  }, [])

  // Update setting nilai profile & otomatis simpan ke localStorage agar sinkron ke modal cetak
  const updateSetting = (key, value) => {
    setProfile((prev) => {
      const updated = {
        ...prev,
        [key]: typeof value === 'number' && isNaN(value) ? 0 : value
      }
      saveCalibrationProfile(updated)
      return updated
    })
  }

  // Trigger render canvas setiap state berubah
  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = masterCanvasRef.current
      if (!canvas) return

    // Helper render konten 1 stiker mikro
    const renderStickerContent = (
      ctx,
      stkX,
      stkY,
      widthDots,
      heightDots,
      pad,
      qrSize,
      qrCanvas,
      lotCode,
      title
    ) => {
      const sx = Math.round(stkX)
      const sy = Math.round(stkY)
      const sw = Math.round(widthDots)
      const sh = Math.round(heightDots)

      // Border stiker 1-pixel pas (hanya jika showBorder aktif atau sedang di mode 'border')
      if (profile.showBorder || profile.testMode === 'border') {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1)
      }

      // Render teks super tajam: pixel-snapped, anti-blur, tanpa subpixel smear
      const drawSharpText = (text, x, y, maxW) => {
        if (!text) return
        const rx = Math.round(x)
        const ry = Math.round(y)
        ctx.fillStyle = '#000000'
        ctx.fillText(text, rx, ry, maxW ? Math.round(maxW) : undefined)
      }

      if (profile.barcodeType === 'barcode1d') {
        // MODE 2: BARCODE GARIS 1D (CODE 128)
        // 1. Baris Atas: Nama Produk (Center, Lebar Penuh)
        // Wadah, berat, timestamp, dan petugas dihilangkan sesuai permintaan user
        const titleWeight = profile.titleFontWeight || 'bold'
        const titleSize = profile.titleFontSize || 9.5
        ctx.font = `${titleWeight} ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.textAlign = 'center'
        drawSharpText(title, sx + sw / 2, sy + pad + 11, sw - pad * 2 - 4)

        // 2. Barcode Garis 1D di Tengah (Tebal & Ramah Sensor Kamera HP)
        const barWidth = profile.barcodeBarWidth || 2
        const barHeight = profile.barcodeHeight || 44
        const quietZone = profile.barcodeQuietZone !== undefined ? profile.barcodeQuietZone : 6
        const bcCanvas = createBarcode1DCanvas(lotCode, {
          height: barHeight,
          width: barWidth,
          margin: quietZone,
          maxWidth: sw - pad * 2
        })
        if (bcCanvas && bcCanvas.width > 0) {
          ctx.imageSmoothingEnabled = false
          const bcW = Math.min(bcCanvas.width, sw - pad * 2)
          const bcX = Math.round(sx + (sw - bcW) / 2)
          const bcY = Math.round(sy + pad + 15)
          ctx.drawImage(bcCanvas, 0, 0, bcCanvas.width, bcCanvas.height, bcX, bcY, bcW, barHeight)
        }

        // 3. Angka 1 Line ala Supermarket Profesional di Bawah Barcode (Center)
        // Terdiri dari: Nomor Sistem, Kode Manufaktur, Kode Produk, dan Digit Cek
        const smData = getSupermarketBarcodeData(lotCode)
        const lotWeight = profile.lotFontWeight || 'bold'
        const lotSize = Math.max(9, profile.lotFontSize || 11.5)
        ctx.font = `${lotWeight} ${lotSize}px "Consolas", "Courier New", monospace`
        ctx.textAlign = 'center'
        
        const bcBottom = sy + pad + 15 + barHeight
        const availableSpace = (sy + sh - pad) - bcBottom
        const textY = availableSpace > lotSize
          ? Math.round(bcBottom + availableSpace / 2 + lotSize * 0.35)
          : Math.round(Math.min(sy + sh - pad - 2, bcBottom + lotSize + 2))
        drawSharpText(smData.formattedText, sx + sw / 2, textY, sw - pad * 2 - 4)
      } else {
        // MODE 1: QR CODE 2D (Default)
        // QR Code
        const qrX = Math.round(sx + pad)
        const qrY = Math.round(sy + (sh - qrSize) / 2)
        const qrEl = qrCanvas || document.getElementById('qr-canvas-left') || document.getElementById('qr-canvas-right')
        if (qrEl) {
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(qrEl, qrX, qrY, Math.round(qrSize), Math.round(qrSize))
        }

        // Tipografi Dinamis Teks Label (Hanya Nomor Lot & Nama Produk, Wadah/Berat & Timestamp Dihilangkan)
        const textOffsetX = profile.textOffsetX ?? 6
        const textOffsetY = profile.textOffsetY ?? 0
        const lineSpacing = profile.textLineSpacing ?? 13

        const textStartX = Math.round(qrX + qrSize + textOffsetX)
        const maxTextWidth = Math.max(10, Math.round(sx + sw - pad - textStartX))
        const textCenterX = Math.round(textStartX + maxTextWidth / 2)

        const lotWeight = profile.lotFontWeight || 'bold'
        const lotSize = profile.lotFontSize ?? 11.0
        const titleWeight = profile.titleFontWeight || 'bold'
        const titleSize = profile.titleFontSize ?? 11.5

        // Posisi vertikal terpusat seimbang untuk 2 baris teks di samping QR
        const totalTextH = lotSize + titleSize + (lineSpacing * 0.7)
        const textCenterY = sy + sh / 2 + textOffsetY
        const line1Y = Math.round(textCenterY - totalTextH / 2 + lotSize * 0.8)
        const line2Y = Math.round(line1Y + Math.max(lineSpacing, titleSize + 4))

        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'

        // Baris 1: LOT CODE (Monospace, Center)
        ctx.font = `${lotWeight} ${lotSize}px "Consolas", "Courier New", monospace`
        drawSharpText(lotCode, textCenterX, line1Y, maxTextWidth)

        // Baris 2: NAMA PRODUK (Clean Sans-Serif, Center)
        ctx.font = `${titleWeight} ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
        drawSharpText(title, textCenterX, line2Y, maxTextWidth)
      }
    }

    const dpm = profile.dotsPerMm || 8 // 8 dots/mm @ 203 DPI
    const width = profile.headDots || 576 // 72 mm area cetak

    // Hitung dot fisik (Posisi X dinamis: Margin Kiri Head + X Offset)
    const baseMarginLeft = (profile.marginLeftMm || 0) + (profile.xOffsetMm || 0)
    const marginLeftDots = Math.round(baseMarginLeft * dpm)
    const labelWidthDots = Math.round(profile.labelWidthMm * dpm)
    const labelHeightDots = Math.round(profile.labelHeightMm * dpm)
    const colGapDots = Math.round(profile.colGapMm * dpm)
    const verticalGapDots = Math.round(profile.verticalGapMm * dpm)
    const pitchDots = labelHeightDots + verticalGapDots
    const globalOffsetYDots = Math.round(((profile.offsetYMm || 0) + (profile.yOffsetMm || 0)) * dpm)

    const rows = profile.testMode === 'drift' ? Math.max(1, profile.driftRows || 5) : 1
    const totalHeight = pitchDots * rows

    canvas.width = width
    canvas.height = totalHeight

    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    // 1. Background Bersih Putih
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, totalHeight)

    // Helper untuk menggambar 1 baris (2 label)
    for (let r = 0; r < rows; r++) {
      const rowY = r * pitchDots

      // Posisi Stiker Kiri & Kanan (dengan globalOffsetY)
      const stk1X = marginLeftDots + (profile.col1OffsetX || 0)
      const stk1Y = rowY + globalOffsetYDots + (profile.col1OffsetY || 0)

      const stk2X = marginLeftDots + labelWidthDots + colGapDots + (profile.col2OffsetX || 0)
      const stk2Y = rowY + globalOffsetYDots + (profile.col2OffsetY || 0)

      if (profile.testMode === 'border') {
        // MODE 1: BORDER ALIGNMENT TEST
        // Gambar kotak garis 1-pixel persis di tepi stiker fisik
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1

        // Kotak Stiker 1 (Kiri)
        ctx.strokeRect(stk1X + 0.5, stk1Y + 0.5, labelWidthDots - 1, labelHeightDots - 1)
        // Crosshair Center Stiker 1
        const mid1X = stk1X + labelWidthDots / 2
        const mid1Y = stk1Y + labelHeightDots / 2
        ctx.beginPath()
        ctx.moveTo(mid1X - 12, mid1Y)
        ctx.lineTo(mid1X + 12, mid1Y)
        ctx.moveTo(mid1X, mid1Y - 8)
        ctx.lineTo(mid1X, mid1Y + 8)
        ctx.stroke()

        // Teks info stiker 1
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(`KOLOM 1 (KIRI)`, stk1X + 8, stk1Y + 24)
        ctx.font = '9px monospace'
        ctx.fillText(`33x15mm [R${r + 1}]`, stk1X + 8, stk1Y + 38)
        ctx.fillText(`X:${stk1X} Y:${stk1Y}`, stk1X + 8, stk1Y + 52)

        // Kotak Stiker 2 (Kanan)
        ctx.strokeRect(stk2X + 0.5, stk2Y + 0.5, labelWidthDots - 1, labelHeightDots - 1)
        // Crosshair Center Stiker 2
        const mid2X = stk2X + labelWidthDots / 2
        const mid2Y = stk2Y + labelHeightDots / 2
        ctx.beginPath()
        ctx.moveTo(mid2X - 12, mid2Y)
        ctx.lineTo(mid2X + 12, mid2Y)
        ctx.moveTo(mid2X, mid2Y - 8)
        ctx.lineTo(mid2X, mid2Y + 8)
        ctx.stroke()

        // Teks info stiker 2
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(`KOLOM 2 (KANAN)`, stk2X + 8, stk2Y + 24)
        ctx.font = '9px monospace'
        ctx.fillText(`33x15mm [R${r + 1}]`, stk2X + 8, stk2Y + 38)
        ctx.fillText(`X:${stk2X} Y:${stk2Y}`, stk2X + 8, stk2Y + 52)
      } else if (profile.testMode === 'ruler') {
        // MODE 2: MISTAR PENGGARIS KALIBRASI
        ctx.fillStyle = '#000000'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1

        // Garis batas stiker
        ctx.setLineDash([4, 4])
        ctx.strokeRect(stk1X, stk1Y, labelWidthDots, labelHeightDots)
        ctx.strokeRect(stk2X, stk2Y, labelWidthDots, labelHeightDots)
        ctx.setLineDash([])

        // Mistar Horizontal setiap 1mm
        for (let mm = 0; mm <= 72; mm++) {
          const x = Math.round(mm * dpm)
          let tickLen = 6
          if (mm % 10 === 0) {
            tickLen = 22
            ctx.font = 'bold 9px monospace'
            ctx.fillText(`${mm}`, x + 2, rowY + 32)
          } else if (mm % 5 === 0) {
            tickLen = 14
          }
          ctx.beginPath()
          ctx.moveTo(x + 0.5, rowY)
          ctx.lineTo(x + 0.5, rowY + tickLen)
          ctx.stroke()
        }

        // Tanda teks referensi
        ctx.font = 'bold 10px monospace'
        ctx.fillText(`L-START: ${((profile.marginLeftMm || 0) + (profile.xOffsetMm || 0)).toFixed(1)}mm`, stk1X + 4, stk1Y + 60)
        ctx.fillText(`GAP: ${profile.colGapMm}mm`, stk1X + labelWidthDots - 10, stk1Y + 80)
        ctx.fillText(`R-START: ${((stk2X / dpm)).toFixed(1)}mm`, stk2X + 4, stk2Y + 60)
      } else {
        // MODE 3 & 4: REAL LABEL CONTENT & DRIFT TEST
        const innerPad = Math.round(profile.innerPaddingMm * dpm)
        const qrSizeDots = Math.round(profile.qrSizeMm * dpm)

        // Label Kiri (Sticker 1)
        renderStickerContent(
          ctx,
          stk1X,
          stk1Y,
          labelWidthDots,
          labelHeightDots,
          innerPad,
          qrSizeDots,
          qrCanvasLeftRef.current,
          profile.leftLot,
          profile.leftTitle
        )

        // Label Kanan (Sticker 2)
        renderStickerContent(
          ctx,
          stk2X,
          stk2Y,
          labelWidthDots,
          labelHeightDots,
          innerPad,
          qrSizeDots,
          qrCanvasRightRef.current,
          profile.rightLot,
          profile.rightTitle
        )
      }
    }
    }, 60)
    return () => clearTimeout(timer)
  }, [profile])

  // Handler Hubungkan Bluetooth
  const handleConnectBluetooth = async () => {
    setFeedback({ type: 'info', text: 'Membuka dialog pencarian printer Bluetooth...' })
    try {
      await bluetoothPrinter.connect()
      setFeedback({ type: 'success', text: `Berhasil terhubung ke ${bluetoothPrinter.deviceName}!` })
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setFeedback({ type: 'error', text: `Gagal terhubung: ${err.message}` })
      } else {
        setFeedback({ type: 'info', text: 'Pencarian perangkat dibatalkan.' })
      }
    }
  }

  // Handler Putus Bluetooth
  const handleDisconnectBluetooth = () => {
    bluetoothPrinter.disconnect()
    setFeedback({ type: 'info', text: 'Koneksi Bluetooth diputuskan.' })
  }

  // Handler Eksekusi Cetak ke Printer
  const handlePrintToBluetooth = async () => {
    const canvas = masterCanvasRef.current
    if (!canvas) return

    if (btStatus !== 'CONNECTED') {
      setFeedback({
        type: 'error',
        text: 'Printer Bluetooth belum terhubung! Silakan klik "Hubungkan Bluetooth" terlebih dahulu.'
      })
      return
    }

    try {
      setIsJobPrinting(true)
      setPrintProgress(0)
      const isTspl = (profile.printerProtocol || 'TSPL') === 'TSPL'
      const rows = profile.testMode === 'drift' ? Math.max(1, profile.driftRows || 5) : 1
      const dpm = profile.dotsPerMm || 8
      const labelHeightDots = Math.round((profile.labelHeightMm || 15) * dpm)
      const verticalGapDots = Math.round((profile.verticalGapMm || 2) * dpm)
      const pitchDots = labelHeightDots + verticalGapDots

      setFeedback({ type: 'info', text: `Menyiapkan cetak ${rows} baris (${isTspl ? 'TSPL' : 'ESC/POS'})...` })

      if (isTspl) {
        // Buat kanvas per-baris stiker fisik (tinggi 1 label fisik = labelHeightDots)
        const rowCanvas = document.createElement('canvas')
        rowCanvas.width = canvas.width
        rowCanvas.height = labelHeightDots
        const rowCtx = rowCanvas.getContext('2d')

        let totalBytesSent = 0

        for (let r = 0; r < rows; r++) {
          const rowY = r * pitchDots
          rowCtx.fillStyle = '#FFFFFF'
          rowCtx.fillRect(0, 0, rowCanvas.width, labelHeightDots)
          // Potong tepat 1 baris stiker dari master canvas
          rowCtx.drawImage(
            canvas,
            0, rowY, canvas.width, labelHeightDots,
            0, 0, canvas.width, labelHeightDots
          )

          const isContinuation = r > 0
          const printBuffer = canvasToTsplRaster(rowCanvas, {
            threshold: profile.threshold,
            invert: profile.invert,
            labelHeightMm: profile.labelHeightMm,
            paperWidthMm: profile.paperWidthMm,
            verticalGapMm: profile.verticalGapMm,
            speed: profile.speed ?? 3,
            density: profile.darkness ? Math.round(profile.darkness * 2.5) : 8,
            direction: 0,
            isContinuation
          })

          totalBytesSent += printBuffer.length
          setFeedback({
            type: 'info',
            text: `Mencetak baris ${r + 1} dari ${rows}...`
          })

          // Kirim per baris dengan progress tracking
          await bluetoothPrinter.print(printBuffer, (chunkProgress) => {
            const baseProgress = Math.round((r / rows) * 100)
            const rowContribution = Math.round((chunkProgress / 100) * (100 / rows))
            setPrintProgress(Math.min(100, baseProgress + rowContribution))
          })

          setPrintProgress(Math.round(((r + 1) / rows) * 100))

          if (r < rows - 1) {
            // Jeda fisik motor printer disesuaikan dengan interval yang diatur
            const intervalMs = profile.printIntervalMs ?? 800
            await new Promise((resolve) => setTimeout(resolve, intervalMs))
          }
        }

        setFeedback({
          type: 'success',
          text: `Berhasil mencetak ${rows} baris stiker (${totalBytesSent} bytes, format TSPL)!`
        })
      } else {
        // Format ESC/POS
        const printBuffer = canvasToEscPosRaster(canvas, {
          threshold: profile.threshold,
          invert: profile.invert
        })

        setFeedback({ type: 'info', text: 'Mengirim data ke printer lewat Bluetooth...' })
        await bluetoothPrinter.print(printBuffer, (progress) => {
          setPrintProgress(progress)
        })

        setFeedback({
          type: 'success',
          text: `Berhasil mencetak ${(profile.testMode || 'real').toUpperCase()} (${printBuffer.length} bytes, format ESC/POS)!`
        })
      }
    } catch (err) {
      setFeedback({ type: 'error', text: `Cetak gagal: ${err.message}` })
    } finally {
      setIsJobPrinting(false)
    }
  }


  // Handler Unduh File Binary (.bin)
  const handleDownloadBinary = () => {
    const canvas = masterCanvasRef.current
    if (!canvas) return
    const isTspl = (profile.printerProtocol || 'TSPL') === 'TSPL'

    if (isTspl) {
      const rows = profile.testMode === 'drift' ? Math.max(1, profile.driftRows || 5) : 1
      const dpm = profile.dotsPerMm || 8
      const labelHeightDots = Math.round((profile.labelHeightMm || 15) * dpm)
      const verticalGapDots = Math.round((profile.verticalGapMm || 2) * dpm)
      const pitchDots = labelHeightDots + verticalGapDots

      const rowCanvas = document.createElement('canvas')
      rowCanvas.width = canvas.width
      rowCanvas.height = labelHeightDots
      const rowCtx = rowCanvas.getContext('2d')

      const chunks = []
      let totalLength = 0

      for (let r = 0; r < rows; r++) {
        const rowY = r * pitchDots
        rowCtx.fillStyle = '#FFFFFF'
        rowCtx.fillRect(0, 0, rowCanvas.width, labelHeightDots)
        rowCtx.drawImage(
          canvas,
          0, rowY, canvas.width, labelHeightDots,
          0, 0, canvas.width, labelHeightDots
        )

        const isContinuation = r > 0
        const chunk = canvasToTsplRaster(rowCanvas, {
          threshold: profile.threshold,
          invert: profile.invert,
          labelHeightMm: profile.labelHeightMm,
          paperWidthMm: profile.paperWidthMm,
          verticalGapMm: profile.verticalGapMm,
          speed: profile.speed ?? 3,
          density: profile.darkness ? Math.round(profile.darkness * 2.5) : 8,
          direction: 0,
          isContinuation
        })
        chunks.push(chunk)
        totalLength += chunk.length
      }

      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      downloadBinaryFile(combined, `label_test_${profile.testMode}_tspl.bin`)
      setFeedback({ type: 'success', text: `File binary TSPL (${rows} baris) berhasil diunduh.` })
    } else {
      const buffer = canvasToEscPosRaster(canvas, {
        threshold: profile.threshold,
        invert: profile.invert
      })
      downloadBinaryFile(buffer, `label_test_${profile.testMode}_escpos.bin`)
      setFeedback({ type: 'success', text: 'File binary ESC/POS berhasil diunduh.' })
    }
  }


  // Handler Feed Kertas
  const handleFeedDots = async (dots, label) => {
    if (btStatus !== 'CONNECTED') {
      setFeedback({ type: 'error', text: 'Printer belum terhubung.' })
      return
    }
    try {
      await bluetoothPrinter.sendFeedDots(dots)
      setFeedback({ type: 'info', text: `Kertas dimajukan ${label}.` })
    } catch (err) {
      setFeedback({ type: 'error', text: `Gagal feed: ${err.message}` })
    }
  }

  // Terapkan spesifikasi resmi label TSPL (33x15mm 2-Line, Celah 2mm, Auto-Backfeed)
  const handleApplyOfficialSpecs = () => {
    const calibrated = {
      ...profile,
      marginLeftMm: 0.0,
      xOffsetMm: 0.0,
      yOffsetMm: 0.0,
      labelWidthMm: 33.0,
      colGapMm: 2.0,
      labelHeightMm: 15.0,
      verticalGapMm: 2.0,
      offsetYMm: 0,
      threshold: 170,
      innerPaddingMm: 1.0,
      qrSizeMm: 10.5,
      speed: 3,
      darkness: 3,
      printIntervalMs: 800,
      printerProtocol: 'TSPL',
      textOffsetX: 6,
      textOffsetY: 0,
      textLineSpacing: 13,
      lotFontSize: 11.0,
      lotFontWeight: 'bold',
      titleFontSize: 11.5,
      titleFontWeight: 'bold',
      detailFontSize: 9.5,
      detailFontWeight: 'bold',
      subtextFontSize: 8.5,
      subtextFontWeight: 'bold',
      barcodeBarWidth: 2,
      barcodeHeight: 44,
      barcodeQuietZone: 6
    }
    setProfile(calibrated)
    saveCalibrationProfile(calibrated)
    setFeedback({
      type: 'success',
      text: 'Konfigurasi label TSPL OpenLabel (33x15mm 2 Baris, Celah 2mm, Auto-Backfeed) diterapkan.'
    })
  }

  // Simpan Profile ke LocalStorage
  const handleSaveProfile = () => {
    saveCalibrationProfile(profile)
    setFeedback({
      type: 'success',
      text: 'Profil kalibrasi berhasil disimpan! Pengaturan ini akan dipakai otomatis saat mencetak label lot.'
    })
  }

  // Reset ke Default Pabrik
  const handleResetProfile = () => {
    if (window.confirm('Kembalikan semua parameter kalibrasi ke standar awal (32x15mm 2 Kolom)?')) {
      setProfile({ ...DEFAULT_CALIBRATION })
      saveCalibrationProfile(DEFAULT_CALIBRATION)
      setFeedback({ type: 'info', text: 'Pengaturan dikembalikan ke nilai standar kalibrasi.' })
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#EDE8DF] shadow-xs p-4 sm:p-5 flex flex-col gap-4">
      {/* Hidden QRCodeCanvas untuk dirender ke master canvas */}
      <div className="hidden">
        <QRCodeCanvas
          id="qr-canvas-left"
          ref={qrCanvasLeftRef}
          value={profile.leftLot}
          size={Math.round((profile.qrSizeMm || 10.5) * (profile.dotsPerMm || 8))}
          level="M"
          includeMargin={false}
        />
        <QRCodeCanvas
          id="qr-canvas-right"
          ref={qrCanvasRightRef}
          value={profile.rightLot}
          size={Math.round((profile.qrSizeMm || 10.5) * (profile.dotsPerMm || 8))}
          level="M"
          includeMargin={false}
        />
      </div>

      {/* Header Kalibrasi */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <CalibrateIcon className="w-4 h-4 text-neutral-900" />
          <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
            Kalibrasi Label
          </span>
        </div>

        {/* Status Bluetooth */}
        <div className="flex items-center gap-1.5">
          {btStatus === 'CONNECTED' ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-900 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0"></span>
              <span className="truncate max-w-[120px] font-mono">{btDeviceName}</span>
              <button
                type="button"
                onClick={handleDisconnectBluetooth}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded cursor-pointer"
                aria-label="Putus koneksi"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : btStatus === 'CONNECTING' ? (
            <span className="text-xs text-amber-700 font-mono font-medium px-2 py-1">Koneksi...</span>
          ) : (
            <button
              type="button"
              onClick={handleConnectBluetooth}
              className="min-h-11 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <BluetoothIcon className="w-4 h-4" />
              <span>Konek BT</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border shadow-xs ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-950 border-rose-300'
              : 'bg-emerald-50 text-emerald-950 border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {feedback.type === 'error' ? (
              <AlertIcon className="w-4 h-4 text-rose-700 shrink-0" />
            ) : (
              <CheckIcon className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            <span className="truncate font-semibold">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="w-7 h-7 flex items-center justify-center hover:bg-black/5 rounded-lg text-neutral-500 hover:text-neutral-900 shrink-0 cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tampilkan Data */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-3 space-y-2 shadow-xs">
        <span className="text-xs font-bold text-neutral-900 block">
          Tampilkan Data
        </span>

        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {[
            { id: 'TODAY', label: 'Hari Ini' },
            { id: 'YESTERDAY', label: 'Kemarin' },
            { id: 'TWO_DAYS', label: '2 Hari Lalu' },
            { id: 'ALL', label: 'Semua' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEmployeeDateScope(item.id)}
              className={`min-h-11 py-2 px-1 rounded-lg font-bold text-center border transition-all cursor-pointer ${
                employeeDateScope === item.id
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Setelan Mode Scan Operasional (1x vs 2x) */}
      <ScanModeSettingsCard />

      {/* Setelan Alur Penerimaan Kulit PPIC */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-3 space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-900 block">
            Alur Penerimaan Kulit PPIC
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800">
            {ppicExternalWrapperMode === 'DIRECT' ? 'Langsung di Rencana' : 'Alihkan ke Kulit'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPpicExternalWrapperMode('DIRECT')}
            className={`min-h-11 py-2 px-2.5 rounded-lg font-bold text-center border transition-all cursor-pointer ${
              ppicExternalWrapperMode === 'DIRECT'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Langsung di Rencana
          </button>
          <button
            type="button"
            onClick={() => setPpicExternalWrapperMode('REDIRECT')}
            className={`min-h-11 py-2 px-2.5 rounded-lg font-bold text-center border transition-all cursor-pointer ${
              ppicExternalWrapperMode === 'REDIRECT'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Alihkan ke Stasiun Kulit
          </button>
        </div>
        <span className="text-[11px] text-neutral-500 font-mono block">
          {ppicExternalWrapperMode === 'DIRECT'
            ? 'Tombol di menu Rencana langsung buka formulir generate QR bal kulit.'
            : 'Tombol di menu Rencana mengarahkan pengguna ke tab Stasiun Kulit.'}
        </span>
      </div>

      {/* Wipe Database (Masa Development - Khusus PPIC) */}
      <div className="bg-white border border-rose-200/90 rounded-xl p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-900 block leading-tight">
                Reset / Wipe Database
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                Masa Development
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
              DEV ONLY
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                isPPIC
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-500'
              }`}
            >
              {isPPIC ? 'PPIC' : 'TERKUNCI'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          {isPPIC
            ? 'Menghapus seluruh lot tracking, log perpindahan, riwayat scan, dan mereset target rencana produksi harian ke 40 gilingan.'
            : 'Fungsi Wipe Database terkunci. Fitur ini hanya dapat dieksekusi oleh akun PPIC (Pak Yosi / Supervisor).'}
        </p>

        {isPPIC ? (
          <button
            type="button"
            onClick={() => setIsWipeModalOpen(true)}
            className="w-full min-h-11 py-2.5 px-3 rounded-lg font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe Database (Reset Pengujian)</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-500 text-xs">
            <Lock className="w-4 h-4 shrink-0 text-neutral-400" />
            <span>Akses dibatasi: Masuk sebagai PPIC / Supervisor untuk melakukan wipe database.</span>
          </div>
        )}
      </div>

      {/* Progress Cetak */}
      {isPrinting && (
        <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-neutral-900 h-1.5 rounded-full transition-all duration-150"
            style={{ width: `${printProgress}%` }}
          ></div>
        </div>
      )}

      {/* Visual Canvas Preview */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
              Pratinjau ({profile.testMode.toUpperCase()})
            </span>
            <button
              type="button"
              onClick={() => updateSetting('showBorder', !profile.showBorder)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                profile.showBorder
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
              }`}
              title="Klik untuk mengaktifkan/menonaktifkan cetak garis border kotak stiker"
            >
              Border: {profile.showBorder ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => updateSetting('barcodeType', profile.barcodeType === 'barcode1d' ? 'qr' : 'barcode1d')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                profile.barcodeType === 'barcode1d'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
              }`}
              title="Klik untuk beralih antara Mode QR Code (2D) dan Barcode Garis (1D)"
            >
              {profile.barcodeType === 'barcode1d' ? 'Garis (1D)' : 'QR (2D)'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setPreviewZoom(1.0)}
              className={`px-2 h-6 border rounded text-[11px] font-semibold transition-colors ${
                previewZoom === 1.0
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300'
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(1.5)}
              className={`px-2 h-6 border rounded text-[11px] font-semibold transition-colors ${
                previewZoom === 1.5
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-300'
              }`}
            >
              150%
            </button>
            <div className="flex items-center gap-0.5 border border-neutral-300 rounded bg-neutral-50 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100))}
                className="w-5 h-5 hover:bg-neutral-200 rounded flex items-center justify-center font-bold text-neutral-800"
              >
                -
              </button>
              <span className="font-mono text-[11px] w-9 text-center text-neutral-600">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))}
                className="w-5 h-5 hover:bg-neutral-200 rounded flex items-center justify-center font-bold text-neutral-800"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Indikator Kolom Label */}
        {(() => {
          const currentX1Mm = (profile.marginLeftMm || 0) + (profile.xOffsetMm || 0)
          return (
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-neutral-600 px-2 bg-neutral-100 py-1 rounded">
              <span className="flex items-center gap-1.5 text-neutral-800">
                <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block"></span>
                KOLOM 1 (KIRI) [X: {currentX1Mm.toFixed(1)}mm]
              </span>
              <span className="flex items-center gap-1.5 text-neutral-800">
                KOLOM 2 (KANAN) [X: {(currentX1Mm + profile.labelWidthMm + profile.colGapMm).toFixed(1)}mm]
                <span className="w-2 h-2 rounded-full bg-neutral-500 inline-block"></span>
              </span>
            </div>
          )
        })()}

        {/* Scrollable Canvas Area (Mulai dari x=0 agar Kolom Kiri terlihat penuh dan bisa di-scroll bebas) */}
        <div className="bg-neutral-900 rounded-lg p-3 overflow-x-auto overflow-y-auto max-h-64 border border-neutral-700 shadow-inner">
          <div className="min-w-fit flex justify-start items-start pb-1">
            <canvas
              ref={masterCanvasRef}
              className="block bg-white shadow-md border border-neutral-400"
              style={{
                width: `${Math.round((profile.headDots || 576) * previewZoom)}px`,
                height: 'auto',
                imageRendering: 'pixelated'
              }}
            />
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500 flex justify-between pt-1">
          <span>Posisi X: {((profile.marginLeftMm || 0) + (profile.xOffsetMm || 0)).toFixed(1)}mm</span>
          <span>Gap: {profile.colGapMm}mm</span>
          <span>Pitch: {(profile.labelHeightMm + profile.verticalGapMm).toFixed(1)}mm</span>
        </div>

        {/* Progress Bar saat cetak berlangsung */}
        {isBusyPrinting && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-mono text-neutral-600">
              <span>Proses mencetak...</span>
              <span className="font-bold text-neutral-900">{printProgress}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-neutral-900 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${printProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tombol Cetak Tes & Feed Controls */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100">
          <button
            type="button"
            onClick={handlePrintToBluetooth}
            disabled={isBusyPrinting || btStatus !== 'CONNECTED'}
            className={`flex-1 h-9 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              btStatus === 'CONNECTED'
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs cursor-pointer active:scale-[0.98]'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <PrinterIcon className="w-4 h-4" />
            <span>{isBusyPrinting ? `Mencetak (${printProgress}%)...` : 'Cetak Tes'}</span>
          </button>

          {/* Feed Nudge */}
          {btStatus === 'CONNECTED' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleFeedDots(8, '1mm')}
                title="Tarik Kertas Maju 1mm (8 dots)"
                className="min-h-11 px-3 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer"
              >
                +1mm
              </button>
              <button
                type="button"
                onClick={() => handleFeedDots(40, '5mm')}
                title="Tarik Kertas Maju 5mm (40 dots)"
                className="min-h-11 px-3 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer"
              >
                +5mm
              </button>
              <button
                type="button"
                onClick={() => handleFeedDots(Math.round(((profile.labelHeightMm || 15) + (profile.verticalGapMm || 2)) * 8), '1 Label')}
                title="Tarik Kertas Maju 1 Baris Label Penuh (Dot Step Motor)"
                className="min-h-11 px-3 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl cursor-pointer"
              >
                +1 Label
              </button>
            </div>
          )}

          {isBusyPrinting && (
            <button
              type="button"
              onClick={() => {
                bluetoothPrinter.resetState()
                setIsPrinting(false)
                setIsJobPrinting(false)
                setFeedback({ type: 'info', text: 'Status cetak berhasil direset.' })
              }}
              title="Klik untuk membatalkan dan mereset status cetak jika macet"
              className="min-h-11 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Reset Cetak
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadBinary}
            className="min-h-11 px-3.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer"
          >
            <span>.BIN</span>
          </button>
        </div>

        {/* Tombol Cepat Terapkan Spesifikasi Standar */}
        <button
          type="button"
          onClick={handleApplyOfficialSpecs}
          className="w-full min-h-11 px-3.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl text-neutral-900 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <CheckIcon className="w-4 h-4 text-neutral-800" />
          <span>Terapkan Standar Label TSPL (33x15mm 2 Baris, Celah 2mm, Auto-Backfeed)</span>
        </button>
      </div>

      {/* Tabs Pengaturan Kalibrasi */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-xl border border-neutral-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('paper')}
            className={`min-h-11 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'paper' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Kertas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`min-h-11 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'layout' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Barcode & QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('typo')}
            className={`min-h-11 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'typo' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Teks & Font
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('modes')}
            className={`min-h-11 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              activeTab === 'modes' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Mode Tes
          </button>
        </div>

        {/* Tab 1: Kertas & Offset */}
        {activeTab === 'paper' && (
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-neutral-700">Margin Kiri Head:</span>
                <span className="font-mono font-bold text-neutral-900">{profile.marginLeftMm.toFixed(1)} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.1"
                value={profile.marginLeftMm}
                onChange={(e) => updateSetting('marginLeftMm', parseFloat(e.target.value))}
                className="w-full accent-neutral-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Lebar Stiker:</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.labelWidthMm || 32).toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="40"
                  step="0.5"
                  value={profile.labelWidthMm || 32}
                  onChange={(e) => updateSetting('labelWidthMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Tinggi Stiker:</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.labelHeightMm || 15).toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="25"
                  step="0.5"
                  value={profile.labelHeightMm || 15}
                  onChange={(e) => updateSetting('labelHeightMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Celah Kolom:</span>
                  <span className="font-mono font-bold text-neutral-900">{profile.colGapMm.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.1"
                  value={profile.colGapMm}
                  onChange={(e) => updateSetting('colGapMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Celah Vertikal:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {profile.verticalGapMm.toFixed(1)} mm{' '}
                    <span className="text-[10px] font-normal text-neutral-500">
                      (Pitch: {(profile.labelHeightMm + profile.verticalGapMm).toFixed(1)}mm)
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.1"
                  value={profile.verticalGapMm}
                  onChange={(e) => updateSetting('verticalGapMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
                <p className="text-[10px] text-neutral-600 bg-neutral-100 p-1.5 rounded border border-neutral-300">
                  <b>Catatan Celah:</b> Nilai celah vertikal ini otomatis disinkronkan ke sensor GAP printer saat mode TSPL aktif.
                </p>
              </div>
            </div>

            {/* Offset Horisontal & Vertikal Sumbu X dan Y */}
            <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-2.5 rounded border border-neutral-200">
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-800 font-semibold">X Offset (Geser Kiri/Kanan):</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {(profile.xOffsetMm ?? 0) > 0 ? `+${(profile.xOffsetMm ?? 0).toFixed(1)}` : (profile.xOffsetMm ?? 0).toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={profile.xOffsetMm ?? 0}
                  onChange={(e) => updateSetting('xOffsetMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-800 font-semibold">Y Offset (Geser Atas/Bawah):</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {(profile.yOffsetMm ?? 0) > 0 ? `+${(profile.yOffsetMm ?? 0).toFixed(1)}` : (profile.yOffsetMm ?? 0).toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={profile.yOffsetMm ?? 0}
                  onChange={(e) => updateSetting('yOffsetMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tata Letak & Kepekatan */}
        {activeTab === 'layout' && (
          <div className="space-y-3 text-xs">
            {/* Pilihan Format Kode: QR Code vs Barcode Garis 1D */}
            <div className="space-y-1.5 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center font-medium">
                <span className="text-neutral-800 font-semibold">Format Kode Label:</span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800">
                  {profile.barcodeType === 'barcode1d' ? 'BARCODE GARIS (1D)' : 'QR CODE (2D)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => updateSetting('barcodeType', 'qr')}
                  className={`p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                    profile.barcodeType !== 'barcode1d'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1 text-[11px]">QR Code (2D)</span>
                  <span className={`text-[10px] leading-tight ${profile.barcodeType !== 'barcode1d' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    Kotak di kiri + teks produk & lot di kanan
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('barcodeType', 'barcode1d')}
                  className={`p-2 rounded border text-left flex flex-col gap-1 transition-all ${
                    profile.barcodeType === 'barcode1d'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1 text-[11px]">Barcode Garis (1D)</span>
                  <span className={`text-[10px] leading-tight ${profile.barcodeType === 'barcode1d' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    Code 128 garis batang horizontal di tengah label
                  </span>
                </button>
              </div>
            </div>

            {/* Kecepatan Cetak Printer (Speed IPS) */}
            <div className="space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center font-medium">
                <span className="text-neutral-800 font-semibold">Kecepatan Cetak (Speed):</span>
                <span className="font-mono font-bold text-neutral-900">
                  {profile.speed || 3} ips{' '}
                  <span className="text-[10px] font-normal text-neutral-500">
                    ({(profile.speed || 3) <= 2 ? 'Pelan & Sangat Presisi' : (profile.speed || 3) <= 3.5 ? 'Standar (Direkomendasikan)' : 'Cepat'})
                  </span>
                </span>
              </div>
              <input
                type="range"
                min="1.5"
                max="5"
                step="0.5"
                value={profile.speed || 3}
                onChange={(e) => updateSetting('speed', parseFloat(e.target.value))}
                className="w-full accent-neutral-900"
              />
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { val: 1.5, label: '1.5 ips', desc: 'Sangat Pelan' },
                  { val: 2.0, label: '2.0 ips', desc: 'Pelan' },
                  { val: 3.0, label: '3.0 ips', desc: 'Standar' },
                  { val: 4.0, label: '4.0 ips', desc: 'Cepat' }
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => updateSetting('speed', s.val)}
                    className={`py-1 px-1 rounded text-center border transition-colors ${
                      (profile.speed || 3) === s.val
                        ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="text-[11px] leading-tight font-mono">{s.label}</div>
                    <div className={`text-[9px] leading-tight ${((profile.speed || 3) === s.val) ? 'text-neutral-300' : 'text-neutral-500'}`}>{s.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600 pt-0.5">
                Nilai 2.0 - 3.0 ips ideal untuk stiker kecil 33x15mm agar sensor celah stabil dan garis barcode terbakar sempurna.
              </p>
            </div>

            {/* Jeda Interval Antar Baris (Print Delay) */}
            <div className="space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
              <div className="flex justify-between items-center font-medium">
                <span className="text-neutral-800 font-semibold">Jeda Antar Baris (Interval):</span>
                <span className="font-mono font-bold text-neutral-900">
                  {profile.printIntervalMs || 800} ms{' '}
                  <span className="text-[10px] font-normal text-neutral-500">
                    ({((profile.printIntervalMs || 800) / 1000).toFixed(1)} detik)
                  </span>
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="2500"
                step="50"
                value={profile.printIntervalMs || 800}
                onChange={(e) => updateSetting('printIntervalMs', parseInt(e.target.value, 10))}
                className="w-full accent-neutral-900"
              />
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { val: 100, label: '100 ms', desc: 'Instan' },
                  { val: 400, label: '400 ms', desc: 'Cepat' },
                  { val: 800, label: '800 ms', desc: 'Standar' },
                  { val: 1200, label: '1.2 dtk', desc: 'Aman' }
                ].map((intv) => (
                  <button
                    key={intv.val}
                    type="button"
                    onClick={() => updateSetting('printIntervalMs', intv.val)}
                    className={`py-1 px-1 rounded text-center border transition-colors ${
                      (profile.printIntervalMs || 800) === intv.val
                        ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="text-[11px] leading-tight font-mono">{intv.label}</div>
                    <div className={`text-[9px] leading-tight ${((profile.printIntervalMs || 800) === intv.val) ? 'text-neutral-300' : 'text-neutral-500'}`}>{intv.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600 pt-0.5">
                Waktu jeda tunggu agar motor printer tuntas menarik label dan sensor celah stabil sebelum baris berikutnya dicetak.
              </p>
            </div>

            {/* Kepekatan Cetak (Threshold) */}
            <div className="space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
              <div className="flex justify-between font-medium">
                <span className="text-neutral-800 font-semibold">Kepekatan Cetak (Darkness):</span>
                <span className="font-mono font-bold text-neutral-900">
                  {profile.threshold || 170}{' '}
                  <span className="text-[10px] font-normal text-neutral-500">
                    ({(profile.threshold || 170) >= 165 ? 'Pekat & Tajam' : (profile.threshold || 170) >= 140 ? 'Sedang' : 'Pudar'})
                  </span>
                </span>
              </div>
              <input
                type="range"
                min="110"
                max="220"
                step="5"
                value={profile.threshold || 170}
                onChange={(e) => updateSetting('threshold', parseInt(e.target.value, 10))}
                className="w-full accent-neutral-900"
              />
              <p className="text-[10px] text-neutral-600">
                Nilai 170 mengaktifkan pemanasan penuh head printer sehingga huruf dan QR code hitam pekat dan tidak pudar.
              </p>
            </div>

            {profile.barcodeType !== 'barcode1d' ? (
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Ukuran QR:</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.qrSizeMm || 10.5).toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="13"
                  step="0.5"
                  value={profile.qrSizeMm || 10.5}
                  onChange={(e) => updateSetting('qrSizeMm', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
              </div>
            ) : (
              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="font-semibold text-neutral-800 text-[11px]">Pengaturan Barcode Garis 1D:</div>

                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-neutral-700">Ketebalan Garis (Modul):</span>
                    <span className="font-mono font-bold text-neutral-900">
                      {(profile.barcodeBarWidth || 2)} dots{' '}
                      <span className="text-[10px] font-normal text-neutral-500">
                        ({(profile.barcodeBarWidth || 2) >= 2 ? 'Tebal & Mudah Discan HP' : 'Garis Halus'})
                      </span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.5"
                    value={profile.barcodeBarWidth || 2}
                    onChange={(e) => updateSetting('barcodeBarWidth', parseFloat(e.target.value))}
                    className="w-full accent-neutral-900"
                  />
                  <p className="text-[10px] text-neutral-600">
                    Nilai 2 dots membuat garis hitam tebal dan tegas sehingga kamera HP pegawai langsung cepat membaca barcode.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-neutral-700">Tinggi Garis:</span>
                      <span className="font-mono font-bold text-neutral-900">{profile.barcodeHeight || 44} dots</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="2"
                      value={profile.barcodeHeight || 44}
                      onChange={(e) => updateSetting('barcodeHeight', parseInt(e.target.value, 10))}
                      className="w-full accent-neutral-900"
                    />
                    <div className="flex gap-1 pt-0.5">
                      {[44, 60, 80, 100].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => updateSetting('barcodeHeight', h)}
                          className={`flex-1 py-0.5 text-[10px] rounded border font-mono transition-colors ${
                            (profile.barcodeHeight || 44) === h
                              ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="text-neutral-700">Margin Samping:</span>
                      <span className="font-mono font-bold text-neutral-900">{profile.barcodeQuietZone ?? 6} dots</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      step="1"
                      value={profile.barcodeQuietZone ?? 6}
                      onChange={(e) => updateSetting('barcodeQuietZone', parseInt(e.target.value, 10))}
                      className="w-full accent-neutral-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-neutral-700">Padding Aman:</span>
                <span className="font-mono font-bold text-neutral-900">{(profile.innerPaddingMm || 1.0).toFixed(1)} mm</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={profile.innerPaddingMm || 1.0}
                onChange={(e) => updateSetting('innerPaddingMm', parseFloat(e.target.value))}
                className="w-full accent-neutral-900"
              />
            </div>

            {/* Toggle Garis Bingkai Stiker (Border) */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100/80 transition-colors">
              <div>
                <div className="font-semibold text-neutral-800">Cetak Bingkai Garis Tepi (Border)</div>
                <div className="text-[10px] text-neutral-500">
                  {profile.showBorder
                    ? 'Garis kotak hitam di sekeliling stiker aktif dicetak.'
                    : 'Garis border dinonaktifkan (bersih, hanya mencetak QR Code & teks).'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={profile.showBorder ?? false}
                onClick={() => updateSetting('showBorder', !profile.showBorder)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  profile.showBorder ? 'bg-neutral-900' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    profile.showBorder ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Teks & Font Dinamis */}
        {activeTab === 'typo' && (
          <div className="space-y-3 text-xs">
            {/* Posisi & Perataan Blok Teks */}
            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
              <div className="font-semibold text-neutral-800 text-[11px]">Tata Letak & Posisi Teks:</div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Jarak dari QR (Offset X):</span>
                  <span className="font-mono font-bold text-neutral-900">{profile.textOffsetX ?? 6} dots</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="1"
                  value={profile.textOffsetX ?? 6}
                  onChange={(e) => updateSetting('textOffsetX', parseInt(e.target.value, 10))}
                  className="w-full accent-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Geser Vertikal (Offset Y):</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.textOffsetY ?? 0) > 0 ? `+${profile.textOffsetY}` : profile.textOffsetY ?? 0} dots</span>
                </div>
                <input
                  type="range"
                  min="-8"
                  max="8"
                  step="1"
                  value={profile.textOffsetY ?? 0}
                  onChange={(e) => updateSetting('textOffsetY', parseInt(e.target.value, 10))}
                  className="w-full accent-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-700">Jarak Antar Baris (Line Spacing):</span>
                  <span className="font-mono font-bold text-neutral-900">{profile.textLineSpacing ?? 13} dots</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="18"
                  step="1"
                  value={profile.textLineSpacing ?? 13}
                  onChange={(e) => updateSetting('textLineSpacing', parseInt(e.target.value, 10))}
                  className="w-full accent-neutral-900"
                />
              </div>
            </div>

            {/* Pengaturan Ukuran & Ketebalan per Baris */}
            <div className="space-y-2.5">
              {/* Baris 1: Nomor Lot */}
              <div className="p-2 bg-neutral-50 rounded border border-neutral-200 space-y-1.5">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-neutral-800 font-semibold">1. Nomor Lot:</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.lotFontSize ?? 11).toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="0.5"
                  value={profile.lotFontSize ?? 11}
                  onChange={(e) => updateSetting('lotFontSize', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-600 mr-1">Ketebalan:</span>
                    {[
                      { val: 'normal', label: 'Normal' },
                      { val: 'bold', label: 'Tebal' },
                      { val: '900', label: 'Ekstra' }
                    ].map((w) => (
                      <button
                        key={w.val}
                        type="button"
                        onClick={() => updateSetting('lotFontWeight', w.val)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                          (profile.lotFontWeight || 'bold') === w.val
                            ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-500 mr-0.5">Preset:</span>
                    {[11, 14, 18, 22].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateSetting('lotFontSize', sz)}
                        className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                          Math.round(profile.lotFontSize ?? 11) === sz
                            ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Baris 2: Nama Produk */}
              <div className="p-2 bg-neutral-50 rounded border border-neutral-200 space-y-1.5">
                <div className="flex justify-between items-center font-medium">
                  <span className="text-neutral-800 font-semibold">2. Nama Produk (Align Center):</span>
                  <span className="font-mono font-bold text-neutral-900">{(profile.titleFontSize ?? 11.5).toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="8.5"
                  max="16"
                  step="0.5"
                  value={profile.titleFontSize ?? 11.5}
                  onChange={(e) => updateSetting('titleFontSize', parseFloat(e.target.value))}
                  className="w-full accent-neutral-900"
                />
                <div className="flex items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-neutral-600 mr-1">Ketebalan:</span>
                  {[
                    { val: 'normal', label: 'Normal' },
                    { val: 'bold', label: 'Tebal' },
                    { val: '900', label: 'Ekstra' }
                  ].map((w) => (
                    <button
                      key={w.val}
                      type="button"
                      onClick={() => updateSetting('titleFontWeight', w.val)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        (profile.titleFontWeight || 'bold') === w.val
                          ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Elemen yang Dinonaktifkan */}
              <div className="p-2 bg-neutral-100 rounded border border-neutral-200 text-neutral-600 text-[11px] space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span>Wadah & Berat:</span>
                  <span className="text-neutral-500 font-semibold bg-neutral-200 px-1.5 py-0.5 rounded text-[10px]">Dihilangkan dari Label</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Timestamp & Petugas:</span>
                  <span className="text-neutral-500 font-semibold bg-neutral-200 px-1.5 py-0.5 rounded text-[10px]">Dihilangkan dari Label</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Mode Tes */}
        {activeTab === 'modes' && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { id: 'border', label: 'Bingkai Tepi' },
              { id: 'ruler', label: 'Mistar mm' },
              { id: 'real', label: 'Label Riil' },
              { id: 'drift', label: 'Drift Test' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => updateSetting('testMode', m.id)}
                className={`py-2 px-2.5 rounded border text-left font-medium transition-colors ${
                  profile.testMode === m.id
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-neutral-50 text-neutral-800 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{m.label}</span>
                  {profile.testMode === m.id && <CheckIcon className="w-3.5 h-3.5" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tombol Simpan & Reset */}
        <div className="flex gap-2.5 pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleSaveProfile}
            className="flex-1 min-h-11 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <CheckIcon className="w-4 h-4" />
            <span>Simpan</span>
          </button>
          <button
            type="button"
            onClick={handleResetProfile}
            className="min-h-11 px-5 rounded-xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshIcon className="w-4 h-4 text-neutral-600" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Wipe Database (Masa Development - Khusus PPIC) */}
      <Modal
        isOpen={isWipeModalOpen}
        onClose={() => !isWiping && setIsWipeModalOpen(false)}
        title="Konfirmasi Wipe Database"
        subtitle="Masa Development - Khusus PPIC"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>PERINGATAN: Tindakan Ini Bersifat Permanen!</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-700">
              Tindakan ini akan menghapus permanen seluruh data operasional di server database:
            </p>
            <ul className="list-disc list-inside text-[11px] space-y-1 text-rose-800 font-mono">
              <li>Seluruh QR Lot (Daging, Bumbu, Kulit, Saos, Adonan, Produk Jadi, Tray)</li>
              <li>Seluruh Catatan Riwayat Perpindahan (Custody Logs)</li>
              <li>Seluruh Log Event Scan & Undo</li>
              <li>Log Selisih / Discrepancy & Riwayat Penerimaan Sales Toko</li>
              <li>Rencana produksi harian akan direset ke target awal (40 gilingan)</li>
            </ul>
          </div>

          <p className="text-neutral-600 text-[11px] leading-relaxed">
            Pastikan seluruh pengujian sebelumnya telah dicatat jika diperlukan. Setelah di-wipe, sistem akan bersih kembali ke kondisi awal mula pabrik.
          </p>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
            <button
              type="button"
              disabled={isWiping}
              onClick={() => setIsWipeModalOpen(false)}
              className="flex-1 min-h-11 py-2 px-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isWiping}
              onClick={handleConfirmWipe}
              className="flex-1 min-h-11 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isWiping ? (
                <>
                  <RefreshIcon className="w-4 h-4 animate-spin" />
                  <span>Memproses Wipe...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Wipe Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
