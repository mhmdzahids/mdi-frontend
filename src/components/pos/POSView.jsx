import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ShoppingBag,
  ListOrdered,
  History,
  Scan,
  Camera,
  Plus,
  Minus,
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
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2
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
import POSQrisModal from './POSQrisModal'
import POSVaModal from './POSVaModal'
import POSPostPaymentScanModal from './POSPostPaymentScanModal'

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
  const [cartItems, setCartItems] = useState([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH') // CASH | QRIS | TRANSFER
  const [customPaid, setCustomPaid] = useState(null)
  const [customerName, setCustomerName] = useState('Walk-in')
  const [scanAlert, setScanAlert] = useState(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [copiedBank, setCopiedBank] = useState(null)

  // 2.B State Payment Gateway (Paywuz QRIS & Virtual Account)
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false)
  const [qrisData, setQrisData] = useState(null)
  const [isGeneratingQris, setIsGeneratingQris] = useState(false)
  const [isQrisPaid, setIsQrisPaid] = useState(false)
  const [qrisCheckLoading, setQrisCheckLoading] = useState(false)

  const [isVaModalOpen, setIsVaModalOpen] = useState(false)
  const [transferType, setTransferType] = useState('MANUAL') // MANUAL | VA
  const [vaData, setVaData] = useState(null)
  const [vaLoading, setVaLoading] = useState(false)
  const [vaBank, setVaBank] = useState('BCAVA')
  const [isVaPaid, setIsVaPaid] = useState(false)
  const [vaCheckLoading, setVaCheckLoading] = useState(false)

  // 2.C State Scan Out Kemasan Fisik Setelah Pembayaran (Opsi A)
  const [isPostScanModalOpen, setIsPostScanModalOpen] = useState(false)
  const [pendingPaidOrderInfo, setPendingPaidOrderInfo] = useState(null)

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

  // 5. Real-time Inventory Stock (Hasil Verifikasi ACC Sales)
  const [inventoryStock, setInventoryStock] = useState({})
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  const barcodeInputRef = useRef(null)

  const fetchInventoryStock = async () => {
    try {
      setIsLoadingStock(true)
      const res = await apiGet('/pos/inventory-summary', { silent: true })
      if (res && res.success && Array.isArray(res.data)) {
        const stockMap = {}
        res.data.forEach((item) => {
          stockMap[item.product_id] = item
        })
        setInventoryStock(stockMap)
      }
    } catch (err) {
      console.warn('Failed to load inventory summary:', err?.message)
    } finally {
      setIsLoadingStock(false)
    }
  }

  useEffect(() => {
    fetchCatalogProducts()
    fetchInventoryStock()
  }, [fetchCatalogProducts])

  // Pastikan input barcode selalu fokus otomatis agar scanner tembak fisik langsung menyala
  useEffect(() => {
    if (activeTab === 'DIRECT') {
      fetchInventoryStock()
      const timer = setTimeout(() => barcodeInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [activeTab, cartItems.length])

  const products = (storeCatalog && storeCatalog.length > 0)
    ? storeCatalog.filter((p) => Boolean(p.is_active ?? p.isDisplayActive))
    : [
        { id: 'FG_MIKA', name: 'Dimsum Mika', price: 45000, spec: '50 Pcs / Mika' },
        { id: 'FG_VAKUM', name: 'Dimsum Vakum', price: 55000, spec: '25 Pcs / Pack' }
      ]

  // Perhitungan Kasir
  const totalAmount = cartItems.reduce((acc, it) => acc + ((it.price || 0) * (it.qty || 1)), 0)
  const totalItems = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
  const totalScannedLots = cartItems.reduce((acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0), 0)
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

    // Cegah scan ganda kode QR kemasan fisik yang sama dalam satu sesi transaksi
    const isAlreadyScanned = cartItems.some((it) => (it.scanned_lots || []).includes(clean))
    if (isAlreadyScanned) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({ type: 'error', text: `'${clean}' sudah di keranjang` })
      setBarcodeInput('')
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    try {
      const res = await apiPost('/pos/scan-lot', { lot_qr_code: clean })
      if (isAudioEnabled) playSuccessBeep()

      setCartItems((prev) => {
        const existingIndex = prev.findIndex((it) => it.product_id === res.product_id)

        if (existingIndex >= 0) {
          const item = prev[existingIndex]
          const currentLots = item.scanned_lots || []
          const updated = [...prev]

          if (currentLots.length < item.qty) {
            updated[existingIndex] = {
              ...item,
              scanned_lots: [...currentLots, clean]
            }
            setScanAlert({
              type: 'success',
              text: `✓ ${clean}`
            })
          } else {
            updated[existingIndex] = {
              ...item,
              qty: item.qty + 1,
              scanned_lots: [...currentLots, clean]
            }
            setScanAlert({
              type: 'success',
              text: `+1 ${item.product_name} (${clean})`
            })
          }
          return updated
        } else {
          setScanAlert({
            type: 'success',
            text: `+ ${res.product_name} (${clean})`
          })
          return [
            ...prev,
            {
              product_id: res.product_id,
              product_name: res.product_name,
              price: res.price || 0,
              spec: res.spec || '',
              qty: 1,
              scanned_lots: [clean]
            }
          ]
        }
      })

      setBarcodeInput('')
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: err?.message || `'${clean}' tidak valid`
      })
      setBarcodeInput('')
    } finally {
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }

  // Tambah Produk dari Katalog (Hanya nama produk & harga, tanpa QR otomatis)
  const handleAddProduct = (prod) => {
    // Anti-Overselling Guard: Cek stok fisik hasil ACC verifikasi Sales
    const stockInfo = inventoryStock[prod.id]
    const verifiedStock = stockInfo ? (stockInfo.verified_sales_stock ?? 0) : 0
    const existingIndex = cartItems.findIndex((it) => it.product_id === prod.id)
    const currentQtyInCart = existingIndex >= 0 ? cartItems[existingIndex].qty : 0

    if (stockInfo && (currentQtyInCart + 1 > verifiedStock)) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: verifiedStock <= 0
          ? `Stok '${prod.name}' habis (0 pack di-ACC Sales)!`
          : `Stok '${prod.name}' tidak mencukupi! Hanya ada ${verifiedStock} pack siap jual.`
      })
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    if (isAudioEnabled) playSuccessBeep()
    setCartItems((prev) => {
      if (existingIndex >= 0) {
        const updated = [...prev]
        const current = updated[existingIndex]
        updated[existingIndex] = {
          ...current,
          qty: current.qty + 1
        }
        return updated
      } else {
        return [
          ...prev,
          {
            product_id: prod.id,
            product_name: prod.name,
            price: prod.price || 0,
            spec: prod.spec || '',
            qty: 1,
            scanned_lots: []
          }
        ]
      }
    })
    setScanAlert({
      type: 'success',
      text: `+ ${prod.name}`
    })
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // Ubah Jumlah Qty Produk (+ / -)
  const handleUpdateQty = (productId, newQty) => {
    const stockInfo = inventoryStock[productId]
    const verifiedStock = stockInfo ? (stockInfo.verified_sales_stock ?? 0) : 0

    if (stockInfo && newQty > verifiedStock) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: `Maksimal stok siap jual (ACC Sales) adalah ${verifiedStock} pack.`
      })
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
      return
    }

    setCartItems((prev) => {
      if (newQty <= 0) {
        if (isAudioEnabled) playErrorBeep()
        return prev.filter((it) => it.product_id !== productId)
      }
      return prev.map((it) => {
        if (it.product_id !== productId) return it
        const trimmedLots = it.scanned_lots ? it.scanned_lots.slice(0, newQty) : []
        return {
          ...it,
          qty: newQty,
          scanned_lots: trimmedLots
        }
      })
    })
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // Hapus Satu Jenis Produk dari Keranjang
  const handleRemoveProduct = (productId) => {
    if (isAudioEnabled) playErrorBeep()
    setCartItems((prev) => prev.filter((it) => it.product_id !== productId))
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // Lepas Satu Kode QR Fisik dari Produk
  const handleRemoveScannedLot = (productId, lotCode) => {
    if (isAudioEnabled) playErrorBeep()
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.product_id !== productId) return it
        return {
          ...it,
          scanned_lots: (it.scanned_lots || []).filter((c) => c !== lotCode)
        }
      })
    )
    setScanAlert({
      type: 'info',
      text: `'${lotCode}' dilepas`
    })
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  const handleResetStruk = () => {
    setCartItems([])
    setCustomPaid(null)
    setBarcodeInput('')
    setScanAlert(null)
    setQrisData(null)
    setIsQrisPaid(false)
    setIsQrisModalOpen(false)
    setVaData(null)
    setIsVaPaid(false)
    setIsVaModalOpen(false)
    setIsPostScanModalOpen(false)
    setPendingPaidOrderInfo(null)
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }

  // ==========================================
  // PAYMENT GATEWAY (PAYWUZ DYNAMIC QRIS & VA)
  // ==========================================

  const handleGenerateQris = async (forceNew = false) => {
    if (totalAmount <= 0) return
    if (qrisData && !forceNew && qrisData.amount === totalAmount && !isQrisPaid) return

    setIsGeneratingQris(true)
    setIsQrisPaid(false)
    try {
      const res = await apiPost('/pos/payment/qris', {
        amount: totalAmount,
        customer_name: customerName?.trim() || 'Walk-in',
        phone: '081234567890'
      })
      if (res?.success && res.data) {
        setQrisData(res.data)
      }
    } catch (err) {
      setScanAlert({ type: 'error', text: err?.message || 'Gagal memuat QRIS Paywuz' })
    } finally {
      setIsGeneratingQris(false)
    }
  }

  // Mulai Transaksi QRIS (Standard POS Checkout Flow)
  const handleStartQrisTransaction = () => {
    if (cartItems.length === 0) {
      setScanAlert({ type: 'error', text: 'Keranjang belanja masih kosong' })
      return
    }

    setIsQrisModalOpen(true)
    handleGenerateQris(true)
  }

  const handleCheckPaymentStatus = async (orderId, isSilent = false) => {
    if (!orderId) return
    if (!isSilent) setQrisCheckLoading(true)
    try {
      const res = await apiGet(`/pos/payment/status/${orderId}`, { silent: isSilent })
      if (res?.is_paid) {
        setIsQrisPaid(true)
        if (isAudioEnabled) playSuccessBeep()
        setScanAlert({ type: 'success', text: 'Pembayaran QRIS Berhasil (Lunas)!' })
      } else if (!isSilent) {
        setScanAlert({ type: 'info', text: 'Belum terbayar, menunggu scan pembeli' })
      }
    } catch (err) {
      if (!isSilent) {
        setScanAlert({ type: 'error', text: 'Gagal memeriksa status' })
      }
    } finally {
      if (!isSilent) setQrisCheckLoading(false)
    }
  }

  const handleSimulateSandboxPayment = () => {
    if (import.meta.env.PROD) return
    setIsQrisPaid(true)
    if (isAudioEnabled) playSuccessBeep()
    setScanAlert({ type: 'success', text: 'Simulasi Sandbox: QRIS Lunas!' })
  }

  const handleGenerateVA = async (bankCode) => {
    if (totalAmount <= 0) return
    setVaLoading(true)
    setIsVaPaid(false)
    try {
      const res = await apiPost('/pos/payment/va', {
        amount: totalAmount,
        bank_code: bankCode || vaBank,
        customer_name: customerName?.trim() || 'Walk-in'
      })
      if (res?.success && res.data) {
        setVaData(res.data)
      } else {
        throw new Error(res?.message || 'Gagal memuat Virtual Account')
      }
    } catch (err) {
      setScanAlert({ type: 'error', text: err?.message || 'Gagal membuat VA' })
    } finally {
      setVaLoading(false)
    }
  }

  // Mulai Transaksi Virtual Account (Standard POS Checkout Flow)
  const handleStartVaTransaction = () => {
    if (cartItems.length === 0) {
      setScanAlert({ type: 'error', text: 'Keranjang belanja masih kosong' })
      return
    }

    setIsVaModalOpen(true)
    handleGenerateVA(vaBank)
  }

  const handleCheckVaPaymentStatus = async (orderId, isSilent = false) => {
    if (!orderId) return
    if (!isSilent) setVaCheckLoading(true)
    try {
      const res = await apiGet(`/pos/payment/status/${orderId}`, { silent: isSilent })
      if (res?.is_paid) {
        setIsVaPaid(true)
        if (isAudioEnabled) playSuccessBeep()
        setScanAlert({ type: 'success', text: 'Pembayaran Virtual Account Berhasil (Lunas)!' })
      } else if (!isSilent) {
        setScanAlert({ type: 'info', text: 'Belum terbayar, menunggu transfer pelanggan' })
      }
    } catch (err) {
      if (!isSilent) {
        setScanAlert({ type: 'error', text: 'Gagal memeriksa status VA' })
      }
    } finally {
      if (!isSilent) setVaCheckLoading(false)
    }
  }

  const handleSimulateVaPayment = () => {
    if (import.meta.env.PROD) return
    setIsVaPaid(true)
    if (isAudioEnabled) playSuccessBeep()
    setScanAlert({ type: 'success', text: 'Simulasi Sandbox: Virtual Account Lunas!' })
  }

  // Selesaikan Penjualan Kasir Langsung
  const handleCompleteSale = async (overrideMethod, overridePaymentRef) => {
    if (cartItems.length === 0) return
    const method = overrideMethod || paymentMethod
    if (method === 'CASH' && isUnderpaid) {
      setScanAlert({ type: 'error', text: 'Nominal pembayaran kurang' })
      return
    }

    setIsSubmittingCheckout(true)
    try {
      const items = cartItems.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        price: it.price || 0,
        qty: it.qty || 1
      }))

      const scanned_lots = cartItems.flatMap((it) =>
        (it.scanned_lots || []).map((code) => ({
          lot_qr_code: code,
          product_id: it.product_id,
          product_name: it.product_name
        }))
      )

      const finalAmountPaid = method === 'CASH' ? amountPaid : totalAmount
      const paymentRef = overridePaymentRef || (
        method === 'QRIS'
          ? (qrisData?.orderId || qrisData?.id || null)
          : (method === 'TRANSFER' && transferType === 'VA')
            ? (vaData?.orderId || vaData?.id || null)
            : null
      )

      const res = await apiPost('/pos/orders/direct', {
        customer_name: customerName.trim() || 'Walk-in',
        payment_method: method,
        amount_paid: finalAmountPaid,
        payment_ref: paymentRef,
        items,
        scanned_lots
      })

      if (isAudioEnabled) playOrderCompleteChime()

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
      fetchInventoryStock()
      setScanAlert({
        type: 'success',
        text: 'Transaksi selesai'
      })
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: err?.message || 'Gagal menyimpan transaksi'
      })
    } finally {
      setIsSubmittingCheckout(false)
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    }
  }


  // Polling cek status pembayaran QRIS HANYA saat modal pembayaran QRIS aktif terbuka
  useEffect(() => {
    if (!isQrisModalOpen || !qrisData?.orderId || isQrisPaid) return

    const poll = setInterval(() => {
      handleCheckPaymentStatus(qrisData.orderId, true)
    }, 3000)

    return () => clearInterval(poll)
  }, [isQrisModalOpen, qrisData?.orderId, isQrisPaid])

  // Otomatis tangani pembayaran QRIS lunas (Opsi A)
  useEffect(() => {
    if (isQrisModalOpen && isQrisPaid && qrisData && !isSubmittingCheckout) {
      const timer = setTimeout(async () => {
        try {
          setIsQrisModalOpen(false)
          const totalItemsCount = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
          const totalScannedCount = cartItems.reduce(
            (acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0),
            0
          )

          if (totalScannedCount >= totalItemsCount && totalItemsCount > 0) {
            await handleCompleteSale('QRIS', qrisData?.orderId || qrisData?.id)
          } else {
            setPendingPaidOrderInfo({
              method: 'QRIS',
              paymentRef: qrisData?.orderId || qrisData?.id,
              customerName: customerName.trim() || 'Walk-in',
              amountPaid: totalAmount,
              totalAmount
            })
            setIsPostScanModalOpen(true)
          }
        } catch {
          // penanganan error di handleCompleteSale
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isQrisModalOpen, isQrisPaid, qrisData, isSubmittingCheckout, cartItems, totalAmount, customerName])

  // Polling cek status pembayaran VA HANYA saat modal pembayaran VA aktif terbuka
  useEffect(() => {
    if (!isVaModalOpen || !vaData?.orderId || isVaPaid) return

    const poll = setInterval(() => {
      handleCheckVaPaymentStatus(vaData.orderId, true)
    }, 3000)

    return () => clearInterval(poll)
  }, [isVaModalOpen, vaData?.orderId, isVaPaid])

  // Otomatis tangani pembayaran VA lunas (Opsi A)
  useEffect(() => {
    if (isVaModalOpen && isVaPaid && vaData && !isSubmittingCheckout) {
      const timer = setTimeout(async () => {
        try {
          setIsVaModalOpen(false)
          const totalItemsCount = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
          const totalScannedCount = cartItems.reduce(
            (acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0),
            0
          )

          if (totalScannedCount >= totalItemsCount && totalItemsCount > 0) {
            await handleCompleteSale('TRANSFER', vaData?.orderId || vaData?.id)
          } else {
            setPendingPaidOrderInfo({
              method: 'TRANSFER',
              paymentRef: vaData?.orderId || vaData?.id,
              customerName: customerName.trim() || 'Walk-in',
              amountPaid: totalAmount,
              totalAmount
            })
            setIsPostScanModalOpen(true)
          }
        } catch {
          // penanganan error di handleCompleteSale
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isVaModalOpen, isVaPaid, vaData, isSubmittingCheckout, cartItems, totalAmount, customerName])

  // Mulai Checkout Manual Tunai / Transfer Rekening (Opsi A)
  const handleStartManualCheckout = () => {
    if (cartItems.length === 0) return
    if (paymentMethod === 'CASH' && isUnderpaid) {
      setScanAlert({ type: 'error', text: 'Nominal pembayaran kurang' })
      return
    }

    if (totalScannedLots >= totalItems && totalItems > 0) {
      handleCompleteSale()
    } else {
      setPendingPaidOrderInfo({
        method: paymentMethod,
        paymentRef: null,
        customerName: customerName.trim() || 'Walk-in',
        amountPaid: paymentMethod === 'CASH' ? amountPaid : totalAmount,
        totalAmount
      })
      setIsPostScanModalOpen(true)
    }
  }

  // Simpan Pesanan Terbayar ke Antrean jika kasir sibuk (Opsi A)
  const handleSavePaidOrderToQueue = async () => {
    if (!pendingPaidOrderInfo || cartItems.length === 0) return
    setIsSubmittingCheckout(true)
    try {
      const items = cartItems.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        price: it.price || 0,
        qty: it.qty || 1
      }))

      const orderNo = `OFF-${Date.now().toString().slice(-6)}`
      await apiPost('/pos/orders', {
        order_no: orderNo,
        channel: 'OFFLINE',
        customer_name: pendingPaidOrderInfo.customerName || 'Walk-in',
        payment_method: pendingPaidOrderInfo.method || 'CASH',
        items,
        notes: `Pembayaran Lunas (${pendingPaidOrderInfo.method}). Menunggu scan kemasan di antrean.`
      })

      if (isAudioEnabled) playSuccessBeep()
      setIsPostScanModalOpen(false)
      handleResetStruk()
      fetchOrdersQueue()
      setScanAlert({
        type: 'success',
        text: `Pesanan #${orderNo} disimpan ke Antrean Scan`
      })
    } catch (err) {
      if (isAudioEnabled) playErrorBeep()
      setScanAlert({
        type: 'error',
        text: err?.message || 'Gagal menyimpan ke antrean'
      })
    } finally {
      setIsSubmittingCheckout(false)
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
    <div className="space-y-4 select-none pb-12">
      {/* ===================================================================== */}
      {/* TOP HEADER & MODE BAR */}
      {/* ===================================================================== */}
      <div className="bg-white border border-[#EDE8DF] rounded-2xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 px-1 border-b border-[#EDE8DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2C3E50] text-white flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-[#BCE3CF]" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-[#2C3E50] font-heading block leading-none">
                Kasir
              </span>
              <span className="text-[11px] text-[#6B7B8D] mt-0.5 block">
                {currentUser?.full_name || currentUser?.username || 'Kasir'} · Terminal #{currentUser?.operator_id || '01'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`h-7 px-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              isAudioEnabled
                ? 'bg-[#EAF5EE] text-[#2F7D5B] border-[#BCE3CF]'
                : 'bg-[#F5F1EB] text-[#6B7B8D] border-[#EDE8DF]'
            }`}
            title={isAudioEnabled ? 'Suara aktif' : 'Senyap'}
          >
            {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#2F7D5B]" /> : <VolumeX className="w-3.5 h-3.5 text-[#6B7B8D]" />}
            <span className="text-[10px]">{isAudioEnabled ? 'Suara' : 'Mute'}</span>
          </button>
        </div>

        {/* Sub-Tabs Pill Navigation */}
        <div className="grid grid-cols-3 gap-1.5 pt-2.5 relative">
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
                className={`relative h-10 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer z-10 px-2 ${
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
                <span>{tab.label}</span>

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
      {/* TAB 1: KASIR */}
      {/* ===================================================================== */}
      {activeTab === 'DIRECT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* KOLOM KIRI: SCANNER, PRODUK, & KERANJANG (7 Cols di Desktop) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-3.5">
            {/* BARCODE SCANNER */}
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Scan className="w-4 h-4 text-[#6B7B8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                    placeholder="Scan barcode kemasan..."
                    className="w-full h-10 bg-[#F5F1EB] rounded-xl pl-10 pr-8 font-mono text-xs font-semibold text-[#2C3E50] border border-[#EDE8DF] focus:bg-white focus:outline-none focus:border-[#4685ac] transition-colors"
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

                {/* Kamera Modal Trigger */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setIsCameraOpen(true)}
                  className="w-10 h-10 rounded-xl bg-[#F5F1EB] border border-[#EDE8DF] text-[#556575] hover:text-[#2C3E50] hover:bg-[#EDE8DF] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  title="Kamera"
                >
                  <Camera className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Mobile Quick Product Chips */}
              <div className="pt-2 flex sm:hidden items-center gap-1.5 overflow-x-auto no-scrollbar">
                {products.map((p) => {
                  const inCart = cartItems.find((it) => it.product_id === p.id)
                  const stockInfo = inventoryStock[p.id]
                  const verifiedStock = stockInfo ? (stockInfo.verified_sales_stock ?? 0) : null
                  const isOutOfStock = verifiedStock !== null && verifiedStock <= 0
                  const remainingStock = verifiedStock !== null ? Math.max(0, verifiedStock - (inCart?.qty || 0)) : null

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleAddProduct(p)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0 flex items-center gap-1.5 transition-colors ${
                        isOutOfStock
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                          : inCart
                          ? 'bg-[#EEF5F9] border-[#4685ac]/50 text-[#3A6B80] cursor-pointer'
                          : 'bg-[#F5F1EB] border-[#EDE8DF] text-[#2C3E50] hover:bg-[#EDE8DF] cursor-pointer'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{p.name}</span>
                      {verifiedStock !== null && (
                        <span className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : remainingStock <= 5
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-[#EAF5EE] text-[#2F7D5B]'
                        }`}>
                          {isOutOfStock ? '0' : `${remainingStock}pk`}
                        </span>
                      )}
                      {inCart && (
                        <span className="px-1 py-0.2 rounded bg-[#3A6B80] text-white text-[9px] font-mono">
                          {inCart.qty}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Alert Banner */}
            <AnimatePresence>
              {scanAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                    scanAlert.type === 'success'
                      ? 'bg-[#EAF5EE] text-[#2F7D5B] border-[#BCE3CF]'
                      : scanAlert.type === 'info'
                      ? 'bg-[#EEF5F9] text-[#3A6B80] border-[#D1E4EF]'
                      : 'bg-[#FDEDEC] text-[#E8352D] border-[#FADBD8]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {scanAlert.type === 'success' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{scanAlert.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanAlert(null)}
                    className="text-xs opacity-70 hover:opacity-100 cursor-pointer px-1"
                  >
                    ✕
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tablet & Desktop: Quick Product Grid */}
            <div className="hidden sm:block bg-white border border-[#EDE8DF] rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2C3E50] uppercase tracking-wider block">
                  Produk
                </span>
                <button
                  type="button"
                  onClick={fetchInventoryStock}
                  className="text-[11px] text-[#6B7B8D] hover:text-[#3A6B80] flex items-center gap-1 cursor-pointer transition-colors"
                  title="Perbarui data stok"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingStock ? 'animate-spin text-[#3A6B80]' : ''}`} />
                  <span>Stok Real-time</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {products.map((p) => {
                  const cartItem = cartItems.find((it) => it.product_id === p.id)
                  const inCartQty = cartItem?.qty || 0
                  const stockInfo = inventoryStock[p.id]
                  const verifiedStock = stockInfo ? (stockInfo.verified_sales_stock ?? 0) : null
                  const isOutOfStock = verifiedStock !== null && verifiedStock <= 0
                  const remainingStock = verifiedStock !== null ? Math.max(0, verifiedStock - inCartQty) : null

                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      disabled={isOutOfStock}
                      whileTap={!isOutOfStock ? { scale: 0.97 } : undefined}
                      onClick={() => handleAddProduct(p)}
                      className={`p-2.5 sm:p-3 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                        isOutOfStock
                          ? 'bg-[#F9F7F5] border-[#EDE8DF] opacity-60 cursor-not-allowed'
                          : inCartQty > 0
                          ? 'bg-[#EEF5F9] border-[#4685ac]/50 ring-1 ring-[#4685ac]/30 cursor-pointer'
                          : 'bg-[#F5F1EB] hover:bg-[#EDE8DF] border-[#EDE8DF] cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-[#2C3E50] truncate">
                            {p.name}
                          </span>
                          {inCartQty > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-[#3A6B80] text-white shrink-0">
                              {inCartQty}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#6B7B8D] block mt-0.5">
                          {p.spec || ''}
                        </span>

                        {/* Indikator Stok Real-time (Hasil ACC Sales) */}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {verifiedStock !== null ? (
                            isOutOfStock ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                Habis (0 pack)
                              </span>
                            ) : remainingStock <= 5 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Sisa: {remainingStock} pack
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF5EE] text-[#2F7D5B] border border-[#BCE3CF]">
                                Stok: {remainingStock} pack
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-[#6B7B8D] bg-white border border-[#EDE8DF]">
                              Cek stok...
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#EDE8DF]">
                        <span className="font-bold text-xs font-mono text-[#2C3E50]">
                          {formatRupiah(p.price)}
                        </span>
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'bg-white text-[#3A6B80] border-[#EDE8DF]'
                        }`}>
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* KERANJANG BELANJA */}
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDE8DF] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-[#2C3E50] uppercase tracking-wider">
                    Keranjang
                  </span>
                  {totalItems > 0 && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#2C3E50] text-white tabular-nums">
                      {totalItems}
                    </span>
                  )}
                </div>

                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetStruk}
                    className="text-xs text-[#6B7B8D] hover:text-[#E8352D] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-[#6B7B8D]">
                  <Scan className="w-6 h-6 mx-auto mb-2 text-[#B7C3CE] stroke-[1.5]" />
                  <span className="text-xs font-medium block">Keranjang kosong</span>
                </div>
              ) : (
                <div className="divide-y divide-[#EDE8DF] max-h-72 sm:max-h-96 lg:max-h-[420px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {cartItems.map((it) => {
                      const scannedCount = (it.scanned_lots && it.scanned_lots.length) || 0
                      const isComplete = scannedCount === it.qty

                      return (
                        <motion.div
                          key={it.product_id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.15 }}
                          className="py-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#2C3E50] truncate">{it.product_name}</span>
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                    isComplete
                                      ? 'bg-[#EAF5EE] text-[#2F7D5B] border-[#BCE3CF]'
                                      : 'bg-[#FAF4E6] text-[#A8862E] border-[#F3E5C1]'
                                  }`}
                                >
                                  {scannedCount}/{it.qty} QR
                                </span>
                              </div>
                              <span className="text-[11px] text-[#6B7B8D] block">
                                {formatRupiah(it.price)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {/* Stepper */}
                              <div className="flex items-center bg-[#F5F1EB] rounded-lg border border-[#EDE8DF] p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(it.product_id, it.qty - 1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-[#2C3E50] hover:bg-white transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-mono font-bold text-xs text-[#2C3E50]">
                                  {it.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(it.product_id, it.qty + 1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-[#2C3E50] hover:bg-white transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <span className="font-bold text-[#2C3E50] tabular-nums font-mono text-xs sm:text-sm min-w-16 text-right">
                                {formatRupiah((it.price || 0) * (it.qty || 1))}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveProduct(it.product_id)}
                                className="w-7 h-7 rounded-lg text-[#6B7B8D] hover:text-[#E8352D] hover:bg-[#FDEDEC] flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Scanned QR Chips */}
                          {scannedCount > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {it.scanned_lots.map((code) => (
                                <span
                                  key={code}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F5F1EB] border border-[#EDE8DF] text-[10px] font-mono text-[#2C3E50]"
                                >
                                  <span>{code}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveScannedLot(it.product_id, code)}
                                    className="text-[#6B7B8D] hover:text-[#E8352D] cursor-pointer ml-0.5"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* KOLOM KANAN: PANEL PEMBAYARAN (5 Cols di Desktop, Sticky) */}
          <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-20 space-y-4">
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Display Total */}
              <div className="space-y-3 pb-3 border-b border-[#EDE8DF]">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[#556575] uppercase tracking-wider">
                    Total
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#2C3E50] font-heading tabular-nums">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-xs text-[#556575]">Pelanggan:</span>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in"
                    className="w-36 sm:w-44 h-8 bg-[#F5F1EB] border border-[#EDE8DF] rounded-lg px-2 text-right text-xs font-medium text-[#2C3E50] focus:bg-white focus:outline-none focus:border-[#4685ac] transition-colors"
                  />
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#556575] uppercase tracking-wider block">
                  Metode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
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
                        className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                          active
                            ? 'bg-[#2C3E50] text-white border-[#2C3E50] shadow-xs'
                            : 'bg-[#F5F1EB] text-[#556575] hover:bg-[#EDE8DF] border-[#EDE8DF]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detail Metode Pembayaran */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-2.5 bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#556575]">Diterima:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B7B8D]">Rp</span>
                      <input
                        type="number"
                        value={amountPaid || ''}
                        onChange={(e) => setCustomPaid(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className="w-32 sm:w-40 h-8 bg-white border border-[#EDE8DF] rounded-lg pl-7 pr-2.5 text-right font-bold text-xs text-[#2C3E50] focus:outline-none focus:border-[#4685ac]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setCustomPaid(totalAmount)}
                      className="h-8 rounded-lg bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Pas
                    </button>
                    {[50000, 100000, 200000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomPaid(val)}
                        className="h-8 rounded-lg bg-white border border-[#EDE8DF] hover:bg-[#EDE8DF] text-[#2C3E50] text-[11px] font-semibold tabular-nums transition-colors cursor-pointer"
                      >
                        {(val / 1000)}k
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#EDE8DF] text-xs">
                    <span className="text-[#556575]">Kembalian:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isUnderpaid ? 'text-[#E8352D]' : 'text-[#2F7D5B]'
                      }`}
                    >
                      {isUnderpaid ? `Kurang ${formatRupiah(totalAmount - amountPaid)}` : formatRupiah(change)}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === 'QRIS' && (
                <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#EDE8DF] text-[#3A6B80] flex items-center justify-center mx-auto shadow-2xs">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#2C3E50] block">
                      Pembayaran QRIS Dinamis
                    </span>
                    <span className="text-[11px] text-[#6B7B8D] block">
                      BCA, GoPay, OVO, ShopeePay, Dana, & Seluruh Bank
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#EDE8DF]/70">
                    <span className="text-[10px] text-[#6B7B8D] block uppercase tracking-wider">Total Tagihan:</span>
                    <span className="text-xl font-extrabold text-[#2C3E50] tabular-nums font-heading">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === 'TRANSFER' && (
                <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-2.5 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-[#EDE8DF]">
                    <button
                      type="button"
                      onClick={() => setTransferType('MANUAL')}
                      className={`h-7 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        transferType === 'MANUAL'
                          ? 'bg-[#2C3E50] text-white shadow-xs'
                          : 'text-[#6B7B8D] hover:text-[#2C3E50]'
                      }`}
                    >
                      Rekening Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferType('VA')}
                      className={`h-7 rounded-md text-[11px] font-bold cursor-pointer transition-all ${
                        transferType === 'VA'
                          ? 'bg-[#2C3E50] text-white shadow-xs'
                          : 'text-[#6B7B8D] hover:text-[#2C3E50]'
                      }`}
                    >
                      Virtual Account
                    </button>
                  </div>

                  {transferType === 'MANUAL' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#EDE8DF]">
                        <div>
                          <span className="font-bold text-[#2C3E50] block text-xs">BCA 8820-1928-1120</span>
                          <span className="text-[10px] text-[#6B7B8D]">PT Dimsum Manufaktur</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBank('882019281120', 'BCA')}
                          className="h-7 px-2 rounded bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedBank === 'BCA' ? <CheckCheck className="w-3 h-3 text-[#2F7D5B]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedBank === 'BCA' ? 'Disalin' : 'Salin'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#EDE8DF]">
                        <div>
                          <span className="font-bold text-[#2C3E50] block text-xs">Mandiri 1320-0012-9981</span>
                          <span className="text-[10px] text-[#6B7B8D]">PT Dimsum Manufaktur</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBank('132000129981', 'MANDIRI')}
                          className="h-7 px-2 rounded bg-[#F5F1EB] hover:bg-[#EDE8DF] text-[#2C3E50] text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedBank === 'MANDIRI' ? <CheckCheck className="w-3 h-3 text-[#2F7D5B]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedBank === 'MANDIRI' ? 'Disalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#556575]">
                          Pilih 1 Bank Tujuan:
                        </span>
                        <span className="text-[10px] font-bold text-[#3A6B80] bg-white border border-[#EDE8DF] px-1.5 py-0.5 rounded">
                          Paywuz Sandbox
                        </span>
                      </div>

                      {/* 1 Bank Selection - Tanpa API Call real-time */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'BCAVA', label: 'BCA' },
                          { id: 'BNIVA', label: 'BNI' },
                          { id: 'BRIVA', label: 'BRI' },
                          { id: 'MANDIRIVA', label: 'Mandiri' }
                        ].map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setVaBank(b.id)}
                            className={`h-8 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                              vaBank === b.id
                                ? 'bg-[#2C3E50] text-white border-[#2C3E50] shadow-xs'
                                : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#EDE8DF]'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>

                      {/* Info Panel Ringkas Sebelum Transaksi Diproses */}
                      <div className="bg-white p-3 rounded-xl border border-[#EDE8DF] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#6B7B8D] uppercase tracking-wider">
                            Bank Terpilih
                          </span>
                          <span className="text-xs font-bold text-[#2C3E50]">
                            {vaBank === 'BCAVA' && 'BCA Virtual Account'}
                            {vaBank === 'BNIVA' && 'BNI Virtual Account'}
                            {vaBank === 'BRIVA' && 'BRI Virtual Account'}
                            {vaBank === 'MANDIRIVA' && 'Mandiri Virtual Account'}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#6B7B8D] leading-tight">
                          Satu bank akan dikunci. Untuk mengganti bank setelah nomor dibuat, klik tombol &quot;Batal &amp; Pilih Bank Lain&quot; di jendela pop-up.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tombol Proses / Selesaikan Transaksi */}
              {paymentMethod === 'QRIS' ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={cartItems.length === 0}
                  onClick={handleStartQrisTransaction}
                  className="w-full h-11 rounded-xl bg-[#2F7D5B] hover:bg-[#256348] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Proses Transaksi QRIS</span>
                </motion.button>
              ) : paymentMethod === 'TRANSFER' && transferType === 'VA' ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={cartItems.length === 0}
                  onClick={handleStartVaTransaction}
                  className="w-full h-11 rounded-xl bg-[#2F7D5B] hover:bg-[#256348] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Building className="w-4 h-4" />
                  <span>Proses Transaksi VA {vaBank.replace('VA', '')}</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={cartItems.length === 0 || isUnderpaid || isSubmittingCheckout}
                  onClick={handleStartManualCheckout}
                  className="w-full h-11 rounded-xl bg-[#2F7D5B] hover:bg-[#256348] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSubmittingCheckout ? 'Memproses...' : 'Selesaikan Transaksi'}</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ANTREAN OJOL & WEB */}
      {/* ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <span className="text-xs sm:text-sm font-bold text-[#2C3E50] font-heading block">
                Antrean Pesanan ({ordersQueue.length})
              </span>
              <span className="text-[11px] text-[#6B7B8D]">
                ShopeeFood, GrabFood, GoFood, & Website
              </span>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsNewOjolModalOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-[#3A6B80] hover:bg-[#2F586B] text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pesanan Ojol</span>
            </motion.button>
          </div>

          {/* Filter Channels Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-0.5">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'SHOPEEFOOD', label: 'ShopeeFood' },
              { id: 'GRABFOOD', label: 'GrabFood' },
              { id: 'GOFOOD', label: 'GoFood' },
              { id: 'WEBSITE', label: 'Website' }
            ].map((f) => {
              const active = queueChannelFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQueueChannelFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    active
                      ? 'bg-[#2C3E50] text-white shadow-xs'
                      : 'bg-white border border-[#EDE8DF] text-[#556575] hover:bg-[#F5F1EB]'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* List Antrean - Multi-Column Responsive Grid */}
          {isLoadingQueue ? (
            <div className="text-center py-12 text-xs text-[#6B7B8D]">Memuat antrean...</div>
          ) : filteredQueueOrders.length === 0 ? (
            <div className="bg-white border border-[#EDE8DF] rounded-2xl p-8 text-center text-[#6B7B8D] space-y-1 shadow-2xs">
              <Clock className="w-8 h-8 mx-auto text-[#B7C3CE] mb-1" />
              <span className="text-xs font-bold block text-[#2C3E50]">Tidak ada antrean</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                    className="bg-white border border-[#EDE8DF] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${colorClass}`}>
                            {ord.channel}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-[#2C3E50] font-heading">
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

                      <div className="text-xs sm:text-sm text-[#2C3E50]">
                        <span className="font-bold">{ord.customer_name || 'Driver Ojol'}</span>
                        <div className="text-[11px] text-[#556575] mt-1 space-y-0.5">
                          {ord.items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span>• {it.product_name}</span>
                              <span className="font-mono font-bold text-[#2C3E50]">{it.qty_ordered} pack</span>
                            </div>
                          ))}
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
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-[#EDE8DF] mt-2">
                      <span className="text-xs sm:text-sm font-bold text-[#2C3E50] tabular-nums font-mono">
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
      {/* TAB 3: RIWAYAT */}
      {/* ===================================================================== */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          {/* Stat Cards */}
          <div className={`grid ${canViewRevenue ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-3 text-center bg-white border border-[#EDE8DF] rounded-2xl p-3 sm:p-4 shadow-2xs`}>
            {canViewRevenue && (
              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 shadow-2xs">
                <span className="text-[11px] text-[#556575] block font-semibold">Omzet Hari Ini</span>
                <span className="text-lg sm:text-2xl font-extrabold text-[#2F7D5B] tabular-nums block my-0.5 font-heading">
                  {formatRupiah(dailySummary?.total_revenue || 0)}
                </span>
              </div>
            )}

            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] text-[#556575] block font-semibold">Kemasan Terjual</span>
              <span className="text-lg sm:text-2xl font-extrabold text-[#2C3E50] tabular-nums block my-0.5 font-heading">
                {dailySummary?.total_packs_sold || 0} pack
              </span>
            </div>

            <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 shadow-2xs">
              <span className="text-[11px] text-[#556575] block font-semibold">Transaksi</span>
              <span className="text-lg sm:text-2xl font-extrabold text-[#3A6B80] tabular-nums block my-0.5 font-heading">
                {dailySummary?.total_transactions || 0}
              </span>
            </div>
          </div>

          {/* Channel Revenue Chips */}
          {canViewRevenue && dailySummary?.by_channel && (
            <div className="flex flex-wrap gap-2 px-1">
              {Object.entries(dailySummary.by_channel).map(([ch, rev]) => {
                if (rev <= 0) return null
                return (
                  <span
                    key={ch}
                    className="text-xs font-semibold bg-white border border-[#EDE8DF] text-[#2C3E50] px-3 py-1.5 rounded-xl tabular-nums shadow-2xs flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#2F7D5B]"></span>
                    <span>{ch}: {formatRupiah(rev)}</span>
                  </span>
                )
              })}
            </div>
          )}

          {/* Search History */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7B8D] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari order, pembeli, atau channel..."
              className="w-full h-10 bg-white rounded-xl pl-10 pr-3 text-xs border border-[#EDE8DF] text-[#2C3E50] focus:outline-none focus:border-[#3A6B80] shadow-2xs"
            />
          </div>

          {/* List Riwayat Transaksi */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#556575] block px-1">
              Transaksi Selesai
            </span>

            {isLoadingHistory ? (
              <div className="text-center py-8 text-xs text-[#6B7B8D]">Memuat riwayat...</div>
            ) : filteredHistoryOrders.length === 0 ? (
              <div className="bg-white border border-[#EDE8DF] rounded-2xl p-6 text-center text-xs text-[#6B7B8D] shadow-2xs">
                Tidak ada data riwayat.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                    className={`bg-white border border-[#EDE8DF] rounded-2xl p-4 shadow-2xs flex items-center justify-between text-xs sm:text-sm transition-all ${
                      canViewRevenue ? 'hover:border-[#3A6B80] hover:shadow-xs cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-[#F5F1EB] text-[#2C3E50] border border-[#EDE8DF]">
                          {ord.channel}
                        </span>
                        <span className="font-bold text-[#2C3E50] font-heading">#{ord.order_no}</span>
                      </div>
                      <span className="text-xs text-[#556575] block">
                        {ord.customer_name || 'Walk-in'} • {ord.total_items} pack • {ord.payment_method}
                      </span>
                    </div>

                    <div className="text-right">
                      {canViewRevenue && ord.total_amount != null ? (
                        <span className="font-extrabold text-[#2C3E50] tabular-nums block font-mono text-xs sm:text-sm">
                          {formatRupiah(ord.total_amount)}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#2F7D5B] block">
                          Selesai
                        </span>
                      )}
                      {canViewRevenue && (
                        <span className="text-[11px] text-[#3A6B80] font-bold hover:underline flex items-center justify-end gap-0.5 mt-1">
                          <span>Lihat Struk ➔</span>
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

      {/* 4. Modal QRIS Payment Gateway (Paywuz) */}
      <POSQrisModal
        isOpen={isQrisModalOpen}
        onClose={() => {
          setIsQrisModalOpen(false)
          setQrisData(null)
          setIsQrisPaid(false)
        }}
        totalAmount={totalAmount}
        customerName={customerName}
        qrisData={qrisData}
        isLoading={isGeneratingQris}
        isPaid={isQrisPaid}
        onCheckStatus={() => qrisData?.orderId && handleCheckPaymentStatus(qrisData.orderId, false)}
        onSimulatePay={handleSimulateSandboxPayment}
        onConfirmComplete={async () => {
          try {
            setIsQrisModalOpen(false)
            const totalItemsCount = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
            const totalScannedCount = cartItems.reduce(
              (acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0),
              0
            )

            if (totalScannedCount >= totalItemsCount && totalItemsCount > 0) {
              await handleCompleteSale('QRIS', qrisData?.orderId || qrisData?.id)
            } else {
              setPendingPaidOrderInfo({
                method: 'QRIS',
                paymentRef: qrisData?.orderId || qrisData?.id,
                customerName: customerName.trim() || 'Walk-in',
                amountPaid: totalAmount,
                totalAmount
              })
              setIsPostScanModalOpen(true)
            }
          } catch {
            // error handled in handleCompleteSale
          }
        }}
        isSubmitting={isSubmittingCheckout}
      />

      {/* 4.B Modal Virtual Account Payment Gateway (Paywuz) */}
      <POSVaModal
        isOpen={isVaModalOpen}
        onClose={() => {
          setIsVaModalOpen(false)
          setVaData(null)
          setIsVaPaid(false)
        }}
        totalAmount={totalAmount}
        customerName={customerName}
        bankCode={vaBank}
        vaData={vaData}
        isLoading={vaLoading}
        isPaid={isVaPaid}
        onCheckStatus={() => vaData?.orderId && handleCheckVaPaymentStatus(vaData.orderId, false)}
        onSimulatePay={handleSimulateVaPayment}
        onConfirmComplete={async () => {
          try {
            setIsVaModalOpen(false)
            const totalItemsCount = cartItems.reduce((acc, it) => acc + (it.qty || 1), 0)
            const totalScannedCount = cartItems.reduce(
              (acc, it) => acc + ((it.scanned_lots && it.scanned_lots.length) || 0),
              0
            )

            if (totalScannedCount >= totalItemsCount && totalItemsCount > 0) {
              await handleCompleteSale('TRANSFER', vaData?.orderId || vaData?.id)
            } else {
              setPendingPaidOrderInfo({
                method: 'TRANSFER',
                paymentRef: vaData?.orderId || vaData?.id,
                customerName: customerName.trim() || 'Walk-in',
                amountPaid: totalAmount,
                totalAmount
              })
              setIsPostScanModalOpen(true)
            }
          } catch {
            // error handled in handleCompleteSale
          }
        }}
        isSubmitting={isSubmittingCheckout}
      />

      {/* 4.C Modal Scan Out Kemasan Fisik Setelah Pembayaran Sukses (Opsi A) */}
      <POSPostPaymentScanModal
        isOpen={isPostScanModalOpen}
        onClose={() => {
          setIsPostScanModalOpen(false)
          setPendingPaidOrderInfo(null)
        }}
        paidOrderInfo={pendingPaidOrderInfo}
        cartItems={cartItems}
        onUpdateCartItems={(newCart) => setCartItems(newCart)}
        onFinalizeComplete={async () => {
          try {
            await handleCompleteSale(
              pendingPaidOrderInfo?.method,
              pendingPaidOrderInfo?.paymentRef
            )
            setIsPostScanModalOpen(false)
            setPendingPaidOrderInfo(null)
          } catch {
            // error handled in handleCompleteSale
          }
        }}
        onSaveToQueue={handleSavePaidOrderToQueue}
        isSubmitting={isSubmittingCheckout}
      />

      {/* 5. Modal Struk Thermal Kasir Resmi */}
      <POSThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={lastCompletedOrder}
      />
    </div>
  )
}
