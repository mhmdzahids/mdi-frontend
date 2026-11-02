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
}

/**
 * Ekspor Rekap Harian PPIC ke Excel
 */
export function exportPpicRecapExcel({ dateStr, recapData, operatorName }) {
  const divisions = recapData?.divisions || {}
  const divRows = [
    {
      divisi: 'Daging (Giling & Mix)',
      satuan: divisions.DAGING?.unit || 'KG',
      diterbitkan: divisions.DAGING?.total_lots || 0,
      total_qty: divisions.DAGING?.total_quantity || 0,
      terkirim: divisions.DAGING?.completed_count || 0,
      reject: divisions.DAGING?.reject_count || 0,
      reject_notes: divisions.DAGING?.reject_notes || '-',
      catatan: divisions.DAGING?.operational_notes || '-'
    },
    {
      divisi: 'Bumbu Sparta',
      satuan: divisions.BUMBU?.unit || 'PORSI',
      diterbitkan: divisions.BUMBU?.total_lots || 0,
      total_qty: divisions.BUMBU?.total_quantity || 0,
      terkirim: divisions.BUMBU?.completed_count || 0,
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
      reject: divisions.SAOS?.reject_count || 0,
      reject_notes: divisions.SAOS?.reject_notes || '-',
      catatan: divisions.SAOS?.operational_notes || '-'
    },
    {
      divisi: 'Meja Cetak',
      satuan: 'PCS',
      diterbitkan: '-',
      total_qty: '-',
      terkirim: '-',
      reject: divisions.CETAK?.reject_count || 0,
      reject_notes: divisions.CETAK?.reject_notes || '-',
      catatan: divisions.CETAK?.operational_notes || '-'
    },
    {
      divisi: 'Meja Packing',
      satuan: 'PACK',
      diterbitkan: '-',
      total_qty: '-',
      terkirim: '-',
      reject: divisions.PACKING?.reject_count || 0,
      reject_notes: divisions.PACKING?.reject_notes || '-',
      catatan: divisions.PACKING?.operational_notes || '-'
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
      { header: 'Lot Dibuat', key: 'diterbitkan', width: 85, align: 'right' },
      { header: 'Total Kuantitas', key: 'total_qty', width: 95, align: 'right' },
      { header: 'Terkirim / Selesai', key: 'terkirim', width: 110, align: 'right' },
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
