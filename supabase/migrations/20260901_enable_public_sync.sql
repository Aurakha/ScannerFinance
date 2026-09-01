-- ==============================================================================
-- MIGRATION: Izinkan Sinkronisasi Transaksi Langsung ke Supabase (Public & Anon)
-- Jalankan skrip ini di SQL Editor Dashboard Supabase Anda
-- ==============================================================================

-- 1. Buat kolom user_id di tabel transactions menjadi opsional (Nullable)
ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;

-- 2. Berikan izin Akses Penuh (Insert, Select, Update, Delete) untuk pengguna publik / anon
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
