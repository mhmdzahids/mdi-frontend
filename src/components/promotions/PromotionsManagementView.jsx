import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Ticket,
  Image as ImageIcon,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit2,
  Search,
  Upload,
  Calendar,
  AlertCircle,
  Eye,
  Lock,
  Percent,
  DollarSign,
  Sparkles,
  Tag
} from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '../../utils/api'
import { useProduction1Store } from '../../store/production1Store'
import { canAccess } from '../../utils/rbac'
import VoucherModal from './VoucherModal'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default function PromotionsManagementView() {
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const canManagePromo = canAccess('promotions:manage', currentUser, isDevMode)

  const [activeTab, setActiveTab] = useState('VOUCHERS') // 'VOUCHERS' | 'BANNERS'

  // ==========================================
  // STATE: VOUCHERS
  // ==========================================
  const [vouchers, setVouchers] = useState([])
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false)
  const [voucherFilter, setVoucherFilter] = useState('ALL') // ALL | ACTIVE | INACTIVE | PUBLIC | PRIVATE
  const [searchVoucher, setSearchVoucher] = useState('')
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false)
  const [copiedVoucherCode, setCopiedVoucherCode] = useState(null)

  // ==========================================
  // STATE: BANNERS
  // ==========================================
  const [banners, setBanners] = useState([])
  const [isLoadingBanners, setIsLoadingBanners] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [bannerTitleInput, setBannerTitleInput] = useState('')
  const [bannerPreviewSrc, setBannerPreviewSrc] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const bannerFileInputRef = useRef(null)

  // Fetch data
  const fetchVouchers = async () => {
    setIsLoadingVouchers(true)
    try {
      const data = await apiGet('/promotions/vouchers')
      setVouchers(data || [])
    } catch (err) {
      console.error('Error fetching vouchers:', err)
    } finally {
      setIsLoadingVouchers(false)
    }
  }

  const fetchBanners = async () => {
    setIsLoadingBanners(true)
    try {
      const data = await apiGet('/promotions/banners')
      setBanners(data || [])
    } catch (err) {
      console.error('Error fetching banners:', err)
    } finally {
      setIsLoadingBanners(false)
    }
  }

  useEffect(() => {
    fetchVouchers()
    fetchBanners()
  }, [])

  // ==========================================
  // VOUCHER HANDLERS
  // ==========================================
  const handleToggleVoucher = async (vId) => {
    if (!canManagePromo) return
    try {
      await apiPatch(`/promotions/vouchers/${vId}/toggle-active`)
      fetchVouchers()
    } catch (err) {
      alert(err.message || 'Gagal mengubah status kupon.')
    }
  }

  const handleDeleteVoucher = async (v) => {
    if (!canManagePromo) return
    if (!window.confirm(`Yakin ingin menghapus kupon ${v.code}?`)) return
    try {
      await apiDelete(`/promotions/vouchers/${v.id}`)
      fetchVouchers()
    } catch (err) {
      alert(err.message || 'Gagal menghapus kupon.')
    }
  }

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedVoucherCode(code)
    setTimeout(() => setCopiedVoucherCode(null), 2000)
  }

  // ==========================================
  // BANNER HANDLERS
  // ==========================================
  const handleSelectBannerFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran banner maksimal 5 MB.')
      return
    }

    setBannerFile(file)
    const reader = new FileReader()
    reader.onload = () => setBannerPreviewSrc(reader.result)
    reader.readAsDataURL(file)
  }

  const handleUploadBannerSubmit = async (e) => {
    e.preventDefault()
    if (!canManagePromo) return
    if (!bannerFile) {
      alert('Pilih file gambar banner terlebih dahulu.')
      return
    }

    setIsUploadingBanner(true)
    try {
      const fd = new FormData()
      fd.append('file', bannerFile)

      const uploadRes = await apiUpload('/promotions/banners/upload', fd)
      if (uploadRes?.image_url) {
        await apiPost('/promotions/banners', {
          title: bannerTitleInput.trim() || 'Banner Promo Dimsum',
          image_url: uploadRes.image_url,
          is_active: true
        })

        // Reset form
        setBannerFile(null)
        setBannerPreviewSrc(null)
        setBannerTitleInput('')
        if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
        fetchBanners()
      }
    } catch (err) {
      alert(err.message || 'Gagal mengunggah banner.')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const handleToggleBanner = async (bId) => {
    if (!canManagePromo) return
    try {
      await apiPatch(`/promotions/banners/${bId}/toggle-active`)
      fetchBanners()
    } catch (err) {
      alert(err.message || 'Gagal mengubah status banner.')
    }
  }

  const handleDeleteBanner = async (bId) => {
    if (!canManagePromo) return
    if (!window.confirm('Yakin ingin menghapus banner ini?')) return
    try {
      await apiDelete(`/promotions/banners/${bId}`)
      fetchBanners()
    } catch (err) {
      alert(err.message || 'Gagal menghapus banner.')
    }
  }

  // Filter vouchers
  const filteredVouchers = vouchers.filter((v) => {
    if (voucherFilter === 'ACTIVE' && !v.is_active) return false
    if (voucherFilter === 'INACTIVE' && v.is_active) return false
    if (voucherFilter === 'PUBLIC' && !v.is_public) return false
    if (voucherFilter === 'PRIVATE' && v.is_public) return false
    if (searchVoucher) {
      return v.code.toLowerCase().includes(searchVoucher.toLowerCase())
    }
    return true
  })

  // Stats
  const totalVouchers = vouchers.length
  const activeVouchers = vouchers.filter((v) => v.is_active).length
  const totalRedeemed = vouchers.reduce((acc, v) => acc + (v.used_count || 0), 0)

  return (
    <div className="space-y-4">
      {/* Navigation Sub-Tabs & Buat Kupon Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-[#EDE8DF]">
        <div className="flex items-center gap-1.5 p-1 bg-[#EDE8DF]/70 rounded-xl border border-[#EDE8DF] shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('VOUCHERS')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'VOUCHERS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Voucher & Kupon ({vouchers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANNERS')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'BANNERS'
                ? 'bg-white text-[#3A6B80] shadow-2xs border border-[#6A9DB3]/30'
                : 'text-[#64748B] hover:text-[#2C3E50]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Banner Promosi ({banners.length})</span>
          </button>
        </div>

        {activeTab === 'VOUCHERS' && canManagePromo && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setEditingVoucher(null)
              setIsVoucherModalOpen(true)
            }}
            className="min-h-[38px] px-4 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Buat Kupon Baru</span>
          </motion.button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VOUCHERS MANAGEMENT */}
      {/* ===================================================================== */}
      {activeTab === 'VOUCHERS' && (
        <div className="space-y-3.5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#6B7B8D] block font-medium">Total Kupon</span>
              <span className="text-base font-extrabold text-[#2C3E50] tabular-nums block my-0.5">
                {totalVouchers}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#2F7D5B] block font-medium">Kupon Aktif</span>
              <span className="text-base font-extrabold text-[#2F7D5B] tabular-nums block my-0.5">
                {activeVouchers}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#3A6B80] block font-medium">Total Diklaim</span>
              <span className="text-base font-extrabold text-[#3A6B80] tabular-nums block my-0.5">
                {totalRedeemed}x
              </span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'ACTIVE', label: 'Aktif' },
                { id: 'INACTIVE', label: 'Nonaktif' },
                { id: 'PUBLIC', label: 'Publik' },
                { id: 'PRIVATE', label: 'Privat / Rahasia' }
              ].map((f) => {
                const active = voucherFilter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVoucherFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      active
                        ? 'bg-[#2C3E50] text-white'
                        : 'bg-white border border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
                    }`}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-[#8C9BA8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchVoucher}
                onChange={(e) => setSearchVoucher(e.target.value)}
                placeholder="Cari kode kupon..."
                className="w-full h-9 bg-white border border-[#EDE8DF] rounded-xl pl-8 pr-3 text-xs text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
              />
            </div>
          </div>

          {/* Voucher List */}
          {isLoadingVouchers ? (
            <div className="text-center py-8 text-xs text-[#6B7B8D]">Memuat daftar voucher...</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-[#6B7B8D] space-y-2">
              <Ticket className="w-8 h-8 mx-auto text-[#B7C3CE]" />
              <span className="text-xs font-bold block text-[#2C3E50]">Belum ada kupon promo</span>
              <p className="text-[11px]">
                {canManagePromo
                  ? 'Klik tombol "Buat Kupon Baru" untuk menambahkan potongan harga website buyer.'
                  : 'Belum ada kupon promosi yang diterbitkan.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredVouchers.map((v) => {
                const isExpired = v.end_date && new Date(v.end_date) < new Date()
                const isLimitReached = v.usage_limit && v.used_count >= v.usage_limit
                const usagePct = v.usage_limit ? Math.min(100, Math.round((v.used_count / v.usage_limit) * 100)) : 0

                return (
                  <motion.div
                    key={v.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white border rounded-2xl p-4 shadow-2xs space-y-3 transition-colors ${
                      v.is_active && !isExpired && !isLimitReached
                        ? 'border-[#EDE8DF]'
                        : 'border-[#EDE8DF] opacity-75 bg-[#FDFCFB]'
                    }`}
                  >
                    {/* Header Card: Kode Kupon & Visibilitas */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-1 rounded-xl">
                          <span className="font-mono font-extrabold text-sm text-[#2C3E50] tracking-wider">
                            {v.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(v.code)}
                            title="Salin kode"
                            className="p-1 hover:bg-black/5 rounded text-[#556575] cursor-pointer"
                          >
                            {copiedVoucherCode === v.code ? (
                              <Check className="w-3.5 h-3.5 text-[#2F7D5B]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                            v.is_public
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {v.is_public ? 'Publik' : 'Privat'}
                        </span>
                      </div>

                      {/* Switch Active */}
                      {canManagePromo ? (
                        <button
                          type="button"
                          onClick={() => handleToggleVoucher(v.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                            v.is_active
                              ? 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {v.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            v.is_active
                              ? 'bg-[#E8F5E9] text-[#2E7D32]'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {v.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      )}
                    </div>

                    {/* Potongan & Minimal Belanja */}
                    <div className="flex items-baseline justify-between text-xs pt-1 border-t border-[#EDE8DF]">
                      <div>
                        <span className="text-[10px] text-[#6B7B8D] block">Nilai Diskon:</span>
                        <span className="font-extrabold text-[#2F7D5B] text-sm tabular-nums">
                          {v.discount_type === 'percent'
                            ? `${v.discount_value}% OFF`
                            : `${formatRupiah(v.discount_value)} OFF`}
                        </span>
                        {v.discount_type === 'percent' && v.max_discount && (
                          <span className="text-[10px] text-[#6B7B8D] block">
                            Maks {formatRupiah(v.max_discount)}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#6B7B8D] block">Min Belanja:</span>
                        <span className="font-bold text-[#2C3E50] tabular-nums">
                          {v.min_spend > 0 ? formatRupiah(v.min_spend) : 'Tanpa Minimum'}
                        </span>
                      </div>
                    </div>

                    {/* Kuota & Expired */}
                    <div className="space-y-1 text-[11px] text-[#6B7B8D]">
                      <div className="flex justify-between items-center">
                        <span>
                          Kuota:{' '}
                          <strong className="text-[#2C3E50]">
                            {v.used_count} / {v.usage_limit ? `${v.usage_limit} kupon` : 'Tak terbatas'}
                          </strong>
                        </span>
                        {v.end_date && (
                          <span>
                            Berakhir:{' '}
                            <strong className={isExpired ? 'text-red-600' : 'text-[#2C3E50]'}>
                              {formatDate(v.end_date)}
                            </strong>
                          </span>
                        )}
                      </div>

                      {v.usage_limit && (
                        <div className="w-full h-1.5 rounded-full bg-[#EDE8DF] overflow-hidden">
                          <div
                            style={{ width: `${usagePct}%` }}
                            className={`h-full rounded-full transition-all ${
                              usagePct >= 100 ? 'bg-red-500' : 'bg-[#3A6B80]'
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer Actions (RBAC guarded) */}
                    {canManagePromo && (
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#EDE8DF]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVoucher(v)
                            setIsVoucherModalOpen(true)
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[#EDE8DF] hover:bg-[#F5F1EB] text-xs font-bold text-[#2C3E50] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVoucher(v)}
                          className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BANNERS PROMOSI */}
      {/* ===================================================================== */}
      {activeTab === 'BANNERS' && (
        <div className="space-y-4">
          {/* Upload Form Box (RBAC Guarded) */}
          {canManagePromo && (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#3A6B80]" />
                <h3 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Upload Banner Promosi Baru
                </h3>
              </div>

              <form onSubmit={handleUploadBannerSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Title Input */}
                  <div>
                    <label className="font-bold text-[#2C3E50] block mb-1">
                      Judul Banner (Opsional)
                    </label>
                    <input
                      type="text"
                      value={bannerTitleInput}
                      onChange={(e) => setBannerTitleInput(e.target.value)}
                      placeholder="Contoh: Promo Spesial Akhir Pekan Dimsum"
                      className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl px-3 text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
                    />
                  </div>

                  {/* File Input */}
                  <div>
                    <label className="font-bold text-[#2C3E50] block mb-1">
                      Pilih File Gambar (JPG, PNG, WEBP, maks 5MB)
                    </label>
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleSelectBannerFile}
                      className="w-full h-11 bg-white border border-[#EDE8DF] rounded-xl p-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#2C3E50] file:text-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Preview Box jika file dipilih */}
                {bannerPreviewSrc && (
                  <div className="p-3 bg-[#F5F1EB] rounded-xl border border-[#EDE8DF] space-y-2">
                    <span className="text-[11px] font-bold text-[#6B7B8D] block">
                      Preview Banner Sebelum Upload:
                    </span>
                    <div className="w-full max-h-48 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                      <img
                        src={bannerPreviewSrc}
                        alt="Banner Preview"
                        className="max-h-48 w-auto object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!bannerFile || isUploadingBanner}
                    className="h-10 px-5 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingBanner ? 'Mengunggah...' : 'Upload & Tayangkan'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List Banner Sedang Tayang */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#6B7B8D] block px-1">
              Banner Sedang Tayang ({banners.length})
            </span>

            {isLoadingBanners ? (
              <div className="text-center py-6 text-xs text-[#6B7B8D]">Memuat banner...</div>
            ) : banners.length === 0 ? (
              <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-xs text-[#6B7B8D]">
                Belum ada banner promosi.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {banners.map((b) => (
                  <motion.div
                    key={b.id}
                    layout
                    className="bg-white border border-[#EDE8DF] rounded-2xl overflow-hidden shadow-2xs flex flex-col"
                  >
                    {/* Image Preview */}
                    <div className="w-full h-36 bg-[#F5F1EB] overflow-hidden relative">
                      <img
                        src={b.image_url}
                        alt={b.title || 'Banner'}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
                          b.is_active
                            ? 'bg-[#2F7D5B] text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {b.is_active ? 'Tayang' : 'Nonaktif'}
                      </span>
                    </div>

                    {/* Meta & Actions */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-bold text-xs text-[#2C3E50] line-clamp-1">
                          {b.title || 'Banner Promosi'}
                        </h4>
                        <span className="text-[10px] text-[#8C9BA8] block mt-0.5">
                          Dibuat {formatDate(b.created_at)}
                        </span>
                      </div>

                      {canManagePromo && (
                        <div className="pt-2 border-t border-[#EDE8DF] flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleToggleBanner(b.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              b.is_active
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {b.is_active ? 'Tarik Banner' : 'Tayangkan'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBanner(b.id)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                            title="Hapus banner"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Form Voucher */}
      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => {
          setIsVoucherModalOpen(false)
          setEditingVoucher(null)
        }}
        voucher={editingVoucher}
        onSaved={fetchVouchers}
      />
    </div>
  )
}
