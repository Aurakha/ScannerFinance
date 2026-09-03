import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

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
 * Format tanggal dan waktu ramah pengguna (contoh: Hari ini, 14:30 WIB atau 28 Agu 2026, 14:30 WIB)
 */
export function formatFriendlyDate(dateString: string | Date, lang: 'id' | 'en' = 'id'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const loc = lang === 'en' ? enUS : id;
    const timeZoneSuffix = lang === 'en' ? 'WIB' : 'WIB';

    if (isToday(date)) {
      const todayLabel = lang === 'en' ? 'Today' : 'Hari ini';
      return `${todayLabel}, ${format(date, 'HH:mm')} ${timeZoneSuffix}`;
    }
    if (isYesterday(date)) {
      const yesterdayLabel = lang === 'en' ? 'Yesterday' : 'Kemarin';
      return `${yesterdayLabel}, ${format(date, 'HH:mm')} ${timeZoneSuffix}`;
    }
    return format(date, 'd MMM yyyy, HH:mm', { locale: loc }) + ` ${timeZoneSuffix}`;
  } catch {
    return String(dateString);
  }
}

export function formatDateOnly(dateString: string | Date, lang: 'id' | 'en' = 'id'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const loc = lang === 'en' ? enUS : id;
    return format(date, 'd MMMM yyyy', { locale: loc });
  } catch {
    return String(dateString);
  }
}

/**
 * Format tanggal singkat untuk laporan ekspor (contoh: 6-Agu-26)
 */
export function formatDateShort(dateString: string | Date, lang: 'id' | 'en' = 'id'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const loc = lang === 'en' ? enUS : id;
    return format(date, 'd-MMM-yy', { locale: loc });
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString: string | Date, lang: 'id' | 'en' = 'id'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const loc = lang === 'en' ? enUS : id;
    return format(date, 'd MMMM yyyy HH:mm', { locale: loc }) + ' WIB';
  } catch {
    return String(dateString);
  }
}

export function formatTimeOnly(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'HH:mm') + ' WIB';
  } catch {
    return '--:--';
  }
}

/**
 * Format persentase
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
