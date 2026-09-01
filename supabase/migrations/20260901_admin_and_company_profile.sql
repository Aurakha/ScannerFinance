-- ==============================================================================
-- SCANFINANCE - UPDATE SKEMA PROFIL PERUSAHAAN & PANEL ADMIN SUPABASE
-- (Idempotent: Aman dijalankan berulang kali di Supabase SQL Editor)
-- ==============================================================================

-- 1. Tambahkan kolom profil reimbursement perusahaan ke tabel public.profiles jika belum ada
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'PT. Nama Perusahaan',
ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Divisi Operasional',
ADD COLUMN IF NOT EXISTS project_name TEXT DEFAULT 'Head Office / Proyek 1',
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Jakarta',
ADD COLUMN IF NOT EXISTS verifier_name TEXT DEFAULT 'Pemeriksa 1',
ADD COLUMN IF NOT EXISTS approver_name TEXT DEFAULT 'Pimpinan 1',
ADD COLUMN IF NOT EXISTS cash_advance_amount NUMERIC(15, 2) DEFAULT 5000000,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Pastikan RLS profiles mengizinkan read & update
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" 
ON public.profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
CREATE POLICY "Allow public insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
CREATE POLICY "Allow public update profiles" 
ON public.profiles FOR UPDATE 
USING (true);

-- 3. Perbarui trigger pendaftaran akun baru agar otomatis mengisi metadata perusahaan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        avatar_url,
        company_name,
        department,
        cash_advance_amount,
        role
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_user_meta_data->>'company_name', 'PT. Nama Perusahaan'),
        COALESCE(NEW.raw_user_meta_data->>'department', 'Divisi Operasional'),
        COALESCE((NEW.raw_user_meta_data->>'cash_advance_amount')::numeric, 5000000),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Selesai!
