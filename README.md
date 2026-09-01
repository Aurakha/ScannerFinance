# ScanFinance 💳🧾

**Aplikasi Rekap Keuangan Cerdas Berbasis Scan Struk (AI Vision Multimodal)**

ScanFinance adalah aplikasi manajemen keuangan pribadi dan rekapitulasi klaim operasional perusahaan berbasis foto struk belanja. Pengguna tidak perlu lagi mengetik nominal atau nama barang secara manual; cukup mengambil foto struk belanja (Indomaret, Alfamart, SPBU, restoran, nota warung), dan sistem akan mengekstrak informasi transaksi secara otomatis menggunakan kecerdasan buatan (**Google Gemini 3.6 Flash**), menyimpannya ke **PostgreSQL Supabase**, serta mengarsipkan foto ke **Google Drive**.

---

## ✨ Fitur Utama
- **⚡ Smart Receipt Scanner**: Memindai foto struk belanja fisik secara live dan mengekstrak nama toko, tanggal, rincian barang belanjaan, pajak, diskon, dan total biaya secara akurat.
- **📝 Verifikasi Sebelum Simpan**: Form interaktif untuk mengedit, menambah, atau menghapus rincian item belanja sebelum disimpan ke database.
- **📊 Dashboard Finansial & Donut Chart**: Visualisasi distribusi pengeluaran per kategori, batas anggaran bulanan, dan rata-rata pengeluaran harian.
- **📁 Ekspor Format Spreadsheet Perusahaan**: Unduh rekapitulasi klaim biaya/reimbursement format CSV (1 baris per item barang belanjaan) yang siap dibuka di Microsoft Excel atau Google Sheets.
- **🎨 Discord Dark Theme**: Tampilan antarmuka modern bernuansa *Discord Dark* & *Blurple*.
- **☁️ Google Drive & Supabase**: Sinkronisasi database PostgreSQL berkeamanan Row Level Security (RLS) serta arsip foto struk ke Google Drive.

---

## 🛠️ Tech Stack
- **Frontend**: React Native (Expo SDK 57), Expo Router, TypeScript, React Native SVG, Zustand
- **AI Engine**: Google Gemini 3.6 Flash Multimodal Vision API
- **Backend & Database**: Supabase PostgreSQL + Row Level Security (RLS)
- **Cloud Storage**: Google Drive API (Multipart Upload)

---

## 🚀 Cara Menjalankan Secara Lokal

1. **Clone repository:**
   ```bash
   git clone https://github.com/Aurakha/ScannerFinance.git
   cd ScannerFinance
   ```

2. **Instal dependensi:**
   ```bash
   npm install
   ```

3. **Buat file `.env`:**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyYourGeminiApiKey
   EXPO_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN=your-google-drive-token
   ```

4. **Jalankan Aplikasi Web:**
   ```bash
   npm run web
   ```
   *Buka `http://localhost:8081` di browser Anda.*

5. **Jalankan di Android / iOS (Expo Go):**
   ```bash
   npx expo start
   ```

---

## 🌐 Cara Deploy ke Vercel / Netlify (Gratis & Cepat)
1. Buka [vercel.com](https://vercel.com) atau [netlify.com](https://netlify.com).
2. Login dengan akun GitHub Anda.
3. Pilih repository **`Aurakha/ScannerFinance`**.
4. Di bagian **Build Settings**:
   - Build Command: `npx expo export --platform web`
   - Output Directory: `dist`
5. Masukkan Environment Variables (`EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, dll.).
6. Klik **Deploy**! Web app Anda akan langsung online dan bisa diakses publik.
