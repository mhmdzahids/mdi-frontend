/**
 * Utility Matriks Hak Akses & Perizinan Berbasis Role MES
 */

/**
 * Memeriksa apakah user saat ini adalah PPIC (Ayu) atau Supervisor Global.
 * Hanya PPIC/Supervisor yang berhak:
 * 1. Mengubah target Rencana Produksi (Target Gilingan & Kemasan)
 * 2. Menerbitkan/Generate seluruh barcode produksi awal (Daging, Bumbu, Kulit, Saos)
 * 3. Merekap catatan reject & operasional divisi
 * 4. Mencatat penerimaan barang dari supplier luar
 *
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function isPpicAyu(currentUser = null) {
  if (!currentUser) return false
  const div = String(currentUser.division || '').toUpperCase()
  const opId = String(currentUser.operator_id || '').toUpperCase()
  const username = String(currentUser.username || currentUser.sub || '').toLowerCase()
  return (
    div.includes('PPIC') ||
    div.includes('SUPERVISOR') ||
    opId.includes('AYU') ||
    opId.includes('YOSI') ||
    username === 'ppic_ayu' ||
    username === 'supervisor' ||
    username === 'ayu'
  )
}

/**
 * Memeriksa apakah user saat ini berhak menerbitkan barcode batch produksi baru.
 * PIC divisi lapangan TIDAK BERHAK menerbitkan QR. Hanya PPIC (Ayu) / Supervisor yang berhak.
 *
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canGenerateNewLots(currentUser = null) {
  return isPpicAyu(currentUser)
}

/**
 * Memeriksa apakah role saat ini memiliki izin untuk membuka/mencetak ulang label QR yang sudah ada.
 * Hanya role supervisor/PIC/PPIC (STAKEHOLDER, PIC, SUPERVISOR, ADMIN, PPIC) yang berhak.
 * Role Karyawan/Operator lapangan (OPERATOR) TIDAK BERHAK membuka QR.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canOpenQr(userRole, currentUser = null) {
  if (currentUser && isPpicAyu(currentUser)) {
    return true
  }
  if (!userRole) return false
  const r = String(userRole).toUpperCase()
  return (
    r === 'STAKEHOLDER' ||
    r === 'PIC' ||
    r === 'SUPERVISOR' ||
    r === 'ADMIN' ||
    r === 'PPIC'
  )
}

/**
 * Memeriksa apakah role saat ini memiliki izin untuk melakukan aksi manual (BTN override / terima langsung)
 * tanpa melalui pemindaian kamera barcode.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canManualDispatch(userRole, currentUser = null) {
  return canOpenQr(userRole, currentUser)
}

/**
 * Helper umum untuk mengecek apakah role adalah PIC / PPIC / Stakeholder.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function isPICRole(userRole, currentUser = null) {
  return canOpenQr(userRole, currentUser)
}
