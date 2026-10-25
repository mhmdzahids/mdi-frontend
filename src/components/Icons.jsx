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

// Pemindai Barcode / QR (Scan bar, Kamera scanner)
export function ScanIcon({ className = 'w-4 h-4', ...props }) {
  return <ScanLine className={className} {...props} />
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
