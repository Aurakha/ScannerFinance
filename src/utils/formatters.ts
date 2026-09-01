import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Format angka ke format mata uang Rupiah (contoh: Rp 125.000)
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'Rp 0';
  }
  const numericVal = Math.round(Number(amount));
  const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(numericVal));
  const sign = numericVal < 0 ? '-' : '';
  return `${sign}Rp ${formatted}`;
}

/**
 * Format tanggal ramah pengguna (contoh: Hari Ini, Kemarin, atau 28 Agu 2026)
 */
export function formatFriendlyDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (isToday(date)) {
      return `Hari ini, ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `Kemarin, ${format(date, 'HH:mm')}`;
    }
    return format(date, 'd MMM yyyy, HH:mm', { locale: id });
  } catch {
    return String(dateString);
  }
}

export function formatDateOnly(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'd MMMM yyyy', { locale: id });
  } catch {
    return String(dateString);
  }
}

/**
 * Format persentase
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
