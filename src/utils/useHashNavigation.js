import { useEffect, useRef } from 'react'
import { useProduction1Store } from '../store/production1Store'

/**
 * Mengonversi kombinasi stage, station, dan prod2Tab ke representasi URL Hash kanonikal.
 */
export function getHashFromState(stage, station, prod2Tab, isProfileActive = false) {
  if (isProfileActive) {
    return '#/profile'
  }

  if (stage === 'PROD_2') {
    switch (prod2Tab) {
      case 'INBOUND':
      case 'ASSEMBLY':
        return '#/prod2/inbound'
      case 'FREEZER':
        return '#/prod2/packing'
      case 'PRODUCTS':
        return '#/prod2/products'
      case 'LOGS':
        return '#/prod2/logs'
      case 'CALIBRATION':
        return '#/prod2/calibration'
      default:
        return '#/prod2/inbound'
    }
  }

  switch (station) {
    case 'PLAN':
      return '#/plan'
    case 'MEAT':
      return '#/meat'
    case 'SEASONING':
      return '#/seasoning'
    case 'WRAPPER':
      return '#/wrapper'
    case 'SAUCE':
      return '#/sauce'
    case 'LOGS':
      return '#/logs'
    case 'CALIBRATION':
      return '#/calibration'
    default:
      return '#/meat'
  }
}

/**
 * Mengonversi URL Hash ke state internal aplikasi.
 */
export function getStateFromHash(hash) {
  const clean = (hash || '')
    .replace(/^#\/?/, '')
    .toLowerCase()
    .trim()
    .replace(/\/$/, '')

  if (!clean || clean === 'login' || clean === 'masuk') {
    return { isLogin: true }
  }

  // Rute Profil Pengguna Terpadu
  if (clean === 'profile' || clean === 'profil') {
    return { isProfile: true }
  }

  // Rute Produksi 2
  if (clean.startsWith('prod2') || clean.startsWith('p2')) {
    const sub = clean.replace(/^(prod2|p2)\/?/, '')
    if (sub.includes('inbound') || sub.includes('terima') || sub.includes('assembly') || sub.includes('cetak')) {
      return { stage: 'PROD_2', prod2Tab: 'INBOUND' }
    }
    if (sub.includes('freezer') || sub.includes('packing') || sub.includes('kemas')) {
      return { stage: 'PROD_2', prod2Tab: 'FREEZER' }
    }
    if (sub.includes('product') || sub.includes('produk')) {
      return { stage: 'PROD_2', prod2Tab: 'PRODUCTS' }
    }
    if (sub.includes('log') || sub.includes('riwayat')) {
      return { stage: 'PROD_2', prod2Tab: 'LOGS' }
    }
    if (sub.includes('calib') || sub.includes('qrtest')) {
      return { stage: 'PROD_2', prod2Tab: 'CALIBRATION' }
    }
    return { stage: 'PROD_2', prod2Tab: 'INBOUND' }
  }

  // Rute Produksi 1 & Navigasi Umum
  if (clean === 'plan' || clean === 'rencana') {
    return { stage: 'PROD_1', station: 'PLAN' }
  }
  if (clean === 'meat' || clean === 'giling' || clean === 'daging' || clean === 'mix' || clean === 'adonan') {
    return { stage: 'PROD_1', station: 'MEAT' }
  }
  if (clean === 'seasoning' || clean === 'bumbu') {
    return { stage: 'PROD_1', station: 'SEASONING' }
  }
  if (clean === 'wrapper' || clean === 'kulit') {
    return { stage: 'PROD_1', station: 'WRAPPER' }
  }
  if (clean === 'sauce' || clean === 'saos') {
    return { stage: 'PROD_1', station: 'SAUCE' }
  }
  if (clean === 'logs' || clean === 'riwayat' || clean === 'log') {
    return { stage: 'PROD_1', station: 'LOGS' }
  }
  if (clean === 'calibration' || clean === 'kalibrasi') {
    return { stage: 'PROD_1', station: 'CALIBRATION' }
  }

  // Alias langsung ke sub-tab Produksi 2
  if (clean === 'inbound' || clean === 'terima' || clean === 'assembly' || clean === 'cetak') {
    return { stage: 'PROD_2', prod2Tab: 'INBOUND' }
  }
  if (clean === 'packing' || clean === 'freezer') {
    return { stage: 'PROD_2', prod2Tab: 'FREEZER' }
  }
  if (clean === 'products' || clean === 'produk') {
    return { stage: 'PROD_2', prod2Tab: 'PRODUCTS' }
  }

  return null
}

/**
 * Custom Hook untuk sinkronisasi state internal aplikasi ke Browser History & URL Hash.
 * Mendukung tombol Back/Forward di browser dan mouse secara alami, serta menutup modal
 * saat tombol back ditekan.
 */
export function useHashNavigation() {
  const activeProductionStage = useProduction1Store((s) => s.activeProductionStage)
  const activeStation = useProduction1Store((s) => s.activeStation)
  const activeProd2Tab = useProduction1Store((s) => s.activeProd2Tab)
  const isProfileActive = useProduction1Store((s) => s.isProfileActive)
  const navigateToRoute = useProduction1Store((s) => s.navigateToRoute)

  const authToken = useProduction1Store((s) => s.authToken)
  const isDevMode = useProduction1Store((s) => s.isDevMode)
  const isAuthenticated = Boolean(authToken || isDevMode)

  const activePrintModal = useProduction1Store((s) => s.activePrintModal)
  const isCameraScannerOpen = useProduction1Store((s) => s.isCameraScannerOpen)

  const modalPushedRef = useRef(false)

  // 1. Initial Mount & Autentikasi: Tangani rute saat halaman dibuka/refresh
  useEffect(() => {
    if (!isAuthenticated) {
      if (window.location.hash !== '#/login') {
        window.history.replaceState({ isLogin: true }, '', '#/login')
      }
      return
    }

    const currentHash = window.location.hash
    const initialRoute = getStateFromHash(currentHash)

    if (initialRoute && !initialRoute.isLogin) {
      // Jika refresh pada link stasiun tertentu, pulihkan stasiun tersebut
      navigateToRoute(initialRoute)
    } else {
      // Jika baru login (sebelumnya #/login atau kosong), setel ke stasiun default pengguna
      const defaultHash = getHashFromState(activeProductionStage, activeStation, activeProd2Tab, isProfileActive)
      if (window.location.hash !== defaultHash) {
        window.history.replaceState({ isInitial: true }, '', defaultHash)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // 2. Sinkronkan perpindahan stasiun internal ke URL Hash (pushState)
  useEffect(() => {
    if (!isAuthenticated) return

    const expectedHash = getHashFromState(activeProductionStage, activeStation, activeProd2Tab, isProfileActive)
    if (window.location.hash !== expectedHash) {
      window.history.pushState(null, '', expectedHash)
    }
  }, [isAuthenticated, activeProductionStage, activeStation, activeProd2Tab, isProfileActive])

  // 3. Modal History Sync: Jika modal aktif dibuka, push riwayat agar tombol Back menutup modal
  const isAnyModalOpen = Boolean(activePrintModal || isCameraScannerOpen)

  useEffect(() => {
    if (!isAuthenticated) return

    if (isAnyModalOpen) {
      if (!modalPushedRef.current) {
        window.history.pushState({ isModal: true }, '', window.location.hash)
        modalPushedRef.current = true
      }
    } else {
      if (modalPushedRef.current) {
        modalPushedRef.current = false
        if (window.history.state?.isModal) {
          window.history.back()
        }
      }
    }
  }, [isAuthenticated, isAnyModalOpen])

  // 4. Popstate Listener (Tombol Back/Forward Browser & Mouse)
  useEffect(() => {
    const handlePopState = () => {
      const state = useProduction1Store.getState()
      const isAuth = Boolean(state.authToken || state.isDevMode)

      // A. Jika ada modal yang sedang terbuka saat Back ditekan, tutup modal tersebut
      if (state.activePrintModal || state.isCameraScannerOpen) {
        modalPushedRef.current = false
        if (state.activePrintModal) state.closePrintModal()
        if (state.isCameraScannerOpen) state.closeCameraScanner()
        return
      }

      const currentHash = window.location.hash
      const route = getStateFromHash(currentHash)

      // B. Jika pengguna menekan Back hingga kembali ke halaman login
      if (!route || route.isLogin) {
        if (isAuth) {
          state.logout()
        }
        return
      }

      // C. Navigasi kembali ke rute stasiun secara atomik
      if (isAuth) {
        state.navigateToRoute(route)
        const updated = useProduction1Store.getState()
        const canonicalHash = getHashFromState(
          updated.activeProductionStage,
          updated.activeStation,
          updated.activeProd2Tab,
          updated.isProfileActive
        )
        if (window.location.hash !== canonicalHash) {
          window.history.replaceState(null, '', canonicalHash)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])
}
