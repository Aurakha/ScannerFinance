-- ==============================================================================
-- MIGRATION: Izinkan Sinkronisasi Transaksi Langsung ke Supabase (Public & Anon)
-- Jalankan skrip ini di SQL Editor Dashboard Supabase Anda (Hanya 1x Eksekusi)
-- ==============================================================================

-- 1. Buat kolom user_id di tabel transactions menjadi opsional (Nullable)
ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;

-- 2. Tambahkan kolom ongkir dan biaya admin jika belum ada
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(15, 2) DEFAULT 0;

-- 3. Berikan izin Akses Penuh (Insert, Select, Update, Delete) untuk pengguna publik / anon
DROP POLICY IF EXISTS "Allow anon all on transactions" ON public.transactions;
CREATE POLICY "Allow anon all on transactions"
    ON public.transactions
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on transaction_items" ON public.transaction_items;
CREATE POLICY "Allow anon all on transaction_items"
    ON public.transaction_items
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on categories" ON public.categories;
CREATE POLICY "Allow anon all on categories"
    ON public.categories
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
