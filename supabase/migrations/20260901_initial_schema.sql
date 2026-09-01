-- ==============================================================================
-- SCANFINANCE - SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- (Idempotent: Aman dijalankan berulang kali tanpa error)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Auto-linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    currency VARCHAR(10) DEFAULT 'IDR',
    monthly_income_budget NUMERIC(15, 2) DEFAULT 0,
    monthly_expense_budget NUMERIC(15, 2) DEFAULT 5000000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger untuk membuat row profile otomatis saat user register via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means default system category
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    type VARCHAR(20) DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Receipt Scans Table (Audit Log of Uploaded Receipts & AI Responses)
CREATE TABLE IF NOT EXISTS public.receipt_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    raw_ai_response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    receipt_scan_id UUID REFERENCES public.receipt_scans(id) ON DELETE SET NULL,
    merchant_name VARCHAR(255) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'cash', -- 'cash', 'qris', 'debit', 'credit', 'e-wallet', 'transfer'
    notes TEXT,
    receipt_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    month_year VARCHAR(7) NOT NULL, -- Format 'YYYY-MM'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id, month_year)
);

-- ==============================================================================
-- DEFAULT SYSTEM CATEGORIES
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
-- KEAMANAN: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policy (Drop jika ada lalu buat ulang)
DROP POLICY IF EXISTS "Users can view and edit their own profile" ON public.profiles;
CREATE POLICY "Users can view and edit their own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Categories Policy
DROP POLICY IF EXISTS "Users can view default categories and own categories" ON public.categories;
CREATE POLICY "Users can view default categories and own categories"
    ON public.categories FOR SELECT
    USING (is_default = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert, update, delete own categories" ON public.categories;
CREATE POLICY "Users can insert, update, delete own categories"
    ON public.categories FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Receipt Scans Policy
DROP POLICY IF EXISTS "Users can manage their own receipt scans" ON public.receipt_scans;
CREATE POLICY "Users can manage their own receipt scans"
    ON public.receipt_scans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Transactions Policy
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Transaction Items Policy
DROP POLICY IF EXISTS "Users can manage items belonging to their transactions" ON public.transaction_items;
CREATE POLICY "Users can manage items belonging to their transactions"
    ON public.transaction_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions
            WHERE transactions.id = transaction_items.transaction_id
            AND transactions.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.transactions
            WHERE transactions.id = transaction_items.transaction_id
            AND transactions.user_id = auth.uid()
        )
    );

-- 6. Budgets Policy
DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;
CREATE POLICY "Users can manage their own budgets"
    ON public.budgets FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month_year);
