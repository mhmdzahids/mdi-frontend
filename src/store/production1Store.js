import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { playSuccessBeep, playErrorBeep } from '../utils/soundFx.js'
import { apiFetch, apiGet, apiPut, apiDelete, apiUpload } from '../utils/api.js'

let autoSyncInterval = null
let lastTransitBumbuCount = 0

export function calculatePlanMetrics(plan = {}) {
  const orderMika = plan.orderMika !== undefined
    ? Math.max(0, parseInt(plan.orderMika, 10) || 0)
    : (Math.max(0, parseInt(plan.onlineMika, 10) || 0) + Math.max(0, parseInt(plan.offlineMika, 10) || 0))

  const orderVakum = plan.orderVakum !== undefined
    ? Math.max(0, parseInt(plan.orderVakum, 10) || 0)
    : (Math.max(0, parseInt(plan.onlineVakum, 10) || 0) + Math.max(0, parseInt(plan.offlineVakum, 10) || 0))

  const bumperMika = Math.max(0, parseInt(plan.bumperMika, 10) || 0)
  const bumperVakum = Math.max(0, parseInt(plan.bumperVakum, 10) || 0)

  const totalMika = orderMika + bumperMika
  const totalVakum = orderVakum + bumperVakum
  const totalPcs = (totalMika * 50) + (totalVakum * 25)

  // 1 butir dimsum butuh ~17 gram adonan kalis
  const doughKg = Math.round((totalPcs * 17) / 1000)
  // Rekomendasi sistem: 1 gilingan = ~19 kg adonan jadi (dari 15 kg daging mentah)
  const recommendedGilingan = totalPcs > 0 ? Math.ceil((totalPcs * 17) / 19000) : 0
  const recommendedBumbuKresek = recommendedGilingan
  const recommendedBumbuKarung = recommendedBumbuKresek > 0 ? Math.ceil(recommendedBumbuKresek / 20) : 0

  // Target gilingan: jika user menginput manual maka gunakan manual, jika tidak gunakan rekomendasi (atau targetGilingan yang tersimpan)
  let targetGilingan = recommendedGilingan
  if (plan.manualGilingan !== undefined && plan.manualGilingan !== null && plan.manualGilingan !== '') {
    targetGilingan = Math.max(0, parseInt(plan.manualGilingan, 10) || 0)
  } else if (plan.targetGilingan !== undefined && plan.targetGilingan !== null && plan.targetGilingan !== '') {
    targetGilingan = Math.max(0, parseInt(plan.targetGilingan, 10) || 0)
  }

  // Target bumbu: jika user menginput manual karung maka gunakan manual
  let targetBumbuKarung = recommendedBumbuKarung
  if (plan.manualBumbuKarung !== undefined && plan.manualBumbuKarung !== null && plan.manualBumbuKarung !== '') {
    targetBumbuKarung = Math.max(0, parseInt(plan.manualBumbuKarung, 10) || 0)
  } else if (plan.targetBumbuKarung !== undefined && plan.targetBumbuKarung !== null && plan.targetBumbuKarung !== '') {
    targetBumbuKarung = Math.max(0, parseInt(plan.targetBumbuKarung, 10) || 0)
  } else if (targetGilingan > 0) {
    targetBumbuKarung = Math.ceil(targetGilingan / 20)
  }

  let targetBumbuKresek = targetBumbuKarung * 20
  if (plan.manualBumbuKresek !== undefined && plan.manualBumbuKresek !== null && plan.manualBumbuKresek !== '') {
    targetBumbuKresek = Math.max(0, parseInt(plan.manualBumbuKresek, 10) || 0)
  } else if (plan.targetBumbuKresek !== undefined && plan.targetBumbuKresek !== null && plan.targetBumbuKresek !== '') {
    targetBumbuKresek = Math.max(0, parseInt(plan.targetBumbuKresek, 10) || 0)
  }

  return {
    orderMika,
    orderVakum,
    onlineMika: orderMika,
    onlineVakum: orderVakum,
    offlineMika: 0,
    offlineVakum: 0,
    bumperMika,
    bumperVakum,
    totalMika,
    totalVakum,
    totalPcs,
    doughKg,
    recommendedGilingan,
    recommendedBumbuKresek,
    recommendedBumbuKarung,
    targetGilingan,
    targetBumbuKresek,
    targetBumbuKarung
  }
}

export function formatBackendLotDate(lotQrCode, createdAt) {
  if (lotQrCode) {
    const match = String(lotQrCode).match(/-(\d{4})(\d{2})(\d{2})-/)
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`
    }
  }
  if (createdAt) {
    try {
      const hasZ = createdAt.endsWith('Z') || createdAt.includes('+')
      const d = new Date(hasZ ? createdAt : createdAt + 'Z')
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      }
    } catch {
      // fallback
    }
    return createdAt.slice(0, 10)
  }
  return ''
}

export const useProduction1Store = create(
  persist(
    (set, get) => ({
      // Identitas Stasiun & Operator
      activeStation: 'MEAT', // 'MEAT' (Giling & Mixer) | 'SEASONING' (Bumbu Sparta) | 'WRAPPER' (Kulit) | 'LOGS' | 'CALIBRATION'
      operatorId: 'OPR-DAGING',
      operatorName: 'Budi Santoso',
      userRole: 'OPERATOR', // 'OPERATOR' (Pegawai Lapangan: Scan In/Out & Tempel) | 'STAKEHOLDER' (PIC: Target, Generate & Print QR)

      // Autentikasi & Dev Mode Quick Switcher
      authToken: null,
      currentUser: null,
      isDevMode: false, // Default non-aktif untuk keamanan mode produksi

      // Status Sinkronisasi Real-Time dengan Backend
      isSyncing: false,
      syncStatus: 'ONLINE', // 'ONLINE' | 'SYNCING' | 'OFFLINE'
      lastSyncedAt: null,

      // Konfigurasi Mode Scan Dinamis (1x vs 2x) & State Machine
      scanModeSettings: {
        global_mode: '1X',
        station_modes: {},
        stations: [],
        affected_printed_lots_count: 0,
        updated_by: null,
        updated_at: null
      },
      isScanModeLoading: false,

      // Feedback Semantik Hasil Scan & Undo (Single active message)
      scanFeedbackBanner: null, // { type: 'info' | 'warning' | 'danger' | 'success', title: string, message: string, code: string, action: string, canUndo: boolean, expiresAt: number }
      lastUniversalScanTime: { code: '', time: 0 },
      activeScanSession: null, // { station: string, intent: 'SCAN_IN' | 'SCAN_OUT' } | null


      // Target & Rencana Harian
      planStatus: 'DRAFT', // 'DRAFT' | 'PUBLISHED'
      planVersion: 1,
      planBatches: [],
      publishedAt: null,
      publishedBy: null,
      lastSavedDraftAt: null,
      dailyPlan: {
        planDate: new Date().toISOString().slice(0, 10),
        orderMika: 0,
        orderVakum: 0,
        onlineVakum: 0,
        onlineMika: 0,
        offlineMika: 0,
        offlineVakum: 0,
        bumperMika: 0,
        bumperVakum: 0,
        totalMika: 0,
        totalVakum: 0,
        totalPcs: 0,
        doughKg: 0,
        targetGilingan: 0
      },

      setDailyPlan: (planInput) => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const metrics = calculatePlanMetrics(planInput)
        const newTarget = (planInput.manualGilingan !== undefined && planInput.manualGilingan !== '')
          ? metrics.targetGilingan
          : (metrics.targetGilingan || 0)
        set({
          dailyPlan: { ...planInput, ...metrics, targetGilingan: newTarget, planDate: todayStr },
          targetGilingan: newTarget,
          actionFeedback: { type: 'success', message: 'Target harian berhasil disimpan.' }
        })
        // Sync rencana ke backend
        apiFetch('/api/v1/production1/plans', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: get().activePlanId,
            plan_date: todayStr,
            target_gilingan: newTarget,
            target_mika_pax: metrics.totalMika || 0,
            target_vakum_pax: metrics.totalVakum || 0,
            created_by: get().operatorId || 'STAKEHOLDER'
          })
        }).catch(() => { })
      },

      // Data Rencana Produksi Aktif - plan_id digenerate dinamis dari tanggal hari ini
      // Format: PLAN-YYYYMMDD-01, harus cocok dengan auto-seed di backend startup
      activePlanId: (() => {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        return `PLAN-${yyyy}${mm}${dd}-01`
      })(),
      targetGilingan: 0,

      // Master Resep / Parameter Gilingan
      activeRecipe: {
        recipeId: 'REC-DIMSUM-AYAM-STD',
        recipeName: 'Resep Dimsum Ayam Standar',
        meatInputGram: 15000, // 15 kg per 1 gilingan
        expectedDoughYieldGram: 19000 // ~19 kg adonan jadi
      },

      // 1. STATE DAGING GILING (1 Gilingan = 1 Wadah @ 15 kg)
      // Array kosong - data dimuat dari database backend saat startup (fetchInitialData)
      meatLots: [],

      // 2. STATE BUMBU SPARTA (1 Plastik = 1 Gilingan, 20 Plastik = 1 Karung)
      seasoningLots: [],

      // 3. STATE ADONAN KALIS (Hasil 1 Daging 15 kg + 1 Plastik Sparta di Mixer)
      doughLots: [],

      // 4. STATE KULIT DIMSUM (7 cm Vakum / 9 cm Mika, 1 Bal = 15 kg)
      wrapperLots: [],

      // 5. STATE SAOS DIMSUM (Reguler 50 Pouch / Mini 200 Plastik per Bal)
      sauceLots: [],

      // 5b. STATE PRODUK JADI (Dimsum Mika 50 Pcs / Dimsum Vakum 25 Pcs)
      finishedGoodsLots: [],

      // 5c. STATE WADAH BESI / TRAY TRANSFER (Cetak -> Packing)
      trayLots: [],

      // 5d. RIWAYAT PENERIMAAN TOKO BERTAHAP (Multi-Input Acc vs Onhold)
      salesReceiptLogs: [],

      // 5e. SENTRALISASI PPIC & LOGISTIK INBOUND / OUTBOUND
      supplierInboundList: [],
      supplierOutboundList: [],
      divisionDailyNotes: [],
      dailyRecapData: null,
      isGeneratingLotsAll: false,

      // 5c. KATALOG PRODUK DISPLAY (Produksi 2)
      catalogProducts: [
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
      ],
      editingProduct: null,

      // 6. RIWAYAT LOG AUDIT (Chain of Custody)
      custodyLogs: [],

      // Notifikasi / Feedback Aksi (fungsional, tanpa emoji)
      actionFeedback: null,

      // Modal Cetak Label Barcode Aktif
      activePrintModal: null,
      lastBatchPrintModal: null,

      // Stage Produksi Aktif (PROD_1: Hulu, PROD_2: Hilir/Cetak)
      activeProductionStage: 'PROD_1',
      activeProd2Tab: 'INBOUND', // 'INBOUND' | 'ASSEMBLY' | 'FREEZER' | 'PRODUCTS' | 'LOGS'
      isProfileActive: false,
      openProfile: () => set({ isProfileActive: true, isAdminActive: false, adminForm: null, actionFeedback: null }),
      closeProfile: () => set({ isProfileActive: false, actionFeedback: null }),
      isAdminActive: false,
      activeAdminTab: 'USERS', // 'USERS' | 'ROLES' | 'LOGS'
      adminForm: null, // null | { type: 'USER' | 'ROLE', mode: 'create' | 'edit' | 'duplicate', id: number | null }
      openAdmin: (tab = 'USERS') => set({ isAdminActive: true, isProfileActive: false, activeAdminTab: tab, adminForm: null, actionFeedback: null }),
      closeAdmin: () => set({ isAdminActive: false, adminForm: null, actionFeedback: null }),
      setActiveAdminTab: (tab) => set({ activeAdminTab: tab }),
      openUserForm: (mode = 'create', id = null) =>
        set({ isAdminActive: true, isProfileActive: false, activeAdminTab: 'USERS', adminForm: { type: 'USER', mode, id: id ? Number(id) : null }, actionFeedback: null }),
      openRoleForm: (mode = 'create', id = null) =>
        set({ isAdminActive: true, isProfileActive: false, activeAdminTab: 'ROLES', adminForm: { type: 'ROLE', mode, id: id ? Number(id) : null }, actionFeedback: null }),
      closeAdminForm: () => set({ adminForm: null }),
      packingSubLine: typeof window !== 'undefined' ? (localStorage.getItem('mdi_packing_line') || 'MIKA') : 'MIKA', // 'MIKA' | 'VAKUM'
      dispatchScanMode: 'DISTRIBUTION', // 'DISTRIBUTION' (Kirim Langsung) | 'FREEZER' (Simpan Freezer)

      isSupervisorUser: () => {
        const s = get()
        const user = s.currentUser
        if (user?.is_superadmin) return false
        const role = (user?.role || s.userRole || '').toUpperCase()
        if (role === 'OPERATOR') return false

        const username = (user?.username || '').toLowerCase()
        const opId = (user?.operator_id || s.operatorId || '').toUpperCase()
        const div = (user?.division || '').toUpperCase()

        // PIC stasiun tetap terkunci ke divisinya kecuali akun supervisor PPIC
        if (opId.includes('DAGING') || opId.includes('BUMBU') || opId.includes('KULIT') || opId.includes('SAOS') || opId.includes('CETAK') || opId.includes('PACKING') || opId.includes('GUDANG')) {
          if (!div.includes('PPIC') && !div.includes('SUPERVISOR') && username !== 'supervisor') {
            return false
          }
        }

        if (s.isDevMode) return true
        return username === 'supervisor' || opId.includes('YOSI') || div.includes('PPIC') || div.includes('SUPERVISOR')
      },

      isPpicUser: () => {
        const s = get()
        const user = s.currentUser
        if (user?.is_superadmin) return false
        const role = (user?.role || s.userRole || '').toUpperCase()
        if (role === 'OPERATOR') return false

        const username = (user?.username || user?.sub || '').toLowerCase()
        const opId = (user?.operator_id || s.operatorId || '').toUpperCase()
        const div = (user?.division || '').toUpperCase()
        const defaultStation = (user?.default_station || '').toUpperCase()

        return (
          username === 'supervisor' ||
          username === 'ppic_ayu' ||
          username === 'ayu' ||
          opId.includes('YOSI') ||
          opId.includes('AYU') ||
          opId.includes('PPIC') ||
          div.includes('PPIC') ||
          div.includes('SUPERVISOR') ||
          defaultStation === 'PLAN'
        )
      },

      // Setters dengan proteksi wewenang divisi
      setProductionStage: (stage) => {
        if (get().currentUser?.is_superadmin) return
        if (!get().isSupervisorUser()) return
        set({ activeProductionStage: stage, isProfileActive: false, isAdminActive: false })
      },
      toggleProductionStage: () => {
        if (get().currentUser?.is_superadmin) return
        if (!get().isSupervisorUser()) return
        set((s) => ({
          activeProductionStage: s.activeProductionStage === 'PROD_1' ? 'PROD_2' : 'PROD_1',
          isProfileActive: false,
          isAdminActive: false
        }))
      },
      setProd2Tab: (tab) => {
        if (get().currentUser?.is_superadmin) return
        set({ activeProductionStage: 'PROD_2', activeProd2Tab: tab, isProfileActive: false, isAdminActive: false, adminForm: null })
      },
      setPackingSubLine: (line) => {
        const val = line === 'VAKUM' ? 'VAKUM' : 'MIKA'
        try {
          if (typeof window !== 'undefined') localStorage.setItem('mdi_packing_line', val)
        } catch {
          // ignore
        }
        set({ packingSubLine: val })
      },
      setDispatchScanMode: (mode) => set({ dispatchScanMode: mode }),
      openProductEdit: (id) => set({ editingProduct: id }),
      closeProductEdit: () => set({ editingProduct: null }),

      fetchCatalogProducts: async () => {
        try {
          const data = await apiGet('/products', { silent: true })
          if (Array.isArray(data) && data.length > 0) {
            set({
              catalogProducts: data.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                spec: p.spec || '',
                price: p.price,
                image_url: p.image_url,
                thumbnail_url: p.thumbnail_url,
                is_active: Boolean(p.is_active),
                isDisplayActive: Boolean(p.is_active)
              }))
            })
          }
        } catch (err) {
          console.warn('[CATALOG] fetchCatalogProducts notice:', err?.message)
        }
      },

      saveCatalogProduct: async (id, updates) => {
        try {
          const payload = {}
          if (updates.name !== undefined) payload.name = updates.name
          if (updates.description !== undefined) payload.description = updates.description
          if (updates.spec !== undefined) payload.spec = updates.spec
          if (updates.price !== undefined) payload.price = updates.price
          if (updates.is_active !== undefined) payload.is_active = updates.is_active

          const updated = await apiPut(`/products/${id}`, payload)
          set((s) => ({
            catalogProducts: (s.catalogProducts || []).map((p) =>
              p.id === id
                ? {
                    ...p,
                    name: updated.name,
                    description: updated.description,
                    spec: updated.spec,
                    price: updated.price,
                    image_url: updated.image_url,
                    thumbnail_url: updated.thumbnail_url,
                    is_active: updated.is_active,
                    isDisplayActive: updated.is_active
                  }
                : p
            ),
            actionFeedback: { type: 'success', message: 'Data produk berhasil disimpan.' }
          }))
          return updated
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: err.message || 'Gagal menyimpan produk.' } })
          throw err
        }
      },

      uploadProductImage: async (id, fileBlob) => {
        try {
          const formData = new FormData()
          formData.append('file', fileBlob, 'product.webp')
          const updated = await apiUpload(`/products/${id}/image`, formData)
          set((s) => ({
            catalogProducts: (s.catalogProducts || []).map((p) =>
              p.id === id
                ? {
                    ...p,
                    image_url: updated.image_url,
                    thumbnail_url: updated.thumbnail_url
                  }
                : p
            ),
            actionFeedback: { type: 'success', message: 'Foto produk berhasil diperbarui.' }
          }))
          return updated
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: err.message || 'Gagal upload foto produk.' } })
          throw err
        }
      },

      deleteProductImage: async (id) => {
        try {
          await apiDelete(`/products/${id}/image`)
          set((s) => ({
            catalogProducts: (s.catalogProducts || []).map((p) =>
              p.id === id
                ? {
                    ...p,
                    image_url: null,
                    thumbnail_url: null
                  }
                : p
            ),
            actionFeedback: { type: 'success', message: 'Foto produk berhasil dihapus.' }
          }))
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: err.message || 'Gagal menghapus foto.' } })
          throw err
        }
      },

      toggleCatalogProductDisplay: async (id) => {
        const s = get()
        const prod = (s.catalogProducts || []).find((p) => p.id === id)
        if (!prod) return
        const nextActive = !prod.is_active && !prod.isDisplayActive

        if (nextActive && (!prod.price || prod.price <= 0)) {
          set({
            actionFeedback: {
              type: 'error',
              message: 'Isi harga dulu untuk mengaktifkan'
            }
          })
          return
        }

        try {
          const updated = await apiPut(`/products/${id}`, { is_active: nextActive })
          set((state) => ({
            catalogProducts: (state.catalogProducts || []).map((p) =>
              p.id === id
                ? { ...p, is_active: updated.is_active, isDisplayActive: updated.is_active }
                : p
            ),
            actionFeedback: {
              type: 'success',
              message: updated.is_active ? 'Produk diaktifkan.' : 'Produk dinonaktifkan.'
            }
          }))
        } catch (err) {
          set({
            actionFeedback: {
              type: 'error',
              message: err.message || 'Gagal mengubah status aktif produk.'
            }
          })
        }
      },

      updateCatalogProduct: (id, updates) =>
        set((s) => ({
          catalogProducts: (s.catalogProducts || []).map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
          actionFeedback: { type: 'success', message: 'Data produk berhasil diperbarui.' }
        })),
      navigateToRoute: ({ stage, station, prod2Tab, isProfile, isAdmin, adminTab, adminForm }) => {
        const s = get()
        const isSuperAdmin = Boolean(s.currentUser?.is_superadmin)

        if (isProfile) {
          set({ isProfileActive: true, isAdminActive: false, adminForm: null, actionFeedback: null })
          return
        }

        if (isSuperAdmin) {
          // Super Admin tidak memiliki izin ke stasiun operasional pabrik.
          // Semua rute non-profil diarahkan ke panel admin.
          set({
            isAdminActive: true,
            isProfileActive: false,
            activeAdminTab: adminTab || s.activeAdminTab || 'USERS',
            adminForm: adminForm || null,
            actionFeedback: null
          })
          try {
            if (!window.location.hash.startsWith('#/admin')) {
              window.location.hash = '#/admin'
            }
          } catch {
            // ignore
          }
          return
        }

        if (isAdmin) {
          set({
            isAdminActive: true,
            isProfileActive: false,
            activeAdminTab: adminTab || 'USERS',
            adminForm: adminForm || null,
            actionFeedback: null
          })
          return
        }

        let targetStage = stage || s.activeProductionStage
        let targetStation = station || s.activeStation
        let targetProd2Tab = prod2Tab || s.activeProd2Tab

        if (!s.isSupervisorUser()) {
          const user = s.currentUser
          if (user) {
            targetStage = user.default_stage || 'PROD_1'
            if (targetStage === 'PROD_1') {
              if (targetStation !== 'LOGS') {
                targetStation = user.default_station || 'MEAT'
              }
            } else {
              let expectedTab = user.default_prod2_tab || 'INBOUND'
              if (expectedTab === 'PACKING') expectedTab = 'FREEZER'
              if (expectedTab === 'SALES') expectedTab = 'PRODUCTS'
              if (targetProd2Tab !== 'LOGS' && targetProd2Tab !== 'POS' && targetProd2Tab !== 'PRODUCTS') {
                targetProd2Tab = expectedTab
              }
            }
          }
        }

        set({
          activeProductionStage: targetStage,
          activeStation: targetStation,
          activeProd2Tab: targetProd2Tab,
          isProfileActive: false,
          isAdminActive: false,
          adminForm: null
        })
      },
      setStation: (station) => {
        if (get().currentUser?.is_superadmin) return
        if (station !== 'LOGS' && !get().isSupervisorUser()) {
          const user = get().currentUser
          if (user?.default_station && station !== user.default_station) return
        }
        set({ activeStation: station, isProfileActive: false, isAdminActive: false, adminForm: null })
      },
      setOperator: (id, name) => set({ operatorId: id, operatorName: name }),
      setUserRole: (role) => set({ userRole: role === 'PIC' ? 'STAKEHOLDER' : role }),
      // 7. Pengaturan Batas Tanggal Data Pegawai ('TODAY' | 'YESTERDAY' | 'TWO_DAYS' | 'ALL')
      employeeDateScope: 'TODAY',
      setEmployeeDateScope: (scope) => set({ employeeDateScope: scope }),

      planDetailMode: 'GENERAL', // 'GENERAL' (Ringkas) | 'DETAILED' (Spesifik per Mika & Vakum)
      setPlanDetailMode: (mode) => set({ planDetailMode: mode }),

      clearFeedback: () => set({ actionFeedback: null }),
      setPrintModal: (lotData) =>
        set((s) => ({
          activePrintModal: lotData,
          lastBatchPrintModal:
            lotData?.lotList && lotData.lotList.length > 1
              ? lotData
              : s.lastBatchPrintModal
        })),
      closePrintModal: () => set({ activePrintModal: null }),
      reopenLastBatchPrintModal: () => {
        const last = get().lastBatchPrintModal
        if (last) set({ activePrintModal: last })
      },
      openBatchPrintModal: (lotList, defaultTitle = 'BATCH QR') => {
        if (!lotList || lotList.length === 0) return
        const normalizedList = lotList.map((item) => {
          let title = item.title || defaultTitle
          let detail = item.detail
          let weight = item.weight

          if (!detail) {
            if (item.lotCode?.startsWith('BM-')) {
              detail = `Kapasitas: ${item.quantity || 20} Gilingan`
              weight = '1 Karung Sak'
            } else if (item.lotCode?.startsWith('DG-')) {
              detail = 'Wadah Daging @ 15.00 kg'
              weight = '15.00 kg'
            } else if (item.lotCode?.startsWith('KL-')) {
              const is7cm = item.type === 'KULIT_7CM' || item.type === 'VAKUM_7CM' || item.type === 'VAKUM_10CM'
              detail = item.typeName || (is7cm ? 'Kulit Dimsum 7 cm (Vakum)' : 'Kulit Dimsum 9 cm (Mika)')
              weight = `${item.balQty || 1} Bal (${item.weightKg || (item.balQty || 1) * 15} kg)`
            } else if (item.lotCode?.startsWith('SS-')) {
              const isMini = item.type === 'MINI'
              detail = item.typeName || (isMini ? 'Saos Dimsum Mini (200 Plastik)' : 'Saos Dimsum Reguler (50 Pouch)')
              weight = `1 Bal (${isMini ? '200 plastik' : '50 pouch'})`
            } else if (item.lotCode?.startsWith('FG-')) {
              detail = item.productName || item.productCode || 'Dimsum Beku'
              weight = `${item.packCount || 1} Kemasan`
            } else if (item.lotCode?.startsWith('AD-')) {
              detail = 'Adonan'
              weight = item.weight || '1 gilingan'
            } else {
              detail = item.lotCode
              weight = '-'
            }
          }

          return {
            lotCode: item.lotCode,
            title,
            detail,
            weight: weight || '-',
            createdAt: item.createdAt || new Date().toLocaleTimeString('id-ID', { hour12: false })
          }
        })

        const first = normalizedList[0]
        const batchData = {
          lotCode: first.lotCode,
          title: first.title,
          detail: first.detail,
          weight: first.weight,
          createdAt: first.createdAt,
          lotList: normalizedList
        }
        set({
          activePrintModal: batchData,
          lastBatchPrintModal: batchData
        })
      },

      // Camera Scanner Modal State & Jeda Interval Cooldown
      isCameraScannerOpen: false,
      cameraScannerConfig: { mode: 'UNIVERSAL', title: 'Scanner QR Kamera' },
      scanCooldownSeconds: typeof window !== 'undefined'
        ? Math.max(1, parseInt(localStorage.getItem('mdi_scan_cooldown_sec') || '3', 10))
        : 3,
      setScanCooldownSeconds: (sec) => {
        const val = Math.max(1, Math.min(10, parseInt(sec, 10) || 3))
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('mdi_scan_cooldown_sec', String(val))
          }
        } catch {
          // ignore
        }
        set({ scanCooldownSeconds: val })
      },
      openCameraScanner: (config = {}) => {
        const conf =
          typeof config === 'string'
            ? { mode: config, title: 'Scanner QR Kamera' }
            : { mode: 'UNIVERSAL', title: 'Scanner QR Kamera', ...config }
        set({ isCameraScannerOpen: true, cameraScannerConfig: conf })
      },
      closeCameraScanner: () => set({ isCameraScannerOpen: false, activeScanSession: null }),

      // Shared Selection for Mixing (Accessible by QR Scanner and UI)
      selectedMeatCodes: [],
      selectedBumbuCodes: [],
      setSelectedMeatCodes: (codes) =>
        set({
          selectedMeatCodes:
            typeof codes === 'function' ? codes(get().selectedMeatCodes) : codes
        }),
      setSelectedBumbuCodes: (codes) =>
        set({
          selectedBumbuCodes:
            typeof codes === 'function' ? codes(get().selectedBumbuCodes) : codes
        }),
      toggleSelectMeat: (code) => {
        const current = get().selectedMeatCodes
        const exists = current.includes(code)
        const updated = exists ? current.filter((c) => c !== code) : [...current, code]
        set({ selectedMeatCodes: updated })
        return !exists
      },
      toggleSelectBumbu: (code) => {
        const current = get().selectedBumbuCodes
        const exists = current.includes(code)
        const updated = exists ? current.filter((c) => c !== code) : [...current, code]
        set({ selectedBumbuCodes: updated })
        return !exists
      },
      clearMixSelection: () => set({ selectedMeatCodes: [], selectedBumbuCodes: [] }),

      // =========================================================================
      // ACTIONS: 1. GILING DAGING (Giling Murni @ 15 kg per Wadah)
      // =========================================================================
      generateMeatLots: (gilinganCount) => {
        const state = get()
        const count = parseInt(gilinganCount, 10)
        if (isNaN(count) || count <= 0) {
          set({ actionFeedback: { type: 'error', message: 'Jumlah gilingan harus > 0.' } })
          return []
        }

        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayStr = `${yyyy}${mm}${dd}`
        const timestamp = now.toLocaleTimeString('id-ID', { hour12: false })
        const newLots = []
        const newLogs = []
        const todayMeatLots = state.meatLots.filter((l) => {
          const code = String(l.lotCode || '')
          return code.includes(`-${todayStr}-`)
        })
        let currentIdx = todayMeatLots.length

        for (let i = 1; i <= count; i++) {
          currentIdx += 1
          const padIdx = String(currentIdx).padStart(3, '0')
          const lotCode = `DG-${todayStr}-${padIdx}`

          const lot = {
            lotCode: lotCode,
            planId: state.activePlanId,
            weightKg: 15.00,
            status: 'PRINTED_PENDING_STOCK_IN',
            stationId: 'MEAT_STATION',
            createdDate: `${yyyy}-${mm}-${dd}`,
            createdAt: timestamp
          }
          newLots.push(lot)

          newLogs.push({
            logId: state.custodyLogs.length + i,
            lotCode: lotCode,
            actionType: 'QR_PRINTED',
            stationId: 'MEAT_STATION',
            targetStation: null,
            userId: state.operatorId,
            userRole: 'STAKEHOLDER',
            notes: `Cetak QR Wadah Daging ${lotCode} (15 kg)`,
            timestamp: timestamp
          })
        }

        const createdMeatAsc = [...newLots]
        set((s) => ({
          meatLots: [...newLots.reverse(), ...s.meatLots],
          custodyLogs: [...newLogs.reverse(), ...s.custodyLogs],
          actionFeedback: {
            type: 'success',
            message: `Cetak ${count} label stiker wadah daging selesai (${count * 15} kg).`
          },
          activePrintModal: {
            lotCode: createdMeatAsc[0].lotCode,
            title: 'STIKER WADAH DAGING (15 KG)',
            detail: `Wadah Daging @ 15.00 kg`,
            weight: '15.00 kg',
            createdAt: timestamp,
            lotList: createdMeatAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'STIKER WADAH DAGING (15 KG)',
              detail: 'Wadah Daging @ 15.00 kg',
              weight: '15.00 kg',
              createdAt: timestamp
            }))
          },
          lastBatchPrintModal: {
            lotCode: createdMeatAsc[0].lotCode,
            title: 'STIKER WADAH DAGING (15 KG)',
            detail: `Wadah Daging @ 15.00 kg`,
            weight: '15.00 kg',
            createdAt: timestamp,
            lotList: createdMeatAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'STIKER WADAH DAGING (15 KG)',
              detail: 'Wadah Daging @ 15.00 kg',
              weight: '15.00 kg',
              createdAt: timestamp
            }))
          }
        }))

        // Simpan lot daging ke database SQLite backend via FastAPI
        apiFetch('/api/v1/production1/meat/generate-by-gilingan', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: state.activePlanId,
            gilingan_count: count,
            operator_id: state.operatorId,
            operator_role: 'OPERATOR_DAGING'
          })
        }).then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.warn('[MES Backend] Gagal simpan lot daging ke DB:', err)
            set({
              actionFeedback: {
                type: 'warning',
                message: `Data tersimpan lokal, gagal ke DB: ${err.detail || 'Server error'}`
              }
            })
          }
        }).catch(() => {
          set({
            actionFeedback: {
              type: 'warning',
              message: 'Backend offline. Data daging tersimpan di browser saja.'
            }
          })
        })

        return newLots
      },

      // =========================================================================
      // ACTIONS: 2. MIXING ADONAN (1 Daging DG-... + 1 Bumbu Sparta BM-... -> AD-...)
      // =========================================================================
      mixDoughFromPairs: async (selectedMeatCodes, selectedBumbuCodes = [], doughYieldKg = 20.00) => {
        const state = get()
        const pairCount = selectedMeatCodes.length

        if (pairCount === 0) {
          set({
            actionFeedback: {
              type: 'error',
              message: 'Pilih minimal 1 wadah daging.'
            }
          })
          return []
        }
        const yieldNum = parseFloat(doughYieldKg) || 20.00
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })

        // Simpan data sebelumnya untuk rollback jika backend error
        const prevMeatLots = state.meatLots
        const prevSeasoningLots = state.seasoningLots
        const prevDoughLots = state.doughLots

        set({
          actionFeedback: {
            type: 'info',
            message: `Memproses ${pairCount} gilingan adonan...`
          }
        })

        try {
          const res = await apiFetch('/api/v1/production1/meat/produce-dough', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              gilingan_count: pairCount,
              dough_yield_kg: yieldNum,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_GILING_MIXER',
              meat_lot_codes: selectedMeatCodes,
              bumbu_lot_codes: selectedBumbuCodes
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          const createdDoughLots = await res.json()
          playSuccessBeep()

          const firstDoughCode = (createdDoughLots && createdDoughLots[0]?.lot_qr_code) || `AD-${pairCount}`

          const doughPrintList = Array.isArray(createdDoughLots) && createdDoughLots.length > 0
            ? createdDoughLots.map((d) => ({
              lotCode: d.lot_qr_code || d.lotCode,
              title: 'LOT ADONAN',
              detail: 'Adonan Siap Cetak',
              weight: '1 gilingan',
              createdAt: timestamp
            }))
            : [{
              lotCode: firstDoughCode,
              title: 'LOT ADONAN',
              detail: 'Adonan Siap Cetak',
              weight: '1 gilingan',
              createdAt: timestamp
            }]

          const batchPrintPayload = {
            lotCode: firstDoughCode,
            title: 'LOT ADONAN',
            detail: 'Adonan Siap Cetak',
            weight: '1 gilingan',
            createdAt: timestamp,
            lotList: doughPrintList
          }

          set({
            selectedMeatCodes: [],
            selectedBumbuCodes: [],
            actionFeedback: {
              type: 'success',
              message: `Mix ${pairCount} adonan selesai (${(pairCount * yieldNum).toFixed(1)} kg).`
            },
            activePrintModal: batchPrintPayload,
            lastBatchPrintModal: batchPrintPayload
          })

          await get().fetchInitialData(true)
          return createdDoughLots
        } catch (err) {
          playErrorBeep()
          set({
            meatLots: prevMeatLots,
            seasoningLots: prevSeasoningLots,
            doughLots: prevDoughLots,
            actionFeedback: {
              type: 'error',
              message: `Gagal proses mixing: ${err.message}`
            }
          })
          return []
        }
      },

      // 2b. GILING & MIXING TERPADU (QR Tunggal Adonan AD-...)
      produceBatchUnified: async ({ gilinganCount = 1, doughYieldKg = 20.00, bumbuLotCodes = [], notes = '' }) => {
        const state = get()
        const count = Math.max(1, parseInt(gilinganCount, 10) || 1)
        const yieldNum = parseFloat(doughYieldKg) || 20.00
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })

        set({
          actionFeedback: {
            type: 'info',
            message: `Menyiapkan ${count} label QR gilingan adonan...`
          }
        })

        try {
          const res = await apiFetch('/api/v1/production1/meat-mixing/produce-batch', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              gilingan_count: count,
              dough_yield_kg: yieldNum,
              bumbu_lot_codes: bumbuLotCodes || [],
              operator_id: state.operatorId || 'OPR-GILING',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR',
              notes: notes || null
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          const createdDoughLots = await res.json()
          playSuccessBeep()

          const firstDoughCode = (createdDoughLots && createdDoughLots[0]?.lot_qr_code) || `AD-${count}`

          const doughPrintList = Array.isArray(createdDoughLots) && createdDoughLots.length > 0
            ? createdDoughLots.map((d) => ({
              lotCode: d.lot_qr_code || d.lotCode,
              title: 'ADONAN SIAP CETAK',
              detail: 'Troli Gilingan & Mixing',
              weight: '1 gilingan',
              createdAt: timestamp
            }))
            : [{
              lotCode: firstDoughCode,
              title: 'ADONAN SIAP CETAK',
              detail: 'Troli Gilingan & Mixing',
              weight: '1 gilingan',
              createdAt: timestamp
            }]

          const batchPrintPayload = {
            lotCode: firstDoughCode,
            title: 'REKAP TROLI ADONAN',
            detail: `${count} Gilingan Siap Meja Cetak`,
            weight: `${count} gilingan`,
            createdAt: timestamp,
            lotList: doughPrintList
          }

          set({
            actionFeedback: {
              type: 'success',
              message: `${count} label QR adonan berhasil disiapkan. Lembar rekap QR siap dicetak & didistribusikan.`
            },
            activePrintModal: batchPrintPayload,
            lastBatchPrintModal: batchPrintPayload
          })

          await get().fetchInitialData(true)
          return createdDoughLots
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal menyiapkan label QR: ${err.message}`
            }
          })
          return []
        }
      },

      // Void / Batalkan Label QR Sisa (Sisa Rencana Harian yang Tidak Terealisasi)
      voidLots: async (lotCodes, reason = 'Sisa rencana harian tidak terealisasi') => {
        const state = get()
        const codes = Array.isArray(lotCodes) ? lotCodes : [lotCodes]
        if (codes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production1/lots/void', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: codes,
              reason,
              operator_id: state.operatorId || 'PIC',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR'
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'info',
              message: `${codes.length} label QR berhasil dibatalkan (sisa rencana).`
            }
          })

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal membatalkan label QR: ${err.message}`
            }
          })
          return false
        }
      },

      // Scan-OUT Adonan ke Ruang Cetak (Single)
      scanOutDoughLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        if (!cleanCode.startsWith('AD-')) {
          set({ actionFeedback: { type: 'error', message: 'Bukan QR Adonan (harus AD-).' } })
          return false
        }

        const targetLot = state.doughLots.find((l) => l.lotCode === cleanCode)
        if (!targetLot) {
          set({ actionFeedback: { type: 'error', message: `Lot ${cleanCode} tidak ditemukan.` } })
          return false
        }

        if (targetLot.status === 'PRINTED_PENDING_STOCK_IN') {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `${cleanCode} belum discan masuk stok fisik!` } })
          return false
        }

        if (targetLot.status === 'IN_TRANSIT_TO_ASSEMBLY') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah dikirim ke Cetak.` } })
          return true
        }

        try {
          const res = await apiFetch('/api/v1/production1/seasoning/scan-out-dough', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: cleanCode,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_GILING_MIXER',
              target_station: 'ASSEMBLY_STATION'
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({ actionFeedback: { type: 'success', message: `Kirim ${cleanCode} ke Cetak sukses.` } })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal kirim adonan: ${err.message}` } })
          return false
        }
      },

      // Batch Scan-OUT Adonan ke Ruang Cetak
      scanOutAllDough: async (specificLotCodes = null) => {
        const state = get()
        const targetCodes = specificLotCodes && specificLotCodes.length > 0
          ? specificLotCodes
          : state.doughLots
              .filter((l) => l.status === 'READY_IN_MEAT_MIXING_STATION')
              .map((l) => l.lotCode)

        if (targetCodes.length === 0) {
          set({ actionFeedback: { type: 'info', message: 'Tidak ada adonan siap kirim.' } })
          return false
        }

        let successCount = 0
        for (const code of targetCodes) {
          const ok = await state.scanOutDoughLot(code)
          if (ok) successCount++
        }

        if (successCount > 0) {
          set({
            actionFeedback: {
              type: 'success',
              message: `Kirim ${successCount} troli adonan ke Cetak sukses.`
            }
          })
          await get().fetchInitialData(true)
          return true
        }
        return false
      },

      // =========================================================================
      // ACTIONS: DIVISI BUMBU SPARTA
      // =========================================================================

      generateSeasoningSacks: (sackCount = 1, portionsPerSack = 20) => {
        const state = get()
        const count = parseInt(sackCount, 10)
        if (isNaN(count) || count <= 0) {
          set({ actionFeedback: { type: 'error', message: 'Jumlah karung harus > 0.' } })
          return []
        }

        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayStr = `${yyyy}${mm}${dd}`
        const timestamp = now.toLocaleTimeString('id-ID', { hour12: false })
        const newLots = []
        const newLogs = []
        const todaySeasoningLots = state.seasoningLots.filter((l) => {
          const code = String(l.lotCode || l.lot_qr_code || '')
          return code.includes(`-${todayStr}-`)
        })
        let currentIdx = todaySeasoningLots.length

        for (let i = 1; i <= count; i++) {
          currentIdx += 1
          const padIdx = String(currentIdx).padStart(3, '0')
          const lotCode = `BM-${todayStr}-${padIdx}`

          const lot = {
            lotCode: lotCode,
            planId: state.activePlanId,
            sackNumber: currentIdx,
            quantity: portionsPerSack,
            unit: 'PORSI',
            status: 'READY_IN_SEASONING_STATION',
            stationId: 'SEASONING_STATION',
            createdDate: `${yyyy}-${mm}-${dd}`,
            createdAt: timestamp
          }
          newLots.push(lot)

          newLogs.push({
            logId: Date.now() + i,
            lotCode: lotCode,
            actionType: 'QR_PRINTED',
            stationId: 'SEASONING_STATION',
            targetStation: null,
            userId: state.operatorId,
            userRole: 'STAKEHOLDER',
            notes: `Cetak QR Karung Bumbu ${lotCode} (${portionsPerSack} kresek)`,
            timestamp: timestamp
          })
        }

        const createdSacksAsc = [...newLots]
        set((s) => ({
          seasoningLots: [...newLots.reverse(), ...s.seasoningLots],
          custodyLogs: [...newLogs.reverse(), ...s.custodyLogs],
          actionFeedback: {
            type: 'success',
            message: `Cetak ${count} label karung bumbu selesai (${count * portionsPerSack} gilingan).`
          },
          activePrintModal: {
            lotCode: createdSacksAsc[0].lotCode,
            title: 'KARUNG BUMBU RACIK',
            detail: `Karung @ ${portionsPerSack} Gilingan`,
            weight: `${portionsPerSack} Porsi Gilingan`,
            createdAt: timestamp,
            lotList: createdSacksAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'KARUNG BUMBU RACIK',
              detail: `Karung @ ${portionsPerSack} Gilingan`,
              weight: `${portionsPerSack} Porsi Gilingan`,
              createdAt: timestamp
            }))
          },
          lastBatchPrintModal: {
            lotCode: createdSacksAsc[0].lotCode,
            title: 'KARUNG BUMBU RACIK',
            detail: `Karung @ ${portionsPerSack} Gilingan`,
            weight: `${portionsPerSack} Porsi Gilingan`,
            createdAt: timestamp,
            lotList: createdSacksAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'KARUNG BUMBU RACIK',
              detail: `Karung @ ${portionsPerSack} Gilingan`,
              weight: `${portionsPerSack} Porsi Gilingan`,
              createdAt: timestamp
            }))
          }
        }))

        // Asinkron simpan ke database SQLite backend via FastAPI
        apiFetch('/api/v1/production1/seasoning/generate-sacks', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: state.activePlanId,
            sack_count: count,
            portions_per_sack: portionsPerSack,
            operator_id: state.operatorId,
            operator_role: 'STAKEHOLDER'
          })
        }).then(async (res) => {
          if (res.ok) {
            console.log('[MES Backend] Karung bumbu tersimpan di database.')
            await get().fetchInitialData(true)
          } else {
            const errJson = await res.json().catch(() => ({}))
            console.warn('[MES Backend] Gagal simpan ke DB:', errJson)
            set({
              actionFeedback: {
                type: 'warning',
                message: `Data tersimpan lokal, gagal ke DB: ${errJson.detail || 'Server error'}`
              }
            })
          }
        }).catch(() => {
          set({
            actionFeedback: {
              type: 'warning',
              message: 'Backend offline. Data bumbu tersimpan di browser saja.'
            }
          })
        })

        return newLots
      },

      generateSeasoningPouches: (pouchCount, pouchesPerBag = 20) => {
        const sacks = Math.max(1, Math.ceil(parseInt(pouchCount, 10) / pouchesPerBag) || 1)
        return get().generateSeasoningSacks(sacks, pouchesPerBag)
      },

      scanOutSeasoningLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        if (!cleanCode.startsWith('BM-')) {
          set({ actionFeedback: { type: 'error', message: 'Bukan QR Bumbu (harus BM-).' } })
          return false
        }

        const targetLot = state.seasoningLots.find((l) => l.lotCode === cleanCode)
        if (!targetLot) {
          set({ actionFeedback: { type: 'error', message: `Lot ${cleanCode} tidak ditemukan.` } })
          return false
        }

        if (targetLot.status === 'IN_TRANSIT_TO_MEAT_MIXING') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah dikirim ke Gilingan.` } })
          return true
        }

        if (targetLot.status === 'IN_MEAT_MIXING_STATION') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah tiba di Gilingan.` } })
          return true
        }

        if (targetLot.status === 'CONSUMED') {
          set({ actionFeedback: { type: 'error', message: `${cleanCode} sudah terpakai.` } })
          return false
        }

        return await state.scanOutSeasoningBatch([cleanCode])
      },

      scanOutSeasoningBatch: async (specificLotCodes = null) => {
        const state = get()
        const targetCodes = specificLotCodes || state.seasoningLots
          .filter((l) => l.status === 'READY_IN_SEASONING_STATION')
          .map((l) => l.lotCode)

        if (targetCodes.length === 0) {
          set({ actionFeedback: { type: 'info', message: 'Tidak ada bumbu siap kirim.' } })
          return false
        }

        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
        const targetSet = new Set(targetCodes)

        // Optimistic update
        const previousLots = state.seasoningLots
        const updated = state.seasoningLots.map((l) =>
          targetSet.has(l.lotCode) && l.status === 'READY_IN_SEASONING_STATION'
            ? { ...l, status: 'IN_TRANSIT_TO_MEAT_MIXING', dispatchedAt: timestamp }
            : l
        )

        set({
          seasoningLots: updated,
          actionFeedback: {
            type: 'info',
            message: `Mengirim ${targetCodes.length} plastik bumbu ke Gilingan...`
          }
        })

        try {
          const res = await apiFetch('/api/v1/production1/seasoning/scan-out-batch', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: targetCodes,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_BUMBU',
              target_station: 'MEAT_MIXING_STATION'
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Kirim ${targetCodes.length} plastik bumbu sukses.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            seasoningLots: previousLots,
            actionFeedback: {
              type: 'error',
              message: `Gagal kirim bumbu: ${err.message}`
            }
          })
          return false
        }
      },

      scanInSeasoningLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        if (!cleanCode.startsWith('BM-')) {
          set({ actionFeedback: { type: 'error', message: 'Bukan QR Bumbu (harus BM-).' } })
          return false
        }

        const targetLot = state.seasoningLots.find((l) => l.lotCode === cleanCode)
        if (!targetLot) {
          set({ actionFeedback: { type: 'error', message: `Lot ${cleanCode} tidak ditemukan.` } })
          return false
        }

        if (targetLot.status === 'IN_MEAT_MIXING_STATION') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah diterima di Gilingan.` } })
          return true
        }

        if (targetLot.status === 'CONSUMED') {
          set({ actionFeedback: { type: 'error', message: `${cleanCode} sudah terpakai.` } })
          return false
        }

        return await state.scanInSeasoningBatch([cleanCode])
      },

      scanInSeasoningBatch: async (specificLotCodes = null) => {
        const state = get()
        const targetCodes = specificLotCodes || state.seasoningLots
          .filter((l) => l.status === 'IN_TRANSIT_TO_MEAT_MIXING')
          .map((l) => l.lotCode)

        if (targetCodes.length === 0) {
          set({ actionFeedback: { type: 'info', message: 'Tidak ada bumbu sedang dikirim.' } })
          return false
        }

        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
        const targetSet = new Set(targetCodes)

        // Optimistic update
        const previousLots = state.seasoningLots
        const updated = state.seasoningLots.map((l) =>
          targetSet.has(l.lotCode) && l.status === 'IN_TRANSIT_TO_MEAT_MIXING'
            ? { ...l, status: 'IN_MEAT_MIXING_STATION', receivedAt: timestamp, stationId: 'MEAT_MIXING_STATION' }
            : l
        )

        set({
          seasoningLots: updated,
          actionFeedback: {
            type: 'info',
            message: `Menerima ${targetCodes.length} plastik bumbu...`
          }
        })

        try {
          const res = await apiFetch('/api/v1/production1/meat/scan-in-bumbu-batch', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: targetCodes,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_GILING_MIXER'
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Terima ${targetCodes.length} plastik bumbu sukses di Meja Giling.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            seasoningLots: previousLots,
            actionFeedback: {
              type: 'error',
              message: `Gagal terima bumbu: ${err.message}`
            }
          })
          return false
        }
      },

      // =========================================================================
      // ACTIONS: DIVISI KULIT (Bal Kulit 7 cm / 9 cm, 1 Bal = 15 kg)
      // =========================================================================

      createWrapperLot: (type = 'KULIT_9CM', balQty = 1, sourceType = 'INTERNAL', supplierName = '') => {
        const state = get()
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayStr = `${yyyy}${mm}${dd}`
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })

        const is7cm = type === 'KULIT_7CM' || type === 'VAKUM_7CM' || type === 'VAKUM_10CM'
        const cleanType = is7cm ? 'KULIT_7CM' : 'KULIT_9CM'
        const typeName = is7cm ? 'Kulit Dimsum 7 cm (Vakum)' : 'Kulit Dimsum 9 cm (Mika)'
        const count = Math.max(1, parseInt(balQty, 10) || 1)
        const isExternal = sourceType === 'EXTERNAL'
        const cleanSupplier = supplierName.trim() || (isExternal ? 'Supplier Luar' : '')

        const newLots = []
        const newLogs = []
        const todayWrapperLots = state.wrapperLots.filter((l) => {
          const code = String(l.lotCode || l.lot_qr_code || '')
          return code.includes(`-${todayStr}-`)
        })
        const baseIdx = todayWrapperLots.length + 1

        for (let i = 0; i < count; i++) {
          const padIndex = String(baseIdx + i).padStart(3, '0')
          const lotCode = `KL-${todayStr}-${padIndex}`

          newLots.push({
            lotCode: lotCode,
            type: cleanType,
            typeName: typeName,
            balQty: 1,
            weightKg: 15.0,
            sourceType: isExternal ? 'EXTERNAL' : 'INTERNAL',
            supplierName: cleanSupplier,
            status: 'READY_IN_WRAPPER_STATION',
            stationId: 'WRAPPER_STATION',
            createdAt: timestamp
          })

          const noteText = isExternal
            ? `Cetak QR Bal Kulit Supplier Luar ${lotCode} (${cleanSupplier}, 1 Bal / 15 kg, ${typeName})`
            : `Cetak QR Bal Kulit ${lotCode} (1 Bal / 15 kg, ${typeName})`

          newLogs.push({
            logId: state.custodyLogs.length + 1 + i,
            lotCode: lotCode,
            actionType: 'QR_PRINTED',
            stationId: 'WRAPPER_STATION',
            targetStation: null,
            userId: state.operatorId,
            userRole: isExternal ? 'PPIC' : 'STAKEHOLDER',
            notes: noteText,
            timestamp: timestamp
          })
        }

        const createdLotsAsc = [...newLots]
        const modalTitle = isExternal ? 'LOT KULIT SUPPLIER LUAR (PPIC)' : 'LOT KULIT DIMSUM'
        const modalDetail = isExternal ? `${typeName} · ${cleanSupplier}` : typeName

        set({
          wrapperLots: [...newLots.reverse(), ...state.wrapperLots],
          custodyLogs: [...newLogs.reverse(), ...state.custodyLogs],
          actionFeedback: {
            type: 'success',
            message: isExternal
              ? `Cetak ${count} QR Kulit Supplier Luar selesai (${count * 15} kg).`
              : `Cetak ${count} label QR Bal Kulit selesai (${count * 15} kg).`
          },
          activePrintModal: {
            lotCode: createdLotsAsc[0].lotCode,
            title: modalTitle,
            detail: modalDetail,
            weight: '1 Bal (15.00 kg)',
            createdAt: timestamp,
            lotList: createdLotsAsc.map((l) => ({
              lotCode: l.lotCode,
              title: modalTitle,
              detail: modalDetail,
              weight: '1 Bal (15.00 kg)',
              createdAt: timestamp
            }))
          },
          lastBatchPrintModal: {
            lotCode: createdLotsAsc[0].lotCode,
            title: modalTitle,
            detail: modalDetail,
            weight: '1 Bal (15.00 kg)',
            createdAt: timestamp,
            lotList: createdLotsAsc.map((l) => ({
              lotCode: l.lotCode,
              title: modalTitle,
              detail: modalDetail,
              weight: '1 Bal (15.00 kg)',
              createdAt: timestamp
            }))
          }
        })

        apiFetch('/api/v1/production1/wrapper/generate', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: state.productionPlan?.plan_id || `PLAN-${todayStr}-01`,
            wrapper_type: cleanType,
            bal_qty: count,
            weight_kg: 15.0,
            operator_id: state.operatorId,
            operator_role: isExternal ? 'PPIC' : 'STAKEHOLDER',
            source_type: isExternal ? 'EXTERNAL' : 'INTERNAL',
            notes: isExternal ? `Supplier Luar: ${cleanSupplier}` : null
          })
        }).then(async (res) => {
          if (res.ok) {
            await get().fetchInitialData(true)
          }
        }).catch(() => { })

        return newLots
      },

      scanOutWrapperLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        if (!cleanCode.startsWith('KL-')) {
          set({ actionFeedback: { type: 'error', message: 'Bukan QR Kulit (harus KL-).' } })
          return false
        }

        const targetLot = state.wrapperLots.find((l) => l.lotCode === cleanCode)
        if (!targetLot) {
          set({ actionFeedback: { type: 'error', message: `Lot ${cleanCode} tidak ditemukan.` } })
          return false
        }

        if (targetLot.status === 'IN_TRANSIT_TO_ASSEMBLY') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah dikirim ke Cetak.` } })
          return true
        }

        if (targetLot.status !== 'READY_IN_WRAPPER_STATION') {
          set({ actionFeedback: { type: 'error', message: `Status ${cleanCode} tidak siap kirim.` } })
          return false
        }

        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
        const updated = state.wrapperLots.map((l) =>
          l.lotCode === cleanCode ? { ...l, status: 'IN_TRANSIT_TO_ASSEMBLY', dispatchedAt: timestamp } : l
        )

        const newLog = {
          logId: state.custodyLogs.length + 1,
          lotCode: cleanCode,
          actionType: 'SCAN_OUT',
          stationId: 'WRAPPER_STATION',
          targetStation: 'ASSEMBLY_STATION',
          userId: state.operatorId,
          userRole: 'OPERATOR_KULIT',
          notes: 'Kirim Kulit ke Bagian Cetak',
          timestamp: timestamp
        }

        set({
          wrapperLots: updated,
          custodyLogs: [newLog, ...state.custodyLogs],
          actionFeedback: { type: 'success', message: `Kirim ${cleanCode} ke Cetak sukses.` }
        })

        try {
          const res = await apiFetch('/api/v1/production1/wrapper/scan-out', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: cleanCode,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_KULIT',
              target_station: 'ASSEMBLY_STATION'
            })
          })
          if (res.ok) {
            await get().fetchInitialData(true)
          }
        } catch {
          // offline safe
        }

        return true
      },

      // =========================================================================
      // ACTIONS: DIVISI SAOS (Dimsum Mini 200 Plastik / Dimsum Reguler 50 Pouch per Bal)
      // =========================================================================

      createSauceLot: (type = 'REGULER', balQty = 1) => {
        const state = get()
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayStr = `${yyyy}${mm}${dd}`
        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })

        const isMini = type === 'MINI' || type === 'SAOS_MINI'
        const cleanType = isMini ? 'MINI' : 'REGULER'
        const typeName = isMini ? 'Saos Dimsum Mini (200 Plastik)' : 'Saos Dimsum Reguler (50 Pouch)'
        const packDesc = isMini ? '200 Plastik Es Mambo / Bal' : '50 Pouch / Bal'
        const count = Math.max(1, parseInt(balQty, 10) || 1)

        const newLots = []
        const newLogs = []
        const todaySauceLots = state.sauceLots.filter((l) => {
          const code = String(l.lotCode || l.lot_qr_code || '')
          return code.includes(`-${todayStr}-`)
        })
        const baseIdx = todaySauceLots.length + 1

        for (let i = 0; i < count; i++) {
          const padIndex = String(baseIdx + i).padStart(3, '0')
          const lotCode = `SA-${todayStr}-${padIndex}`

          newLots.push({
            lotCode: lotCode,
            type: cleanType,
            typeName: typeName,
            balQty: 1,
            itemsPerBal: isMini ? 200 : 50,
            status: 'READY_IN_SAUCE_STATION',
            stationId: 'SAUCE_STATION',
            createdAt: timestamp
          })

          newLogs.push({
            logId: state.custodyLogs.length + 1 + i,
            lotCode: lotCode,
            actionType: 'QR_PRINTED',
            stationId: 'SAUCE_STATION',
            targetStation: null,
            userId: state.operatorId,
            userRole: 'STAKEHOLDER',
            notes: `Cetak QR Bal Saos ${lotCode} (1 Bal / ${packDesc}, ${typeName})`,
            timestamp: timestamp
          })
        }

        const createdLotsAsc = [...newLots]
        set({
          sauceLots: [...newLots.reverse(), ...state.sauceLots],
          custodyLogs: [...newLogs.reverse(), ...state.custodyLogs],
          actionFeedback: {
            type: 'success',
            message: `Cetak ${count} label QR Bal Saos selesai (${count * (isMini ? 200 : 50)} pcs).`
          },
          activePrintModal: {
            lotCode: createdLotsAsc[0].lotCode,
            title: 'LOT SAOS DIMSUM',
            detail: typeName,
            weight: `1 Bal (${packDesc})`,
            createdAt: timestamp,
            lotList: createdLotsAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'LOT SAOS DIMSUM',
              detail: typeName,
              weight: `1 Bal (${packDesc})`,
              createdAt: timestamp
            }))
          },
          lastBatchPrintModal: {
            lotCode: createdLotsAsc[0].lotCode,
            title: 'LOT SAOS DIMSUM',
            detail: typeName,
            weight: `1 Bal (${packDesc})`,
            createdAt: timestamp,
            lotList: createdLotsAsc.map((l) => ({
              lotCode: l.lotCode,
              title: 'LOT SAOS DIMSUM',
              detail: typeName,
              weight: `1 Bal (${packDesc})`,
              createdAt: timestamp
            }))
          }
        })

        apiFetch('/api/v1/production1/sauce/generate', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: state.productionPlan?.plan_id || `PLAN-${todayStr}-01`,
            sauce_type: cleanType,
            bal_qty: count,
            operator_id: state.operatorId,
            operator_role: 'STAKEHOLDER'
          })
        }).then(async (res) => {
          if (res.ok) {
            await get().fetchInitialData(true)
          }
        }).catch(() => { })

        return newLots
      },

      scanOutSauceLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        if (!cleanCode.startsWith('SA-')) {
          set({ actionFeedback: { type: 'error', message: 'Bukan QR Saos (harus SA-).' } })
          return false
        }

        const targetLot = state.sauceLots.find((l) => l.lotCode === cleanCode)
        if (!targetLot) {
          set({ actionFeedback: { type: 'error', message: `Lot ${cleanCode} tidak ditemukan.` } })
          return false
        }

        if (targetLot.status === 'IN_TRANSIT_TO_FINISHING') {
          set({ actionFeedback: { type: 'info', message: `${cleanCode} sudah dikirim ke Finishing.` } })
          return true
        }

        if (targetLot.status !== 'READY_IN_SAUCE_STATION') {
          set({ actionFeedback: { type: 'error', message: `Status ${cleanCode} tidak siap kirim.` } })
          return false
        }

        const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
        const updated = state.sauceLots.map((l) =>
          l.lotCode === cleanCode ? { ...l, status: 'IN_TRANSIT_TO_FINISHING', dispatchedAt: timestamp } : l
        )

        const newLog = {
          logId: state.custodyLogs.length + 1,
          lotCode: cleanCode,
          actionType: 'SCAN_OUT',
          stationId: 'SAUCE_STATION',
          targetStation: 'FINISHING_STATION',
          userId: state.operatorId,
          userRole: 'OPERATOR_SAOS',
          notes: 'Kirim Saos ke Bagian Finishing',
          timestamp: timestamp
        }

        set({
          sauceLots: updated,
          custodyLogs: [newLog, ...state.custodyLogs],
          actionFeedback: { type: 'success', message: `Kirim ${cleanCode} ke Finishing sukses.` }
        })

        try {
          const res = await apiFetch('/api/v1/production1/sauce/scan-out', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: cleanCode,
              operator_id: state.operatorId,
              operator_role: 'OPERATOR_SAOS',
              target_station: 'FINISHING_STATION'
            })
          })
          if (res.ok) {
            await get().fetchInitialData(true)
          }
        } catch {
          // offline safe
        }

        return true
      },

      // =========================================================================
      // ACTIONS: PRODUKSI 2 - PENERIMAAN BAHAN MASUK (ADONAN, KULIT, SAOS)
      // =========================================================================
      receiveMaterialLot: async (scannedLotCode) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        try {
          const res = await apiFetch('/api/v1/production2/receive-material', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: cleanCode,
              operator_id: state.operatorId,
              operator_role: state.operatorName || 'OPERATOR_CETAK'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          const itemType = cleanCode.startsWith('AD-')
            ? 'Adonan'
            : cleanCode.startsWith('KL-')
              ? 'Kulit'
              : cleanCode.startsWith('SA-')
                ? 'Saos'
                : 'Bahan'
          set({
            actionFeedback: {
              type: 'success',
              message: `Terima ${itemType} ${cleanCode} sukses (siap di Produksi 2).`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal terima ${cleanCode}: ${err.message}`
            }
          })
          return false
        }
      },

      receiveBatchMaterials: async (lotCodes) => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production2/receive-batch', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: state.operatorName || 'OPERATOR_CETAK'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Berhasil menerima ${lotCodes.length} bahan di Produksi 2.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal terima batch: ${err.message}`
            }
          })
          return false
        }
      },

      // Selesai Batch Cetak: Terbitkan FG Mika (50 pcs) & FG Vakum (25 pcs)
      completeAssemblyBatch: async ({ doughCodes, wrapperCodes, mikaQty, vakumQty, notes }) => {
        const state = get()
        if (mikaQty <= 0 && vakumQty <= 0) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: 'Isi minimal 1 mika atau 1 vakum.' } })
          return false
        }

        try {
          const res = await apiFetch('/api/v1/production2/complete-assembly-batch', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              dough_lot_codes: doughCodes || [],
              wrapper_lot_codes: wrapperCodes || [],
              mika_output_qty: Number(mikaQty) || 0,
              vakum_output_qty: Number(vakumQty) || 0,
              operator_id: state.operatorId,
              operator_role: state.userRole === 'STAKEHOLDER' ? 'CHECKER' : 'OPERATOR_CETAK',
              notes: notes || null
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          const createdFgLots = await res.json()
          playSuccessBeep()

          const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
          const mikaCount = createdFgLots.filter((l) => l.lot_type === 'FG_MIKA').length
          const vakumCount = createdFgLots.filter((l) => l.lot_type === 'FG_VAKUM').length

          let msg = 'Selesai batch: '
          if (mikaCount > 0 && vakumCount > 0) msg += `${mikaCount} Mika, ${vakumCount} Vakum dicetak.`
          else if (mikaCount > 0) msg += `${mikaCount} Mika dicetak.`
          else msg += `${vakumCount} Vakum dicetak.`

          const mappedFgLots = createdFgLots.map((l) => {
            const isMika = l.lot_type === 'FG_MIKA'
            return {
              lotCode: l.lot_qr_code,
              title: isMika ? 'DIMSUM MIKA (50 PCS)' : 'DIMSUM VAKUM (25 PCS)',
              detail: isMika ? 'Isi 50 Buah · Kulit 9 cm' : 'Isi 25 Buah · Frozen Seal',
              weight: isMika ? '50 pcs' : '25 pcs',
              createdAt: timestamp
            }
          })

          const fgPrintPayload = mappedFgLots.length > 0 ? {
            lotCode: mappedFgLots[0].lotCode,
            title: mappedFgLots[0].title,
            detail: mappedFgLots[0].detail,
            weight: mappedFgLots[0].weight,
            createdAt: timestamp,
            lotList: mappedFgLots
          } : null

          set({
            actionFeedback: { type: 'success', message: msg },
            activePrintModal: fgPrintPayload,
            lastBatchPrintModal: fgPrintPayload || get().lastBatchPrintModal
          })

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal selesai batch: ${err.message}` } })
          return false
        }
      },

      // Kirim Nampan Hasil Cetak ke Bagian Packing
      dispatchTraysFromAssembly: async ({ trayCount, productType, photoEvidence, doughCodes, wrapperCodes, notes }) => {
        const state = get()
        if (!trayCount || Number(trayCount) <= 0) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: 'Jumlah wadah minimal 1.' } })
          return false
        }

        if (!photoEvidence) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: 'Bukti foto laporan nampan wajib dilampirkan.' } })
          return false
        }

        try {
          const res = await apiFetch('/api/v1/production2/dispatch-trays', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              product_type: productType || 'FG_MIKA',
              tray_count: Number(trayCount),
              photo_evidence: photoEvidence || null,
              dough_lot_codes: doughCodes || [],
              wrapper_lot_codes: wrapperCodes || [],
              operator_id: state.operatorId || 'OPR-CETAK',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR',
              notes: notes || null
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          const createdTray = await res.json()
          playSuccessBeep()
          const typeLabel = (productType === 'FG_VAKUM') ? 'Vakum' : 'Mika'
          set({
            actionFeedback: {
              type: 'success',
              message: `Berhasil kirim ${trayCount} nampan ${typeLabel} (${createdTray.lot_qr_code}) ke Bagian Packing.`
            }
          })

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal kirim nampan: ${err.message}` } })
          return false
        }
      },

      // Terima Nampan / Wadah Hasil Cetak di Bagian Packing
      receiveTraysInPacking: async (trayCodes, lineType) => {
        const state = get()
        if (!trayCodes || trayCodes.length === 0) return false
        const activeLine = lineType || state.packingSubLine || 'MIKA'

        try {
          const res = await apiFetch('/api/v1/production2/receive-trays', {
            method: 'POST',
            body: JSON.stringify({
              tray_lot_codes: trayCodes,
              line_type: activeLine,
              operator_id: state.operatorId || 'OPR-PACKING',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Berhasil verifikasi terima ${trayCodes.length} lot wadah di Line ${activeLine}.`
            }
          })

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal terima wadah: ${err.message}` } })
          return false
        }
      },

      // Media Penyesuaian / Pengurangan Stok Bahan Manual dengan Catatan Operasional
      adjustMaterialStock: async ({ lotCode, actionType, quantityUsed, notes }) => {
        const state = get()
        if (!lotCode) return false

        try {
          const res = await apiFetch('/api/v1/production2/adjust-material-stock', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: lotCode,
              action_type: actionType || 'CONSUME_ALL',
              quantity_used: quantityUsed !== undefined && quantityUsed !== null ? Number(quantityUsed) : null,
              notes: notes || null,
              operator_id: state.operatorId || 'OPR-PROD2',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: actionType === 'CONSUME_ALL'
                ? `Stok bahan ${lotCode} ditandai habis terpakai.`
                : `Stok bahan ${lotCode} berhasil dikurangi ${quantityUsed}.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal menyesuaikan stok bahan: ${err.message}`
            }
          })
          return false
        }
      },

      adjustMaterialStockBatch: async (lotCodes, notes = 'Habis terpakai bersamaan') => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          let successCount = 0
          for (const lotCode of lotCodes) {
            const res = await apiFetch('/api/v1/production2/adjust-material-stock', {
              method: 'POST',
              body: JSON.stringify({
                lot_code: lotCode,
                action_type: 'CONSUME_ALL',
                quantity_used: null,
                notes: notes,
                operator_id: state.operatorId || 'OPR-PROD2',
                operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR'
              })
            })
            if (res.ok) successCount++
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `${successCount} bahan berhasil ditandai habis terpakai.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal memproses batch habis terpakai: ${err.message}`
            }
          })
          return false
        }
      },

      // 11c. Catat Penggunaan Bahan 3-Metrik (Dikirim, Digunakan, Sisa)
      recordMaterialUsage: async ({ lotCode, quantitySent, quantityUsed, remainingAction = 'STORE_IN_ROOM', notes = '' }) => {
        const state = get()
        if (!lotCode) return false

        try {
          const res = await apiFetch('/api/v1/production2/record-material-usage', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: lotCode,
              quantity_sent: Number(quantitySent),
              quantity_used: Number(quantityUsed),
              remaining_action: remainingAction,
              notes: notes || null,
              operator_id: state.operatorId || 'OPR-PROD',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          const sisa = Math.max(0, Number(quantitySent) - Number(quantityUsed))
          set({
            actionFeedback: {
              type: 'success',
              message: `Penggunaan bahan dicatat: Terpakai ${quantityUsed}, Sisa ${sisa}.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal mencatat penggunaan bahan: ${err.message}`
            }
          })
          return false
        }
      },

      // 11d. Verifikasi Penjualan Bertahap (Multi-Input Acc vs Onhold)
      verifyStagedSalesReceipt: async ({ productId, actualQty, verificationStatus = 'ACC', notes = '' }) => {
        const state = get()
        const qty = parseInt(actualQty, 10) || 0
        if (qty <= 0) {
          set({ actionFeedback: { type: 'error', message: 'Jumlah fisik harus lebih besar dari 0.' } })
          return false
        }

        try {
          const res = await apiFetch('/api/v1/production2/sales/verify-staged-receipt', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              product_id: productId,
              actual_qty: qty,
              verification_status: verificationStatus,
              notes: notes || null,
              operator_id: state.operatorId || 'OPR-SALES',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'SALES'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          const resData = await res.json()
          playSuccessBeep()

          const newReceiptEntry = {
            id: `RECEIPT-${Date.now()}`,
            productId,
            qty,
            status: verificationStatus,
            notes,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            operatorName: state.operatorName || state.operatorId || 'SALES'
          }

          set((s) => ({
            salesReceiptLogs: [newReceiptEntry, ...(s.salesReceiptLogs || [])],
            actionFeedback: {
              type: verificationStatus === 'ACC' ? 'success' : 'warning',
              message: resData.message || (verificationStatus === 'ACC' ? `Berhasil Acc ${qty} pack ke stok POS.` : `${qty} pack ditandai Onhold untuk audit.`)
            }
          }))

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal verifikasi penerimaan: ${err.message}`
            }
          })
          return false
        }
      },

      // Konversi Bahan Menjadi Kemasan Jadi (Mika/Vakum) & Cetak Label QR FG
      completePackingToFG: async ({ trayCodes, doughCodes, wrapperCodes, mikaQty, vakumQty, rejectPcs, sauceCodes, notes }) => {
        const state = get()
        if (mikaQty <= 0 && vakumQty <= 0) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: 'Isi minimal 1 mika atau 1 vakum.' } })
          return false
        }

        try {
          const res = await apiFetch('/api/v1/production2/complete-packing-to-fg', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: state.activePlanId,
              tray_lot_codes: trayCodes || [],
              dough_lot_codes: doughCodes || null,
              wrapper_lot_codes: wrapperCodes || null,
              mika_output_qty: Number(mikaQty) || 0,
              vakum_output_qty: Number(vakumQty) || 0,
              reject_pcs: Number(rejectPcs) || 0,
              sauce_lot_codes: sauceCodes || [],
              operator_id: state.operatorId || 'OPR-PACKING',
              operator_role: state.userRole === 'STAKEHOLDER' ? 'STAKEHOLDER' : 'OPERATOR',
              notes: notes || null
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          const createdFgLots = await res.json()
          playSuccessBeep()

          const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false })
          const mikaCount = createdFgLots.filter((l) => l.lot_type === 'FG_MIKA').length
          const vakumCount = createdFgLots.filter((l) => l.lot_type === 'FG_VAKUM').length

          let msg = 'Selesai packing: '
          if (mikaCount > 0 && vakumCount > 0) msg += `${mikaCount} Mika & ${vakumCount} Vakum diterbitkan.`
          else if (mikaCount > 0) msg += `${mikaCount} Mika diterbitkan.`
          else msg += `${vakumCount} Vakum diterbitkan.`

          const mappedFgLots = createdFgLots.map((l) => {
            const isMika = l.lot_type === 'FG_MIKA'
            return {
              lotCode: l.lot_qr_code,
              title: isMika ? 'DIMSUM MIKA (50 PCS)' : 'DIMSUM VAKUM (25 PCS)',
              detail: isMika ? 'Isi 50 Buah · Kulit 9 cm' : 'Isi 25 Buah · Frozen Seal',
              weight: isMika ? '50 pcs' : '25 pcs',
              createdAt: timestamp
            }
          })

          const fgPrintPayload = mappedFgLots.length > 0 ? {
            lotCode: mappedFgLots[0].lotCode,
            title: mappedFgLots[0].title,
            detail: mappedFgLots[0].detail,
            weight: mappedFgLots[0].weight,
            createdAt: timestamp,
            lotList: mappedFgLots
          } : null

          set({
            actionFeedback: { type: 'success', message: msg },
            activePrintModal: fgPrintPayload,
            lastBatchPrintModal: fgPrintPayload || get().lastBatchPrintModal
          })

          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal packing produk jadi: ${err.message}` } })
          return false
        }
      },
      dispatchFgToFreezer: async (lotCodes) => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production2/dispatch-to-freezer', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: state.userRole === 'STAKEHOLDER' ? 'CHECKER' : 'OPERATOR_CETAK'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `${lotCodes.length} kemasan masuk freezer.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal simpan freezer: ${err.message}` } })
          return false
        }
      },

      // Kirim FG Langsung ke Distribusi (Tanpa Masuk Freezer)
      dispatchFgToDistribution: async (lotCodes, destinationNotes = 'Kirim Langsung') => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production2/dispatch-direct-distribution', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: state.userRole === 'STAKEHOLDER' ? 'CHECKER' : 'OPERATOR_CETAK',
              notes: destinationNotes
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `${lotCodes.length} kemasan langsung dikirim.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal kirim: ${err.message}` } })
          return false
        }
      },

      // Scan 1: Verifikasi Packing / Laporan Produksi (Belum Masuk POS)
      verifyPackingFg: async (lotCodes) => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production2/verify-packing', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: state.userRole === 'STAKEHOLDER' ? 'CHECKER' : 'OPERATOR_PACKING',
              notes: 'Laporan packing selesai (belum masuk POS)'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `${lotCodes.length} kemasan dicatat dalam laporan packing.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal verifikasi packing: ${err.message}` } })
          return false
        }
      },

      // Scan 2: Terima Stok Penjualan (Konfirmasi Fisik & Masuk Stok POS)
      receiveSalesStockFg: async (lotCodes) => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production2/receive-sales-stock', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: 'SALES',
              notes: 'Diterima di toko (stok POS aktif)'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `${lotCodes.length} kemasan diterima. Stok POS bertambah.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({ actionFeedback: { type: 'error', message: `Gagal terima stok penjualan: ${err.message}` } })
          return false
        }
      },

      // =========================================================================
      // ACTIONS: KONFIRMASI STOCK-IN (PEGAWAI TEMPEL QR & SCAN FISIK)
      // =========================================================================
      confirmStockInLot: async (scannedLotCode, actualWeight = null) => {
        const cleanCode = scannedLotCode.trim().toUpperCase()
        const state = get()

        let lot = state.seasoningLots.find((l) => l.lotCode === cleanCode)
          || state.meatLots.find((l) => l.lotCode === cleanCode)
          || state.wrapperLots.find((l) => l.lotCode === cleanCode)
          || state.sauceLots.find((l) => l.lotCode === cleanCode)
          || state.doughLots.find((l) => l.lotCode === cleanCode)

        if (lot && lot.status !== 'PRINTED_PENDING_STOCK_IN') {
          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'info',
              message: `${cleanCode} sudah masuk stok sebelumnya.`
            }
          })
          return true
        }

        try {
          const res = await apiFetch('/api/v1/production1/lot/confirm-stock-in', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: [cleanCode],
              operator_id: state.operatorId,
              operator_role: state.operatorName || 'OPERATOR',
              actual_weight_kg: actualWeight,
              notes: 'Konfirmasi stok fisik'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Masuk stok sukses: ${cleanCode} aktif di stasiun.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal Stock-In ${cleanCode}: ${err.message}`
            }
          })
          return false
        }
      },

      confirmStockInBatch: async (lotCodes) => {
        const state = get()
        if (!lotCodes || lotCodes.length === 0) return false

        try {
          const res = await apiFetch('/api/v1/production1/lot/confirm-stock-in', {
            method: 'POST',
            body: JSON.stringify({
              lot_codes: lotCodes,
              operator_id: state.operatorId,
              operator_role: state.operatorName || 'OPERATOR',
              notes: 'Konfirmasi stok fisik'
            })
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || `Server error (${res.status})`)
          }

          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: `Berhasil masuk stok ${lotCodes.length} produk.`
            }
          })
          await get().fetchInitialData(true)
          return true
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: `Gagal batch Stock-In: ${err.message}`
            }
          })
          return false
        }
      },

      // =========================================================================
      // SCAN FEEDBACK & STATE MACHINE ACTIONS (1X VS 2X MODE)
      // =========================================================================
      setScanFeedbackBanner: (banner) => {
        set({ scanFeedbackBanner: banner })
      },

      clearScanFeedbackBanner: () => {
        set({ scanFeedbackBanner: null })
      },

      startScanSession: (station, intent) => {
        set({ activeScanSession: { station, intent } })
      },

      endScanSession: () => {
        set({ activeScanSession: null })
      },

      fetchScanModeSettings: async () => {
        set({ isScanModeLoading: true })
        try {
          const res = await apiFetch('/api/v1/settings/scan-mode')
          if (res.ok) {
            const data = await res.json()
            set({ scanModeSettings: data })
            return data
          }
        } catch (err) {
          console.error('Error fetching scan mode settings:', err)
        } finally {
          set({ isScanModeLoading: false })
        }
      },

      updateScanModeSettings: async (payload) => {
        set({ isScanModeLoading: true })
        try {
          const res = await apiFetch('/api/v1/settings/scan-mode', {
            method: 'POST',
            body: JSON.stringify(payload)
          })
          if (res.ok) {
            const data = await res.json()
            set({
              scanModeSettings: data,
              actionFeedback: { type: 'success', message: 'Mode scan berhasil diperbarui.' }
            })
            await get().fetchInitialData(true)
            return { success: true, data }
          } else {
            const err = await res.json()
            set({ actionFeedback: { type: 'error', message: err.detail || 'Gagal mengubah mode scan.' } })
            return { success: false, message: err.detail }
          }
        } catch (err) {
          set({ actionFeedback: { type: 'error', message: 'Koneksi error saat update mode scan.' } })
          return { success: false, message: err.message }
        } finally {
          set({ isScanModeLoading: false })
        }
      },

      triggerScanUndo: async (lotCode) => {
        const cleanCode = (lotCode || '').trim().toUpperCase()
        if (!cleanCode) return
        try {
          const res = await apiFetch('/api/v1/scan/undo', {
            method: 'POST',
            body: JSON.stringify({ lot_code: cleanCode })
          })
          if (res.ok) {
            const data = await res.json()
            playSuccessBeep()
            get().clearScanFeedbackBanner()
            set({
              actionFeedback: { type: 'success', message: data.message }
            })
            await get().fetchInitialData(true)
            return { success: true, data }
          } else {
            const err = await res.json()
            playErrorBeep()
            set({
              actionFeedback: { type: 'error', message: err.detail || 'Gagal membatalkan scan.' }
            })
            return { success: false, message: err.detail }
          }
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: { type: 'error', message: 'Gagal koneksi saat membatalkan scan.' }
          })
          return { success: false, message: err.message }
        }
      },

      triggerScanTransition: async (lotCode, stationId, notes, intentOverride = null) => {
        const cleanCode = (lotCode || '').trim().toUpperCase()
        if (!cleanCode) return { success: false, message: 'Kode barcode kosong.' }
        const state = get()
        const intent = intentOverride || state.activeScanSession?.intent || undefined
        try {
          const res = await apiFetch('/api/v1/scan/process', {
            method: 'POST',
            body: JSON.stringify({
              lot_code: cleanCode,
              station_id: stationId,
              intent: intent,
              notes: notes || undefined
            })
          })

          const data = await res.json()
          if (res.ok) {
            playSuccessBeep()
            if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
              navigator.vibrate([100, 50, 100])
            }
            get().setScanFeedbackBanner({
              type: data.semantic_variant || 'info',
              title:
                data.action === 'CONFIRM_STOCK'
                  ? 'Masuk stok'
                  : data.action === 'SCAN_OUT'
                  ? 'Keluar'
                  : data.action === 'SCAN_IN'
                  ? 'Diterima'
                  : 'Sukses',
              message: data.message,
              code: cleanCode,
              action: data.action,
              canUndo: data.can_undo,
              expiresAt: Date.now() + 15000
            })
            await get().fetchInitialData(true)
            return { success: true, message: data.message, code: cleanCode, data }
          } else {
            playErrorBeep()
            if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
              navigator.vibrate([250])
            }
            const errMsg = data.detail || 'Transisi scan gagal.'
            const isScanInReject = errMsg.toLowerCase().includes('tidak bisa di-scan in')
            get().setScanFeedbackBanner({
              type: 'danger',
              title: isScanInReject ? 'Tidak Bisa Scan In' : 'Ditolak',
              message: errMsg,
              code: cleanCode,
              canUndo: false
            })
            return { success: false, message: errMsg, code: cleanCode }
          }
        } catch (err) {
          playErrorBeep()
          const errMsg = err.message || 'Koneksi server gagal.'
          get().setScanFeedbackBanner({
            type: 'danger',
            title: 'Gagal',
            message: errMsg,
            code: cleanCode,
            canUndo: false
          })
          return { success: false, message: errMsg, code: cleanCode }
        }
      },

      // =========================================================================
      // UNIVERSAL SCAN BARCODE HANDLER (Single Source of Truth)
      // =========================================================================
      processUniversalBarcode: async (scannedText) => {
        const cleanText = (scannedText || '').trim().toUpperCase()
        const state = get()
        if (!cleanText) return { success: false, message: 'Kode kosong.' }

        // 1. Debounce di frontend (1.5 detik untuk kode yang sama)
        const now = Date.now()
        if (state.lastUniversalScanTime?.code === cleanText && now - state.lastUniversalScanTime.time < 1500) {
          return { success: false, message: 'Scan beruntun terlalu cepat (diabaikan).', code: cleanText }
        }
        set({ lastUniversalScanTime: { code: cleanText, time: now } })

        // 2. Mode Khusus: Pemilihan Wadah Mixing (Kamera Reticle)
        if (state.cameraScannerConfig?.mode === 'MIXING_MATCH') {
          if (cleanText.startsWith('DG-')) {
            const added = state.toggleSelectMeat(cleanText)
            playSuccessBeep()
            const count = get().selectedMeatCodes.length
            const msg = added
              ? `Daging ${cleanText} dipilih (${count} Daging).`
              : `Daging ${cleanText} dilepas (${count} Daging).`
            return { success: true, message: msg, code: cleanText }
          }
          if (cleanText.startsWith('BM-')) {
            const added = state.toggleSelectBumbu(cleanText)
            playSuccessBeep()
            const count = get().selectedBumbuCodes.length
            const msg = added
              ? `Bumbu ${cleanText} dipilih (${count} Bumbu).`
              : `Bumbu ${cleanText} dilepas (${count} Bumbu).`
            return { success: true, message: msg, code: cleanText }
          }
        }

        // 3. Sesi Scan Aktif ATAU Divisi Produksi 1 / Lot Material via Central State Machine
        if (
          state.activeScanSession ||
          state.activeProductionStage === 'PROD_1' ||
          cleanText.startsWith('DG-') ||
          cleanText.startsWith('BM-') ||
          cleanText.startsWith('AD-') ||
          cleanText.startsWith('KL-') ||
          cleanText.startsWith('SA-')
        ) {
          // Tentukan stasiun aktif operator saat ini
          let currentStation
          if (state.activeScanSession?.station) {
            currentStation = state.activeScanSession.station
          } else if (state.activeProductionStage === 'PROD_2') {
            // Sesuai aturan: Saos diterima di Meja Packing (FINISHING_STATION), Adonan & Kulit di Meja Cetak (ASSEMBLY_STATION)
            if (cleanText.startsWith('SA-')) {
              currentStation = 'FINISHING_STATION'
            } else {
              currentStation = 'ASSEMBLY_STATION'
            }
          } else {
            if (state.activeStation === 'SEASONING') currentStation = 'SEASONING_STATION'
            else if (state.activeStation === 'WRAPPER') currentStation = 'WRAPPER_STATION'
            else if (state.activeStation === 'SAUCE') currentStation = 'SAUCE_STATION'
            else currentStation = 'MEAT_STATION'
          }

          const intent = state.activeScanSession?.intent || undefined
          const res = await state.triggerScanTransition(cleanText, currentStation, null, intent)
          return res
        }


        // 5. Finished Goods (FG-MIKA- / FG-VAKUM-)
        if (cleanText.startsWith('FG-')) {
          const lot = state.finishedGoodsLots.find((f) => f.lotCode === cleanText)
          if (!lot) {
            playErrorBeep()
            const msg = `Produk ${cleanText} tidak ditemukan.`
            set({ actionFeedback: { type: 'error', message: msg } })
            return { success: false, message: msg, code: cleanText }
          }

          // Skenario A: Operator berada di Tab Produk / Penjualan (Scan 2: Masuk Stok POS)
          if (state.activeProductionStage === 'PROD_2' && state.activeProd2Tab === 'PRODUCTS') {
            if (lot.status === 'IN_SALES_STOCK' || lot.status === 'IN_FREEZER_STORAGE') {
              playSuccessBeep()
              const msg = `Produk ${cleanText} sudah aktif di stok POS.`
              set({ actionFeedback: { type: 'info', message: msg } })
              return { success: true, message: msg, code: cleanText }
            }

            const ok = await state.receiveSalesStockFg([cleanText])
            return {
              success: ok,
              message: ok ? `Produk ${cleanText} diterima di Penjualan. Stok POS aktif.` : `Gagal terima ${cleanText}`,
              code: cleanText
            }
          }

          // Skenario B: Operator berada di Tab Meja Packing (Scan 1: Laporan Produksi)
          if (state.activeProductionStage === 'PROD_2' && state.activeProd2Tab === 'FREEZER') {
            if (lot.status === 'PACKED_VERIFIED') {
              playSuccessBeep()
              const msg = `Produk ${cleanText} sudah diverifikasi packing. Menunggu diterima toko.`
              set({ actionFeedback: { type: 'info', message: msg } })
              return { success: true, message: msg, code: cleanText }
            }

            if (lot.status === 'IN_SALES_STOCK' || lot.status === 'IN_FREEZER_STORAGE') {
              playSuccessBeep()
              const msg = `Produk ${cleanText} sudah diterima bagian penjualan.`
              set({ actionFeedback: { type: 'info', message: msg } })
              return { success: true, message: msg, code: cleanText }
            }

            const ok = await state.verifyPackingFg([cleanText])
            return {
              success: ok,
              message: ok ? `Laporan packing ${cleanText} tercatat (belum masuk POS).` : `Gagal verifikasi ${cleanText}`,
              code: cleanText
            }
          }

          // Skenario C: Di tab lain, ikuti status lot saat ini
          if (lot.status === 'READY_IN_ASSEMBLY_STATION') {
            const ok = await state.verifyPackingFg([cleanText])
            return {
              success: ok,
              message: ok ? `Laporan packing ${cleanText} tercatat (belum masuk POS).` : `Gagal verifikasi ${cleanText}`,
              code: cleanText
            }
          }

          if (lot.status === 'PACKED_VERIFIED') {
            const ok = await state.receiveSalesStockFg([cleanText])
            return {
              success: ok,
              message: ok ? `Produk ${cleanText} diterima di Penjualan. Stok POS aktif.` : `Gagal terima ${cleanText}`,
              code: cleanText
            }
          }

          if (lot.status === 'IN_SALES_STOCK' || lot.status === 'IN_FREEZER_STORAGE') {
            playSuccessBeep()
            const msg = `Produk ${cleanText} sudah aktif di stok POS.`
            set({ actionFeedback: { type: 'info', message: msg } })
            return { success: true, message: msg, code: cleanText }
          }

          if (lot.status === 'DISTRIBUTED') {
            playSuccessBeep()
            const msg = `Produk ${cleanText} sudah terkirim.`
            set({ actionFeedback: { type: 'info', message: msg } })
            return { success: true, message: msg, code: cleanText }
          }
        }

        // 6. Wadah / Nampan Meja Cetak (WD-MIKA- / WD-VAK-)
        if (cleanText.startsWith('WD-')) {
          const activeLine = state.packingSubLine || 'MIKA'
          const isMikaTray = cleanText.startsWith('WD-MIKA-')
          const isVakumTray = cleanText.startsWith('WD-VAK-')

          // Jika scan dilakukan di Tab Meja Packing (PROD_2 + FREEZER)
          if (state.activeProductionStage === 'PROD_2' && state.activeProd2Tab === 'FREEZER') {
            // Strict Line Isolation / Security Boundary
            if (activeLine === 'MIKA' && isVakumTray) {
              playErrorBeep()
              const msg = `Akses Ditolak: Nampan ${cleanText} adalah Dimsum Vakum, tidak boleh di-scan di Line Dimsum Mika.`
              set({ actionFeedback: { type: 'error', message: msg } })
              return { success: false, message: msg, code: cleanText }
            }

            if (activeLine === 'VAKUM' && isMikaTray) {
              playErrorBeep()
              const msg = `Akses Ditolak: Nampan ${cleanText} adalah Dimsum Mika, tidak boleh di-scan di Line Dimsum Vakum.`
              set({ actionFeedback: { type: 'error', message: msg } })
              return { success: false, message: msg, code: cleanText }
            }

            const trayLot = (state.trayLots || []).find((t) => t.lotCode === cleanText)
            if (trayLot) {
              if (trayLot.status === 'IN_PACKING_STATION') {
                playSuccessBeep()
                const msg = `Wadah ${cleanText} sudah diterima di Meja Packing (siap dikemas).`
                set({ actionFeedback: { type: 'info', message: msg } })
                return { success: true, message: msg, code: cleanText }
              }
              if (trayLot.status === 'CONSUMED') {
                playErrorBeep()
                const msg = `Wadah ${cleanText} sudah selesai dikemas menjadi produk jadi.`
                set({ actionFeedback: { type: 'error', message: msg } })
                return { success: false, message: msg, code: cleanText }
              }
            }

            const ok = await state.receiveTraysInPacking([cleanText], activeLine)
            return {
              success: ok,
              message: ok ? `Nampan ${cleanText} berhasil diterima di Line ${activeLine}.` : `Gagal terima ${cleanText}`,
              code: cleanText
            }
          }

          // Di luar tab Meja Packing
          const trayLot = (state.trayLots || []).find((t) => t.lotCode === cleanText)
          if (trayLot) {
            playSuccessBeep()
            const msg = `Wadah ${cleanText} status: ${trayLot.status || 'Aktif'}.`
            set({ actionFeedback: { type: 'info', message: msg } })
            return { success: true, message: msg, code: cleanText }
          }
        }

        playErrorBeep()
        const msg = `Format barcode ${cleanText} tidak dikenali.`
        set({ actionFeedback: { type: 'error', message: msg } })
        return { success: false, message: msg, code: cleanText }
      },

      // =========================================================================
      // BACKGROUND AUTO-SYNC & INITIAL DATA FETCH ENGINE
      // =========================================================================
      startAutoSync: () => {
        if (autoSyncInterval) return
        get().fetchInitialData(true)
        autoSyncInterval = setInterval(() => {
          get().fetchInitialData(true)
        }, 3000)
      },

      stopAutoSync: () => {
        if (autoSyncInterval) {
          clearInterval(autoSyncInterval)
          autoSyncInterval = null
        }
      },

      fetchInitialData: async (isSilent = false) => {
        if (!isSilent) {
          set({ isSyncing: true })
        }
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const todayStr = `${yyyy}-${mm}-${dd}`
        const todayPlanId = `PLAN-${yyyy}${mm}${dd}-01`

        if (get().activePlanId !== todayPlanId) {
          set({ activePlanId: todayPlanId })
        }

        const currentPlan = get().dailyPlan
        if (currentPlan?.planDate && currentPlan.planDate !== todayStr) {
          // Reset otomatis rencana harian jika hari berganti
          set({
            dailyPlan: {
              planDate: todayStr,
              orderMika: 0,
              orderVakum: 0,
              onlineVakum: 0,
              onlineMika: 0,
              offlineMika: 0,
              offlineVakum: 0,
              bumperMika: 0,
              bumperVakum: 0,
              totalMika: 0,
              totalVakum: 0,
              totalPcs: 0,
              doughKg: 0,
              targetGilingan: 0
            },
            targetGilingan: 0
          })
        }

        try {
          const resPlan = await apiFetch('/api/v1/production1/plans/active', { silent: isSilent })
          if (resPlan.ok) {
            const activePlan = await resPlan.json().catch(() => null)
            if (activePlan) {
              const currentPlan = get().dailyPlan
              const planIdChanged = get().activePlanId !== (activePlan.plan_id || todayPlanId)
              const gilinganChanged = get().targetGilingan !== (activePlan.target_gilingan || 0)
              const mikaChanged = (currentPlan?.totalMika ?? 0) !== (activePlan.target_mika_pax ?? 0)
              const vakumChanged = (currentPlan?.totalVakum ?? 0) !== (activePlan.target_vakum_pax ?? 0)
              const statusChanged = get().planStatus !== (activePlan.status || 'DRAFT')
              const versionChanged = get().planVersion !== (activePlan.version || 1)
              const batchesLengthChanged = (get().planBatches || []).length !== (activePlan.batches || []).length

              // Update state jika ada perubahan nyata dari backend
              if (planIdChanged || gilinganChanged || mikaChanged || vakumChanged || statusChanged || versionChanged || batchesLengthChanged) {
                set((s) => ({
                  planStatus: activePlan.status || 'DRAFT',
                  planVersion: activePlan.version || 1,
                  planBatches: Array.isArray(activePlan.batches) ? activePlan.batches : [],
                  publishedAt: activePlan.published_at || null,
                  publishedBy: activePlan.published_by || null,
                  targetGilingan: activePlan.target_gilingan || 0,
                  activePlanId: activePlan.plan_id || todayPlanId,
                  dailyPlan: {
                    ...s.dailyPlan,
                    planDate: activePlan.plan_date || todayStr,
                    orderMika: activePlan.order_mika !== undefined && activePlan.order_mika !== null ? activePlan.order_mika : (s.dailyPlan?.orderMika ?? 0),
                    orderVakum: activePlan.order_vakum !== undefined && activePlan.order_vakum !== null ? activePlan.order_vakum : (s.dailyPlan?.orderVakum ?? 0),
                    bumperMika: activePlan.bumper_mika !== undefined && activePlan.bumper_mika !== null ? activePlan.bumper_mika : (s.dailyPlan?.bumperMika ?? 0),
                    bumperVakum: activePlan.bumper_vakum !== undefined && activePlan.bumper_vakum !== null ? activePlan.bumper_vakum : (s.dailyPlan?.bumperVakum ?? 0),
                    manualGilingan: activePlan.manual_gilingan !== undefined ? activePlan.manual_gilingan : (s.dailyPlan?.manualGilingan ?? null),
                    manualBumbuKarung: activePlan.manual_bumbu !== undefined ? activePlan.manual_bumbu : (s.dailyPlan?.manualBumbuKarung ?? null),
                    targetGilingan: activePlan.target_gilingan || 0,
                    totalMika: activePlan.target_mika_pax ?? s.dailyPlan?.totalMika ?? 0,
                    totalVakum: activePlan.target_vakum_pax ?? s.dailyPlan?.totalVakum ?? 0,
                    targetMikaPax: activePlan.target_mika_pax || 0,
                    targetVakumPax: activePlan.target_vakum_pax || 0
                  }
                }))
              }
            }
          }
        } catch {
          // ignore plan fetch error
        }

        try {
          const resLots = await apiFetch('/api/v1/production1/lots', { silent: isSilent })
          if (resLots.ok) {
            const text = await resLots.text()
            let dbLots = []
            try {
              dbLots = JSON.parse(text)
            } catch {
              console.warn('[MES Sync] Response /lots bukan format JSON valid.')
            }

            // Sync selalu - termasuk saat DB kosong agar override localStorage lama
            if (Array.isArray(dbLots)) {
              const state = get()
              const bumbuLots = dbLots
                .filter((l) => l.lot_type === 'BUMBU')
                .map((l) => {
                  const parts = l.lot_qr_code.split('-')
                  const idx = parseInt(parts[parts.length - 1] || '1', 10)
                  return {
                    lotCode: l.lot_qr_code,
                    planId: l.plan_id || state.activePlanId,
                    sackNumber: idx,
                    quantity: Number(l.quantity) || 0,
                    unit: l.unit || 'PORSI',
                    status: l.current_status,
                    stationId: l.current_station,
                    createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                    createdAtIso: l.created_at || '',
                    createdAt: l.created_at
                      ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                      : '--:--:--'
                  }
                })

              // Cek apakah ada bumbu baru dalam perjalanan (transit)
              const currentTransitCount = bumbuLots.filter((l) => l.status === 'IN_TRANSIT_TO_MEAT_MIXING').length
              if (currentTransitCount > lastTransitBumbuCount && state.activeStation === 'MEAT') {
                playSuccessBeep()
                set({
                  actionFeedback: {
                    type: 'info',
                    message: `${currentTransitCount} karung bumbu racik sedang diantar dari Ruang Bumbu.`
                  }
                })
              }
              lastTransitBumbuCount = currentTransitCount

              const meatLots = dbLots
                .filter((l) => l.lot_type === 'DAGING')
                .map((l) => ({
                  lotCode: l.lot_qr_code,
                  planId: l.plan_id || state.activePlanId,
                  weightKg: Number(l.quantity) || 15.0,
                  status: l.current_status,
                  stationId: l.current_station,
                  createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                  createdAtIso: l.created_at || '',
                  createdAt: l.created_at
                    ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                    : '--:--:--'
                }))

              const doughLots = dbLots
                .filter((l) => l.lot_type === 'ADONAN')
                .map((l) => ({
                  lotCode: l.lot_qr_code,
                  planId: l.plan_id || state.activePlanId,
                  parentMeatLot: 'DG-REF',
                  parentBumbuLot: 'BM-REF',
                  meatKg: 15.0,
                  doughYieldKg: Number(l.quantity) || null,
                  status: l.current_status,
                  stationId: l.current_station,
                  createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                  createdAtIso: l.created_at || '',
                  createdAt: l.created_at
                    ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                    : '--:--:--'
                }))

              const wrapperLots = dbLots
                .filter((l) => l.lot_type === 'KULIT' || l.lot_type?.startsWith('KULIT'))
                .map((l) => {
                  const qty = Number(l.quantity) || 1
                  const unit = l.unit || 'BAL'
                  const balCount = unit === 'BAL' ? qty : Number((qty / 15).toFixed(2))
                  const weightKg = unit === 'BAL' ? Number((qty * 15).toFixed(2)) : qty
                  const existing = state.wrapperLots.find((w) => w.lotCode === l.lot_qr_code)
                  const cleanType = l.lot_type === 'KULIT_7CM' || l.lot_type === 'KULIT_9CM'
                    ? l.lot_type
                    : (existing?.type || 'KULIT_9CM')
                  const typeName = existing?.typeName || (cleanType === 'KULIT_7CM' ? 'Kulit Dimsum 7 cm (Vakum)' : 'Kulit Dimsum 9 cm (Mika)')

                  return {
                    lotCode: l.lot_qr_code,
                    type: cleanType,
                    typeName: typeName,
                    balQty: balCount,
                    weightKg: weightKg,
                    status: l.current_status,
                    stationId: l.current_station,
                    createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                    createdAtIso: l.created_at || '',
                    createdAt: l.created_at
                      ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                      : '--:--:--'
                  }
                })

              const sauceLots = dbLots
                .filter((l) => l.lot_type === 'SAOS' || l.lot_type?.startsWith('SAOS'))
                .map((l) => {
                  const existing = state.sauceLots.find((s) => s.lotCode === l.lot_qr_code)
                  let cleanType = existing?.type || 'REGULER'
                  if (l.lot_type === 'SAOS_VAKUM' || l.lot_type === 'SAOS_MINI') cleanType = 'MINI'
                  else if (l.lot_type === 'SAOS_MIKA' || l.lot_type === 'SAOS_REGULER') cleanType = 'REGULER'
                  const isMini = cleanType === 'MINI'
                  const typeName = existing?.typeName || (isMini ? 'Saos Vakum' : 'Saos Mika')
                  const itemsPerBal = isMini ? 200 : 50

                  return {
                    lotCode: l.lot_qr_code,
                    type: cleanType,
                    typeName: typeName,
                    balQty: Number(l.quantity) || 1,
                    itemsPerBal: itemsPerBal,
                    status: l.current_status,
                    stationId: l.current_station,
                    createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                    createdAtIso: l.created_at || '',
                    createdAt: l.created_at
                      ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                      : '--:--:--'
                  }
                })

              const fgLots = dbLots
                .filter((l) => l.lot_type === 'FG_MIKA' || l.lot_type === 'FG_VAKUM')
                .map((l) => {
                  const isMika = l.lot_type === 'FG_MIKA'
                  return {
                    lotCode: l.lot_qr_code,
                    type: l.lot_type,
                    typeName: isMika ? 'Dimsum Mika (50 Pcs)' : 'Dimsum Vakum (25 Pcs)',
                    quantity: Number(l.quantity) || (isMika ? 50 : 25),
                    unit: l.unit || (isMika ? 'MIKA' : 'PACK'),
                    status: l.current_status,
                    stationId: l.current_station,
                    createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                    createdAtIso: l.created_at || '',
                    createdAt: l.created_at
                      ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                      : '--:--:--'
                  }
                })

              const trayLots = dbLots
                .filter((l) => l.lot_type === 'WADAH_CETAK' || l.lot_type === 'WADAH_MIKA' || l.lot_type === 'WADAH_VAKUM' || (l.lot_type && l.lot_type.startsWith('WADAH_')))
                .map((l) => {
                  const isVakum = l.lot_type === 'WADAH_VAKUM' || l.lot_qr_code.includes('VAK')
                  return {
                    lotCode: l.lot_qr_code,
                    planId: l.plan_id || state.activePlanId,
                    trayCount: Number(l.quantity) || 1,
                    productType: isVakum ? 'FG_VAKUM' : 'FG_MIKA',
                    productLabel: isVakum ? 'Dimsum Vakum' : 'Dimsum Mika',
                    photoEvidence: l.photo_evidence || null,
                    status: l.current_status,
                    stationId: l.current_station,
                    createdDate: formatBackendLotDate(l.lot_qr_code, l.created_at),
                    createdAtIso: l.created_at || '',
                    createdAt: l.created_at
                      ? new Date(l.created_at.endsWith('Z') ? l.created_at : l.created_at + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                      : '--:--:--'
                  }
                })

              // Bersihkan kode daging/bumbu terpilih jika sudah CONSUMED di backend
              const validMeatCodes = new Set(meatLots.filter((m) => m.status === 'READY_IN_MEAT_STATION').map((m) => m.lotCode))
              const validBumbuCodes = new Set(bumbuLots.filter((b) => b.status === 'IN_MEAT_MIXING_STATION').map((b) => b.lotCode))
              const cleanSelectedMeat = state.selectedMeatCodes.filter((c) => validMeatCodes.has(c))
              const cleanSelectedBumbu = state.selectedBumbuCodes.filter((c) => validBumbuCodes.has(c))

              set({
                seasoningLots: bumbuLots,
                meatLots: meatLots,
                doughLots: doughLots,
                wrapperLots: wrapperLots,
                sauceLots: sauceLots,
                finishedGoodsLots: fgLots,
                trayLots: trayLots,
                selectedMeatCodes: cleanSelectedMeat,
                selectedBumbuCodes: cleanSelectedBumbu
              })
            }
          }

          const resLogs = await apiFetch('/api/v1/production1/custody-logs', { silent: isSilent })
          if (resLogs.ok) {
            const text = await resLogs.text()
            let dbLogs = []
            try {
              dbLogs = JSON.parse(text)
            } catch {
              // ignore non-json
            }
            if (Array.isArray(dbLogs)) {
              const mappedLogs = dbLogs.map((lg) => ({
                logId: lg.log_id,
                lotCode: lg.lot_qr_code,
                actionType: lg.action_type,
                stationId: lg.station_id,
                targetStation: lg.target_station,
                userId: lg.user_id,
                userRole: lg.user_role_active,
                notes: lg.notes,
                rawTimestamp: lg.timestamp,
                createdAtIso: lg.timestamp,
                timestamp: lg.timestamp
                  ? new Date(lg.timestamp.endsWith('Z') ? lg.timestamp : lg.timestamp + 'Z').toLocaleTimeString('id-ID', { hour12: false })
                  : '--:--:--'
              }))
              set({ custodyLogs: mappedLogs })
            }
          }

          // Muat konfigurasi mode scan
          get().fetchScanModeSettings().catch(() => {})

          const syncTime = new Date().toLocaleTimeString('id-ID', { hour12: false })
          set({ isSyncing: false, syncStatus: 'ONLINE', lastSyncedAt: syncTime })
        } catch (err) {
          console.warn('[MES Sync] Backend offline, data aman di localStorage:', err)
          set({ isSyncing: false, syncStatus: 'OFFLINE' })
        }
      },

      login: async (username, password) => {
        try {
          const res = await apiFetch('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || 'Login gagal. Periksa username dan password.')
          }
          const data = await res.json()
          const stage = data.user.default_stage || 'PROD_1'
          const station = data.user.default_station || 'MEAT'
          let prod2Tab = data.user.default_prod2_tab || 'INBOUND'
          if (prod2Tab === 'PACKING') prod2Tab = 'FREEZER'
          if (prod2Tab === 'SALES') prod2Tab = 'PRODUCTS'

          if (data.user.is_superadmin) {
            set({
              authToken: data.access_token,
              currentUser: data.user,
              operatorId: data.user.operator_id,
              operatorName: data.user.full_name,
              userRole: 'SUPERADMIN',
              activeProductionStage: 'PROD_1',
              isProfileActive: false,
              isAdminActive: true,
              activeAdminTab: 'USERS',
              actionFeedback: { type: 'success', message: `Selamat datang, Super Administrator ${data.user.full_name}!` }
            })
            try {
              window.location.hash = '#/admin'
            } catch {
              // ignore
            }
            return { success: true, user: data.user }
          }

          let landingHash = '#/meat'
          if (stage === 'PROD_2') {
            if (prod2Tab === 'ASSEMBLY') landingHash = '#/prod2/assembly'
            else if (prod2Tab === 'FREEZER') landingHash = '#/prod2/packing'
            else if (prod2Tab === 'PRODUCTS') landingHash = '#/prod2/products'
            else if (prod2Tab === 'POS') landingHash = '#/pos'
            else landingHash = '#/prod2/inbound'
          } else {
            if (station === 'PLAN') landingHash = '#/plan'
            else if (station === 'MEAT') landingHash = '#/meat'
            else if (station === 'SEASONING') landingHash = '#/seasoning'
            else if (station === 'WRAPPER') landingHash = '#/wrapper'
            else if (station === 'SAUCE') landingHash = '#/sauce'
            else landingHash = '#/meat'
          }

          set({
            authToken: data.access_token,
            currentUser: data.user,
            operatorId: data.user.operator_id,
            operatorName: data.user.full_name,
            userRole: data.user.role,
            activeProductionStage: stage,
            activeStation: station,
            activeProd2Tab: prod2Tab,
            actionFeedback: { type: 'success', message: `Selamat datang, ${data.user.full_name} (${data.user.division})!` }
          })

          try {
            window.location.hash = landingHash
          } catch {
            // ignore
          }

          return { success: true, user: data.user }
        } catch (err) {
          set({ actionFeedback: { type: 'error', message: err.message } })
          return { success: false, error: err.message }
        }
      },

      changePassword: async ({ currentPassword, newPassword, confirmPassword }) => {
        try {
          const res = await apiFetch('/api/v1/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
              confirm_password: confirmPassword
            })
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(data.detail || 'Gagal mengubah password.')
          }
          set({
            actionFeedback: {
              type: 'success',
              message: data.message || 'Password berhasil diperbarui!'
            }
          })
          return { success: true, message: data.message }
        } catch (err) {
          set({
            actionFeedback: {
              type: 'error',
              message: err.message
            }
          })
          return { success: false, error: err.message }
        }
      },

      fetchCurrentUserProfile: async () => {
        try {
          const res = await apiFetch('/api/v1/auth/me', { silent: true })
          if (!res.ok) return null
          const data = await res.json()
          if (data && data.username) {
            set((s) => ({
              currentUser: {
                ...(s.currentUser || {}),
                ...data
              }
            }))
            return data
          }
        } catch {
          // offline fallback
        }
        return null
      },

      quickSwitchUser: async (username) => {
        try {
          const res = await apiFetch('/api/v1/auth/quick-switch', {
            method: 'POST',
            body: JSON.stringify({ username })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || 'Gagal beralih akun.')
          }
          const data = await res.json()
          const stage = data.user.default_stage || 'PROD_1'
          const station = data.user.default_station || 'MEAT'
          let prod2Tab = data.user.default_prod2_tab || 'INBOUND'
          if (prod2Tab === 'PACKING') prod2Tab = 'FREEZER'
          if (prod2Tab === 'SALES') prod2Tab = 'PRODUCTS'

          if (data.user.is_superadmin) {
            set({
              authToken: data.access_token,
              currentUser: data.user,
              operatorId: data.user.operator_id,
              operatorName: data.user.full_name,
              userRole: 'SUPERADMIN',
              activeProductionStage: 'PROD_1',
              isProfileActive: false,
              isAdminActive: true,
              activeAdminTab: 'USERS',
              actionFeedback: { type: 'success', message: `Selamat datang, Super Administrator ${data.user.full_name}!` }
            })
            try {
              window.location.hash = '#/admin'
            } catch {
              // ignore
            }
            return { success: true, user: data.user }
          }

          let landingHash = '#/meat'
          if (stage === 'PROD_2') {
            if (prod2Tab === 'ASSEMBLY') landingHash = '#/prod2/assembly'
            else if (prod2Tab === 'FREEZER') landingHash = '#/prod2/packing'
            else if (prod2Tab === 'PRODUCTS') landingHash = '#/prod2/products'
            else if (prod2Tab === 'POS') landingHash = '#/pos'
            else landingHash = '#/prod2/inbound'
          } else {
            if (station === 'PLAN') landingHash = '#/plan'
            else if (station === 'MEAT') landingHash = '#/meat'
            else if (station === 'SEASONING') landingHash = '#/seasoning'
            else if (station === 'WRAPPER') landingHash = '#/wrapper'
            else if (station === 'SAUCE') landingHash = '#/sauce'
            else landingHash = '#/meat'
          }

          set({
            authToken: data.access_token,
            currentUser: data.user,
            operatorId: data.user.operator_id,
            operatorName: data.user.full_name,
            userRole: data.user.role,
            activeProductionStage: stage,
            activeStation: station,
            activeProd2Tab: prod2Tab,
            actionFeedback: { type: 'success', message: `Beralih ke: ${data.user.full_name} [${data.user.role}] - ${data.user.division}` }
          })

          try {
            window.location.hash = landingHash
          } catch {
            // ignore
          }

          return { success: true, user: data.user }
        } catch (err) {
          set({ actionFeedback: { type: 'error', message: err.message } })
          return { success: false, error: err.message }
        }
      },

      logout: () => {
        set({
          authToken: null,
          currentUser: null,
          isProfileActive: false,
          isAdminActive: false,
          actionFeedback: { type: 'info', message: 'Anda telah logout dari sistem.' }
        })
        try {
          window.location.hash = '#/login'
        } catch {
          // ignore
        }
      },

      toggleDevMode: (val) => set((s) => ({ isDevMode: typeof val === 'boolean' ? val : !s.isDevMode })),

      wipeAllData: async () => {
        // Reset semua data lot dan log lokal
        set({
          meatLots: [],
          seasoningLots: [],
          doughLots: [],
          wrapperLots: [],
          sauceLots: [],
          finishedGoodsLots: [],
          trayLots: [],
          custodyLogs: [],
          salesReceiptLogs: [],
          selectedMeatCodes: [],
          selectedBumbuCodes: [],
          activePrintModal: null,
          lastBatchPrintModal: null,
          supplierInboundList: [],
          supplierOutboundList: [],
          dailyNotesList: [],
          actionFeedback: { type: 'success', message: 'Data lokal berhasil dibersihkan.' }
        })
        try {
          localStorage.removeItem('mdi_production1_storage')
        } catch {
          // Abaikan jika localStorage tidak dapat diakses
        }
      },

      wipeDatabase: async () => {
        if (!get().isPpicUser()) {
          const errMsg = 'Akses ditolak: Operasi wipe database hanya diizinkan untuk PPIC / Supervisor.'
          set({ actionFeedback: { type: 'error', message: errMsg } })
          throw new Error(errMsg)
        }

        try {
          const res = await apiFetch('/api/v1/production1/dev/wipe-database', {
            method: 'POST'
          })

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}))
            const errMsg = errJson.detail || 'Gagal melakukan wipe database di server.'
            throw new Error(errMsg)
          }

          const resData = await res.json().catch(() => ({}))

          const now = new Date()
          const yyyy = now.getFullYear()
          const mm = String(now.getMonth() + 1).padStart(2, '0')
          const dd = String(now.getDate()).padStart(2, '0')
          const todayStr = `${yyyy}-${mm}-${dd}`
          const newPlanId = `PLAN-${yyyy}${mm}${dd}-01`

          set({
            meatLots: [],
            seasoningLots: [],
            doughLots: [],
            wrapperLots: [],
            sauceLots: [],
            finishedGoodsLots: [],
            trayLots: [],
            custodyLogs: [],
            salesReceiptLogs: [],
            selectedMeatCodes: [],
            selectedBumbuCodes: [],
            activePrintModal: null,
            lastBatchPrintModal: null,
            supplierInboundList: [],
            supplierOutboundList: [],
            dailyNotesList: [],
            activePlanId: newPlanId,
            planStatus: 'DRAFT',
            planVersion: 1,
            planBatches: [],
            publishedAt: null,
            publishedBy: null,
            targetGilingan: 0,
            dailyPlan: {
              planDate: todayStr,
              orderMika: 0,
              orderVakum: 0,
              onlineVakum: 0,
              onlineMika: 0,
              offlineMika: 0,
              offlineVakum: 0,
              bumperMika: 0,
              bumperVakum: 0,
              manualGilingan: null,
              manualBumbuKarung: null,
              targetKulitBal: 0,
              targetKulit9cmBal: 0,
              targetKulit7cmBal: 0,
              targetSaosBal: 0,
              targetSaosMikaBal: 0,
              targetSaosVakumBal: 0,
              totalMika: 0,
              totalVakum: 0,
              totalPcs: 0,
              doughKg: 0,
              targetGilingan: 0
            },
            actionFeedback: {
              type: 'success',
              message: resData.message || 'Database berhasil di-wipe dan data operasional telah direset.'
            }
          })

          if (get().fetchInitialData) {
            await get().fetchInitialData(true)
          }
          if (get().fetchSupplierInbound) {
            await get().fetchSupplierInbound()
          }
          if (get().fetchSupplierOutbound) {
            await get().fetchSupplierOutbound()
          }
          if (get().fetchDailyNotes) {
            await get().fetchDailyNotes()
          }

          return { success: true, message: resData.message || 'Database berhasil di-wipe.' }
        } catch (err) {
          playErrorBeep()
          const errMsg = err?.message || 'Gagal melakukan wipe database.'
          set({
            actionFeedback: {
              type: 'error',
              message: errMsg
            }
          })
          throw err
        }
      },

      // 15. AKSI SIKLUS HIDUP RENCANA PPIC & CETAK QR (AYU)
      updatePlanDraft: async (draftData = {}) => {
        const state = get()
        const payload = {
          plan_id: state.activePlanId,
          version: state.planVersion || 1,
          order_mika: draftData.orderMika !== undefined ? Number(draftData.orderMika) : Number(state.dailyPlan.orderMika || 0),
          order_vakum: draftData.orderVakum !== undefined ? Number(draftData.orderVakum) : Number(state.dailyPlan.orderVakum || 0),
          bumper_mika: draftData.bumperMika !== undefined ? Number(draftData.bumperMika) : Number(state.dailyPlan.bumperMika || 0),
          bumper_vakum: draftData.bumperVakum !== undefined ? Number(draftData.bumperVakum) : Number(state.dailyPlan.bumperVakum || 0),
          manual_gilingan: draftData.manualGilingan !== undefined && draftData.manualGilingan !== '' && draftData.manualGilingan !== null
            ? Number(draftData.manualGilingan)
            : null,
          manual_bumbu: draftData.manualBumbuKarung !== undefined && draftData.manualBumbuKarung !== '' && draftData.manualBumbuKarung !== null
            ? Number(draftData.manualBumbuKarung)
            : null,
          target_kulit: draftData.kulit !== undefined && draftData.kulit !== '' && draftData.kulit !== null
            ? Number(draftData.kulit)
            : null,
          target_kulit_9cm: draftData.kulit9cm !== undefined && draftData.kulit9cm !== '' && draftData.kulit9cm !== null
            ? Number(draftData.kulit9cm)
            : null,
          target_kulit_7cm: draftData.kulit7cm !== undefined && draftData.kulit7cm !== '' && draftData.kulit7cm !== null
            ? Number(draftData.kulit7cm)
            : null,
          target_saos: draftData.saos !== undefined && draftData.saos !== '' && draftData.saos !== null
            ? Number(draftData.saos)
            : null,
          target_saos_mika: draftData.saosMika !== undefined && draftData.saosMika !== '' && draftData.saosMika !== null
            ? Number(draftData.saosMika)
            : null,
          target_saos_vakum: draftData.saosVakum !== undefined && draftData.saosVakum !== '' && draftData.saosVakum !== null
            ? Number(draftData.saosVakum)
            : null
        }

        try {
          const res = await apiFetch('/api/v1/production1/plans/draft', {
            method: 'PUT',
            body: JSON.stringify(payload)
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            if (res.status === 409) {
              await state.fetchInitialData(true)
              throw new Error(errData.detail || 'Rencana telah diubah oleh pihak lain. Data dimuat ulang.')
            }
            throw new Error(errData.detail || `Gagal menyimpan draft (${res.status})`)
          }
          const savedPlan = await res.json()
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          set((s) => ({
            planVersion: savedPlan.version,
            lastSavedDraftAt: timeStr,
            dailyPlan: {
              ...s.dailyPlan,
              orderMika: savedPlan.order_mika,
              orderVakum: savedPlan.order_vakum,
              bumperMika: savedPlan.bumper_mika,
              bumperVakum: savedPlan.bumper_vakum,
              manualGilingan: savedPlan.manual_gilingan,
              manualBumbuKarung: savedPlan.manual_bumbu,
              targetKulitBal: savedPlan.target_kulit_bal,
              targetKulit9cmBal: savedPlan.target_kulit_9cm,
              targetKulit7cmBal: savedPlan.target_kulit_7cm,
              targetSaosBal: savedPlan.target_saos_bal,
              targetSaosMikaBal: savedPlan.target_saos_mika,
              targetSaosVakumBal: savedPlan.target_saos_vakum
            }
          }))
          return savedPlan
        } catch (err) {
          console.warn('[Draft AutoSave Error]:', err.message)
          throw err
        }
      },

      generateDailyLotsAll: async (payload = {}) => {
        set({ isGeneratingLotsAll: true })
        try {
          const idempKey = payload.idempotency_key || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'key-' + Date.now())
          const res = await apiFetch('/api/v1/production1/generate-daily-lots-all', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: payload.plan_id || get().activePlanId,
              idempotency_key: idempKey,
              version: get().planVersion || 1,
              reason: payload.reason || 'Rencana Harian Utama (Batch 1)',
              operator_id: payload.operator_id || get().operatorId || 'PPIC-AYU',
              operator_role: payload.operator_role || get().userRole || 'STAKEHOLDER',
              gilingan_count: payload.gilingan_count !== undefined ? Number(payload.gilingan_count) : 0,
              sack_count: payload.sack_count !== undefined ? Number(payload.sack_count) : 0,
              wrapper_bal: payload.wrapper_bal !== undefined ? Number(payload.wrapper_bal) : 0,
              sauce_bal: payload.sauce_bal !== undefined ? Number(payload.sauce_bal) : 0,
              wrapper_9cm_bal: payload.wrapper_9cm_bal !== undefined ? Number(payload.wrapper_9cm_bal) : undefined,
              wrapper_7cm_bal: payload.wrapper_7cm_bal !== undefined ? Number(payload.wrapper_7cm_bal) : undefined,
              sauce_mika_bal: payload.sauce_mika_bal !== undefined ? Number(payload.sauce_mika_bal) : undefined,
              sauce_vakum_bal: payload.sauce_vakum_bal !== undefined ? Number(payload.sauce_vakum_bal) : undefined
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            if (res.status === 409) {
              await get().fetchInitialData(true)
            }
            throw new Error(errData.detail || `Gagal menerbitkan QR (${res.status})`)
          }

          const resData = await res.json()
          playSuccessBeep()
          set({
            isGeneratingLotsAll: false,
            planStatus: 'PUBLISHED',
            actionFeedback: {
              type: 'success',
              message: resData?.message || 'Seluruh QR Batch 1 berhasil diterbitkan!'
            }
          })
          if (get().fetchInitialData) {
            await get().fetchInitialData(true)
          }
          return resData
        } catch (err) {
          playErrorBeep()
          const errMsg = err?.message || 'Gagal menerbitkan QR massal PPIC.'
          set({
            isGeneratingLotsAll: false,
            actionFeedback: {
              type: 'error',
              message: errMsg
            }
          })
          throw err
        }
      },

      generatePackagingLotsBatch: async ({ plan_id, product_type, batch_qty }) => {
        try {
          const res = await apiFetch('/api/v1/production1/generate-packaging-lots-batch', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: plan_id || get().activePlanId,
              product_type,
              batch_qty: Number(batch_qty),
              operator_id: get().operatorId || 'PPIC-AYU'
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Gagal menerbitkan batch kemasan (${res.status})`)
          }
          const createdLots = await res.json()
          playSuccessBeep()

          if (get().fetchInitialData) {
            await get().fetchInitialData(true)
          }

          return createdLots
        } catch (err) {
          playErrorBeep()
          throw err
        }
      },

      previewAdditionalBatch: async (payload = {}) => {
        const res = await apiFetch('/api/v1/production1/plans/batches/preview', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: payload.plan_id || get().activePlanId,
            add_mika_packs: payload.add_mika_packs || 0,
            add_vakum_packs: payload.add_vakum_packs || 0,
            manual_add_gilingan: payload.manual_add_gilingan !== undefined ? payload.manual_add_gilingan : null,
            manual_add_bumbu: payload.manual_add_bumbu !== undefined ? payload.manual_add_bumbu : null,
            manual_add_kulit: payload.manual_add_kulit !== undefined ? payload.manual_add_kulit : null,
            manual_add_saos: payload.manual_add_saos !== undefined ? payload.manual_add_saos : null
          })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || `Gagal menghitung selisih (${res.status})`)
        }
        return await res.json()
      },

      addProductionBatch: async (payload = {}) => {
        set({ isGeneratingLotsAll: true })
        try {
          const idempKey = payload.idempotency_key || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'key-' + Date.now())
          const res = await apiFetch('/api/v1/production1/plans/batches/add', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: payload.plan_id || get().activePlanId,
              idempotency_key: idempKey,
              reason: payload.reason || null,
              confirmed_delta_gilingan: Number(payload.confirmed_delta_gilingan || 0),
              confirmed_delta_bumbu: Number(payload.confirmed_delta_bumbu || 0),
              confirmed_delta_kulit: Number(payload.confirmed_delta_kulit || 0),
              confirmed_delta_saos: Number(payload.confirmed_delta_saos || 0),
              add_mika_packs: Number(payload.add_mika_packs || 0),
              add_vakum_packs: Number(payload.add_vakum_packs || 0)
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            if (res.status === 409) {
              await get().fetchInitialData(true)
            }
            throw new Error(errData.detail || `Gagal menambah batch (${res.status})`)
          }
          const resData = await res.json()
          playSuccessBeep()
          set({
            isGeneratingLotsAll: false,
            actionFeedback: {
              type: 'success',
              message: resData.message || `Batch ${resData.batch_no} berhasil diterbitkan!`
            }
          })
          if (get().fetchInitialData) {
            await get().fetchInitialData(true)
          }
          return resData
        } catch (err) {
          playErrorBeep()
          set({
            isGeneratingLotsAll: false,
            actionFeedback: {
              type: 'error',
              message: err.message || 'Gagal menambah batch produksi.'
            }
          })
          throw err
        }
      },

      voidBatch: async (batchNo) => {
        try {
          const planId = get().activePlanId
          const res = await apiFetch(`/api/v1/production1/plans/batches/${batchNo}/void?plan_id=${encodeURIComponent(planId)}`, {
            method: 'POST'
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            if (res.status === 409) {
              await get().fetchInitialData(true)
            }
            throw new Error(errData.detail || `Gagal membatalkan batch (${res.status})`)
          }
          const resData = await res.json()
          playSuccessBeep()
          set({
            actionFeedback: {
              type: 'success',
              message: resData.message || `Batch ${batchNo} berhasil dibatalkan.`
            }
          })
          if (get().fetchInitialData) {
            await get().fetchInitialData(true)
          }
          return resData
        } catch (err) {
          playErrorBeep()
          set({
            actionFeedback: {
              type: 'error',
              message: err.message || 'Gagal membatalkan batch.'
            }
          })
          throw err
        }
      },

      fetchSupplierInbound: async (dateStr = null, category = null, endDateStr = null, allTime = false) => {
        try {
          let url = '/api/v1/production1/supplier-inbound'
          const params = []
          if (allTime) {
            params.push('all_time=true')
          } else if (endDateStr) {
            if (dateStr) params.push(`start_date=${encodeURIComponent(dateStr)}`)
            params.push(`end_date=${encodeURIComponent(endDateStr)}`)
          } else if (dateStr) {
            params.push(`inbound_date=${encodeURIComponent(dateStr)}`)
          }
          if (category) params.push(`category=${encodeURIComponent(category)}`)
          if (params.length > 0) url += `?${params.join('&')}`

          const res = await apiFetch(url)
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const data = await res.json()
          set({ supplierInboundList: Array.isArray(data) ? data : [] })
          return data
        } catch (err) {
          console.error('Gagal mengambil data inbound supplier:', err)
          return []
        }
      },

      createSupplierInbound: async (inboundData) => {
        try {
          const res = await apiFetch('/api/v1/production1/supplier-inbound', {
            method: 'POST',
            body: JSON.stringify({
              category: inboundData.category,
              item_name: inboundData.item_name,
              quantity: parseFloat(inboundData.quantity),
              unit: inboundData.unit || 'BAL',
              supplier_name: inboundData.supplier_name,
              document_no: inboundData.document_no || null,
              notes: inboundData.notes || null,
              received_by: inboundData.received_by || get().operatorId || 'PPIC-AYU',
              has_qr: inboundData.has_qr !== undefined ? Boolean(inboundData.has_qr) : true
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const created = await res.json()
          playSuccessBeep()
          set((state) => ({
            supplierInboundList: [created, ...state.supplierInboundList],
            actionFeedback: {
              type: 'success',
              message: `Penerimaan ${created.item_name} berhasil dicatat.`
            }
          }))
          return created
        } catch (err) {
          playErrorBeep()
          const errMsg = err?.message || 'Gagal mencatat penerimaan barang supplier.'
          set({
            actionFeedback: {
              type: 'error',
              message: errMsg
            }
          })
          throw err
        }
      },

      fetchSupplierOutbound: async (dateStr = null, category = null, endDateStr = null, allTime = false) => {
        try {
          let url = '/api/v1/production1/supplier-outbound'
          const params = []
          if (allTime) {
            params.push('all_time=true')
          } else if (endDateStr) {
            if (dateStr) params.push(`start_date=${encodeURIComponent(dateStr)}`)
            params.push(`end_date=${encodeURIComponent(endDateStr)}`)
          } else if (dateStr) {
            params.push(`outbound_date=${encodeURIComponent(dateStr)}`)
          }
          if (category) params.push(`category=${encodeURIComponent(category)}`)
          if (params.length > 0) url += `?${params.join('&')}`

          const res = await apiFetch(url)
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const data = await res.json()
          set({ supplierOutboundList: Array.isArray(data) ? data : [] })
          return data
        } catch (err) {
          console.error('Gagal mengambil data outbound supplier:', err)
          return []
        }
      },

      createSupplierOutbound: async (outboundData) => {
        try {
          const res = await apiFetch('/api/v1/production1/supplier-outbound', {
            method: 'POST',
            body: JSON.stringify({
              inbound_id: outboundData.inbound_id || null,
              outbound_date: outboundData.outbound_date || null,
              category: outboundData.category,
              item_name: outboundData.item_name,
              quantity: parseFloat(outboundData.quantity),
              unit: outboundData.unit || 'BAL',
              target_station: outboundData.target_station || null,
              target_station_name: outboundData.target_station_name || null,
              lot_qr_code: outboundData.lot_qr_code || null,
              notes: outboundData.notes || null,
              dispatched_by: outboundData.dispatched_by || get().operatorName || get().operatorId || 'PPIC-AYU'
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const created = await res.json()
          playSuccessBeep()
          set((state) => ({
            supplierOutboundList: [created, ...state.supplierOutboundList],
            actionFeedback: {
              type: 'success',
              message: `Pengeluaran ${created.item_name} berhasil dicatat.`
            }
          }))
          if (outboundData.target_station && outboundData.target_station !== 'UMUM') {
            get().syncTodayFromDatabase?.()
          }
          return created
        } catch (err) {
          playErrorBeep()
          const errMsg = err?.message || 'Gagal mencatat pengeluaran barang.'
          set({
            actionFeedback: {
              type: 'error',
              message: errMsg
            }
          })
          throw err
        }
      },

      fetchDailyNotes: async (dateStr = null) => {
        try {
          let url = '/api/v1/production1/daily-notes'
          if (dateStr) url += `?record_date=${encodeURIComponent(dateStr)}`
          const res = await apiFetch(url)
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const data = await res.json()
          set({ divisionDailyNotes: Array.isArray(data) ? data : [] })
          return data
        } catch (err) {
          console.error('Gagal mengambil catatan harian divisi:', err)
          return []
        }
      },

      saveDailyNote: async (noteData) => {
        try {
          const res = await apiFetch('/api/v1/production1/daily-notes', {
            method: 'POST',
            body: JSON.stringify({
              division: noteData.division,
              reject_count: parseInt(noteData.reject_count, 10) || 0,
              reject_notes: noteData.reject_notes || null,
              operational_notes: noteData.operational_notes || null,
              created_by: noteData.created_by || get().operatorId || 'PPIC-AYU'
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const saved = await res.json()
          playSuccessBeep()
          set((state) => {
            const idx = state.divisionDailyNotes.findIndex((n) => n.division === saved.division)
            const updated = idx >= 0
              ? state.divisionDailyNotes.map((n, i) => (i === idx ? saved : n))
              : [...state.divisionDailyNotes, saved]
            return {
              divisionDailyNotes: updated,
              actionFeedback: {
                type: 'success',
                message: `Catatan divisi ${saved.division} berhasil disimpan.`
              }
            }
          })
          return saved
        } catch (err) {
          playErrorBeep()
          const errMsg = err?.message || 'Gagal menyimpan catatan harian divisi.'
          set({
            actionFeedback: {
              type: 'error',
              message: errMsg
            }
          })
          throw err
        }
      },

      fetchDailyRecap: async (dateStr = null, endDateStr = null) => {
        try {
          let url = '/api/v1/production1/daily-recap'
          const params = []
          if (endDateStr) {
            if (dateStr) params.push(`start_date=${encodeURIComponent(dateStr)}`)
            params.push(`end_date=${encodeURIComponent(endDateStr)}`)
          } else if (dateStr) {
            params.push(`recap_date=${encodeURIComponent(dateStr)}`)
          }
          if (params.length > 0) url += `?${params.join('&')}`
          const res = await apiFetch(url)
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || `Server error (${res.status})`)
          }
          const data = await res.json()
          set({ dailyRecapData: data })
          return data
        } catch (err) {
          console.error('Gagal mengambil rekapitulasi harian PPIC:', err)
          return null
        }
      }
    }),
    {
      name: 'mdi_production1_storage',
      partialize: (state) => ({
        activeStation: state.activeStation,
        activeProductionStage: state.activeProductionStage,
        activeProd2Tab: state.activeProd2Tab,
        employeeDateScope: state.employeeDateScope,
        planDetailMode: state.planDetailMode,
        meatLots: state.meatLots,
        seasoningLots: state.seasoningLots,
        doughLots: state.doughLots,
        wrapperLots: state.wrapperLots,
        sauceLots: state.sauceLots,
        finishedGoodsLots: state.finishedGoodsLots,
        catalogProducts: state.catalogProducts,
        dispatchScanMode: state.dispatchScanMode,
        custodyLogs: state.custodyLogs,
        targetGilingan: state.targetGilingan,
        dailyPlan: state.dailyPlan,
        operatorId: state.operatorId,
        operatorName: state.operatorName,
        userRole: state.userRole,
        authToken: state.authToken,
        currentUser: state.currentUser,
        isAdminActive: state.isAdminActive,
        activeAdminTab: state.activeAdminTab,
        isProfileActive: state.isProfileActive,
        isDevMode: state.isDevMode,
        salesReceiptLogs: state.salesReceiptLogs
      })
    }
  ))
