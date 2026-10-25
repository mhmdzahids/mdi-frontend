/**
 * Utility untuk konversi Canvas ke format ESC/POS Raster Monochrome (GS v 0)
 * Khusus Printer Thermal POS 80mm (203 DPI, 576 dots per line)
 */

export const DEFAULT_CALIBRATION = {
  dotsPerMm: 8,             // 203.2 DPI / 25.4 = 8.0 dots/mm
  headDots: 576,            // Area cetak efektif head 80mm = 72mm = 576 dots
  paperWidthMm: 70,         // Lebar backing stiker (~70 mm)
  labelWidthMm: 33.0,       // Lebar 1 stiker fisik (33 mm)
  labelHeightMm: 15.0,      // Tinggi 1 stiker fisik (15 mm)
  colGapMm: 2.0,            // Celah horisontal antar kolom 1 dan kolom 2 (2 mm)
  marginLeftMm: 0.0,        // Margin kiri dasar (0 mm)
  xOffsetMm: 0.0,           // Offset horizontal X (0.0 mm, negatif geser kiri, positif geser kanan)
  yOffsetMm: 0.0,           // Offset vertikal Y (0.0 mm, negatif geser atas, positif geser bawah)
  verticalGapMm: 2.0,       // Celah vertikal antar baris / gap (2 mm)
  offsetYMm: 0,             // Fine-tuning offset vertikal (mm)
  col1OffsetX: 0,           // Nudge horizontal kolom kiri (dots)
  col1OffsetY: 0,           // Nudge vertikal kolom kiri (dots)
  col2OffsetX: 0,           // Nudge horizontal kolom kanan (dots)
  col2OffsetY: 0,           // Nudge vertikal kolom kanan (dots)
  innerPaddingMm: 1.0,      // Batas aman dalam stiker agar tidak mepet tepi
  qrSizeMm: 10.5,           // Ukuran QR code (10.5 x 10.5 mm)
  titleFontSizePt: 8.0,     // Ukuran font judul/Lot
  detailFontSizePt: 6.5,    // Ukuran font subtext
  threshold: 170,           // Ambang batas binarisasi optimal
  invert: false,
  showBorder: false,        // Cetak garis bingkai luar stiker
  barcodeType: 'qr',        // 'qr' | 'barcode1d'
  testMode: 'real',         // 'border' | 'ruler' | 'real' | 'drift'
  printerProtocol: 'TSPL',  // 'TSPL' (Default, Auto-Backfeed) | 'ESCPOS'
  speed: 3,                 // Speed Medium (3 ips)
  darkness: 3,              // Darkness 3 (DENSITY 8)
  printIntervalMs: 800,     // Jeda waktu antar-baris stiker (ms)

  // Tipografi Teks Dinamis Label
  textOffsetX: 6,           // Jarak horizontal teks dari sisi kanan QR code (dots)
  textOffsetY: 0,           // Offset vertikal seluruh blok teks (dots)
  textLineSpacing: 13,      // Jarak vertikal antar baris teks (dots)
  lotFontSize: 11.0,        // Ukuran font Nomor Lot (px)
  lotFontWeight: 'bold',    // 'normal' | 'bold' | '900'
  titleFontSize: 11.5,      // Ukuran font Nama Produk (px)
  titleFontWeight: 'bold',  // 'normal' | 'bold' | '900'
  detailFontSize: 9.5,      // Ukuran font Wadah & Berat (px)
  detailFontWeight: 'bold', // 'normal' | 'bold' | '900'
  subtextFontSize: 8.5,     // Ukuran font Timestamp & Petugas (px)
  subtextFontWeight: 'bold',// 'normal' | 'bold' | '900'

  // Pengaturan Barcode Garis 1D Ramah Kamera Smartphone
  barcodeBarWidth: 2,       // Ketebalan garis barcode (dots per modul: 1, 1.5, 2, 2.5)
  barcodeHeight: 44,        // Tinggi batang barcode (dots)
  barcodeQuietZone: 6,      // Margin putih kiri & kanan barcode (dots)

  // Mock Data untuk Test Cetak
  leftLot: 'DG-20261004-001',
  leftTitle: 'DAGING AYAM HULU',
  leftDetail: 'Wadah #1 | 15.00 kg',
  leftTime: '04-10-2026 14:30',
  rightLot: 'DG-20261004-002',
  rightTitle: 'DAGING AYAM HULU',
  rightDetail: 'Wadah #2 | 15.00 kg',
  rightTime: '04-10-2026 14:31',
  driftRows: 5              // Jumlah baris untuk tes drift kumulatif
}

const STORAGE_KEY = 'thermal_label_calibration_profile_v5'

export function loadCalibrationProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('thermal_label_calibration_profile_v4') || localStorage.getItem('thermal_label_calibration_profile_v3') || localStorage.getItem('thermal_label_calibration_profile_v2')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...DEFAULT_CALIBRATION,
        ...parsed,
        paperWidthMm: Number(parsed.paperWidthMm ?? DEFAULT_CALIBRATION.paperWidthMm),
        labelWidthMm: Number(parsed.labelWidthMm ?? DEFAULT_CALIBRATION.labelWidthMm),
        labelHeightMm: Number(parsed.labelHeightMm ?? DEFAULT_CALIBRATION.labelHeightMm),
        marginLeftMm: Number(parsed.marginLeftMm ?? DEFAULT_CALIBRATION.marginLeftMm),
        xOffsetMm: Number(parsed.xOffsetMm ?? DEFAULT_CALIBRATION.xOffsetMm),
        yOffsetMm: Number(parsed.yOffsetMm ?? DEFAULT_CALIBRATION.yOffsetMm),
        colGapMm: Number(parsed.colGapMm ?? DEFAULT_CALIBRATION.colGapMm),
        verticalGapMm: Number(parsed.verticalGapMm ?? DEFAULT_CALIBRATION.verticalGapMm),
        offsetYMm: Number(parsed.offsetYMm ?? DEFAULT_CALIBRATION.offsetYMm),
        col1OffsetX: Number(parsed.col1OffsetX ?? 0),
        col1OffsetY: Number(parsed.col1OffsetY ?? 0),
        col2OffsetX: Number(parsed.col2OffsetX ?? 0),
        col2OffsetY: Number(parsed.col2OffsetY ?? 0),
        innerPaddingMm: Number(parsed.innerPaddingMm ?? DEFAULT_CALIBRATION.innerPaddingMm),
        qrSizeMm: Number(parsed.qrSizeMm ?? DEFAULT_CALIBRATION.qrSizeMm),
        threshold: Number(parsed.threshold ?? DEFAULT_CALIBRATION.threshold),
        showBorder: Boolean(parsed.showBorder ?? DEFAULT_CALIBRATION.showBorder),
        barcodeType: parsed.barcodeType === 'barcode1d' ? 'barcode1d' : 'qr',
        printerProtocol: parsed.printerProtocol || DEFAULT_CALIBRATION.printerProtocol,
        speed: Math.max(1, Math.min(6, Number(parsed.speed ?? DEFAULT_CALIBRATION.speed))),
        darkness: Number(parsed.darkness ?? DEFAULT_CALIBRATION.darkness),
        printIntervalMs: Math.max(50, Math.min(5000, Number(parsed.printIntervalMs ?? DEFAULT_CALIBRATION.printIntervalMs))),
        testMode: parsed.testMode || DEFAULT_CALIBRATION.testMode,
        textOffsetX: Number(parsed.textOffsetX ?? DEFAULT_CALIBRATION.textOffsetX),
        textOffsetY: Number(parsed.textOffsetY ?? DEFAULT_CALIBRATION.textOffsetY),
        textLineSpacing: Number(parsed.textLineSpacing ?? DEFAULT_CALIBRATION.textLineSpacing),
        lotFontSize: Number(parsed.lotFontSize ?? DEFAULT_CALIBRATION.lotFontSize),
        lotFontWeight: parsed.lotFontWeight || DEFAULT_CALIBRATION.lotFontWeight,
        titleFontSize: Number(parsed.titleFontSize ?? DEFAULT_CALIBRATION.titleFontSize),
        titleFontWeight: parsed.titleFontWeight || DEFAULT_CALIBRATION.titleFontWeight,
        detailFontSize: Number(parsed.detailFontSize ?? DEFAULT_CALIBRATION.detailFontSize),
        detailFontWeight: parsed.detailFontWeight || DEFAULT_CALIBRATION.detailFontWeight,
        subtextFontSize: Number(parsed.subtextFontSize ?? DEFAULT_CALIBRATION.subtextFontSize),
        subtextFontWeight: parsed.subtextFontWeight || DEFAULT_CALIBRATION.subtextFontWeight,
        barcodeBarWidth: Number(parsed.barcodeBarWidth ?? DEFAULT_CALIBRATION.barcodeBarWidth),
        barcodeHeight: Number(parsed.barcodeHeight ?? DEFAULT_CALIBRATION.barcodeHeight),
        barcodeQuietZone: Number(parsed.barcodeQuietZone ?? DEFAULT_CALIBRATION.barcodeQuietZone)
      }
    }
  } catch (err) {
    console.warn('Gagal memuat profil kalibrasi dari localStorage:', err)
  }
  return { ...DEFAULT_CALIBRATION }
}

export function saveCalibrationProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    return true
  } catch (err) {
    console.error('Gagal menyimpan profil kalibrasi:', err)
    return false
  }
}

/**
 * Konversi Canvas HTML5 menjadi Uint8Array byte ESC/POS perintah GS v 0 (Raster Bit Image)
 * @param {HTMLCanvasElement} canvas 
 * @param {Object} options 
 * @returns {Uint8Array}
 */
export function canvasToEscPosRaster(canvas, options = {}) {
  const width = canvas.width // Harusnya 576 dots
  const height = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  const threshold = options.threshold ?? 200
  const invert = options.invert ?? false

  // Lebar per baris dalam byte (576 / 8 = 72 bytes)
  const bytesPerLine = Math.ceil(width / 8)
  const imageBytes = bytesPerLine * height

  // Perintah ESC/POS Murni & Universal untuk Blueprint ECO80BT:
  // 1. ESC @ (0x1B 0x40): Inisialisasi printer
  // 2. ESC E 1 (0x1B 0x45 0x01): Emphasized mode ON (Pemanasan lebih tebal & pekat)
  // 3. ESC G 1 (0x1B 0x47 0x01): Double-strike mode ON (Panas ganda pada head)
  // 4. ESC 3 0 (0x1B 0x33 0x00): Line spacing 0 dots (agar rapat)
  // 5. GS v 0 0 xL xH yL yH (0x1D 0x76 0x30 0x00): Cetak citra raster mode normal
  // 6. Data bit raster (1 bit per dot: 1 = hitam, 0 = putih)
  // 7. 0x0A (Line feed): Trigger flush buffer ke print head motor
  // 8. ESC 2 (0x1B 0x32): Reset line spacing

  const header = [
    0x1B, 0x40,             // ESC @: Init
    0x1B, 0x45, 0x01,       // ESC E 1: Emphasized ON
    0x1B, 0x47, 0x01,       // ESC G 1: Double-strike ON
    0x1B, 0x33, 0x00,       // ESC 3 0: Line space 0
    0x1D, 0x76, 0x30, 0x00, // GS v 0 m (m=0: normal 203 DPI)
    bytesPerLine & 0xFF,
    (bytesPerLine >> 8) & 0xFF,
    height & 0xFF,
    (height >> 8) & 0xFF
  ]

  const footer = [
    0x0A,                   // 0x0A (Line Feed): Wajib untuk memicu flush memori raster ke motor cetak
    0x1B, 0x45, 0x00,       // ESC E 0: Emphasized OFF
    0x1B, 0x47, 0x00,       // ESC G 0: Double-strike OFF
    0x1B, 0x32              // ESC 2: Kembalikan line spacing default
  ]

  const totalLength = header.length + imageBytes + footer.length
  const buffer = new Uint8Array(totalLength)

  // Salin header
  buffer.set(header, 0)

  let destOffset = header.length

  // Konversi RGBA ke 1-bit per dot (MSB di kiri)
  for (let y = 0; y < height; y++) {
    for (let b = 0; b < bytesPerLine; b++) {
      let byteVal = 0
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit
        if (x < width) {
          const pixelIdx = (y * width + x) * 4
          const r = data[pixelIdx]
          const g = data[pixelIdx + 1]
          const bVal = data[pixelIdx + 2]
          const a = data[pixelIdx + 3]

          // Hitung grayscale luminance (standar ITU-R BT.601)
          let isBlack = false
          if (a > 50) {
            const lum = 0.299 * r + 0.587 * g + 0.114 * bVal
            isBlack = lum < threshold
          }

          if (invert) {
            isBlack = !isBlack
          }

          if (isBlack) {
            byteVal |= (1 << (7 - bit))
          }
        }
      }
      buffer[destOffset++] = byteVal
    }
  }

  // Salin footer
  buffer.set(footer, destOffset)

  return buffer
}

/**
 * Download data binary sebagai file .bin / .prn untuk debug
 */
export function downloadBinaryFile(uint8Array, filename = 'label_test_escpos.bin') {
  const blob = new Blob([uint8Array], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Konversi Uint8Array ke Base64 String
 */
export function uint8ArrayToBase64(bytes) {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}
