import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Ticket, Check, Calendar, Hash, DollarSign, Percent, Shield, Eye, Lock } from 'lucide-react'
import { apiPost, apiPut } from '../../utils/api'

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

export default function VoucherModal({
  isOpen,
  onClose,
  voucher,
  onSaved
}) {
  const isEdit = Boolean(voucher?.id)

  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState('fixed') // 'fixed' | 'percent'
  const [discountValue, setDiscountValue] = useState('')
  const [minSpend, setMinSpend] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isActive, setIsActive] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (voucher) {
      setCode(voucher.code || '')
      setDiscountType(voucher.discount_type || 'fixed')
      setDiscountValue(String(voucher.discount_value || ''))
      setMinSpend(voucher.min_spend ? String(voucher.min_spend) : '0')
      setMaxDiscount(voucher.max_discount ? String(voucher.max_discount) : '')
      setStartDate(voucher.start_date ? voucher.start_date.substring(0, 16) : '')
      setEndDate(voucher.end_date ? voucher.end_date.substring(0, 16) : '')
      setUsageLimit(voucher.usage_limit ? String(voucher.usage_limit) : '')
      setIsPublic(voucher.is_public !== undefined ? Boolean(voucher.is_public) : true)
      setIsActive(voucher.is_active !== undefined ? Boolean(voucher.is_active) : true)
    } else {
      setCode('')
      setDiscountType('fixed')
      setDiscountValue('10000')
      setMinSpend('20000')
      setMaxDiscount('')
      setStartDate('')
      setEndDate('')
      setUsageLimit('100')
      setIsPublic(true)
      setIsActive(true)
    }
    setErrorMsg('')
  }, [voucher, isOpen])

  if (!isOpen) return null

  const cleanCode = code.trim().toUpperCase()
  const discValNum = parseFloat(discountValue) || 0
  const minSpendNum = parseNumber(minSpend)
  const maxDiscNum = maxDiscount ? parseNumber(maxDiscount) : null
  const usageLimitNum = usageLimit ? parseInt(usageLimit, 10) : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!cleanCode || cleanCode.length < 3) {
      setErrorMsg('Kode voucher minimal 3 karakter (contoh: DIMSUM10).')
      return
    }

    if (discValNum <= 0) {
      setErrorMsg('Nilai diskon harus lebih besar dari 0.')
      return
    }

    if (discountType === 'percent' && (discValNum < 1 || discValNum > 100)) {
      setErrorMsg('Persentase diskon harus di antara 1% - 100%.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        code: cleanCode,
        discount_type: discountType,
        discount_value: discValNum,
        min_spend: minSpendNum,
        max_discount: discountType === 'percent' ? maxDiscNum : null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        usage_limit: usageLimitNum,
        is_public: isPublic,
        is_active: isActive
      }

      if (isEdit) {
        await apiPut(`/promotions/vouchers/${voucher.id}`, payload)
      } else {
        await apiPost('/promotions/vouchers', payload)
      }

      if (onSaved) onSaved()
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan voucher.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EDE8DF] z-10 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-[#2C3E50] text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-heading">
                  {isEdit ? 'Edit Kupon Promo' : 'Buat Voucher / Kupon Promo Baru'}
                </h3>
                <p className="text-[11px] text-[#B7C3CE]">
                  Pengaturan diskon, kuota & batas belanja pembeli
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

          {/* Scrollable Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Kode Kupon */}
            <div>
              <label className="font-bold text-[#2C3E50] block mb-1">
                Kode Kupon Promo (Auto Uppercase)
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-[#556575] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  disabled={isEdit}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="Misal: DIMSUM10 atau DISKON20"
                  className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-3 font-mono font-extrabold text-sm text-[#2C3E50] uppercase tracking-wider focus:outline-none focus:border-[#3A6B80] disabled:bg-[#F5F1EB] disabled:text-[#8C9BA8]"
                />
              </div>
              <span className="text-[10px] text-[#556575] mt-0.5 block">
                Kode yang akan dimasukkan oleh customer saat checkout di keranjang belanja.
              </span>
            </div>

            {/* Pilihan Tipe Diskon */}
            <div>
              <label className="font-bold text-[#2C3E50] block mb-1">Tipe Potongan</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`h-11 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    discountType === 'fixed'
                      ? 'bg-[#2C3E50] text-white border-[#2C3E50] shadow-xs'
                      : 'bg-white border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Potongan Tetap (Rp)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`h-11 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    discountType === 'percent'
                      ? 'bg-[#2C3E50] text-white border-[#2C3E50] shadow-xs'
                      : 'bg-white border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Persentase (%)</span>
                </button>
              </div>
            </div>

            {/* Input Nilai Diskon & Maksimal Plafon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#2C3E50] block mb-1">
                  {discountType === 'fixed' ? 'Nominal Potongan (Rp)' : 'Persentase Diskon (%)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#556575]">
                    {discountType === 'fixed' ? 'Rp' : '%'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={discountType === 'percent' ? 100 : undefined}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'fixed' ? '10000' : '20'}
                    className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-3 font-mono font-bold text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                  />
                </div>
              </div>

              {discountType === 'percent' && (
                <div>
                  <label className="font-bold text-[#2C3E50] block mb-1">
                    Maksimal Potongan (Plafon Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#556575]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={maxDiscount ? new Intl.NumberFormat('id-ID').format(parseNumber(maxDiscount)) : ''}
                      onChange={(e) => setMaxDiscount(e.target.value.replace(/\D/g, ''))}
                      placeholder="Opsional (tanpa batas)"
                      className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-3 font-mono font-bold text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Syarat Minimal Belanja & Kuota Pemakaian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#2C3E50] block mb-1">
                  Minimal Belanja (Subtotal Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#556575]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minSpend ? new Intl.NumberFormat('id-ID').format(parseNumber(minSpend)) : '0'}
                    onChange={(e) => setMinSpend(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-3 font-mono font-bold text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#2C3E50] block mb-1">
                  Batas Kuota Pemakaian
                </label>
                <input
                  type="number"
                  min="1"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  placeholder="Kosongkan jika tak terbatas"
                  className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl px-3 font-mono font-bold text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                />
              </div>
            </div>

            {/* Masa Berlaku (Start Date & End Date) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#2C3E50] block mb-1">
                  Mulai Berlaku
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#556575] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-2 text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#2C3E50] block mb-1">
                  Kedaluwarsa (Berakhir)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#556575] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl pl-9 pr-2 text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                  />
                </div>
              </div>
            </div>

            {/* Toggles: Publik & Aktif */}
            <div className="space-y-2 pt-1 border-t border-[#EDE8DF]">
              {/* Toggle Public */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F1EB]">
                <div className="flex items-center gap-2">
                  {isPublic ? <Eye className="w-4 h-4 text-[#2F7D5B]" /> : <Lock className="w-4 h-4 text-amber-600" />}
                  <div>
                    <span className="font-bold text-[#2C3E50] block">
                      {isPublic ? 'Kupon Publik' : 'Kupon Rahasia (Privat)'}
                    </span>
                    <span className="text-[10px] text-[#556575]">
                      {isPublic
                        ? 'Tampil di banner & daftar kupon website buyer'
                        : 'Hanya bisa dipakai jika buyer mengetik kode rahasia'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isPublic ? 'bg-[#2F7D5B]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Active */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F1EB]">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#3A6B80]" />
                  <div>
                    <span className="font-bold text-[#2C3E50] block">Status Voucher</span>
                    <span className="text-[10px] text-[#556575]">
                      {isActive ? 'Aktif dan dapat digunakan' : 'Dinonaktifkan sementara'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isActive ? 'bg-[#2F7D5B]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Buttons */}
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
                <span>{isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Terbitkan Voucher'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
