-- ==============================================================================
-- SCANFINANCE - ALL-IN-ONE SUPABASE DATABASE SETUP & SYNC SCRIPT
-- Jalankan skrip ini di SQL Editor Dashboard Supabase Anda.
-- Bersifat Idempotent (Aman dijalankan berkali-kali tanpa merusak data yang ada).
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Auto-linked with auth.users & Data Perusahaan Reimbursement)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    company_name TEXT DEFAULT 'PT. Nama Perusahaan',
    department TEXT DEFAULT 'Divisi Operasional',
    project_name TEXT DEFAULT 'Head Office / Proyek 1',
    city TEXT DEFAULT 'Jakarta',
    verifier_name TEXT DEFAULT 'Pemeriksa 1',
    approver_name TEXT DEFAULT 'Pimpinan 1',
    cash_advance_amount NUMERIC(15, 2) DEFAULT 5000000,
    submission_date TEXT DEFAULT NULL,
    currency VARCHAR(10) DEFAULT 'IDR',
    monthly_income_budget NUMERIC(15, 2) DEFAULT 0,
    monthly_expense_budget NUMERIC(15, 2) DEFAULT 5000000,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom baru tetap ditambahkan jika tabel profiles sudah pernah dibuat sebelumnya
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'PT. Nama Perusahaan',
ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Divisi Operasional',
ADD COLUMN IF NOT EXISTS project_name TEXT DEFAULT 'Head Office / Proyek 1',
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Jakarta',
ADD COLUMN IF NOT EXISTS verifier_name TEXT DEFAULT 'Pemeriksa 1',
ADD COLUMN IF NOT EXISTS approver_name TEXT DEFAULT 'Pimpinan 1',
ADD COLUMN IF NOT EXISTS cash_advance_amount NUMERIC(15, 2) DEFAULT 5000000,
ADD COLUMN IF NOT EXISTS submission_date TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Receipt Scans Table (Audit Log AI OCR)
CREATE TABLE IF NOT EXISTS public.receipt_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    raw_ai_response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transactions Table (Mendukung user_id nullable untuk mode demo & offline sync)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    receipt_scan_id UUID REFERENCES public.receipt_scans(id) ON DELETE SET NULL,
    merchant_name VARCHAR(255) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    shipping_fee NUMERIC(15, 2) DEFAULT 0,
    admin_fee NUMERIC(15, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    receipt_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan user_id nullable & kolom ongkir / admin fee ada jika tabel lama sudah ada
ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(15, 2) DEFAULT 0;

-- 6. Transaction Items Table (Detail Barang di dalam Struk)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    monthly_limit NUMERIC(15, 2) NOT NULL,
    month_year VARCHAR(7) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id, month_year)
);

-- ==============================================================================
-- DEFAULT CATEGORIES
-- ==============================================================================
INSERT INTO public.categories (name, icon, color, type, is_default) VALUES
('Makanan & Minuman', 'restaurant', '#F59E0B', 'expense', true),
('Belanja Bulanan', 'cart', '#10B981', 'expense', true),
('Transportasi', 'car', '#3B82F6', 'expense', true),
('Tagihan & Utilitas', 'flash', '#8B5CF6', 'expense', true),
('Hiburan & Rekreasi', 'game-controller', '#EC4899', 'expense', true),
('Kesehatan & Medis', 'medkit', '#EF4444', 'expense', true),
('Pendidikan & Buku', 'book', '#06B6D4', 'expense', true),
('Gaji & Pendapatan', 'wallet', '#10B981', 'income', true),
('Lainnya', 'ellipsis-horizontal', '#6B7280', 'expense', true)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- TRIGGER REGISTRASI AKUN OTOMATIS
-- ==============================================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);

-- Categories Policies
DROP POLICY IF EXISTS "Allow anon all on categories" ON public.categories;
CREATE POLICY "Allow anon all on categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Transactions Policies
DROP POLICY IF EXISTS "Allow anon all on transactions" ON public.transactions;
CREATE POLICY "Allow anon all on transactions" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Transaction Items Policies
DROP POLICY IF EXISTS "Allow anon all on transaction_items" ON public.transaction_items;
CREATE POLICY "Allow anon all on transaction_items" ON public.transaction_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Budgets Policies
DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;
CREATE POLICY "Users can manage their own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Receipt Scans Policies
DROP POLICY IF EXISTS "Users can manage their own receipt scans" ON public.receipt_scans;
CREATE POLICY "Users can manage their own receipt scans" ON public.receipt_scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month_year);
