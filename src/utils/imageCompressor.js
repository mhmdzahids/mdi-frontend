/**
 * Utility kompresi gambar client-side via HTML Canvas.
 * Mengompresi file kamera mentah (bisa 5-10MB) menjadi JPEG resolusi proporsional (~100-200KB).
 */
export async function compressImage(file, maxDimension = 1024, quality = 0.7) {
  if (!file) return null

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file foto'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Format foto tidak valid'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
