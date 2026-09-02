import { Transaction, UserProfile } from '@/types';
import { formatDateOnly, formatRupiah } from './formatters';
import { Platform, Linking } from 'react-native';
import { exportToGoogleSpreadsheet as cloudExportToGDrive } from '@/services/googleDriveService';

export interface CompanyReportOptions {
  profile?: UserProfile;
}

/**
 * Mengelompokkan kategori ke kolom form klaim kantor (Operational, Pantry, Fasilitas, Lain-Lain)
 */
export function categorizeColumn(catNameRaw: string): 'operational' | 'pantry' | 'fasilitas' | 'lainlain' {
  const cat = (catNameRaw || '').toLowerCase();
  if (
    cat.includes('pantry') ||
    cat.includes('makan') ||
    cat.includes('minum') ||
    cat.includes('konsumsi') ||
    cat.includes('kopi') ||
    cat.includes('gula') ||
    cat.includes('air') ||
    cat.includes('snack') ||
    cat.includes('food')
  ) {
    return 'pantry';
  }
  if (
    cat.includes('fasilitas') ||
    cat.includes('kebersihan') ||
    cat.includes('kesehatan') ||
    cat.includes('sapu') ||
    cat.includes('pel') ||
    cat.includes('alat') ||
    cat.includes('kantor') ||
    cat.includes('sabun') ||
    cat.includes('tissue') ||
    cat.includes('pembersih') ||
    cat.includes('toilet') ||
    cat.includes('ikan') ||
    cat.includes('wifi') ||
    cat.includes('internet')
  ) {
    return 'fasilitas';
  }
  if (
    cat.includes('lain') ||
    cat.includes('buku') ||
    cat.includes('pendidikan') ||
    cat.includes('jasa') ||
    cat.includes('reimburs') ||
    cat.includes('meeting')
  ) {
    return 'lainlain';
  }
  return 'operational';
}

/**
 * Membuat Dokumen HTML & Tampilan Siap Cetak (Print to PDF / Spreadsheet Preview)
 * Format lapang, tidak mepet, 100% presisi dengan formulir rekapitulasi keuangan.
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

        let bVal = '';
        let cVal = '';
        let dVal = '';
        let fVal = '';

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
            <td style="text-align: center; padding: 7px 8px; white-space: nowrap;">${txDateStr}</td>
            <td style="text-align: center; padding: 7px 6px;">${rowNo}</td>
            <td style="text-align: left; padding: 7px 12px; font-weight: 500;">${it.item_name}</td>
            <td style="text-align: center; padding: 7px 8px; white-space: nowrap;">${qtyStr}</td>
            <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${bVal}</td>
            <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${cVal}</td>
            <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${dVal}</td>
            <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${fVal}</td>
            <td style="text-align: right; padding: 7px 12px; font-weight: 700; white-space: nowrap;">${formatRupiah(itTotal)}</td>
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
          <td style="text-align: center; padding: 7px 8px; white-space: nowrap;">${txDateStr}</td>
          <td style="text-align: center; padding: 7px 6px;">${rowNo}</td>
          <td style="text-align: left; padding: 7px 12px; font-weight: 500;">${tx.merchant_name}</td>
          <td style="text-align: center; padding: 7px 8px; white-space: nowrap;">1 Paket</td>
          <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${bVal}</td>
          <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${cVal}</td>
          <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${dVal}</td>
          <td style="text-align: right; padding: 7px 12px; white-space: nowrap;">${fVal}</td>
          <td style="text-align: right; padding: 7px 12px; font-weight: 700; white-space: nowrap;">${formatRupiah(total)}</td>
        </tr>
      `;
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      tableRowsHTML += `
        <tr style="color: #dc2626;">
          <td style="text-align: center; padding: 7px 8px;">${txDateStr}</td>
          <td style="text-align: center; padding: 7px 6px;">${rowNo}</td>
          <td style="text-align: left; padding: 7px 12px;">Potongan Diskon / Voucher</td>
          <td style="text-align: center; padding: 7px 8px;">-</td>
          <td style="text-align: right; padding: 7px 12px;"></td>
          <td style="text-align: right; padding: 7px 12px;"></td>
          <td style="text-align: right; padding: 7px 12px;"></td>
          <td style="text-align: right; padding: 7px 12px; font-weight: 600;">-${formatRupiah(tx.discount_amount)}</td>
          <td style="text-align: right; padding: 7px 12px; font-weight: 700;">-${formatRupiah(tx.discount_amount)}</td>
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
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      color: #111827;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
    }
    .sheet-card {
      background: #ffffff;
      padding: 28px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      max-width: 1200px;
      margin: 0 auto;
    }
    .header-table {
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .header-table td {
      padding: 4px 6px;
      vertical-align: middle;
    }
    .header-table .label {
      width: 140px;
      font-weight: 700;
      color: #1f2937;
    }
    .header-table .colon {
      width: 20px;
      text-align: center;
      font-weight: 700;
      color: #1f2937;
    }
    .header-table .val {
      font-weight: 600;
      color: #111827;
    }
    .meta-divider {
      border-top: 1.5px dotted #9ca3af;
      margin: 12px 0 16px 0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #111827;
      font-size: 11px;
    }
    table.data-table th {
      font-weight: 800;
      text-align: center;
      vertical-align: middle;
      padding: 8px 6px;
      letter-spacing: 0.3px;
    }
    .th-operational { background-color: #fef08a !important; color: #111827; }
    .th-pantry { background-color: #bbf7d0 !important; color: #111827; }
    .th-fasilitas { background-color: #fbcfe8 !important; color: #111827; }
    .th-lain { background-color: #bae6fd !important; color: #111827; }
    .th-total { background-color: #e2e8f0 !important; color: #111827; }
    
    .total-row td {
      font-weight: 800;
      background-color: #f9fafb;
      padding: 9px 12px;
      font-size: 11.5px;
    }
    .summary-section {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .summary-box {
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .summary-box td {
      padding: 4px 8px;
    }
    .signatures-table {
      border-collapse: collapse;
      margin-top: 10px;
    }
    .signatures-table td {
      border: 1px solid #111827;
      text-align: center;
      font-size: 11px;
      vertical-align: top;
      padding: 8px 14px;
    }
    .signatures-table .header-row td {
      font-weight: 700;
      background-color: #ffffff;
      padding: 8px 14px;
    }
    .signatures-table .space-row td {
      height: 65px;
    }
    .signatures-table .name-row td {
      font-weight: 700;
      text-decoration: underline;
      padding: 8px 14px;
    }
    .action-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }
    .btn {
      background-color: #2563eb;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
    }
    .btn:hover {
      opacity: 0.92;
    }
    .btn-green {
      background-color: #16a34a;
      box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
    }
    @media print {
      .action-bar { display: none !important; }
      body {
        padding: 0 !important;
        background: #fff !important;
      }
      .sheet-card {
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn btn-green" onclick="window.print()">🖨️ Cetak Formulir (Landscape PDF)</button>
    <button class="btn" onclick="window.close()">Tutup Jendela</button>
  </div>

  <div class="sheet-card">
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

    <div class="meta-divider"></div>

    <!-- Main Data Table matching Google Sheets layout with roomy columns -->
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 105px; min-width: 95px;">TANGGAL</th>
          <th rowspan="2" style="width: 45px; min-width: 40px;">NO</th>
          <th rowspan="2" style="min-width: 250px;">KETERANGAN</th>
          <th rowspan="2" style="width: 110px; min-width: 95px;">JUMLAH ITEM</th>
          <th class="th-operational" style="width: 125px; min-width: 115px;">Operational</th>
          <th class="th-pantry" style="width: 125px; min-width: 115px;">Pantry</th>
          <th class="th-fasilitas" style="width: 125px; min-width: 115px;">Fasilitas</th>
          <th class="th-lain" style="width: 125px; min-width: 115px;">Lain-Lain</th>
          <th class="th-total" style="width: 135px; min-width: 125px;">TOTAL</th>
        </tr>
        <tr>
          <th class="th-operational" style="font-size: 10px; padding: 4px 6px;">(Rp) - B</th>
          <th class="th-pantry" style="font-size: 10px; padding: 4px 6px;">(Rp) - C</th>
          <th class="th-fasilitas" style="font-size: 10px; padding: 4px 6px;">(Rp) - D</th>
          <th class="th-lain" style="font-size: 10px; padding: 4px 6px;">(Rp) - F</th>
          <th class="th-total" style="font-size: 10px; padding: 4px 6px;">(Rp) - G</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHTML}
        <tr class="total-row">
          <td colspan="4" style="text-align: center; font-weight: 800; padding: 9px 12px;">TOTAL</td>
          <td style="text-align: right; padding: 9px 12px; white-space: nowrap;">${sumOperational > 0 ? formatRupiah(sumOperational) : 'Rp -'}</td>
          <td style="text-align: right; padding: 9px 12px; white-space: nowrap;">${sumPantry > 0 ? formatRupiah(sumPantry) : 'Rp -'}</td>
          <td style="text-align: right; padding: 9px 12px; white-space: nowrap;">${sumFasilitas > 0 ? formatRupiah(sumFasilitas) : 'Rp -'}</td>
          <td style="text-align: right; padding: 9px 12px; white-space: nowrap;">${sumLainLain > 0 ? formatRupiah(sumLainLain) : 'Rp -'}</td>
          <td style="text-align: right; padding: 9px 12px; font-weight: 800; white-space: nowrap;">${formatRupiah(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Summary Section (Rows 82-86) -->
    <div class="summary-section">
      <table class="summary-box">
        <tr>
          <td style="font-weight: 700; width: 190px;">Total Pengeluaran (f)</td>
          <td style="width: 15px; text-align: center;">:</td>
          <td style="font-weight: 800; text-align: right; width: 140px;">${formatRupiah(grandTotal)}</td>
        </tr>
        <tr>
          <td colspan="3" style="border-bottom: 1.5px solid #111827; padding: 2px 0;"></td>
        </tr>
        <tr>
          <td style="padding-top: 6px;">Jumlah Cash Advance</td>
          <td style="padding-top: 6px; text-align: center;">:</td>
          <td style="padding-top: 6px; text-align: right; font-weight: 600;">${formatRupiah(cashAdvance)}</td>
        </tr>
        <tr>
          <td>Jumlah yang diklaim</td>
          <td style="text-align: center;">:</td>
          <td style="text-align: right; font-weight: 600;">${formatRupiah(grandTotal)}</td>
        </tr>
        <tr>
          <td style="font-weight: 700;">Jumlah pengembalian dana</td>
          <td style="font-weight: 700; text-align: center;">:</td>
          <td style="text-align: right; font-weight: 800; color: ${refund < 0 ? '#dc2626' : '#15803d'};">
            ${formatRupiah(refund)}
          </td>
        </tr>
      </table>

      <!-- Signatures Table (Rows 88-94) -->
      <div style="margin-top: 12px;">
        <div style="font-size: 11.5px; margin-bottom: 8px; font-weight: 700;">
          ${city}, ${reportDate}
        </div>
        <table class="signatures-table">
          <tr class="header-row">
            <td style="width: 170px;">Dibuat oleh,</td>
            <td style="width: 170px;">Diperiksa</td>
            <td style="width: 220px;">Diperiksa & Diketahui oleh,</td>
          </tr>
          <tr class="space-row">
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="name-row">
            <td>${employeeName}</td>
            <td>${verifierName}</td>
            <td>${approverName}</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Membuka jendela cetak / PDF langsung di browser
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
 * Mengonversi seluruh data transaksi dan rincian item ke format Microsoft Excel (.xls)
 * Lengkap dengan styling proporsional, border tegas, lebar kolom lega (tidak mepet),
 * header dua tingkat, format mata uang, total otomatis, dan tanda tangan resmi.
 */
export function generateCompanyExpenseReportXLS(
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
          <tr style="height: 28px;">
            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
            <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">${it.item_name}</td>
            <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${qtyStr}</td>
            <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${bVal}</td>
            <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cVal}</td>
            <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${dVal}</td>
            <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${fVal}</td>
            <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${itTotal}</td>
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
        <tr style="height: 28px;">
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
          <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">${tx.merchant_name}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">1 Paket</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${bVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${dVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${fVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${total}</td>
        </tr>
      `;
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      rowsHTML += `
        <tr style="height: 28px; color: #dc2626;">
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
          <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">Potongan Diskon / Voucher</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">-</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle;"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle;"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle;"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">-${tx.discount_amount}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">-${tx.discount_amount}</td>
        </tr>
      `;
      rowNo++;
    }
  });

  const refund = cashAdvance - grandTotal;

  // Format Spreadsheet XLS/HTML
  const xlsContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Formulir SKA</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
            <x:Print>
              <x:ValidPrinterInfo/>
              <x:PaperSizeIndex>9</x:PaperSizeIndex>
              <x:HorizontalResolution>600</x:HorizontalResolution>
              <x:VerticalResolution>600</x:VerticalResolution>
            </x:Print>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    td { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    .th-header { font-family: Calibri, Arial, sans-serif; font-size: 11pt; font-weight: bold; text-align: center; border: 1px solid #000000; vertical-align: middle; padding: 6px; }
  </style>
</head>
<body>
  <table>
    <col width="115" />
    <col width="45" />
    <col width="300" />
    <col width="110" />
    <col width="135" />
    <col width="135" />
    <col width="135" />
    <col width="135" />
    <col width="145" />

    <!-- Metadata Section -->
    <tr style="height: 24px;">
      <td colspan="2" style="font-weight: bold;">Nama Perusahaan</td>
      <td style="text-align: center; font-weight: bold; width: 25px;">:</td>
      <td colspan="6" style="font-weight: bold;">${companyName}</td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="2" style="font-weight: bold;">Nama</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${employeeName}</td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="2" style="font-weight: bold;">Dept/Divisi</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${department}</td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="2" style="font-weight: bold;">Tanggal</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${reportDate}</td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="2" style="font-weight: bold;">Project</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td colspan="6">${projectName}</td>
    </tr>
    <tr style="height: 16px;"><td colspan="9"></td></tr>

    <!-- Table Header (2 Rows) with distinct pastel colors -->
    <tr style="height: 32px;">
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 115px;">TANGGAL</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 45px;">NO</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 300px;">KETERANGAN</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 110px;">JUMLAH ITEM</td>
      <td class="th-header" style="background-color: #FEF08A; width: 135px;">Operational</td>
      <td class="th-header" style="background-color: #BBF7D0; width: 135px;">Pantry</td>
      <td class="th-header" style="background-color: #FBCFE8; width: 135px;">Fasilitas</td>
      <td class="th-header" style="background-color: #BAE6FD; width: 135px;">Lain-Lain</td>
      <td class="th-header" style="background-color: #E2E8F0; width: 145px;">TOTAL</td>
    </tr>
    <tr style="height: 26px;">
      <td class="th-header" style="background-color: #FEF08A; font-size: 9.5pt;">(Rp) - B</td>
      <td class="th-header" style="background-color: #BBF7D0; font-size: 9.5pt;">(Rp) - C</td>
      <td class="th-header" style="background-color: #FBCFE8; font-size: 9.5pt;">(Rp) - D</td>
      <td class="th-header" style="background-color: #BAE6FD; font-size: 9.5pt;">(Rp) - F</td>
      <td class="th-header" style="background-color: #E2E8F0; font-size: 9.5pt;">(Rp) - G</td>
    </tr>

    <!-- Data Rows -->
    ${rowsHTML}

    <!-- TOTAL Row -->
    <tr style="height: 30px; font-weight: bold; background-color: #F8FAFC;">
      <td colspan="4" style="border: 1px solid #000000; text-align: center; font-weight: bold; vertical-align: middle;">TOTAL</td>
      <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumOperational}</td>
      <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumPantry}</td>
      <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumFasilitas}</td>
      <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${sumLainLain}</td>
      <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
    </tr>
    <tr style="height: 18px;"><td colspan="9"></td></tr>

    <!-- Summary Box (Rows 82-86) -->
    <tr style="height: 24px;">
      <td colspan="3" style="font-weight: bold;">Total Pengeluaran (f)</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td style="text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3">Jumlah Cash Advance</td>
      <td style="text-align: center;">:</td>
      <td style="text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${cashAdvance}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3">Jumlah yang diklaim</td>
      <td style="text-align: center;">:</td>
      <td style="text-align: right; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3" style="font-weight: bold;">Jumlah pengembalian dana</td>
      <td style="text-align: center; font-weight: bold;">:</td>
      <td style="text-align: right; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${refund}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;"><td colspan="9"></td></tr>

    <!-- Signatures Section (Rows 88-94) -->
    <tr style="height: 24px;">
      <td colspan="4" style="font-weight: bold;">${city}, ${reportDate}</td>
      <td colspan="5"></td>
    </tr>
    <tr style="height: 26px;">
      <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle;">Dibuat oleh,</td>
      <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle;">Diperiksa</td>
      <td colspan="3" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle;">Diperiksa & Diketahui oleh,</td>
      <td colspan="2"></td>
    </tr>
    <tr style="height: 60px;">
      <td colspan="2" style="border: 1px solid #000000;"></td>
      <td colspan="2" style="border: 1px solid #000000;"></td>
      <td colspan="3" style="border: 1px solid #000000;"></td>
      <td colspan="2"></td>
    </tr>
    <tr style="height: 28px;">
      <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle;">${employeeName}</td>
      <td colspan="2" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle;">${verifierName}</td>
      <td colspan="3" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle;">${approverName}</td>
      <td colspan="2"></td>
    </tr>
  </table>
</body>
</html>`;

  return xlsContent;
}

/**
 * Mengonversi data ke format CSV standar murni untuk import Google Sheets
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

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines: string[] = [];

  // Metadata
  lines.push(`${escapeCSV('Nama Perusahaan')},${escapeCSV(':')},${escapeCSV(companyName)}`);
  lines.push(`${escapeCSV('Nama')},${escapeCSV(':')},${escapeCSV(employeeName)}`);
  lines.push(`${escapeCSV('Dept/Divisi')},${escapeCSV(':')},${escapeCSV(department)}`);
  lines.push(`${escapeCSV('Tanggal')},${escapeCSV(':')},${escapeCSV(reportDate)}`);
  lines.push(`${escapeCSV('Project')},${escapeCSV(':')},${escapeCSV(projectName)}`);
  lines.push('');

  // Headers
  lines.push(
    [
      escapeCSV('TANGGAL'),
      escapeCSV('NO'),
      escapeCSV('KETERANGAN'),
      escapeCSV('JUMLAH ITEM'),
      escapeCSV('Operational (Rp) - B'),
      escapeCSV('Pantry (Rp) - C'),
      escapeCSV('Fasilitas (Rp) - D'),
      escapeCSV('Lain-Lain (Rp) - F'),
      escapeCSV('TOTAL (Rp) - G'),
    ].join(',')
  );

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

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

        lines.push(
          [
            escapeCSV(txDateStr),
            escapeCSV(rowNo),
            escapeCSV(it.item_name),
            escapeCSV(qtyStr),
            escapeCSV(bVal),
            escapeCSV(cVal),
            escapeCSV(dVal),
            escapeCSV(fVal),
            escapeCSV(itTotal),
          ].join(',')
        );
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

      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(tx.merchant_name),
          escapeCSV('1 Paket'),
          escapeCSV(bVal),
          escapeCSV(cVal),
          escapeCSV(dVal),
          escapeCSV(fVal),
          escapeCSV(total),
        ].join(',')
      );
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV('Potongan Diskon / Voucher'),
          escapeCSV('-'),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(-tx.discount_amount),
          escapeCSV(-tx.discount_amount),
        ].join(',')
      );
      rowNo++;
    }
  });

  const refund = cashAdvance - grandTotal;

  // Total row
  lines.push(
    [
      escapeCSV('TOTAL'),
      escapeCSV(''),
      escapeCSV(''),
      escapeCSV(''),
      escapeCSV(sumOperational),
      escapeCSV(sumPantry),
      escapeCSV(sumFasilitas),
      escapeCSV(sumLainLain),
      escapeCSV(grandTotal),
    ].join(',')
  );

  lines.push('');
  lines.push(`${escapeCSV('Total Pengeluaran (f)')},${escapeCSV(':')},${escapeCSV(grandTotal)}`);
  lines.push(`${escapeCSV('Jumlah Cash Advance')},${escapeCSV(':')},${escapeCSV(cashAdvance)}`);
  lines.push(`${escapeCSV('Jumlah yang diklaim')},${escapeCSV(':')},${escapeCSV(grandTotal)}`);
  lines.push(`${escapeCSV('Jumlah pengembalian dana')},${escapeCSV(':')},${escapeCSV(refund)}`);

  lines.push('');
  lines.push(`${escapeCSV(`${city}, ${reportDate}`)}`);
  lines.push(`${escapeCSV('Dibuat oleh,')},${escapeCSV('')},${escapeCSV('Diperiksa')},${escapeCSV('')},${escapeCSV('Diperiksa & Diketahui oleh,')}`);
  lines.push('');
  lines.push('');
  lines.push(`${escapeCSV(employeeName)},${escapeCSV('')},${escapeCSV(verifierName)},${escapeCSV('')},${escapeCSV(approverName)}`);

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Menyalin tabel berformat HTML & TSV ke clipboard
 * Sehingga ketika dipaste di Google Sheets / Excel langsung terformat lengkap dengan warna & lebar kolom!
 */
export async function copyFormattedTableToClipboard(
  transactions: Transaction[],
  profile?: UserProfile
): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      const xlsHTML = generateCompanyExpenseReportXLS(transactions, profile);
      const csv = generateCompanyExpenseReportCSV(transactions, profile);

      if (typeof ClipboardItem !== 'undefined') {
        const textBlob = new Blob([csv], { type: 'text/plain' });
        const htmlBlob = new Blob([xlsHTML], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob,
          }),
        ]);
        return true;
      } else {
        await navigator.clipboard.writeText(csv);
        return true;
      }
    } catch (e) {
      console.warn('Clipboard write error:', e);
      return false;
    }
  }
  return false;
}

/**
 * Memicu download berkas (Excel .xls atau CSV) di browser
 */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType = 'application/vnd.ms-excel;charset=utf-8;'
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([content], { type: mimeType });
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

/**
 * Helper kompatibilitas lama
 */
export function downloadCSV(content: string, fileName = 'Settlement_SKA_Agustus_2026.xls') {
  const mimeType = fileName.endsWith('.csv')
    ? 'text/csv;charset=utf-8;'
    : 'application/vnd.ms-excel;charset=utf-8;';
  downloadFile(content, fileName, mimeType);
}

/**
 * Fungsi Ekspor 1: Download File Excel (.xls)
 */
export function exportExcelReport(
  transactions: Transaction[],
  profile?: UserProfile,
  fileName?: string
) {
  const name =
    fileName ||
    `Rekap_Klaim_${(profile?.company_name || 'SKA').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
  const xlsContent = generateCompanyExpenseReportXLS(transactions, profile);
  downloadFile(xlsContent, name, 'application/vnd.ms-excel;charset=utf-8;');
}

/**
 * Fungsi Ekspor 2: Buka & Salin ke Google Spreadsheet
 */
export async function exportGoogleSpreadsheetReport(
  transactions: Transaction[],
  profile?: UserProfile,
  fileName?: string
): Promise<{ success: boolean; message: string }> {
  const name =
    fileName ||
    `Rekap_Klaim_${(profile?.company_name || 'SKA').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

  const csv = generateCompanyExpenseReportCSV(transactions, profile);

  // 1. Download berkas CSV cadangan yang bersih
  downloadFile(csv, `${name}.csv`, 'text/csv;charset=utf-8;');

  // 2. Salin tabel ke clipboard (bisa langsung paste ke Google Sheets)
  await copyFormattedTableToClipboard(transactions, profile);

  // 3. Coba upload ke Google Drive langsung jika ada token
  const cloudRes = await cloudExportToGDrive(csv, name);

  // 4. Buka URL Google Sheets
  const targetUrl = cloudRes.isDirectCloud ? cloudRes.spreadsheetUrl : 'https://sheets.new';
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(targetUrl, '_blank');
  } else {
    Linking.openURL(targetUrl);
  }

  return {
    success: true,
    message: cloudRes.isDirectCloud
      ? 'Berhasil dibuat di Google Drive Anda!'
      : 'Google Spreadsheet dibuka! Tabel otomatis tersalin ke Clipboard (tekan Ctrl+V / Paste) atau gunakan File > Import file CSV yang baru terunduh.',
  };
}


