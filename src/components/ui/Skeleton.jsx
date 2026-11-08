/**
 * Skeleton: Indikator loading placeholder berdenyut halus (shimmer/pulse).
 * Mencegah layout shift (CLS) dan memberikan kepastian visual bentuk data yang sedang dimuat.
 */
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[#EDE8DF]/75 ${className}`}
      {...props}
    />
  )
}

/**
 * Skeleton untuk Kartu Metrik Ringkasan PPIC
 */
export function SummaryCardSkeleton() {
  return (
    <div className="p-4 rounded-3xl bg-white border border-[#EDE8DF] shadow-xs space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

/**
 * Skeleton untuk Kartu Divisi PPIC
 */
export function DivisionCardSkeleton() {
  return (
    <div className="border border-[#EDE8DF] shadow-2xs rounded-2xl bg-white overflow-hidden p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#EDE8DF]">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-8 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton untuk Baris Data / List (misal Barang Masuk atau Riwayat)
 */
export function ListRowSkeleton({ count = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3.5 bg-white border border-[#EDE8DF] rounded-xl flex items-center justify-between gap-3"
        >
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
