/**
 * RBAC Helper & Permission Mapping - Dimsum MES
 * Memvalidasi hak akses frontend berdasarkan daftar izin efektif dari endpoint /me.
 */

export function isSuperAdmin(currentUser) {
  return Boolean(currentUser?.is_superadmin)
}

export function canAccess(permissionCode, currentUser, isDevMode = false) {
  if (isDevMode) return true
  if (!currentUser) return false
  if (currentUser.is_superadmin) {
    // Super Admin mengelola administrasi, profil, serta master harga produk POS
    if (permissionCode.startsWith('admin_') || permissionCode.startsWith('profile:') || permissionCode.startsWith('freezer_sales:')) {
      return true
    }
    return false
  }
  const perms = currentUser.permissions || []
  return perms.includes(permissionCode)
}

export function hasAnyPermission(permissionCodes = [], currentUser, isDevMode = false) {
  if (isDevMode) return true
  if (!currentUser) return false
  if (currentUser.is_superadmin) {
    return permissionCodes.some((code) => code.startsWith('admin_') || code.startsWith('profile:') || code.startsWith('freezer_sales:'))
  }
  const perms = currentUser.permissions || []
  return permissionCodes.some((code) => perms.includes(code))
}

/**
 * Pemetaan izin minimal yang disyaratkan untuk melihat/mengakses setiap stasiun & rute.
 */
export const ROUTE_PERMISSION_MAP = {
  // Produksi 1
  PLAN: 'plan:view',
  SUMMARY: 'ppic_recap:view',
  SUPPLIER: 'inbound:view',
  MEAT: 'meat:view',
  SEASONING: 'seasoning:view',
  WRAPPER: 'wrapper:view',
  SAUCE: 'sauce:view',
  LOGS: 'logs:view',

  // Produksi 2
  PROD2_INBOUND: 'prod2_assembly:view',
  PROD2_ASSEMBLY: 'prod2_assembly:view',
  PROD2_FREEZER: 'prod2_packing:view',
  PROD2_PRODUCTS: 'freezer_sales:view',
  PROD2_LOGS: 'logs:view',

  // Khusus Profil & Super Admin
  PROFILE: 'profile:view',
  ADMIN: 'admin_users:view'
}

/**
 * Daftar Halaman dan Fitur untuk Editor Izin Role (Tab Role).
 * Dikelompokkan rapi per halaman modul operasional dan administrasi.
 */
export const PERMISSION_MODULES = [
  {
    feature: 'plan',
    title: 'Rencana Produksi (PPIC)',
    description: 'Perencanaan target harian, order, bumper, dan batch susulan',
    viewPerm: 'plan:view',
    actions: [
      { code: 'plan:view', label: 'Lihat', type: 'view' },
      { code: 'plan:create', label: 'Buat Baru', type: 'create' },
      { code: 'plan:update', label: 'Ubah Target', type: 'update' },
      { code: 'plan:publish', label: 'Publikasi', type: 'update' },
      { code: 'plan:add_batch', label: 'Tambah Batch', type: 'create' },
      { code: 'plan:void_batch', label: 'Void Batch', type: 'delete' },
    ]
  },
  {
    feature: 'barcode',
    title: 'Penerbitan Barcode & Label QR',
    description: 'Generate kode QR lot wadah, karung, pouch, dan bal',
    viewPerm: 'barcode:generate',
    actions: [
      { code: 'barcode:generate', label: 'Cetak / Generate', type: 'create' }
    ]
  },
  {
    feature: 'ppic_recap',
    title: 'Rekapitulasi & Reject PPIC',
    description: 'Catatan operasional harian, reject divisi, dan ekspor excel',
    viewPerm: 'ppic_recap:view',
    actions: [
      { code: 'ppic_recap:view', label: 'Lihat', type: 'view' },
      { code: 'ppic_recap:notes', label: 'Input Catatan / Reject', type: 'create' },
      { code: 'ppic_recap:export', label: 'Ekspor Excel', type: 'export' }
    ]
  },
  {
    feature: 'inbound',
    title: 'Barang Masuk Supplier (Logistik)',
    description: 'Penerimaan bahan baku, nota jalan supplier, dan rekap masuk',
    viewPerm: 'inbound:view',
    actions: [
      { code: 'inbound:view', label: 'Lihat', type: 'view' },
      { code: 'inbound:create', label: 'Input Masuk', type: 'create' },
      { code: 'inbound:export', label: 'Ekspor Excel', type: 'export' }
    ]
  },
  {
    feature: 'outbound',
    title: 'Barang Keluar ke Lantai Produksi',
    description: 'Mutasi bahan baku ke meja stasiun produksi',
    viewPerm: 'outbound:view',
    actions: [
      { code: 'outbound:view', label: 'Lihat', type: 'view' },
      { code: 'outbound:create', label: 'Input Keluar', type: 'create' },
      { code: 'outbound:export', label: 'Ekspor Excel', type: 'export' }
    ]
  },
  {
    feature: 'inventory',
    title: 'Inventory & Stok Bahan Baku',
    description: 'Monitoring saldo sisa stok bahan baku dan ekspor',
    viewPerm: 'inventory:view',
    actions: [
      { code: 'inventory:view', label: 'Lihat', type: 'view' },
      { code: 'inventory:export', label: 'Ekspor Excel', type: 'export' }
    ]
  },
  {
    feature: 'meat',
    title: 'Stasiun Daging (Giling & Mix)',
    description: 'Penggilingan daging ayam dan pencampuran adonan',
    viewPerm: 'meat:view',
    actions: [
      { code: 'meat:view', label: 'Lihat', type: 'view' },
      { code: 'meat:operate', label: 'Operasi Mixing', type: 'create' },
      { code: 'meat:scan', label: 'Scan Daging', type: 'update' }
    ]
  },
  {
    feature: 'seasoning',
    title: 'Stasiun Bumbu Racik',
    description: 'Peracikan paket bumbu Sparta karung & pouch',
    viewPerm: 'seasoning:view',
    actions: [
      { code: 'seasoning:view', label: 'Lihat', type: 'view' },
      { code: 'seasoning:operate', label: 'Operasi Racik', type: 'create' },
      { code: 'seasoning:scan', label: 'Scan Bumbu', type: 'update' }
    ]
  },
  {
    feature: 'wrapper',
    title: 'Stasiun Kulit Pangsit',
    description: 'Persiapan dan potong bal kulit 7cm & 9cm',
    viewPerm: 'wrapper:view',
    actions: [
      { code: 'wrapper:view', label: 'Lihat', type: 'view' },
      { code: 'wrapper:operate', label: 'Operasi Kulit', type: 'create' },
      { code: 'wrapper:scan', label: 'Scan Kulit', type: 'update' }
    ]
  },
  {
    feature: 'sauce',
    title: 'Stasiun Saos Dimsum',
    description: 'Persiapan bal saos botol dan sachet',
    viewPerm: 'sauce:view',
    actions: [
      { code: 'sauce:view', label: 'Lihat', type: 'view' },
      { code: 'sauce:operate', label: 'Operasi Saos', type: 'create' },
      { code: 'sauce:scan', label: 'Scan Saos', type: 'update' }
    ]
  },
  {
    feature: 'prod2_assembly',
    title: 'Produksi 2: Meja Cetak & Assembly',
    description: 'Penerimaan adonan dan penyelesaian nampan dimsum',
    viewPerm: 'prod2_assembly:view',
    actions: [
      { code: 'prod2_assembly:view', label: 'Lihat', type: 'view' },
      { code: 'prod2_assembly:operate', label: 'Operasi Cetak', type: 'create' }
    ]
  },
  {
    feature: 'prod2_packing',
    title: 'Produksi 2: Meja Packing & Checker',
    description: 'Pemeriksaan nampan dan kemas finished goods mika/vakum',
    viewPerm: 'prod2_packing:view',
    actions: [
      { code: 'prod2_packing:view', label: 'Lihat', type: 'view' },
      { code: 'prod2_packing:operate', label: 'Operasi Packing', type: 'create' }
    ]
  },
  {
    feature: 'freezer_sales',
    title: 'Gudang Freezer & Penjualan (POS)',
    description: 'Stok barang jadi, katalog harga, dan verifikasi serah terima kasir/freezer',
    viewPerm: 'freezer_sales:view',
    actions: [
      { code: 'freezer_sales:view', label: 'Lihat', type: 'view' },
      { code: 'freezer_sales:update', label: 'Ubah', type: 'update' },
      { code: 'freezer_sales:view_price', label: 'Lihat Harga', type: 'view_price' },
      { code: 'freezer_sales:edit_price', label: 'Ubah Harga', type: 'edit_price' },
      { code: 'freezer_sales:operate', label: 'Serah Terima', type: 'create' }
    ]
  },
  {
    feature: 'scan',
    title: 'Scanner Operasional & Konfigurasi',
    description: 'Operasi scan 1X/2X dan pengaturan mode scanner per stasiun',
    viewPerm: 'scan:operate',
    actions: [
      { code: 'scan:operate', label: 'Operasi Scan', type: 'update' },
      { code: 'scan:settings', label: 'Ubah Mode Scan', type: 'update' }
    ]
  },
  {
    feature: 'logs',
    title: 'Riwayat & Log Audit Barcode',
    description: 'Jejak custody transfer dan histori pergerakan wadah',
    viewPerm: 'logs:view',
    actions: [
      { code: 'logs:view', label: 'Lihat', type: 'view' }
    ]
  },
  {
    feature: 'admin_users',
    title: 'Administrasi: Pengguna (Users)',
    description: 'Manajemen akun pegawai, status aktif, dan reset password',
    viewPerm: 'admin_users:view',
    actions: [
      { code: 'admin_users:view', label: 'Lihat', type: 'view' },
      { code: 'admin_users:create', label: 'Tambah', type: 'create' },
      { code: 'admin_users:update', label: 'Ubah / Status', type: 'update' },
      { code: 'admin_users:delete', label: 'Hapus', type: 'delete' }
    ]
  },
  {
    feature: 'admin_roles',
    title: 'Administrasi: Peran & Izin (RBAC)',
    description: 'Pengaturan role sistem, duplikasi role, dan hak akses',
    viewPerm: 'admin_roles:view',
    actions: [
      { code: 'admin_roles:view', label: 'Lihat', type: 'view' },
      { code: 'admin_roles:create', label: 'Buat Baru', type: 'create' },
      { code: 'admin_roles:update', label: 'Ubah Izin', type: 'update' },
      { code: 'admin_roles:delete', label: 'Hapus Role', type: 'delete' }
    ]
  },
  {
    feature: 'admin_audit_logs',
    title: 'Administrasi: Log Audit Aktivitas',
    description: 'Penelusuran jejak audit aktivitas sistem secara immutable',
    viewPerm: 'admin_audit_logs:view',
    actions: [
      { code: 'admin_audit_logs:view', label: 'Lihat Log', type: 'view' }
    ]
  }
]
