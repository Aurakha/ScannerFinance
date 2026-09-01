import { Transaction, UserProfile } from '@/types';
import { formatDateOnly, formatRupiah } from './formatters';
import { Platform } from 'react-native';

export interface CompanyReportOptions {
  profile?: UserProfile;
}

/**
 * Mengelompokkan kategori ke kolom form klaim kantor (Operational, Pantry, Fasilitas, Lain-Lain)
 */
export function categorizeColumn(catNameRaw: string): 'operational' | 'pantry' | 'fasilitas' | 'lainlain' {
  const cat = (catNameRaw || '').toLowerCase();
  if (cat.includes('pantry') || cat.includes('makan') || cat.includes('minum') || cat.includes('konsumsi') || cat.includes('kopi') || cat.includes('gula') || cat.includes('air')) {
    return 'pantry';
  }
  if (cat.includes('fasilitas') || cat.includes('kebersihan') || cat.includes('kesehatan') || cat.includes('sapu') || cat.includes('pel') || cat.includes('alat') || cat.includes('kantor') || cat.includes('sabun') || cat.includes('tissue') || cat.includes('pembersih') || cat.includes('toilet') || cat.includes('ikan') || cat.includes('wifi') || cat.includes('internet')) {
    return 'fasilitas';
  }
  if (cat.includes('lain') || cat.includes('buku') || cat.includes('pendidikan') || cat.includes('jasa') || cat.includes('reimburs') || cat.includes('meeting')) {
    return 'lainlain';
  }
  return 'operational';
}

/**
 * Membuat Dokumen HTML & XML Siap Cetak (Print to PDF / Spreadsheet Format)
 * 100% PERSIS dengan template Google Spreadsheet:
 * "Finance Formulir SKA Period Agustus 2026"
 */
export function generatePrintableReportHTML(
  transactions: Transaction[],
  profile?: UserProfile
): string {
  const companyName = profile?.company_name || 'PT. San Kawan Abadi';
  const employeeName = profile?.full_name || 'Gabriel Rudra Renata';
  const department = profile?.department || 'Operation';
  const reportDate = profile?.submission_date || '1 Agustus 2026';
  const projectName = profile?.project_name || 'Head Office';
  const city = profile?.city || 'Tangerang';
  const verifierName = profile?.verifier_name || 'Yunitha';
  const approverName = profile?.approver_name || 'Dwi Hartanto';
  const cashAdvance = Number(profile?.cash_advance_amount) || 7117500;

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  let rowNo = 1;
  let sumOperational = 0;
  let sumPantry = 0;
  let sumFasilitas = 0;
  let sumLainLain = 0;
  let grandTotal = 0;

  let tableRowsHTML = '';

  sortedTx.forEach((tx) => {
    const txDateStr = formatDateOnly(tx.transaction_date);
    const catCol = categorizeColumn(tx.category?.name || '');

    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((it) => {
        const itTotal = Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
        grandTotal += itTotal;

        let bVal = '-';
        let cVal = '-';
        let dVal = '-';
        let fVal = '-';

        if (catCol === 'operational') {
          bVal = formatRupiah(itTotal);
          sumOperational += itTotal;
        } else if (catCol === 'pantry') {
          cVal = formatRupiah(itTotal);
          sumPantry += itTotal;
        } else if (catCol === 'fasilitas') {
          dVal = formatRupiah(itTotal);
          sumFasilitas += itTotal;
        } else {
          fVal = formatRupiah(itTotal);
          sumLainLain += itTotal;
        }

        const qtyStr = it.quantity ? `${it.quantity} Pcs` : '1 Pcs';

        tableRowsHTML += `
          <tr>
            <td style="text-align: center;">${txDateStr}</td>
            <td style="text-align: center;">${rowNo}</td>
            <td style="text-align: left; padding-left: 8px;">${it.item_name}</td>
            <td style="text-align: center; font-weight: 500;">${qtyStr}</td>
            <td style="text-align: right; padding-right: 8px;">${bVal !== '-' ? bVal : ''}</td>
            <td style="text-align: right; padding-right: 8px;">${cVal !== '-' ? cVal : ''}</td>
            <td style="text-align: right; padding-right: 8px;">${dVal !== '-' ? dVal : ''}</td>
            <td style="text-align: right; padding-right: 8px;">${fVal !== '-' ? fVal : ''}</td>
            <td style="text-align: right; padding-right: 8px; font-weight: 600;">${formatRupiah(itTotal)}</td>
          </tr>
        `;
        rowNo++;
      });
    } else {
      const total = Number(tx.total_amount) || 0;
      grandTotal += total;

      let bVal = '-';
      let cVal = '-';
      let dVal = '-';
      let fVal = '-';

      if (catCol === 'operational') {
        bVal = formatRupiah(total);
        sumOperational += total;
      } else if (catCol === 'pantry') {
        cVal = formatRupiah(total);
        sumPantry += total;
      } else if (catCol === 'fasilitas') {
        dVal = formatRupiah(total);
        sumFasilitas += total;
      } else {
        fVal = formatRupiah(total);
        sumLainLain += total;
      }

      tableRowsHTML += `
        <tr>
          <td style="text-align: center;">${txDateStr}</td>
          <td style="text-align: center;">${rowNo}</td>
          <td style="text-align: left; padding-left: 8px;">${tx.merchant_name}</td>
          <td style="text-align: center; font-weight: 500;">1 Paket</td>
          <td style="text-align: right; padding-right: 8px;">${bVal !== '-' ? bVal : ''}</td>
          <td style="text-align: right; padding-right: 8px;">${cVal !== '-' ? cVal : ''}</td>
          <td style="text-align: right; padding-right: 8px;">${dVal !== '-' ? dVal : ''}</td>
          <td style="text-align: right; padding-right: 8px;">${fVal !== '-' ? fVal : ''}</td>
          <td style="text-align: right; padding-right: 8px; font-weight: 600;">${formatRupiah(total)}</td>
        </tr>
      `;
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      tableRowsHTML += `
        <tr style="color: #c53030;">
          <td style="text-align: center;">${txDateStr}</td>
          <td style="text-align: center;">${rowNo}</td>
          <td style="text-align: left; padding-left: 8px;">Potongan Diskon / Voucher</td>
          <td style="text-align: center;">-</td>
          <td style="text-align: right;"></td>
          <td style="text-align: right;"></td>
          <td style="text-align: right;"></td>
          <td style="text-align: right; padding-right: 8px;">-${formatRupiah(tx.discount_amount)}</td>
          <td style="text-align: right; padding-right: 8px;">-${formatRupiah(tx.discount_amount)}</td>
        </tr>
      `;
      rowNo++;
    }
  });

  const refund = cashAdvance - grandTotal;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Finance Formulir SKA Period ${reportDate} - ${companyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 16px;
    }
    .header-table {
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 11.5px;
    }
    .header-table td {
      padding: 2px 4px;
      vertical-align: middle;
    }
    .header-table .label {
      width: 130px;
      font-weight: 700;
    }
    .header-table .colon {
      width: 15px;
      text-align: center;
      font-weight: 700;
    }
    .header-table .val {
      font-weight: 700;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10.5px;
    }
    table.data-table th {
      font-weight: 800;
      text-align: center;
      vertical-align: middle;
      font-size: 10.5px;
    }
    .th-operational { background-color: #fef08a !important; color: #000; }
    .th-pantry { background-color: #bbf7d0 !important; color: #000; }
    .th-fasilitas { background-color: #fbcfe8 !important; color: #000; }
    .th-lain { background-color: #bae6fd !important; color: #000; }
    .th-total { background-color: #e2e8f0 !important; color: #000; }
    
    .total-row td {
      font-weight: 800;
      background-color: #fff;
    }
    .summary-box {
      border-collapse: collapse;
      margin-top: 8px;
    }
    .summary-box td {
      padding: 2px 6px;
      font-size: 11px;
    }
    .signatures-table {
      border-collapse: collapse;
      margin-top: 8px;
    }
    .signatures-table td {
      padding: 4px 18px;
      text-align: center;
      font-size: 11px;
      vertical-align: top;
    }
    .signatures-table .name-row td {
      padding-top: 50px;
      font-weight: 700;
      text-decoration: underline;
    }
    .action-bar {
      margin-bottom: 14px;
      display: flex;
      gap: 10px;
    }
    .btn {
      background-color: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 700;
      font-size: 12px;
    }
    .btn-green { background-color: #16a34a; }
    @media print {
      .action-bar { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn btn-green" onclick="window.print()">🖨️ Cetak Formulir (Landscape PDF)</button>
    <button class="btn" onclick="window.close()">Tutup Jendela</button>
  </div>

  <!-- Header Metadata -->
  <table class="header-table">
    <tr>
      <td class="label">Nama Perusahaan</td>
      <td class="colon">:</td>
      <td class="val">${companyName}</td>
    </tr>
    <tr>
      <td class="label">Nama</td>
      <td class="colon">:</td>
      <td class="val">${employeeName}</td>
    </tr>
    <tr>
      <td class="label">Dept/Divisi</td>
      <td class="colon">:</td>
      <td class="val">${department}</td>
    </tr>
    <tr>
      <td class="label">Tanggal</td>
      <td class="colon">:</td>
      <td class="val">${reportDate}</td>
    </tr>
    <tr>
      <td class="label">Project</td>
      <td class="colon">:</td>
      <td class="val">${projectName}</td>
    </tr>
  </table>

  <!-- Main Table matching Google Sheets -->
  <table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 90px;">TANGGAL</th>
        <th rowspan="2" style="width: 32px;">NO</th>
        <th rowspan="2" style="min-width: 220px;">KETERANGAN</th>
        <th rowspan="2" style="width: 90px;">JUMLAH ITEM</th>
        <th class="th-operational" style="width: 110px;">Operational</th>
        <th class="th-pantry" style="width: 110px;">Pantry</th>
        <th class="th-fasilitas" style="width: 110px;">Fasilitas</th>
        <th class="th-lain" style="width: 110px;">Lain-Lain</th>
        <th class="th-total" style="width: 115px;">TOTAL</th>
      </tr>
      <tr>
        <th class="th-operational" style="font-size: 9.5px;">(Rp) - B</th>
        <th class="th-pantry" style="font-size: 9.5px;">(Rp) - C</th>
        <th class="th-fasilitas" style="font-size: 9.5px;">(Rp) - D</th>
        <th class="th-lain" style="font-size: 9.5px;">(Rp) - F</th>
        <th class="th-total" style="font-size: 9.5px;">(Rp) - G</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHTML}
      <tr class="total-row">
        <td colspan="4" style="text-align: center; font-weight: 800;">TOTAL</td>
        <td style="text-align: right; padding-right: 8px;">${sumOperational > 0 ? formatRupiah(sumOperational) : 'Rp -'}</td>
        <td style="text-align: right; padding-right: 8px;">${sumPantry > 0 ? formatRupiah(sumPantry) : 'Rp -'}</td>
        <td style="text-align: right; padding-right: 8px;">${sumFasilitas > 0 ? formatRupiah(sumFasilitas) : 'Rp -'}</td>
        <td style="text-align: right; padding-right: 8px;">${sumLainLain > 0 ? formatRupiah(sumLainLain) : 'Rp -'}</td>
        <td style="text-align: right; padding-right: 8px; font-weight: 800;">${formatRupiah(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Summary Section matching Google Sheets Rows 82-86 -->
  <div style="margin-top: 10px;">
    <table class="summary-box">
      <tr>
        <td style="font-weight: 700; width: 170px;">Total Pengeluaran (f)</td>
        <td style="width: 15px;">:</td>
        <td style="font-weight: 700; text-align: right; width: 120px;">${formatRupiah(grandTotal)}</td>
      </tr>
      <tr>
        <td colspan="3" style="border-bottom: 1px dashed #777; padding: 2px 0;"></td>
      </tr>
      <tr>
        <td>Jumlah Cash Advance</td>
        <td>:</td>
        <td style="text-align: right; font-weight: 600;">${formatRupiah(cashAdvance)}</td>
      </tr>
      <tr>
        <td>Jumlah yang diklaim</td>
        <td>:</td>
        <td style="text-align: right; font-weight: 600;">${formatRupiah(grandTotal)}</td>
      </tr>
      <tr>
        <td style="font-weight: 700;">Jumlah pengembalian dana</td>
        <td style="font-weight: 700;">:</td>
        <td style="text-align: right; font-weight: 800; color: ${refund < 0 ? '#c53030' : '#15803d'};">
          ${formatRupiah(refund)}
        </td>
      </tr>
    </table>

    <!-- Signature Block matching Google Sheets Rows 88-94 -->
    <div style="margin-top: 18px;">
      <div style="font-size: 11px; margin-bottom: 6px; font-weight: 600;">
        ${city}, ${reportDate}
      </div>
      <table class="signatures-table">
        <tr>
          <td style="width: 140px; font-weight: 600;">Dibuat oleh,</td>
          <td style="width: 140px; font-weight: 600;">Diperiksa</td>
          <td style="width: 180px; font-weight: 600;">Diperiksa & Diketahui oleh,</td>
        </tr>
        <tr class="name-row">
          <td>${employeeName}</td>
          <td>${verifierName}</td>
          <td>${approverName}</td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Membuka jendela cetak / format spreadsheet langsung di browser
 */
export function openPrintableReport(transactions: Transaction[], profile?: UserProfile) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const html = generatePrintableReportHTML(transactions, profile);
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }
}

/**
 * Mengonversi seluruh data transaksi dan rincian item ke format Spreadsheet (.xls / Google Sheets Ready)
 * Lengkap dengan styling, warna header kolom, border, dan formula per baris.
 */
export function generateCompanyExpenseReportCSV(
  transactions: Transaction[],
  profile?: UserProfile
): string {
  const companyName = profile?.company_name || 'PT. San Kawan Abadi';
  const employeeName = profile?.full_name || 'Gabriel Rudra Renata';
  const department = profile?.department || 'Operation';
  const reportDate = profile?.submission_date || '1 Agustus 2026';
  const projectName = profile?.project_name || 'Head Office';
  const city = profile?.city || 'Tangerang';
  const verifierName = profile?.verifier_name || 'Yunitha';
  const approverName = profile?.approver_name || 'Dwi Hartanto';
  const cashAdvance = Number(profile?.cash_advance_amount) || 7117500;

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  let rowsHTML = '';
  let rowNo = 1;
  let sumOperational = 0;
  let sumPantry = 0;
  let sumFasilitas = 0;
  let sumLainLain = 0;
  let grandTotal = 0;

  sortedTx.forEach((tx) => {
    const txDateStr = formatDateOnly(tx.transaction_date);
    const catCol = categorizeColumn(tx.category?.name || '');

    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((it) => {
        const itTotal = Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
        grandTotal += itTotal;

        let bVal = '';
        let cVal = '';
        let dVal = '';
        let fVal = '';

        if (catCol === 'operational') {
          bVal = String(itTotal);
          sumOperational += itTotal;
        } else if (catCol === 'pantry') {
          cVal = String(itTotal);
          sumPantry += itTotal;
        } else if (catCol === 'fasilitas') {
          dVal = String(itTotal);
          sumFasilitas += itTotal;
        } else {
          fVal = String(itTotal);
          sumLainLain += itTotal;
        }

        const qtyStr = it.quantity ? `${it.quantity} Pcs` : '1 Pcs';

        rowsHTML += `
          <tr style="height: 22px;">
            <td style="border: 1px solid #000; text-align: center;">${txDateStr}</td>
            <td style="border: 1px solid #000; text-align: center;">${rowNo}</td>
            <td style="border: 1px solid #000; text-align: left; padding-left: 4px;">${it.item_name}</td>
            <td style="border: 1px solid #000; text-align: center;">${qtyStr}</td>
            <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${bVal}</td>
            <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cVal}</td>
            <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${dVal}</td>
            <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${fVal}</td>
            <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${itTotal}</td>
          </tr>
        `;
        rowNo++;
      });
    } else {
      const total = Number(tx.total_amount) || 0;
      grandTotal += total;

      let bVal = '';
      let cVal = '';
      let dVal = '';
      let fVal = '';

      if (catCol === 'operational') {
        bVal = String(total);
        sumOperational += total;
      } else if (catCol === 'pantry') {
        cVal = String(total);
        sumPantry += total;
      } else if (catCol === 'fasilitas') {
        dVal = String(total);
        sumFasilitas += total;
      } else {
        fVal = String(total);
        sumLainLain += total;
      }

      rowsHTML += `
        <tr style="height: 22px;">
          <td style="border: 1px solid #000; text-align: center;">${txDateStr}</td>
          <td style="border: 1px solid #000; text-align: center;">${rowNo}</td>
          <td style="border: 1px solid #000; text-align: left; padding-left: 4px;">${tx.merchant_name}</td>
          <td style="border: 1px solid #000; text-align: center;">1 Paket</td>
          <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${bVal}</td>
          <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cVal}</td>
          <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${dVal}</td>
          <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${fVal}</td>
          <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${total}</td>
        </tr>
      `;
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      rowsHTML += `
        <tr style="height: 22px; color: #c53030;">
          <td style="border: 1px solid #000; text-align: center;">${txDateStr}</td>
          <td style="border: 1px solid #000; text-align: center;">${rowNo}</td>
          <td style="border: 1px solid #000; text-align: left; padding-left: 4px;">Potongan Diskon / Voucher</td>
          <td style="border: 1px solid #000; text-align: center;">-</td>
          <td style="border: 1px solid #000; text-align: right;"></td>
          <td style="border: 1px solid #000; text-align: right;"></td>
          <td style="border: 1px solid #000; text-align: right;"></td>
          <td style="border: 1px solid #000; text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">-${tx.discount_amount}</td>
          <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">-${tx.discount_amount}</td>
        </tr>
      `;
      rowNo++;
    }
  });

  const refund = cashAdvance - grandTotal;

  // Template Excel/Google Sheets XML HTML yang persis dengan Spreadsheet user
  const xlsContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Settlement SKA Ags 26</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    td { font-family: Arial, sans-serif; font-size: 10pt; }
    .th-header { font-weight: bold; text-align: center; border: 1px solid #000; vertical-align: middle; }
  </style>
</head>
<body>
  <table>
    <tr style="height: 20px;">
      <td colspan="2" style="font-weight: bold;">Nama Perusahaan</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6" style="font-weight: bold;">${companyName}</td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="2" style="font-weight: bold;">Nama</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${employeeName}</td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="2" style="font-weight: bold;">Dept/Divisi</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${department}</td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="2" style="font-weight: bold;">Tanggal</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${reportDate}</td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="2" style="font-weight: bold;">Project</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${projectName}</td>
    </tr>
    <tr style="height: 14px;"><td colspan="9"></td></tr>

    <!-- Table Header (2 Rows) -->
    <tr style="height: 26px;">
      <td rowspan="2" class="th-header" style="width: 100px;">TANGGAL</td>
      <td rowspan="2" class="th-header" style="width: 35px;">NO</td>
      <td rowspan="2" class="th-header" style="width: 250px;">KETERANGAN</td>
      <td rowspan="2" class="th-header" style="width: 95px;">JUMLAH ITEM</td>
      <td class="th-header" style="background-color: #FEF08A; width: 110px;">Operational</td>
      <td class="th-header" style="background-color: #BBF7D0; width: 110px;">Pantry</td>
      <td class="th-header" style="background-color: #FBCFE8; width: 110px;">Fasilitas</td>
      <td class="th-header" style="background-color: #BAE6FD; width: 110px;">Lain-Lain</td>
      <td class="th-header" style="background-color: #E2E8F0; width: 120px;">TOTAL</td>
    </tr>
    <tr style="height: 22px;">
      <td class="th-header" style="background-color: #FEF08A; font-size: 9pt;">(Rp) - B</td>
      <td class="th-header" style="background-color: #BBF7D0; font-size: 9pt;">(Rp) - C</td>
      <td class="th-header" style="background-color: #FBCFE8; font-size: 9pt;">(Rp) - D</td>
      <td class="th-header" style="background-color: #BAE6FD; font-size: 9pt;">(Rp) - F</td>
      <td class="th-header" style="background-color: #E2E8F0; font-size: 9pt;">(Rp) - G</td>
    </tr>

    <!-- Data Rows -->
    ${rowsHTML}

    <!-- TOTAL Row -->
    <tr style="height: 26px; font-weight: bold; background-color: #F8FAFC;">
      <td colspan="4" style="border: 1px solid #000; text-align: center; font-weight: bold;">TOTAL</td>
      <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumOperational}</td>
      <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumPantry}</td>
      <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumFasilitas}</td>
      <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumLainLain}</td>
      <td style="border: 1px solid #000; text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
    </tr>
    <tr style="height: 16px;"><td colspan="9"></td></tr>

    <!-- Summary Box (Rows 82-86) -->
    <tr style="height: 22px;">
      <td colspan="3" style="font-weight: bold;">Total Pengeluaran (f)</td>
      <td>:</td>
      <td style="text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="3">Jumlah Cash Advance :</td>
      <td>:</td>
      <td style="text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cashAdvance}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="3">Jumlah yang diklaim</td>
      <td>:</td>
      <td style="text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 22px;">
      <td colspan="3" style="font-weight: bold;">Jumlah pengembalian dana</td>
      <td style="font-weight: bold;">:</td>
      <td style="text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${refund}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 20px;"><td colspan="9"></td></tr>

    <!-- Signatures Section (Rows 88-94) -->
    <tr style="height: 20px;">
      <td colspan="4" style="font-weight: bold;">${city}, ${reportDate}</td>
      <td colspan="5"></td>
    </tr>
    <tr style="height: 20px;">
      <td colspan="2" style="text-align: center; font-weight: bold;">Dibuat oleh,</td>
      <td colspan="2" style="text-align: center; font-weight: bold;">Diperiksa</td>
      <td colspan="3" style="text-align: center; font-weight: bold;">Diperiksa & Diketahui oleh,</td>
      <td colspan="2"></td>
    </tr>
    <tr style="height: 50px;"><td colspan="9"></td></tr>
    <tr style="height: 22px;">
      <td colspan="2" style="text-align: center; font-weight: bold; text-decoration: underline;">${employeeName}</td>
      <td colspan="2" style="text-align: center; font-weight: bold; text-decoration: underline;">${verifierName}</td>
      <td colspan="3" style="text-align: center; font-weight: bold; text-decoration: underline;">${approverName}</td>
      <td colspan="2"></td>
    </tr>
  </table>
</body>
</html>`;

  return xlsContent;
}

/**
 * Memicu download berkas Spreadsheet (.xls) di browser atau perangkat
 */
export function downloadCSV(content: string, fileName = 'Settlement_SKA_Agustus_2026.xls') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

