import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ReceiptScanResult } from '@/types';
import { getGoogleDriveSettings, uploadReceiptToGoogleDrive } from './googleDriveService';

// Mock receipt templates untuk tombol pengujian instan "Demo AI"
const DEMO_RECEIPTS: ReceiptScanResult[] = [
  {
    merchant_name: 'Indomaret Point Kemang',
    transaction_date: new Date().toISOString(),
    suggested_category: 'Belanja Bulanan',
    payment_method: 'qris',
    subtotal: 14500,
    tax_amount: 0, // PPN sudah include dalam harga 14.500
    discount_amount: 0,
    total_amount: 14500,
    confidence_score: 0.98,
    notes: 'No. Struk: INDO/2026/0891, Kasir: Siti',
    items: [
      { item_name: 'IDM PIRING KRTS 20\'S', quantity: 1, unit_price: 14500, total_price: 14500 },
    ],
  },
  {
    merchant_name: 'Superindo & GoSend Delivery',
    transaction_date: new Date().toISOString(),
    suggested_category: 'Belanja Bulanan',
    payment_method: 'qris',
    subtotal: 135000,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 157000,
    confidence_score: 0.98,
    notes: 'Belanja pantry kantor via delivery',
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
    subtotal: 313500,
    tax_amount: 0,
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
      console.warn('Web fetch blob error, trying ImageManipulator:', e);
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
 * Memproses gambar struk via Google Gemini 3.6 Flash dengan aturan PPN Indonesia (Tax-Inclusive by default)
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
    throw new Error('Kunci Gemini API Key belum terpasang di file .env.');
  }

  // Model Gemini 3.6 Flash
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${effectiveApiKey}`;

  const systemPrompt = `
Anda adalah AI OCR & Akuntan Finansial Cerdas Khusus Pembukuan dan Reimbursement Indonesia.
Tugas Anda:
1. Periksa apakah gambar ini merupakan dokumen transaksi/keuangan (struk kasir minimarket/supermarket, nota tulisan tangan, invoice, bukti transfer m-Banking, bill resto, kuitansi, atau pesanan Gojek/Grab/Shopee/Tokopedia)?
   - Jika JELAS BUKAN struk/bukti transaksi, kembalikan:
     {"is_receipt": false, "rejection_reason": "Gambar yang Anda unggah bukan struk belanja atau bukti transaksi keuangan."}

2. Ekstraksi Data Keuangan & Aturan Pajak Indonesia:
   - merchant_name: Nama toko/vendor/penjual (contoh: "Indomaret", "Alfamart", "SPBU Pertamina", "Superindo", "Restoran Sederhana").
   - transaction_date: Tanggal & jam transaksi format ISO (YYYY-MM-DDTHH:mm:ss). Contoh di struk "28.07.26-15:48" berarti "2026-07-28T15:48:00".
   - suggested_category: "Makanan & Minuman" | "Belanja Bulanan" | "Transportasi" | "Tagihan & Utilitas" | "Hiburan & Rekreasi" | "Kesehatan & Medis" | "Pendidikan & Buku" | "Lainnya".
   - payment_method: "cash" | "qris" | "debit" | "credit" | "e-wallet" | "transfer".
   
   ⚠️ ATURAN SANGAT PENTING MENGENAI PPN & TOTAL BELANJA DI INDONESIA:
   - Di minimarket/retail Indonesia (seperti Indomaret, Alfamart, Superindo, dll.), harga barang yang tertera SUDAH TERMASUK PPN (Tax-Inclusive).
   - Angka "PPN: DPP=... PPN=..." di bagian bawah struk hanyalah rincian informasi faktur pajak, BUKAN BIAYA TAMBAHAN.
   - Total akhir ("total_amount") HARUS SAMA PERSIS dengan nominal "TOTAL BELANJA" atau nominal pembayaran yang dibayar kasir (contoh: jika TOTAL BELANJA Rp 14.500, maka total_amount adalah 14500).
   - Jangan menambahkan PPN lagi ke total belanja jika harga barang sudah include PPN. Set tax_amount = 0 (karena sudah include di harga barang).
   - tax_amount HANYA diisi jika pajak ditambahkan sebagai surcharge terpisah di luar harga barang (misal PB1 10% di beberapa restoran).

   - items: Daftar seluruh item yang dibeli beserta kuantitas dan harga satuan. Masukkan juga biaya pengiriman (Ongkir) atau Biaya Layanan jika ada.
   - subtotal: Total harga barang sebelum diskon.
   - discount_amount: Potongan harga/diskon jika ada.
   - total_amount: Total nominal uang yang sesungguhnya dibayarkan pelanggan (TOTAL BELANJA).
   - notes: Catatan seperti nomor transaksi kasir.

Format Output JSON Wajib:
{
  "is_receipt": true,
  "merchant_name": "Indomaret",
  "transaction_date": "2026-07-28T15:48:00",
  "suggested_category": "Belanja Bulanan",
  "payment_method": "qris",
  "subtotal": 14500,
  "tax_amount": 0,
  "discount_amount": 0,
  "total_amount": 14500,
  "items": [
    {"item_name": "IDM PIRING KRTS 20'S", "quantity": 1, "unit_price": 14500, "total_price": 14500}
  ],
  "confidence_score": 0.99,
  "notes": "No: F848-4508/ANDRI/02"
}
Perhatian: Kembalikan JSON murni tanpa markdown.
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

  const finalTotal = Number(parsed.total_amount) || Number(parsed.subtotal) || 0;

  return {
    merchant_name: parsed.merchant_name || 'Toko Belanja',
    transaction_date: parsed.transaction_date || new Date().toISOString(),
    suggested_category: parsed.suggested_category || 'Belanja Bulanan',
    payment_method: parsed.payment_method || 'cash',
    subtotal: Number(parsed.subtotal) || finalTotal,
    tax_amount: Number(parsed.tax_amount) || 0,
    discount_amount: Number(parsed.discount_amount) || 0,
    total_amount: finalTotal,
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
