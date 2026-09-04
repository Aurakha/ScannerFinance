import { CashAdvance, Transaction, UserProfile } from '@/types';
import { formatDateShort, formatRupiah } from './formatters';
import { Platform, Linking } from 'react-native';
import { exportToGoogleSpreadsheet as cloudExportToGDrive } from '@/services/googleDriveService';
import { useCashAdvanceStore } from '@/store/cashAdvanceStore';
import XLSX from 'xlsx-js-style';

export interface CompanyReportOptions {
  profile?: UserProfile;
}

/**
 * Menyelesaikan metadata laporan berdasarkan Cash Advance aktif dan profil pengguna
 */
export function resolveReportMetadata(
  profile?: UserProfile,
  activeCA?: CashAdvance | null,
  reportDateOverride?: string
) {
  const ca = activeCA !== undefined ? activeCA : useCashAdvanceStore.getState().getActiveCashAdvance();

  const companyName = profile?.company_name || 'PT. San Kawan Abadi';
  const employeeName = profile?.full_name || 'Gabriel Rudra Renata';
  const department = profile?.department || 'Operation';
  const reportDate = reportDateOverride || profile?.submission_date || '1 Agustus 2026';
  const projectName = ca?.project_name || profile?.project_name || 'Head Office';
  const city = ca?.city || profile?.city || 'Tangerang';
  const verifierName = ca?.verifier_name || profile?.verifier_name || 'Yunitha';
  const approverName = ca?.approver_name || profile?.approver_name || 'Dwi Hartanto';
  const cashAdvance =
    ca?.initial_amount !== undefined
      ? Number(ca.initial_amount)
      : Number(profile?.cash_advance_amount) || 7000000;

  return {
    companyName,
    employeeName,
    department,
    reportDate,
    projectName,
    city,
    verifierName,
    approverName,
    cashAdvance,
  };
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
  profile?: UserProfile,
  reportDateOverride?: string,
  activeCA?: CashAdvance | null
): string {
  const {
    companyName,
    employeeName,
    department,
    reportDate,
    projectName,
    city,
    verifierName,
    approverName,
    cashAdvance,
  } = resolveReportMetadata(profile, activeCA, reportDateOverride);

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
        const currentRow = 8 + rowNo;

        rowsHTML += `
          <tr style="height: 28px;">
            <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
            <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
            <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap;">${it.item_name}</td>
            <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${qtyStr}</td>
            <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${bVal ? `x:num="${bVal}"` : ''}>${bVal}</td>
            <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${cVal ? `x:num="${cVal}"` : ''}>${cVal}</td>
            <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${dVal ? `x:num="${dVal}"` : ''}>${dVal}</td>
            <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${fVal ? `x:num="${fVal}"` : ''}>${fVal}</td>
            <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${itTotal}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${itTotal}</td>
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

      const currentRow = 8 + rowNo;

      rowsHTML += `
        <tr style="height: 28px;">
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
          <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap;">${tx.merchant_name}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">1x</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${bVal ? `x:num="${bVal}"` : ''}>${bVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${cVal ? `x:num="${cVal}"` : ''}>${cVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${dVal ? `x:num="${dVal}"` : ''}>${dVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" ${fVal ? `x:num="${fVal}"` : ''}>${fVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${total}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${total}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Diskon / Potongan Promo (jika ada) sebagai baris pengurangan
    if (tx.discount_amount && Number(tx.discount_amount) > 0) {
      const discVal = Number(tx.discount_amount);
      const negVal = -discVal;
      grandTotal += negVal;

      let bVal = '';
      let cVal = '';
      let dVal = '';
      let fVal = '';

      if (catCol === 'operational') {
        bVal = String(negVal);
        sumOperational += negVal;
      } else if (catCol === 'pantry') {
        cVal = String(negVal);
        sumPantry += negVal;
      } else if (catCol === 'fasilitas') {
        dVal = String(negVal);
        sumFasilitas += negVal;
      } else {
        fVal = String(negVal);
        sumLainLain += negVal;
      }

      const currentRow = 8 + rowNo;

      rowsHTML += `
        <tr style="height: 28px;">
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
          <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap; color: #DC2626;">Diskon / Potongan Promo (${tx.merchant_name})</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">1x</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; color: #DC2626; mso-number-format:'\\0022Rp\\0022\\ #\\,##0;(\\0022Rp\\0022\\ #\\,##0)';" ${bVal ? `x:num="${negVal}"` : ''}>${bVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; color: #DC2626; mso-number-format:'\\0022Rp\\0022\\ #\\,##0;(\\0022Rp\\0022\\ #\\,##0)';" ${cVal ? `x:num="${negVal}"` : ''}>${cVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; color: #DC2626; mso-number-format:'\\0022Rp\\0022\\ #\\,##0;(\\0022Rp\\0022\\ #\\,##0)';" ${dVal ? `x:num="${negVal}"` : ''}>${dVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; color: #DC2626; mso-number-format:'\\0022Rp\\0022\\ #\\,##0;(\\0022Rp\\0022\\ #\\,##0)';" ${fVal ? `x:num="${negVal}"` : ''}>${fVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; color: #DC2626; mso-number-format:'\\0022Rp\\0022\\ #\\,##0;(\\0022Rp\\0022\\ #\\,##0)';" x:num="${negVal}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${negVal}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Biaya Layanan / Admin (jika ada) ke kolom Lain-Lain
    if (tx.admin_fee && Number(tx.admin_fee) > 0) {
      const feeVal = Number(tx.admin_fee);
      grandTotal += feeVal;
      sumLainLain += feeVal;
      const currentRow = 8 + rowNo;

      rowsHTML += `
        <tr style="height: 28px;">
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
          <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap;">Biaya Layanan / Admin (${tx.merchant_name})</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">1x</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${feeVal}">${feeVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${feeVal}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${feeVal}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Ongkos Kirim (jika ada) ke kolom Operational
    if (tx.shipping_fee && Number(tx.shipping_fee) > 0) {
      const shipVal = Number(tx.shipping_fee);
      grandTotal += shipVal;
      sumOperational += shipVal;
      const currentRow = 8 + rowNo;

      rowsHTML += `
        <tr style="height: 28px;">
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
          <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap;">Ongkos Kirim (${tx.merchant_name})</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">1x</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${shipVal}">${shipVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${shipVal}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${shipVal}</td>
        </tr>
      `;
      rowNo++;
    }

    // Catat Pajak / PPN (jika ada) ke kolom Lain-Lain
    if (tx.tax_amount && Number(tx.tax_amount) > 0) {
      const taxVal = Number(tx.tax_amount);
      grandTotal += taxVal;
      sumLainLain += taxVal;
      const currentRow = 8 + rowNo;

      rowsHTML += `
        <tr style="height: 28px;">
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${txDateStr}</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">${rowNo}</td>
          <td align="left" valign="middle" style="border: 1px solid #000000; text-align: left; vertical-align: middle; padding: 4px 10px; width: 390px; white-space: nowrap;">Pajak / PPN (${tx.merchant_name})</td>
          <td align="center" valign="middle" style="border: 1px solid #000000; text-align: center; vertical-align: middle; padding: 4px 6px; white-space: nowrap;">1x</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';"></td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${taxVal}">${taxVal}</td>
          <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${taxVal}" x:fmla="=SUM(E${currentRow}:H${currentRow})">${taxVal}</td>
        </tr>
      `;
      rowNo++;
    }
  });

  const totalItemCount = rowNo - 1;
  const startDataRow = 9;
  const endDataRow = totalItemCount > 0 ? 8 + totalItemCount : 9;
  const totalRowIndex = endDataRow + 1;
  const summaryStartRow = totalRowIndex + 2; // Baris Total Pengeluaran (f)
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
          <x:Name>Expense Report</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
            <x:FitToPage/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; margin: 0; padding: 12px; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; }
    td { padding: 4px 8px; vertical-align: middle; }
    .th-header { border: 1px solid #000000; text-align: center; vertical-align: middle; font-weight: bold; font-size: 10pt; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col width="140" style="width: 140px;" />
      <col width="60" style="width: 60px;" />
      <col width="540" style="width: 540px;" />
      <col width="150" style="width: 150px;" />
      <col width="140" style="width: 140px;" />
      <col width="140" style="width: 140px;" />
      <col width="140" style="width: 140px;" />
      <col width="140" style="width: 140px;" />
      <col width="150" style="width: 150px;" />
    </colgroup>

    <!-- Metadata Section -->
    <tr style="height: 24px;">
      <td style="font-weight: bold; width: 140px; white-space: nowrap;">Nama Perusahaan</td>
      <td align="center" style="text-align: center; font-weight: bold; width: 60px; white-space: nowrap;">:</td>
      <td colspan="7" style="font-weight: bold; width: 540px; white-space: nowrap;">${companyName}</td>
    </tr>
    <tr style="height: 24px;">
      <td style="font-weight: bold; white-space: nowrap;">Nama</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td colspan="7" style="white-space: nowrap;">${employeeName}</td>
    </tr>
    <tr style="height: 24px;">
      <td style="font-weight: bold; white-space: nowrap;">Dept/Divisi</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td colspan="7" style="white-space: nowrap;">${department}</td>
    </tr>
    <tr style="height: 24px;">
      <td style="font-weight: bold; white-space: nowrap;">Tanggal</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td colspan="7" style="white-space: nowrap;">${reportDate}</td>
    </tr>
    <tr style="height: 24px;">
      <td style="font-weight: bold; white-space: nowrap;">Project</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td colspan="7" style="white-space: nowrap;">${projectName}</td>
    </tr>
    <tr style="height: 16px;"><td colspan="9"></td></tr>

    <!-- Table Header (2 Rows) with distinct pastel colors -->
    <tr style="height: 34px;">
      <td rowspan="2" class="th-header" align="center" valign="middle" style="background-color: #FFFFFF; width: 140px; white-space: nowrap; padding: 6px 8px; text-align: center; vertical-align: middle;">TANGGAL</td>
      <td rowspan="2" class="th-header" align="center" valign="middle" style="background-color: #FFFFFF; width: 60px; white-space: nowrap; padding: 6px 6px; text-align: center; vertical-align: middle;">NO</td>
      <td rowspan="2" class="th-header" align="center" valign="middle" style="background-color: #FFFFFF; width: 540px; white-space: nowrap; padding: 6px 14px; text-align: center; vertical-align: middle;">KETERANGAN</td>
      <td rowspan="2" class="th-header" align="center" valign="middle" style="background-color: #FFFFFF; width: 150px; white-space: nowrap; padding: 6px 8px; text-align: center; vertical-align: middle;">JUMLAH ITEM</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #FEF08A; width: 140px; white-space: nowrap; text-align: center; vertical-align: middle;">Operational</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #BBF7D0; width: 140px; white-space: nowrap; text-align: center; vertical-align: middle;">Pantry</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #FBCFE8; width: 140px; white-space: nowrap; text-align: center; vertical-align: middle;">Fasilitas</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #BAE6FD; width: 140px; white-space: nowrap; text-align: center; vertical-align: middle;">Lain-Lain</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #E2E8F0; width: 150px; white-space: nowrap; text-align: center; vertical-align: middle;">TOTAL</td>
    </tr>
    <tr style="height: 26px;">
      <td class="th-header" align="center" valign="middle" style="background-color: #FEF08A; font-size: 9.5pt; white-space: nowrap; text-align: center; vertical-align: middle;">(Rp) - B</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #BBF7D0; font-size: 9.5pt; white-space: nowrap; text-align: center; vertical-align: middle;">(Rp) - C</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #FBCFE8; font-size: 9.5pt; white-space: nowrap; text-align: center; vertical-align: middle;">(Rp) - D</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #BAE6FD; font-size: 9.5pt; white-space: nowrap; text-align: center; vertical-align: middle;">(Rp) - F</td>
      <td class="th-header" align="center" valign="middle" style="background-color: #E2E8F0; font-size: 9.5pt; white-space: nowrap; text-align: center; vertical-align: middle;">(Rp) - G</td>
    </tr>

    <!-- Data Rows -->
    ${rowsHTML}

    <!-- TOTAL Row with SUM formulas -->
    <tr style="height: 30px; font-weight: bold; background-color: #F8FAFC;">
      <td colspan="4" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; vertical-align: middle; white-space: nowrap;">TOTAL</td>
      <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${sumOperational}" x:fmla="=SUM(E${startDataRow}:E${endDataRow})">${sumOperational}</td>
      <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${sumPantry}" x:fmla="=SUM(F${startDataRow}:F${endDataRow})">${sumPantry}</td>
      <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${sumFasilitas}" x:fmla="=SUM(G${startDataRow}:G${endDataRow})">${sumFasilitas}</td>
      <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${sumLainLain}" x:fmla="=SUM(H${startDataRow}:H${endDataRow})">${sumLainLain}</td>
      <td align="right" valign="middle" style="border: 1px solid #000000; text-align: right; vertical-align: middle; padding: 4px 10px; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${grandTotal}" x:fmla="=SUM(I${startDataRow}:I${endDataRow})">${grandTotal}</td>
    </tr>
    <tr style="height: 18px;"><td colspan="9"></td></tr>

    <!-- Summary Box with Formulas -->
    <tr style="height: 24px;">
      <td colspan="3" align="left" style="font-weight: bold; white-space: nowrap;">Total Pengeluaran (f)</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td align="right" style="text-align: right; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${grandTotal}" x:fmla="=I${totalRowIndex}">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3" align="left" style="white-space: nowrap;">Jumlah Cash Advance</td>
      <td align="center" style="text-align: center; white-space: nowrap;">:</td>
      <td align="right" style="text-align: right; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${cashAdvance}">${cashAdvance}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3" align="left" style="white-space: nowrap;">Jumlah yang diklaim</td>
      <td align="center" style="text-align: center; white-space: nowrap;">:</td>
      <td align="right" style="text-align: right; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${grandTotal}" x:fmla="=E${summaryStartRow}">${grandTotal}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;">
      <td colspan="3" align="left" style="font-weight: bold; white-space: nowrap;">Jumlah pengembalian dana</td>
      <td align="center" style="text-align: center; font-weight: bold; white-space: nowrap;">:</td>
      <td align="right" style="text-align: right; font-weight: bold; white-space: nowrap; mso-number-format:'\\0022Rp\\0022\\ #\\,##0';" x:num="${refund}" x:fmla="=(E${summaryStartRow + 1}-E${summaryStartRow + 2})">${refund}</td>
      <td colspan="4"></td>
    </tr>
    <tr style="height: 24px;"><td colspan="9"></td></tr>

    <!-- Signatures Section -->
    <tr style="height: 24px;">
      <td colspan="4" align="left" style="font-weight: bold; white-space: nowrap;">${city}, ${reportDate}</td>
      <td colspan="5"></td>
    </tr>
    <tr style="height: 26px;">
      <td colspan="2" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle; white-space: nowrap;">Dibuat oleh,</td>
      <td colspan="2" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle; white-space: nowrap;">Diperiksa</td>
      <td colspan="3" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; background-color: #F8FAFC; vertical-align: middle; white-space: nowrap;">Diperiksa & Diketahui oleh,</td>
      <td colspan="2"></td>
    </tr>
    <tr style="height: 60px;">
      <td colspan="2" style="border: 1px solid #000000;"></td>
      <td colspan="2" style="border: 1px solid #000000;"></td>
      <td colspan="3" style="border: 1px solid #000000;"></td>
      <td colspan="2"></td>
    </tr>
    <tr style="height: 28px;">
      <td colspan="2" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle; white-space: nowrap;">${employeeName}</td>
      <td colspan="2" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle; white-space: nowrap;">${verifierName}</td>
      <td colspan="3" align="center" valign="middle" style="border: 1px solid #000000; text-align: center; font-weight: bold; text-decoration: underline; vertical-align: middle; white-space: nowrap;">${approverName}</td>
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
  profile?: UserProfile,
  activeCA?: CashAdvance | null
): string {
  const {
    companyName,
    employeeName,
    department,
    reportDate,
    projectName,
    city,
    verifierName,
    approverName,
    cashAdvance,
  } = resolveReportMetadata(profile, activeCA);

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

    // Catat Diskon / Potongan Promo (jika ada) ke CSV
    if (tx.discount_amount && Number(tx.discount_amount) > 0) {
      const discVal = Number(tx.discount_amount);
      const negVal = -discVal;
      grandTotal += negVal;

      let bVal = '';
      let cVal = '';
      let dVal = '';
      let fVal = '';

      if (catCol === 'operational') {
        bVal = String(negVal);
        sumOperational += negVal;
      } else if (catCol === 'pantry') {
        cVal = String(negVal);
        sumPantry += negVal;
      } else if (catCol === 'fasilitas') {
        dVal = String(negVal);
        sumFasilitas += negVal;
      } else {
        fVal = String(negVal);
        sumLainLain += negVal;
      }

      const currentRow = 8 + rowNo;

      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Diskon / Potongan Promo (${tx.merchant_name})`),
          escapeCSV('1x'),
          escapeCSV(bVal),
          escapeCSV(cVal),
          escapeCSV(dVal),
          escapeCSV(fVal),
          escapeCSV(`=SUM(E${currentRow}:H${currentRow})`),
        ].join(',')
      );
      rowNo++;
    }

    // Catat Biaya Layanan / Admin (jika ada) ke kolom Lain-Lain
    if (tx.admin_fee && Number(tx.admin_fee) > 0) {
      const feeVal = Number(tx.admin_fee);
      grandTotal += feeVal;
      sumLainLain += feeVal;
      const currentRow = 8 + rowNo;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Biaya Layanan / Admin (${tx.merchant_name})`),
          escapeCSV('1x'),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(feeVal),
          escapeCSV(`=SUM(E${currentRow}:H${currentRow})`),
        ].join(',')
      );
      rowNo++;
    }

    // Catat Ongkos Kirim (jika ada) ke kolom Operational
    if (tx.shipping_fee && Number(tx.shipping_fee) > 0) {
      const shipVal = Number(tx.shipping_fee);
      grandTotal += shipVal;
      sumOperational += shipVal;
      const currentRow = 8 + rowNo;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Ongkos Kirim (${tx.merchant_name})`),
          escapeCSV('1x'),
          escapeCSV(shipVal),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(`=SUM(E${currentRow}:H${currentRow})`),
        ].join(',')
      );
      rowNo++;
    }

    // Catat Pajak / PPN (jika ada) ke kolom Lain-Lain
    if (tx.tax_amount && Number(tx.tax_amount) > 0) {
      const taxVal = Number(tx.tax_amount);
      grandTotal += taxVal;
      sumLainLain += taxVal;
      const currentRow = 8 + rowNo;
      lines.push(
        [
          escapeCSV(txDateStr),
          escapeCSV(rowNo),
          escapeCSV(`Pajak / PPN (${tx.merchant_name})`),
          escapeCSV('1x'),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(''),
          escapeCSV(taxVal),
          escapeCSV(`=SUM(E${currentRow}:H${currentRow})`),
        ].join(',')
      );
      rowNo++;
    }
  });

  const totalItemCount = rowNo - 1;
  const startDataRow = 9;
  const endDataRow = totalItemCount > 0 ? 8 + totalItemCount : 9;
  const totalRowIndex = endDataRow + 1;
  const summaryStartRow = totalRowIndex + 2;

  // Total row
  lines.push(
    [
      escapeCSV('TOTAL'),
      escapeCSV(''),
      escapeCSV(''),
      escapeCSV(''),
      escapeCSV(`=SUM(E${startDataRow}:E${endDataRow})`),
      escapeCSV(`=SUM(F${startDataRow}:F${endDataRow})`),
      escapeCSV(`=SUM(G${startDataRow}:G${endDataRow})`),
      escapeCSV(`=SUM(H${startDataRow}:H${endDataRow})`),
      escapeCSV(`=SUM(I${startDataRow}:I${endDataRow})`),
    ].join(',')
  );

  lines.push('');
  lines.push(`${escapeCSV('Total Pengeluaran (f)')},${escapeCSV(':')},${escapeCSV(`=I${totalRowIndex}`)}`);
  lines.push(`${escapeCSV('Jumlah Cash Advance')},${escapeCSV(':')},${escapeCSV(cashAdvance)}`);
  lines.push(`${escapeCSV('Jumlah yang diklaim')},${escapeCSV(':')},${escapeCSV(`=E${summaryStartRow}`)}`);
  lines.push(`${escapeCSV('Jumlah pengembalian dana')},${escapeCSV(':')},${escapeCSV(`=(E${summaryStartRow + 1}-E${summaryStartRow + 2})`)}`);

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
  profile?: UserProfile,
  activeCA?: CashAdvance | null
): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      const xlsHTML = generateCompanyExpenseReportXLS(transactions, profile, undefined, activeCA);
      const csv = generateCompanyExpenseReportCSV(transactions, profile, activeCA);

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
 * Memicu download berkas (Excel .xlsx / .xls atau CSV) di browser
 */
export function downloadFile(
  content: any,
  fileName: string,
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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
 * Helper untuk membuat nama file seragam dengan foto struk: tanggal_namaUser_jam
 */
export function generateReportFileName(profile?: UserProfile): string {
  const today = new Date();
  const day = today.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = monthNames[today.getMonth()];
  const year = String(today.getFullYear()).slice(-2);
  const timeSuffix = `${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;
  const cleanName = (profile?.full_name || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${day}-${month}-${year}_${cleanName}_${timeSuffix}`;
}

export interface MonthExpenseGroup {
  monthKey: string;     // e.g. '2026-09'
  monthLabel: string;   // e.g. 'September 2026' or 'Sep 2026'
  transactions: Transaction[];
}

/**
 * Membangun satu worksheet XLSX lengkap dengan format laporan resmi SKA
 */
export function buildCompanyExpenseWorksheet(
  transactions: Transaction[],
  profile?: UserProfile,
  reportDateOverride?: string,
  activeCA?: CashAdvance | null
): any {
  const {
    companyName,
    employeeName,
    department,
    reportDate,
    projectName,
    city,
    verifierName,
    approverName,
    cashAdvance,
  } = resolveReportMetadata(profile, activeCA, reportDateOverride);

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  const ws: any = {};

  const setCell = (r: number, c: number, cell: any) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    ws[ref] = cell;
  };

  // Border standard 1px black
  const borderAll = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  const fontRegular = { name: 'Calibri', sz: 10, color: { rgb: '000000' } };
  const fontBold = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } };
  const fontSubHeader = { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '000000' } };
  const fontUnderlineBold = { name: 'Calibri', sz: 10, bold: true, underline: true, color: { rgb: '000000' } };

  const idrFormat = '"Rp "#,##0;("Rp "#,##0);"-"';

  // Metadata styling
  const metaLabelStyle = { font: fontBold, alignment: { vertical: 'center', horizontal: 'left' } };
  const metaColonStyle = { font: fontBold, alignment: { vertical: 'center', horizontal: 'center' } };
  const metaValBoldStyle = { font: fontBold, alignment: { vertical: 'center', horizontal: 'left' } };
  const metaValStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'left' } };

  setCell(0, 0, { t: 's', v: 'Nama Perusahaan', s: metaLabelStyle });
  setCell(0, 1, { t: 's', v: ':', s: metaColonStyle });
  setCell(0, 2, { t: 's', v: companyName, s: metaValBoldStyle });

  setCell(1, 0, { t: 's', v: 'Nama', s: metaLabelStyle });
  setCell(1, 1, { t: 's', v: ':', s: metaColonStyle });
  setCell(1, 2, { t: 's', v: employeeName, s: metaValStyle });

  setCell(2, 0, { t: 's', v: 'Dept/Divisi', s: metaLabelStyle });
  setCell(2, 1, { t: 's', v: ':', s: metaColonStyle });
  setCell(2, 2, { t: 's', v: department, s: metaValStyle });

  setCell(3, 0, { t: 's', v: 'Tanggal', s: metaLabelStyle });
  setCell(3, 1, { t: 's', v: ':', s: metaColonStyle });
  setCell(3, 2, { t: 's', v: reportDate, s: metaValStyle });

  setCell(4, 0, { t: 's', v: 'Project', s: metaLabelStyle });
  setCell(4, 1, { t: 's', v: ':', s: metaColonStyle });
  setCell(4, 2, { t: 's', v: projectName, s: metaValStyle });

  // Header 2 Rows (Row 6 and 7, 0-indexed)
  const headerWhiteStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: borderAll,
    fill: { fgColor: { rgb: 'FFFFFF' } },
  };

  const opHeaderStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'FEF08A' } }, // Pastel Yellow
  };
  const opSubHeaderStyle = {
    font: fontSubHeader,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'FEF08A' } },
  };

  const pantryHeaderStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'BBF7D0' } }, // Pastel Green
  };
  const pantrySubHeaderStyle = {
    font: fontSubHeader,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'BBF7D0' } },
  };

  const fasHeaderStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'FBCFE8' } }, // Pastel Pink
  };
  const fasSubHeaderStyle = {
    font: fontSubHeader,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'FBCFE8' } },
  };

  const lainHeaderStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'BAE6FD' } }, // Pastel Blue
  };
  const lainSubHeaderStyle = {
    font: fontSubHeader,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'BAE6FD' } },
  };

  const totalHeaderStyle = {
    font: fontBold,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'E2E8F0' } }, // Pastel Gray
  };
  const totalSubHeaderStyle = {
    font: fontSubHeader,
    alignment: { vertical: 'center', horizontal: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'E2E8F0' } },
  };

  // Row 6 Headers
  setCell(6, 0, { t: 's', v: 'TANGGAL', s: headerWhiteStyle });
  setCell(6, 1, { t: 's', v: 'NO', s: headerWhiteStyle });
  setCell(6, 2, { t: 's', v: 'KETERANGAN', s: headerWhiteStyle });
  setCell(6, 3, { t: 's', v: 'JUMLAH ITEM', s: headerWhiteStyle });
  setCell(6, 4, { t: 's', v: 'Operational', s: opHeaderStyle });
  setCell(6, 5, { t: 's', v: 'Pantry', s: pantryHeaderStyle });
  setCell(6, 6, { t: 's', v: 'Fasilitas', s: fasHeaderStyle });
  setCell(6, 7, { t: 's', v: 'Lain-Lain', s: lainHeaderStyle });
  setCell(6, 8, { t: 's', v: 'TOTAL', s: totalHeaderStyle });

  // Row 7 Subheaders (including blank bottom cells for merged headers)
  setCell(7, 0, { t: 's', v: '', s: headerWhiteStyle });
  setCell(7, 1, { t: 's', v: '', s: headerWhiteStyle });
  setCell(7, 2, { t: 's', v: '', s: headerWhiteStyle });
  setCell(7, 3, { t: 's', v: '', s: headerWhiteStyle });
  setCell(7, 4, { t: 's', v: '(Rp) - B', s: opSubHeaderStyle });
  setCell(7, 5, { t: 's', v: '(Rp) - C', s: pantrySubHeaderStyle });
  setCell(7, 6, { t: 's', v: '(Rp) - D', s: fasSubHeaderStyle });
  setCell(7, 7, { t: 's', v: '(Rp) - F', s: lainSubHeaderStyle });
  setCell(7, 8, { t: 's', v: '(Rp) - G', s: totalSubHeaderStyle });

  // Data cell styles
  const cellDateStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'center' }, border: borderAll };
  const cellNoStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'center' }, border: borderAll };
  const cellDescStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'left' }, border: borderAll };
  const cellDescRedStyle = { font: { ...fontRegular, color: { rgb: 'DC2626' } }, alignment: { vertical: 'center', horizontal: 'left' }, border: borderAll };
  const cellQtyStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'center' }, border: borderAll };
  const cellAmountStyle = { font: fontRegular, alignment: { vertical: 'center', horizontal: 'right' }, border: borderAll };
  const cellAmountRedStyle = { font: { ...fontRegular, color: { rgb: 'DC2626' } }, alignment: { vertical: 'center', horizontal: 'right' }, border: borderAll };
  const cellEmptyStyle = { font: fontRegular, border: borderAll };
  const cellRowTotalStyle = { font: fontBold, alignment: { vertical: 'center', horizontal: 'right' }, border: borderAll };
  const cellRowTotalRedStyle = { font: { ...fontBold, color: { rgb: 'DC2626' } }, alignment: { vertical: 'center', horizontal: 'right' }, border: borderAll };

  let rIdx = 8;
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
        const qtyStr = it.quantity ? `${it.quantity} Pcs` : '1 Pcs';

        setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
        setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
        setCell(rIdx, 2, { t: 's', v: it.item_name, s: cellDescStyle });
        setCell(rIdx, 3, { t: 's', v: qtyStr, s: cellQtyStyle });

        let colIdx = 4;
        if (catCol === 'operational') {
          colIdx = 4;
          sumOperational += itTotal;
        } else if (catCol === 'pantry') {
          colIdx = 5;
          sumPantry += itTotal;
        } else if (catCol === 'fasilitas') {
          colIdx = 6;
          sumFasilitas += itTotal;
        } else {
          colIdx = 7;
          sumLainLain += itTotal;
        }

        for (let c = 4; c <= 7; c++) {
          if (c === colIdx) {
            setCell(rIdx, c, { t: 'n', v: itTotal, s: cellAmountStyle, z: idrFormat });
          } else {
            setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
          }
        }

        const excelRow = rIdx + 1;
        setCell(rIdx, 8, {
          t: 'n',
          v: itTotal,
          f: `SUM(E${excelRow}:H${excelRow})`,
          s: cellRowTotalStyle,
          z: idrFormat,
        });

        rIdx++;
        rowNo++;
      });
    } else {
      const total = Number(tx.total_amount) || 0;
      grandTotal += total;

      setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
      setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
      setCell(rIdx, 2, { t: 's', v: tx.merchant_name, s: cellDescStyle });
      setCell(rIdx, 3, { t: 's', v: '1 Paket', s: cellQtyStyle });

      let colIdx = 4;
      if (catCol === 'operational') {
        colIdx = 4;
        sumOperational += total;
      } else if (catCol === 'pantry') {
        colIdx = 5;
        sumPantry += total;
      } else if (catCol === 'fasilitas') {
        colIdx = 6;
        sumFasilitas += total;
      } else {
        colIdx = 7;
        sumLainLain += total;
      }

      for (let c = 4; c <= 7; c++) {
        if (c === colIdx) {
          setCell(rIdx, c, { t: 'n', v: total, s: cellAmountStyle, z: idrFormat });
        } else {
          setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
        }
      }

      const excelRow = rIdx + 1;
      setCell(rIdx, 8, {
        t: 'n',
        v: total,
        f: `SUM(E${excelRow}:H${excelRow})`,
        s: cellRowTotalStyle,
        z: idrFormat,
      });

      rIdx++;
      rowNo++;
    }

    // Catat Diskon / Potongan Promo (jika ada)
    if (tx.discount_amount && Number(tx.discount_amount) > 0) {
      const discVal = Number(tx.discount_amount);
      const negVal = -discVal;
      grandTotal += negVal;

      setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
      setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
      setCell(rIdx, 2, { t: 's', v: `Diskon / Potongan Promo (${tx.merchant_name})`, s: cellDescRedStyle });
      setCell(rIdx, 3, { t: 's', v: '1x', s: cellQtyStyle });

      let colIdx = 4;
      if (catCol === 'operational') {
        colIdx = 4;
        sumOperational += negVal;
      } else if (catCol === 'pantry') {
        colIdx = 5;
        sumPantry += negVal;
      } else if (catCol === 'fasilitas') {
        colIdx = 6;
        sumFasilitas += negVal;
      } else {
        colIdx = 7;
        sumLainLain += negVal;
      }

      for (let c = 4; c <= 7; c++) {
        if (c === colIdx) {
          setCell(rIdx, c, { t: 'n', v: negVal, s: cellAmountRedStyle, z: idrFormat });
        } else {
          setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
        }
      }

      const excelRow = rIdx + 1;
      setCell(rIdx, 8, {
        t: 'n',
        v: negVal,
        f: `SUM(E${excelRow}:H${excelRow})`,
        s: cellRowTotalRedStyle,
        z: idrFormat,
      });

      rIdx++;
      rowNo++;
    }

    // Biaya Layanan / Admin
    if (tx.admin_fee && Number(tx.admin_fee) > 0) {
      const feeVal = Number(tx.admin_fee);
      grandTotal += feeVal;
      sumLainLain += feeVal;

      setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
      setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
      setCell(rIdx, 2, { t: 's', v: `Biaya Layanan / Admin (${tx.merchant_name})`, s: cellDescStyle });
      setCell(rIdx, 3, { t: 's', v: '1x', s: cellQtyStyle });

      for (let c = 4; c <= 7; c++) {
        if (c === 7) {
          setCell(rIdx, c, { t: 'n', v: feeVal, s: cellAmountStyle, z: idrFormat });
        } else {
          setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
        }
      }

      const excelRow = rIdx + 1;
      setCell(rIdx, 8, {
        t: 'n',
        v: feeVal,
        f: `SUM(E${excelRow}:H${excelRow})`,
        s: cellRowTotalStyle,
        z: idrFormat,
      });

      rIdx++;
      rowNo++;
    }

    // Ongkos Kirim
    if (tx.shipping_fee && Number(tx.shipping_fee) > 0) {
      const shipVal = Number(tx.shipping_fee);
      grandTotal += shipVal;
      sumOperational += shipVal;

      setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
      setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
      setCell(rIdx, 2, { t: 's', v: `Ongkos Kirim (${tx.merchant_name})`, s: cellDescStyle });
      setCell(rIdx, 3, { t: 's', v: '1x', s: cellQtyStyle });

      for (let c = 4; c <= 7; c++) {
        if (c === 4) {
          setCell(rIdx, c, { t: 'n', v: shipVal, s: cellAmountStyle, z: idrFormat });
        } else {
          setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
        }
      }

      const excelRow = rIdx + 1;
      setCell(rIdx, 8, {
        t: 'n',
        v: shipVal,
        f: `SUM(E${excelRow}:H${excelRow})`,
        s: cellRowTotalStyle,
        z: idrFormat,
      });

      rIdx++;
      rowNo++;
    }

    // Pajak / PPN
    if (tx.tax_amount && Number(tx.tax_amount) > 0) {
      const taxVal = Number(tx.tax_amount);
      grandTotal += taxVal;
      sumLainLain += taxVal;

      setCell(rIdx, 0, { t: 's', v: txDateStr, s: cellDateStyle });
      setCell(rIdx, 1, { t: 'n', v: rowNo, s: cellNoStyle });
      setCell(rIdx, 2, { t: 's', v: `Pajak / PPN (${tx.merchant_name})`, s: cellDescStyle });
      setCell(rIdx, 3, { t: 's', v: '1x', s: cellQtyStyle });

      for (let c = 4; c <= 7; c++) {
        if (c === 7) {
          setCell(rIdx, c, { t: 'n', v: taxVal, s: cellAmountStyle, z: idrFormat });
        } else {
          setCell(rIdx, c, { t: 's', v: '', s: cellEmptyStyle });
        }
      }

      const excelRow = rIdx + 1;
      setCell(rIdx, 8, {
        t: 'n',
        v: taxVal,
        f: `SUM(E${excelRow}:H${excelRow})`,
        s: cellRowTotalStyle,
        z: idrFormat,
      });

      rIdx++;
      rowNo++;
    }
  });

  const startDataRow = 9;
  const endDataRow = rIdx; // 1-based index
  const totalRow = rIdx + 1;
  const totalR = rIdx;

  // Row TOTAL (rIdx)
  const totalFillStyle = {
    font: fontBold,
    border: borderAll,
    fill: { fgColor: { rgb: 'F8FAFC' } },
  };
  const totalCenterStyle = {
    ...totalFillStyle,
    alignment: { vertical: 'center', horizontal: 'center' },
  };
  const totalRightStyle = {
    ...totalFillStyle,
    alignment: { vertical: 'center', horizontal: 'right' },
  };

  setCell(totalR, 0, { t: 's', v: 'TOTAL', s: totalCenterStyle });
  setCell(totalR, 1, { t: 's', v: '', s: totalCenterStyle });
  setCell(totalR, 2, { t: 's', v: '', s: totalCenterStyle });
  setCell(totalR, 3, { t: 's', v: '', s: totalCenterStyle });

  setCell(totalR, 4, { t: 'n', v: sumOperational, f: `SUM(E${startDataRow}:E${endDataRow})`, s: totalRightStyle, z: idrFormat });
  setCell(totalR, 5, { t: 'n', v: sumPantry, f: `SUM(F${startDataRow}:F${endDataRow})`, s: totalRightStyle, z: idrFormat });
  setCell(totalR, 6, { t: 'n', v: sumFasilitas, f: `SUM(G${startDataRow}:G${endDataRow})`, s: totalRightStyle, z: idrFormat });
  setCell(totalR, 7, { t: 'n', v: sumLainLain, f: `SUM(H${startDataRow}:H${endDataRow})`, s: totalRightStyle, z: idrFormat });
  setCell(totalR, 8, { t: 'n', v: grandTotal, f: `SUM(I${startDataRow}:I${endDataRow})`, s: totalRightStyle, z: idrFormat });
  rIdx += 2; // skip 1 row

  // Summary section
  const summaryRow1 = rIdx + 1; // 1-based
  setCell(rIdx, 0, { t: 's', v: 'Total Pengeluaran (f)', s: { font: fontBold, alignment: { horizontal: 'left', vertical: 'center' } } });
  setCell(rIdx, 3, { t: 's', v: ':', s: { font: fontBold, alignment: { horizontal: 'center', vertical: 'center' } } });
  setCell(rIdx, 4, { t: 'n', v: grandTotal, f: `I${totalRow}`, s: { font: fontBold, alignment: { horizontal: 'right', vertical: 'center' } }, z: idrFormat });
  rIdx++;

  const summaryRow2 = rIdx + 1; // 1-based
  setCell(rIdx, 0, { t: 's', v: 'Jumlah Cash Advance', s: { font: fontRegular, alignment: { horizontal: 'left', vertical: 'center' } } });
  setCell(rIdx, 3, { t: 's', v: ':', s: { font: fontRegular, alignment: { horizontal: 'center', vertical: 'center' } } });
  setCell(rIdx, 4, { t: 'n', v: cashAdvance, s: { font: fontRegular, alignment: { horizontal: 'right', vertical: 'center' } }, z: idrFormat });
  rIdx++;

  const summaryRow3 = rIdx + 1; // 1-based
  setCell(rIdx, 0, { t: 's', v: 'Jumlah yang diklaim', s: { font: fontRegular, alignment: { horizontal: 'left', vertical: 'center' } } });
  setCell(rIdx, 3, { t: 's', v: ':', s: { font: fontRegular, alignment: { horizontal: 'center', vertical: 'center' } } });
  setCell(rIdx, 4, { t: 'n', v: grandTotal, f: `E${summaryRow1}`, s: { font: fontRegular, alignment: { horizontal: 'right', vertical: 'center' } }, z: idrFormat });
  rIdx++;

  const refund = cashAdvance - grandTotal;
  setCell(rIdx, 0, { t: 's', v: 'Jumlah pengembalian dana', s: { font: fontBold, alignment: { horizontal: 'left', vertical: 'center' } } });
  setCell(rIdx, 3, { t: 's', v: ':', s: { font: fontBold, alignment: { horizontal: 'center', vertical: 'center' } } });
  setCell(rIdx, 4, { t: 'n', v: refund, f: `E${summaryRow2}-E${summaryRow3}`, s: { font: fontBold, alignment: { horizontal: 'right', vertical: 'center' } }, z: idrFormat });
  rIdx += 2;

  // Signatures
  setCell(rIdx, 0, { t: 's', v: `${city}, ${reportDate}`, s: { font: fontBold, alignment: { horizontal: 'left', vertical: 'center' } } });
  rIdx++;

  const sigHeaderRow = rIdx;
  const sigHeaderStyle = {
    font: fontBold,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
    fill: { fgColor: { rgb: 'F8FAFC' } },
  };

  setCell(sigHeaderRow, 0, { t: 's', v: 'Dibuat oleh,', s: sigHeaderStyle });
  setCell(sigHeaderRow, 1, { t: 's', v: '', s: sigHeaderStyle });
  setCell(sigHeaderRow, 2, { t: 's', v: 'Diperiksa', s: sigHeaderStyle });
  setCell(sigHeaderRow, 3, { t: 's', v: '', s: sigHeaderStyle });
  setCell(sigHeaderRow, 4, { t: 's', v: 'Diperiksa & Diketahui oleh,', s: sigHeaderStyle });
  setCell(sigHeaderRow, 5, { t: 's', v: '', s: sigHeaderStyle });
  setCell(sigHeaderRow, 6, { t: 's', v: '', s: sigHeaderStyle });

  // Signature box rows
  const sigBoxRow1 = sigHeaderRow + 1;
  const sigBoxRow2 = sigHeaderRow + 2;
  const sigBoxEmptyStyle = { border: borderAll };

  for (let r = sigBoxRow1; r <= sigBoxRow2; r++) {
    for (let c = 0; c <= 6; c++) {
      setCell(r, c, { t: 's', v: '', s: sigBoxEmptyStyle });
    }
  }

  // Names row
  const sigNameRow = sigBoxRow2 + 1;
  const sigNameStyle = {
    font: fontUnderlineBold,
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll,
  };

  setCell(sigNameRow, 0, { t: 's', v: employeeName, s: sigNameStyle });
  setCell(sigNameRow, 1, { t: 's', v: '', s: sigNameStyle });
  setCell(sigNameRow, 2, { t: 's', v: verifierName, s: sigNameStyle });
  setCell(sigNameRow, 3, { t: 's', v: '', s: sigNameStyle });
  setCell(sigNameRow, 4, { t: 's', v: approverName, s: sigNameStyle });
  setCell(sigNameRow, 5, { t: 's', v: '', s: sigNameStyle });
  setCell(sigNameRow, 6, { t: 's', v: '', s: sigNameStyle });

  // Range and Merges
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sigNameRow, c: 8 } });

  // Column widths:
  ws['!cols'] = [
    { wch: 15 }, // A: TANGGAL
    { wch: 7 },  // B: NO
    { wch: 48 }, // C: KETERANGAN
    { wch: 16 }, // D: JUMLAH ITEM
    { wch: 16 }, // E: Operational
    { wch: 16 }, // F: Pantry
    { wch: 16 }, // G: Fasilitas
    { wch: 16 }, // H: Lain-Lain
    { wch: 17 }, // I: TOTAL
  ];

  // Merges:
  ws['!merges'] = [
    // Header Row merges (vertical 6 to 7)
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // TANGGAL
    { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // NO
    { s: { r: 6, c: 2 }, e: { r: 7, c: 2 } }, // KETERANGAN
    { s: { r: 6, c: 3 }, e: { r: 7, c: 3 } }, // JUMLAH ITEM
    // Total Row merge
    { s: { r: totalR, c: 0 }, e: { r: totalR, c: 3 } }, // TOTAL (A..D)
    // Signatures Header merges
    { s: { r: sigHeaderRow, c: 0 }, e: { r: sigHeaderRow, c: 1 } },
    { s: { r: sigHeaderRow, c: 2 }, e: { r: sigHeaderRow, c: 3 } },
    { s: { r: sigHeaderRow, c: 4 }, e: { r: sigHeaderRow, c: 6 } },
    // Signature Box merges
    { s: { r: sigBoxRow1, c: 0 }, e: { r: sigBoxRow2, c: 1 } },
    { s: { r: sigBoxRow1, c: 2 }, e: { r: sigBoxRow2, c: 3 } },
    { s: { r: sigBoxRow1, c: 4 }, e: { r: sigBoxRow2, c: 6 } },
    // Signature Names merges
    { s: { r: sigNameRow, c: 0 }, e: { r: sigNameRow, c: 1 } },
    { s: { r: sigNameRow, c: 2 }, e: { r: sigNameRow, c: 3 } },
    { s: { r: sigNameRow, c: 4 }, e: { r: sigNameRow, c: 6 } },
  ];

  return ws;
}

/**
 * Mengelompokkan transaksi ke dalam grup bulanan secara terurut
 */
export function groupTransactionsByMonth(
  transactions: Transaction[],
  monthKeys?: string[],
  lang: 'id' | 'en' = 'id'
): MonthExpenseGroup[] {
  const monthNamesId = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const names = lang === 'en' ? monthNamesEn : monthNamesId;

  const map = new Map<string, Transaction[]>();

  transactions.forEach((tx) => {
    try {
      const d = new Date(tx.transaction_date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthKeys || monthKeys.includes(key)) {
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(tx);
        }
      }
    } catch {}
  });

  // Jika monthKeys ditentukan tetapi ada bulan yang tidak punya transaksi, pastikan tetap ada (opsional) atau hanya yang punya data
  const targetKeys = monthKeys || Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return targetKeys
    .filter((key) => map.has(key) && (map.get(key) || []).length > 0)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const [year, m] = key.split('-').map(Number);
      const mLabel = `${names[m - 1]} ${year}`;
      return {
        monthKey: key,
        monthLabel: mLabel,
        transactions: map.get(key) || [],
      };
    });
}

/**
 * Mengonversi seluruh data transaksi dan rincian item ke format Microsoft Excel murni (.xlsx binary) 1 Sheet
 */
export function generateCompanyExpenseReportXLSXBinary(
  transactions: Transaction[],
  profile?: UserProfile,
  sheetName = 'Expense Report',
  activeCA?: CashAdvance | null
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = buildCompanyExpenseWorksheet(transactions, profile, undefined, activeCA);
  const safeSheetName = sheetName.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Expense Report';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Mengonversi transaksi ke format Microsoft Excel Multi-Sheet (.xlsx) di mana 1 Sheet = 1 Bulan
 */
export function generateMultiSheetExpenseReportXLSXBinary(
  monthGroups: MonthExpenseGroup[],
  profile?: UserProfile,
  activeCA?: CashAdvance | null
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Jika tidak ada data bulanan, buat sheet kosong dengan format resmi
  if (monthGroups.length === 0) {
    const ws = buildCompanyExpenseWorksheet([], profile, undefined, activeCA);
    XLSX.utils.book_append_sheet(wb, ws, 'Expense Report');
  } else {
    monthGroups.forEach((group) => {
      const ws = buildCompanyExpenseWorksheet(group.transactions, profile, group.monthLabel, activeCA);
      const safeSheetName = group.monthLabel.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Fungsi Ekspor Multi-Sheet: Download File Excel (.xlsx) dengan 1 Sheet per Bulan
 */
export function exportMultiSheetExcelReport(
  monthGroups: MonthExpenseGroup[],
  profile?: UserProfile,
  fileName?: string,
  activeCA?: CashAdvance | null
) {
  const baseName = fileName || generateReportFileName(profile);
  const name = `${baseName.replace(/\.xlsx?$/i, '')}.xlsx`;
  const binary = generateMultiSheetExpenseReportXLSXBinary(monthGroups, profile, activeCA);
  downloadFile(binary, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Fungsi Ekspor 1: Download File Excel (.xlsx) dengan styling lengkap & formula
 */
export function exportExcelReport(
  transactions: Transaction[],
  profile?: UserProfile,
  fileName?: string,
  activeCA?: CashAdvance | null
) {
  const baseName = fileName || generateReportFileName(profile);
  const name = `${baseName.replace(/\.xlsx?$/i, '')}.xlsx`;
  const binary = generateCompanyExpenseReportXLSXBinary(transactions, profile, 'Expense Report', activeCA);
  downloadFile(binary, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Fungsi Ekspor 2: Buka & Salin ke Google Spreadsheet
 */
export async function exportGoogleSpreadsheetReport(
  transactions: Transaction[],
  profile?: UserProfile,
  fileName?: string,
  targetWindow?: any,
  activeCA?: CashAdvance | null
): Promise<{ success: boolean; message: string; spreadsheetUrl: string }> {
  const name = fileName || generateReportFileName(profile);

  // 1. Salin tabel berformat ke clipboard (jika user ingin paste di tempat lain)
  try {
    await copyFormattedTableToClipboard(transactions, profile, activeCA);
  } catch {}

  // 2. Buat file Google Spreadsheet langsung di Google Drive dengan format & desain tabel Excel lengkap
  const formattedContent = generateCompanyExpenseReportXLS(transactions, profile, undefined, activeCA);
  const cloudRes = await cloudExportToGDrive(formattedContent, name);

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


