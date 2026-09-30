# Panduan Strategi Backup Otomatis & Disaster Recovery Supabase (ScanFinance)

Dokumen ini menjelaskan arsitektur, strategi backup otomatis, dan rencana pemulihan bencana (*Disaster Recovery*) untuk database Supabase pada aplikasi **ScanFinance**, dengan fokus pada pencegahan kehilangan data saat server mengalami gangguan (*outage* atau *down*).

---

## 1. Masalah Utama & Prinsip Dasar

> **Prinsip Penting:**
> Ketika server database **sudah dalam kondisi mati/down**, sistem luar **tidak dapat** mengambil backup data secara mendadak karena port koneksi dan server fisik tidak merespons.

Oleh karena itu, strategi proteksi data tidak menunggu server down, melainkan **berjalan otomatis secara kontinu sebelum insiden terjadi**.

### Dua Pendekatan Perlindungan Data:
1. **Scheduled Snapshot (Backup Terjadwal Berkala):**
   * Mengambil salinan database setiap beberapa jam atau harian.
   * *Risiko:* Jika server down pada pukul 14:00 dan backup terakhir pukul 00:00, data transaksi 14 jam terakhir berisiko hilang (*data loss window* = 14 jam).
2. **Real-Time Replication / Database Mirroring (Zero Data Loss) ⭐:**
   * Setiap ada transaksi atau perubahan data di Supabase, detik itu juga (*sub-second latency*) disalin ke database cadangan di penyedia cloud independen.
   * *Hasil:* Jika Supabase mati mendadak, data di server cadangan sudah 100% lengkap sampai detik terakhir.

---

## 2. Arsitektur Replikasi Real-Time

Alur replikasi real-time bekerja dengan membaca log perubahan data internal PostgreSQL (*Write-Ahead Log* / WAL):

```
┌────────────────────────────────┐
│   Aplikasi ScanFinance (User)  │
└───────────────┬────────────────┘
                │ Menulis Transaksi
                ▼
┌────────────────────────────────┐
│      SUPABASE (Primary DB)     │
│   PostgreSQL + WAL Replication │
└───────────────┬────────────────┘
                │
                │ Replikasi Real-Time (< 1 detik)
                ▼
┌────────────────────────────────┐
│     DATABASE CADANGAN (Replica)│
│  (Neon.tech / AWS RDS / GCP)   │
└────────────────────────────────┘
```

---

## 3. Pilihan Solusi Replikasi & Rincian Biaya

Berikut adalah 3 metode untuk menerapkan replikasi real-time beserta estimasi biaya operasionalnya:

### Opsi 1: Native PostgreSQL Logical Replication (Rekomendasi Utama ⭐)
Menggunakan fitur bawaan PostgreSQL (`PUBLICATION` dan `SUBSCRIPTION`) tanpa perantara aplikasi pihak ketiga.

* **Cara Kerja:**
  1. Supabase (Primary) mengaktifkan `PUBLICATION` untuk tabel-tabel transaksi.
  2. Database cadangan (misal: **Neon.tech** atau **Railway**) mengaktifkan `SUBSCRIPTION` yang langsung menyalin data via koneksi SSL.
* **Kelebihan:**
  * Biaya perantara $0 (fitur gratis bawaan Postgres).
  * Latensi super cepat (< 1 detik).
  * Tidak bergantung pada pihak ketiga selain kedua server database.
* **Estimasi Biaya Bulanan:**
  * Supabase Pro Tier: **$25 / bulan** (diperlukan untuk stabilitas koneksi & akses replication slot).
  * Neon.tech Postgres (Cadangan): **$0 (Free tier < 0.5 GB)** atau **$19 / bulan** (Launch tier).
  * **Total Biaya: ± $25 - $44 / bulan (~Rp 400.000 - Rp 700.000 / bulan)**.

---

### Opsi 2: Managed CDC Platform - Estuary Flow (Paling Praktis)
Platform *Change Data Capture* (CDC) modern yang menyediakan dashboard visual tanpa perlu banyak mengetik query SQL.

* **Situs Resmi:** [estuary.dev](https://estuary.dev)
* **Cara Kerja:**
  * Estuary membaca koneksi Supabase sebagai *Source* dan menulis ke database cadangan sebagai *Destination*.
* **Kelebihan:**
  * Konfigurasi berbasis web UI yang sangat mudah.
  * Dilengkapi monitoring visual, health check, dan sistem alarm otomatis.
* **Estimasi Biaya Bulanan:**
  * Supabase Pro Tier: **$25 / bulan**.
  * Estuary Flow: **Gratis hingga transfer 10 GB/bulan** (jika melebihi, bayar sesuai pemakaian ~$20/bln).
  * Database Cadangan (Neon/Railway): **$10 - $19 / bulan**.
  * **Total Biaya: ± $44 - $64 / bulan (~Rp 700.000 - Rp 1.000.000 / bulan)**.

---

### Opsi 3: Enterprise Data Pipeline - Airbyte Cloud
Standar integrasi data level korporat untuk replikasi skala besar.

* **Situs Resmi:** [airbyte.com](https://airbyte.com)
* **Cara Kerja:** Menggunakan konektor resmi Airbyte PostgreSQL CDC yang berjalan terjadwal tiap 1 - 5 menit.
* **Kelebihan:** Standar industri, audit log lengkap, sertifikasi keamanan SOC-2.
* **Estimasi Biaya Bulanan:**
  * Supabase Pro: **$25 / bulan**.
  * Airbyte Cloud: Mulai **~$50 - $100 / bulan** (berdasarkan kredit sync data).
  * Database Cadangan: **$19 / bulan**.
  * **Total Biaya: ± $94 - $144 / bulan (~Rp 1.500.000 - Rp 2.300.000 / bulan)**.

---

## 4. Tabel Perbandingan Biaya & Fitur

| Kriteria | Opsi 1: Native Postgres | Opsi 2: Estuary Flow | Opsi 3: Airbyte Cloud |
| :--- | :--- | :--- | :--- |
| **Latensi Salin Data** | Real-time (< 1 detik) | Real-time (milidetik) | 1 - 5 Menit |
| **Kompleksitas Setup** | Menengah (SQL Command) | Mudah (UI Web) | Mudah (UI Web) |
| **Ketergantungan SaaS** | Tidak ada (Pure Postgres) | Bergantung ke Estuary | Bergantung ke Airbyte |
| **Biaya Middleware** | **$0 (Gratis)** | **$0 (Free Tier 10GB)** | ~$50+/bln |
| **Estimasi Total/Bulan** | **~$25 - $44 (± Rp 400rb - 700rb)** | **~$44 - $64 (± Rp 700rb - 1jt)** | **~$94+ (± Rp 1.5jt+)** |

---

## 5. Bagaimana dengan File / Foto Struk (Supabase Storage)?

Data transaksi tabel dan file gambar struk disimpan di tempat yang berbeda:
* **Tabel Database:** Otomatis tercakup dalam replikasi PostgreSQL di atas.
* **Foto Struk (Storage Bucket):** Tidak ikut dalam replikasi PostgreSQL.

### Solusi Backup Storage:
1. **Sinkronisasi Berkala via Tool Cloud (Rclone / Worker Script):**
   * Buat job otomatis yang menyalin file dari bucket Supabase Storage ke bucket cadangan independen (misalnya **Cloudflare R2** atau **Google Cloud Storage**).
   * Cloudflare R2 memiliki *Zero Egress Fee* (tanpa biaya download data) dan gratis untuk 10 GB pertama per bulan.

---

## 6. Prosedur Darurat: Apa yang Dilakukan Jika Supabase Down?

Ketika terjadi insiden Supabase mati total:

```
                  [INSIDEN: Supabase Down]
                             │
                             ▼
     [1. Deteksi Gangguan melalui Alert / Monitoring]
                             │
                             ▼
     [2. Buka Konfigurasi Server Backend (Environment)]
                             │
                             ▼
     [3. Ganti URL DATABASE_URL ke Host Cadangan (Neon.tech)]
                             │
                             ▼
     [4. Restart / Redeploy Service (Vercel / Cloud)]
                             │
                             ▼
        [Aplikasi Kembali Online dalam < 5 Menit]
```

1. **Ganti Environment Variable:**  
   Ubah parameter koneksi database pada konfigurasi server/deployment (misal Vercel / Railway / backend service):
   ```env
   # Dari (Supabase):
   DATABASE_URL="postgres://postgres:password@db.xxxx.supabase.co:5432/postgres"

   # Menjadi (Database Cadangan Neon.tech):
   DATABASE_URL="postgres://user:password@ep-xxxx.neon.tech/neondb?sslmode=require"
   ```
2. **Redeploy / Restart:** Aplikasi langsung membaca data dari database cadangan yang sudah terisi lengkap.
3. Tidak ada transaksi yang tertinggal karena data sudah diduplikasi secara berkala dan kontinu.

---

## 7. Rekomendasi Langkah Awal untuk ScanFinance

1. **Upgrade ke Supabase Pro ($25/bln):** Untuk membuka kapabilitas replication slots dan mencegah database sleep.
2. **Buat Database Cadangan di Neon.tech:** Buat akun gratis di [neon.tech](https://neon.tech) untuk instance database Postgres kedua.
3. **Konfigurasikan Logical Replication:** Hubungkan Supabase ke Neon menggunakan query `CREATE PUBLICATION` & `CREATE SUBSCRIPTION`.
4. **Dokumentasikan Kredensial Cadangan:** Simpan connection string database cadangan pada vault rahasia tim untuk aktivasi cepat saat kondisi darurat.
