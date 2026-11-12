import { canAccess } from './rbac'
import { useProduction1Store } from '../store/production1Store'

function resolveUser(currentUser) {
  if (currentUser) return currentUser
  try {
    return useProduction1Store.getState().currentUser
  } catch {
    return null
  }
}

/**
 * Memeriksa apakah user saat ini adalah PPIC (Ayu) atau Supervisor Global berdasarkan perizinan RBAC.
 *
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function isPpicAyu(currentUser = null) {
  const user = resolveUser(currentUser)
  if (!user) return false
  if (user.is_superadmin) return true
  return (
    canAccess('plan:update', user) ||
    canAccess('plan:view', user) ||
    canAccess('ppic_recap:view', user)
  )
}

/**
 * Memeriksa apakah user saat ini berhak menerbitkan barcode batch produksi baru.
 *
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canGenerateNewLots(currentUser = null) {
  const user = resolveUser(currentUser)
  if (!user) return false
  if (user.is_superadmin) return true
  return canAccess('barcode:generate', user) || canAccess('plan:update', user)
}

/**
 * Memeriksa apakah role saat ini memiliki izin untuk membuka/mencetak ulang label QR yang sudah ada.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canOpenQr(userRole, currentUser = null) {
  const user = resolveUser(currentUser)
  if (!user) return false
  if (user.is_superadmin) return true
  return (
    canAccess('barcode:generate', user) ||
    canAccess('plan:update', user) ||
    canAccess('plan:view', user) ||
    isPpicAyu(user)
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
  const user = resolveUser(currentUser)
  if (!user) return false
  if (user.is_superadmin) return true
  return (
    canAccess('meat:operate', user) ||
    canAccess('seasoning:operate', user) ||
    canAccess('wrapper:operate', user) ||
    canAccess('sauce:operate', user) ||
    canAccess('prod2_assembly:operate', user) ||
    canAccess('prod2_packing:operate', user) ||
    canAccess('plan:update', user)
  )
}

/**
 * Helper umum untuk mengecek apakah role adalah PIC / PPIC / Stakeholder.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function isPICRole(userRole, currentUser = null) {
  return canManualDispatch(userRole, currentUser)
}

/**
 * Memeriksa apakah role saat ini berhak membuat/mengunduh report Excel.
 *
 * @param {string} userRole
 * @param {object|null} currentUser
 * @returns {boolean}
 */
export function canExportExcel(userRole, currentUser = null) {
  const user = resolveUser(currentUser)
  if (!user) return false
  if (user.is_superadmin) return true
  return (
    canAccess('ppic_recap:export', user) ||
    canAccess('inbound:export', user) ||
    canAccess('outbound:export', user) ||
    canAccess('inventory:export', user)
  )
}
