import JsBarcode from 'jsbarcode'

/**
 * Buat elemen canvas in-memory berisi Barcode Garis 1D (Code 128)
 * Mendukung modul garis tebal (2 dot) & Quiet Zone agar mudah dipindai kamera smartphone
 * @param {string} text - Teks kode (misal DG-20261007-011)
 * @param {object} options - { height: 44, width: 2, margin: 6, maxWidth: 248 }
 * @returns {HTMLCanvasElement}
 */
export function createBarcode1DCanvas(text, options = {}) {
  const canvas = document.createElement('canvas')
  const height = Math.round(options.height || 44) // ~5.5 mm @ 203 DPI
  const barWidth = options.width || 2             // Default 2 dot per bar (tebal & ramah sensor kamera HP)
  const margin = options.margin !== undefined ? options.margin : (options.quietZone ?? 6)
  const maxWidth = options.maxWidth || 248        // Lebar batas dalam stiker 33mm fisik

  const cleanText = String(text || '').trim()
  if (!cleanText) return canvas

  try {
    JsBarcode(canvas, cleanText, {
      format: 'CODE128',
      width: barWidth,
      height: height,
      displayValue: false,
      margin: margin,
      background: '#FFFFFF',
      lineColor: '#000000'
    })

    // Jika melebihi lebar stiker fisik, turunkan ketebalan secara proporsional agar tidak terpotong tepi
    if (maxWidth && canvas.width > maxWidth && barWidth > 1) {
      const scale = (maxWidth - margin * 2) / (canvas.width - margin * 2)
      const adjustedWidth = Math.max(1, Math.floor(barWidth * scale * 10) / 10)
      JsBarcode(canvas, cleanText, {
        format: 'CODE128',
        width: adjustedWidth,
        height: height,
        displayValue: false,
        margin: margin,
        background: '#FFFFFF',
        lineColor: '#000000'
      })
    }
  } catch (err) {
    console.warn('Gagal generate Barcode 1D:', err)
  }

  return canvas
}

/**
 * Hitung Modulo 10 Check Digit (Standar EAN / UPC / GS1)
 * @param {string} digits - String angka
 * @returns {number} 0-9
 */
export function calculateEanCheckDigit(digits) {
  const str = String(digits || '').replace(/\D/g, '')
  let sum = 0
  const rev = str.split('').reverse()
  for (let i = 0; i < rev.length; i++) {
    const n = parseInt(rev[i], 10) || 0
    sum += (i % 2 === 0) ? n * 3 : n * 1
  }
  const rem = sum % 10
  return rem === 0 ? 0 : 10 - rem
}

/**
 * Konversi lotCode menjadi Format Angka Supermarket Profesional (1 Line):
 * - Nomor Sistem (1 digit, misal '8')
 * - Kode Manufaktur (5 digit, misal '89102')
 * - Kode Produk (5 digit)
 * - Digit Cek (1 digit)
 *
 * Output: { systemNum, mfgCode, productCode, checkDigit, rawCode, formattedText }
 */
export function getSupermarketBarcodeData(lotCode) {
  const clean = String(lotCode || '').trim().toUpperCase()
  const systemNum = '8'
  const mfgCode = '89102'

  if (!clean) {
    const eleven = `${systemNum}${mfgCode}00000`
    const chk = String(calculateEanCheckDigit(eleven))
    return {
      systemNum,
      mfgCode,
      productCode: '00000',
      checkDigit: chk,
      rawCode: `${eleven}${chk}`,
      formattedText: `${systemNum}  ${mfgCode}  00000  ${chk}`
    }
  }

  // Turunkan 5 digit kode produk secara deterministik & unik dari lotCode
  let productCode
  let prefixNum = 10
  const matchPrefix = clean.match(/^([A-Z]+)/)
  if (matchPrefix) {
    const letters = matchPrefix[1]
    let codeVal = 0
    for (let i = 0; i < letters.length; i++) {
      codeVal += letters.charCodeAt(i)
    }
    prefixNum = 10 + (codeVal % 90) // Rentang 10..99
  }

  const matchSuffix = clean.match(/(\d{1,4})$/)
  if (matchSuffix) {
    const suffixNum = String(parseInt(matchSuffix[1], 10) || 0).padStart(3, '0').slice(-3)
    productCode = `${String(prefixNum).padStart(2, '0').slice(-2)}${suffixNum}`
  } else {
    let hash = 0
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) >>> 0
    }
    productCode = String(hash % 100000).padStart(5, '0')
  }

  const elevenDigits = `${systemNum}${mfgCode}${productCode}`
  const checkDigit = String(calculateEanCheckDigit(elevenDigits))
  const rawCode = `${elevenDigits}${checkDigit}`
  const formattedText = `${systemNum}  ${mfgCode}  ${productCode}  ${checkDigit}`

  return {
    systemNum,
    mfgCode,
    productCode,
    checkDigit,
    rawCode,
    formattedText
  }
}
