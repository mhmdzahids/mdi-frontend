import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Ticket,
  Image as ImageIcon,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit2,
  Search,
  ExternalLink,
  Upload,
  Calendar,
  AlertCircle,
  Eye,
  Lock,
  Percent,
  DollarSign,
  Sparkles
} from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '../../utils/api'
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
  const [activeTab, setActiveTab] = useState('VOUCHERS') // 'VOUCHERS' | 'BANNERS' | 'API_KEY'

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

  // ==========================================
  // STATE: API KEY
  // ==========================================
  const [apiKeyInfo, setApiKeyInfo] = useState({
    header_name: 'X-API-Key',
    api_key: 'mdi_live_9f8e7d6c5b4a321e0f',
    description: 'API Key untuk otentikasi buyer client website eksternal.'
  })
  const [isApiKeyCopied, setIsApiKeyCopied] = useState(false)

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

  const fetchApiKeyInfo = async () => {
    try {
      const data = await apiGet('/promotions/api-key-info')
      if (data) setApiKeyInfo(data)
    } catch (err) {
      console.error('Error fetching api key info:', err)
    }
  }

  useEffect(() => {
    fetchVouchers()
    fetchBanners()
    fetchApiKeyInfo()
  }, [])

  // ==========================================
  // VOUCHER HANDLERS
  // ==========================================
  const handleToggleVoucher = async (vId) => {
    try {
      await apiPatch(`/promotions/vouchers/${vId}/toggle-active`)
      fetchVouchers()
    } catch (err) {
      alert(err.message || 'Gagal mengubah status kupon.')
    }
  }

  const handleDeleteVoucher = async (v) => {
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
    try {
      await apiPatch(`/promotions/banners/${bId}/toggle-active`)
      fetchBanners()
    } catch (err) {
      alert(err.message || 'Gagal mengubah status banner.')
    }
  }

  const handleDeleteBanner = async (bId) => {
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
      {/* Top Banner: Integrasi API Key Buyer Website (TUGAS 4) */}
      <div className="bg-gradient-to-r from-[#1E293B] via-[#2C3E50] to-[#1E293B] text-white rounded-2xl p-4 shadow-md border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Key className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold font-heading tracking-wide uppercase">
                Autentikasi API Key Website Buyer
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300 max-w-xl">
              Website buyer menggunakan kunci ini pada header <code className="text-amber-300 bg-white/10 px-1 py-0.5 rounded">X-API-Key</code> untuk membaca katalog produk diskon, voucher, dan banner promosi.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 font-mono text-xs text-amber-300 truncate max-w-[220px]">
              {apiKeyInfo.api_key}
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                navigator.clipboard.writeText(apiKeyInfo.api_key)
                setIsApiKeyCopied(true)
                setTimeout(() => setIsApiKeyCopied(false), 2000)
              }}
              className="h-9 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              {isApiKeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isApiKeyCopied ? 'Tersalin' : 'Salin Key'}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('VOUCHERS')}
            className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'VOUCHERS'
                ? 'bg-[#2C3E50] text-white shadow-xs'
                : 'bg-white border border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Voucher & Kupon Promo ({vouchers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANNERS')}
            className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'BANNERS'
                ? 'bg-[#2C3E50] text-white shadow-xs'
                : 'bg-white border border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Banner Promosi ({banners.length})</span>
          </button>
        </div>

        {activeTab === 'VOUCHERS' && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingVoucher(null)
              setIsVoucherModalOpen(true)
            }}
            className="h-9 px-3 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Buat Kupon</span>
          </motion.button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VOUCHERS MANAGEMENT (TUGAS 2) */}
      {/* ===================================================================== */}
      {activeTab === 'VOUCHERS' && (
        <div className="space-y-3.5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#556575] block font-semibold">Total Kupon</span>
              <span className="text-base font-extrabold text-[#2C3E50] tabular-nums block my-0.5 font-heading">
                {totalVouchers}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#556575] block font-semibold">Kupon Aktif</span>
              <span className="text-base font-extrabold text-[#2F7D5B] tabular-nums block my-0.5 font-heading">
                {activeVouchers}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#556575] block font-semibold">Total Diklaim</span>
              <span className="text-base font-extrabold text-[#3A6B80] tabular-nums block my-0.5 font-heading">
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
            <div className="text-center py-8 text-xs text-[#556575]">Memuat voucher...</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-[#556575] space-y-2">
              <Ticket className="w-8 h-8 mx-auto text-[#B7C3CE]" />
              <span className="text-xs font-bold block text-[#2C3E50]">Belum ada kupon promo</span>
              <p className="text-[11px]">
                Buat kupon baru untuk memberikan potongan harga kepada customer website.
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
                        : 'border-[#EDE8DF] opacity-60 bg-slate-50'
                    }`}
                  >
                    {/* Header Card */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-[#F5F1EB] border border-[#EDE8DF] px-2.5 py-1 rounded-xl">
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
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
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
                    </div>

                    {/* Potongan & Minimal Belanja */}
                    <div className="flex items-baseline justify-between text-xs pt-1 border-t border-[#EDE8DF]">
                      <div>
                        <span className="text-[10px] text-[#556575] block">Nilai Diskon:</span>
                        <span className="font-extrabold text-[#2F7D5B] text-sm tabular-nums">
                          {v.discount_type === 'percent'
                            ? `${v.discount_value}% OFF`
                            : `${formatRupiah(v.discount_value)} OFF`}
                        </span>
                        {v.discount_type === 'percent' && v.max_discount && (
                          <span className="text-[10px] text-[#556575] block">
                            Maks {formatRupiah(v.max_discount)}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#556575] block">Min Belanja:</span>
                        <span className="font-bold text-[#2C3E50] tabular-nums">
                          {v.min_spend > 0 ? formatRupiah(v.min_spend) : 'Tanpa Minimum'}
                        </span>
                      </div>
                    </div>

                    {/* Kuota & Expired */}
                    <div className="space-y-1 text-[11px] text-[#556575]">
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

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#EDE8DF]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVoucher(v)
                          setIsVoucherModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg border border-[#EDE8DF] hover:bg-[#F5F1EB] text-xs font-bold text-[#2C3E50] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVoucher(v)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BANNERS PROMOSI (TUGAS 3) */}
      {/* ===================================================================== */}
      {activeTab === 'BANNERS' && (
        <div className="space-y-4">
          {/* Upload Form Box */}
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#3A6B80]" />
              <h3 className="text-xs font-bold text-[#2C3E50] font-heading uppercase tracking-wide">
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
                  <span className="text-[11px] font-bold text-[#556575] block">
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
                  className="h-10 px-5 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingBanner ? 'Mengunggah...' : 'Upload & Tayangkan'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List Banner Sedang Tayang */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#556575] block px-1">
              Banner Sedang Tayang ({banners.length})
            </span>

            {isLoadingBanners ? (
              <div className="text-center py-6 text-xs text-[#556575]">Memuat banner...</div>
            ) : banners.length === 0 ? (
              <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-xs text-[#556575]">
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
