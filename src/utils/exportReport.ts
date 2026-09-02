import { Transaction, UserProfile } from '@/types';
import { formatDateShort, formatRupiah } from './formatters';
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
    const txDateStr = formatDateShort(tx.transaction_date);
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

    // Catat Biaya Layanan / Admin (jika ada) ke kolom Lain-Lain
    if (tx.admin_fee && Number(tx.admin_fee) > 0) {
      const feeVal = Number(tx.admin_fee);
      grandTotal += feeVal;
      sumLainLain += feeVal;
      rowsHTML += `
        <tr style="height: 28px;">
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
          <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">Biaya Layanan / Admin (${tx.merchant_name})</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">1 Trx</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${feeVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${feeVal}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Ongkos Kirim (jika ada) ke kolom Operational / Lain-Lain
    if (tx.shipping_fee && Number(tx.shipping_fee) > 0) {
      const shipVal = Number(tx.shipping_fee);
      grandTotal += shipVal;
      sumOperational += shipVal;
      rowsHTML += `
        <tr style="height: 28px;">
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
          <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">Ongkos Kirim (${tx.merchant_name})</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">1 Trx</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${shipVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${shipVal}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Pajak / PPN (jika ada) ke kolom Lain-Lain
    if (tx.tax_amount && Number(tx.tax_amount) > 0) {
      const taxVal = Number(tx.tax_amount);
      grandTotal += taxVal;
      sumLainLain += taxVal;
      rowsHTML += `
        <tr style="height: 28px;">
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${txDateStr}</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">${rowNo}</td>
          <td style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px;">Pajak / PPN (${tx.merchant_name})</td>
          <td style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px;">-</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${taxVal}</td>
          <td style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';">${taxVal}</td>
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
    <col width="120" />
    <col width="45" />
    <col width="460" />
    <col width="115" />
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
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 120px;">TANGGAL</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 45px;">NO</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 460px;">KETERANGAN</td>
      <td rowspan="2" class="th-header" style="background-color: #FFFFFF; width: 115px;">JUMLAH ITEM</td>
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
    const txDateStr = formatDateShort(tx.transaction_date);
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

    // Catat Biaya Layanan / Admin (jika ada) ke kolom Lain-Lain
    if (tx.admin_fee && Number(tx.admin_fee) > 0) {
      const feeVal = Number(tx.admin_fee);
      grandTotal += feeVal;
      sumLainLain += feeVal;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Biaya Layanan / Admin (${tx.merchant_name})`),
          escapeCSV('1 Trx'),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(feeVal),
          escapeCSV(feeVal),
        ].join(',')
      );
      rowNo++;
    }

    // Catat Ongkos Kirim (jika ada) ke kolom Operational
    if (tx.shipping_fee && Number(tx.shipping_fee) > 0) {
      const shipVal = Number(tx.shipping_fee);
      grandTotal += shipVal;
      sumOperational += shipVal;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Ongkos Kirim (${tx.merchant_name})`),
          escapeCSV('1 Trx'),
          escapeCSV(shipVal),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(shipVal),
        ].join(',')
      );
      rowNo++;
    }

    // Catat Pajak / PPN (jika ada) ke kolom Lain-Lain
    if (tx.tax_amount && Number(tx.tax_amount) > 0) {
      const taxVal = Number(tx.tax_amount);
      grandTotal += taxVal;
      sumLainLain += taxVal;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Pajak / PPN (${tx.merchant_name})`),
          escapeCSV('-'),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(taxVal),
          escapeCSV(taxVal),
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
  fileName?: string,
  targetWindow?: any
): Promise<{ success: boolean; message: string; spreadsheetUrl: string }> {
  const name =
    fileName ||
    `Rekap_Klaim_${(profile?.company_name || 'SKA').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

  // 1. Salin tabel berformat ke clipboard (jika user ingin paste di tempat lain)
  try {
    await copyFormattedTableToClipboard(transactions, profile);
  } catch {}

  // 2. Buat file Google Spreadsheet langsung di Google Drive
  const csv = generateCompanyExpenseReportCSV(transactions, profile);
  const cloudRes = await cloudExportToGDrive(csv, name);

  // 3. Buka URL Google Sheets di tab browser
  const targetUrl = cloudRes.isDirectCloud ? cloudRes.spreadsheetUrl : 'https://sheets.new';
  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = targetUrl;
  } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(targetUrl, '_blank');
  } else {
    Linking.openURL(targetUrl);
  }

  return {
    success: true,
    message: cloudRes.isDirectCloud
      ? 'Google Spreadsheet berhasil dibuat langsung di Google Drive Anda!'
      : 'Google Spreadsheet dibuka! Tabel otomatis tersalin ke Clipboard (tekan Ctrl+V / Paste).',
    spreadsheetUrl: targetUrl,
  };
}


