import { useState } from 'react'
import { useProduction1Store } from '../store/production1Store'
import { PlusIcon, MinusIcon, CheckIcon, AlertIcon } from './Icons'
import { Package } from 'lucide-react'
import { Card, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'
import { Modal } from './ui/Modal'
import { SegmentedControl } from './ui/SegmentedControl'

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
  const updateCatalogProduct = useProduction1Store((s) => s.updateCatalogProduct)
  const toggleCatalogProductDisplay = useProduction1Store((s) => s.toggleCatalogProductDisplay)
  const finishedGoodsLots = useProduction1Store((s) => s.finishedGoodsLots)
  const salesReceiptLogs = useProduction1Store((s) => s.salesReceiptLogs) || []
  const verifyStagedSalesReceipt = useProduction1Store((s) => s.verifyStagedSalesReceipt)

  const products = (storeCatalog && storeCatalog.length > 0) ? storeCatalog : DEFAULT_PRODUCTS

  // State Verifikasi Fisik Bertahap Toko
  const [selectedProductId, setSelectedProductId] = useState('FG_MIKA')
  const [waveQty, setWaveQty] = useState(0)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State untuk modal edit nama & deskripsi katalog
  const [editingItem, setEditingItem] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

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

  const handleOpenEdit = (product) => {
    setEditingItem(product)
    setEditName(product.name)
    setEditDesc(product.description || '')
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editingItem) return
    const trimmedName = editName.trim()
    if (!trimmedName) return

    updateCatalogProduct(editingItem.id, {
      name: trimmedName,
      description: editDesc.trim()
    })
    setEditingItem(null)
  }

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

      {/* LIST KATALOG PRODUK */}
      <div className="space-y-2.5 pt-1">
        <span className="text-xs font-bold text-[#6B7B8D] block px-1">
          Katalog produk POS
        </span>

        {products.map((product) => (
          <Card key={product.id} className="border border-[#EDE8DF] shadow-xs hover:border-[#D5CEBF] transition-colors">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] flex items-center justify-center shrink-0 text-[#4685ac]">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-[#2C3E50] truncate">
                        {product.name}
                      </h3>
                      <Badge variant="neutral" size="sm" tabular>
                        {product.spec}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#6B7B8D] truncate mt-0.5">
                      {product.description || 'Tidak ada deskripsi.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(product)}
                    className="min-h-[44px] px-3 text-xs font-semibold text-[#2C3E50] bg-white border border-[#EDE8DF] rounded-xl hover:bg-[#F5F1EB] active:scale-95 transition-all cursor-pointer"
                    title="Ubah nama & deskripsi"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCatalogProductDisplay(product.id)}
                    className={`min-h-[44px] px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      product.isDisplayActive
                        ? 'bg-[#F5F1EB] text-[#2C3E50] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                        : 'bg-[#2C3E50] text-white border-[#2C3E50]'
                    }`}
                    title="Toggle status display produk"
                  >
                    {product.isDisplayActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Edit Nama & Deskripsi */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Ubah informasi produk"
        size="sm"
      >
        {editingItem && (
          <form onSubmit={handleSaveEdit} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-[#6B7B8D] block mb-1">
                Nama produk
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-12 text-xs border border-[#EDE8DF] rounded-xl px-3 bg-white text-[#2C3E50] focus:border-[#4685ac] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 transition-colors"
                placeholder="Nama produk"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7B8D] block mb-1">
                Deskripsi produk
              </label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full text-xs border border-[#EDE8DF] rounded-xl p-3 bg-white text-[#2C3E50] focus:border-[#4685ac] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4685ac]/20 resize-none transition-colors"
                placeholder="Keterangan isi dan kemasan produk..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDE8DF]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-[44px] px-4 text-xs font-semibold text-[#6B7B8D] bg-[#F5F1EB] hover:bg-[#EDE8DF] active:scale-95 rounded-xl border border-[#EDE8DF] cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 text-xs font-bold text-white bg-[#4685ac] hover:bg-[#3A6B80] active:bg-[#2E5466] active:scale-95 rounded-xl cursor-pointer transition-all shadow-xs"
              >
                Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
