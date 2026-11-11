import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Tag, Percent, ArrowRight, Sparkles, Check, Package } from 'lucide-react'
import { apiPut } from '../../utils/api'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  const num = String(val).replace(/\D/g, '')
  return num ? parseInt(num, 10) : 0
}

export default function ProductDiscountModal({
  isOpen,
  onClose,
  product,
  onUpdated
}) {
  const [isDiscount, setIsDiscount] = useState(false)
  const [originalPriceInput, setOriginalPriceInput] = useState('')
  const [discountPercentInput, setDiscountPercentInput] = useState('')
  const [stockOnlineInput, setStockOnlineInput] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (product) {
      const orig = product.original_price != null ? product.original_price : (product.price || 0)
      setIsDiscount(Boolean(product.is_discount))
      setOriginalPriceInput(orig > 0 ? String(orig) : '')
      setDiscountPercentInput(product.discount_percent ? String(product.discount_percent) : '10')
      setStockOnlineInput(product.stock_online != null ? String(product.stock_online) : '50')
      setErrorMsg('')
    }
  }, [product, isOpen])

  if (!isOpen || !product) return null

  const origPriceNum = parseNumber(originalPriceInput)
  const discPctNum = parseNumber(discountPercentInput)
  const stockOnlineNum = parseNumber(stockOnlineInput)

  // Kalkulasi instan harga setelah diskon & nominal hemat
  let finalPrice = origPriceNum
  let savedAmount = 0

  if (isDiscount && discPctNum > 0 && origPriceNum > 0) {
    const validPct = Math.min(100, Math.max(1, discPctNum))
    finalPrice = Math.round(origPriceNum * (1 - validPct / 100))
    savedAmount = Math.max(0, origPriceNum - finalPrice)
  }

  const handleApplyPreset = (pct) => {
    setDiscountPercentInput(String(pct))
    if (!isDiscount) setIsDiscount(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (origPriceNum <= 0) {
      setErrorMsg('Harga normal (original price) harus lebih besar dari Rp 0.')
      return
    }

    if (isDiscount && (discPctNum < 1 || discPctNum > 100)) {
      setErrorMsg('Persentase diskon harus berada di antara 1% - 100%.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiPut(`/products/${product.id}/discount`, {
        is_discount: isDiscount,
        original_price: origPriceNum,
        discount_percent: isDiscount ? discPctNum : 0,
        stock_online: stockOnlineNum
      })

      if (onUpdated) onUpdated()
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan pengaturan diskon.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#EDE8DF] z-10 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-[#2C3E50] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading">
                  {product.is_discount ? 'Edit Diskon Produk' : 'Pasang Diskon Produk'}
                </h3>
                <p className="text-[11px] text-[#B7C3CE] truncate max-w-[240px]">
                  {product.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Toggle Status Diskon */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF]">
              <div>
                <span className="font-bold text-[#2C3E50] block">Aktifkan Promo Diskon</span>
                <span className="text-[11px] text-[#556575]">
                  Tampilkan harga coret di website buyer & katalog POS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscount(!isDiscount)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isDiscount ? 'bg-[#2F7D5B]' : 'bg-[#CBD5E1]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDiscount ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Input Harga Normal (Original Price) */}
            <div>
              <label className="font-bold text-[#2C3E50] block mb-1">
                Harga Normal (Harga Asli / Coret)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#556575]">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={originalPriceInput ? new Intl.NumberFormat('id-ID').format(parseNumber(originalPriceInput)) : ''}
                  onChange={(e) => setOriginalPriceInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 50.000"
                  className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-10 pr-3 font-mono font-bold text-sm text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                />
              </div>
            </div>

            {/* Input Persentase Diskon */}
            {isDiscount && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <label className="font-bold text-[#2C3E50] block">
                  Persentase Diskon (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountPercentInput}
                    onChange={(e) => setDiscountPercentInput(e.target.value)}
                    placeholder="Contoh: 20"
                    className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-3 pr-10 font-mono font-bold text-sm text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                  />
                  <Percent className="w-4 h-4 text-[#556575] absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[5, 10, 15, 20, 25, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyPreset(pct)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        discPctNum === pct
                          ? 'bg-[#2C3E50] text-white border-[#2C3E50]'
                          : 'bg-white border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Input Alokasi Stok Online Website */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#2C3E50]">
                  Alokasi Stok Khusus Website
                </label>
                <span className="text-[10px] text-[#556575]">Batas kuota online buyer</span>
              </div>
              <div className="relative">
                <Package className="w-4 h-4 text-[#556575] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  value={stockOnlineInput}
                  onChange={(e) => setStockOnlineInput(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-12 font-mono font-bold text-sm text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[#556575] text-[11px]">
                  pack
                </span>
              </div>
            </div>

            {/* Live Calculation Preview Card (TUGAS 1.3) */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#EEF5F9] to-[#E3ECF2] border border-[#CBDDE6] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#3A6B80] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Kalkulasi Instan Harga
                </span>
                {isDiscount && discPctNum > 0 && (
                  <span className="text-[10px] font-extrabold bg-[#2F7D5B] text-white px-2 py-0.5 rounded-full">
                    Diskon {discPctNum}%
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-[11px] text-[#556575] block">Harga Normal:</span>
                  <span className={`text-xs font-bold ${isDiscount ? 'line-through text-[#8C9BA8]' : 'text-[#2C3E50]'}`}>
                    {formatRupiah(origPriceNum)}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-[#3A6B80]" />

                <div className="text-right">
                  <span className="text-[11px] text-[#556575] block">Harga Akhir:</span>
                  <span className="text-sm font-extrabold text-[#2F7D5B] font-heading tabular-nums">
                    {formatRupiah(finalPrice)}
                  </span>
                </div>
              </div>

              {isDiscount && savedAmount > 0 && (
                <div className="pt-1.5 border-t border-[#CBDDE6] flex items-center justify-between text-[11px]">
                  <span className="text-[#556575]">Nominal Hemat Customer:</span>
                  <span className="font-extrabold text-[#2F7D5B] tabular-nums">
                    Hemat {formatRupiah(savedAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-xl border border-[#EDE8DF] text-[#556575] font-bold hover:bg-[#F5F1EB] transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white font-bold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Diskon'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
