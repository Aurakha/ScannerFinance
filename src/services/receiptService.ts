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
    subtotal: 62500,
    tax_amount: 6875, // PPN tercatat sebagai informasi
    discount_amount: 0,
    total_amount: 62500, // Total bayar tetap 62.500
    confidence_score: 0.99,
    notes: 'No: TORR-9361508/YUNI /01',
    items: [
      { item_name: 'MED/SPHP BERAS 5KG', quantity: 1, unit_price: 62500, total_price: 62500 },
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
 * Memproses gambar struk via Google Gemini 3.6 Flash dengan ekstraksi lengkap PPN dan Total Belanja
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
Anda adalah AI OCR & Akuntan Finansial Cerdas Khusus Pembukuan dan Struk Belanja Indonesia.
Tugas Anda mengekstrak data dari struk belanja ini:

1. Validasi:
   - Jika BUKAN struk/bukti transaksi belanja, kembalikan:
     {"is_receipt": false, "rejection_reason": "Gambar bukan struk belanja atau bukti transaksi."}

2. Ekstraksi Field:
   - merchant_name: Nama toko/penjual (contoh: "Indomaret", "Alfamart", "Superindo", "SPBU Pertamina").
   - transaction_date: Tanggal & jam transaksi format ISO (YYYY-MM-DDTHH:mm:ss). Contoh di struk "14.08.26-13:44" -> "2026-08-14T13:44:00".
   - suggested_category: "Makanan & Minuman" | "Belanja Bulanan" | "Transportasi" | "Tagihan & Utilitas" | "Hiburan & Rekreasi" | "Kesehatan & Medis" | "Pendidikan & Buku" | "Lainnya".
   - payment_method: "cash" | "qris" | "debit" | "credit" | "e-wallet" | "transfer".
   - items: Daftar seluruh item belanjaan (nama barang, quantity, harga satuan, total harga).
   - subtotal: Total harga barang sebelum diskon.
   
   ⚠️ ATURAN EKSTRAKSI PAJAK PPN & TOTAL BELANJA:
   - tax_amount: BACA dan EKSTRAK nominal PPN yang tertera pada bagian bawah struk (contoh: jika tertera "PPN= 6.875" atau "PPN DIBEBASKAN: PPN= 6.875", maka tax_amount adalah 6875; jika tertera "PPN= 1.437", maka tax_amount adalah 1437; jika tidak ada, isi 0).
   - discount_amount: Potongan harga/diskon jika ada (angka bulat, isi 0 jika tidak ada).
   - total_amount: AMBIL LANGSUNG DARI BARIS "TOTAL BELANJA" / "NON TUNAI" / "TUNAI" (contoh: jika TOTAL BELANJA Rp 62.500, maka total_amount adalah 62500. JANGAN menambahkan PPN lagi ke total_amount karena total_amount adalah nominal yang sesungguhnya dibayarkan konsumen di kasir).
   - notes: Catatan seperti nomor transaksi kasir (misal: "TORR-9361508/YUNI /01").

Format Output JSON Wajib:
{
  "is_receipt": true,
  "merchant_name": "Indomaret",
  "transaction_date": "2026-08-14T13:44:00",
  "suggested_category": "Belanja Bulanan",
  "payment_method": "qris",
  "subtotal": 62500,
  "tax_amount": 6875,
  "discount_amount": 0,
  "total_amount": 62500,
  "items": [
    {"item_name": "MED/SPHP BERAS 5KG", "quantity": 1, "unit_price": 62500, "total_price": 62500}
  ],
  "confidence_score": 0.99,
  "notes": "No: TORR-9361508/YUNI /01"
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
