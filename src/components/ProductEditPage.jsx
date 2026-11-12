import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, Camera, Trash2, Lock, ChevronDown, ChevronUp, Package, AlertTriangle, Tag, Sparkles, Percent, Globe } from 'lucide-react'
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
  const deleteCatalogProduct = useProduction1Store((s) => s.deleteCatalogProduct)
  const uploadProductImage = useProduction1Store((s) => s.uploadProductImage)
  const deleteProductImage = useProduction1Store((s) => s.deleteProductImage)
  const setActionFeedback = useProduction1Store((s) => s.setActionFeedback)

  const product = catalogProducts.find((p) => p.id === productId)

  // Hak akses RBAC
  const canViewPrice = canAccess('freezer_sales:view_price', currentUser, isDevMode)
  const canEditPrice = canAccess('freezer_sales:edit_price', currentUser, isDevMode)
  const canDeleteProduct = canAccess('freezer_sales:delete', currentUser, isDevMode)

  // Form State
  const [name, setName] = useState(product?.name || '')
  const [priceStr, setPriceStr] = useState(formatRupiahInput(product?.price))
  const [spec, setSpec] = useState(product?.spec || '')
  const [description, setDescription] = useState(product?.description || '')
  const [isActive, setIsActive] = useState(Boolean(product?.is_active ?? product?.isDisplayActive))
  const [isDescOpen, setIsDescOpen] = useState(Boolean(product?.description?.trim()))

  // Sistem Diskon & Stok Online State
  const [isDiscount, setIsDiscount] = useState(Boolean(product?.is_discount))
  const [originalPriceStr, setOriginalPriceStr] = useState(
    formatRupiahInput(product?.original_price || product?.price || '')
  )
  const [discountPercent, setDiscountPercent] = useState(product?.discount_percent || 0)
  const [stockOnline, setStockOnline] = useState(product?.stock_online != null ? product.stock_online : 0)

  // Image Upload & Crop State
  const [imagePreviewUrl, setImagePreviewUrl] = useState(product?.image_url || null)
  const [stagedImageBlob, setStagedImageBlob] = useState(null)
  const [shouldDeleteImage, setShouldDeleteImage] = useState(false)
  const [cropperRawSrc, setCropperRawSrc] = useState(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)

  // Error & Dialog State
  const [nameError, setNameError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const fileInputRef = useRef(null)

  // Baseline untuk Unsaved Changes Guard
  const baseline = useMemo(() => {
    return {
      name: product?.name || '',
      price: product?.price ?? null,
      original_price: product?.original_price ?? null,
      is_discount: Boolean(product?.is_discount),
      discount_percent: product?.discount_percent || 0,
      stock_online: product?.stock_online ?? 0,
      spec: product?.spec || '',
      description: product?.description || '',
      isActive: Boolean(product?.is_active ?? product?.isDisplayActive),
      image_url: product?.image_url || null
    }
  }, [product])

  // Deteksi perubahan (isDirty)
  const isDirty = useMemo(() => {
    const currentPrice = parseRupiahInput(priceStr)
    const currentOrig = parseRupiahInput(originalPriceStr)
    const nameChanged = name.trim() !== baseline.name
    const priceChanged = canEditPrice && currentPrice !== baseline.price
    const origPriceChanged = canEditPrice && currentOrig !== baseline.original_price
    const discountChanged = canEditPrice && (isDiscount !== baseline.is_discount || discountPercent !== baseline.discount_percent)
    const stockOnlineChanged = canEditPrice && stockOnline !== baseline.stock_online
    const specChanged = spec.trim() !== baseline.spec
    const descChanged = description.trim() !== baseline.description
    const activeChanged = isActive !== baseline.isActive
    const imageChanged = stagedImageBlob !== null || shouldDeleteImage

    return (
      nameChanged ||
      priceChanged ||
      origPriceChanged ||
      discountChanged ||
      stockOnlineChanged ||
      specChanged ||
      descChanged ||
      activeChanged ||
      imageChanged
    )
  }, [
    name,
    priceStr,
    originalPriceStr,
    isDiscount,
    discountPercent,
    stockOnline,
    spec,
    description,
    isActive,
    stagedImageBlob,
    shouldDeleteImage,
    baseline,
    canEditPrice
  ])

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

    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file foto maksimal 8 MB.')
      e.target.value = ''
      return
    }

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
      if (!isDiscount) setOriginalPriceStr('')
      return
    }
    const val = formatRupiahInput(raw)
    setPriceStr(val)
    if (!isDiscount) {
      setOriginalPriceStr(val)
    }
  }

  const handleOriginalPriceChange = (e) => {
    if (!canEditPrice) return
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      setOriginalPriceStr('')
      return
    }
    const val = formatRupiahInput(raw)
    setOriginalPriceStr(val)
    // Recalculate selling price if discount is active
    const num = parseInt(raw, 10)
    if (isDiscount && discountPercent > 0) {
      const discounted = Math.round(num * (1 - discountPercent / 100))
      setPriceStr(formatRupiahInput(discounted))
    }
  }

  const handleDiscountPercentChange = (pct) => {
    const val = Math.min(100, Math.max(0, parseInt(pct, 10) || 0))
    setDiscountPercent(val)
    const origNum = parseRupiahInput(originalPriceStr)
    if (origNum && val > 0) {
      const discounted = Math.round(origNum * (1 - val / 100))
      setPriceStr(formatRupiahInput(discounted))
    } else if (origNum) {
      setPriceStr(formatRupiahInput(origNum))
    }
  }

  const toggleDiscountMode = () => {
    if (!canEditPrice) return
    const next = !isDiscount
    setIsDiscount(next)
    const origNum = parseRupiahInput(originalPriceStr) || parseRupiahInput(priceStr)
    if (origNum) {
      setOriginalPriceStr(formatRupiahInput(origNum))
    }
    if (next && discountPercent > 0 && origNum) {
      const discounted = Math.round(origNum * (1 - discountPercent / 100))
      setPriceStr(formatRupiahInput(discounted))
    } else if (!next && origNum) {
      setPriceStr(formatRupiahInput(origNum))
    }
  }

  const currentPriceNumeric = parseRupiahInput(priceStr)
  const isPriceEmpty = !currentPriceNumeric || currentPriceNumeric <= 0

  // Kalkulasi diskon live
  const origPriceNum = parseRupiahInput(originalPriceStr) || currentPriceNumeric
  const savingsAmount = isDiscount && discountPercent > 0 && origPriceNum && currentPriceNumeric
    ? Math.max(0, origPriceNum - currentPriceNumeric)
    : 0

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')

    if (!name.trim()) {
      setNameError('Nama produk wajib diisi')
      return
    }

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

      // 2. Simpan data produk termasuk diskon & stok online
      const updates = {
        name: name.trim(),
        spec: spec.trim() || null,
        description: description.trim() || null,
        is_active: isActive
      }
      if (canEditPrice) {
        updates.price = currentPriceNumeric
        updates.original_price = origPriceNum || currentPriceNumeric
        updates.is_discount = isDiscount && discountPercent > 0
        updates.discount_percent = isDiscount ? discountPercent : 0
        updates.stock_online = Math.max(0, parseInt(stockOnline, 10) || 0)
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

  const handleDelete = async () => {
    if (!canDeleteProduct) return
    setIsSubmitting(true)
    try {
      await deleteCatalogProduct(productId)
      setShowDeleteDialog(false)
      onClose()
    } catch (err) {
      setErrorMessage(err.message || 'Gagal menghapus produk.')
      setShowDeleteDialog(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto flex flex-col min-h-screen min-h-[100dvh] bg-[var(--canvas)] select-text relative">
      {/* Header Halaman: Tombol Kembali + Judul */}
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
          <h1 className="text-base font-bold text-[#2C3E50]">Edit Produk</h1>
        </div>

        {canDeleteProduct && (
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="h-9 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Hapus Produk"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Hapus</span>
          </button>
        )}
      </header>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4 pb-36">
        {/* 1. FOTO PRODUK (160x160 di Tengah) */}
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 flex flex-col items-center text-center space-y-3 shadow-xs">
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

        {/* 3. HARGA & SISTEM DISKON PRODUK (RBAC) */}
        {canViewPrice && (
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
              <span className="text-xs font-bold text-[#2C3E50] flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#3A6B80]" />
                <span>Harga & Pengaturan Diskon</span>
              </span>
              {!canEditPrice && (
                <span className="text-[11px] font-bold text-[#8C9BA8] flex items-center gap-1 bg-[#F5F1EB] px-2.5 py-0.5 rounded-lg border border-[#EDE8DF]">
                  <Lock className="w-3 h-3 text-[#8C9BA8]" />
                  <span>Terkunci (Hanya Baca)</span>
                </span>
              )}
            </div>

            {/* Toggle Mode Diskon */}
            {canEditPrice ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF]">
                <div>
                  <span className="text-xs font-bold text-[#2C3E50] block">Pasang Diskon Promo</span>
                  <span className="text-[11px] text-[#6B7B8D]">Aktifkan harga coret dan diskon persen</span>
                </div>
                <button
                  type="button"
                  onClick={toggleDiscountMode}
                  className={`min-h-[36px] px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isDiscount
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-[#EDE8DF] text-[#6B7B8D] hover:bg-[#E2DDD2]'
                  }`}
                >
                  {isDiscount ? 'Diskon Aktif' : 'Normal'}
                </button>
              </div>
            ) : isDiscount ? (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Produk ini sedang dalam masa diskon promo ({discountPercent}%)</span>
              </div>
            ) : null}

            {/* Field Harga Normal / Asli (Coret) */}
            {isDiscount && (
              <div>
                <label className="text-xs font-bold text-[#2C3E50] block mb-1.5">
                  Harga Asli / Normal (Harga Coret)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7B8D]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!canEditPrice}
                    value={originalPriceStr}
                    onChange={handleOriginalPriceChange}
                    placeholder="65.000"
                    className={`w-full min-h-[48px] h-12 pl-11 pr-3.5 bg-white border rounded-xl text-base font-bold tabular-nums text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                      !canEditPrice
                        ? 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF] cursor-not-allowed opacity-90'
                        : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Persentase Diskon & Presets */}
            {isDiscount && canEditPrice && (
              <div>
                <label className="text-xs font-bold text-[#2C3E50] block mb-1.5">
                  Persentase Diskon (%)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={discountPercent || ''}
                      onChange={(e) => handleDiscountPercentChange(e.target.value)}
                      placeholder="15"
                      className="w-full min-h-[44px] h-11 px-3.5 pr-8 bg-white border border-[#EDE8DF] rounded-xl text-sm font-bold tabular-nums text-[#2C3E50] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80] focus:outline-none"
                    />
                    <Percent className="w-3.5 h-3.5 text-[#8C9BA8] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20, 25].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleDiscountPercentChange(p)}
                        className={`min-h-[44px] px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          discountPercent === p
                            ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                            : 'bg-[#F5F1EB] text-[#556575] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Field Harga Jual Final */}
            <div>
              <label className="text-xs font-bold text-[#2C3E50] block mb-1.5">
                {isDiscount ? 'Harga Jual Promo (Setelah Diskon)' : 'Harga Jual (Rp)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7B8D]">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={!canEditPrice}
                  value={priceStr}
                  onChange={handlePriceChange}
                  placeholder="50.000"
                  className={`w-full min-h-[48px] h-12 pl-11 pr-3.5 bg-white border rounded-xl text-base font-bold tabular-nums text-[#2C3E50] placeholder-[#94A3B8] focus:outline-none transition-colors ${
                    !canEditPrice
                      ? 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF] cursor-not-allowed opacity-90'
                      : isDiscount
                      ? 'border-amber-300 bg-amber-50/40 text-[#2F7D5B] focus:border-[#3A6B80]'
                      : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
                  }`}
                />
              </div>

              {/* Rangkuman Nilai Hemat */}
              {isDiscount && savingsAmount > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-[#EAF5EE] border border-[#BCE3CF] text-xs flex items-center justify-between text-[#2F7D5B]">
                  <span className="font-semibold">Potongan Pembeli:</span>
                  <span className="font-extrabold tabular-nums">
                    Hemat Rp {new Intl.NumberFormat('id-ID').format(savingsAmount)} ({discountPercent}%)
                  </span>
                </div>
              )}

              {!canEditPrice && (
                <p className="text-[11px] text-[#8C9BA8] mt-1.5 flex items-center gap-1">
                  <span>Hanya Super Admin / peran berizin yang dapat mengubah harga & diskon.</span>
                </p>
              )}
            </div>

            {/* Field Alokasi Stok Online Website */}
            <div className="pt-1">
              <label className="text-xs font-bold text-[#2C3E50] flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-[#3A6B80]" />
                  <span>Alokasi Stok Online Website (Pack)</span>
                </span>
                <span className="text-[11px] text-[#6B7B8D] font-normal">Tersinkron ke Web Buyer</span>
              </label>
              <input
                type="number"
                min="0"
                disabled={!canEditPrice}
                value={stockOnline}
                onChange={(e) => setStockOnline(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="50"
                className={`w-full min-h-[44px] h-11 px-3.5 bg-white border rounded-xl text-sm font-bold tabular-nums text-[#2C3E50] focus:outline-none transition-colors ${
                  !canEditPrice
                    ? 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF] cursor-not-allowed opacity-90'
                    : 'border-[#EDE8DF] focus:border-[#3A6B80] focus:ring-1 focus:ring-[#3A6B80]'
                }`}
              />
            </div>
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
        <div className="bg-white border border-[#EDE8DF] rounded-2xl overflow-hidden shadow-xs">
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
        <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#2C3E50] block">Status Produk</span>
            <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
              {isActive ? 'Tampil aktif di katalog POS & Web' : 'Disembunyikan dari penjualan'}
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

        {/* 7. DANGER ZONE: Hapus Produk Permanen (RBAC freezer_sales:delete) */}
        {canDeleteProduct && (
          <div className="bg-red-50/60 border border-red-200/80 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-bold text-red-700 block">Zona Berbahaya</span>
            <p className="text-[11px] text-red-600/80 leading-relaxed">
              Menghapus produk akan menghilangkannya secara permanen dari katalog master dan sinkronisasi website buyer.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="min-h-[44px] w-full bg-white hover:bg-red-100/60 active:bg-red-100 border border-red-300 rounded-xl text-xs font-bold text-red-700 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Hapus Produk Secara Permanen</span>
            </button>
          </div>
        )}
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

      {/* DIALOG: Konfirmasi Hapus Produk */}
      <AnimatePresence>
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4 text-center border border-[#EDE8DF]"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
                <Trash2 className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2C3E50]">Hapus Produk?</h3>
                <p className="text-xs text-[#6B7B8D] mt-1.5 leading-relaxed">
                  Produk <strong className="text-[#2C3E50]">"{name}"</strong> akan dihapus secara permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowDeleteDialog(false)}
                  className="min-h-[44px] bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#556575] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                  className="min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <span>Ya, Hapus</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
