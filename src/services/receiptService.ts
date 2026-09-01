import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ReceiptScanResult } from '@/types';
import { getGoogleDriveSettings, uploadReceiptToGoogleDrive } from './googleDriveService';

// Mock receipt templates untuk tombol pengujian instan "Demo AI"
const DEMO_RECEIPTS: ReceiptScanResult[] = [
  {
    merchant_name: 'Superindo & GoSend Delivery',
    transaction_date: new Date().toISOString(),
    suggested_category: 'Belanja Bulanan',
    payment_method: 'qris',
    subtotal: 145000,
    tax_amount: 0,
    discount_amount: 10000,
    total_amount: 157000,
    confidence_score: 0.98,
    notes: 'Belanja pantry kantor via delivery, No. Pesanan: GO-98214',
    items: [
      { item_name: 'Kopi Kapal Api Special Mix (10 sachet)', quantity: 2, unit_price: 18500, total_price: 37000 },
      { item_name: 'Gula Pasir Gulaku 1kg', quantity: 2, unit_price: 19500, total_price: 39000 },
      { item_name: 'Tisu Toilet Paseo 8 roll', quantity: 1, unit_price: 42000, total_price: 42000 },
      { item_name: 'Sabun Cuci Piring Sunlight 750ml', quantity: 1, unit_price: 27000, total_price: 27000 },
      { item_name: 'Ongkos Kirim (GoSend Instant)', quantity: 1, unit_price: 20000, total_price: 20000 },
      { item_name: 'Biaya Layanan Aplikasi', quantity: 1, unit_price: 2000, total_price: 2000 },
    ],
  },
  {
    merchant_name: 'Restoran Bebek Tepi Sawah',
    transaction_date: new Date(Date.now() - 3600000 * 3).toISOString(),
    suggested_category: 'Makanan & Minuman',
    payment_method: 'debit',
    subtotal: 285000,
    tax_amount: 28500,
    discount_amount: 0,
    total_amount: 327750,
    confidence_score: 0.99,
    notes: 'Makan siang operasional tim (Meja 12)',
    items: [
      { item_name: 'Paket Bebek Betutu Spesial', quantity: 2, unit_price: 95000, total_price: 190000 },
      { item_name: 'Nasi Putih Organik', quantity: 3, unit_price: 12000, total_price: 36000 },
      { item_name: 'Es Kelapa Jeruk', quantity: 3, unit_price: 19000, total_price: 57000 },
      { item_name: 'Biaya Service Charge (5%)', quantity: 1, unit_price: 14250, total_price: 14250 },
    ],
  },
  {
    merchant_name: 'Toko ATK & Fotocopy Berkah',
    transaction_date: new Date(Date.now() - 86400000).toISOString(),
    suggested_category: 'Pendidikan & Buku',
    payment_method: 'cash',
    subtotal: 88000,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 88000,
    confidence_score: 0.95,
    notes: 'Nota manual perlengkapan dokumen kantor',
    items: [
      { item_name: 'Kertas HVS PaperOne A4 80gr (Rim)', quantity: 1, unit_price: 58000, total_price: 58000 },
      { item_name: 'Map Snelhecter Plastik (Pcs)', quantity: 5, unit_price: 4000, total_price: 20000 },
      { item_name: 'Pulpen Snowman V-1 Hitam (Pack)', quantity: 1, unit_price: 10000, total_price: 10000 },
    ],
  },
];

/**
 * Mengubah URI gambar apa pun (Blob, HTTP, Data URI, File URI) ke Base64 murni
 */
export async function convertUriToBase64(uri: string, directBase64?: string): Promise<string> {
  if (directBase64 && directBase64.length > 50) {
    return directBase64.replace(/^data:image\/\w+;base64,/, '');
  }

  if (uri.startsWith('data:image')) {
    return uri.split(',')[1];
  }

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const cleanBase64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(cleanBase64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Web fetch blob error:', e);
    }
  }

  // Mobile / Native fallback
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manipResult.base64) {
      return manipResult.base64;
    }
  } catch (err) {
    console.warn('ImageManipulator failed:', err);
  }

  return '';
}

/**
 * Memproses gambar struk via Google Gemini 3.6 Flash dengan ekstraksi lengkap Barang, Jasa, Ongkir, Admin, Pajak & Diskon
 */
export async function processReceiptImage(
  imageUri: string,
  userGeminiApiKey?: string,
  providedBase64?: string
): Promise<ReceiptScanResult> {
  const base64Data = await convertUriToBase64(imageUri, providedBase64);

  if (!base64Data) {
    throw new Error('Gagal membaca data gambar. Pastikan file gambar dapat diakses.');
  }

  // Upload ke Google Drive di latar belakang jika token aktif
  let driveLink: string | undefined;
  try {
    const gdriveSettings = await getGoogleDriveSettings();
    if (gdriveSettings.isEnabled && gdriveSettings.accessToken) {
      const fileName = `Struk_${Date.now()}.jpg`;
      const driveRes = await uploadReceiptToGoogleDrive(base64Data, fileName);
      if (driveRes?.webViewLink) {
        driveLink = driveRes.webViewLink;
      }
    }
  } catch (gdriveErr) {
    console.warn('Google Drive auto-upload notice:', gdriveErr);
  }

  const effectiveApiKey =
    userGeminiApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    '';

  if (!effectiveApiKey) {
    throw new Error(
      'Kunci Gemini API Key belum terpasang di file .env.'
    );
  }

  // Model Gemini 3.6 Flash
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${effectiveApiKey}`;

  const systemPrompt = `
Anda adalah AI OCR & Akuntan Finansial Cerdas Khusus Pembukuan dan Reimbursement Kantor.
Tugas Anda:
1. Periksa apakah gambar ini merupakan dokumen transaksi/keuangan (struk kasir fisik, nota tulisan tangan warung/toko, invoice, bukti transfer m-Banking, bill resto, kuitansi, atau rincian pesanan Gojek/Grab/Shopee/Tokopedia)?
   - Jika JELAS BUKAN dokumen transaksi/struk belanja (misal: foto selfie, wajah orang, foto pemandangan, gambar hewan, atau gambar acak tanpa konteks transaksi), kembalikan:
     {"is_receipt": false, "rejection_reason": "Gambar yang Anda unggah bukan struk belanja atau bukti transaksi keuangan."}
2. Jika merupakan struk/nota/bukti pembayaran, ekstrak rincian secara lengkap dan teliti ke dalam JSON:
   - merchant_name: Nama toko/vendor/penjual (contoh: "Indomaret", "Alfamart", "SPBU Pertamina", "Restoran Padang Sederhana", "Shopee - Toko Alat Tulis").
   - transaction_date: Tanggal transaksi format ISO (YYYY-MM-DDTHH:mm:ss). Jika jam tidak ada, default jam 12:00:00.
   - suggested_category: Pilih salah satu yang paling cocok: "Makanan & Minuman" | "Belanja Bulanan" | "Transportasi" | "Tagihan & Utilitas" | "Hiburan & Rekreasi" | "Kesehatan & Medis" | "Pendidikan & Buku" | "Lainnya".
   - payment_method: "cash" | "qris" | "debit" | "credit" | "e-wallet" | "transfer".
   - items: Daftar seluruh item yang dibayar. SANGAT PENTING: Masukkan juga biaya jasa tambahan sebagai item baris jika ada, contohnya:
     * Barang belanja fisik (misal: "Le Minerale 330ml", qty: 3, unit_price: 12500, total_price: 37500)
     * Ongkos Kirim / Delivery Fee (misal: "Ongkos Kirim GoSend / JNE", qty: 1, unit_price: 15000, total_price: 15000)
     * Biaya Layanan Aplikasi / Biaya Admin (misal: "Biaya Layanan Aplikasi", qty: 1, unit_price: 1000, total_price: 1000)
     * Service Charge Restoran (misal: "Service Charge Resto", qty: 1, unit_price: 12000, total_price: 12000)
     * Biaya Parkir / Tol
   - subtotal: Jumlah total harga sebelum pajak & diskon.
   - tax_amount: Pajak (PPN 11%, PB1 10%) jika tertera terpisah.
   - discount_amount: Potongan harga/voucher/diskon hemat jika ada.
   - total_amount: Total akhir bersih yang dibayar pelanggan.
   - notes: Catatan seperti nomor pesanan atau kasir.

Format Output JSON Wajib:
{
  "is_receipt": true,
  "merchant_name": "Nama Toko / Penjual",
  "transaction_date": "YYYY-MM-DDTHH:mm:ss",
  "suggested_category": "Belanja Bulanan",
  "payment_method": "qris",
  "subtotal": 0,
  "tax_amount": 0,
  "discount_amount": 0,
  "total_amount": 0,
  "items": [
    {"item_name": "Nama Barang / Jasa", "quantity": 1, "unit_price": 0, "total_price": 0}
  ],
  "confidence_score": 0.98,
  "notes": ""
}
Perhatian: Kembalikan JSON murni tanpa blok markdown.
`;

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error details:', errorText);
    throw new Error(`Gemini API Error (${response.status}): Periksa kembali kuota atau koneksi internet Anda.`);
  }

  const jsonResponse = await response.json();
  const rawText = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini API tidak memberikan balasan data.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  if (parsed.is_receipt === false) {
    throw new Error(
      parsed.rejection_reason ||
        'Gambar yang Anda unggah tidak terdeteksi sebagai struk belanja. Mohon unggah foto struk/nota pembayaran yang valid.'
    );
  }

  return {
    merchant_name: parsed.merchant_name || 'Toko Belanja',
    transaction_date: parsed.transaction_date || new Date().toISOString(),
    suggested_category: parsed.suggested_category || 'Belanja Bulanan',
    payment_method: parsed.payment_method || 'cash',
    subtotal: Number(parsed.subtotal) || Number(parsed.total_amount) || 0,
    tax_amount: Number(parsed.tax_amount) || 0,
    discount_amount: Number(parsed.discount_amount) || 0,
    total_amount: Number(parsed.total_amount) || 0,
    items: (parsed.items || []).map((it: any) => ({
      item_name: it.item_name || 'Item',
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      total_price: Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    })),
    confidence_score: parsed.confidence_score || 0.95,
    notes: parsed.notes || '',
    receipt_image_uri: driveLink || imageUri,
  };
}

export function getSampleDemoReceipt(index = 0): ReceiptScanResult {
  return {
    ...DEMO_RECEIPTS[index % DEMO_RECEIPTS.length],
    transaction_date: new Date().toISOString(),
  };
}
