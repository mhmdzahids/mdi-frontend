/**
 * Utilitas filter dan sorting data per hari
 * Tanpa emoji, bahasa sederhana dan ringkas.
 */

/**
 * Ambil tanggal format YYYY-MM-DD dari lot
 * @param {object} lot
 * @returns {string} e.g. "2026-10-09"
 */
export function getLotDateString(lot) {
  if (!lot) return ''

  // 1. Prioritas Utama: Ekstrak tanggal operasional dari kode lot (misal: DG-20261013-001, KULIT_9CM-20261013-001)
  const code = String(lot.lotCode || lot.lot_qr_code || '')
  const codeMatch = code.match(/-(\d{4})(\d{2})(\d{2})-/) || code.match(/^[A-Za-z0-9_]+-(\d{4})(\d{2})(\d{2})-/)
  if (codeMatch) {
    return `${codeMatch[1]}-${codeMatch[2]}-${codeMatch[3]}`
  }

  // 2. Jika ada ISO timestamp dari backend (UTC), konversi ke tanggal kalender lokal pengguna (WIB)
  const isoStr = lot.createdAtIso || lot.created_at
  if (isoStr && typeof isoStr === 'string' && isoStr.includes('T')) {
    try {
      const hasZ = isoStr.endsWith('Z') || isoStr.includes('+')
      const dateObj = new Date(hasZ ? isoStr : isoStr + 'Z')
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getFullYear()
        const m = String(dateObj.getMonth() + 1).padStart(2, '0')
        const d = String(dateObj.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    } catch {
      // fallback
    }
  }

  // 3. Fallback ke createdDate / createdAtIso mentah jika sudah format YYYY-MM-DD
  if (lot.createdDate && typeof lot.createdDate === 'string' && lot.createdDate.length >= 10) {
    return lot.createdDate.slice(0, 10)
  }

  if (lot.createdAtIso && typeof lot.createdAtIso === 'string' && lot.createdAtIso.length >= 10) {
    return lot.createdAtIso.slice(0, 10)
  }

  return ''
}

/**
 * Hitung selisih hari kalender dari hari ini
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {number} 0 = hari ini, 1 = kemarin, 2 = 2 hari lalu, dst.
 */
export function getDaysDiffFromToday(dateStr) {
  if (!dateStr) return 0

  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const parts = dateStr.split('-')
  if (parts.length !== 3) return 0

  const targetDate = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  )

  const diffMs = todayDate.getTime() - targetDate.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Format tanggal ke standar Indonesia (DD-MM-YYYY)
 * @param {string|Date} dateInput
 * @returns {string} e.g. "09-10-2026"
 */
export function formatDateToIndonesian(dateInput) {
  if (!dateInput) return ''

  if (dateInput instanceof Date) {
    const dd = String(dateInput.getDate()).padStart(2, '0')
    const mm = String(dateInput.getMonth() + 1).padStart(2, '0')
    const yyyy = dateInput.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }

  const str = String(dateInput).trim()

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.slice(0, 10).split('-')
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }

  // Format DD-MM-YYYY sudah sesuai
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str
  }

  // Dari kode lot: AWALAN-YYYYMMDD-xxx (fleksibel untuk DG-, KULIT_9CM-, FG_MIKA-, dll)
  const match = str.match(/-(\d{4})(\d{2})(\d{2})-/) || str.match(/^[A-Za-z0-9_]+-(\d{4})(\d{2})(\d{2})-/)
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`
  }

  return str
}

/**
 * Dapatkan tanggal hari ini dalam format DD-MM-YYYY
 * @returns {string}
 */
export function getTodayIndonesian() {
  return formatDateToIndonesian(new Date())
}

/**
 * Label hari sederhana format Indonesia
 * @param {number} diff
 * @param {string} dateStr
 * @returns {string}
 */
export function getDayLabel(diff, dateStr) {
  if (diff === 0) return 'Hari Ini'
  if (diff === 1) return 'Kemarin'
  if (diff === 2) return '2 Hari Lalu'
  const tglIndo = formatDateToIndonesian(dateStr)
  return tglIndo || `${diff} Hari Lalu`
}

/**
 * Ambil timestamp presisi milidetik dari log serah terima / transaksi
 * @param {object} log
 * @returns {number} epoch timestamp dalam milidetik
 */
export function getLogTimestampMs(log) {
  if (!log) return 0

  // 1. Prioritas utama: rawTimestamp atau createdAtIso (ISO format lengkap dari backend / local store)
  const isoStr = log.rawTimestamp || log.createdAtIso || log.created_at || log.timestampRaw
  if (isoStr && typeof isoStr === 'string') {
    try {
      const hasZ = isoStr.endsWith('Z') || isoStr.includes('+')
      const d = new Date(hasZ ? isoStr : isoStr + 'Z')
      const t = d.getTime()
      if (!isNaN(t) && t > 0) return t
    } catch {
      // fallback
    }
  }

  // 2. Jika timestamp berupa string jam (contoh: "10:44:59" atau "10.44.59")
  if (typeof log.timestamp === 'string') {
    const cleanTime = log.timestamp.replace(/\./g, ':').trim()
    const match = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (match) {
      const datePart = getLotDateString(log) || new Date().toISOString().slice(0, 10)
      const hh = match[1].padStart(2, '0')
      const mm = match[2]
      const ss = match[3] || '00'
      const combined = new Date(`${datePart}T${hh}:${mm}:${ss}`).getTime()
      if (!isNaN(combined) && combined > 0) return combined
    }
  }

  // 3. Fallback ke ID log jika numerik
  if (typeof log.logId === 'number' && log.logId > 0) {
    return log.logId
  }

  return 0
}

/**
 * Filter dan sort data riwayat transaksi / custody logs
 * @param {Array} logs
 * @param {object} options
 * @param {string} options.scope 'TODAY' | 'ALL'
 * @param {string} options.userRole 'OPERATOR' | 'STAKEHOLDER' | 'PIC'
 * @param {string} options.sortOrder 'NEWEST_FIRST' | 'OLDEST_FIRST'
 * @param {string} options.actionFilter 'ALL' | 'SCAN_OUT' | 'SCAN_IN' | 'STOCK_IN' | 'QR_PRINTED' | 'PROD_PROCESS'
 * @param {string} options.searchQuery string pencarian
 * @returns {Array}
 */
export function filterAndSortCustodyLogs(logs, options = {}) {
  if (!Array.isArray(logs)) return []

  const {
    scope = 'TODAY',
    sortOrder = 'NEWEST_FIRST',
    actionFilter = 'ALL',
    division = 'ALL',
    searchQuery = '',
    deliveryMap = null
  } = options

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const todayDateStr = `${yyyy}-${mm}-${dd}`
  const todayCodeStr = `${yyyy}${mm}${dd}`

  // 1. Filter tanggal (Scope)
  const filtered = logs.filter((log) => {
    if (scope === 'ALL') return true

    const code = String(log.lotCode || log.lot_qr_code || '')
    if (code.includes(`-${todayCodeStr}-`)) return true

    const dateStr = getLotDateString(log)
    if (!dateStr) return true
    return dateStr === todayDateStr
  })

  // 1b. Filter Divisi / Stasiun
  const divisionFiltered = filtered.filter((log) => {
    if (!division || division === 'ALL') return true
    const div = String(division).toUpperCase()
    const st = String(log.stationId || '').toUpperCase()
    const tgt = String(log.targetStation || '').toUpperCase()
    const code = String(log.lotCode || log.lot_qr_code || '').toUpperCase()
    const user = String(log.userId || '').toUpperCase()
    const notes = String(log.notes || '').toUpperCase()

    if (div === 'WRAPPER' || div === 'KULIT') {
      return (
        code.startsWith('KL-') ||
        st.includes('WRAPPER') ||
        st.includes('SKIN') ||
        tgt.includes('WRAPPER') ||
        user.includes('KULIT') ||
        notes.includes('KULIT')
      )
    }

    if (div === 'MEAT' || div === 'DAGING') {
      return (
        code.startsWith('DG-') ||
        code.startsWith('AD-') ||
        st.includes('MEAT') ||
        st.includes('MIX') ||
        st.includes('GRIND') ||
        tgt.includes('MEAT') ||
        tgt.includes('MIX') ||
        user.includes('DAGING') ||
        user.includes('GILING') ||
        notes.includes('DAGING') ||
        notes.includes('ADONAN')
      )
    }

    if (div === 'SEASONING' || div === 'BUMBU') {
      return (
        code.startsWith('BM-') ||
        code.startsWith('BS-') ||
        st.includes('SEASONING') ||
        st.includes('BUMBU') ||
        tgt.includes('SEASONING') ||
        user.includes('BUMBU') ||
        notes.includes('BUMBU')
      )
    }

    if (div === 'SAUCE' || div === 'SAOS') {
      return (
        code.startsWith('SS-') ||
        st.includes('SAUCE') ||
        st.includes('SAOS') ||
        tgt.includes('SAUCE') ||
        user.includes('SAOS') ||
        notes.includes('SAOS')
      )
    }

    if (div === 'ASSEMBLY' || div === 'CETAK') {
      return (
        st.includes('ASSEMBLY') ||
        st.includes('CETAK') ||
        tgt.includes('ASSEMBLY') ||
        tgt.includes('CETAK') ||
        code.startsWith('TR-') ||
        user.includes('CETAK') ||
        notes.includes('CETAK') ||
        ((code.startsWith('AD-') || code.startsWith('KL-')) && (log.actionType === 'SCAN_IN' || log.actionType === 'CONSUMED'))
      )
    }

    if (div === 'PACKING' || div === 'FREEZER') {
      return (
        st.includes('PACKING') ||
        st.includes('FINISHING') ||
        st.includes('FREEZER') ||
        tgt.includes('PACKING') ||
        tgt.includes('FINISHING') ||
        code.startsWith('FG-') ||
        code.startsWith('TR-') ||
        user.includes('PACKING') ||
        notes.includes('PACKING')
      )
    }

    if (div === 'SALES' || div === 'GUDANG') {
      return (
        st.includes('SALES') ||
        st.includes('GUDANG') ||
        tgt.includes('SALES') ||
        user.includes('GUDANG') ||
        user.includes('SALES') ||
        code.startsWith('FG-')
      )
    }

    return true
  })

  // 2. Filter Jenis Aksi (Action Type)
  const actionFiltered = divisionFiltered.filter((log) => {
    if (!actionFilter || actionFilter === 'ALL') return true

    const act = String(log.actionType || '').toUpperCase()
    if (actionFilter === 'WAITING_RECEIVE') {
      if (act !== 'SCAN_OUT') return false
      if (!deliveryMap) return true
      const info = deliveryMap.get(log.lotCode)
      return !info?.isReceived
    }
    if (actionFilter === 'CONSUMED') {
      return (
        act === 'CONSUMED' ||
        act === 'MATERIAL_USED' ||
        act === 'BUMBU_PORTION_CONSUMED' ||
        Boolean(log.notes && (
          log.notes.toLowerCase().includes('habis terpakai') ||
          log.notes.toLowerCase().includes('ditandai terpakai')
        ))
      )
    }
    if (actionFilter === 'SCAN_OUT') {
      return act === 'SCAN_OUT'
    }
    if (actionFilter === 'SCAN_IN') {
      return act === 'SCAN_IN' || act === 'PULL_SCAN_IN'
    }
    if (actionFilter === 'STOCK_IN') {
      return act === 'STOCK_IN'
    }
    if (actionFilter === 'QR_PRINTED') {
      return act === 'QR_PRINTED' || act === 'LOT_GENERATED'
    }
    if (actionFilter === 'PROD_PROCESS') {
      return (
        act === 'DOUGH_MIXED' ||
        act === 'MIXING_COMPLETED' ||
        act === 'BUMBU_PORTION_CONSUMED' ||
        act === 'WRAPPER_PREPARED'
      )
    }
    return true
  })

  // 3. Filter Pencarian Teks (Search Query)
  const searchFiltered = actionFiltered.filter((log) => {
    if (!searchQuery || !searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    const code = String(log.lotCode || log.lot_qr_code || '').toLowerCase()
    const user = String(log.userId || '').toLowerCase()
    const notes = String(log.notes || '').toLowerCase()
    const station = String(log.stationId || '').toLowerCase()
    const action = String(log.actionType || '').toLowerCase()
    return code.includes(q) || user.includes(q) || notes.includes(q) || station.includes(q) || action.includes(q)
  })

  // 4. Urutkan berdasarkan waktu kronologis
  return searchFiltered.sort((a, b) => {
    const timeA = getLogTimestampMs(a)
    const timeB = getLogTimestampMs(b)

    if (sortOrder === 'OLDEST_FIRST') {
      if (timeA !== timeB) return timeA - timeB
      return (Number(a.logId) || 0) - (Number(b.logId) || 0)
    }

    // Default: NEWEST_FIRST (Terbaru ke Terlama)
    if (timeA !== timeB) return timeB - timeA
    return (Number(b.logId) || 0) - (Number(a.logId) || 0)
  })
}

/**
 * Filter dan sort lot berdasarkan scope tanggal dan peran
 * @param {Array} lots
 * @param {string} scope 'TODAY' | 'YESTERDAY' | 'TWO_DAYS' | 'ALL'
 * @param {string} userRole 'OPERATOR' | 'STAKEHOLDER' | 'PIC'
 * @returns {Array}
 */
export function filterAndSortLots(lots, scope = 'TODAY', userRole = 'OPERATOR') {
  if (!Array.isArray(lots)) return []

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const todayDateStr = `${yyyy}-${mm}-${dd}`
  const todayCodeStr = `${yyyy}${mm}${dd}`

  // PIC melihat semua jika scope ALL, atau mengikuti scope jika dipilih
  const maxDays =
    scope === 'TODAY'
      ? 0
      : scope === 'YESTERDAY'
      ? 1
      : scope === 'TWO_DAYS'
      ? 2
      : 99999

  const filtered = lots.filter((lot) => {
    // Jika role PIC (STAKEHOLDER) dan scope ALL, jangan batasi
    if ((userRole === 'STAKEHOLDER' || userRole === 'PIC') && scope === 'ALL') {
      return true
    }

    const code = String(lot.lotCode || lot.lot_qr_code || '')
    // Fast path: Jika kode lot mengandung tanggal hari ini (-YYYYMMDD-), selalu lolos scope TODAY
    if (code.includes(`-${todayCodeStr}-`)) {
      return true
    }

    const dateStr = getLotDateString(lot)
    if (!dateStr) return scope === 'ALL'

    if (dateStr === todayDateStr) {
      return true
    }

    const diff = getDaysDiffFromToday(dateStr)
    return diff <= maxDays
  })

  // Sort: Tanggal terbaru di atas (descending), lalu kode lot descending
  return filtered.sort((a, b) => {
    const dateA = getLotDateString(a)
    const dateB = getLotDateString(b)

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA)
    }

    const codeA = String(a.lotCode || a.lot_qr_code || '')
    const codeB = String(b.lotCode || b.lot_qr_code || '')
    return codeB.localeCompare(codeA)
  })
}

/**
 * Kelompokkan lot per hari untuk tampilan rapi
 * @param {Array} sortedLots
 * @returns {Array<{ dateKey: string, label: string, diff: number, items: Array }>}
 */
export function groupLotsByDay(sortedLots) {
  if (!Array.isArray(sortedLots) || sortedLots.length === 0) return []

  const groupsMap = new Map()

  for (const lot of sortedLots) {
    const dateKey = getLotDateString(lot) || 'LAINNYA'
    const diff = dateKey !== 'LAINNYA' ? getDaysDiffFromToday(dateKey) : 999
    const label = dateKey !== 'LAINNYA' ? getDayLabel(diff, dateKey) : 'Lainnya'

    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, {
        dateKey,
        label,
        diff,
        items: []
      })
    }

    groupsMap.get(dateKey).items.push(lot)
  }

  return Array.from(groupsMap.values())
}
