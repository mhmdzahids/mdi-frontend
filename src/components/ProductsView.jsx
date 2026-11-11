import { useState, useEffect } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { PlusIcon, MinusIcon, CheckIcon, AlertIcon } from './Icons'
import { Package, ChevronRight, Tag, Sparkles, Percent } from 'lucide-react'
import { Card, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'
import { SegmentedControl } from './ui/SegmentedControl'
import { canAccess } from '../utils/rbac'
import ProductDiscountModal from './promotions/ProductDiscountModal'
import PromotionsManagementView from './promotions/PromotionsManagementView'

const DEFAULT_PRODUCTS = [
  {
    id: 'FG_MIKA',
    name: 'Dimsum Mika',
    description: 'Dimsum kukus isi 50 pcs kemasan mika menggunakan kulit 9 cm.',
    spec: '50 Pcs / Mika',
    isDisplayActive: true
  },
  {
    id: 'FG_VAKUM',
    name: 'Dimsum Vakum',
    description: 'Dimsum beku isi 25 pcs kemasan vakum menggunakan kulit 7 cm.',
    spec: '25 Pcs / Pack',
    isDisplayActive: true
  }
]

export default function ProductsView() {
  const storeCatalog = useProduction1Store((s) => s.catalogProducts)
  const fetchCatalogProducts = useProduction1Store((s) => s.fetchCatalogProducts)
  const toggleCatalogProductDisplay = useProduction1Store((s) => s.toggleCatalogProductDisplay)
  const openProductEdit = useProduction1Store((s) => s.openProductEdit)
  const finishedGoodsLots = useProduction1Store((s) => s.finishedGoodsLots)
  const salesReceiptLogs = useProduction1Store((s) => s.salesReceiptLogs) || []
  const verifyStagedSalesReceipt = useProduction1Store((s) => s.verifyStagedSalesReceipt)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)

  const canViewPrice = canAccess('freezer_sales:view_price', currentUser, isDevMode)
  const canEditPrice = canAccess('freezer_sales:edit_price', currentUser, isDevMode)

  const [activeMainTab, setActiveMainTab] = useState('INVENTORY') // 'INVENTORY' | 'PROMOTIONS'
  const [selectedDiscountProduct, setSelectedDiscountProduct] = useState(null)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)

  useEffect(() => {
    fetchCatalogProducts()
  }, [fetchCatalogProducts])

  const products = (storeCatalog && storeCatalog.length > 0) ? storeCatalog : DEFAULT_PRODUCTS

  // State Verifikasi Fisik Bertahap Toko
  const [selectedProductId, setSelectedProductId] = useState('FG_MIKA')
  const [waveQty, setWaveQty] = useState(0)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Hitung Data Pembanding untuk produk terpilih
  const currentProductLots = finishedGoodsLots.filter((l) => l.type === selectedProductId)
  const alreadyAccLots = currentProductLots.filter(
    (l) => l.status === 'IN_SALES_STOCK' || l.status === 'IN_FREEZER_STORAGE'
  )
  const pendingLots = currentProductLots.filter(
    (l) => l.status === 'PACKED_VERIFIED' || l.status === 'READY_IN_ASSEMBLY_STATION' || l.status === 'IN_PACKING_STATION'
  )
  const totalDispatchedFromPacking = currentProductLots.length
  const totalVerifiedAcc = alreadyAccLots.length
  const pendingCount = pendingLots.length

  const handleSubmitVerification = async (status) => {
    if (waveQty <= 0) return
    if (status === 'ONHOLD' && !verificationNotes.trim()) {
      alert('Mohon cantumkan alasan atau catatan untuk status onhold.')
      return
    }

    setIsSubmitting(true)
    try {
      const ok = await verifyStagedSalesReceipt({
        productId: selectedProductId,
        actualQty: waveQty,
        verificationStatus: status,
        notes: verificationNotes.trim()
      })
      if (ok) {
        setWaveQty(0)
        setVerificationNotes('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3.5 pb-28">
      {/* Tab Switcher: Katalog & Stok Fisik vs Voucher & Promo Website */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F5F1EB] rounded-2xl border border-[#EDE8DF]">
        <button
          type="button"
          onClick={() => setActiveMainTab('INVENTORY')}
          className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeMainTab === 'INVENTORY'
              ? 'bg-[#2C3E50] text-white shadow-xs'
              : 'text-[#556575] hover:bg-white/60'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Katalog & Stok Gudang</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('PROMOTIONS')}
          className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeMainTab === 'PROMOTIONS'
              ? 'bg-[#2C3E50] text-white shadow-xs'
              : 'text-[#556575] hover:bg-white/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Voucher & Promo Website</span>
        </button>
      </div>

      {activeMainTab === 'PROMOTIONS' ? (
        <PromotionsManagementView />
      ) : (
        <>
          {/* Data Pembanding Ringkasan: Verifikasi & Stok POS */}
          <Card className="border border-[#EDE8DF] shadow-xs">
            <CardContent className="p-4">
          {/* DATA PEMBANDING SIDE-BY-SIDE (Produksi vs Penjualan) */}
          <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[11px] text-[#6B7B8D] block font-medium">Kirim dapur</span>
              <span className="text-base font-bold text-[#2C3E50] tabular-nums block my-0.5">
                {totalDispatchedFromPacking}
              </span>
              <span className="text-[10px] text-[#6B7B8D] block font-sans">pack</span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[11px] text-[#2F7D5B] block font-medium">Sudah acc</span>
              <span className="text-base font-bold text-[#2F7D5B] tabular-nums block my-0.5">
                {totalVerifiedAcc}
              </span>
              <span className="text-[10px] text-[#6B7B8D] block font-sans">pack</span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[11px] text-[#6B7B8D] block font-medium">Menunggu</span>
              <span className={`text-base font-bold block my-0.5 tabular-nums ${pendingCount > 0 ? 'text-[#3A6B80]' : 'text-[#6B7B8D]'}`}>
                {pendingCount}
              </span>
              <span className="text-[10px] text-[#6B7B8D] block font-sans">pack</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PANEL UTAMA: VERIFIKASI FISIK PENJUALAN BERTAHAP (PENERIMAAN DARI DAPUR) */}
      <Card className="border border-[#EDE8DF] shadow-xs">
        <CardContent className="p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
            <span className="text-xs font-bold text-[#2C3E50]">
              Penerimaan dari dapur
            </span>
          </div>

          {/* Tab Pilihan Produk yang Diterima (Middle Center & Kontras Tinggi) */}
          <SegmentedControl
            options={products.map((p) => ({
              value: p.id,
              label: p.name
            }))}
            value={selectedProductId}
            onChange={(val) => {
              setSelectedProductId(val)
              setWaveQty(0)
            }}
          />

          {/* FORM INPUT KUANTITAS FISIK BERTAHAP */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-[#6B7B8D] block">
              Jumlah fisik diterima (pack)
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={waveQty <= 0}
                onClick={() => setWaveQty((q) => Math.max(0, q - 1))}
                className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] active:scale-[0.98] flex items-center justify-center text-[#2C3E50] disabled:border-[#EDE8DF] disabled:bg-[#EDE8DF]/40 disabled:text-[#6B7B8D]/30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Kurangi 1"
              >
                <MinusIcon className="w-5 h-5" />
              </button>

              <input
                type="number"
                min="0"
                value={waveQty}
                onChange={(e) => setWaveQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0"
                className="flex-1 h-12 text-center font-bold text-lg tabular-nums border-[1.5px] border-[#B7C3CE] rounded-xl bg-white text-[#2C3E50] focus:outline-none focus:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 transition-colors shadow-2xs"
              />

              <button
                type="button"
                onClick={() => setWaveQty((q) => q + 1)}
                className="w-12 h-12 rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#F5F1EB] hover:bg-[#EDE8DF] active:scale-[0.98] flex items-center justify-center text-[#2C3E50] cursor-pointer transition-colors"
                aria-label="Tambah 1"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Preset Cepat Input Kuantitas */}
            <div className="grid grid-cols-4 gap-2 pt-0.5">
              {[10, 25, 50].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWaveQty((q) => q + val)}
                  className="min-h-[48px] text-xs font-bold tabular-nums rounded-xl border-[1.5px] border-[#B7C3CE] bg-white hover:bg-[#F5F1EB] text-[#2C3E50] cursor-pointer active:scale-[0.98] transition-colors"
                >
                  +{val}
                </button>
              ))}
              <button
                type="button"
                disabled={pendingCount <= 0}
                onClick={() => setWaveQty(pendingCount)}
                className="min-h-[48px] text-xs font-bold tabular-nums rounded-xl border-[1.5px] border-[#B7C3CE] bg-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] disabled:opacity-40 disabled:border-[#EDE8DF] cursor-pointer active:scale-[0.98] transition-colors"
              >
                 +{pendingCount}
              </button>
            </div>

            {/* Indikator Status Kesesuaian */}
            {waveQty > 0 && (
              <div
                className={`py-2 px-3 rounded-xl text-xs flex items-center justify-between border ${
                  waveQty === pendingCount
                    ? 'bg-[#EAF5EE] border-[#BCE3CF] text-[#2F7D5B]'
                    : waveQty < pendingCount
                    ? 'bg-[#EEF5F9] border-[#D1E4EF] text-[#3A6B80]'
                    : 'bg-[#FAF4E6] border-[#F3E5C1] text-[#A8862E]'
                }`}
              >
                <span className="font-medium">
                  {waveQty === pendingCount && 'Jumlah fisik sesuai'}
                  {waveQty < pendingCount && `Sisa ${pendingCount - waveQty} pack menyusul`}
                  {waveQty > pendingCount && `Lebih +${waveQty - pendingCount} pack`}
                </span>
                <span className="font-bold text-[11px]">
                  {waveQty === pendingCount ? 'Sesuai' : waveQty < pendingCount ? 'Parsial' : 'Selisih'}
                </span>
              </div>
            )}

            {/* Kolom Catatan */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-[#6B7B8D] block">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Catatan jika ada..."
                className="w-full h-12 text-xs border border-[#EDE8DF] rounded-xl px-3 bg-white text-[#2C3E50] placeholder-[#6B7B8D] focus:outline-none focus:border-[#4685ac] focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 transition-colors"
              />
            </div>

            {/* DUA TOMBOL KEPUTUSAN UTAMA: ACC VS ONHOLD */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting || waveQty <= 0}
                onClick={() => handleSubmitVerification('ACC')}
                className="min-h-[52px] rounded-xl font-bold text-xs bg-[#4685ac] text-white hover:bg-[#3A6B80] active:bg-[#2E5466] disabled:bg-[#EDE8DF] disabled:text-[#6B7B8D] disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]"
              >
                <CheckIcon className="w-4 h-4 text-white" />
                <span>Acc & masuk POS</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || waveQty <= 0}
                onClick={() => handleSubmitVerification('ONHOLD')}
                className="min-h-[52px] rounded-xl font-bold text-xs bg-[#FFFBEB] border border-[#FCD34D] text-[#A8862E] hover:bg-[#FAF4E6] active:bg-[#F3E5C1] disabled:border-[#EDE8DF] disabled:bg-[#F5F1EB] disabled:text-[#6B7B8D] disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8862E]"
              >
                <AlertIcon className="w-4 h-4 text-[#A8862E]" />
                <span>Onhold (audit)</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIWAYAT GELOMBANG PENERIMAAN HARI INI */}
      {salesReceiptLogs.length > 0 && (
        <Card className="border border-[#EDE8DF] shadow-xs">
          <CardContent className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
              <span className="text-xs font-bold text-[#2C3E50]">
                Riwayat penerimaan
              </span>
              <span className="text-xs font-semibold text-[#6B7B8D] tabular-nums">
                {salesReceiptLogs.length} gelombang
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {salesReceiptLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-2.5 text-xs flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#2C3E50]">
                        {log.productId === 'FG_MIKA' ? 'Dimsum Mika' : 'Dimsum Vakum'}
                      </span>
                      <span className="font-bold text-[#2C3E50] bg-white border border-[#EDE8DF] px-2 py-0.5 rounded-lg text-[11px] tabular-nums">
                        {log.qty} pack
                      </span>
                      <Badge
                        variant={log.status === 'ACC' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {log.status === 'ACC' ? 'Acc POS' : 'Onhold'}
                      </Badge>
                    </div>
                    {log.notes && (
                      <p className="text-[11px] text-[#6B7B8D] mt-0.5 italic">
                        "{log.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 text-[10px] text-[#6B7B8D] tabular-nums">
                    <div>{log.time}</div>
                    <div className="text-[#2C3E50] font-semibold font-sans">{log.operatorName}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* LIST KATALOG PRODUK (Format Kartu Barang Masuk) */}
      <div className="space-y-2.5 pt-1">
        <span className="text-xs font-bold text-[#6B7B8D] block px-1">
          Katalog produk POS
        </span>

        {products.map((product) => {
          const isPriceEmpty = !product.price || product.price <= 0
          const isProductActive = Boolean(product.is_active ?? product.isDisplayActive)

          return (
            <div
              key={product.id}
              onClick={() => openProductEdit(product.id)}
              className="bg-white border border-[#EDE8DF] hover:border-[#D5CEBF] rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* 1:1 Thumbnail Persegi (56-64px) */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-[#F5F1EB] border border-[#EDE8DF] shrink-0 flex items-center justify-center">
                  {product.thumbnail_url || product.image_url ? (
                    <img
                      src={product.thumbnail_url || product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-[#8C9BA8] stroke-[1.5]" />
                  )}
                </div>

                {/* Kolom Teks Tengah */}
                <div className="min-w-0">
                  {/* Baris 1: Nama Produk (teks tebal, max 2 baris) */}
                  <h3 className="font-bold text-xs sm:text-sm text-[#1E293B] line-clamp-2 leading-snug break-words">
                    {product.name}
                  </h3>

                  {/* Baris 2: Spec / Isi per kemasan (warna muted) */}
                  {product.spec && (
                    <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                      {product.spec}
                    </span>
                  )}

                  {/* Baris 3: Harga Rupiah (Hanya jika pengguna berizin 'Lihat Harga') */}
                  {canViewPrice && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {!isPriceEmpty ? (
                        <>
                          {product.is_discount && (product.original_price || product.price) ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-extrabold text-[#2F7D5B] tabular-nums">
                                Rp {new Intl.NumberFormat('id-ID').format(product.price)}
                              </span>
                              {product.original_price && product.original_price > product.price && (
                                <span className="text-[11px] text-[#8C9BA8] line-through tabular-nums">
                                  Rp {new Intl.NumberFormat('id-ID').format(product.original_price)}
                                </span>
                              )}
                              {product.discount_percent > 0 && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">
                                  -{product.discount_percent}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm font-bold text-[#1E293B] tabular-nums">
                              Rp {new Intl.NumberFormat('id-ID').format(product.price)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#8C9BA8] font-normal italic">
                          Belum ada harga
                        </span>
                      )}

                      {/* Online Stock Badge */}
                      {product.stock_online != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EEF5F9] text-[#3A6B80] border border-[#CBDDE6]">
                          Web: {product.stock_online} pack
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Kanan: Tombol Diskon + Switch Status Display + Chevron Kecil */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Tombol Pasang / Edit Diskon (TUGAS 1.3) */}
                {canEditPrice && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedDiscountProduct(product)
                      setIsDiscountModalOpen(true)
                    }}
                    className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      product.is_discount
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200'
                        : 'bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#556575] border border-[#EDE8DF]'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{product.is_discount ? 'Edit Diskon' : 'Pasang Diskon'}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isPriceEmpty}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCatalogProductDisplay(product.id)
                  }}
                  title={isPriceEmpty ? 'Isi harga dulu untuk mengaktifkan' : 'Ubah status aktif produk'}
                  className={`min-h-[44px] min-w-[64px] px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    isPriceEmpty
                      ? 'bg-[#EDE8DF] text-[#8C9BA8] cursor-not-allowed opacity-60'
                      : isProductActive
                      ? 'bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] cursor-pointer'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer'
                  }`}
                >
                  {isProductActive ? 'Aktif' : 'Nonaktif'}
                </button>

                <ChevronRight className="w-4 h-4 text-[#8C9BA8]" />
              </div>
            </div>
          )
        })}
      </div>
        </>
      )}

      {/* Modal Pasang/Edit Diskon (TUGAS 1.3) */}
      <ProductDiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => {
          setIsDiscountModalOpen(false)
          setSelectedDiscountProduct(null)
        }}
        product={selectedDiscountProduct}
        onUpdated={fetchCatalogProducts}
      />
    </div>
  )
}
