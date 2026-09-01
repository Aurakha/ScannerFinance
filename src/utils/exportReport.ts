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
  if (cat.includes('pantry') || cat.includes('makan') || cat.includes('minum') || cat.includes('konsumsi')) {
    return 'pantry';
  }
  if (cat.includes('fasilitas') || cat.includes('kebersihan') || cat.includes('kesehatan') || cat.includes('alat') || cat.includes('kantor')) {
    return 'fasilitas';
  }
  if (cat.includes('lain') || cat.includes('buku') || cat.includes('pendidikan') || cat.includes('jasa')) {
    return 'lainlain';
  }
  return 'operational';
}

/**
 * Membuat dokumen HTML Siap Cetak (Print to PDF / Spreadsheet Format)
 * 100% PERSIS dengan layout laporan reimbursement di Foto 2 & 3
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
            <td style="text-align: center; font-weight: bold;">${qtyStr}</td>
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
          <td style="text-align: center; font-weight: bold;">1 Paket</td>
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
  <title>Rekapitulasi Klaim Pengeluaran - ${companyName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 15mm;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      font-size: 11px;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 16px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .header-table td {
      padding: 3px 4px;
      vertical-align: top;
    }
    .header-table .label {
      width: 140px;
      font-weight: 600;
    }
    .header-table .colon {
      width: 15px;
      text-align: center;
    }
    .divider {
      border-bottom: 1px dotted #555;
      margin: 8px 0 14px 0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #333;
      padding: 5px 6px;
      font-size: 10.5px;
    }
    table.data-table th {
      font-weight: 800;
      text-align: center;
      vertical-align: middle;
      text-transform: uppercase;
      font-size: 10px;
    }
    .th-operational { background-color: #d1d5db; }
    .th-pantry { background-color: #e2e8f0; }
    .th-fasilitas { background-color: #fbcfe8; }
    .th-lain { background-color: #bae6fd; }
    .th-total { background-color: #d1d5db; }
    
    .total-row td {
      font-weight: 800;
      background-color: #f8fafc;
    }
    .summary-section {
      width: 100%;
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .cash-advance-box {
      width: 320px;
      border-collapse: collapse;
      border: 1px solid #333;
      margin-top: 8px;
    }
    .cash-advance-box td {
      border: 1px solid #333;
      padding: 4px 8px;
      font-size: 11px;
    }
    .grand-total-display {
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .signatures-container {
      width: 520px;
      margin-top: 18px;
    }
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #333;
      margin-top: 4px;
    }
    .signatures-table th {
      border: 1px solid #333;
      padding: 6px;
      font-size: 10.5px;
      font-weight: 600;
      background: #fafafa;
      text-align: center;
    }
    .signatures-table td {
      border: 1px solid #333;
      height: 60px;
      vertical-align: bottom;
      padding: 6px;
      text-align: center;
      font-weight: 700;
      font-size: 11px;
    }
    .action-bar {
      margin-bottom: 16px;
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
    <button class="btn btn-green" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
    <button class="btn" onclick="window.close()">Tutup Halaman</button>
  </div>

  <table class="header-table">
    <tr>
      <td class="label">Nama Perusahaan</td>
      <td class="colon">:</td>
      <td><strong>${companyName}</strong></td>
    </tr>
    <tr>
      <td class="label">Nama</td>
      <td class="colon">:</td>
      <td>${employeeName}</td>
    </tr>
    <tr>
      <td class="label">Dept/Divisi</td>
      <td class="colon">:</td>
      <td>${department}</td>
    </tr>
    <tr>
      <td class="label">Tanggal</td>
      <td class="colon">:</td>
      <td>${reportDate}</td>
    </tr>
    <tr>
      <td class="label">Project</td>
      <td class="colon">:</td>
      <td>${projectName}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 100px;">TANGGAL</th>
        <th style="width: 35px;">NO</th>
        <th>KETERANGAN</th>
        <th style="width: 90px;">JUMLAH ITEM</th>
        <th class="th-operational" style="width: 110px;">Operational<br>(Rp) - B</th>
        <th class="th-pantry" style="width: 110px;">Pantry<br>(Rp) - C</th>
        <th class="th-fasilitas" style="width: 110px;">Fasilitas<br>(Rp) - D</th>
        <th class="th-lain" style="width: 110px;">Lain-Lain<br>(Rp) - F</th>
        <th class="th-total" style="width: 120px;">TOTAL<br>(Rp) - G</th>
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

  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px;">
    <div>
      <div class="grand-total-display">
        Total Pengeluaran (f): <span style="float: right; margin-left: 40px;">${formatRupiah(grandTotal)}</span>
      </div>
      <table class="cash-advance-box">
        <tr>
          <td>Jumlah Cash Advance :</td>
          <td style="text-align: right; font-weight: 600;">${formatRupiah(cashAdvance)}</td>
        </tr>
        <tr>
          <td>Jumlah yang diklaim</td>
          <td style="text-align: right; font-weight: 600;">${formatRupiah(grandTotal)}</td>
        </tr>
        <tr>
          <td>Jumlah pengembalian dana</td>
          <td style="text-align: right; font-weight: 700; color: ${refund < 0 ? '#c53030' : '#15803d'};">
            ${formatRupiah(refund)}
          </td>
        </tr>
      </table>

      <div class="signatures-container">
        <div style="font-size: 11px; margin-bottom: 4px;">${city}, ${reportDate}</div>
        <table class="signatures-table">
          <thead>
            <tr>
              <th style="width: 33%;">Dibuat oleh,</th>
              <th style="width: 33%;">Diperiksa</th>
              <th style="width: 34%;">Diperiksa & Diketahui oleh,</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${employeeName}</td>
              <td>${verifierName}</td>
              <td>${approverName}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
 * Mengonversi seluruh data transaksi dan rincian item ke format CSV / Spreadsheet tabel rekapitulasi kantor
 */
export function generateCompanyExpenseReportCSV(
  transactions: Transaction[],
  profile?: UserProfile
): string {
  const companyName = profile?.company_name || 'PT. Nama Perusahaan';
  const employeeName = profile?.full_name || 'User 1';
  const department = profile?.department || 'Divisi Operasional';
  const reportDate = profile?.submission_date || formatDateOnly(new Date());
  const projectName = profile?.project_name || 'Head Office / Proyek 1';
  const city = profile?.city || 'Jakarta';
  const verifierName = profile?.verifier_name || 'Pemeriksa 1';
  const approverName = profile?.approver_name || 'Pimpinan 1';
  const cashAdvance = Number(profile?.cash_advance_amount) || 5000000;

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  let csv = '';

  // 1. Header Profil Atas (Persis Foto 2)
  csv += `Nama Perusahaan\t:\t${companyName}\t\t\t\t\t\t\n`;
  csv += `Nama\t:\t${employeeName}\t\t\t\t\t\t\n`;
  csv += `Dept/Divisi\t:\t${department}\t\t\t\t\t\t\n`;
  csv += `Tanggal\t:\t${reportDate}\t\t\t\t\t\t\n`;
  csv += `Project\t:\t${projectName}\t\t\t\t\t\t\n`;
  csv += `----------------------------------------------------------------------------------------------------\n`;

  // 2. Header Tabel Kolom (Persis Foto 2)
  csv += `TANGGAL\tNO\tKETERANGAN\tJUMLAH ITEM\tOperational (Rp) - B\tPantry (Rp) - C\tFasilitas (Rp) - D\tLain-Lain (Rp) - F\tTOTAL (Rp) - G\n`;

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

        const cleanName = it.item_name;
        const qtyStr = `${it.quantity || 1} Pcs`;

        csv += `${txDateStr}\t${rowNo}\t${cleanName}\t${qtyStr}\t${bVal}\t${cVal}\t${dVal}\t${fVal}\t${itTotal}\n`;
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

      csv += `${txDateStr}\t${rowNo}\t${tx.merchant_name}\t1 Paket\t${bVal}\t${cVal}\t${dVal}\t${fVal}\t${total}\n`;
      rowNo++;
    }

    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      csv += `${txDateStr}\t${rowNo}\tDiskon / Voucher\t-\t\t\t\t-${tx.discount_amount}\t-${tx.discount_amount}\n`;
      rowNo++;
    }
  });

  // 3. Baris Total Tabel (Persis Foto 3)
  csv += `\t\t\tTOTAL\t${sumOperational || 0}\t${sumPantry || 0}\t${sumFasilitas || 0}\t${sumLainLain || 0}\t${grandTotal}\n\n`;

  // 4. Rekapitulasi Cash Advance (Persis Foto 3)
  csv += `Total Pengeluaran (f)\t\t\t\t\t\t\t\t${grandTotal}\n`;
  csv += `----------------------------------------------------------------------------------------------------\n`;
  csv += `Jumlah Cash Advance :\t\t\t\t${cashAdvance}\n`;
  csv += `Jumlah yang diklaim\t\t\t\t${grandTotal}\n`;
  const refund = cashAdvance - grandTotal;
  csv += `Jumlah pengembalian dana\t\t\t\t${refund}\n\n`;

  // 5. Kotak Tanda Tangan (Persis Foto 3)
  csv += `${city}, ${reportDate}\n`;
  csv += `Dibuat oleh,\t\t\tDiperiksa\t\t\tDiperiksa & Diketahui oleh,\n\n\n`;
  csv += `${employeeName}\t\t\t${verifierName}\t\t\t${approverName}\n`;

  return csv;
}

/**
 * Memicu download berkas Spreadsheet / CSV di browser atau perangkat
 */
export function downloadCSV(csvContent: string, fileName = 'Rekapitulasi_Pengeluaran_Klaim.xls') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
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

