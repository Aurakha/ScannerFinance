export type PaymentMethod = 'cash' | 'qris' | 'debit' | 'credit' | 'e-wallet' | 'transfer' | 'unknown';

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  is_default?: boolean;
}

export interface TransactionItem {
  id?: string;
  transaction_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id?: string | null;
  category?: Category;
  receipt_scan_id?: string | null;
  merchant_name: string;
  transaction_date: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  shipping_fee?: number;
  admin_fee?: number;
  payment_method: PaymentMethod;
  notes?: string;
  receipt_image_url?: string;
  items?: TransactionItem[];
  created_at: string;
  updated_at?: string;
}

export interface ReceiptScanResult {
  merchant_name: string;
  transaction_date: string;
  suggested_category: string;
  payment_method: PaymentMethod;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  shipping_fee?: number;
  admin_fee?: number;
  total_amount: number;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  confidence_score: number;
  notes?: string;
  receipt_image_uri?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name?: string;
  department?: string;
  project_name?: string;
  city?: string;
  verifier_name?: string; // Diperiksa oleh
  approver_name?: string; // Diperiksa & Diketahui oleh
  cash_advance_amount?: number;
  submission_date?: string;
  avatar_url?: string;
  currency: string;
  monthly_income_budget: number;
  monthly_expense_budget: number;
  role?: 'admin' | 'user';
  created_at?: string;
}

export interface MonthlyStats {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  budgetLimit: number;
  budgetUsedPercentage: number;
  dailyAverage: number;
  receiptCount: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
}
