// Supabase Edge Function - Gemini Vision Integration for Receipt Parsing
// Compatible with Deno / Supabase Edge Runtime

export interface ReceiptItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ExtractedReceiptResult {
  merchant_name: string;
  transaction_date: string; // ISO 8601 YYYY-MM-DDTHH:mm:ss
  suggested_category: string;
  payment_method: string;
  subtotal: number;
  shipping_fee?: number;
  admin_fee?: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  items: ReceiptItem[];
  confidence_score: number;
  notes: string;
}

export async function parseReceiptWithGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedReceiptResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `
Anda adalah asisten AI OCR dan akuntan finansial profesional tingkat lanjut khusus mengekstrak data dari foto struk belanja, nota, dan aplikasi pesanan online di Indonesia (Indomaret, Alfamart, ShopeeFood, GrabFood, GoFood, restoran, SPBU, dsb.).

Tugas Anda:
1. Baca foto struk dengan cermat.
2. Ekstrak data berikut dan kembalikan HANYA format JSON murni tanpa markdown/penjelasan:
   - merchant_name: Nama toko/restoran/aplikasi (contoh: "ShopeeFood", "Indomaret", "Alfamart").
   - transaction_date: Tanggal dan waktu transaksi dalam format ISO 8601 (YYYY-MM-DDTHH:mm:ss).
   - suggested_category: Pilih salah satu: "Makanan & Minuman", "Belanja Bulanan", "Transportasi", "Tagihan & Utilitas", "Hiburan & Rekreasi", "Kesehatan & Medis", "Pendidikan & Buku", "Lainnya".
   - payment_method: "cash", "qris", "debit", "credit", "e-wallet", atau "transfer".
   - subtotal: Subtotal harga produk sebelum ongkir, biaya admin, dan diskon.
   - shipping_fee: Biaya pengiriman / ongkir jika ada (0 jika tidak ada).
   - admin_fee: Total biaya layanan, biaya penanganan, dan biaya lain-lain jika ada (0 jika tidak ada).
   - tax_amount: Pajak (PPN/PB1) jika ada (0 jika tidak ada).
   - discount_amount: Potongan voucher / diskon (0 jika tidak ada).
   - total_amount: Total akhir yang dibayarkan pelanggan.
   - items: Daftar barang/menu yang dibeli:
     - item_name: Nama barang.
     - quantity: Jumlah barang.
     - unit_price: Harga satuan.
     - total_price: Harga total item (quantity * unit_price).
   - confidence_score: Tingkat keyakinan (0.0 - 1.0).
   - notes: Catatan tambahan seperti nomor pesanan jika ada.

Catatan penting:
- Jangan pernah mengembalikan NaN atau null untuk angka (gunakan 0).
- Pastikan semua nominal berupa angka integer/float tanpa simbol 'Rp' atau titik pemisah ribuan.
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
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
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini API did not return valid response text.');
  }

  try {
    const parsed: ExtractedReceiptResult = JSON.parse(rawText);
    return parsed;
  } catch (err) {
    // Clean backticks if any
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  }
}
