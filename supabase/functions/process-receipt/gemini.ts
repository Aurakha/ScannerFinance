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
Anda adalah asisten AI OCR dan akuntan finansial profesional tingkat lanjut khusus mengekstrak data dari foto struk belanja di Indonesia (seperti Indomaret, Alfamart, Hypermart, Superindo, restoran, kafe, SPBU Pertamina, nota manual warung/toko, dll.).

Tugas Anda:
1. Baca foto struk dengan sangat cermat, bahkan jika berkerut, berbayang, sedikit buram, atau miring.
2. Ekstrak data berikut dan kembalikan HANYA format JSON murni tanpa markdown/penjelasan:
   - merchant_name: Nama toko/restoran (misal: "Indomaret Point", "Kopi Kenangan", "Alfamart").
   - transaction_date: Tanggal dan waktu transaksi dalam format ISO 8601 (YYYY-MM-DDTHH:mm:ss). Jika jam tidak ada, default jam 12:00:00. Jika tahun tidak ada, asumsikan tahun berjalan.
   - suggested_category: Pilih salah satu yang paling relevan: "Makanan & Minuman", "Belanja Bulanan", "Transportasi", "Tagihan & Utilitas", "Hiburan & Rekreasi", "Kesehatan & Medis", "Pendidikan & Buku", "Lainnya".
   - payment_method: "cash", "qris", "debit", "credit", "e-wallet", atau "transfer".
   - subtotal: Total harga sebelum pajak/diskon (angka numeric).
   - tax_amount: Pajak (PPN 11%, PB1 10%, dsb.) jika ada, bernilai 0 jika tidak ada.
   - discount_amount: Total potongan harga/voucher/hemat jika ada, bernilai 0 jika tidak ada.
   - total_amount: Total akhir yang dibayarkan pelanggan (harus berupa angka nominal bersih).
   - items: Daftar barang belanjaan dengan format array:
     - item_name: Nama barang yang mudah dipahami (perbaiki singkatan umum struk ritel).
     - quantity: Jumlah barang (default 1).
     - unit_price: Harga satuan.
     - total_price: Harga total untuk item tersebut (quantity * unit_price).
   - confidence_score: Tingkat keyakinan pembacaan dari 0.0 sampai 1.0.
   - notes: Catatan tambahan seperti nomor struk atau info kasir jika ada.

Catatan penting:
- Jangan pernah mengembalikan NaN atau null untuk angka (gunakan 0).
- Pastikan semua nominal dalam mata uang Rupiah bulat tanpa simbol 'Rp' atau titik pemisah ribuan pada nilai JSON.
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
