/**
 * Utility Matriks Hak Akses & Perizinan Berbasis Role MES
 */

/**
 * Memeriksa apakah role saat ini memiliki izin untuk membuka/mencetak ulang label QR.
 * Hanya role supervisor/PIC/PPIC (STAKEHOLDER, PIC, SUPERVISOR, ADMIN, PPIC) yang berhak.
 * Role Karyawan/Operator lapangan (OPERATOR) TIDAK BERHAK membuka QR.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canOpenQr(userRole, currentUser = null) {
  if (currentUser) {
    const div = String(currentUser.division || '').toUpperCase()
    const opId = String(currentUser.operator_id || '').toUpperCase()
    const username = String(currentUser.username || currentUser.sub || '').toLowerCase()
    if (div.includes('PPIC') || div.includes('SUPERVISOR') || opId.includes('YOSI') || username === 'supervisor') {
      return true
    }
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
