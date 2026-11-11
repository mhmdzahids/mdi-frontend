/**
 * Utility Ekspor Dokumen Microsoft Excel (.xls XML SpreadsheetML)
 * Zero-dependency, menghasilkan file Excel berformat rapi:
 * - Kop Resmi Pabrik PT Makan Dimsum Indonesia
 * - Judul & Metadata (Tanggal, Petugas, Target)
 * - Header Kolom Berwarna Tema MES (#3A6B80) & Huruf Tebal Putih
 * - Penataan Baris Rapi (Border, Rata Kanan Angka, Rata Kiri Teks)
 * - Baris Total / Ringkasan Tebal di Bawah
 */

function escapeXml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Download file Excel XML di browser
 */
export function downloadExcelXml({
  fileName = 'Laporan_Produksi.xls',
  sheetName = 'Laporan',
  title = 'PT MAKAN DIMSUM INDONESIA',
  subtitles = [],
  columns = [],
  data = [],
  totals = null
}) {
  const safeSheetName = escapeXml(sheetName || 'Laporan')
  const totalCols = Math.max(columns.length, 4)

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Kop Perusahaan -->
  <Style ss:ID="CompanyKop">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#E9ECEF" ss:Pattern="Solid"/>
  </Style>
  <!-- Sub-Kop Info -->
  <Style ss:ID="MetaLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#495057" ss:Italic="1"/>
  </Style>
  <!-- Header Kolom Tabel -->
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#3A6B80" ss:Pattern="Solid"/>
  </Style>
  <!-- Baris Data Genap -->
  <Style ss:ID="DataLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
  </Style>
  <Style ss:ID="DataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
  </Style>
  <Style ss:ID="DataRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
  </Style>
  <!-- Baris Total / Ringkasan -->
  <Style ss:ID="TotalRowLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#3A6B80"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#F5F1EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalRowRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#3A6B80"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#F5F1EB" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${safeSheetName}">
  <Table ss:DefaultRowHeight="20">
`

  // Definisi Lebar Kolom
  columns.forEach((col) => {
    const width = col.width || 120
    xml += `   <Column ss:AutoFitWidth="0" ss:Width="${width}"/>\n`
  })

  // Baris Judul Utama
  xml += `   <Row ss:Height="28">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="CompanyKop">
     <Data ss:Type="String">${escapeXml(title)}</Data>
    </Cell>
   </Row>\n`

  // Baris Subtitle / Metadata
  if (Array.isArray(subtitles)) {
    subtitles.forEach((sub) => {
      xml += `   <Row ss:Height="18">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="MetaLabel">
     <Data ss:Type="String">${escapeXml(sub)}</Data>
    </Cell>
   </Row>\n`
    })
  }

  // Spacing Row
  xml += `   <Row ss:Height="10"/>\n`

  // Baris Header Kolom
  xml += `   <Row ss:Height="26">\n`
  columns.forEach((col) => {
    xml += `    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>\n`
  })
  xml += `   </Row>\n`

  // Baris Data
  data.forEach((row) => {
    xml += `   <Row ss:Height="22">\n`
    columns.forEach((col) => {
      const rawVal = row[col.key]
      const align = col.align || (typeof rawVal === 'number' ? 'right' : 'left')
      const styleId = align === 'right' ? 'DataRight' : align === 'center' ? 'DataCenter' : 'DataLeft'
      const isNum = typeof rawVal === 'number' && !isNaN(rawVal)

      if (isNum) {
        xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${rawVal}</Data></Cell>\n`
      } else {
        xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(rawVal !== undefined && rawVal !== null ? rawVal : '-')}</Data></Cell>\n`
      }
    })
    xml += `   </Row>\n`
  })

  // Baris Total Jika Disediakan
  if (totals && totals.values) {
    xml += `   <Row ss:Height="24">\n`
    columns.forEach((col, cIdx) => {
      if (cIdx === 0) {
        xml += `    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String">${escapeXml(totals.label || 'TOTAL')}</Data></Cell>\n`
      } else {
        const val = totals.values[col.key]
        if (typeof val === 'number') {
          xml += `    <Cell ss:StyleID="TotalRowRight"><Data ss:Type="Number">${val}</Data></Cell>\n`
        } else {
          xml += `    <Cell ss:StyleID="TotalRowRight"><Data ss:Type="String">${escapeXml(val || '')}</Data></Cell>\n`
        }
      }
    })
    xml += `   </Row>\n`
  }

  xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`

  // Buat blob dan trigger download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { fileName, blob, xml }
}

/**
 * Ekspor Rekap Harian PPIC ke Excel
 */
export function exportPpicRecapExcel({ dateStr, recapData, operatorName }) {
  const divisions = recapData?.divisions || {}
  const divRows = [
    {
      divisi: 'Daging (Giling & Mix)',
      satuan: divisions.DAGING?.unit || 'Gilingan',
      diterbitkan: divisions.DAGING?.total_lots || 0,
      total_qty: divisions.DAGING?.total_quantity || 0,
      terkirim: divisions.DAGING?.completed_count || 0,
      sisa_qr: divisions.DAGING?.printed_count || 0,
      void_qr: divisions.DAGING?.void_count || 0,
      reject: divisions.DAGING?.reject_count || 0,
      reject_notes: divisions.DAGING?.reject_notes || '-',
      catatan: divisions.DAGING?.operational_notes || '-'
    },
    {
      divisi: 'Bumbu Sparta',
      satuan: divisions.BUMBU?.unit || 'Karung',
      diterbitkan: divisions.BUMBU?.total_lots || 0,
      total_qty: divisions.BUMBU?.total_quantity || 0,
      terkirim: divisions.BUMBU?.completed_count || 0,
      sisa_qr: divisions.BUMBU?.printed_count || 0,
      void_qr: divisions.BUMBU?.void_count || 0,
      reject: divisions.BUMBU?.reject_count || 0,
      reject_notes: divisions.BUMBU?.reject_notes || '-',
      catatan: divisions.BUMBU?.operational_notes || '-'
    },
    {
      divisi: 'Kulit Dimsum',
      satuan: divisions.KULIT?.unit || 'BAL',
      diterbitkan: divisions.KULIT?.total_lots || 0,
      total_qty: divisions.KULIT?.total_quantity || 0,
      terkirim: divisions.KULIT?.completed_count || 0,
      sisa_qr: divisions.KULIT?.printed_count || 0,
      void_qr: divisions.KULIT?.void_count || 0,
      reject: divisions.KULIT?.reject_count || 0,
      reject_notes: divisions.KULIT?.reject_notes || '-',
      catatan: divisions.KULIT?.operational_notes || '-'
    },
    {
      divisi: 'Saos Dimsum',
      satuan: divisions.SAOS?.unit || 'BAL',
      diterbitkan: divisions.SAOS?.total_lots || 0,
      total_qty: divisions.SAOS?.total_quantity || 0,
      terkirim: divisions.SAOS?.completed_count || 0,
      sisa_qr: divisions.SAOS?.printed_count || 0,
      void_qr: divisions.SAOS?.void_count || 0,
      reject: divisions.SAOS?.reject_count || 0,
      reject_notes: divisions.SAOS?.reject_notes || '-',
      catatan: divisions.SAOS?.operational_notes || '-'
    },
    {
      divisi: 'Meja Cetak',
      satuan: 'PCS',
      diterbitkan: divisions.CETAK?.adonan_received_count ? `${divisions.CETAK.adonan_received_count} Adonan` : '-',
      total_qty: divisions.CETAK?.total_pcs_cetak || 0,
      terkirim: divisions.CETAK?.kulit_received_count ? `${divisions.CETAK.kulit_received_count} Kulit` : '-',
      sisa_qr: '-',
      void_qr: '-',
      reject: divisions.CETAK?.reject_count || 0,
      reject_notes: divisions.CETAK?.reject_notes || '-',
      catatan: `Adonan: ${divisions.CETAK?.adonan_received_count || 0} lot (${divisions.CETAK?.adonan_received_qty || 0} kg), Kulit: ${divisions.CETAK?.kulit_received_count || 0} lot (${divisions.CETAK?.kulit_received_qty || 0} bal). ${divisions.CETAK?.operational_notes || ''}`.trim()
    },
    {
      divisi: 'Meja Packing',
      satuan: 'PACK',
      diterbitkan: divisions.PACKING?.target_pack || 0,
      total_qty: divisions.PACKING?.scan_pack || 0,
      terkirim: divisions.PACKING?.sales_pack || 0,
      sisa_qr: divisions.PACKING?.selisih_sales || 0,
      void_qr: '-',
      reject: divisions.PACKING?.reject_count || 0,
      reject_notes: divisions.PACKING?.reject_notes || '-',
      catatan: `Target: ${divisions.PACKING?.target_pack || 0} pk, Scan: ${divisions.PACKING?.scan_pack || 0} pk, Audit Sales: ${divisions.PACKING?.sales_pack || 0} pk (Selisih: ${divisions.PACKING?.selisih_sales || 0} pk). ${divisions.PACKING?.operational_notes || ''}`.trim()
    }
  ]

  const totalReject = divRows.reduce((acc, r) => acc + (typeof r.reject === 'number' ? r.reject : 0), 0)
  const safeDateStr = (dateStr || 'HariIni')
    .replace(/\s*s\/d\s*/gi, '_sd_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')

  downloadExcelXml({
    fileName: `Rekap_PPIC_Pabrik_${safeDateStr}.xls`,
    sheetName: 'Rekap PPIC',
    title: 'PT MAKAN DIMSUM INDONESIA - REKAP HARIAN PPIC',
    subtitles: [
      `Tanggal / Periode: ${dateStr || new Date().toISOString().split('T')[0]}`,
      `Target Gilingan  : ${recapData?.target_gilingan || 0} Gilingan`,
      `Penyusun Laporan : ${operatorName || 'Ayu (PPIC)'}`,
      `Waktu Ekspor     : ${new Date().toLocaleTimeString('id-ID')} WIB`
    ],
    columns: [
      { header: 'Divisi', key: 'divisi', width: 170, align: 'left' },
      { header: 'Satuan', key: 'satuan', width: 70, align: 'center' },
      { header: 'Target', key: 'diterbitkan', width: 85, align: 'right' },
      { header: 'Total Kuantitas', key: 'total_qty', width: 95, align: 'right' },
      { header: 'Terkirim / Selesai', key: 'terkirim', width: 110, align: 'right' },
      { header: 'Sisa Belum Dibuat', key: 'sisa_qr', width: 110, align: 'right' },
      { header: 'Batal (VOID)', key: 'void_qr', width: 90, align: 'right' },
      { header: 'Reject', key: 'reject', width: 70, align: 'right' },
      { header: 'Alasan Reject', key: 'reject_notes', width: 180, align: 'left' },
      { header: 'Catatan Operasional', key: 'catatan', width: 220, align: 'left' }
    ],
    data: divRows,
    totals: {
      label: 'TOTAL REJECT',
      values: {
        reject: totalReject
      }
    }
  })
}

/**
 * Ekspor Penerimaan Barang Supplier Luar ke Excel
 */
export function exportSupplierInboundExcel({ dateStr, inboundList, operatorName }) {
  const rows = (inboundList || []).map((item, idx) => ({
    no: idx + 1,
    tanggal_masuk: item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : '-'),
    kategori: item.category || '-',
    nama_barang: item.item_name || '-',
    jumlah: Number(item.quantity) || 0,
    satuan: item.unit || '-',
    supplier: item.supplier_name || '-',
    no_surat_jalan: item.document_no || '-',
    catatan: item.notes || '-',
    diterima_oleh: item.received_by || '-'
  }))

  const totalQty = rows.reduce((acc, r) => acc + r.jumlah, 0)
  const safeDateStr = (dateStr || 'HariIni')
    .replace(/\s*s\/d\s*/gi, '_sd_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')

  downloadExcelXml({
    fileName: `Barang_Masuk_Supplier_${safeDateStr}.xls`,
    sheetName: 'Inbound Supplier',
    title: 'PT MAKAN DIMSUM INDONESIA - PENERIMAAN BARANG SUPPLIER LUAR',
    subtitles: [
      `Tanggal / Periode: ${dateStr || new Date().toISOString().split('T')[0]}`,
      `Petugas Logistik : ${operatorName || 'Ayu (PPIC)'}`,
      `Waktu Ekspor     : ${new Date().toLocaleTimeString('id-ID')} WIB`
    ],
    columns: [
      { header: 'No', key: 'no', width: 40, align: 'center' },
      { header: 'Tanggal Masuk', key: 'tanggal_masuk', width: 110, align: 'center' },
      { header: 'Kategori', key: 'kategori', width: 90, align: 'center' },
      { header: 'Nama Barang', key: 'nama_barang', width: 180, align: 'left' },
      { header: 'Jumlah', key: 'jumlah', width: 75, align: 'right' },
      { header: 'Satuan', key: 'satuan', width: 70, align: 'center' },
      { header: 'Nama Supplier', key: 'supplier', width: 150, align: 'left' },
      { header: 'No. Surat Jalan', key: 'no_surat_jalan', width: 140, align: 'left' },
      { header: 'Catatan Fisik', key: 'catatan', width: 160, align: 'left' },
      { header: 'Penerima', key: 'diterima_oleh', width: 100, align: 'center' }
    ],
    data: rows,
    totals: {
      label: 'TOTAL KUANTITAS',
      values: {
        jumlah: totalQty
      }
    }
  })
}

/**
 * Ekspor Data Lot Per Divisi (Daging, Bumbu, Kulit, Saos)
 */
export function exportStationLotsExcel({ stationName, divisionCode, dateStr, lots, operatorName }) {
  const rows = (lots || []).map((lot, idx) => ({
    no: idx + 1,
    kode_lot: lot.lot_qr_code,
    tipe: lot.lot_type || divisionCode,
    status: lot.current_status || '-',
    stasiun: lot.current_station || '-',
    kuantitas: Number(lot.quantity) || 0,
    satuan: lot.unit || '-'
  }))

  const totalQty = rows.reduce((acc, r) => acc + r.kuantitas, 0)

  downloadExcelXml({
    fileName: `Laporan_Lot_${divisionCode}_${dateStr || 'HariIni'}.xls`,
    sheetName: divisionCode,
    title: `PT MAKAN DIMSUM INDONESIA - LAPORAN ${stationName.toUpperCase()}`,
    subtitles: [
      `Bagian           : ${stationName}`,
      `Tanggal          : ${dateStr || new Date().toISOString().split('T')[0]}`,
      `Petugas / PIC    : ${operatorName || 'PIC Lapangan'}`,
      `Waktu Ekspor     : ${new Date().toLocaleTimeString('id-ID')} WIB`
    ],
    columns: [
      { header: 'No', key: 'no', width: 40, align: 'center' },
      { header: 'Kode Barcode (QR)', key: 'kode_lot', width: 150, align: 'center' },
      { header: 'Jenis Barang', key: 'tipe', width: 120, align: 'center' },
      { header: 'Status Terakhir', key: 'status', width: 180, align: 'left' },
      { header: 'Lokasi Stasiun', key: 'stasiun', width: 140, align: 'left' },
      { header: 'Kuantitas', key: 'kuantitas', width: 85, align: 'right' },
      { header: 'Satuan', key: 'satuan', width: 70, align: 'center' }
    ],
    data: rows,
    totals: {
      label: `TOTAL ${rows.length} LOT`,
      values: {
        kuantitas: totalQty
      }
    }
  })
}

/**
 * Ekspor Laporan Komprehensif PPIC ke Excel (Multi-sheet: Rincian & Ringkasan)
 * Mendukung format: Barang Masuk, Barang Keluar, Inventory (Stok), dan Semua Mutasi.
 * Fitur:
 * - Dua sheet terstruktur: "Rincian" & "Ringkasan"
 * - Header tabel dibekukan (Freeze Panes)
 * - AutoFilter aktif pada baris kolom
 * - Tanggal asli (DateTime type) format DD/MM/YYYY & Angka asli (Number type)
 * - Metadata lengkap (WIB, Penyusun, Filter)
 */
export function exportPpicCustomExcel({
  reportType = 'INBOUND', // 'INBOUND' | 'OUTBOUND' | 'INVENTORY' | 'ALL'
  dateFrom,
  dateTo,
  categoryFilter = 'ALL',
  supplierFilter = '',
  inboundItems = [],
  outboundItems = [],
  inventoryItems = [],
  operatorName = 'Ayu (PPIC)'
}) {
  const isRange = dateFrom && dateTo && dateFrom !== dateTo
  const dateFromStr = dateFrom || new Date().toISOString().slice(0, 10)
  const dateToStr = dateTo || dateFromStr
  const safeFrom = dateFromStr.replace(/[^0-9-]/g, '')
  const safeTo = dateToStr.replace(/[^0-9-]/g, '')

  let reportTitle
  let filePrefix
  if (reportType === 'INBOUND') {
    reportTitle = 'LAPORAN BARANG MASUK (INBOUND SUPPLIER)'
    filePrefix = 'Barang-Masuk'
  } else if (reportType === 'OUTBOUND') {
    reportTitle = 'LAPORAN BARANG KELUAR (OUTBOUND LOGISTIK PPIC)'
    filePrefix = 'Barang-Keluar'
  } else if (reportType === 'INVENTORY') {
    reportTitle = 'LAPORAN REKONSILIASI STOK & INVENTORY'
    filePrefix = 'Inventory-Stok'
  } else {
    reportTitle = 'LAPORAN MUTASI KESELURUHAN (MASUK & KELUAR)'
    filePrefix = 'Mutasi-Semua'
  }

  const fileName = isRange
    ? `${filePrefix}_${safeFrom}_sd_${safeTo}.xlsx`
    : `${filePrefix}_${safeFrom}.xlsx`

  const periodSubtitle = isRange
    ? `Periode Transaksi : ${dateFromStr} s/d ${dateToStr} (WIB)`
    : `Tanggal Transaksi : ${dateFromStr} (WIB)`
  const catSubtitle = `Filter Kategori   : ${categoryFilter && categoryFilter !== 'ALL' ? categoryFilter : 'Semua Kategori'}`
  const supSubtitle = supplierFilter ? `Filter Supplier   : ${supplierFilter}` : 'Filter Supplier   : Semua Supplier'
  const timeSubtitle = `Waktu Ekspor      : ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')} WIB (${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})`
  const picSubtitle = `Petugas PPIC      : ${operatorName || 'Ayu (PPIC)'}`

  const subtitles = [periodSubtitle, catSubtitle, supSubtitle, picSubtitle, timeSubtitle]

  // Setup Kolom Sheet Rincian
  let detailCols = []
  let detailRows = []
  let totalQty = 0

  if (reportType === 'INBOUND') {
    detailCols = [
      { header: 'No', width: 45, align: 'center' },
      { header: 'Tanggal', width: 105, align: 'date' },
      { header: 'Jam', width: 75, align: 'center' },
      { header: 'Nama Barang', width: 220, align: 'left-bold' },
      { header: 'Kategori', width: 100, align: 'center' },
      { header: 'Qty', width: 85, align: 'number' },
      { header: 'Satuan', width: 70, align: 'center' },
      { header: 'Nama Supplier', width: 170, align: 'left' },
      { header: 'No. SJ (Surat Jalan)', width: 150, align: 'left' },
      { header: 'Kode Lot / Batch', width: 160, align: 'center' },
      { header: 'Tanggal Kadaluwarsa', width: 130, align: 'center' },
      { header: 'Penerima', width: 110, align: 'center' },
      { header: 'Catatan Fisik', width: 170, align: 'left' },
      { header: 'Status Verifikasi', width: 120, align: 'center' }
    ]

    detailRows = (inboundItems || []).map((item, idx) => {
      const dStr = item.inbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : dateFromStr)
      let timeStr = '-'
      if (item.created_at) {
        try {
          const raw = String(item.created_at)
          const norm = raw.endsWith('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z'
          const d = new Date(norm)
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') + ' WIB'
          }
        } catch {
          // ignore
        }
      }
      const numQty = Number(item.quantity) || 0
      totalQty += numQty

      return {
        c0: { type: 'number', val: idx + 1, align: 'center' },
        c1: { type: 'date', val: dStr, align: 'center' },
        c2: { type: 'string', val: timeStr, align: 'center' },
        c3: { type: 'string', val: item.item_name, align: 'left-bold' },
        c4: { type: 'string', val: item.category, align: 'center' },
        c5: { type: 'number', val: numQty, align: 'right' },
        c6: { type: 'string', val: item.unit, align: 'center' },
        c7: { type: 'string', val: item.supplier_name || '-', align: 'left' },
        c8: { type: 'string', val: item.document_no || '-', align: 'left' },
        c9: { type: 'string', val: item.lot_code || item.lot_qr_code || '-', align: 'center' },
        c10: { type: 'string', val: '-', align: 'center' }, // DB belum ada field kadaluwarsa
        c11: { type: 'string', val: item.received_by || 'PPIC', align: 'center' },
        c12: { type: 'string', val: item.notes || '-', align: 'left' },
        c13: { type: 'string', val: item.verification_status || 'Terverifikasi', align: 'center' }
      }
    })
  } else if (reportType === 'OUTBOUND') {
    detailCols = [
      { header: 'No', width: 45, align: 'center' },
      { header: 'Tanggal', width: 105, align: 'date' },
      { header: 'Jam', width: 75, align: 'center' },
      { header: 'Nama Barang', width: 220, align: 'left-bold' },
      { header: 'Kategori', width: 100, align: 'center' },
      { header: 'Qty Keluar', width: 95, align: 'number' },
      { header: 'Satuan', width: 70, align: 'center' },
      { header: 'Tujuan / Stasiun Pemakai', width: 190, align: 'left' },
      { header: 'Kode Lot / QR Keluar', width: 160, align: 'center' },
      { header: 'Petugas Pengeluar', width: 120, align: 'center' },
      { header: 'Catatan Keperluan', width: 180, align: 'left' },
      { header: 'Status Verifikasi', width: 120, align: 'center' }
    ]

    detailRows = (outboundItems || []).map((item, idx) => {
      const dStr = item.outbound_date || (item.created_at ? String(item.created_at).slice(0, 10) : dateFromStr)
      let timeStr = '-'
      if (item.created_at) {
        try {
          const raw = String(item.created_at)
          const norm = raw.endsWith('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z'
          const d = new Date(norm)
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') + ' WIB'
          }
        } catch {
          // ignore
        }
      }
      const numQty = Number(item.quantity) || 0
      totalQty += numQty

      return {
        c0: { type: 'number', val: idx + 1, align: 'center' },
        c1: { type: 'date', val: dStr, align: 'center' },
        c2: { type: 'string', val: timeStr, align: 'center' },
        c3: { type: 'string', val: item.item_name, align: 'left-bold' },
        c4: { type: 'string', val: item.category, align: 'center' },
        c5: { type: 'number', val: numQty, align: 'right' },
        c6: { type: 'string', val: item.unit, align: 'center' },
        c7: { type: 'string', val: item.target_station_name || item.target_station || 'Keluar Umum', align: 'left' },
        c8: { type: 'string', val: item.lot_qr_code || '-', align: 'center' },
        c9: { type: 'string', val: item.dispatched_by || 'PPIC', align: 'center' },
        c10: { type: 'string', val: item.notes || '-', align: 'left' },
        c11: { type: 'string', val: 'Terverifikasi', align: 'center' }
      }
    })
  } else if (reportType === 'INVENTORY') {
    detailCols = [
      { header: 'No', width: 45, align: 'center' },
      { header: 'Kategori', width: 100, align: 'center' },
      { header: 'Nama Barang', width: 220, align: 'left-bold' },
      { header: 'Satuan', width: 70, align: 'center' },
      { header: 'Stok Awal', width: 95, align: 'number' },
      { header: 'Total Masuk', width: 95, align: 'number' },
      { header: 'Total Keluar', width: 95, align: 'number' },
      { header: 'Sisa Stok Akhir', width: 105, align: 'number' },
      { header: 'Supplier Terkait', width: 200, align: 'left' }
    ]

    detailRows = (inventoryItems || []).map((inv, idx) => {
      const akhir = Number(inv.stok_akhir) || 0
      totalQty += akhir

      return {
        c0: { type: 'number', val: idx + 1, align: 'center' },
        c1: { type: 'string', val: inv.category, align: 'center' },
        c2: { type: 'string', val: inv.item_name, align: 'left-bold' },
        c3: { type: 'string', val: inv.unit, align: 'center' },
        c4: { type: 'number', val: Number(inv.stok_awal) || 0, align: 'right' },
        c5: { type: 'number', val: Number(inv.masuk) || 0, align: 'right' },
        c6: { type: 'number', val: Number(inv.keluar) || 0, align: 'right' },
        c7: { type: 'number', val: akhir, align: 'right' },
        c8: { type: 'string', val: inv.suppliers || '-', align: 'left' }
      }
    })
  } else {
    // ALL / SEMUA MUTASI
    detailCols = [
      { header: 'No', width: 45, align: 'center' },
      { header: 'Tanggal', width: 105, align: 'date' },
      { header: 'Jam', width: 75, align: 'center' },
      { header: 'Mutasi', width: 85, align: 'center' },
      { header: 'Nama Barang', width: 220, align: 'left-bold' },
      { header: 'Kategori', width: 100, align: 'center' },
      { header: 'Qty', width: 85, align: 'number' },
      { header: 'Satuan', width: 70, align: 'center' },
      { header: 'Pihak Terkait (Supplier / Stasiun)', width: 190, align: 'left' },
      { header: 'Dokumen / Kode Lot', width: 160, align: 'center' },
      { header: 'Petugas PIC', width: 110, align: 'center' },
      { header: 'Catatan', width: 170, align: 'left' },
      { header: 'Status Verifikasi', width: 120, align: 'center' }
    ]

    const combined = []
    ;(inboundItems || []).forEach((it) => {
      combined.push({
        _type: 'MASUK',
        _date: it.inbound_date || String(it.created_at).slice(0, 10),
        _rawTime: it.created_at,
        _item: it
      })
    })
    ;(outboundItems || []).forEach((ot) => {
      combined.push({
        _type: 'KELUAR',
        _date: ot.outbound_date || String(ot.created_at).slice(0, 10),
        _rawTime: ot.created_at,
        _item: ot
      })
    })

    // Urutkan terbaru dulu
    combined.sort((a, b) => {
      const tA = new Date(a._rawTime || a._date).getTime() || 0
      const tB = new Date(b._rawTime || b._date).getTime() || 0
      return tB - tA
    })

    detailRows = combined.map((entry, idx) => {
      const it = entry._item
      const isMasuk = entry._type === 'MASUK'
      let timeStr = '-'
      if (it.created_at) {
        try {
          const raw = String(it.created_at)
          const norm = raw.endsWith('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z'
          const d = new Date(norm)
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') + ' WIB'
          }
        } catch {
          // ignore
        }
      }
      const numQty = Number(it.quantity) || 0
      totalQty += isMasuk ? numQty : -numQty

      return {
        c0: { type: 'number', val: idx + 1, align: 'center' },
        c1: { type: 'date', val: entry._date, align: 'center' },
        c2: { type: 'string', val: timeStr, align: 'center' },
        c3: { type: 'string', val: entry._type, align: 'center' },
        c4: { type: 'string', val: it.item_name, align: 'left-bold' },
        c5: { type: 'string', val: it.category, align: 'center' },
        c6: { type: 'number', val: numQty, align: 'right' },
        c7: { type: 'string', val: it.unit, align: 'center' },
        c8: { type: 'string', val: isMasuk ? (it.supplier_name || '-') : (it.target_station_name || it.target_station || 'Keluar Umum'), align: 'left' },
        c9: { type: 'string', val: isMasuk ? (it.document_no || it.lot_code || '-') : (it.lot_qr_code || '-'), align: 'center' },
        c10: { type: 'string', val: isMasuk ? (it.received_by || 'PPIC') : (it.dispatched_by || 'PPIC'), align: 'center' },
        c11: { type: 'string', val: it.notes || '-', align: 'left' },
        c12: { type: 'string', val: 'Terverifikasi', align: 'center' }
      }
    })
  }

  // Siapkan Agregasi Ringkasan
  const bySupplier = {}
  ;(inboundItems || []).forEach((it) => {
    const s = it.supplier_name || 'Tanpa Supplier'
    if (!bySupplier[s]) bySupplier[s] = { count: 0, total_qty: 0 }
    bySupplier[s].count += 1
    bySupplier[s].total_qty += Number(it.quantity) || 0
  })

  const byItem = {}
  const allSource = reportType === 'INBOUND' ? inboundItems : reportType === 'OUTBOUND' ? outboundItems : reportType === 'INVENTORY' ? inventoryItems : [...inboundItems, ...outboundItems]
  allSource.forEach((it) => {
    const name = it.item_name
    const unit = it.unit
    const k = `${name} (${unit})`
    if (!byItem[k]) {
      byItem[k] = { name, unit, category: it.category, total_qty: 0, count: 0 }
    }
    const q = Number(reportType === 'INVENTORY' ? it.stok_akhir : it.quantity) || 0
    byItem[k].total_qty += q
    byItem[k].count += 1
  })

  // Bangun XML SpreadsheetML Multi-sheet
  const totalCols = Math.max(detailCols.length, 6)
  const headerRowIdx = 3 + subtitles.length + 1 // 1 title + subtitles.length + 1 empty space + 1 = baris header

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="CompanyKop">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#E9ECEF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Color="#2C3E50" ss:Bold="1"/>
   <Interior ss:Color="#F5F1EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#495057" ss:Italic="1"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2C3E50"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#3A6B80" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
  </Style>
  <Style ss:ID="DataLeftBold">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B" ss:Bold="1"/>
  </Style>
  <Style ss:ID="DataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
  </Style>
  <Style ss:ID="DataDate">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
   <NumberFormat ss:Format="dd/mm/yyyy"/>
  </Style>
  <Style ss:ID="DataNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#212529"/>
   <NumberFormat ss:Format="#,##0.##"/>
  </Style>
  <Style ss:ID="TotalRowLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#3A6B80"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#F5F1EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalRowNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#3A6B80"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#3A6B80"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E3A5F" ss:Bold="1"/>
   <Interior ss:Color="#F5F1EB" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.##"/>
  </Style>
  <Style ss:ID="SummarySectionHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#3A6B80" ss:Pattern="Solid"/>
  </Style>
 </Styles>
`

  // 1. SHEET 1: RINCIAN
  xml += ` <Worksheet ss:Name="Rincian">
  <Table ss:DefaultRowHeight="20">
`
  // Lebar kolom
  detailCols.forEach((col) => {
    xml += `   <Column ss:AutoFitWidth="0" ss:Width="${col.width || 120}"/>\n`
  })

  // Kop PT & Judul Laporan
  xml += `   <Row ss:Height="26">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="CompanyKop">
     <Data ss:Type="String">PT MAKAN DIMSUM INDONESIA</Data>
    </Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="ReportTitle">
     <Data ss:Type="String">${escapeXml(reportTitle)}</Data>
    </Cell>
   </Row>\n`

  // Subtitle Metadata
  subtitles.forEach((sub) => {
    xml += `   <Row ss:Height="18">
    <Cell ss:MergeAcross="${totalCols - 1}" ss:StyleID="MetaLabel">
     <Data ss:Type="String">${escapeXml(sub)}</Data>
    </Cell>
   </Row>\n`
  })

  // Jarak Baris Kosong
  xml += `   <Row ss:Height="10"/>\n`

  // Baris Header Tabel
  xml += `   <Row ss:Height="26">\n`
  detailCols.forEach((col) => {
    xml += `    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>\n`
  })
  xml += `   </Row>\n`

  // Baris Data Transaksi Rincian
  detailRows.forEach((row) => {
    xml += `   <Row ss:Height="22">\n`
    detailCols.forEach((_, cIdx) => {
      const cellObj = row[`c${cIdx}`]
      if (!cellObj) {
        xml += `    <Cell ss:StyleID="DataCenter"><Data ss:Type="String">-</Data></Cell>\n`
        return
      }

      if (cellObj.type === 'date') {
        const valStr = String(cellObj.val || '')
        // Simpan sebagai DateTime ISO untuk Excel Date formatting asli
        const iso = valStr ? `${valStr}T00:00:00.000` : ''
        if (iso) {
          xml += `    <Cell ss:StyleID="DataDate"><Data ss:Type="DateTime">${iso}</Data></Cell>\n`
        } else {
          xml += `    <Cell ss:StyleID="DataCenter"><Data ss:Type="String">-</Data></Cell>\n`
        }
      } else if (cellObj.type === 'number') {
        xml += `    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${cellObj.val}</Data></Cell>\n`
      } else {
        const styleId = cellObj.align === 'left-bold' ? 'DataLeftBold' : cellObj.align === 'left' ? 'DataLeft' : 'DataCenter'
        xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(cellObj.val !== undefined && cellObj.val !== null ? cellObj.val : '-')}</Data></Cell>\n`
      }
    })
    xml += `   </Row>\n`
  })

  // Baris Total di Bawah Rincian
  if (detailRows.length > 0) {
    xml += `   <Row ss:Height="24">\n`
    detailCols.forEach((col, cIdx) => {
      if (cIdx === 0) {
        xml += `    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String">TOTAL (${detailRows.length} Baris)</Data></Cell>\n`
      } else if (col.align === 'number' && (col.header.includes('Qty') || col.header.includes('Akhir'))) {
        xml += `    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${totalQty}</Data></Cell>\n`
      } else {
        xml += `    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String"></Data></Cell>\n`
      }
    })
    xml += `   </Row>\n`
  }

  xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>${headerRowIdx}</SplitHorizontal>
   <TopRowBottomPane>${headerRowIdx}</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
  <AutoFilter x:Range="R${headerRowIdx}C1:R${headerRowIdx}C${detailCols.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
 </Worksheet>\n`

  // 2. SHEET 2: RINGKASAN
  xml += ` <Worksheet ss:Name="Ringkasan">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="45"/>
   <Column ss:Width="110"/>
   <Column ss:Width="230"/>
   <Column ss:Width="105"/>
   <Column ss:Width="75"/>
   <Column ss:Width="105"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="5" ss:StyleID="CompanyKop">
     <Data ss:Type="String">PT MAKAN DIMSUM INDONESIA</Data>
    </Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="ReportTitle">
     <Data ss:Type="String">RINGKASAN EKSEKUTIF &amp; AKUMULASI TRANSAKSI</Data>
    </Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="MetaLabel">
     <Data ss:Type="String">${escapeXml(periodSubtitle)}</Data>
    </Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="5" ss:StyleID="MetaLabel">
     <Data ss:Type="String">${escapeXml(timeSubtitle)}</Data>
    </Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- Seksi 1: Akumulasi Per Barang -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="SummarySectionHeader">
     <Data ss:Type="String">A. RINGKASAN TOTAL KUANTITAS PER BARANG</Data>
    </Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">No</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Kategori</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama Barang</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Kuantitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Satuan</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Frekuensi</Data></Cell>
   </Row>\n`

  const itemList = Object.values(byItem)
  let sumItemQty = 0
  itemList.forEach((item, idx) => {
    sumItemQty += item.total_qty
    xml += `   <Row ss:Height="22">
    <Cell ss:StyleID="DataCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="DataCenter"><Data ss:Type="String">${escapeXml(item.category || '-')}</Data></Cell>
    <Cell ss:StyleID="DataLeftBold"><Data ss:Type="String">${escapeXml(item.name)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${item.total_qty}</Data></Cell>
    <Cell ss:StyleID="DataCenter"><Data ss:Type="String">${escapeXml(item.unit)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${item.count}</Data></Cell>
   </Row>\n`
  })

  xml += `   <Row ss:Height="24">
    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String">${itemList.length} Jenis Barang</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${sumItemQty}</Data></Cell>
    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${detailRows.length}</Data></Cell>
   </Row>
   <Row ss:Height="14"/>\n`

  // Seksi 2: Akumulasi Per Supplier (jika ada data supplier)
  const supList = Object.entries(bySupplier)
  if (supList.length > 0) {
    let sumSupQty = 0
    xml += `   <Row ss:Height="24">
    <Cell ss:MergeAcross="5" ss:StyleID="SummarySectionHeader">
     <Data ss:Type="String">B. RINGKASAN PENERIMAAN PER SUPPLIER</Data>
    </Cell>
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">No</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TableHeader"><Data ss:Type="String">Nama Supplier</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Kuantitas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah Surat Jalan</Data></Cell>
   </Row>\n`

    supList.forEach(([supName, stat], idx) => {
      sumSupQty += stat.total_qty
      xml += `   <Row ss:Height="22">
    <Cell ss:StyleID="DataCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="DataLeftBold"><Data ss:Type="String">${escapeXml(supName)}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${stat.total_qty}</Data></Cell>
    <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${stat.count}</Data></Cell>
   </Row>\n`
    })

    xml += `   <Row ss:Height="24">
    <Cell ss:StyleID="TotalRowLeft"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TotalRowLeft"><Data ss:Type="String">${supList.length} Supplier</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${sumSupQty}</Data></Cell>
    <Cell ss:StyleID="TotalRowNumber"><Data ss:Type="Number">${detailRows.length}</Data></Cell>
   </Row>\n`
  }

  xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <ProtectObjects>False</ProtectObjects>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`

  // Trigger Download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { fileName, blob, xml }
}
