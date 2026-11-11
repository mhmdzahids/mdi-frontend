import { useEffect, useState, useRef } from 'react'
import './App.css'
import { useProduction1Store } from './store/production1Store'
import MeatStation from './components/MeatStation'
import SeasoningStation from './components/SeasoningStation'
import WrapperStation from './components/WrapperStation'
import SauceStation from './components/SauceStation'
import CustodyLogsView from './components/CustodyLogsView'
import QRCodeModal from './components/QRCodeModal'
import CameraQRScannerModal from './components/CameraQRScannerModal'
import ToastNotification from './components/ToastNotification'
import TopProgressBar from './components/TopProgressBar'
import Production2View from './components/Production2View'
import ProductionPlanView from './components/ProductionPlanView'
import PpicDailySummaryView from './components/PpicDailySummaryView'
import SupplierInboundView from './components/SupplierInboundView'
import ProfileView from './components/ProfileView'
import LoginScreen from './components/LoginScreen'
import DevModeRibbon from './components/DevModeRibbon'
import BottomNav from './components/navigation/BottomNav'
import { SegmentedControl } from './components/ui/SegmentedControl'
import { Avatar } from './components/ui/Avatar'
import { useHashNavigation } from './utils/useHashNavigation'
import { ArrowLeftRight } from 'lucide-react'
import { motion } from 'motion/react'
import logoAdmin from './assets/logo_admin.png'

export default function App() {
  const activeProductionStage = useProduction1Store((s) => s.activeProductionStage)
  const toggleProductionStage = useProduction1Store((s) => s.toggleProductionStage)
  const activeProd2Tab = useProduction1Store((s) => s.activeProd2Tab)
  const activeStation = useProduction1Store((s) => s.activeStation)
  const isProfileActive = useProduction1Store((s) => s.isProfileActive)
  const openProfile = useProduction1Store((s) => s.openProfile)
  const operatorName = useProduction1Store((s) => s.operatorName)
  const operatorId = useProduction1Store((s) => s.operatorId)
  const startAutoSync = useProduction1Store((s) => s.startAutoSync)
  const stopAutoSync = useProduction1Store((s) => s.stopAutoSync)
  const syncStatus = useProduction1Store((s) => s.syncStatus)
  const userRole = useProduction1Store((s) => s.userRole)
  const setUserRole = useProduction1Store((s) => s.setUserRole)
  const authToken = useProduction1Store((s) => s.authToken)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const toggleDevMode = useProduction1Store((s) => s.toggleDevMode)
  const processUniversalBarcode = useProduction1Store((s) => s.processUniversalBarcode)

  // Deteksi status scroll memakai IntersectionObserver pada sentinel paling atas
  const [isScrolled, setIsScrolled] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting)
      },
      { threshold: [1.0] }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Akses Dev Mode via Tekan Lama (600ms) pada Logo
  const longPressTimerRef = useRef(null)
  const handleLogoPressStart = () => {
    if (import.meta.env.PROD) return
    longPressTimerRef.current = setTimeout(() => {
      toggleDevMode()
    }, 600)
  }
  const handleLogoPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const isGlobalSupervisor =
    currentUser?.username === 'supervisor' ||
    currentUser?.username === 'ppic_ayu' ||
    currentUser?.operator_id?.includes('YOSI') ||
    currentUser?.operator_id?.includes('AYU') ||
    currentUser?.division?.toLowerCase().includes('ppic') ||
    currentUser?.division?.toLowerCase().includes('supervisor')

  const canSwitchAll = isDevMode || isGlobalSupervisor

  const currentRouteKey = isProfileActive
    ? 'profile'
    : activeProductionStage === 'PROD_2'
    ? `prod2-${activeProd2Tab}`
    : `prod1-${activeStation}`

  useHashNavigation()

  useEffect(() => {
    startAutoSync()
    return () => {
      stopAutoSync()
    }
  }, [startAutoSync, stopAutoSync])

  // Global listener untuk Scanner Barcode Fisik (Hardware Gun / Ring Scanner)
  const barcodeBufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Abaikan jika user sedang berinteraksi di input/textarea form
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return

      const now = Date.now()
      // Jika jeda antar karakter > 100ms, reset buffer (hardware scanner mengetik sangat cepat ~10-30ms)
      if (now - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = ''
      }
      lastKeyTimeRef.current = now

      if (e.key === 'Enter') {
        const scanned = barcodeBufferRef.current.trim()
        barcodeBufferRef.current = ''
        if (scanned.length >= 3) {
          e.preventDefault()
          processUniversalBarcode(scanned)
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [processUniversalBarcode])

  // Tampilkan layar login jika belum login dan bukan dalam Dev Mode
  if (!authToken && !isDevMode) {
    return <LoginScreen />
  }

  return (
    <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto min-h-screen bg-[var(--canvas)] text-[#2C3E50] flex flex-col font-sans pb-24 sm:pb-28 relative shadow-2xs">
      {/* Global Top Progress Bar (YouTube/GitHub Style) */}
      <TopProgressBar />

      {/* Sentinel Elemen di Paling Atas untuk Deteksi Scroll Bebas Lag */}
      <div ref={sentinelRef} className="h-px w-full absolute top-0 pointer-events-none -z-10" />

      {/* Blok Sticky Terpadu: Header + Barcode Scanner Bar */}
      <div
        className={`sticky top-0 z-30 transition-[background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
          isScrolled
            ? 'bg-white border-b border-[#EDE8DF] shadow-2xs'
            : 'bg-[#F5F1EB] border-b border-transparent shadow-none'
        }`}
      >
        {/* Header Ramping & Bersih Dapur Dimsum */}
        <header className="px-3.5 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] flex items-center justify-between shrink-0">
          {/* Kiri: Logo Perusahaan (tanpa background) + Chip Stage (P1 / P2) */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              onTouchStart={handleLogoPressStart}
              onTouchEnd={handleLogoPressEnd}
              onMouseDown={handleLogoPressStart}
              onMouseUp={handleLogoPressEnd}
              onMouseLeave={handleLogoPressEnd}
              className="shrink-0 cursor-default select-none py-0.5"
              title={import.meta.env.DEV ? 'Tekan lama untuk toggle Dev Mode' : undefined}
            >
              <img
                src={logoAdmin}
                alt="MDI Dimsum MES"
                width={145}
                height={28}
                className="h-7 w-auto object-contain select-none pointer-events-none drop-shadow-md"
              />
            </div>

            {/* Chip Ganti Tahap Produksi (P1 / P2) - Hanya untuk PIC/Stakeholder */}
            {canSwitchAll && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.02 }}
                onClick={toggleProductionStage}
                className="min-h-[44px] min-w-[44px] text-xs font-bold font-heading text-[#3A6B80] bg-[#EEF5F9] hover:bg-[#D1E4EF] active:bg-[#BCE3CF] border border-[#6A9DB3]/40 px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs shrink-0 focus-visible:outline-none"
                title="Ganti Tahap Produksi"
                aria-label="Ganti Tahap Produksi P1 atau P2"
              >
                <ArrowLeftRight className="w-3 h-3 stroke-[2.5]" />
                <span>{activeProductionStage === 'PROD_1' ? 'P1' : 'P2'}</span>
              </motion.button>
            )}
          </div>

          {/* Kanan: Klaster Pengguna + Status Titik Koneksi (Disembunyikan di rute Profile) - Touch Target min 44x44px */}
          {!isProfileActive && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={openProfile}
              className="min-h-[44px] flex items-center gap-2 text-right transition-opacity cursor-pointer min-w-0 shrink-0 p-1 focus-visible:outline-none"
              title="Buka Profil Pengguna"
              aria-label="Profil Pengguna"
            >
              <div className="flex flex-col items-end min-w-0 max-w-[120px] sm:max-w-[150px]">
                <span className="text-[13px] font-semibold text-[#2C3E50] leading-tight truncate w-full">
                  {currentUser?.full_name || operatorName || operatorId || 'Operator'}
                </span>
                <span className="text-[11px] text-[#556575] leading-tight truncate w-full">
                  {userRole === 'STAKEHOLDER' || userRole === 'PIC' ? 'PIC' : 'Karyawan'}
                </span>
              </div>

              <div className="relative shrink-0 w-10 h-10 flex items-center justify-center">
                <Avatar size="md" />
                <span
                  className={`w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white transition-colors ${
                    syncStatus === 'ONLINE' ? 'bg-[#2F7D5B]' : 'bg-[#556575]'
                  }`}
                  title={`Status Backend: ${syncStatus}`}
                />
              </div>
            </motion.button>
          )}
        </header>

        {/* Dev Mode Drawer Ribbon (Hanya di Lingkungan Pengembangan) */}
        {import.meta.env.DEV && isDevMode && <DevModeRibbon />}

        {/* Switcher Peran: Pegawai vs PIC (Hanya saat Dev Mode Aktif) */}
        {import.meta.env.DEV && isDevMode && (
          <div className="bg-[#F5F1EB] border-b border-[#EDE8DF] px-3.5 py-1.5 shrink-0">
            <SegmentedControl
              size="sm"
              value={userRole === 'STAKEHOLDER' || userRole === 'PIC' ? 'PIC' : 'OPERATOR'}
              onChange={(val) => setUserRole(val === 'PIC' ? 'STAKEHOLDER' : 'OPERATOR')}
              options={[
                { value: 'OPERATOR', label: 'Pegawai' },
                { value: 'PIC', label: 'PIC' }
              ]}
            />
          </div>
        )}
      </div>

      {/* Konten Halaman Aktif (Profile vs Produksi 1 vs Produksi 2) */}
      <main className="flex-1 p-3.5 sm:p-4">
        <motion.div
          key={currentRouteKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex-1"
        >
          {isProfileActive ? (
            <ProfileView />
          ) : activeProductionStage === 'PROD_2' ? (
            <>
              {(activeProd2Tab === 'INBOUND' ||
                activeProd2Tab === 'ASSEMBLY' ||
                activeProd2Tab === 'FREEZER' ||
                activeProd2Tab === 'PRODUCTS') && <Production2View />}
              {activeProd2Tab === 'LOGS' && <CustodyLogsView />}
            </>
          ) : (
            <>
              {activeStation === 'PLAN' && <ProductionPlanView />}
              {activeStation === 'SUMMARY' && <PpicDailySummaryView />}
              {activeStation === 'SUPPLIER' && <SupplierInboundView />}
              {activeStation === 'MEAT' && <MeatStation />}
              {activeStation === 'SEASONING' && <SeasoningStation />}
              {activeStation === 'WRAPPER' && <WrapperStation />}
              {activeStation === 'SAUCE' && <SauceStation />}
              {activeStation === 'LOGS' && <CustodyLogsView />}
            </>
          )}
        </motion.div>
      </main>

      {/* Bottom Navigation Terpadu & Responsif */}
      <BottomNav />

      {/* Toast Notification Floating */}
      <ToastNotification />

      {/* Modal Cetak Label */}
      <QRCodeModal />

      {/* Modal Scanner QR Kamera */}
      <CameraQRScannerModal />
    </div>
  )
}
