import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  CheckCheck,
  Receipt,
  Search
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useProduction1Store } from '../../store/production1Store'
import { apiGet, apiPost } from '../../utils/api'
import { canAccess } from '../../utils/rbac'
import { playSuccessBeep, playErrorBeep, playOrderCompleteChime } from '../../utils/soundFx'
import POSCameraScannerModal from './POSCameraScannerModal'
import POSNewOjolOrderModal from './POSNewOjolOrderModal'
import POSOrderFulfillmentModal from './POSOrderFulfillmentModal'
import POSThermalReceiptModal from './POSThermalReceiptModal'

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
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const canViewRevenue = canAccess('pos:view_revenue', currentUser, isDevMode)

  // 1. Sub-Tab State: DIRECT (Kasir Indomaret) | QUEUE (Ojol & Web) | HISTORY (Rekap Omzet)
  const [activeTab, setActiveTab] = useState('DIRECT')

  // 2. State Kasir Indomaret (Speed-First)
  const [scannedList, setScannedList] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH') // CASH | QRIS | TRANSFER
  const [customPaid, setCustomPaid] = useState(null)
  const [customerName, setCustomerName] = useState('Walk-in')
  const [scanAlert, setScanAlert] = useState(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [copiedBank, setCopiedBank] = useState(null)

  // Struk Modal
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  // 3. Antrean Multi-Channel State
  const [ordersQueue, setOrdersQueue] = useState([])
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  const [isNewOjolModalOpen, setIsNewOjolModalOpen] = useState(false)
  const [fulfillingOrder, setFulfillingOrder] = useState(null)
  const [queueChannelFilter, setQueueChannelFilter] = useState('ALL') // ALL | SHOPEEFOOD | GRABFOOD | GOFOOD | WEBSITE

  // 4. Riwayat State
  const [dailySummary, setDailySummary] = useState(null)
  const [completedOrders, setCompletedOrders] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [searchHistory, setSearchHistory] = useState('')

  const barcodeInputRef = useRef(null)

  useEffect(() => {
    fetchCatalogProducts()
  }, [fetchCatalogProducts])

  // Pastikan input barcode selalu fokus otomatis agar scanner tembak fisik langsung menyala
  useEffect(() => {
    if (activeTab === 'DIRECT') {
      const timer = setTimeout(() => barcodeInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [activeTab, scannedList.length])

  const products = (storeCatalog && storeCatalog.length > 0)
    ? storeCatalog.filter((p) => Boolean(p.is_active ?? p.isDisplayActive))
    : [
        { id: 'FG_MIKA', name: 'Dimsum Mika', price: 45000, spec: '50 Pcs / Mika' },
        { id: 'FG_VAKUM', name: 'Dimsum Vakum', price: 55000, spec: '25 Pcs / Pack' }
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
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({ type: 'error', text: `Kemasan '${clean}' sudah ada di keranjang!` })
      setBarcodeInput('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    try {
      const res = await apiPost('/pos/scan-lot', { lot_qr_code: clean })
      if (isAudioEnabled) playSuccessBeep()

      const newEntry = {
        id: `${clean}-${Date.now()}`,
        lot_qr_code: res.lot_qr_code,
        product_id: res.product_id,
        product_name: res.product_name,
        price: res.price || 0,
        spec: res.spec || '',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }

      setScannedList((prev) => [newEntry, ...prev])
      setScanAlert({
        type: 'success',
        text: `+ ${res.product_name} (${clean}) - ${formatRupiah(res.price)}`
      })
      setBarcodeInput('')
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: err?.message || `Barcode '${clean}' tidak valid atau sudah terjual.`
      })
      setBarcodeInput('')
    } finally {
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }

  // Tambah Manual Produk Katalog jika Barcode Fisik Rusak/Basah
  const handleAddManualProduct = (prod) => {
    if (isAudioEnabled) playSuccessBeep()
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
    if (isAudioEnabled) playErrorBeep()
    setScannedList((prev) => prev.filter((it) => it.id !== entryId))
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const handleResetStruk = () => {
    setScannedList([])
    setCustomPaid(null)
    setBarcodeInput('')
    setScanAlert(null)
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // Selesaikan Penjualan Kasir Langsung
  const handleCompleteSale = async () => {
    if (scannedList.length === 0) return
    if (isUnderpaid) {
      alert('Uang yang diterima kurang dari total pembayaran!')
      return
    }

    setIsSubmittingCheckout(true)
    try {
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

      const finalAmountPaid = paymentMethod === 'CASH' ? amountPaid : totalAmount

      const res = await apiPost('/pos/orders/direct', {
        customer_name: customerName.trim() || 'Walk-in',
        payment_method: paymentMethod,
        amount_paid: finalAmountPaid,
        items,
        scanned_lots
      })

      if (isAudioEnabled) playOrderCompleteChime()

      // Buka Struk Digital Resmi
      setLastCompletedOrder({
        order_no: res.order?.order_no || 'ORD-NEW',
        channel: 'OFFLINE',
        customer_name: customerName.trim() || 'Walk-in',
        items,
        scanned_lots,
        total_items: totalItems,
        total_amount: totalAmount,
        amount_paid: finalAmountPaid,
        payment_method: paymentMethod,
        cashier_name: currentUser?.full_name || currentUser?.username || 'Kasir',
        completed_at: res.order?.completed_at || new Date().toISOString()
      })
      setIsReceiptModalOpen(true)

      handleResetStruk()
      setScanAlert({
        type: 'success',
        text: `TRANSAKSI SELESAI! ${formatRupiah(totalAmount)} (${paymentMethod})`
      })
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
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
      if (isAudioEnabled) playSuccessBeep()
      setIsNewOjolModalOpen(false)
      fetchOrdersQueue()
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
      alert(err?.message || 'Gagal membuat pesanan ojol.')
    }
  }

  const handleCopyBank = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedBank(key)
    setTimeout(() => setCopiedBank(null), 2000)
  }

  const filteredQueueOrders = ordersQueue.filter((ord) => {
    if (queueChannelFilter === 'ALL') return true
    return ord.channel === queueChannelFilter
  })

  const filteredHistoryOrders = completedOrders.filter((ord) => {
    if (!searchHistory.trim()) return true
    const q = searchHistory.toLowerCase()
    return (
      (ord.order_no || '').toLowerCase().includes(q) ||
      (ord.customer_name || '').toLowerCase().includes(q) ||
      (ord.channel || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-3.5 select-none pb-12">
      {/* ===================================================================== */}
      {/* TOP HEADER & MODE BAR */}
      {/* ===================================================================== */}
      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-2 shadow-2xs">
        <div className="flex items-center justify-between pb-2 px-1 border-b border-[#EDE8DF]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#2C3E50] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4 text-[#BCE3CF]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#2C3E50] font-heading block leading-none">
                POS KASIR PABRIK
              </span>
              <span className="text-[10px] text-[#556575]">
                Kasir: {currentUser?.full_name || currentUser?.username || 'Siti (Kasir)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Toggle Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                isAudioEnabled
                  ? 'bg-[#EAF5EE] text-[#2F7D5B] border-[#BCE3CF]'
                  : 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF]'
              }`}
              title={isAudioEnabled ? 'Suara Aktif' : 'Suara Senyap'}
            >
              {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden sm:inline">{isAudioEnabled ? 'Suara Bip On' : 'Mute'}</span>
            </motion.button>
          </div>
        </div>

        {/* Animated Sub-Tabs Pill Navigation */}
        <div className="grid grid-cols-3 gap-1 pt-2 relative">
          {[
            { id: 'DIRECT', label: 'Kasir', icon: Scan },
            { id: 'QUEUE', label: 'Antrean', icon: ListOrdered, badge: ordersQueue.length },
            { id: 'HISTORY', label: 'Riwayat', icon: History }
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer z-10 px-1 ${
                  active ? 'text-[#2C3E50]' : 'text-[#6B7B8D] hover:text-[#2C3E50]'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="pos-active-tab-indicator"
                    className="absolute inset-0 bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl shadow-xs -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                <span className="whitespace-nowrap">{tab.label}</span>

                {/* Badge count for pending queue */}
                {tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#E8352D] text-white text-[10px] font-mono font-bold animate-pulse shrink-0">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: KASIR ALA INDOMARET (DIRECT SPEED-FIRST SCAN) */}
      {/* ===================================================================== */}
      {activeTab === 'DIRECT' && (
        <div className="space-y-3.5">
          {/* BARCODE SCANNER COCKPIT (ALWAYS LISTENING) */}
          <div className="bg-white border-2 border-[#2C3E50]/20 focus-within:border-[#2F7D5B] focus-within:ring-4 focus-within:ring-[#2F7D5B]/10 rounded-2xl p-3 shadow-xs transition-all">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F7D5B] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2F7D5B]" />
                </span>
                <span className="text-[11px] font-extrabold text-[#2F7D5B] tracking-tight uppercase">
                  Scanner Siap
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Scan className="w-5 h-5 text-[#3A6B80] absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                  placeholder="Scan barcode..."
                  className="w-full h-12 bg-[#F5F1EB] rounded-xl pl-11 pr-8 font-mono text-sm font-bold uppercase text-[#2C3E50] border border-[#B7C3CE] focus:bg-white focus:outline-none focus:border-[#2F7D5B] transition-colors shadow-inner"
                />
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setBarcodeInput('')
                      barcodeInputRef.current?.focus()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7B8D] hover:text-[#2C3E50]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Kamera HP Fallback */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsCameraOpen(true)}
                className="w-12 h-12 rounded-xl bg-[#EEF5F9] border border-[#6A9DB3]/40 text-[#3A6B80] flex items-center justify-center hover:bg-[#D1E4EF] cursor-pointer shrink-0 shadow-2xs"
                title="Buka Kamera HP"
              >
                <Camera className="w-5 h-5 stroke-[2.2]" />
              </motion.button>
            </div>

            {/* Quick Catalog Chips jika barcode fisik rusak/basah */}
            <div className="pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {products.map((p) => (
                <motion.button
                  key={p.id}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleAddManualProduct(p)}
                  className="px-3 py-1 rounded-lg bg-[#F5F1EB] border border-[#EDE8DF] text-[11px] font-bold text-[#2C3E50] hover:bg-[#EDE8DF] shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3 text-[#2F7D5B]" />
                  <span>{p.name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Feedback Banner with AnimatePresence */}
          <AnimatePresence>
            {scanAlert && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs overflow-hidden ${
                  scanAlert.type === 'success'
                    ? 'bg-[#2F7D5B] text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  {scanAlert.type === 'success' ? <Check className="w-4 h-4 stroke-[3]" /> : <AlertCircle className="w-4 h-4 stroke-[2.5]" />}
                  <span>{scanAlert.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanAlert(null)}
                  className="text-xs text-white/80 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STRUK BERJALAN DIGITAL (RECEIPT TICKER) */}
          <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#3A6B80]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C3E50] font-heading">
                  Keranjang
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#2C3E50] text-white tabular-nums">
                  {totalItems} pack
                </span>
              </div>

              {scannedList.length > 0 && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleResetStruk}
                  className="text-[11px] font-bold text-rose-600 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </motion.button>
              )}
            </div>

            {/* List Baris Struk with AnimatePresence */}
            {scannedList.length === 0 ? (
              <div className="text-center py-6 text-[#556575] space-y-1.5">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-10 h-10 mx-auto rounded-2xl bg-[#F5F1EB] flex items-center justify-center text-[#B7C3CE]"
                >
                  <Scan className="w-5 h-5 stroke-[1.8] text-[#3A6B80]" />
                </motion.div>
                <span className="text-xs font-bold text-[#556575] block">Keranjang Kosong</span>
              </div>
            ) : (
              <div className="divide-y divide-[#EDE8DF] max-h-56 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {scannedList.map((it, idx) => (
                    <motion.div
                      key={it.id}
                      initial={{ opacity: 0, y: -12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#F5F1EB]/50 px-1.5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-[#6B7B8D] w-4 text-center">
                          {totalItems - idx}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2C3E50] truncate">{it.product_name}</span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#F5F1EB] text-[#3A6B80] shrink-0 border border-[#EDE8DF]">
                              {it.lot_qr_code}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#556575]">{it.timestamp}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-[#2C3E50] tabular-nums font-mono">
                          {formatRupiah(it.price)}
                        </span>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleRemoveItem(it.id)}
                          className="w-7 h-7 rounded-lg text-[#6B7B8D] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* PANEL PEMBAYARAN JUMBO ALA INDOMARET (DIRECT INLINE TERMINAL) */}
          {/* ================================================================= */}
          <div className="bg-[#1E293B] rounded-3xl p-5 text-white shadow-xl space-y-4 border border-white/10">
            {/* Display TOTAL Jumbo */}
            <div className="space-y-2 border-b border-white/10 pb-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] block">
                    TOTAL
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    {totalItems} pack
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight tabular-nums text-white">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Pelanggan:
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in"
                  className="w-36 h-7 bg-white/10 hover:bg-white/15 focus:bg-white/20 rounded-lg px-2 text-right text-xs font-medium text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-[#10B981] transition-colors"
                />
              </div>
            </div>

            {/* Segmented Selector: Tunai, QRIS, Transfer */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                Metode Bayar
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
                    <motion.button
                      key={m.id}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setPaymentMethod(m.id)
                        if (m.id !== 'CASH') setCustomPaid(null)
                        setTimeout(() => barcodeInputRef.current?.focus(), 50)
                      }}
                      className={`h-11 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#10B981] text-white shadow-lg ring-2 ring-[#10B981]/40'
                          : 'bg-white/10 text-white/80 hover:bg-white/15'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* DYNAMIC PAYMENT METHOD BODY */}
            {paymentMethod === 'CASH' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2.5 bg-black/25 rounded-2xl p-3.5 border border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#94A3B8] shrink-0">Bayar:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#64748B]">Rp</span>
                    <input
                      type="number"
                      value={amountPaid || ''}
                      onChange={(e) => setCustomPaid(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-40 h-10 bg-white rounded-xl pl-8 pr-3 text-right font-extrabold text-sm tabular-nums text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                    />
                  </div>
                </div>

                {/* Tombol Pecahan Uang Cepat (Indomaret Quick Cash Chips) */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setCustomPaid(totalAmount)}
                    className="h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-all"
                  >
                    Uang Pas
                  </motion.button>
                  {[50000, 100000, 200000].map((val) => (
                    <motion.button
                      key={val}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setCustomPaid(val)}
                      className="h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold tabular-nums transition-all"
                    >
                      {(val / 1000).toLocaleString('id-ID')}rb
                    </motion.button>
                  ))}
                </div>

                {/* Kembalian Highlight Box */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                  <span className="text-xs font-bold text-[#94A3B8]">Kembalian:</span>
                  <span
                    className={`text-xl font-extrabold tabular-nums font-heading ${
                      isUnderpaid ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isUnderpaid ? `Kurang ${formatRupiah(totalAmount - amountPaid)}` : formatRupiah(change)}
                  </span>
                </div>
              </motion.div>
            )}

            {paymentMethod === 'QRIS' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/25 rounded-2xl p-4 border border-white/10 text-center space-y-2.5"
              >
                <div className="inline-block p-3 bg-white rounded-2xl shadow-md">
                  <QRCodeSVG
                    value={`00020101021226580016ID.CO.DIMSUM.MDI0118936009180000000000520458125303360540${totalAmount}5802ID5917DIMSUM PABRIK MDI6007JAKARTA6304`}
                    size={130}
                    level="M"
                  />
                </div>
                <span className="text-xs font-bold text-white block">QRIS MDI</span>
              </motion.div>
            )}

            {paymentMethod === 'TRANSFER' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/25 rounded-2xl p-3.5 border border-white/10 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-xl border border-white/10">
                  <div>
                    <span className="font-extrabold text-white block">BCA: 8820-1928-1120</span>
                    <span className="text-[10px] text-[#94A3B8]">PT Dimsum Manufaktur</span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleCopyBank('882019281120', 'BCA')}
                    className="h-8 px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBank === 'BCA' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBank === 'BCA' ? 'Tersalin' : 'Salin'}</span>
                  </motion.button>
                </div>

                <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-xl border border-white/10">
                  <div>
                    <span className="font-extrabold text-white block">Mandiri: 1320-0012-9981</span>
                    <span className="text-[10px] text-[#94A3B8]">PT Dimsum Manufaktur</span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleCopyBank('132000129981', 'MANDIRI')}
                    className="h-8 px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBank === 'MANDIRI' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBank === 'MANDIRI' ? 'Tersalin' : 'Salin'}</span>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* TOMBOL BAYAR & SELESAI JUMBO */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={scannedList.length === 0 || isUnderpaid || isSubmittingCheckout}
              onClick={handleCompleteSale}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all uppercase tracking-wide font-heading"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>{isSubmittingCheckout ? 'Memproses Transaksi...' : 'SELESAI & POTONG STOK'}</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ANTREAN OJOL & WEB (MULTI-CHANNEL DELIVERY) */}
      {/* ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-3.5">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#2C3E50] font-heading">
              Antrean Pesanan ({ordersQueue.length})
            </span>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsNewOjolModalOpen(true)}
              className="h-9 px-3 rounded-xl bg-[#3A6B80] hover:bg-[#2F586B] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Order Ojol</span>
            </motion.button>
          </div>

          {/* Filter Channels Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-0.5">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'SHOPEEFOOD', label: 'Shopee' },
              { id: 'GRABFOOD', label: 'Grab' },
              { id: 'GOFOOD', label: 'Gojek' },
              { id: 'WEBSITE', label: 'Web' }
            ].map((f) => {
              const active = queueChannelFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQueueChannelFilter(f.id)}
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

          {/* List Antrean */}
          {isLoadingQueue ? (
            <div className="text-center py-8 text-xs text-[#556575]">Memuat antrean...</div>
          ) : filteredQueueOrders.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-[#556575] space-y-1 shadow-2xs">
              <Clock className="w-8 h-8 mx-auto text-[#B7C3CE] mb-1" />
              <span className="text-xs font-bold block text-[#2C3E50]">Tidak Ada Antrean</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueueOrders.map((ord) => {
                const isReady = ord.total_scanned >= ord.total_items
                const channelColors = {
                  SHOPEEFOOD: 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D]',
                  WEBSITE: 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]',
                  GRABFOOD: 'border-[#00B14F] bg-[#00B14F]/10 text-[#00B14F]',
                  GOFOOD: 'border-[#ED2724] bg-[#ED2724]/10 text-[#ED2724]'
                }
                const colorClass = channelColors[ord.channel] || 'border-gray-500 bg-gray-50 text-gray-700'
                const progressPct = Math.round((ord.total_scanned / (ord.total_items || 1)) * 100)

                return (
                  <motion.div
                    key={ord.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${colorClass}`}>
                          {ord.channel}
                        </span>
                        <span className="text-xs font-bold text-[#2C3E50] font-heading">
                          #{ord.order_no}
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums font-mono ${
                          isReady
                            ? 'bg-[#2F7D5B] text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.total_scanned}/{ord.total_items} pack
                      </span>
                    </div>

                    <div className="text-xs text-[#2C3E50]">
                      <span className="font-bold">{ord.customer_name || 'Driver Ojol'}</span>
                      <div className="text-[11px] text-[#556575] mt-0.5">
                        {ord.items?.map((it) => `${it.qty_ordered}x ${it.product_name}`).join(', ')}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-[#EDE8DF] overflow-hidden">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          isReady ? 'bg-[#2F7D5B]' : 'bg-[#3A6B80]'
                        }`}
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-[#EDE8DF]">
                      <span className="text-xs font-bold text-[#2C3E50] tabular-nums font-mono">
                        {canViewRevenue && ord.total_amount != null
                          ? formatRupiah(ord.total_amount)
                          : `${ord.total_items} pack`}
                      </span>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setFulfillingOrder(ord)}
                        className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isReady
                            ? 'bg-[#2F7D5B] text-white hover:bg-[#27664B]'
                            : 'bg-[#3A6B80] text-white hover:bg-[#2F586B]'
                        }`}
                      >
                        {isReady ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Serahkan</span>
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4" />
                            <span>Scan Pack</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: RIWAYAT & REKAP TRANSAKSI */}
      {/* ===================================================================== */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-3.5">
          {/* Stat Cards */}
          <div className={`grid ${canViewRevenue ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center bg-[#F5F1EB] border border-[#EDE8DF] rounded-2xl p-2.5`}>
            {canViewRevenue && (
              <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
                <span className="text-[10px] text-[#556575] block font-semibold">Omzet</span>
                <span className="text-base font-extrabold text-[#2F7D5B] tabular-nums block my-0.5 font-heading">
                  {formatRupiah(dailySummary?.total_revenue || 0)}
                </span>
              </div>
            )}

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#556575] block font-semibold">Terjual</span>
              <span className="text-base font-extrabold text-[#2C3E50] tabular-nums block my-0.5 font-heading">
                {dailySummary?.total_packs_sold || 0} pack
              </span>
            </div>

            <div className="bg-white border border-[#EDE8DF] rounded-xl p-2.5 shadow-2xs">
              <span className="text-[10px] text-[#556575] block font-semibold">Transaksi</span>
              <span className="text-base font-extrabold text-[#3A6B80] tabular-nums block my-0.5 font-heading">
                {dailySummary?.total_transactions || 0}
              </span>
            </div>
          </div>

          {/* Channel Revenue Chips (Khusus Supervisor / PIC) */}
          {canViewRevenue && dailySummary?.by_channel && (
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

          {/* Search History */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7B8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari order / nama..."
              className="w-full h-10 bg-white rounded-xl pl-9 pr-3 text-xs border border-[#EDE8DF] text-[#2C3E50] focus:outline-none focus:border-[#3A6B80]"
            />
          </div>

          {/* List Riwayat Transaksi */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#556575] block px-1">
              Riwayat Transaksi
            </span>

            {isLoadingHistory ? (
              <div className="text-center py-6 text-xs text-[#556575]">Memuat data...</div>
            ) : filteredHistoryOrders.length === 0 ? (
              <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-xs text-[#556575]">
                Belum ada transaksi.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistoryOrders.map((ord) => (
                  <motion.div
                    key={ord.id}
                    whileTap={{ scale: canViewRevenue ? 0.98 : 1 }}
                    onClick={() => {
                      if (!canViewRevenue) return
                      setLastCompletedOrder({
                        ...ord,
                        cashier_name: ord.cashier_name || 'Kasir'
                      })
                      setIsReceiptModalOpen(true)
                    }}
                    className={`bg-white border border-[#EDE8DF] rounded-xl p-3 shadow-2xs flex items-center justify-between text-xs transition-colors ${
                      canViewRevenue ? 'hover:border-[#3A6B80] cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F5F1EB] text-[#2C3E50]">
                          {ord.channel}
                        </span>
                        <span className="font-bold text-[#2C3E50]">#{ord.order_no}</span>
                      </div>
                      <span className="text-[11px] text-[#556575] block mt-0.5">
                        {ord.customer_name || 'Walk-in'} • {ord.total_items} pack • {ord.payment_method}
                      </span>
                    </div>

                    <div className="text-right">
                      {canViewRevenue && ord.total_amount != null ? (
                        <span className="font-bold text-[#2C3E50] tabular-nums block">
                          {formatRupiah(ord.total_amount)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-[#2F7D5B] block">
                          Selesai
                        </span>
                      )}
                      {canViewRevenue && (
                        <span className="text-[10px] text-[#3A6B80] hover:underline flex items-center justify-end gap-0.5">
                          <span>Lihat Struk</span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}

      {/* 1. Modal Kamera HP Fallback */}
      <POSCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={async (scannedCode) => {
          await handleScanBarcode(scannedCode)
        }}
        title="Scan Kemasan Dimsum"
      />

      {/* 2. Modal Input Pesanan Ojol */}
      <POSNewOjolOrderModal
        isOpen={isNewOjolModalOpen}
        onClose={() => setIsNewOjolModalOpen(false)}
        products={products}
        onSubmit={handleCreateOjolOrder}
      />

      {/* 3. Modal Pemenuhan Kemasan Ojol / Web */}
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

      {/* 4. Modal Struk Thermal Kasir Resmi */}
      <POSThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={lastCompletedOrder}
      />
    </div>
  )
}
