import { useEffect, useRef } from 'react'
import { useProduction1Store } from '../store/production1Store'

/**
 * Mengonversi kombinasi stage, station, dan prod2Tab ke representasi URL Hash kanonikal.
 */
export function getHashFromState(
  stage,
  station,
  prod2Tab,
  isProfileActive = false,
  isAdminActive = false,
  activeAdminTab = 'USERS',
  adminForm = null,
  isSuperAdmin = false
) {
  if (isProfileActive) {
    return '#/profile'
  }

  if (isSuperAdmin || isAdminActive) {
    if (adminForm?.type === 'USER') {
      if (adminForm.mode === 'create') return '#/admin/akun/baru'
      if (adminForm.mode === 'edit' && adminForm.id) return `#/admin/akun/${adminForm.id}`
      return '#/admin/akun/baru'
    }
    if (adminForm?.type === 'ROLE') {
      if (adminForm.mode === 'create') return '#/admin/role/baru'
      if (adminForm.mode === 'duplicate' && adminForm.id) return `#/admin/role/${adminForm.id}/duplikat`
      if (adminForm.mode === 'edit' && adminForm.id) return `#/admin/role/${adminForm.id}`
      return '#/admin/role/baru'
    }
    if (activeAdminTab === 'ROLES') return '#/admin/roles'
    if (activeAdminTab === 'PROMOTIONS') return '#/admin/promosi'
    if (activeAdminTab === 'LOGS') return '#/admin/logs'
    if (activeAdminTab === 'API_KEYS') return '#/admin/api-keys'
    return '#/admin'
  }

  if (stage === 'PROD_2') {
    switch (prod2Tab) {
      case 'ASSEMBLY':
        return '#/prod2/assembly'
      case 'INBOUND':
        return '#/prod2/inbound'
      case 'FREEZER':
        return '#/prod2/packing'
      case 'PRODUCTS':
        return '#/prod2/products'
      case 'POS':
        return '#/pos'
      case 'LOGS':
        return '#/prod2/logs'
      default:
        return '#/prod2/inbound'
    }
  }

  switch (station) {
    case 'PLAN':
      return '#/plan'
    case 'SUMMARY':
      return '#/summary'
    case 'SUPPLIER':
      return '#/supplier'
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
    default:
      return '#/plan'
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

  if (clean === 'login' || clean === 'auth') {
    return { isLogin: true }
  }

  if (!clean) {
    return null
  }

  // Rute Profil Pengguna Terpadu
  if (clean === 'profile' || clean === 'profil') {
    return { isProfile: true }
  }

  // Rute Super Admin & RBAC
  if (clean === 'admin' || clean.startsWith('admin/')) {
    const sub = clean.replace(/^admin\/?/, '')

    // Form Akun: /admin/akun/baru atau /admin/akun/:id
    if (sub === 'akun/baru' || sub === 'users/baru' || sub === 'user/baru') {
      return { isAdmin: true, adminTab: 'USERS', adminForm: { type: 'USER', mode: 'create', id: null } }
    }
    const userEditMatch = sub.match(/^(?:akun|users|user)\/(\d+)$/)
    if (userEditMatch) {
      return { isAdmin: true, adminTab: 'USERS', adminForm: { type: 'USER', mode: 'edit', id: Number(userEditMatch[1]) } }
    }

    // Form Role: /admin/role/baru, /admin/role/:id/duplikat, atau /admin/role/:id
    if (sub === 'role/baru' || sub === 'roles/baru') {
      return { isAdmin: true, adminTab: 'ROLES', adminForm: { type: 'ROLE', mode: 'create', id: null } }
    }
    const roleDupMatch = sub.match(/^(?:role|roles)\/(\d+)\/duplikat$/)
    if (roleDupMatch) {
      return { isAdmin: true, adminTab: 'ROLES', adminForm: { type: 'ROLE', mode: 'duplicate', id: Number(roleDupMatch[1]) } }
    }
    const roleEditMatch = sub.match(/^(?:role|roles)\/(\d+)$/)
    if (roleEditMatch) {
      return { isAdmin: true, adminTab: 'ROLES', adminForm: { type: 'ROLE', mode: 'edit', id: Number(roleEditMatch[1]) } }
    }

    if (sub.includes('role')) {
      return { isAdmin: true, adminTab: 'ROLES', adminForm: null }
    }
    if (sub.includes('promo') || sub.includes('voucher') || sub.includes('banner')) {
      return { isAdmin: true, adminTab: 'PROMOTIONS', adminForm: null }
    }
    if (sub.includes('log')) {
      return { isAdmin: true, adminTab: 'LOGS', adminForm: null }
    }
    if (sub.includes('key') || sub.includes('api')) {
      return { isAdmin: true, adminTab: 'API_KEYS', adminForm: null }
    }
    return { isAdmin: true, adminTab: 'USERS', adminForm: null }
  }

  // Rute Produksi 2
  if (clean.startsWith('prod2') || clean.startsWith('p2')) {
    const sub = clean.replace(/^(prod2|p2)\/?/, '')
    if (sub.includes('assembly') || sub.includes('cetak')) {
      return { stage: 'PROD_2', prod2Tab: 'ASSEMBLY' }
    }
    if (sub.includes('inbound') || sub.includes('terima')) {
      return { stage: 'PROD_2', prod2Tab: 'INBOUND' }
    }
    if (sub.includes('freezer') || sub.includes('packing') || sub.includes('kemas')) {
      return { stage: 'PROD_2', prod2Tab: 'FREEZER' }
    }
    if (sub.includes('product') || sub.includes('produk')) {
      return { stage: 'PROD_2', prod2Tab: 'PRODUCTS' }
    }
    if (sub.includes('pos') || sub.includes('kasir')) {
      return { stage: 'PROD_2', prod2Tab: 'POS' }
    }
    if (sub.includes('log') || sub.includes('riwayat')) {
      return { stage: 'PROD_2', prod2Tab: 'LOGS' }
    }
    if (sub.includes('calib') || sub.includes('qrtest')) {
      return { isProfile: true }
    }
    return { stage: 'PROD_2', prod2Tab: 'INBOUND' }
  }

  // Rute Produksi 1 & Navigasi Umum
  if (clean === 'pos' || clean === 'kasir') {
    return { stage: 'PROD_2', prod2Tab: 'POS' }
  }
  if (clean === 'plan' || clean === 'rencana') {
    return { stage: 'PROD_1', station: 'PLAN' }
  }
  if (clean === 'summary' || clean === 'rekap' || clean === 'rekap-ppic' || clean === 'ppic-summary') {
    return { stage: 'PROD_1', station: 'SUMMARY' }
  }
  if (
    clean === 'supplier' ||
    clean === 'inbound-supplier' ||
    clean === 'supplier-inbound' ||
    clean === 'barang-masuk' ||
    clean === 'barangmasuk' ||
    clean === 'inbound'
  ) {
    return { stage: 'PROD_1', station: 'SUPPLIER' }
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
  if (clean === 'calibration' || clean === 'kalibrasi' || clean === 'qrtest') {
    return { isProfile: true }
  }

  // Alias langsung ke sub-tab Produksi 2
  if (clean === 'assembly' || clean === 'cetak') {
    return { stage: 'PROD_2', prod2Tab: 'ASSEMBLY' }
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
  const isAdminActive = useProduction1Store((s) => s.isAdminActive)
  const activeAdminTab = useProduction1Store((s) => s.activeAdminTab)
  const adminForm = useProduction1Store((s) => s.adminForm)
  const navigateToRoute = useProduction1Store((s) => s.navigateToRoute)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const isSuperAdmin = Boolean(currentUser?.is_superadmin)

  const authToken = useProduction1Store((s) => s.authToken)
  const isAuthenticated = Boolean(authToken)

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

    const state = useProduction1Store.getState()
    const isSuper = Boolean(state.currentUser?.is_superadmin)
    const currentHash = window.location.hash
    const initialRoute = getStateFromHash(currentHash)

    if (isSuper) {
      if (initialRoute?.isProfile) {
        navigateToRoute({ isProfile: true })
        if (window.location.hash !== '#/profile') {
          window.history.replaceState({ isInitial: true }, '', '#/profile')
        }
      } else if (initialRoute?.isAdmin) {
        navigateToRoute(initialRoute)
      } else {
        navigateToRoute({ isAdmin: true, adminTab: 'USERS' })
        const adminHash = getHashFromState(
          state.activeProductionStage,
          state.activeStation,
          state.activeProd2Tab,
          false,
          true,
          'USERS',
          null,
          true
        )
        if (window.location.hash !== adminHash) {
          window.history.replaceState({ isInitial: true }, '', adminHash)
        }
      }
      return
    }

    if (initialRoute && !initialRoute.isLogin) {
      // Jika refresh pada link stasiun tertentu, pulihkan stasiun tersebut
      navigateToRoute(initialRoute)
    } else {
      // Jika baru login (sebelumnya #/login atau kosong), setel ke stasiun default pengguna
      const defaultHash = getHashFromState(
        activeProductionStage,
        activeStation,
        activeProd2Tab,
        isProfileActive,
        isAdminActive,
        activeAdminTab,
        adminForm,
        isSuper
      )
      if (window.location.hash !== defaultHash) {
        window.history.replaceState({ isInitial: true }, '', defaultHash)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // 2. Sinkronkan perpindahan stasiun internal ke URL Hash (pushState)
  useEffect(() => {
    if (!isAuthenticated) return

    const expectedHash = getHashFromState(
      activeProductionStage,
      activeStation,
      activeProd2Tab,
      isProfileActive,
      isAdminActive,
      activeAdminTab,
      adminForm,
      isSuperAdmin
    )
    if (window.location.hash !== expectedHash) {
      window.history.pushState(null, '', expectedHash)
    }
  }, [
    isAuthenticated,
    activeProductionStage,
    activeStation,
    activeProd2Tab,
    isProfileActive,
    isAdminActive,
    activeAdminTab,
    adminForm,
    isSuperAdmin
  ])

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
      const isAuth = Boolean(state.authToken)
      const isSuper = Boolean(state.currentUser?.is_superadmin)

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
      if (route?.isLogin) {
        if (isAuth) {
          state.logout()
        }
        return
      }

      // Jika Super Admin mencoba mengakses stasiun operasional atau route kosong
      if (isAuth && isSuper) {
        if (route?.isProfile) {
          state.navigateToRoute({ isProfile: true })
          return
        }
        if (route?.isAdmin) {
          state.navigateToRoute(route)
          return
        }
        // Redirect operational station to admin
        state.navigateToRoute({ isAdmin: true, adminTab: 'USERS' })
        if (window.location.hash !== '#/admin') {
          window.history.replaceState(null, '', '#/admin')
        }
        return
      }

      // Jika hash tidak dikenali atau kosong, jangan logout! Pulihkan hash kanonikal dari state saat ini
      if (!route) {
        if (isAuth) {
          const canonicalHash = getHashFromState(
            state.activeProductionStage,
            state.activeStation,
            state.activeProd2Tab,
            state.isProfileActive,
            state.isAdminActive,
            state.activeAdminTab,
            state.adminForm,
            isSuper
          )
          if (window.location.hash !== canonicalHash) {
            window.history.replaceState(null, '', canonicalHash)
          }
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
          updated.isProfileActive,
          updated.isAdminActive,
          updated.activeAdminTab,
          updated.adminForm,
          isSuper
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
