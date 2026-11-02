import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useProduction1Store, calculatePlanMetrics } from '../store/production1Store'
import { getTodayIndonesian, filterAndSortLots } from '../utils/dateFilter'
import { isPpicAyu } from '../utils/permissions'
import {
  Printer,
  Plus,
  Minus,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Boxes,
  Package,
  Scroll,
  Droplets,
  PlusCircle,
  Trash2,
  X,
  History,
  Lock,
  Loader2
} from 'lucide-react'
import { Card, CardContent } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'
import { lockBodyScroll, unlockBodyScroll } from '../utils/useLockBodyScroll'

function formatTime(isoStr) {
  if (!isoStr) return ''
  try {
    const hasZ = isoStr.endsWith('Z') || isoStr.includes('+')
    const d = new Date(hasZ ? isoStr : isoStr + 'Z')
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function ProductionPlanView() {
  const dailyPlan = useProduction1Store((s) => s.dailyPlan)
  const activePlanId = useProduction1Store((s) => s.activePlanId)
  const userRole = useProduction1Store((s) => s.userRole)
  const currentUser = useProduction1Store((s) => s.currentUser)
  const planDetailMode = useProduction1Store((s) => s.planDetailMode) || 'GENERAL'
  const doughLots = useProduction1Store((s) => s.doughLots) || []
  const seasoningLots = useProduction1Store((s) => s.seasoningLots) || []
  const wrapperLots = useProduction1Store((s) => s.wrapperLots) || []
  const sauceLots = useProduction1Store((s) => s.sauceLots) || []

  // Siklus hidup rencana dari backend
  const planStatus = useProduction1Store((s) => s.planStatus) || 'DRAFT'
  const planBatches = useProduction1Store((s) => s.planBatches) || []
  const publishedAt = useProduction1Store((s) => s.publishedAt)
  const publishedBy = useProduction1Store((s) => s.publishedBy)
  const lastSavedDraftAt = useProduction1Store((s) => s.lastSavedDraftAt)

  // Actions dari store
  const updatePlanDraft = useProduction1Store((s) => s.updatePlanDraft)
  const generateDailyLotsAll = useProduction1Store((s) => s.generateDailyLotsAll)
  const previewAdditionalBatch = useProduction1Store((s) => s.previewAdditionalBatch)
  const addProductionBatch = useProduction1Store((s) => s.addProductionBatch)
  const voidBatch = useProduction1Store((s) => s.voidBatch)
  const openBatchPrintModal = useProduction1Store((s) => s.openBatchPrintModal)

  // Segmented Control Utama: 'PLAN' (Rencana) | 'REPRINT' (Cetak Ulang)
  const [activeMainSegment, setActiveMainSegment] = useState('PLAN')
  const [validationError, setValidationError] = useState('')

  // State untuk Bottom Sheet Konfirmasi Terbitkan Batch 1
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishIdempKey, setPublishIdempKey] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  // State untuk Bottom Sheet Tambah Produksi (Batch 2+)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [addMikaPacks, setAddMikaPacks] = useState('')
  const [addVakumPacks, setAddVakumPacks] = useState('')
  const [addReasonChoice, setAddReasonChoice] = useState('Pesanan mendadak')
  const [customReason, setCustomReason] = useState('')
  const [addIdempKey, setAddIdempKey] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [batchPreviewData, setBatchPreviewData] = useState(null)
  const [isAddingBatch, setIsAddingBatch] = useState(false)

  // State untuk Konfirmasi Pembatalan Batch
  const [batchToVoid, setBatchToVoid] = useState(null)
  const [isVoiding, setIsVoiding] = useState(false)

  // State auto-save debounce
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  const autoSaveTimerRef = useRef(null)
  const triggerRef = useRef(null)

  // State untuk Segmen Cetak Ulang
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL')
  const [selectedLotCodes, setSelectedLotCodes] = useState(() => new Set())
  const [showAllRows, setShowAllRows] = useState(false)
  const [expandedRanges, setExpandedRanges] = useState(() => new Set())
  const chipContainerRef = useRef(null)

  const isDetailed = planDetailMode === 'DETAILED'
  const isPublished = planStatus === 'PUBLISHED'

  // Inisialisasi formulir rencana harian tunggal
  const getInitialForm = useCallback((plan) => {
    const orderMika = plan?.orderMika !== undefined && plan?.orderMika !== null
      ? plan.orderMika
      : ((plan?.onlineMika || 0) + (plan?.offlineMika || 0))
    const orderVakum = plan?.orderVakum !== undefined && plan?.orderVakum !== null
      ? plan.orderVakum
      : ((plan?.onlineVakum || 0) + (plan?.offlineVakum || 0))
    const bumperMika = plan?.bumperMika ?? ''
    const bumperVakum = plan?.bumperVakum ?? ''

    let gilingan = ''
    if (plan?.manualGilingan !== undefined && plan?.manualGilingan !== null && plan?.manualGilingan !== '') {
      gilingan = String(plan.manualGilingan)
    } else if (plan?.targetGilingan !== undefined && plan?.targetGilingan !== null && plan?.targetGilingan !== '') {
      gilingan = String(plan.targetGilingan)
    }

    let bumbu = ''
    if (plan?.manualBumbuKarung !== undefined && plan?.manualBumbuKarung !== null && plan?.manualBumbuKarung !== '') {
      bumbu = String(plan.manualBumbuKarung)
    } else if (plan?.targetBumbuKarung !== undefined && plan?.targetBumbuKarung !== null && plan?.targetBumbuKarung !== '') {
      bumbu = String(plan.targetBumbuKarung)
    }

    let kulit = ''
    if (plan?.targetKulitBal !== undefined && plan?.targetKulitBal !== null && plan?.targetKulitBal !== '') {
      kulit = String(plan.targetKulitBal)
    }

    let saos = ''
    if (plan?.targetSaosBal !== undefined && plan?.targetSaosBal !== null && plan?.targetSaosBal !== '') {
      saos = String(plan.targetSaosBal)
    }

    const kulit9cm = plan?.targetKulit9cmBal ? String(plan.targetKulit9cmBal) : ''
    const kulit7cm = plan?.targetKulit7cmBal ? String(plan.targetKulit7cmBal) : ''
    const saosMika = plan?.targetSaosMikaBal ? String(plan.targetSaosMikaBal) : ''
    const saosVakum = plan?.targetSaosVakumBal ? String(plan.targetSaosVakumBal) : ''

    return {
      orderMika: orderMika ? String(orderMika) : '',
      orderVakum: orderVakum ? String(orderVakum) : '',
      bumperMika: bumperMika ? String(bumperMika) : '',
      bumperVakum: bumperVakum ? String(bumperVakum) : '',
      gilingan,
      bumbu,
      kulit,
      saos,
      kulit9cm,
      kulit7cm,
      saosMika,
      saosVakum
    }
  }, [])

  const [form, setForm] = useState(() => getInitialForm(dailyPlan))
  const [prevPlanId, setPrevPlanId] = useState(activePlanId)

  // Sinkronisasi state saat ID rencana berganti (misal ganti hari)
  if (activePlanId && activePlanId !== prevPlanId) {
    setPrevPlanId(activePlanId)
    setForm(getInitialForm(dailyPlan))
  }

  // Hitung metrik rencana produksi
  const metrics = calculatePlanMetrics({
    ...form,
    manualGilingan: form.gilingan,
    manualBumbuKarung: form.bumbu
  })
  const todayStr = getTodayIndonesian()

  // Nilai aktif kuantitas bahan yang direncanakan PPIC
  const plannedGilingan = parseInt(form.gilingan, 10) || 0
  const plannedKarung = parseInt(form.bumbu, 10) || 0

  const plannedKulit9cm = parseInt(form.kulit9cm, 10) || 0
  const plannedKulit7cm = parseInt(form.kulit7cm, 10) || 0
  const plannedKulit = isDetailed
    ? (plannedKulit9cm + plannedKulit7cm)
    : (parseInt(form.kulit, 10) || 0)

  const plannedSaosMika = parseInt(form.saosMika, 10) || 0
  const plannedSaosVakum = parseInt(form.saosVakum, 10) || 0
  const plannedSaos = isDetailed
    ? (plannedSaosMika + plannedSaosVakum)
    : (parseInt(form.saos, 10) || 0)

  // Total QR yang akan diterbitkan pada batch berikutnya
  const totalLotsToIssue = plannedGilingan + plannedKarung + plannedKulit + plannedSaos

  // Hak akses (Hanya PPIC Ayu / Supervisor yang berwenang mengubah dan menerbitkan)
  const isAyuOrSupervisor = isPpicAyu(currentUser)
  const isAuthorized = isAyuOrSupervisor || userRole === 'STAKEHOLDER'
  // Jika sudah DITERBITKAN, input rencana terkunci secara permanen (hanya bisa tambah batch)
  const isInputDisabled = !isAuthorized || isPublished

  // Trigger Debounced Auto-Save jika status masih DRAFT
  useEffect(() => {
    if (isPublished || !isAuthorized) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setIsDraftSaving(true)
      try {
        await updatePlanDraft({
          orderMika: form.orderMika,
          orderVakum: form.orderVakum,
          bumperMika: form.bumperMika,
          bumperVakum: form.bumperVakum,
          manualGilingan: form.gilingan,
          manualBumbuKarung: form.bumbu
        })
        setValidationError('')
      } catch (err) {
        setValidationError(err.message || 'Gagal menyimpan draft.')
      } finally {
        setIsDraftSaving(false)
      }
    }, 800)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [form, isPublished, isAuthorized, updatePlanDraft])

  // Handler pengubahan input teks numerik
  const handleChange = (field, val) => {
    if (isInputDisabled) return
    const clean = val.replace(/[^0-9]/g, '')
    setValidationError('')
    setForm((prev) => ({ ...prev, [field]: clean }))
  }

  // Handler stepper + / - untuk layar sentuh
  const handleStep = (field, delta) => {
    if (isInputDisabled) return
    setValidationError('')
    setForm((prev) => {
      const current = parseInt(prev[field], 10) || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [field]: next > 0 ? String(next) : '' }
    })
  }

  // Buka Sheet Konfirmasi Penerbitan Batch 1
  const handleOpenPublishConfirm = (e) => {
    triggerRef.current = e?.currentTarget || null
    if (totalLotsToIssue === 0) {
      setValidationError('Tentukan minimal 1 kuantitas bahan untuk diterbitkan.')
      return
    }
    setValidationError('')
    // Idempotency key per percobaan, jangan di-reset jika retry jaringan
    if (!publishIdempKey) {
      const newKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'key-' + Date.now()
      setPublishIdempKey(newKey)
    }
    setShowPublishModal(true)
  }

  // Eksekusi Terbitkan Batch 1
  const handleExecutePublish = async () => {
    setIsPublishing(true)
    setValidationError('')
    try {
      const res = await generateDailyLotsAll({
        plan_id: activePlanId,
        idempotency_key: publishIdempKey,
        gilingan_count: plannedGilingan,
        sack_count: plannedKarung,
        wrapper_bal: plannedKulit,
        sauce_bal: plannedSaos,
        wrapper_9cm_bal: isDetailed ? plannedKulit9cm : undefined,
        wrapper_7cm_bal: isDetailed ? plannedKulit7cm : undefined,
        sauce_mika_bal: isDetailed ? plannedSaosMika : undefined,
        sauce_vakum_bal: isDetailed ? plannedSaosVakum : undefined
      })

      setShowPublishModal(false)
      setPublishIdempKey('')

      if (res?.lots && res.lots.length > 0) {
        const printList = res.lots.map((l) => ({
          lotCode: l.lot_qr_code,
          title: l.lot_type === 'KULIT_7CM'
            ? 'KULIT 7CM (VAKUM)'
            : l.lot_type?.startsWith('KULIT')
              ? 'KULIT 9CM (MIKA)'
              : l.lot_type === 'BUMBU'
                ? 'KARUNG BUMBU SPARTA'
                : (l.lot_type === 'SAOS_VAKUM' || l.lot_type === 'SAOS_MINI')
                  ? 'SAOS VAKUM'
                  : l.lot_type?.startsWith('SAOS')
                    ? 'SAOS MIKA'
                    : 'WADAH ADONAN (GILING & MIX)',
          detail: `${l.lot_type} - ${l.quantity} ${l.unit}`,
          weight: `${l.quantity} ${l.unit}`
        }))
        openBatchPrintModal(printList, 'QR PRODUKSI HARIAN (BATCH 1)')
      }
    } catch (err) {
      setValidationError(err?.message || 'Gagal menerbitkan QR ke server.')
    } finally {
      setIsPublishing(false)
    }
  }

  // Buka Sheet Tambah Produksi (Batch 2+)
  const handleOpenAddBatchModal = (e) => {
    triggerRef.current = e?.currentTarget || null
    setValidationError('')
    setAddMikaPacks('')
    setAddVakumPacks('')
    setAddReasonChoice('Pesanan mendadak')
    setCustomReason('')
    setBatchPreviewData(null)
    const newKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'add-key-' + Date.now()
    setAddIdempKey(newKey)
    setShowAddBatchModal(true)
  }

  // Kalkulasi Delta Pratinjau Tambah Produksi
  useEffect(() => {
    if (!showAddBatchModal) return

    const mika = parseInt(addMikaPacks, 10) || 0
    const vakum = parseInt(addVakumPacks, 10) || 0

    if (mika === 0 && vakum === 0) {
      setBatchPreviewData(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsPreviewLoading(true)
      try {
        const preview = await previewAdditionalBatch({
          plan_id: activePlanId,
          add_mika_packs: mika,
          add_vakum_packs: vakum
        })
        setBatchPreviewData(preview)
      } catch (err) {
        console.warn('Preview error:', err)
      } finally {
        setIsPreviewLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [addMikaPacks, addVakumPacks, showAddBatchModal, activePlanId, previewAdditionalBatch])

  // Eksekusi Terbitkan Tambahan Batch Baru
  const handleExecuteAddBatch = async () => {
    if (!batchPreviewData || batchPreviewData.delta?.total === 0) {
      setValidationError('Tambahan ini tidak menghasilkan kebutuhan QR baru.')
      return
    }

    setIsAddingBatch(true)
    setValidationError('')
    const reasonText = addReasonChoice === 'Lainnya' ? (customReason || 'Tambahan Produksi') : addReasonChoice

    try {
      const res = await addProductionBatch({
        plan_id: activePlanId,
        idempotency_key: addIdempKey,
        reason: reasonText,
        confirmed_delta_gilingan: batchPreviewData.delta.adonan,
        confirmed_delta_bumbu: batchPreviewData.delta.bumbu,
        confirmed_delta_kulit: batchPreviewData.delta.kulit,
        confirmed_delta_saos: batchPreviewData.delta.saos,
        add_mika_packs: parseInt(addMikaPacks, 10) || 0,
        add_vakum_packs: parseInt(addVakumPacks, 10) || 0
      })

      setShowAddBatchModal(false)
      setAddIdempKey('')

      if (res?.lots && res.lots.length > 0) {
        const printList = res.lots.map((l) => ({
          lotCode: l.lot_qr_code,
          title: l.lot_type?.startsWith('KULIT') ? 'BAL KULIT DIMSUM' : l.lot_type === 'BUMBU' ? 'KARUNG BUMBU SPARTA' : l.lot_type?.startsWith('SAOS') ? 'BAL SAOS' : 'WADAH ADONAN',
          detail: `${l.lot_type} - ${l.quantity} ${l.unit}`,
          weight: `${l.quantity} ${l.unit}`
        }))
        openBatchPrintModal(printList, `QR PRODUKSI TAMBAHAN (BATCH ${res.batch_no})`)
      }
    } catch (err) {
      setValidationError(err?.message || 'Gagal menerbitkan batch tambahan.')
    } finally {
      setIsAddingBatch(false)
    }
  }

  // Eksekusi Batalkan Batch
  const handleExecuteVoidBatch = async () => {
    if (!batchToVoid) return
    setIsVoiding(true)
    try {
      await voidBatch(batchToVoid.batch_no)
      setBatchToVoid(null)
    } catch (err) {
      setValidationError(err.message || 'Gagal membatalkan batch.')
      setBatchToVoid(null)
    } finally {
      setIsVoiding(false)
    }
  }

  // Daftar seluruh lot yang sudah diterbitkan hari ini dibagi per 4 kategori pilar bahan
  const todayDoughLots = filterAndSortLots(doughLots, 'TODAY', 'OPERATOR')
  const todaySeasoningLots = filterAndSortLots(seasoningLots, 'TODAY', 'OPERATOR')
  const todayWrapperLots = filterAndSortLots(wrapperLots, 'TODAY', 'OPERATOR')
  const todaySauceLots = filterAndSortLots(sauceLots, 'TODAY', 'OPERATOR')

  // Struktur data lot cetak ulang
  const allReprintLots = useMemo(() => {
    const list = []

    todayDoughLots.forEach((l) => {
      list.push({
        lotCode: l.lotCode || l.lot_qr_code,
        category: 'DAGING',
        title: 'Wadah Adonan',
        detail: `${l.quantity || 20} kg adonan`,
        weight: `${l.quantity || 20} kg`
      })
    })

    todayWrapperLots.forEach((l) => {
      const is7cm = l.type === 'KULIT_7CM' || l.lot_type === 'KULIT_7CM'
      list.push({
        lotCode: l.lotCode || l.lot_qr_code,
        category: 'KULIT',
        title: is7cm ? 'Bal Kulit 7cm' : 'Bal Kulit 9cm',
        detail: `${l.balQty || 1} Bal kulit (${is7cm ? '7 cm' : '9 cm'})`,
        weight: `${(l.balQty || 1) * 15} kg`
      })
    })

    todaySeasoningLots.forEach((l) => {
      list.push({
        lotCode: l.lotCode || l.lot_qr_code,
        category: 'BUMBU',
        title: 'Karung Bumbu',
        detail: 'Bumbu racik 20 gilingan',
        weight: '1 Karung'
      })
    })

    todaySauceLots.forEach((l) => {
      const isVakum = l.type === 'MINI' || l.lot_type === 'SAOS_VAKUM' || l.lot_type === 'SAOS_MINI'
      list.push({
        lotCode: l.lotCode || l.lot_qr_code,
        category: 'SAOS',
        title: isVakum ? 'Bal Saos Vakum' : 'Bal Saos Mika',
        detail: `${l.balQty || 1} Bal saos (${isVakum ? '200 sachet' : '50 pouch'})`,
        weight: '1 Bal kemasan'
      })
    })

    return list
  }, [todayDoughLots, todayWrapperLots, todaySeasoningLots, todaySauceLots])

  const totalIssuedCount = allReprintLots.length

  // Filter daftar lot cetak ulang berdasarkan chip kategori yang aktif
  const filteredReprintLots = useMemo(() => {
    if (activeCategoryTab === 'ALL') return allReprintLots
    return allReprintLots.filter((item) => item.category === activeCategoryTab)
  }, [allReprintLots, activeCategoryTab])

  // Pengelompokan baris lot identik berurutan
  const groupedReprintRanges = useMemo(() => {
    const groups = []
    for (const lot of filteredReprintLots) {
      const lastGroup = groups[groups.length - 1]
      if (
        lastGroup &&
        lastGroup.category === lot.category &&
        lastGroup.title === lot.title &&
        lastGroup.detail === lot.detail
      ) {
        lastGroup.lots.push(lot)
      } else {
        groups.push({
          key: lot.lotCode,
          category: lot.category,
          title: lot.title,
          detail: lot.detail,
          lots: [lot]
        })
      }
    }
    return groups
  }, [filteredReprintLots])

  const visibleReprintRanges = showAllRows
    ? groupedReprintRanges
    : groupedReprintRanges.slice(0, 5)

  const hasMoreRows = groupedReprintRanges.length > 5
  const remainingRowsCount = groupedReprintRanges.length - 5

  const isAllFilteredSelected =
    filteredReprintLots.length > 0 &&
    filteredReprintLots.every((l) => selectedLotCodes.has(l.lotCode))

  const toggleSelectAllFiltered = () => {
    setSelectedLotCodes((prev) => {
      const next = new Set(prev)
      if (isAllFilteredSelected) {
        filteredReprintLots.forEach((l) => next.delete(l.lotCode))
      } else {
        filteredReprintLots.forEach((l) => next.add(l.lotCode))
      }
      return next
    })
  }

  const toggleSelectLot = (code) => {
    setSelectedLotCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const toggleSelectRange = (rangeLots) => {
    const isAllRangeSelected = rangeLots.every((l) => selectedLotCodes.has(l.lotCode))
    setSelectedLotCodes((prev) => {
      const next = new Set(prev)
      if (isAllRangeSelected) {
        rangeLots.forEach((l) => next.delete(l.lotCode))
      } else {
        rangeLots.forEach((l) => next.add(l.lotCode))
      }
      return next
    })
  }

  const toggleExpandRange = (groupKey) => {
    setExpandedRanges((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const handlePrintSelected = () => {
    const selectedLots = allReprintLots.filter((l) => selectedLotCodes.has(l.lotCode))
    if (selectedLots.length > 0) {
      openBatchPrintModal(selectedLots, 'CETAK ULANG QR')
    }
  }

  const filterChips = [
    { id: 'ALL', label: 'Semua' },
    { id: 'DAGING', label: 'Daging' },
    { id: 'KULIT', label: 'Kulit' },
    { id: 'BUMBU', label: 'Bumbu' },
    { id: 'SAOS', label: 'Saos' }
  ]

  const handleChipKeyDown = (e, index) => {
    let nextIndex = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (index + 1) % filterChips.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (index - 1 + filterChips.length) % filterChips.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = filterChips.length - 1
    }

    if (nextIndex >= 0 && filterChips[nextIndex]) {
      setActiveCategoryTab(filterChips[nextIndex].id)
      const buttons = chipContainerRef.current?.querySelectorAll('button[role="tab"]')
      buttons?.[nextIndex]?.focus()
    }
  }

  // Accessibility dialog handler for bottom sheets
  useEffect(() => {
    const isAnyModalOpen = showPublishModal || showAddBatchModal || Boolean(batchToVoid)
    if (!isAnyModalOpen) return

    lockBodyScroll()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showPublishModal && !isPublishing) setShowPublishModal(false)
        if (showAddBatchModal && !isAddingBatch) setShowAddBatchModal(false)
        if (batchToVoid && !isVoiding) setBatchToVoid(null)
        if (triggerRef.current) {
          triggerRef.current.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      unlockBodyScroll()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showPublishModal, showAddBatchModal, batchToVoid, isPublishing, isAddingBatch, isVoiding])

  return (
    <div className="space-y-3 pb-24 max-w-2xl mx-auto select-none">
      {/* 1. Segmented Control Utama di Bagian Atas Konten */}
      <SegmentedControl
        value={activeMainSegment}
        onChange={(val) => {
          setActiveMainSegment(val)
          setValidationError('')
        }}
        options={[
          { value: 'PLAN', label: 'Rencana' },
          {
            value: 'REPRINT',
            label: totalIssuedCount > 0 ? `Cetak Ulang (${totalIssuedCount})` : 'Cetak Ulang'
          }
        ]}
      />

      {/* ========================================================================= */}
      {/* SEGMEN 1: RENCANA PRODUKSI (Satu Card Utama dengan 3 Langkah Bernomor)    */}
      {/* ========================================================================= */}
      {activeMainSegment === 'PLAN' && (
        <Card className="border-[#EDE8DF] bg-white shadow-2xs">
          <CardContent className="p-4 space-y-4">
            {/* Header Rencana & Banner Status Publikasi */}
            <div className="border-b border-[#EDE8DF] pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                    Rencana Produksi & Kebutuhan QR
                  </h1>
                  <p className="text-[11px] text-[#556575] mt-0.5">
                    Tanggal: {todayStr}
                  </p>
                </div>

                {/* Indikator Status & AutoSave */}
                <div className="flex items-center gap-1.5">
                  {isPublished ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EEF5F9] text-[#3A6B80] border border-[#D1E4EF]">
                      <Lock className="w-3 h-3 text-[#3A6B80]" />
                      <span>Terkunci</span>
                    </span>
                  ) : isDraftSaving ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#556575]">
                      <Loader2 className="w-3 h-3 animate-spin text-[#3A6B80]" />
                      <span>Menyimpan...</span>
                    </span>
                  ) : lastSavedDraftAt ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#2F7D5B] font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersimpan {lastSavedDraftAt}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Banner Rencana Diterbitkan */}
              {isPublished && (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-3 bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#3A6B80] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[#2C3E50] block truncate">
                        {totalIssuedCount} QR Diterbitkan
                      </span>
                      <span className="text-[11px] text-[#556575] block truncate">
                        Pukul {formatTime(publishedAt) || 'Hari Ini'} oleh {publishedBy || 'PPIC Ayu'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#3A6B80] border border-[#D1E4EF] shrink-0">
                    {planBatches.length || 1} Batch
                  </span>
                </div>
              )}
            </div>

            {/* ① LANGKAH 1: Target Pesanan (Tabel Mika/Vakum Ringkas) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3A6B80] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <h2 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Target Pesanan
                </h2>
              </div>

              <div className="border border-[#EDE8DF] rounded-xl overflow-hidden bg-white shadow-2xs">
                {/* Header Tabel */}
                <div className="grid grid-cols-12 bg-[#F5F1EB] text-[11px] font-bold text-[#2C3E50] p-2 border-b border-[#EDE8DF] text-center">
                  <span className="col-span-6 text-left pl-1">Kategori</span>
                  <span className="col-span-3">Mika (50 pcs)</span>
                  <span className="col-span-3">Vakum (25 pcs)</span>
                </div>

                {/* Baris 1: Pesanan Pembeli */}
                <div className="grid grid-cols-12 items-center p-2 border-b border-[#EDE8DF] gap-2 bg-white">
                  <div className="col-span-6 pl-1">
                    <span className="text-xs font-bold text-[#2C3E50] block leading-tight">
                      Pesanan Pembeli
                    </span>
                    <span className="text-[11px] text-[#556575]">Online & Offline</span>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Pesanan pembeli, Mika"
                      disabled={isInputDisabled}
                      value={form.orderMika}
                      placeholder="0"
                      onChange={(e) => handleChange('orderMika', e.target.value)}
                      className={`w-full h-10 px-2 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                        isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed opacity-80' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                      }`}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Pesanan pembeli, Vakum"
                      disabled={isInputDisabled}
                      value={form.orderVakum}
                      placeholder="0"
                      onChange={(e) => handleChange('orderVakum', e.target.value)}
                      className={`w-full h-10 px-2 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                        isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed opacity-80' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                      }`}
                    />
                  </div>
                </div>

                {/* Baris 2: Cadangan Freezer */}
                <div className="grid grid-cols-12 items-center p-2 border-b border-[#EDE8DF] gap-2 bg-white">
                  <div className="col-span-6 pl-1">
                    <span className="text-xs font-bold text-[#2C3E50] block leading-tight">
                      Cadangan Freezer
                    </span>
                    <span className="text-[11px] text-[#556575]">Stok pengaman gudang</span>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Cadangan freezer, Mika"
                      disabled={isInputDisabled}
                      value={form.bumperMika}
                      placeholder="0"
                      onChange={(e) => handleChange('bumperMika', e.target.value)}
                      className={`w-full h-10 px-2 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                        isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed opacity-80' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                      }`}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Cadangan freezer, Vakum"
                      disabled={isInputDisabled}
                      value={form.bumperVakum}
                      placeholder="0"
                      onChange={(e) => handleChange('bumperVakum', e.target.value)}
                      className={`w-full h-10 px-2 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                        isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed opacity-80' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                      }`}
                    />
                  </div>
                </div>

                {/* Baris 3: Total Target */}
                <div className="grid grid-cols-12 items-center p-2 bg-[#F5F1EB] text-center font-bold text-xs text-[#2C3E50]">
                  <span className="col-span-6 text-left pl-1">Total Target</span>
                  <span className="col-span-3 tabular-nums text-[#2C3E50]">
                    {metrics.totalMika} pack
                  </span>
                  <span className="col-span-3 tabular-nums text-[#2C3E50]">
                    {metrics.totalVakum} pack
                  </span>
                </div>
              </div>
            </div>

            {/* ② LANGKAH 2: Kebutuhan QR (4 Baris Ringkas ±64px dengan Formula Singkat) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3A6B80] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h2 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Kebutuhan QR
                </h2>
              </div>

              <div className="space-y-2">
                {/* 1. Wadah Adonan */}
                <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#3A6B80] shrink-0">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span id="label-adonan" className="text-xs font-bold text-[#2C3E50] block truncate">
                        Wadah Adonan
                      </span>
                      <span className="text-[11px] text-[#556575] block truncate">
                        1 wadah per 5 pack (19 kg)
                      </span>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-labelledby="label-adonan"
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    {!isPublished && (
                      <button
                        type="button"
                        aria-label="Kurangi Wadah Adonan"
                        disabled={isInputDisabled}
                        onClick={() => handleStep('gilingan', -1)}
                        className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="relative w-16">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label="Jumlah Wadah Adonan"
                        disabled={isInputDisabled}
                        value={form.gilingan}
                        placeholder="0"
                        onChange={(e) => handleChange('gilingan', e.target.value)}
                        className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                          isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                        }`}
                      />
                      <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                        wdh
                      </span>
                    </div>
                    {!isPublished && (
                      <button
                        type="button"
                        aria-label="Tambah Wadah Adonan"
                        disabled={isInputDisabled}
                        onClick={() => handleStep('gilingan', 1)}
                        className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Karung Bumbu */}
                <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#C9A23D] shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span id="label-bumbu" className="text-xs font-bold text-[#2C3E50] block truncate">
                        Karung Bumbu
                      </span>
                      <span className="text-[11px] text-[#556575] block truncate">
                        1 karung per 20 wadah adonan
                      </span>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-labelledby="label-bumbu"
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    {!isPublished && (
                      <button
                        type="button"
                        aria-label="Kurangi Karung Bumbu"
                        disabled={isInputDisabled}
                        onClick={() => handleStep('bumbu', -1)}
                        className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="relative w-16">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label="Jumlah Karung Bumbu"
                        disabled={isInputDisabled}
                        value={form.bumbu}
                        placeholder="0"
                        onChange={(e) => handleChange('bumbu', e.target.value)}
                        className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                          isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                        }`}
                      />
                      <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                        krg
                      </span>
                    </div>
                    {!isPublished && (
                      <button
                        type="button"
                        aria-label="Tambah Karung Bumbu"
                        disabled={isInputDisabled}
                        onClick={() => handleStep('bumbu', 1)}
                        className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Bal Kulit */}
                {!isDetailed ? (
                  <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#3A6B80] shrink-0">
                        <Scroll className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span id="label-kulit" className="text-xs font-bold text-[#2C3E50] block truncate">
                          Bal Kulit
                        </span>
                        <span className="text-[11px] text-[#556575] block truncate">
                          1 bal per 10 wadah adonan
                        </span>
                      </div>
                    </div>

                    <div
                      role="group"
                      aria-labelledby="label-kulit"
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      {!isPublished && (
                        <button
                          type="button"
                          aria-label="Kurangi Bal Kulit"
                          disabled={isInputDisabled}
                          onClick={() => handleStep('kulit', -1)}
                          className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="relative w-16">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="Jumlah Bal Kulit"
                          disabled={isInputDisabled}
                          value={form.kulit}
                          placeholder="0"
                          onChange={(e) => handleChange('kulit', e.target.value)}
                          className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                            isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                          }`}
                        />
                        <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                          bal
                        </span>
                      </div>
                      {!isPublished && (
                        <button
                          type="button"
                          aria-label="Tambah Bal Kulit"
                          disabled={isInputDisabled}
                          onClick={() => handleStep('kulit', 1)}
                          className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#3A6B80] shrink-0">
                          <Scroll className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span id="label-kulit9" className="text-xs font-bold text-[#2C3E50] block truncate">
                            Bal Kulit 9cm
                          </span>
                          <span className="text-[11px] text-[#556575] block truncate">
                            Khusus kemasan Mika (50 pcs)
                          </span>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-labelledby="label-kulit9"
                        className="flex items-center gap-1.5 shrink-0"
                      >
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Kurangi Bal Kulit 9cm"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('kulit9cm', -1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="relative w-16">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label="Jumlah Bal Kulit 9cm"
                            disabled={isInputDisabled}
                            value={form.kulit9cm}
                            placeholder="0"
                            onChange={(e) => handleChange('kulit9cm', e.target.value)}
                            className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                              isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                            }`}
                          />
                          <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                            bal
                          </span>
                        </div>
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Tambah Bal Kulit 9cm"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('kulit9cm', 1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#3A6B80] shrink-0">
                          <Scroll className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span id="label-kulit7" className="text-xs font-bold text-[#2C3E50] block truncate">
                            Bal Kulit 7cm
                          </span>
                          <span className="text-[11px] text-[#556575] block truncate">
                            Khusus kemasan Vakum (25 pcs)
                          </span>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-labelledby="label-kulit7"
                        className="flex items-center gap-1.5 shrink-0"
                      >
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Kurangi Bal Kulit 7cm"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('kulit7cm', -1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="relative w-16">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label="Jumlah Bal Kulit 7cm"
                            disabled={isInputDisabled}
                            value={form.kulit7cm}
                            placeholder="0"
                            onChange={(e) => handleChange('kulit7cm', e.target.value)}
                            className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                              isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                            }`}
                          />
                          <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                            bal
                          </span>
                        </div>
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Tambah Bal Kulit 7cm"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('kulit7cm', 1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* 4. Bal Saos */}
                {!isDetailed ? (
                  <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#E8352D] shrink-0">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span id="label-saos" className="text-xs font-bold text-[#2C3E50] block truncate">
                          Bal Saos
                        </span>
                        <span className="text-[11px] text-[#556575] block truncate">
                          1 bal per 20 pack kemasan
                        </span>
                      </div>
                    </div>

                    <div
                      role="group"
                      aria-labelledby="label-saos"
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      {!isPublished && (
                        <button
                          type="button"
                          aria-label="Kurangi Bal Saos"
                          disabled={isInputDisabled}
                          onClick={() => handleStep('saos', -1)}
                          className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="relative w-16">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="Jumlah Bal Saos"
                          disabled={isInputDisabled}
                          value={form.saos}
                          placeholder="0"
                          onChange={(e) => handleChange('saos', e.target.value)}
                          className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                            isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                          }`}
                        />
                        <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                          bal
                        </span>
                      </div>
                      {!isPublished && (
                        <button
                          type="button"
                          aria-label="Tambah Bal Saos"
                          disabled={isInputDisabled}
                          onClick={() => handleStep('saos', 1)}
                          className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#E8352D] shrink-0">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span id="label-saosmika" className="text-xs font-bold text-[#2C3E50] block truncate">
                            Bal Saos Mika
                          </span>
                          <span className="text-[11px] text-[#556575] block truncate">
                            50 pouch per bal
                          </span>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-labelledby="label-saosmika"
                        className="flex items-center gap-1.5 shrink-0"
                      >
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Kurangi Bal Saos Mika"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('saosMika', -1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="relative w-16">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label="Jumlah Bal Saos Mika"
                            disabled={isInputDisabled}
                            value={form.saosMika}
                            placeholder="0"
                            onChange={(e) => handleChange('saosMika', e.target.value)}
                            className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                              isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                            }`}
                          />
                          <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                            bal
                          </span>
                        </div>
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Tambah Bal Saos Mika"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('saosMika', 1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="min-h-[64px] p-2.5 bg-[#F5F1EB]/70 border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-[#EDE8DF] flex items-center justify-center text-[#E8352D] shrink-0">
                          <Droplets className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span id="label-saosvakum" className="text-xs font-bold text-[#2C3E50] block truncate">
                            Bal Saos Vakum
                          </span>
                          <span className="text-[11px] text-[#556575] block truncate">
                            200 sachet per bal
                          </span>
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-labelledby="label-saosvakum"
                        className="flex items-center gap-1.5 shrink-0"
                      >
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Kurangi Bal Saos Vakum"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('saosVakum', -1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="relative w-16">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label="Jumlah Bal Saos Vakum"
                            disabled={isInputDisabled}
                            value={form.saosVakum}
                            placeholder="0"
                            onChange={(e) => handleChange('saosVakum', e.target.value)}
                            className={`w-full h-10 pl-2 pr-6 border rounded-lg text-xs tabular-nums font-bold text-[#2C3E50] text-center focus-visible:outline-none transition shadow-2xs ${
                              isInputDisabled ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] cursor-not-allowed' : 'bg-white border-[#EDE8DF] focus-visible:border-[#3A6B80]'
                            }`}
                          />
                          <span className="absolute right-1.5 top-2.5 text-[10px] font-semibold text-[#556575] pointer-events-none select-none">
                            bal
                          </span>
                        </div>
                        {!isPublished && (
                          <button
                            type="button"
                            aria-label="Tambah Bal Saos Vakum"
                            disabled={isInputDisabled}
                            onClick={() => handleStep('saosVakum', 1)}
                            className="w-10 h-10 bg-white hover:bg-[#F5F1EB] active:scale-95 border border-[#EDE8DF] rounded-lg flex items-center justify-center text-[#2C3E50] disabled:opacity-40 transition cursor-pointer focus-visible:outline-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ③ LANGKAH 3: Ringkasan Hasil (Tampil Sekali, Tanpa Duplikasi) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#3A6B80] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <h2 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Ringkasan Kebutuhan
                </h2>
              </div>

              <div className="p-3.5 bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-[#2C3E50] block">
                    Total QR Produksi
                  </span>
                  <span className="text-[11px] text-[#556575]">
                    {isPublished ? 'Rencana terkunci (Batch 1 terbit)' : 'Siap diterbitkan ke stasiun kerja'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-[#3A6B80] tabular-nums block leading-tight">
                    {totalLotsToIssue} QR
                  </span>
                </div>
              </div>
            </div>

            {/* DAFTAR BATCH PENERBITAN (Jika sudah ada batch terbit) */}
            {isPublished && planBatches.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-[#EDE8DF]">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#3A6B80]" />
                  <h2 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                    Riwayat Batch Produksi
                  </h2>
                </div>

                <div className="space-y-2">
                  {planBatches.map((batch) => {
                    const isVoid = batch.status === 'VOID'
                    const counts = batch.counts || {}
                    const batchTotal = counts.total || (counts.adonan || 0) + (counts.bumbu || 0) + (counts.kulit || 0) + (counts.saos || 0)

                    return (
                      <div
                        key={batch.batch_no}
                        className={`p-3 rounded-xl border transition-all ${
                          isVoid
                            ? 'bg-[#F5F1EB]/50 border-[#EDE8DF] opacity-60'
                            : 'bg-white border-[#EDE8DF] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isVoid ? 'line-through text-[#556575]' : 'text-[#2C3E50]'}`}>
                                Batch {batch.batch_no}
                              </span>
                              {isVoid ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FDEDEC] text-[#9F2F2D] border border-[#FADBD8]">
                                  DIBATALKAN
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EEF5F9] text-[#3A6B80] border border-[#D1E4EF]">
                                  {batchTotal} QR
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#556575] mt-0.5">
                              Pukul {formatTime(batch.created_at)} · {batch.created_by || 'PPIC'}
                              {batch.reason ? ` · ${batch.reason}` : ''}
                            </p>
                          </div>

                          {/* Aksi Batalkan Batch */}
                          {!isVoid && isAuthorized && (
                            <div>
                              {batch.is_voidable ? (
                                <button
                                  type="button"
                                  onClick={() => setBatchToVoid(batch)}
                                  className="min-h-[44px] px-3 py-1 text-xs font-semibold text-[#E8352D] hover:bg-[#FDEDEC] rounded-lg transition cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Batalkan</span>
                                </button>
                              ) : (
                                <div className="text-right">
                                  <span
                                    title={batch.non_voidable_reason || 'Sudah di-scan'}
                                    className="text-[10px] font-medium text-[#556575] bg-[#F5F1EB] px-2 py-1 rounded border border-[#EDE8DF]"
                                  >
                                    Sudah di-scan
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Breakdown per Tipe QR */}
                        {!isVoid && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-[#EDE8DF]/70 text-[11px] text-[#556575]">
                            {counts.adonan > 0 && <span className="px-1.5 py-0.5 rounded bg-[#F5F1EB] border border-[#EDE8DF]">{counts.adonan} Adonan</span>}
                            {counts.bumbu > 0 && <span className="px-1.5 py-0.5 rounded bg-[#F5F1EB] border border-[#EDE8DF]">{counts.bumbu} Bumbu</span>}
                            {counts.kulit > 0 && <span className="px-1.5 py-0.5 rounded bg-[#F5F1EB] border border-[#EDE8DF]">{counts.kulit} Kulit</span>}
                            {counts.saos > 0 && <span className="px-1.5 py-0.5 rounded bg-[#F5F1EB] border border-[#EDE8DF]">{counts.saos} Saos</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sticky Action Bar tepat di atas bottom nav */}
            {isAuthorized ? (
              <div className="sticky bottom-16 left-0 right-0 z-20 bg-white/95 backdrop-blur-xs border-t border-[#EDE8DF] p-3 -mx-4 -mb-4 mt-6 shadow-[0_-4px_16px_rgba(44,62,80,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
                {validationError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-center gap-2 p-2.5 bg-[#FDEDEC] border border-[#FADBD8] rounded-xl text-[#9F2F2D] text-xs font-semibold"
                  >
                    <AlertCircle className="w-4 h-4 text-[#E8352D] shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Tombol Utama: DRAFT -> "Terbitkan n QR" | PUBLISHED -> "Tambah Produksi" */}
                {!isPublished ? (
                  <button
                    type="button"
                    disabled={totalLotsToIssue === 0}
                    onClick={handleOpenPublishConfirm}
                    className="w-full min-h-[48px] h-12 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Terbitkan {totalLotsToIssue} QR</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenAddBatchModal}
                    className="w-full min-h-[48px] h-12 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:outline-none"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    <span>Tambah Produksi (Batch Baru)</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#F5F1EB] border border-[#EDE8DF] rounded-xl p-3 text-center text-xs text-[#556575] font-medium">
                Mode baca. Hubungi PPIC (Ayu) untuk mengubah target dan menerbitkan QR.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SEGMEN 2: CETAK ULANG QR (Satu Daftar Tunggal & Chip Filter)               */}
      {/* ========================================================================= */}
      {activeMainSegment === 'REPRINT' && (
        <Card className="border-[#EDE8DF] bg-white shadow-2xs">
          <CardContent className="p-4 space-y-3.5">
            {/* Header Daftar Tunggal Cetak Ulang */}
            <div className="border-b border-[#EDE8DF] pb-2.5">
              <h1 className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                Cetak Ulang QR Hari Ini
              </h1>
              <p className="text-[11px] text-[#556575] mt-0.5">
                Pilih QR yang perlu dicetak ulang untuk operasional dapur
              </p>
            </div>

            {totalIssuedCount === 0 ? (
              <div className="p-6 bg-[#F5F1EB]/50 border border-[#EDE8DF] rounded-xl text-center text-xs text-[#556575] space-y-2">
                <p className="font-semibold text-[#2C3E50]">Belum ada QR yang diterbitkan hari ini.</p>
                <p>Silakan buat rencana dan terbitkan QR di tab Rencana terlebih dahulu.</p>
                <button
                  type="button"
                  onClick={() => setActiveMainSegment('PLAN')}
                  className="mt-2 min-h-[44px] px-4 py-2 bg-[#4685ac] hover:bg-[#3A6B80] text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-2xs"
                >
                  Buka Tab Rencana
                </button>
              </div>
            ) : (
              <>
                {/* Chip Filter Kategori (Semua, Daging, Kulit, Bumbu, Saos) */}
                <div className="relative">
                  <div
                    ref={chipContainerRef}
                    role="tablist"
                    aria-label="Filter kategori cetak ulang"
                    className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5"
                  >
                    {filterChips.map((chip, idx) => {
                      const isActive = activeCategoryTab === chip.id
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => {
                            setActiveCategoryTab(chip.id)
                            setShowAllRows(false)
                          }}
                          onKeyDown={(e) => handleChipKeyDown(e, idx)}
                          className={`min-h-[44px] h-9 px-3.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition active:scale-95 border focus-visible:outline-none ${
                            isActive
                              ? 'bg-[#3A6B80] text-white border-[#3A6B80] shadow-xs'
                              : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#F5F1EB] hover:text-[#2C3E50]'
                          }`}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                  {/* Fade hint di tepi kanan */}
                  <div className="absolute right-0 top-0 bottom-1 w-6 pointer-events-none bg-gradient-to-l from-white to-transparent" />
                </div>

                {/* Baris Pilih Semua & Status Dipilih */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#F5F1EB] rounded-xl border border-[#EDE8DF]">
                  <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-[#2C3E50] select-none min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Pilih semua QR pada kategori aktif"
                      className="w-4 h-4 rounded border-[#B7C3CE] text-[#3A6B80] accent-[#3A6B80] cursor-pointer"
                    />
                    <span>Pilih semua</span>
                  </label>
                  <span
                    aria-live="polite"
                    className="text-xs font-semibold text-[#556575] tabular-nums"
                  >
                    {selectedLotCodes.size} dipilih
                  </span>
                </div>

                {/* Daftar Tunggal QR */}
                {filteredReprintLots.length === 0 ? (
                  <div className="p-4 bg-white border border-[#EDE8DF] rounded-xl text-center text-xs text-[#556575]">
                    Belum ada QR untuk kategori ini hari ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleReprintRanges.map((group) => {
                      const isRange = group.lots.length > 1
                      const isAllRangeSelected = group.lots.every((l) => selectedLotCodes.has(l.lotCode))
                      const isSomeRangeSelected =
                        group.lots.some((l) => selectedLotCodes.has(l.lotCode)) && !isAllRangeSelected
                      const isExpanded = expandedRanges.has(group.key)

                      if (!isRange) {
                        const lot = group.lots[0]
                        const isSelected = selectedLotCodes.has(lot.lotCode)

                        return (
                          <label
                            key={lot.lotCode}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer min-h-[52px] select-none ${
                              isSelected
                                ? 'bg-[#EEF5F9] border-[#3A6B80]/40'
                                : 'bg-white border-[#EDE8DF] hover:bg-[#F5F1EB]/60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectLot(lot.lotCode)}
                                className="w-4 h-4 rounded border-[#B7C3CE] text-[#3A6B80] accent-[#3A6B80] cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-[#2C3E50] block truncate">
                                  {lot.lotCode}
                                </span>
                                <span className="text-[11px] text-[#556575] block truncate">
                                  {lot.detail}
                                </span>
                              </div>
                            </div>
                          </label>
                        )
                      }

                      // Baris Rentang Lot Identik
                      const firstCode = group.lots[0].lotCode
                      const lastCode = group.lots[group.lots.length - 1].lotCode

                      return (
                        <div
                          key={group.key}
                          className={`rounded-xl border transition-colors overflow-hidden ${
                            isAllRangeSelected || isSomeRangeSelected
                              ? 'bg-[#EEF5F9]/60 border-[#3A6B80]/40'
                              : 'bg-white border-[#EDE8DF]'
                          }`}
                        >
                          <div className="flex items-center justify-between p-3 gap-2">
                            <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none min-h-[44px]">
                              <input
                                type="checkbox"
                                checked={isAllRangeSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isSomeRangeSelected
                                }}
                                onChange={() => toggleSelectRange(group.lots)}
                                className="w-4 h-4 rounded border-[#B7C3CE] text-[#3A6B80] accent-[#3A6B80] cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-[#2C3E50] truncate">
                                    {firstCode} s/d {lastCode}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#3A6B80] border border-[#EDE8DF]">
                                    {group.lots.length} lot
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#556575] block truncate mt-0.5">
                                  {group.detail}
                                </span>
                              </div>
                            </label>

                            <button
                              type="button"
                              onClick={() => toggleExpandRange(group.key)}
                              aria-label={isExpanded ? 'Tutup rincian lot' : 'Lihat rincian lot'}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EDE8DF]/60 text-[#556575] cursor-pointer transition shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-[#EDE8DF] divide-y divide-[#EDE8DF] bg-white">
                              {group.lots.map((lot) => {
                                const isSelected = selectedLotCodes.has(lot.lotCode)
                                return (
                                  <label
                                    key={lot.lotCode}
                                    className={`flex items-center gap-3 pl-8 pr-3 py-2 cursor-pointer transition-colors min-h-[44px] select-none ${
                                      isSelected ? 'bg-[#EEF5F9]' : 'hover:bg-[#F5F1EB]/60'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectLot(lot.lotCode)}
                                      className="w-4 h-4 rounded border-[#B7C3CE] text-[#3A6B80] accent-[#3A6B80] cursor-pointer shrink-0"
                                    />
                                    <span className="font-mono text-xs font-bold text-[#2C3E50] truncate">
                                      {lot.lotCode}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {hasMoreRows && (
                      <button
                        type="button"
                        onClick={() => setShowAllRows((prev) => !prev)}
                        className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-dashed border-[#B7C3CE] text-xs font-semibold text-[#3A6B80] hover:bg-[#F5F1EB] flex items-center justify-center gap-1.5 cursor-pointer transition-colors mt-2"
                      >
                        {showAllRows ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Tampilkan lebih sedikit</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>Lihat {remainingRowsCount} lainnya</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Tombol Sticky Cetak Terpilih */}
                {selectedLotCodes.size > 0 && (
                  <div className="sticky bottom-16 left-0 right-0 z-30 bg-white/95 backdrop-blur-xs border-t border-[#EDE8DF] p-3 -mx-4 -mb-4 mt-4 shadow-[0_-4px_16px_rgba(44,62,80,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
                    <button
                      type="button"
                      onClick={handlePrintSelected}
                      className="w-full min-h-[48px] h-12 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer focus-visible:outline-none"
                    >
                      <Printer className="w-4 h-4 text-white" />
                      <span>Cetak {selectedLotCodes.size} QR dipilih</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM SHEET 1: KONFIRMASI TERBITKAN QR BATCH 1                           */}
      {/* ========================================================================= */}
      {showPublishModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-0 sm:p-4"
        >
          <div
            className="fixed inset-0 -z-10"
            onClick={() => !isPublishing && setShowPublishModal(false)}
            aria-hidden="true"
          />

          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150">
            {/* Header Sheet */}
            <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between bg-[#F5F1EB]/70">
              <h2 id="publish-modal-title" className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                Konfirmasi Terbitkan QR (Batch 1)
              </h2>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setShowPublishModal(false)}
                aria-label="Tutup konfirmasi"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#556575] hover:bg-[#EDE8DF] cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Sheet */}
            <div className="p-4 space-y-3.5 overflow-y-auto">
              <div className="p-3 bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl space-y-1.5 text-xs text-[#2C3E50]">
                <span className="font-bold block text-[#3A6B80]">Ringkasan Kuantitas Terbit:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Wadah Adonan: <span className="font-bold">{plannedGilingan} wdh</span></div>
                  <div>Karung Bumbu: <span className="font-bold">{plannedKarung} krg</span></div>
                  <div>Bal Kulit: <span className="font-bold">{plannedKulit} bal</span></div>
                  <div>Bal Saos: <span className="font-bold">{plannedSaos} bal</span></div>
                </div>
                <div className="pt-2 border-t border-[#D1E4EF] font-bold text-sm text-[#3A6B80]">
                  Total: {totalLotsToIssue} QR Baru
                </div>
              </div>

              <div className="p-3 bg-[#FAF7F2] border border-[#EDE8DF] rounded-xl flex items-start gap-2.5 text-xs text-[#556575]">
                <AlertCircle className="w-4 h-4 text-[#C9A23D] shrink-0 mt-0.5" />
                <p>
                  Setelah terbit, rencana dikunci. Tambahan tetap bisa dibuat lewat batch berikutnya.
                </p>
              </div>

              {validationError && (
                <div role="alert" className="p-2.5 bg-[#FDEDEC] border border-[#FADBD8] rounded-xl text-[#9F2F2D] text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#E8352D] shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Footer Aksi Sheet */}
            <div className="p-3 border-t border-[#EDE8DF] bg-[#F5F1EB]/50 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setShowPublishModal(false)}
                className="flex-1 min-h-[44px] h-11 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] hover:bg-[#F5F1EB] transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handleExecutePublish}
                className="flex-1 min-h-[44px] h-11 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-white" />
                    <span>Terbitkan QR</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM SHEET 2: TAMBAH PRODUKSI (BATCH 2+)                                */}
      {/* ========================================================================= */}
      {showAddBatchModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-batch-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-0 sm:p-4"
        >
          <div
            className="fixed inset-0 -z-10"
            onClick={() => !isAddingBatch && setShowAddBatchModal(false)}
            aria-hidden="true"
          />

          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150">
            {/* Header Sheet */}
            <div className="px-4 py-3 border-b border-[#EDE8DF] flex items-center justify-between bg-[#F5F1EB]/70">
              <div>
                <h2 id="add-batch-modal-title" className="text-xs font-bold text-[#2C3E50] uppercase tracking-wide">
                  Tambah Produksi (Batch Baru)
                </h2>
                <p className="text-[11px] text-[#556575] mt-0.5">
                  Tambahan kuantitas dihitung kumulatif agar bahan yang cukup tidak dicetak ulang
                </p>
              </div>
              <button
                type="button"
                disabled={isAddingBatch}
                onClick={() => setShowAddBatchModal(false)}
                aria-label="Tutup tambah produksi"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#556575] hover:bg-[#EDE8DF] cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Sheet */}
            <div className="p-4 space-y-3.5 overflow-y-auto">
              {/* Input Tambahan Pesanan */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#2C3E50] block">
                  Jumlah Tambahan (Pack)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-[#556575] block mb-1">Mika (+pack)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Tambahan Mika"
                      value={addMikaPacks}
                      placeholder="0"
                      onChange={(e) => setAddMikaPacks(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-11 px-3 bg-white border border-[#EDE8DF] rounded-xl text-xs font-bold text-[#2C3E50] text-center focus-visible:outline-none focus-visible:border-[#3A6B80] shadow-2xs"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#556575] block mb-1">Vakum (+pack)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="Tambahan Vakum"
                      value={addVakumPacks}
                      placeholder="0"
                      onChange={(e) => setAddVakumPacks(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-11 px-3 bg-white border border-[#EDE8DF] rounded-xl text-xs font-bold text-[#2C3E50] text-center focus-visible:outline-none focus-visible:border-[#3A6B80] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Pratinjau Selisih Kebutuhan QR */}
              <div className="p-3 bg-[#EEF5F9] border border-[#D1E4EF] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#3A6B80]">
                    Pratinjau Selisih QR:
                  </span>
                  {isPreviewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3A6B80]" />}
                </div>

                {batchPreviewData ? (
                  <div className="space-y-1.5 text-xs text-[#2C3E50]">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="font-semibold">+{batchPreviewData.delta?.adonan || 0} Wadah Adonan</div>
                      <div className="font-semibold">+{batchPreviewData.delta?.bumbu || 0} Karung Bumbu</div>
                      <div className="font-semibold">+{batchPreviewData.delta?.kulit || 0} Bal Kulit</div>
                      <div className="font-semibold">+{batchPreviewData.delta?.saos || 0} Bal Saos</div>
                    </div>
                    <div className="pt-2 border-t border-[#D1E4EF] font-bold text-sm text-[#3A6B80] flex items-center justify-between">
                      <span>Total QR Baru:</span>
                      <span>+{batchPreviewData.delta?.total || 0} QR</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#556575]">
                    Masukkan jumlah pack tambahan untuk melihat selisih QR yang perlu dicetak.
                  </p>
                )}
              </div>

              {/* Alasan Tambahan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#2C3E50] block">
                  Alasan Tambahan (Opsional)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Pesanan mendadak', 'Stok kurang', 'Lainnya'].map((reason) => {
                    const isSelected = addReasonChoice === reason
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setAddReasonChoice(reason)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#3A6B80] text-white border-[#3A6B80]'
                            : 'bg-white text-[#556575] border-[#EDE8DF] hover:bg-[#F5F1EB]'
                        }`}
                      >
                        {reason}
                      </button>
                    )
                  })}
                </div>
                {addReasonChoice === 'Lainnya' && (
                  <input
                    type="text"
                    value={customReason}
                    placeholder="Tulis alasan tambahan..."
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#EDE8DF] rounded-xl text-xs text-[#2C3E50] focus-visible:outline-none focus-visible:border-[#3A6B80] mt-1"
                  />
                )}
              </div>

              {validationError && (
                <div role="alert" className="p-2.5 bg-[#FDEDEC] border border-[#FADBD8] rounded-xl text-[#9F2F2D] text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#E8352D] shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Footer Aksi Sheet */}
            <div className="p-3 border-t border-[#EDE8DF] bg-[#F5F1EB]/50 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={isAddingBatch}
                onClick={() => setShowAddBatchModal(false)}
                className="flex-1 min-h-[44px] h-11 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] hover:bg-[#F5F1EB] transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isAddingBatch || !batchPreviewData || batchPreviewData.delta?.total === 0}
                onClick={handleExecuteAddBatch}
                className="flex-1 min-h-[44px] h-11 rounded-xl bg-[#4685ac] hover:bg-[#3A6B80] active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isAddingBatch ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-white" />
                    <span>Terbitkan Batch {batchPreviewData?.next_batch_no || planBatches.length + 1}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 3: KONFIRMASI PEMBATALAN BATCH (VOID)                               */}
      {/* ========================================================================= */}
      {batchToVoid && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-4"
        >
          <div
            className="fixed inset-0 -z-10"
            onClick={() => !isVoiding && setBatchToVoid(null)}
            aria-hidden="true"
          />

          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#EDE8DF] shadow-xl overflow-hidden p-4 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#E8352D]">
              <span className="w-10 h-10 rounded-full bg-[#FDEDEC] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#E8352D]" />
              </span>
              <div>
                <h2 id="void-modal-title" className="text-sm font-bold text-[#2C3E50]">
                  Batalkan Batch {batchToVoid.batch_no}?
                </h2>
                <p className="text-xs text-[#556575] mt-0.5">
                  Aksi ini tidak dapat dibatalkan
                </p>
              </div>
            </div>

            <p className="text-xs text-[#556575] leading-relaxed">
              Seluruh QR pada Batch {batchToVoid.batch_no} akan diberi status VOID. Scanner stasiun kerja akan menolak barcode ini secara otomatis.
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-[#EDE8DF]">
              <button
                type="button"
                disabled={isVoiding}
                onClick={() => setBatchToVoid(null)}
                className="flex-1 min-h-[44px] h-10 rounded-xl border border-[#EDE8DF] bg-white text-xs font-semibold text-[#2C3E50] hover:bg-[#F5F1EB] transition cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isVoiding}
                onClick={handleExecuteVoidBatch}
                className="flex-1 min-h-[44px] h-10 rounded-xl bg-[#E8352D] hover:bg-[#C92A24] active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isVoiding ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Batalkan Batch</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
