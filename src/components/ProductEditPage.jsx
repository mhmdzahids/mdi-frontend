import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, Camera, Trash2, Lock, ChevronDown, ChevronUp, Package, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useProduction1Store } from '../store/production1Store'
import { canAccess } from '../utils/rbac'
import ImageCropperModal from './ui/ImageCropperModal'

function formatRupiahInput(val) {
  if (val === null || val === undefined || val === '') return ''
  const numStr = String(val).replace(/\D/g, '')
  if (!numStr) return ''
  return new Intl.NumberFormat('id-ID').format(parseInt(numStr, 10))
}

function parseRupiahInput(str) {
  if (!str) return null
  const numStr = String(str).replace(/\D/g, '')
  if (!numStr) return null
  return parseInt(numStr, 10)
}

export default function ProductEditPage({ productId, onClose }) {
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const catalogProducts = useProduction1Store((s) => s.catalogProducts) || []
  const saveCatalogProduct = useProduction1Store((s) => s.saveCatalogProduct)
  const uploadProductImage = useProduction1Store((s) => s.uploadProductImage)
  const deleteProductImage = useProduction1Store((s) => s.deleteProductImage)
  const setActionFeedback = useProduction1Store((s) => s.setActionFeedback)

  const product = catalogProducts.find((p) => p.id === productId)

  // Hak akses RBAC
  const canViewPrice = canAccess('freezer_sales:view_price', currentUser, isDevMode)
  const canEditPrice = canAccess('freezer_sales:edit_price', currentUser, isDevMode)

  // Form State
  const [name, setName] = useState(product?.name || '')
  const [priceStr, setPriceStr] = useState(formatRupiahInput(product?.price))
  const [spec, setSpec] = useState(product?.spec || '')
  const [description, setDescription] = useState(product?.description || '')
  const [isActive, setIsActive] = useState(Boolean(product?.is_active ?? product?.isDisplayActive))
  const [isDescOpen, setIsDescOpen] = useState(Boolean(product?.description?.trim()))

  // Image Upload & Crop State
  const [imagePreviewUrl, setImagePreviewUrl] = useState(product?.image_url || null)
  const [stagedImageBlob, setStagedImageBlob] = useState(null)
  const [shouldDeleteImage, setShouldDeleteImage] = useState(false)
  const [cropperRawSrc, setCropperRawSrc] = useState(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)

  // Error & Status State
  const [nameError, setNameError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  const fileInputRef = useRef(null)

  // Baseline untuk Unsaved Changes Guard
  const baseline = useMemo(() => {
    return {
      name: product?.name || '',
      price: product?.price ?? null,
      spec: product?.spec || '',
      description: product?.description || '',
      isActive: Boolean(product?.is_active ?? product?.isDisplayActive),
      image_url: product?.image_url || null
    }
  }, [product])

  // Deteksi perubahan (isDirty)
  const isDirty = useMemo(() => {
    const currentPrice = parseRupiahInput(priceStr)
    const nameChanged = name.trim() !== baseline.name
    const priceChanged = canEditPrice && currentPrice !== baseline.price
    const specChanged = spec.trim() !== baseline.spec
    const descChanged = description.trim() !== baseline.description
    const activeChanged = isActive !== baseline.isActive
    const imageChanged = stagedImageBlob !== null || shouldDeleteImage

    return nameChanged || priceChanged || specChanged || descChanged || activeChanged || imageChanged
  }, [name, priceStr, spec, description, isActive, stagedImageBlob, shouldDeleteImage, baseline, canEditPrice])

  // Browser back button / popstate handler
  useEffect(() => {
    window.history.pushState({ productFormOpen: true }, '')
    const handlePopState = () => {
      if (isDirty) {
        setShowDiscardDialog(true)
      } else {
        onClose()
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isDirty, onClose])

  const handleBackClick = () => {
    if (isDirty) {
      setShowDiscardDialog(true)
    } else {
      onClose()
    }
  }

  // File Picker Trigger
  const handleSelectFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran asal maks 8 MB
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file foto maksimal 8 MB.')
      e.target.value = ''
      return
    }

    // Validasi tipe
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Format foto harus JPG, PNG, atau WebP.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setCropperRawSrc(event.target?.result)
      setIsCropperOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Handle hasil crop dari modal
  const handleCropComplete = (blob) => {
    setStagedImageBlob(blob)
    setShouldDeleteImage(false)
    const localUrl = URL.createObjectURL(blob)
    setImagePreviewUrl(localUrl)
  }

  const handleRemovePhoto = () => {
    setStagedImageBlob(null)
    setShouldDeleteImage(true)
    setImagePreviewUrl(null)
  }

  const handlePriceChange = (e) => {
    if (!canEditPrice) return
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      setPriceStr('')
      return
    }
    setPriceStr(formatRupiahInput(raw))
  }

  const currentPriceNumeric = parseRupiahInput(priceStr)
  const isPriceEmpty = !currentPriceNumeric || currentPriceNumeric <= 0

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')

    if (!name.trim()) {
      setNameError('Nama produk wajib diisi')
      return
    }

    // Validasi produk aktif harus punya harga
    if (isActive && isPriceEmpty) {
      setErrorMessage('Produk tanpa harga tidak dapat diaktifkan. Harap isi harga terlebih dahulu.')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Simpan foto jika ada perubahan
      if (shouldDeleteImage && product?.image_url) {
        await deleteProductImage(productId)
      } else if (stagedImageBlob) {
        await uploadProductImage(productId, stagedImageBlob)
      }

      // 2. Simpan data produk
      const updates = {
        name: name.trim(),
        spec: spec.trim() || null,
        description: description.trim() || null,
        is_active: isActive
      }
      if (canEditPrice) {
        updates.price = currentPriceNumeric
      }

      await saveCatalogProduct(productId, updates)
      setActionFeedback({ type: 'success', message: 'Data produk berhasil disimpan.' })
      onClose()
    } catch (err) {
      setErrorMessage(err.message || 'Gagal menyimpan data produk.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex flex-col min-h-screen min-h-[100dvh] bg-[var(--canvas)] select-text relative">
      {/* Header Halaman Khusus: Tombol Kembali (←) + Judul Pendek */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#EDE8DF] px-3.5 py-2 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBackClick}
            aria-label="Kembali"
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-[#2C3E50] hover:bg-[#F5F1EB] active:bg-[#EDE8DF] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h1 className="text-base font-bold text-[#2C3E50]">
            Edit Produk
          </h1>
        </div>
      </header>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Single Scroll Area */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4 pb-36">
        {/* 1. FOTO PRODUK (Preview Persegi Besar 160x160 di Tengah) */}
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
          <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-2 border-[#EDE8DF] bg-[#F5F1EB] flex items-center justify-center shadow-xs">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt={name || 'Preview Produk'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#8C9BA8] space-y-1">
                <Package className="w-12 h-12 stroke-[1.5]" />
                <span className="text-[11px] font-medium">Belum ada foto</span>
              </div>
            )}
          </div>

          {/* Tombol Ubah / Hapus Foto */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleSelectFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-3.5 py-1.5 bg-[#EEF5F9] hover:bg-[#D1E4EF] active:bg-[#BCE3CF] text-[#3A6B80] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>{imagePreviewUrl ? 'Ganti Foto' : 'Pilih Foto'}</span>
            </button>

            {imagePreviewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="min-h-[40px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>
          <span className="text-[10px] text-[#8C9BA8]">
            Rasio 1:1 persegi, maks 8 MB (JPG, PNG, WebP)
          </span>
        </div>

        {/* 2. NAMA PRODUK */}
        <div>
          <label htmlFor="field-product-name" className="text-xs font-bold text-[#2C3E50] block mb-1.5">
            Nama Produk
          </label>
          <input
            id="field-product-name"
            type="text"
            required
            autoCapitalize="words"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            placeholder="Contoh: Dimsum Mika"
            className={`w-full min-h-[48px] h-12 px-3.5 bg-white border rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
              nameError
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
            }`}
          />
          {nameError && (
            <p className="text-xs text-red-600 mt-1 font-medium">{nameError}</p>
          )}
        </div>

        {/* 3. HARGA (RP) - DIKENDALIKAN RBAC */}
        {canViewPrice && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="field-product-price" className="text-xs font-bold text-[#2C3E50] flex items-center gap-1.5">
                <span>Harga (Rp)</span>
                {!canEditPrice && <Lock className="w-3.5 h-3.5 text-[#8C9BA8]" />}
              </label>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7B8D]">
                Rp
              </span>
              <input
                id="field-product-price"
                type="text"
                inputMode="numeric"
                disabled={!canEditPrice}
                value={priceStr}
                onChange={handlePriceChange}
                placeholder="45.000"
                className={`w-full min-h-[48px] h-12 pl-11 pr-3.5 bg-white border rounded-xl text-base font-bold tabular-nums text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                  !canEditPrice
                    ? 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF] cursor-not-allowed opacity-90'
                    : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
                }`}
              />
            </div>

            {!canEditPrice && (
              <p className="text-[11px] text-[#8C9BA8] mt-1.5 flex items-center gap-1">
                <span>Hanya Super Admin / peran berizin yang dapat mengubah harga.</span>
              </p>
            )}
          </div>
        )}

        {/* 4. ISI PER KEMASAN (SPEC) */}
        <div>
          <label htmlFor="field-product-spec" className="text-xs font-bold text-[#2C3E50] block mb-1.5">
            Isi per kemasan
          </label>
          <input
            id="field-product-spec"
            type="text"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Contoh: 50 Pcs / Mika"
            className="w-full min-h-[48px] h-12 px-3.5 bg-white border border-[#EDE8DF] rounded-xl text-base text-[#2C3E50] placeholder-[#94A3B8] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80] focus:outline-none transition-colors"
          />
        </div>

        {/* 5. DESKRIPSI (COLLAPSIBLE ACCORDION) */}
        <div className="bg-white border border-[#EDE8DF] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsDescOpen(!isDescOpen)}
            className="w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-[#2C3E50] hover:bg-[#F5F1EB] cursor-pointer transition-colors"
          >
            <span>Deskripsi {description ? '(Terisi)' : '(Opsional)'}</span>
            {isDescOpen ? (
              <ChevronUp className="w-4 h-4 text-[#6B7B8D]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#6B7B8D]" />
            )}
          </button>

          {isDescOpen && (
            <div className="p-4 pt-1 border-t border-[#EDE8DF]">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan lengkap bahan baku, cara saji, atau standar penyimpanan..."
                className="w-full p-3 bg-white border border-[#EDE8DF] rounded-xl text-xs text-[#2C3E50] placeholder-[#94A3B8] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80] focus:outline-none resize-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* 6. SWITCH STATUS PRODUK AKTIF */}
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#2C3E50] block">Status Produk</span>
            <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
              {isActive ? 'Tampil aktif di katalog POS' : 'Disembunyikan dari penjualan'}
            </span>
            {isPriceEmpty && (
              <span className="text-[11px] text-amber-700 font-medium block mt-1">
                Isi harga dulu untuk mengaktifkan
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isPriceEmpty}
            onClick={() => setIsActive(!isActive)}
            className={`min-h-[44px] min-w-[70px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              isPriceEmpty
                ? 'bg-[#EDE8DF] text-[#8C9BA8] cursor-not-allowed opacity-60'
                : isActive
                ? 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] cursor-pointer'
                : 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer'
            }`}
          >
            {isActive ? 'Aktif' : 'Nonaktif'}
          </button>
        </div>
      </form>

      {/* Sticky Action Bar di Bawah: Satu Tombol Simpan */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-xl lg:max-w-2xl mx-auto bg-white border-t border-[#EDE8DF] p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] z-20 shadow-lg">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !isDirty || !name.trim() || (isActive && isPriceEmpty)}
          className="min-h-[48px] h-12 w-full bg-[#3A6B80] hover:bg-[#2D5566] disabled:bg-[#94A3B8] active:bg-[#1E3B47] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <span>Simpan</span>
          )}
        </button>
      </div>

      {/* Modal Crop Gambar 1:1 */}
      {isCropperOpen && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          imageSrc={cropperRawSrc}
          onClose={() => {
            setIsCropperOpen(false)
            setCropperRawSrc(null)
          }}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* DIALOG: Guard Perubahan Belum Disimpan */}
      <AnimatePresence>
        {showDiscardDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-lg space-y-4 text-center"
            >
              <h3 className="text-sm font-bold text-[#2C3E50]">Buang perubahan?</h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardDialog(false)
                    onClose()
                  }}
                  className="min-h-[44px] bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Buang
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardDialog(false)}
                  className="min-h-[44px] bg-[#3A6B80] hover:bg-[#2D5566] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  Lanjut
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
