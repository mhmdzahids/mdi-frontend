import {
  ScanLine,
  Barcode,
  Beef,
  Blend,
  Layers,
  History,
  SlidersHorizontal,
  Printer,
  Send,
  ArrowDownLeft,
  LayoutGrid,
  Plus,
  Minus,
  Check,
  AlertTriangle,
  X,
  Bluetooth,
  RotateCcw,
  Package,
  Camera,
  Flashlight,
  SwitchCamera,
  Droplets,
  Snowflake,
  PackageCheck,
  Pencil,
  Image as LucideImage,
  ClipboardList,
  Filter,
  ChevronDown,
  Clock,
  Search,
  MoreVertical
} from 'lucide-react'

// Pemindai Barcode / QR (Scan bar, Kamera scanner) dari Lucide
export function ScanIcon({ className = 'w-4 h-4', size, ...props }) {
  return <ScanLine size={size} className={className} {...props} />
}

// Empat sudut bingkai scan
const ScanFrame = () => (
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </>
)

// Kotak barang berbentuk U (terbuka di atas)
const ScanCrate = () => <path d="M8 13v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3" />

export function ScanInIcon({ size = 24, strokeWidth = 2, className = 'w-6 h-6', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <ScanFrame />
      <ScanCrate />
      {/* panah turun masuk ke kotak */}
      <path d="M12 6.5V14" />
      <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
    </svg>
  )
}

export function ScanOutIcon({ size = 24, strokeWidth = 2, className = 'w-6 h-6', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <ScanFrame />
      <ScanCrate />
      {/* panah naik keluar dari kotak */}
      <path d="M12 14V6.5" />
      <path d="m9.5 9 2.5-2.5L14.5 9" />
    </svg>
  )
}

// Barcode Garis 1D
export function BarcodeIcon({ className = 'w-4 h-4', ...props }) {
  return <Barcode className={className} {...props} />
}

// Stasiun Daging (Daging giling, bahan mentah)
export function MeatIcon({ className = 'w-4 h-4', ...props }) {
  return <Beef className={className} {...props} />
}

// Mesin Mixer Adonan (Pengadukan bumbu & daging)
export function MixerIcon({ className = 'w-4 h-4', ...props }) {
  return <Blend className={className} {...props} />
}

// Stasiun Kulit (Lembaran kulit dimsum bertumpuk)
export function WrapperIcon({ className = 'w-4 h-4', ...props }) {
  return <Layers className={className} {...props} />
}

// Riwayat Serah Terima & Audit Log
export function LogIcon({ className = 'w-4 h-4', ...props }) {
  return <History className={className} {...props} />
}

// Kalibrasi Label & Printer
export function CalibrateIcon({ className = 'w-4 h-4', ...props }) {
  return <SlidersHorizontal className={className} {...props} />
}

// Printer Thermal Label Bluetooth (TSPL / ESC-POS)
export function PrinterIcon({ className = 'w-4 h-4', ...props }) {
  return <Printer className={className} {...props} />
}

// Kirim Lot / Scan-OUT ke stasiun berikutnya
export function SendIcon({ className = 'w-4 h-4', ...props }) {
  return <Send className={className} {...props} />
}

// Terima Lot / Scan-IN dari stasiun sebelumnya
export function ReceiveIcon({ className = 'w-4 h-4', ...props }) {
  return <ArrowDownLeft className={className} {...props} />
}

// Bagian Cetak Dimsum / Baki Cetak Pembentukan
export function CetakIcon({ className = 'w-4 h-4', ...props }) {
  return <LayoutGrid className={className} {...props} />
}

// Tambah Kuantitas / Batch Baru
export function PlusIcon({ className = 'w-4 h-4', ...props }) {
  return <Plus className={className} {...props} />
}

// Kurangi Kuantitas
export function MinusIcon({ className = 'w-4 h-4', ...props }) {
  return <Minus className={className} {...props} />
}

// Konfirmasi / Validasi Berhasil / Stok Masuk
export function CheckIcon({ className = 'w-4 h-4', ...props }) {
  return <Check className={className} {...props} />
}

// Peringatan / Error / Bypass Supervisor
export function AlertIcon({ className = 'w-4 h-4', ...props }) {
  return <AlertTriangle className={className} {...props} />
}

// Tutup / Batal / Dismiss Dialog
export function XIcon({ className = 'w-4 h-4', ...props }) {
  return <X className={className} {...props} />
}

// Status Koneksi Bluetooth Printer
export function BluetoothIcon({ className = 'w-4 h-4', ...props }) {
  return <Bluetooth className={className} {...props} />
}

// Reset / Segarkan Pengaturan
export function RefreshIcon({ className = 'w-4 h-4', ...props }) {
  return <RotateCcw className={className} {...props} />
}

// Porsi Bumbu Spartan (Pack / Wadah Bumbu)
export function BagIcon({ className = 'w-4 h-4', ...props }) {
  return <Package className={className} {...props} />
}

// Pemindai Kamera HP
export function CameraIcon({ className = 'w-4 h-4', ...props }) {
  return <Camera className={className} {...props} />
}

// Senter / Torch Kamera
export function FlashIcon({ className = 'w-4 h-4', ...props }) {
  return <Flashlight className={className} {...props} />
}

// Tukar Kamera Depan / Belakang
export function SwitchCameraIcon({ className = 'w-4 h-4', ...props }) {
  return <SwitchCamera className={className} {...props} />
}

// Stasiun Saos & Minyak Wijen
export function SauceIcon({ className = 'w-4 h-4', ...props }) {
  return <Droplets className={className} {...props} />
}

// Gudang Beku / Freezer Packing
export function FreezerIcon({ className = 'w-4 h-4', ...props }) {
  return <Snowflake className={className} {...props} />
}

// Produk Jadi / Toko POS
export function ProductIcon({ className = 'w-4 h-4', ...props }) {
  return <PackageCheck className={className} {...props} />
}

// Edit / Sesuaikan Stok Produk
export function EditIcon({ className = 'w-4 h-4', ...props }) {
  return <Pencil className={className} {...props} />
}

// Gambar / Foto Produk
export function ImageIcon({ className = 'w-4 h-4', ...props }) {
  return <LucideImage className={className} {...props} />
}

// Rencana Produksi PPIC
export function PlanIcon({ className = 'w-4 h-4', ...props }) {
  return <ClipboardList className={className} {...props} />
}

// Filter & Urutkan Transaksi Log
export function FilterIcon({ className = 'w-4 h-4', ...props }) {
  return <Filter className={className} {...props} />
}

export function ChevronDownIcon({ className = 'w-4 h-4', ...props }) {
  return <ChevronDown className={className} {...props} />
}

export function ClockIcon({ className = 'w-4 h-4', ...props }) {
  return <Clock className={className} {...props} />
}

export function SearchIcon({ className = 'w-4 h-4', ...props }) {
  return <Search className={className} {...props} />
}

export function MoreVerticalIcon({ className = 'w-4 h-4', ...props }) {
  return <MoreVertical className={className} {...props} />
}
