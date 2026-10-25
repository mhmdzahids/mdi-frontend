/**
 * Utility untuk konversi Canvas HTML5 ke format TSPL (TSC Printer Language)
 * Khusus Printer Thermal Label Bluetooth 80mm / 2-Line Stickers (33x15mm)
 * Mendukung Auto-Backfeed, GAP Detection, dan Tear-off Mode persis OpenLabel
 */

import { DEFAULT_CALIBRATION } from './escposRaster'

/**
 * Konversi Canvas HTML5 menjadi Uint8Array byte TSPL
 * @param {HTMLCanvasElement} canvas
 * @param {Object} options
 * @returns {Uint8Array}
 */
export function canvasToTsplRaster(canvas, options = {}) {
  const width = canvas.width || 576
  const height = canvas.height || 120 // 15mm @ 203 DPI = 120 dots

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  const threshold = options.threshold ?? DEFAULT_CALIBRATION.threshold ?? 170
  const invert = options.invert ?? false

  const labelHeightMm = options.labelHeightMm ?? DEFAULT_CALIBRATION.labelHeightMm ?? 15.0
  const paperWidthMm = options.paperWidthMm ?? DEFAULT_CALIBRATION.paperWidthMm ?? 70.0
  const gapMm = options.verticalGapMm ?? options.labelGapMm ?? DEFAULT_CALIBRATION.verticalGapMm ?? 2.0
  const speed = options.speed ?? 3 // Medium (3 ips)
  const density = options.density ?? 8 // Darkness 3 (~8 dari 15)
  const direction = options.direction ?? 0 // Direction 0: Orientasi normal tegak lurus (tidak terbalik)
  const isContinuation = options.isContinuation ?? false

  // Lebar per baris dalam byte (576 dots / 8 = 72 bytes)
  const bytesPerLine = Math.ceil(width / 8)
  const imageBytes = bytesPerLine * height

  // 1. Header instruksi TSPL dalam format teks ASCII
  // Jika baris lanjutan dalam batch yang sama: tidak perlu kirim ulang SIZE, GAP, & SET TEAR agar tidak menimpa spooler
  const headerCommands = isContinuation
    ? [
        `CLS`,
        `BITMAP 0,0,${bytesPerLine},${height},0,`
      ].join('\r\n')
    : [
        `SIZE ${Math.round(paperWidthMm)} mm, ${Math.round(labelHeightMm)} mm`,
        `GAP ${Math.round(gapMm)} mm, 0 mm`,
        `SPEED ${speed}`,
        `DENSITY ${density}`,
        `SET TEAR ON`,
        `DIRECTION ${direction}`,
        `REFERENCE 0,0`,
        `CLS`,
        `BITMAP 0,0,${bytesPerLine},${height},0,`
      ].join('\r\n')

  const encoder = new TextEncoder()
  const headerBytes = encoder.encode(headerCommands)

  // 2. Data Citra Biner (Monochrome Bitmap)
  // Catatan polaritas TSPL: 0 = Titik Hitam (Cetak), 1 = Titik Putih (Kosong)
  const rawBitmap = new Uint8Array(imageBytes)

  for (let y = 0; y < height; y++) {
    for (let b = 0; b < bytesPerLine; b++) {
      let byteVal = 0xFF // Default semua bit 1 (putih)
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit
        if (x < width) {
          const pixelIdx = (y * width + x) * 4
          const r = data[pixelIdx]
          const g = data[pixelIdx + 1]
          const bCol = data[pixelIdx + 2]
          const a = data[pixelIdx + 3]

          let luminance = 255
          if (a >= 32) {
            luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * bCol)
          }

          let isBlack = luminance < threshold
          if (invert) isBlack = !isBlack

          if (isBlack) {
            // Bersihkan bit menjadi 0 untuk titik cetak hitam di TSPL
            byteVal &= ~(1 << (7 - bit))
          }
        }
      }
      rawBitmap[y * bytesPerLine + b] = byteVal
    }
  }

  // 3. Footer instruksi TSPL: Pemicu Cetak 1 Set Label
  const footerCommands = `\r\nPRINT 1,1\r\n`
  const footerBytes = encoder.encode(footerCommands)

  // Gabungkan seluruh buffer menjadi satu paket biner
  const totalLength = headerBytes.length + rawBitmap.length + footerBytes.length
  const buffer = new Uint8Array(totalLength)
  buffer.set(headerBytes, 0)
  buffer.set(rawBitmap, headerBytes.length)
  buffer.set(footerBytes, headerBytes.length + rawBitmap.length)

  return buffer
}

/**
 * Perintah TSPL FORMFEED untuk maju ke celah label berikutnya
 * @returns {Uint8Array}
 */
export function createTsplFormFeedCommand() {
  return new TextEncoder().encode('FORMFEED\r\n')
}
