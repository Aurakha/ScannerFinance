import { Transaction, UserProfile } from '@/types';
import { formatDateOnly, formatRupiah } from './formatters';
import { Platform } from 'react-native';

export interface CompanyReportOptions {
  profile?: UserProfile;
}

/**
 * Mengonversi seluruh data transaksi dan rincian item ke format CSV / Spreadsheet tabel rekapitulasi kantor
 * 100% PERSIS dengan format PT. San Kawan Abadi (Foto 3 & 4)
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
  const cashAdvance = profile?.cash_advance_amount ?? 5000000;

  // Sort transaksi berdasarkan tanggal
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  let csv = '';

  // 1. Header Profil Atas (Persis Foto 2 & 3)
  csv += `Nama Perusahaan,:,${companyName},,,,,,,\n`;
  csv += `Nama,:,${employeeName},,,,,,,\n`;
  csv += `Dept/Divisi,:,${department},,,,,,,\n`;
  csv += `Tanggal,:,${reportDate},,,,,,,\n`;
  csv += `Project,:,${projectName},,,,,,,\n`;
  csv += `----------------------------------------------------------------------------------------------------\n`;

  // 2. Header Tabel Kolom (Persis Foto 3)
  csv += `TANGGAL,NO,KETERANGAN,JUMLAH ITEM,Operational (Rp) - B,Pantry (Rp) - C,Fasilitas (Rp) - D,Lain-Lain (Rp) - F,TOTAL (Rp) -G\n`;

  let rowNo = 1;
  let sumOperational = 0;
  let sumPantry = 0;
  let sumFasilitas = 0;
  let sumLainLain = 0;
  let grandTotal = 0;

  sortedTx.forEach((tx) => {
    const txDateStr = formatDateOnly(tx.transaction_date);
    const catName = (tx.category?.name || '').toLowerCase();

    // Identifikasi kolom kategori perusahaan (B, C, D, atau F)
    let targetCol: 'operational' | 'pantry' | 'fasilitas' | 'lainlain' = 'operational';
    if (catName.includes('pantry') || catName.includes('makan') || catName.includes('belanja')) {
      targetCol = 'pantry';
    } else if (catName.includes('fasilitas') || catName.includes('kesehatan') || catName.includes('hiburan') || catName.includes('kantor')) {
      targetCol = 'fasilitas';
    } else if (catName.includes('lain') || catName.includes('buku') || catName.includes('pendidikan')) {
      targetCol = 'lainlain';
    } else {
      targetCol = 'operational';
    }

    if (tx.items && tx.items.length > 0) {
      tx.items.forEach((it) => {
        const itTotal = Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
        grandTotal += itTotal;

        let bVal = '';
        let cVal = '';
        let dVal = '';
        let fVal = '';

        if (targetCol === 'operational') {
          bVal = String(itTotal);
          sumOperational += itTotal;
        } else if (targetCol === 'pantry') {
          cVal = String(itTotal);
          sumPantry += itTotal;
        } else if (targetCol === 'fasilitas') {
          dVal = String(itTotal);
          sumFasilitas += itTotal;
        } else {
          fVal = String(itTotal);
          sumLainLain += itTotal;
        }

        const cleanName = `"${it.item_name.replace(/"/g, '""')}"`;
        const qtyStr = `"${it.quantity || 1} Pcs"`;

        csv += `"${txDateStr}",${rowNo},${cleanName},${qtyStr},${bVal},${cVal},${dVal},${fVal},${itTotal}\n`;
        rowNo++;
      });
    } else {
      const total = Number(tx.total_amount) || 0;
      grandTotal += total;

      let bVal = '';
      let cVal = '';
      let dVal = '';
      let fVal = '';

      if (targetCol === 'operational') {
        bVal = String(total);
        sumOperational += total;
      } else if (targetCol === 'pantry') {
        cVal = String(total);
        sumPantry += total;
      } else if (targetCol === 'fasilitas') {
        dVal = String(total);
        sumFasilitas += total;
      } else {
        fVal = String(total);
        sumLainLain += total;
      }

      const cleanName = `"${tx.merchant_name.replace(/"/g, '""')}"`;
      csv += `"${txDateStr}",${rowNo},${cleanName},"1 Paket",${bVal},${cVal},${dVal},${fVal},${total}\n`;
      rowNo++;
    }

    // Jika ada diskon di struk
    if (tx.discount_amount && tx.discount_amount > 0) {
      grandTotal -= tx.discount_amount;
      csv += `"${txDateStr}",${rowNo},"Diskon / Voucher","-",,,,-${tx.discount_amount},-${tx.discount_amount}\n`;
      rowNo++;
    }
  });

  // 3. Baris Total Tabel (Persis Foto 4)
  csv += `,,,TOTAL,${sumOperational || '-'},${sumPantry || '-'},${sumFasilitas || '-'},${sumLainLain || '-'},${grandTotal}\n\n`;

  // 4. Rekapitulasi Cash Advance (Persis Foto 4)
  csv += `Total Pengeluaran (f),,,,,,,,${grandTotal}\n`;
  csv += `----------------------------------------------------------------------------------------------------\n`;
  csv += `Jumlah Cash Advance : ,,,,${cashAdvance},,,,\n`;
  csv += `Jumlah yang diklaim,,,,${grandTotal},,,,\n`;
  const refund = cashAdvance - grandTotal;
  csv += `Jumlah pengembalian dana,,,,${refund},,,,\n\n`;

  // 5. Kotak 3 Kolom Tanda Tangan (Persis Foto 4)
  csv += `${city}, ${reportDate},,,,,,,,\n`;
  csv += `Dibuat oleh,,,,Diperiksa,,,Diperiksa & Diketahui oleh,\n\n\n`;
  csv += `"${employeeName}",,,,"${verifierName}",,,"${approverName}",\n`;

  return csv;
}

/**
 * Memicu download berkas CSV di browser atau perangkat
 */
export function downloadCSV(csvContent: string, fileName = 'Rekapitulasi_Pengeluaran_Klaim.csv') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
