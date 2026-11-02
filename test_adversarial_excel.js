import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 1. Mock Browser Environment for zero-dependency export testing
let lastExport = { xml: '', fileName: '' };

globalThis.Blob = class {
  constructor(content, options) {
    this.content = content.join('');
    this.type = options?.type;
  }
};

globalThis.URL = {
  createObjectURL: (blob) => {
    lastExport.xml = blob.content;
    return 'blob:mock-url';
  },
  revokeObjectURL: () => {}
};

globalThis.document = {
  createElement: () => ({
    click: () => {},
    set href(v) {},
    set download(name) { lastExport.fileName = name; }
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// 2. Import Excel Export Utilities
import {
  downloadExcelXml,
  exportPpicRecapExcel,
  exportSupplierInboundExcel,
  exportStationLotsExcel
} from './src/utils/excelExport.js';

console.log('=== STARTING ADVERSARIAL EXCEL EXPORT TESTS ===');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failCount++;
    throw new Error(message);
  } else {
    console.log(`[PASS] ${message}`);
    passCount++;
  }
}

// ----------------------------------------------------------------------------
// TEST 1: Stress-test XML Special Characters in downloadExcelXml
// ----------------------------------------------------------------------------
console.log('\n--- Test 1: Special XML Characters in Generic Exporter ---');
lastExport = { xml: '', fileName: '' };

downloadExcelXml({
  fileName: 'Adversarial_Test_<1>&"2".xls',
  sheetName: 'Sheet <1> & "2"',
  title: 'PT MAKAN DIMSUM INDONESIA <TEST & "SPECIAL">',
  subtitles: [
    'Subtitle with <xml> & "quotes" and \'apostrophe\'',
    'Formula injection test: =SUM(A1:A10) & <tag>',
    null,
    undefined
  ],
  columns: [
    { header: 'Col <1> & "A"', key: 'col1', width: 100, align: 'left' },
    { header: 'Col 2 (Numbers)', key: 'col2', width: 80, align: 'right' }
  ],
  data: [
    { col1: 'Value with <script>alert("xss")</script> & O\'Reilly', col2: 123.45 },
    { col1: null, col2: null },
    { col1: undefined, col2: undefined },
    { col1: 'Text with Ampersand & <brackets> & "quotes"', col2: 0 },
    { col1: '', col2: -42.5 }
  ],
  totals: {
    label: 'TOTAL <SUMMARY & "CHECK">',
    values: {
      col2: 80.95
    }
  }
});

assert(lastExport.xml.length > 0, 'XML string was generated');
assert(lastExport.xml.includes('&amp;'), 'Ampersands are escaped');
assert(lastExport.xml.includes('&lt;script&gt;'), '<script> tag is escaped');
assert(!lastExport.xml.includes('<script>'), 'Unescaped <script> tag does NOT exist');
assert(lastExport.xml.includes('&quot;'), 'Double quotes are escaped');
assert(lastExport.xml.includes('&apos;'), 'Single quotes are escaped');
assert(lastExport.xml.includes('TOTAL &lt;SUMMARY &amp; &quot;CHECK&quot;&gt;'), 'Total row label is properly escaped');

// Check null handling
assert(!lastExport.xml.includes('<Data ss:Type="String">null</Data>'), 'Null values do NOT render literal "null"');
assert(!lastExport.xml.includes('<Data ss:Type="String">undefined</Data>'), 'Undefined values do NOT render literal "undefined"');

// ----------------------------------------------------------------------------
// TEST 2: Stress-test exportPpicRecapExcel with special characters & nulls
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: exportPpicRecapExcel Adversarial Inputs ---');
lastExport = { xml: '', fileName: '' };

const adversarialRecap = {
  target_gilingan: 40,
  divisions: {
    DAGING: {
      unit: 'KG',
      total_lots: 40,
      total_quantity: 800.0,
      completed_count: 40,
      reject_count: 5,
      reject_notes: 'Daging <grade B> & berurat parah "batch 2"',
      operational_notes: 'Mixer <#1> overheat & mati mendadak'
    },
    BUMBU: {
      unit: 'PORSI',
      total_lots: 2,
      total_quantity: 40.0,
      completed_count: 2,
      reject_count: 0,
      reject_notes: null,
      operational_notes: undefined
    },
    KULIT: null, // completely null division
    SAOS: undefined,
    CETAK: {
      reject_count: 12,
      reject_notes: 'Kulit < 9cm & robek',
      operational_notes: 'Operator baru; perlu training'
    },
    PACKING: {
      reject_count: 3,
      reject_notes: 'Vakum bocor > 2%',
      operational_notes: 'Ganti plastik roll'
    }
  }
};

exportPpicRecapExcel({
  dateStr: '2026-10-20 s/d 2026-10-25',
  recapData: adversarialRecap,
  operatorName: 'Ayu & Staff <PPIC>'
});

assert(lastExport.fileName === 'Rekap_PPIC_Pabrik_2026-10-20_sd_2026-10-25.xls', `Filename sanitized cleanly: ${lastExport.fileName}`);
assert(lastExport.xml.includes('2026-10-20 s/d 2026-10-25'), 'Period string preserved in subtitle');
assert(lastExport.xml.includes('Ayu &amp; Staff &lt;PPIC&gt;'), 'Operator name escaped');
assert(lastExport.xml.includes('Daging &lt;grade B&gt; &amp; berurat parah &quot;batch 2&quot;'), 'Daging reject notes escaped');
assert(lastExport.xml.includes('Vakum bocor &gt; 2%'), 'Greater-than in packing notes escaped');

// ----------------------------------------------------------------------------
// TEST 3: Stress-test exportSupplierInboundExcel with adversarial inbound items
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: exportSupplierInboundExcel Adversarial Inputs ---');
lastExport = { xml: '', fileName: '' };

const adversarialInboundList = [
  {
    inbound_id: 1,
    inbound_date: '2026-10-25',
    category: 'KULIT & TEPUNG',
    item_name: 'Kulit Dimsum 9cm <Special> & Grade "A"',
    quantity: 50.5,
    unit: 'BAL',
    supplier_name: 'CV "Sumber & Rezeki" <Pusat>',
    document_no: 'SJ/2026/10/<001>&EXP',
    notes: 'Kondisi fisik: Suhu < 4°C & segel utuh',
    received_by: 'Ayu (PPIC) & Opr'
  },
  {
    // Completely null / empty entry
    inbound_id: 2,
    inbound_date: null,
    category: null,
    item_name: null,
    quantity: null,
    unit: null,
    supplier_name: null,
    document_no: null,
    notes: null,
    received_by: null
  }
];

exportSupplierInboundExcel({
  dateStr: '2026-10-01 s/d 2026-10-31',
  inboundList: adversarialInboundList,
  operatorName: 'Ayu & Budi'
});

assert(lastExport.fileName === 'Barang_Masuk_Supplier_2026-10-01_sd_2026-10-31.xls', `Inbound filename sanitized: ${lastExport.fileName}`);
assert(lastExport.xml.includes('Kulit Dimsum 9cm &lt;Special&gt; &amp; Grade &quot;A&quot;'), 'Item name special chars escaped');
assert(lastExport.xml.includes('CV &quot;Sumber &amp; Rezeki&quot; &lt;Pusat&gt;'), 'Supplier name special chars escaped');
assert(lastExport.xml.includes('SJ/2026/10/&lt;001&gt;&amp;EXP'), 'Document no special chars escaped');
assert(lastExport.xml.includes('Suhu &lt; 4°C &amp; segel utuh'), 'Notes special chars escaped');

// Save the XML outputs for XML parser validation
fs.writeFileSync('recap_adversarial.xml', lastExport.xml, 'utf8');

console.log(`\n=== ALL EXCEL EXPORT JS TESTS COMPLETED: ${passCount} PASSED, ${failCount} FAILED ===\n`);
