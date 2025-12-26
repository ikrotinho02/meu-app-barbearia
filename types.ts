
export interface DatabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface GenericTable {
  [key: string]: any;
}

export type UserRole = 'professional' | 'client';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  cashback_balance?: number;
  last_visit?: string;
  total_spent?: number;
  vip_plan?: 'none' | 'gold' | 'black';
  specialty?: string;
  occupancy_rate?: number;
  rating?: number;
}

// --- SaaS Metrics Types ---
export interface SaaSMetrics {
  mrr: number;
  churnRate: number;
  cashForecast30d: number;
  activeCount: number;
  usageComparison: {
    subscriberVisits: number;
    regularVisits: number;
  };
  delinquencyCount: number;
}

export interface DelinquencyRecord {
  id: string;
  clientName: string;
  planName: string;
  lastAttempt: string;
  amount: number;
  status: 'failed' | 'past_due';
}

// --- Theme & Settings Types ---

export interface OperatingHours {
  dayIndex: number; // 0 = Sunday, 1 = Monday...
  dayName: string;
  isOpen: boolean;
  start: string; // "09:00"
  end: string; // "18:00"
}

export interface ShopProfile {
  name: string;
  slogan: string;
  logoUrl: string | null;
  news?: string; // New field for client announcements
}

export interface ThemeConfig {
  mode: 'light' | 'dark';
  brandColor: string;
  agendaInterval?: 5 | 10 | 30 | 60; // New dynamic interval
}

// --- Marketing & Cashback Types ---

export interface MarketingConfig {
  currencyName: string; // e.g. "BurnCoins"
  exchangeRate: number; // Value in currency (R$) for 1 unit of coin. e.g. 1 Coin = R$ 1.00
  referralBonus: number; // Coins given to the referrer
  registerBonus: number; // Coins given on registration
}

// --- New Types for Smart Agenda ---

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'BLOCKED';

export interface WorkSchedule {
  start: string; // "09:00"
  end: string; // "20:00"
  lunchStart?: string; // "12:00"
  lunchEnd?: string; // "13:00"
}

export interface Professional {
  id: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  workSchedule?: WorkSchedule; // Individual Schedule
  role: string;
  commissionRate: number;
  status: 'ACTIVE' | 'VACATION';
}

export type ServiceCategory = 'Cabelo' | 'Barba' | 'Estética' | 'Química' | 'Outros';

export interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description?: string;
  category?: ServiceCategory; // New field
  // New Commission Logic
  commissionType: 'default' | 'custom'; // 'default' follows professional's rate, 'custom' uses specific rate
  customCommissionRate?: number; 
  // Cashback Logic
  cashbackReward?: number; // How many coins this service generates
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  category: 'product';
}

export interface AppointmentItem {
  id: string; // Service ID or Product ID
  name: string;
  price: number;
  type: 'service' | 'product';
  durationMinutes?: number; // Added for automatic scheduling calculation
}

export interface Appointment {
  id: string;
  barberId: string;
  clientId: string;
  clientName: string;
  clientVip?: boolean;
  items: AppointmentItem[]; // Services + Products
  startTime: string; // ISO String or "HH:mm" for today's view logic
  durationMinutes: number;
  status: AppointmentStatus;
  totalValue: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
}

export type ProductCategory = 'hair' | 'beard' | 'beverage' | 'food' | 'other';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  stock: number;
  min_stock: number;
  price: number; // Selling price
  cost: number; // Purchase cost
  commission_rate?: number; // Percentage for professional
  status: string; // 'Ativo' | 'Inativo'
  imageUrl?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  total_spent: number;
  visits_count: number;
  last_visit?: string; // ISO Date
  notes?: string;
  birth_date?: string;
  how_did_you_know?: string; 
  created_at?: string;
  subscriptionStatus?: 'ACTIVE' | 'PAUSED' | 'PENDING_PAYMENT' | 'NONE'; // Added for UI logic
  cashback_balance?: number; // Current coins (Renamed to match DB snake_case)
  credit_balance?: number; // Store credit (Troco)
}

export interface Campaign {
  id: string;
  name: string;
  type: 'whatsapp' | 'email';
  target: string;
  conversion_rate: number;
  status: 'active' | 'completed';
}

export interface Log {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

// --- Financial Types ---

export type PaymentMethodType = 'credit' | 'debit' | 'pix' | 'cash' | 'cashback' | 'store_credit' | 'discount';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  feePercentage: number; // e.g., 2.5 for 2.5%
  receiveDays: number; // e.g., 1 (next day), 30 (30 days)
  isActive: boolean;
}

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number; // Gross amount
  fee_amount?: number; // NEW: Fee deducted automatically
  type: 'INCOME' | 'EXPENSE';
  category: 'SERVICE_SALE' | 'PRODUCT_SALE' | 'SUBSCRIPTION_SALE' | 'COMMISSION' | 'EXPENSE' | 'ADVANCE' | 'OTHER';
  date: string;
  payment_method?: string; // Link to PaymentMethod ID or Type
  status: 'PAID' | 'PENDING';
  due_date?: string; // For bills to pay
  customer_name?: string;
  appointment_id?: string; // Vínculo com agendamento
}

// --- Cash Register Types ---

export interface CashTransaction {
  id: string;
  timestamp: string;
  description: string;
  amount: number;
  type: 'IN' | 'OUT';
  method: PaymentMethodType; // 'cash', 'credit', 'debit', 'pix'
  feeAmount?: number; // Store locally for session
  appointmentId?: string; // Vínculo com agendamento
}

export interface DailyCash {
  isOpen: boolean;
  openedAt: string | null;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  transactions: CashTransaction[];
  responsibleName?: string; // Quem abriu
  observations?: string; // Observações da abertura
}

// --- Goal Types ---
export interface Goal {
  id: string;
  type: 'SHOP_REVENUE' | 'PRO_REVENUE' | 'PRO_SECONDARY';
  professionalId?: string; // Null if Shop Goal
  targetValue: number;
  period: 'monthly';
}

export interface ServiceTransaction {
  id: string;
  professionalId: string;
  appointmentId?: string; // Vínculo com agendamento
  payoutId?: string; // Links this items to the financial commission payout
  type: 'SERVICE' | 'BONUS' | 'PRODUCT_SALE' | 'EMPLOYEE_PURCHASE';
  serviceName: string; 
  clientName: string;
  date: string;
  price: number;
  commissionRateSnapshot: number;
  commissionAmountSnapshot: number; // Added field
  status: 'PENDING' | 'PAID';
  category?: 'beverage' | 'food' | 'hair' | 'beard' | 'other';
  metadata?: any;
}
