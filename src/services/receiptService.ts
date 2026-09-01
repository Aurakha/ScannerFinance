import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ReceiptScanResult } from '@/types';
import { getGoogleDriveSettings, uploadReceiptToGoogleDrive } from './googleDriveService';

// Mock receipt templates HANYA untuk tombol khusus "Demo AI"
const DEMO_RECEIPTS: ReceiptScanResult[] = [
  {
    merchant_name: 'Indomaret Point Kemang',
    transaction_date: new Date().toISOString(),
    suggested_category: 'Belanja Bulanan',
    payment_method: 'qris',
    subtotal: 78500,
    tax_amount: 0,
    discount_amount: 5000,
    total_amount: 73500,
    confidence_score: 0.96,
    notes: 'No. Struk: INDO/2026/0891, Kasir: Siti',
    items: [
      { item_name: 'Susu UHT Ultra Milk 1L', quantity: 1, unit_price: 21500, total_price: 21500 },
      { item_name: 'Roti Gandum Sari Roti', quantity: 1, unit_price: 19000, total_price: 19000 },
      { item_name: 'Minyak Goreng Sania 2L', quantity: 1, unit_price: 34000, total_price: 34000 },
      { item_name: 'Air Mineral Aqua 600ml', quantity: 1, unit_price: 4000, total_price: 4000 },
    ],
  },
  {
    merchant_name: 'Kopi Kenangan Senopati',
    transaction_date: new Date(Date.now() - 3600000 * 3).toISOString(),
    suggested_category: 'Makanan & Minuman',
    payment_method: 'e-wallet',
    subtotal: 58000,
    tax_amount: 5800,
    discount_amount: 10000,
    total_amount: 53800,
    confidence_score: 0.98,
    notes: 'Meja 04 - Order via App',
    items: [
      { item_name: 'Kopi Kenangan Mantan (L)', quantity: 1, unit_price: 24000, total_price: 24000 },
      { item_name: 'Avocado Coffee Ice (R)', quantity: 1, unit_price: 28000, total_price: 28000 },
      { item_name: 'Roti Coklat Klasik', quantity: 1, unit_price: 6000, total_price: 6000 },
    ],
  },
  {
    merchant_name: 'SPBU Pertamina 34-12345',
    transaction_date: new Date(Date.now() - 86400000).toISOString(),
    suggested_category: 'Transportasi',
    payment_method: 'cash',
    subtotal: 150000,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 150000,
    confidence_score: 0.99,
    notes: 'Pompa 3 - Operator Budi',
    items: [
      { item_name: 'Pertamax 92 (Liter)', quantity: 11.54, unit_price: 13000, total_price: 150000 },
    ],
  },
];

/**
 * Mengubah URI gambar apa pun (Blob, HTTP, Data URI, File URI) ke Base64 murni yang kompatibel dengan Gemini Vision
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
 * Memproses gambar struk via Google Gemini Multimodal Vision API (gemini-3.6-flash)
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
      'Kunci Gemini API Key belum terpasang. Silakan masukkan Gemini API Key di file .env atau menu Profil.'
    );
  }

  // Model Gemini 3.6 Flash (Latest Fast Vision Model)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${effectiveApiKey}`;

  const systemPrompt = `
Anda adalah AI OCR & Akuntan Finansial Cerdas.
Periksa foto ini dengan seksama:
1. Apakah ini struk belanja, nota, bukti transaksi, kuitansi, bill restoran, atau tiket pembayaran?
   - Jika JELAS BUKAN struk/nota (misal: foto selfie, wajah orang, pemandangan, gambar hewan, objek acak yang tidak ada hubungan dengan transaksi/struk belanja), kembalikan:
     {"is_receipt": false, "rejection_reason": "Gambar yang Anda unggah bukan merupakan struk belanja atau bukti transaksi."}
2. Jika ini adalah struk/nota belanja (fisik, cetak kasir, maupun tulisan tangan nota warung), ekstrak data secara teliti dan kembalikan format JSON murni:
{
  "is_receipt": true,
  "merchant_name": "Nama toko/merchant (contoh: Indomaret, Alfamart, SPBU Pertamina, Starbucks, Warung Makan)",
  "transaction_date": "YYYY-MM-DDTHH:mm:ss",
  "suggested_category": "Makanan & Minuman | Belanja Bulanan | Transportasi | Tagihan & Utilitas | Hiburan & Rekreasi | Kesehatan & Medis | Pendidikan & Buku | Lainnya",
  "payment_method": "cash | qris | debit | credit | e-wallet | transfer",
  "subtotal": 0,
  "tax_amount": 0,
  "discount_amount": 0,
  "total_amount": 0,
  "items": [
    {"item_name": "Nama barang/menu", "quantity": 1, "unit_price": 0, "total_price": 0}
  ],
  "confidence_score": 0.95,
  "notes": "Nomor struk atau catatan kasir jika tertera"
}
Perhatian:
- Jangan sertakan format markdown seperti \`\`\`json. Kembalikan JSON murni.
- Pastikan semua angka nominal harga berupa angka bulat (integer) dalam Rupiah tanpa titik atau tulisan Rp.
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
    throw new Error(`Gemini API Error (${response.status}): Periksa kembali kuota atau validitas API Key Gemini Anda.`);
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
