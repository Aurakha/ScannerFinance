import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase, DEFAULT_GEMINI_API_KEY } from './supabase';
import { ReceiptScanResult } from '@/types';
import { getGoogleDriveSettings, uploadReceiptToGoogleDrive } from './googleDriveService';

// Mock receipt templates untuk tombol pengujian instan "Demo AI"
const DEMO_RECEIPTS: ReceiptScanResult[] = [
  {
    merchant_name: 'ShopeeFood - Bakmi Jogja',
    transaction_date: new Date().toISOString(),
    suggested_category: 'Makanan & Minuman',
    payment_method: 'e-wallet',
    subtotal: 68000,
    shipping_fee: 8000,
    admin_fee: 6500, // Biaya Layanan (3.500) + Biaya Lain-lain (3.000)
    tax_amount: 0,
    discount_amount: 12000,
    total_amount: 70500,
    confidence_score: 0.99,
    notes: 'No. Pesanan: 3223849468528128954',
    items: [
      { item_name: 'Bakmi Godog', quantity: 1, unit_price: 34000, total_price: 34000 },
      { item_name: 'Bakmi Goreng', quantity: 1, unit_price: 34000, total_price: 34000 },
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
 * Memproses gambar struk via Google Gemini 3.6 Flash dengan pembacaan otomatis Ongkir, Biaya Layanan/Admin, Diskon, & Total
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

  // Upload ke Google Drive di latar belakang (non-blocking)
  let driveLink: string | undefined;
  const driveUploadPromise = (async () => {
    try {
      const fileName = `Struk_${Date.now()}.jpg`;
      const driveRes = await uploadReceiptToGoogleDrive(base64Data, fileName);
      if (driveRes?.webViewLink) {
        driveLink = driveRes.webViewLink;
      }
    } catch (gdriveErr) {
      console.warn('Google Drive auto-upload notice:', gdriveErr);
    }
  })();

  const effectiveApiKey =
    userGeminiApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    DEFAULT_GEMINI_API_KEY;

  if (!effectiveApiKey) {
    throw new Error('Kunci Gemini API Key belum terpasang.');
  }

  // Model Gemini 3.6 Flash (model resmi terbaru Google)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${effectiveApiKey}`;

  const systemPrompt = `
Anda adalah AI OCR & Akuntan Finansial Cerdas Khusus Pembukuan, Struk Belanja, & Aplikasi Pesanan Online (ShopeeFood, GrabFood, GoFood, Tokopedia, Indomaret, dll.).
Tugas Anda mengekstrak data dari gambar transaksi ini:

1. Validasi:
   - Jika BUKAN dokumen transaksi/struk belanja, kembalikan:
     {"is_receipt": false, "rejection_reason": "Gambar bukan struk belanja atau bukti transaksi."}

2. Ekstraksi Field:
   - merchant_name: Nama toko/restoran/platform (contoh: "ShopeeFood", "Bakmi Jogja", "Indomaret", "GrabFood", "Gojek", "SPBU Pertamina").
   - transaction_date: Tanggal & jam transaksi format ISO (YYYY-MM-DDTHH:mm:ss). Contoh di struk "19 Agt 2026 16:49" -> "2026-08-19T16:49:00".
   - suggested_category: "Makanan & Minuman" | "Belanja Bulanan" | "Transportasi" | "Tagihan & Utilitas" | "Hiburan & Rekreasi" | "Kesehatan & Medis" | "Pendidikan & Buku" | "Lainnya".
   - payment_method: "cash" | "qris" | "debit" | "credit" | "e-wallet" | "transfer". (Misal jika ShopeePay/GoPay/OVO -> "e-wallet").
   
   - items: Daftar HANYA barang/menu makanan/produk yang dibeli (contoh: Bakmi Godog x1 @34.000, Bakmi Goreng x1 @34.000). JANGAN memasukkan ongkir/biaya admin ke dalam list items barang.
   
   - subtotal: Subtotal pesanan menu/barang sebelum diskon & biaya tambahan (contoh: 68000).
   
   - shipping_fee: Biaya pengiriman / ongkos kirim / delivery fee jika ada (contoh: jika tertera "Biaya Pengiriman Rp8.000", isi 8000; jika tidak ada, isi 0).
   
   - admin_fee: JUMLAH TOTAL seluruh biaya layanan aplikasi, biaya penanganan, biaya admin kasir, dan biaya lain-lain jika ada (contoh: jika tertera "Biaya Layanan Rp3.500" dan "Biaya Lain-lain Rp3.000", maka admin_fee = 3500 + 3000 = 6500; jika tidak ada, isi 0).
   
   - discount_amount: Potongan voucher / diskon promo (contoh: jika tertera "Voucher Diskon -Rp12.000", isi 12000; jika tidak ada, isi 0).
   
   - tax_amount: Pajak PPN/PB1 jika tertera (jika ada nilai PPN seperti 6.875, isi 6875; jika tidak ada, isi 0).
   
   - total_amount: Total nominal yang sesungguhnya dibayarkan pelanggan (contoh: jika Total akhir Rp 70.500, maka total_amount = 70500).
   
   - notes: Catatan seperti nomor pesanan (contoh: "No. Pesanan: 3223849468528128954").

Format Output JSON Wajib:
{
  "is_receipt": true,
  "merchant_name": "ShopeeFood",
  "transaction_date": "2026-08-19T16:49:00",
  "suggested_category": "Makanan & Minuman",
  "payment_method": "e-wallet",
  "subtotal": 68000,
  "shipping_fee": 8000,
  "admin_fee": 6500,
  "tax_amount": 0,
  "discount_amount": 12000,
  "total_amount": 70500,
  "items": [
    {"item_name": "Bakmi Godog", "quantity": 1, "unit_price": 34000, "total_price": 34000},
    {"item_name": "Bakmi Goreng", "quantity": 1, "unit_price": 34000, "total_price": 34000}
  ],
  "confidence_score": 0.99,
  "notes": "No. Pesanan: 3223849468528128954"
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
  const parts = jsonResponse?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p: any) => p.text && !p.thought) || parts[0];
  const rawText = textPart?.text;

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

  // Tunggu sejenak jika upload Drive selesai cepat (maksimal 3 detik agar tidak lambat)
  try {
    await Promise.race([
      driveUploadPromise,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {}

  return {
    merchant_name: parsed.merchant_name || 'Toko Belanja',
    transaction_date: parsed.transaction_date || new Date().toISOString(),
    suggested_category: parsed.suggested_category || 'Belanja Bulanan',
    payment_method: parsed.payment_method || 'cash',
    subtotal: Number(parsed.subtotal) || finalTotal,
    shipping_fee: Number(parsed.shipping_fee) || 0,
    admin_fee: Number(parsed.admin_fee) || 0,
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
