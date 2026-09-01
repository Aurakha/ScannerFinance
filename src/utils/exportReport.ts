import { Transaction } from '@/types';
import { formatDateOnly, formatDateTime, formatTimeOnly } from './formatters';
import { Platform } from 'react-native';

export interface CompanyReportHeader {
  companyName: string;
  employeeName: string;
  department: string;
  reportDate: string;
  projectName: string;
  cashAdvance?: number;
}

export const defaultCompanyHeader: CompanyReportHeader = {
  companyName: 'PT. San Kawan Abadi',
  employeeName: 'Gabriel Rudra Renata',
  department: 'Operation',
  reportDate: formatDateOnly(new Date()),
  projectName: 'Head Office',
  cashAdvance: 0,
};

/**
 * Mengonversi seluruh data transaksi dan rincian item ke format CSV / Spreadsheet tabel rekapitulasi kantor dengan WAKTU transaksi lengkap
 */
export function generateCompanyExpenseReportCSV(
  transactions: Transaction[],
  header: CompanyReportHeader = defaultCompanyHeader
): string {
  // Sort transaksi berdasarkan tanggal & waktu
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  let csvContent = '';

  // 1. Header Informasi Perusahaan & Karyawan
  csvContent += `Nama Perusahaan,:,${header.companyName}\n`;
  csvContent += `Nama,:,${header.employeeName}\n`;
  csvContent += `Dept/Divisi,:,${header.department}\n`;
  csvContent += `Tanggal Cetak,:,${header.reportDate}\n`;
  csvContent += `Project,:,${header.projectName}\n\n`;

  // 2. Header Tabel dengan Kolom Tanggal & Waktu
  csvContent += `TANGGAL,WAKTU,NO,KETERANGAN (NAMA BARANG / JASA),JUMLAH ITEM,KATEGORI,HARGA SATUAN (Rp),TOTAL (Rp)\n`;

  let rowNumber = 1;
  let grandTotal = 0;
  const categoryTotals: Record<string, number> = {};

  sortedTx.forEach((tx) => {
    const txDateStr = formatDateOnly(tx.transaction_date);
    const txTimeStr = formatTimeOnly(tx.transaction_date);
    const catName = tx.category?.name || 'Operasional';

    if (tx.items && tx.items.length > 0) {
      // 1 Struk memuat banyak item baris belanja & jasa
      tx.items.forEach((item) => {
        const itemTotal = Number(item.total_price) || (Number(item.quantity) || 1) * (Number(item.unit_price) || 0);
        grandTotal += itemTotal;
        categoryTotals[catName] = (categoryTotals[catName] || 0) + itemTotal;

        const cleanItemName = `"${item.item_name.replace(/"/g, '""')}"`;
        const qtyStr = `"${item.quantity} Pcs"`;

        csvContent += `"${txDateStr}","${txTimeStr}",${rowNumber},${cleanItemName},${qtyStr},"${catName}",${item.unit_price || 0},${itemTotal}\n`;
        rowNumber++;
      });
    } else {
      // Jika struk tidak memiliki rincian item terpisah
      const total = Number(tx.total_amount) || 0;
      grandTotal += total;
      categoryTotals[catName] = (categoryTotals[catName] || 0) + total;

      csvContent += `"${txDateStr}","${txTimeStr}",${rowNumber},"${tx.merchant_name}","1 Paket","${catName}",${total},${total}\n`;
      rowNumber++;
    }
  });

  csvContent += `\n`;
  csvContent += `TOTAL PENGELUARAN,,,,,,,${grandTotal}\n`;

  if (header.cashAdvance && header.cashAdvance > 0) {
    const refund = header.cashAdvance - grandTotal;
    csvContent += `Jumlah Cash Advance,,,,,,,${header.cashAdvance}\n`;
    csvContent += `Jumlah yang Diklaim,,,,,,,${grandTotal}\n`;
    csvContent += `Jumlah Pengembalian Dana,,,,,,,${refund}\n`;
  }

  return csvContent;
}

/**
 * Memicu download berkas CSV di browser atau perangkat
 */
export function downloadCSV(csvContent: string, fileName = 'Rekap_Pengeluaran_ScanFinance.csv') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
