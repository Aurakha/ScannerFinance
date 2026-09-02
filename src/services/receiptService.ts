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
export interface ReceiptInputItem {
  uri: string;
  base64?: string;
}

/**
 * Memproses 1 hingga 5 foto struk sekaligus via Google Gemini Flash
 * Mendukung struk panjang (sambungan foto) dan batch struk berbeda
 */
export async function processReceiptImages(
  images: ReceiptInputItem[],
  userGeminiApiKey?: string,
  userName?: string
): Promise<ReceiptScanResult[]> {
  if (!images || images.length === 0) {
    throw new Error('Tidak ada foto struk yang dipilih.');
  }

  // Maksimal 5 foto sekaligus
  const targetImages = images.slice(0, 5);

  // Konversi semua gambar ke base64
  const base64List = await Promise.all(
    targetImages.map(async (img) => {
      return img.base64 || (await convertUriToBase64(img.uri));
    })
  );

  const validBase64 = base64List.filter((b): b is string => Boolean(b && b.length > 20));
  if (validBase64.length === 0) {
    throw new Error('Gagal membaca data foto struk belanja.');
  }

  // Generate nama file: tanggal_namaUser (contoh: 2-Sep-26_raka2.jpg)
  const today = new Date();
  const day = today.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = monthNames[today.getMonth()];
  const year = String(today.getFullYear()).slice(-2);
  const timeSuffix = `${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;
  const cleanName = (userName || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${day}-${month}-${year}_${cleanName}_${timeSuffix}.jpg`;

  // Upload foto utama ke Google Drive di latar belakang (non-blocking)
  let driveLink: string | undefined;
  const driveUploadPromise = (async () => {
    try {
      const driveRes = await uploadReceiptToGoogleDrive(validBase64[0], fileName);
      if (driveRes?.webViewLink) {
        driveLink = driveRes.webViewLink;
      }
    } catch (gdriveErr) {
      console.warn('Google Drive auto-upload notice:', gdriveErr);
    }
  })();

  // Prioritaskan kunci dari env/config terbaru, abaikan jika userGeminiApiKey adalah kunci lama yang bocor
  const isLeakedKey = (k?: string) => !k || k.includes('AIzaSyCaeDUdeVYLjE6VnrRN3Qtj_3TZ5qa6rXM');
  
  const effectiveApiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    (!isLeakedKey(userGeminiApiKey) ? userGeminiApiKey : '') ||
    DEFAULT_GEMINI_API_KEY;

  if (!effectiveApiKey || isLeakedKey(effectiveApiKey)) {
    throw new Error('Kunci Gemini API Key belum terpasang atau tidak valid.');
  }

  // Model candidate fallback sequence untuk antisipasi lonjakan trafik / model 503
  const CANDIDATE_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
  ];

  const systemPrompt = `
Anda adalah AI OCR & Akuntan Finansial Cerdas Khusus Pembukuan, Struk Belanja, & Aplikasi Pesanan Online di Indonesia (ShopeeFood, GrabFood, GoFood, Tokopedia, Indomaret, SPBU Pertamina, Restoran, Nota Manual Toko, dll.).
Pengguna mengunggah ${validBase64.length} foto struk belanja.

PERATURAN UTAMA ANALISIS FOTO:
1. DETEKSI STRUK BERBEDA (STANDAR UTAMA):
   - Periksa setiap foto dengan saksama. Jika foto-foto tersebut adalah struk/nota yang BERBEDA (misal: beda toko, beda tanggal/jam, nomor nota berbeda, atau struk fisik terpisah):
   -> ANDA WAJIB MENGHASILKAN 1 OBJEK TRANSAKSI TERSENDIRI UNTUK SETIAP STRUK di dalam array "receipts"!
   -> Contoh: Jika pengguna mengunggah ${validBase64.length} foto struk yang berbeda toko/waktu, maka array "receipts" HARUS BERISI ${validBase64.length} TRANSAKSI LENGKAP! JANGAN PERNAH MENGGABUNGKAN STRUK YANG BERBEDA!

2. DETEKSI STRUK SAMBUNGAN (1 STRUK PANJANG):
   - HANYA JIKA 2 atau lebih foto jelas-jelas merupakan bagian lanjutan fisik dari SATU struk belanja yang sama (nama toko persis sama, jam persis sama, nomor pesanan sama), barulah Anda satukan rincian item barangnya menjadi 1 objek.

Aturan Pembagian Kategori Form SKA:
- "Pantry": makanan, minuman, snack, beras, gula, kopi, teh, air galon, konsumsi kantor/karyawan.
- "Fasilitas": sapu, pel, pembersih lantai, sabun cuci, tissue, pakan ikan, wifi/internet, perlengkapan gedung/kantor.
- "Operational": bensin pertamina/shell, biaya parkir, tol, grab, gojek, ekspedisi kurir/cargo, operasional lapangan.
- "Lain-Lain": reimburse meeting, jasa teknisi/perbaikan, perlengkapan darurat, dan biaya operasional lainnya.

Format Output JSON Wajib:
{
  "is_receipt": true,
  "receipts": [
    {
      "merchant_name": "ShopeeFood",
      "transaction_date": "2026-08-19T16:49:00",
      "suggested_category": "Pantry",
      "payment_method": "e-wallet",
      "subtotal": 68000,
      "shipping_fee": 8000,
      "admin_fee": 6500,
      "tax_amount": 0,
      "discount_amount": 12000,
      "total_amount": 70500,
      "items": [
        {"item_name": "Bakmi Godog", "quantity": 1, "unit_price": 34000, "total_price": 34000}
      ],
      "confidence_score": 0.99,
      "notes": "No. Pesanan jika ada"
    }
  ]
}
Perhatian: Kembalikan JSON murni tanpa markdown. Jika BUKAN struk/dokumen transaksi, kembalikan {"is_receipt": false, "rejection_reason": "Gambar bukan struk belanja atau bukti transaksi."}.
`;

  const imageParts = validBase64.map((b64) => ({
    inline_data: {
      mime_type: 'image/jpeg',
      data: b64,
    },
  }));

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  let parsed: any = null;
  let lastErrorMsg = '';

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveApiKey}`;
      
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${modelName} returned status ${response.status}:`, errorText);
        lastErrorMsg = `Gemini (${modelName}) ${response.status}: ${errorText.slice(0, 100)}`;
        continue;
      }

      const jsonResponse = await response.json();
      const parts = jsonResponse?.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find((p: any) => p.text && !p.thought) || parts[0];
      const rawText = textPart?.text;

      if (!rawText) {
        console.warn(`Model ${modelName} returned no text candidate.`);
        continue;
      }

      try {
        parsed = JSON.parse(rawText);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        }
      }

      if (parsed) {
        // Berhasil mendapatkan hasil dari model ini
        break;
      }
    } catch (modelErr: any) {
      console.warn(`Attempt with ${modelName} failed:`, modelErr);
      lastErrorMsg = modelErr.message || String(modelErr);
    }
  }

  if (!parsed) {
    throw new Error(
      lastErrorMsg ||
        'Gagal memproses struk dengan AI. Silakan periksa koneksi internet atau gunakan kunci Gemini API pribadi Anda.'
    );
  }

  if (parsed.is_receipt === false) {
    throw new Error(
      parsed.rejection_reason ||
        'Gambar yang Anda unggah tidak terdeteksi sebagai struk belanja. Mohon unggah foto struk/nota pembayaran yang valid.'
    );
  }

  let rawReceipts: any[] = [];
  if (Array.isArray(parsed.receipts) && parsed.receipts.length > 0) {
    rawReceipts = parsed.receipts;
  } else if (parsed.merchant_name || parsed.total_amount !== undefined) {
    rawReceipts = [parsed];
  } else if (Array.isArray(parsed) && parsed.length > 0) {
    rawReceipts = parsed;
  } else {
    throw new Error('AI tidak menemukan rincian transaksi pada gambar yang diunggah.');
  }

  // Tunggu sejenak jika upload Drive selesai cepat (maksimal 3 detik agar tidak lambat)
  try {
    await Promise.race([
      driveUploadPromise,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {}

  return rawReceipts.map((rc: any, idx: number) => {
    const finalTotal = Number(rc.total_amount) || Number(rc.subtotal) || 0;
    const photoForThis = (idx === 0 && driveLink) ? driveLink : (targetImages[idx]?.uri || targetImages[0]?.uri);
    return {
      merchant_name: rc.merchant_name || 'Toko Belanja',
      transaction_date: rc.transaction_date || new Date().toISOString(),
      suggested_category: rc.suggested_category || 'Pantry',
      payment_method: rc.payment_method || 'cash',
      subtotal: Number(rc.subtotal) || finalTotal,
      shipping_fee: Number(rc.shipping_fee) || 0,
      admin_fee: Number(rc.admin_fee) || 0,
      tax_amount: Number(rc.tax_amount) || 0,
      discount_amount: Number(rc.discount_amount) || 0,
      total_amount: finalTotal,
      items: (rc.items || []).map((it: any) => ({
        item_name: it.item_name || 'Item',
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
        total_price: Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
      })),
      confidence_score: rc.confidence_score || 0.95,
      notes: rc.notes || '',
      receipt_image_uri: photoForThis,
    };
  });
}

/**
 * Wrapper single-receipt untuk kompatibilitas fungsi pemanggil yang lama
 */
export async function processReceiptImage(
  imageUri: string,
  userGeminiApiKey?: string,
  rawBase64?: string,
  userName?: string
): Promise<ReceiptScanResult> {
  const results = await processReceiptImages(
    [{ uri: imageUri, base64: rawBase64 }],
    userGeminiApiKey,
    userName
  );
  return results[0];
}

export function getSampleDemoReceipt(index = 0): ReceiptScanResult {
  return {
    ...DEMO_RECEIPTS[index % DEMO_RECEIPTS.length],
    transaction_date: new Date().toISOString(),
  };
}
