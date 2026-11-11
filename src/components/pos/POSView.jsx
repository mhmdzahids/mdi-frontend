import { useState, useEffect, useRef } from 'react'
import {
  ShoppingBag,
  ListOrdered,
  History,
  Scan,
  Camera,
  Plus,
  Trash2,
  Check,
  Clock,
  AlertCircle,
  Banknote,
  QrCode,
  Building,
  RotateCcw
} from 'lucide-react'
import { useProduction1Store } from '../../store/production1Store'
import { apiGet, apiPost } from '../../utils/api'
import { playSuccessBeep, playErrorBeep, playOrderCompleteChime } from '../../utils/soundFx'
import POSCameraScannerModal from './POSCameraScannerModal'
import POSNewOjolOrderModal from './POSNewOjolOrderModal'
import POSOrderFulfillmentModal from './POSOrderFulfillmentModal'

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0)
}

export default function POSView() {
  const storeCatalog = useProduction1Store((s) => s.catalogProducts)
  const fetchCatalogProducts = useProduction1Store((s) => s.fetchCatalogProducts)

  // 1. Sub-Tab State: DIRECT (Kasir Indomaret) | QUEUE (Ojol & Web) | HISTORY (Rekap Omzet)
  const [activeTab, setActiveTab] = useState('DIRECT')

  // 2. State Kasir Indomaret (Speed-First)
  const [scannedList, setScannedList] = useState([]) // [{ id, lot_qr_code, product_id, product_name, price, timestamp }]
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH') // CASH | QRIS | TRANSFER
  const [customPaid, setCustomPaid] = useState(null)
  const [customerName, setCustomerName] = useState('Walk-in')
  const [scanAlert, setScanAlert] = useState(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false)

  // 3. Antrean Multi-Channel State
  const [ordersQueue, setOrdersQueue] = useState([])
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  const [isNewOjolModalOpen, setIsNewOjolModalOpen] = useState(false)
  const [fulfillingOrder, setFulfillingOrder] = useState(null)

  // 4. Riwayat State
  const [dailySummary, setDailySummary] = useState(null)
  const [completedOrders, setCompletedOrders] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const barcodeInputRef = useRef(null)

  useEffect(() => {
    fetchCatalogProducts()
  }, [fetchCatalogProducts])

  // Pastikan input barcode selalu fokus otomatis agar scanner tembak langsung siap
  useEffect(() => {
    if (activeTab === 'DIRECT') {
      const timer = setTimeout(() => barcodeInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [activeTab, scannedList.length])

  const products = (storeCatalog && storeCatalog.length > 0)
    ? storeCatalog.filter((p) => Boolean(p.is_active ?? p.isDisplayActive))
    : [
        { id: 'FG_MIKA', name: 'Dimsum Mika', price: 75000, spec: '50 Pcs / Mika' },
        { id: 'FG_VAKUM', name: 'Dimsum Vakum', price: 45000, spec: '25 Pcs / Pack' }
      ]

  // Perhitungan Kasir
  const totalAmount = scannedList.reduce((acc, it) => acc + (it.price || 0), 0)
  const totalItems = scannedList.length
  const amountPaid = customPaid !== null ? customPaid : totalAmount
  const change = Math.max(0, (amountPaid || 0) - totalAmount)
  const isUnderpaid = paymentMethod === 'CASH' && (amountPaid || 0) < totalAmount

  // Load Data Antrean Pesanan
  const fetchOrdersQueue = async () => {
    try {
      setIsLoadingQueue(true)
      const data = await apiGet('/pos/orders?status=PENDING_SCAN')
      setOrdersQueue(data || [])
    } catch (err) {
      console.error('Failed to load queue:', err)
    } finally {
      setIsLoadingQueue(false)
    }
  }

  // Load Riwayat & Daily Summary
  useEffect(() => {
    let isMounted = true

    if (activeTab === 'QUEUE') {
      apiGet('/pos/orders?status=PENDING_SCAN')
        .then((data) => {
          if (isMounted) setOrdersQueue(data || [])
        })
        .catch((err) => console.error('Failed to load queue:', err))
        .finally(() => {
          if (isMounted) setIsLoadingQueue(false)
        })
    } else if (activeTab === 'HISTORY') {
      Promise.all([
        apiGet('/pos/daily-summary'),
        apiGet('/pos/orders?status=COMPLETED&limit=30')
      ])
        .then(([sum, orders]) => {
          if (isMounted) {
            setDailySummary(sum)
            setCompletedOrders(orders || [])
          }
        })
        .catch((err) => console.error('Failed to load history:', err))
        .finally(() => {
          if (isMounted) setIsLoadingHistory(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [activeTab])

  // ==========================================
  // SCAN KEMASAN ALA INDOMARET (BIP-BIP-BIP)
  // ==========================================

  const handleScanBarcode = async (code) => {
    const clean = (code || '').trim().toUpperCase()
    if (!clean) return

    // Cegah scan ganda kemasan yang sama dalam 1 transaksi
    if (scannedList.some((s) => s.lot_qr_code === clean)) {
      playErrorBeep()
      setScanAlert({ type: 'error', text: `Kemasan '${clean}' sudah tertembak di keranjang!` })
      setBarcodeInput('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    try {
      const res = await apiPost('/pos/scan-lot', { lot_qr_code: clean })
      playSuccessBeep()

      const newEntry = {
        id: `${clean}-${Date.now()}`,
        lot_qr_code: res.lot_qr_code,
        product_id: res.product_id,
        product_name: res.product_name,
        price: res.price || 0,
        spec: res.spec || '',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }

      // Baris baru masuk ke atas struk
      setScannedList((prev) => [newEntry, ...prev])
      setScanAlert({
        type: 'success',
        text: `+ ${res.product_name} (${clean})`
      })
      setBarcodeInput('')
    } catch (err) {
      playErrorBeep()
      setScanAlert({
        type: 'error',
        text: err?.message || 'Kode kemasan tidak terdaftar di sistem.'
      })
    } finally {
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }

  // Tambah Manual Produk Katalog jika Barcode Fisik Rusak/Basah
  const handleAddManualProduct = (prod) => {
    playSuccessBeep()
    // eslint-disable-next-line react-hooks/purity
    const syntheticCode = `MANUAL-${prod.id}-${Date.now().toString().slice(-4)}`
    const newEntry = {
      id: syntheticCode,
      lot_qr_code: syntheticCode,
      product_id: prod.id,
      product_name: prod.name,
      price: prod.price || 0,
      spec: prod.spec || '',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
    setScannedList((prev) => [newEntry, ...prev])
    setScanAlert({
      type: 'success',
      text: `+ ${prod.name} (Input Manual)`
    })
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const handleRemoveItem = (entryId) => {
    setScannedList((prev) => prev.filter((it) => it.id !== entryId))
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const handleResetStruk = () => {
    setScannedList([])
    setCustomPaid(null)
    setPaymentMethod('CASH')
    setCustomerName('Walk-in')
    setScanAlert(null)
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // Selesaikan Transaksi Kasir Langsung
  const handleCompleteSale = async () => {
    if (scannedList.length === 0 || isUnderpaid || isSubmittingCheckout) return

    setIsSubmittingCheckout(true)
    try {
      // Kelompokkan per product_id untuk backend items
      const itemMap = {}
      scannedList.forEach((it) => {
        if (!itemMap[it.product_id]) {
          itemMap[it.product_id] = {
            product_id: it.product_id,
            product_name: it.product_name,
            price: it.price,
            qty: 0
          }
        }
        itemMap[it.product_id].qty += 1
      })

      const items = Object.values(itemMap)
      const scanned_lots = scannedList
        .filter((it) => !it.lot_qr_code.startsWith('MANUAL-'))
        .map((it) => ({
          lot_qr_code: it.lot_qr_code,
          product_id: it.product_id,
          product_name: it.product_name
        }))

      await apiPost('/pos/orders/direct', {
        customer_name: customerName.trim() || 'Walk-in',
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'CASH' ? amountPaid : totalAmount,
        items,
        scanned_lots
      })

      playOrderCompleteChime()
      handleResetStruk()
      setScanAlert({
        type: 'success',
        text: `TRANSAKSI SELESAI! ${formatRupiah(totalAmount)} (${paymentMethod})`
      })
    } catch (err) {
      playErrorBeep()
      alert(err?.message || 'Gagal menyimpan transaksi.')
    } finally {
      setIsSubmittingCheckout(false)
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }

  // ==========================================
  // HANDLERS ANTREAN OJOL & WEB
  // ==========================================

  const handleCreateOjolOrder = async (orderData) => {
    try {
      await apiPost('/pos/orders', orderData)
      playSuccessBeep()
      setIsNewOjolModalOpen(false)
      fetchOrdersQueue()
    } catch (err) {
      alert(err?.message || 'Gagal membuat pesanan.')
    }
  }

  return (
    <div className="space-y-3 pb-20 select-none font-sans">
      {/* Top Mode Bar (Kasir | Antrean | Riwayat) */}
      <div className="bg-[#F5F1EB] p-1 rounded-2xl border border-[#EDE8DF] grid grid-cols-3 gap-1">
        {[
          { id: 'DIRECT', label: 'Kasir Langsung', icon: ShoppingBag },
          {
            id: 'QUEUE',
            label: ordersQueue.length > 0 ? `Antrean Ojol (${ordersQueue.length})` : 'Antrean Ojol',
            icon: ListOrdered
          },
          { id: 'HISTORY', label: 'Riwayat Omzet', icon: History }
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                active
                  ? 'bg-white text-[#2C3E50] shadow-xs'
                  : 'text-[#6B7B8D] hover:text-[#2C3E50]'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: KASIR ALA INDOMARET (SCAN KEMASAN FISIK) */}
      {/* ===================================================================== */}
      {activeTab === 'DIRECT' && (
        <div className="space-y-3">
          {/* BARCODE SCANNER BAR (ALWAYS LISTENING) */}
          <div className="bg-white border-2 border-[#2C3E50]/20 focus-within:border-[#2F7D5B] rounded-2xl p-2.5 shadow-xs transition-colors">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2F7D5B] animate-pulse" />
                <span className="text-[11px] font-bold text-[#2F7D5B] tracking-tight">
                  SCANNER TEMBAK SIAP
                </span>
              </div>
              <span className="text-[10px] text-[#6B7B8D] font-mono">
                Tembak barcode kemasan dari freezer
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Scan className="w-5 h-5 text-[#2C3E50] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleScanBarcode(barcodeInput)
                    }
                  }}
                  placeholder="Arahkan scanner tembak kemasan di sini..."
                  className="w-full h-12 bg-[#F5F1EB] rounded-xl pl-10 pr-3 font-mono text-sm font-bold uppercase text-[#2C3E50] border border-[#B7C3CE] focus:bg-white focus:outline-none focus:border-[#2F7D5B] transition-colors"
                />
              </div>

              {/* Kamera HP Fallback jika tidak pakai scanner gun */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="w-12 h-12 rounded-xl bg-[#EEF5F9] border border-[#6A9DB3]/40 text-[#3A6B80] flex items-center justify-center hover:bg-[#D1E4EF] active:scale-95 cursor-pointer shrink-0"
                title="Buka Kamera HP"
              >
                <Camera className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Quick Catalog Bar jika barcode rusak */}
            <div className="pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-[#6B7B8D] uppercase shrink-0">Barcode Rusak?</span>
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAddManualProduct(p)}
                  className="px-2.5 py-1 rounded-lg bg-[#F5F1EB] border border-[#EDE8DF] text-[11px] font-bold text-[#2C3E50] hover:bg-[#EDE8DF] active:scale-95 shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[#2F7D5B]" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Banner */}
          {scanAlert && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs ${
                scanAlert.type === 'success'
                  ? 'bg-[#2F7D5B] text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {scanAlert.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{scanAlert.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanAlert(null)}
                className="text-xs text-white/80 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* STRUK BERJALAN ALA KASIR INDOMARET */}
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
                  Daftar Kemasan Tertembak
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#2C3E50] text-white tabular-nums">
                  {totalItems} pack
                </span>
              </div>

              {scannedList.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetStruk}
                  className="text-[11px] font-bold text-rose-600 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Struk</span>
                </button>
              )}
            </div>

            {/* List Baris Struk */}
            {scannedList.length === 0 ? (
              <div className="text-center py-10 text-[#6B7B8D] space-y-1">
                <Scan className="w-10 h-10 mx-auto text-[#B7C3CE] stroke-[1.5] mb-2 animate-bounce" />
                <span className="text-xs font-bold text-[#2C3E50] block">Struk masih kosong</span>
                <span className="text-[11px] text-[#6B7B8D] block">
                  Ambil kemasan dimsum dari freezer lalu tembakkan barcode ke scanner.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[#EDE8DF] max-h-56 overflow-y-auto pr-1">
                {scannedList.map((it, idx) => (
                  <div
                    key={it.id}
                    className="py-2 flex items-center justify-between text-xs hover:bg-[#F5F1EB]/50 px-1 rounded-lg"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-[#6B7B8D] w-4 text-center">
                        {totalItems - idx}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2C3E50] truncate">{it.product_name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#F5F1EB] text-[#3A6B80] shrink-0">
                            {it.lot_qr_code}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#6B7B8D]">{it.timestamp}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-[#2C3E50] tabular-nums">
                        {formatRupiah(it.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="w-6 h-6 rounded-md text-[#6B7B8D] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PANEL PEMBAYARAN JUMBO ALA INDOMARET (LANGSUNG DI LAYAR TANPA POPUP) */}
          <div className="bg-[#2C3E50] rounded-2xl p-4 text-white shadow-md space-y-3.5">
            {/* Display TOTAL Jumbo */}
            <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B7C3CE] block">
                  Total Bayar
                </span>
                <span className="text-[11px] text-[#B7C3CE]/80">
                  {totalItems} kemasan dimsum
                </span>
              </div>
              <span className="text-3xl font-extrabold font-heading tracking-tight tabular-nums text-white">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            {/* Metode Pembayaran: Tunai, QRIS, Transfer */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#B7C3CE] block">
                Metode Pembayaran
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Tunai', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'TRANSFER', label: 'Transfer', icon: Building }
                ].map((m) => {
                  const Icon = m.icon
                  const active = paymentMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id)
                        if (m.id !== 'CASH') setCustomPaid(null)
                        setTimeout(() => barcodeInputRef.current?.focus(), 50)
                      }}
                      className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#2F7D5B] text-white shadow-xs'
                          : 'bg-white/10 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Uang Diterima & Kembalian (Khusus Tunai) */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2 bg-black/20 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#B7C3CE] shrink-0">Uang Diterima:</span>
                  <input
                    type="number"
                    value={amountPaid || ''}
                    onChange={(e) => setCustomPaid(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-36 h-10 bg-white rounded-lg px-2.5 text-right font-extrabold text-sm tabular-nums text-[#2C3E50] focus:outline-none"
                  />
                </div>

                {/* Tombol Pecahan Uang Cepat (Indomaret Cash Chips) */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomPaid(totalAmount)}
                    className="h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-all active:scale-95"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 200000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCustomPaid(val)}
                      className="h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold tabular-nums transition-all active:scale-95"
                    >
                      {(val / 1000).toLocaleString('id-ID')}rb
                    </button>
                  ))}
                </div>

                {/* Kembalian Highlight Box */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-[#B7C3CE]">Kembalian:</span>
                  <span
                    className={`text-lg font-extrabold tabular-nums ${
                      isUnderpaid ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isUnderpaid ? `Kurang ${formatRupiah(totalAmount - amountPaid)}` : formatRupiah(change)}
                  </span>
                </div>
              </div>
            )}

            {/* TOMBOL BAYAR & SELESAI */}
            <button
              type="button"
              disabled={scannedList.length === 0 || isUnderpaid || isSubmittingCheckout}
              onClick={handleCompleteSale}
              className="w-full h-13 rounded-xl bg-[#2F7D5B] hover:bg-[#27664B] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>{isSubmittingCheckout ? 'Memproses...' : 'SELESAI & POTONG STOK'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ANTREAN OJOL & WEB (SCAN PEMENUHAN) */}
      {/* ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-xs font-bold text-[#2C3E50] block">
                Pesanan Masuk ({ordersQueue.length})
              </span>
              <span className="text-[11px] text-[#6B7B8D]">
                Ambil kemasan dari freezer lalu scan pemenuhan
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsNewOjolModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-[#3A6B80] text-white text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-[#2F586B] active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pesanan Ojol</span>
            </button>
          </div>

          {isLoadingQueue ? (
            <div className="text-center py-8 text-xs text-[#6B7B8D]">Memuat antrean...</div>
          ) : ordersQueue.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-[#6B7B8D]">
              <Clock className="w-8 h-8 mx-auto text-[#B7C3CE] mb-2" />
              <span className="text-xs font-bold block text-[#2C3E50]">Tidak ada antrean pesanan</span>
              <span className="text-[11px] block mt-0.5">
                Pesanan dari ShopeeFood atau Website akan muncul di sini.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {ordersQueue.map((ord) => {
                const isReady = ord.total_scanned >= ord.total_items
                const channelColors = {
                  SHOPEEFOOD: 'border-orange-500 bg-orange-50 text-orange-600',
                  WEBSITE: 'border-blue-500 bg-blue-50 text-blue-600',
                  GRABFOOD: 'border-emerald-500 bg-emerald-50 text-emerald-600',
                  GOFOOD: 'border-red-500 bg-red-50 text-red-600'
                }
                const colorClass = channelColors[ord.channel] || 'border-gray-500 bg-gray-50 text-gray-700'

                return (
                  <div
                    key={ord.id}
                    className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colorClass}`}>
                          {ord.channel}
                        </span>
                        <span className="text-xs font-bold text-[#2C3E50]">#{ord.order_no}</span>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums ${
                          isReady
                            ? 'bg-[#2F7D5B] text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.total_scanned}/{ord.total_items} pack
                      </span>
                    </div>

                    <div className="text-xs text-[#2C3E50]">
                      <span className="font-semibold">{ord.customer_name || 'Driver Ojol'}</span>
                      <div className="text-[11px] text-[#6B7B8D] mt-0.5">
                        {ord.items?.map((it) => `${it.qty_ordered}x ${it.product_name}`).join(', ')}
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-[#EDE8DF]">
                      <span className="text-xs font-bold text-[#2C3E50] tabular-nums">
                        {formatRupiah(ord.total_amount)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setFulfillingOrder(ord)}
                        className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs ${
                          isReady
                            ? 'bg-[#2F7D5B] text-white hover:bg-[#27664B]'
                            : 'bg-[#3A6B80] text-white hover:bg-[#2F586B]'
                        }`}
                      >
                        {isReady ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Serahkan</span>
                          </>
                        ) : (
                          <>
                            <Scan className="w-3.5 h-3.5" />
                            <span>Scan Pack</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: RIWAYAT OMZET HARI INI */}
      {/* ===================================================================== */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5">
            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[10px] text-[#6B7B8D] block font-medium">Omzet Hari Ini</span>
              <span className="text-sm font-bold text-[#2F7D5B] tabular-nums block my-0.5">
                {formatRupiah(dailySummary?.total_revenue || 0)}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[10px] text-[#6B7B8D] block font-medium">Pack Terjual</span>
              <span className="text-sm font-bold text-[#2C3E50] tabular-nums block my-0.5">
                {dailySummary?.total_packs_sold || 0}
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2 shadow-2xs">
              <span className="text-[10px] text-[#6B7B8D] block font-medium">Transaksi</span>
              <span className="text-sm font-bold text-[#3A6B80] tabular-nums block my-0.5">
                {dailySummary?.total_transactions || 0}
              </span>
            </div>
          </div>

          {dailySummary?.by_channel && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {Object.entries(dailySummary.by_channel).map(([ch, rev]) => {
                if (rev <= 0) return null
                return (
                  <span
                    key={ch}
                    className="text-[10px] font-bold bg-[#F5F1EB] border border-[#EDE8DF] text-[#2C3E50] px-2.5 py-1 rounded-lg tabular-nums"
                  >
                    {ch}: {formatRupiah(rev)}
                  </span>
                )
              })}
            </div>
          )}

          <div className="space-y-2">
            <span className="text-xs font-bold text-[#6B7B8D] block px-1">
              Transaksi Terakhir Hari Ini
            </span>

            {isLoadingHistory ? (
              <div className="text-center py-6 text-xs text-[#6B7B8D]">Memuat transaksi...</div>
            ) : completedOrders.length === 0 ? (
              <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-xs text-[#6B7B8D]">
                Belum ada transaksi selesai hari ini.
              </div>
            ) : (
              <div className="space-y-2">
                {completedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white border border-[#EDE8DF] rounded-xl p-3 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F5F1EB] text-[#2C3E50]">
                          {ord.channel}
                        </span>
                        <span className="font-bold text-[#2C3E50]">#{ord.order_no}</span>
                      </div>
                      <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                        {ord.customer_name || 'Walk-in'} • {ord.total_items} pack • {ord.payment_method}
                      </span>
                    </div>

                    <span className="font-bold text-[#2C3E50] tabular-nums text-right">
                      {formatRupiah(ord.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <POSCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={async (scannedCode) => {
          await handleScanBarcode(scannedCode)
        }}
        title="Scan Barcode Kemasan"
      />

      <POSNewOjolOrderModal
        isOpen={isNewOjolModalOpen}
        onClose={() => setIsNewOjolModalOpen(false)}
        products={products}
        onSubmit={handleCreateOjolOrder}
      />

      <POSOrderFulfillmentModal
        order={fulfillingOrder}
        isOpen={Boolean(fulfillingOrder)}
        onClose={() => setFulfillingOrder(null)}
        onOrderUpdated={() => {
          fetchOrdersQueue()
          if (fulfillingOrder) {
            apiGet(`/pos/orders?status=PENDING_SCAN`).then((list) => {
              const matched = (list || []).find((o) => o.id === fulfillingOrder.id)
              setFulfillingOrder(matched || null)
            })
          }
        }}
      />
    </div>
  )
}
