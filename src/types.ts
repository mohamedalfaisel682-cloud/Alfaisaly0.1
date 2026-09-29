export type Currency = 'USD' | 'SAR' | 'RY';

export type TaskStatus = string;

export interface Task {
  id: number;
  customer: string;
  customerPhones?: string[];
  deviceType: string;
  brand: string;
  issue: string;
  cost: number;
  deposit: number;
  currency: Currency;
  status: TaskStatus;
  createdAt: string;
  taskType?: 'maintenance' | 'sale' | 'purchase';
  depositHistory?: { id: string, amount: number, currency: Currency, date: string, note?: string }[];
  imageUrl?: string; // Still keep for backward compatibility or as a primary image
  imageUrls?: string[]; // Support for multiple images
  deviceImages?: { [deviceIndex: number]: string[] }; // Map of device index to its images
  executionTime?: string;
  isAlarmActive?: boolean;
  isExecuted?: boolean;
  storageLocation?: string;
  devices?: { type: string, brand: string, quantity: number, imageUrls?: string[] }[];
  modelCosts?: Record<string, string>;
  updatedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  isArchived?: boolean;
  hiddenAt?: string;
  technician?: string;
  assignedEmployee?: string;
  category?: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  phones?: string[];
  address?: string;
  classification?: string;
  createdAt?: string;
}

export interface CustomerClassification {
  id?: number;
  name: string;
}

export interface InventoryItem {
  id: number;
  code: string;
  name: string;
  stock: number;
  minStock: number;
  costPrice: number;
  sellingPrice: number;
  currency: Currency;
  category: string;
  priority?: string;
  images?: string[];
  links?: string[];
  compatibleModels?: string[];
}

export type TransactionType = 'income' | 'expense' | 'due';

export interface Transaction {
  id: number;
  type: TransactionType;
  description: string;
  amount: number;
  currency: Currency;
  category: string;
  customerName: string | null;
  date: string;
  isTask?: boolean;
  taskId?: number;
  addedBy?: string;
  sourceAccount?: string; // e.g. 'cashbox' | 'vault' | 'bank'
  destinationAccount?: string;
  debtAccountId?: number;
  cashAccountId?: number;
  relatedAccountId?: number;
  isDebtRepayment?: boolean;
  repaymentSource?: 'net_profit' | 'cashbox' | 'vault';
  isInternalFinancial?: boolean;
  scope?: 'financial_center' | 'all';
}

export interface CashAccount {
  id?: number;
  name: string;
  type: 'cashbox' | 'vault' | 'bank' | 'wallet' | 'general';
  balance: number;
  currency: Currency;
  isDefault?: boolean;
  classification?: string;
  phone?: string;
  statement?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyBondShortcut {
  id: string;
  title: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  defaultAmount?: number;
  currency?: Currency;
  targetType: 'account' | 'customer' | 'none';
  targetName?: string;
  color?: string;
  isFavorite?: boolean;
}

export interface DebtPayment {
  id: string;
  amount: number;
  currency: Currency;
  date: string;
  source: 'net_profit' | 'cashbox' | 'vault' | 'other';
  note?: string;
  receiptNumber?: string;
  addedBy?: string;
}

export interface DebtAccount {
  id?: number;
  name: string;
  creditorName: string;
  phone?: string;
  totalAmount: number;
  paidAmount: number;
  currency: Currency;
  purpose: string; // e.g. 'تمويل شراء بضاعة ومخزون', 'شراء أصول ومعدات للورشة', 'تمويل رأس مال تأسيسي', 'مستحقات موردين'
  status: 'active' | 'settled';
  createdAt: string;
  dueDate?: string;
  payments: DebtPayment[];
  notes?: string;
}

export interface ExchangeRates {
  SAR: number;
  RY: number;
}

export interface UserPermissions {
  canManageCustomers: boolean;
  canManageInventory: boolean;
  canEditOptions: boolean;
  canChangeFilters: boolean;
  canAccessAccounts: boolean;
  canAccessReports: boolean;
  canViewStats: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canManageUsers: boolean;
  canChangeSettings: boolean;
  canViewTaskStatuses: boolean;
  canExportData: boolean;
  canImportData: boolean;
  canUseVoiceAssistant?: boolean;
  canUseTools?: boolean;
  canUseFlashInterface?: boolean;
  canManageQuickNotes?: boolean;
}

export interface User {
  id?: number;
  username: string;
  name?: string;
  pin: string;
  role: 'admin' | 'user';
  permissions: UserPermissions;
  createdAt: string;
}

export interface AuditLogRecord {
  id?: number;
  timestamp: string;
  actionType: 'add' | 'edit' | 'delete' | 'setting' | 'session' | 'system';
  entityType: 'task' | 'transaction' | 'customer' | 'inventory' | 'setting' | 'user' | 'app_session' | 'financial_account';
  entityId?: number;
  entityName: string;
  details: string;
  user?: string;
  previousData?: any;
  newData?: any;
  durationSeconds?: number;
}

export interface DeviceModel {
  id?: number;
  type: string;
  name: string;
}

export interface ReportSchedule {
  id: number;
  name: string;
  type: 'all' | 'transactions' | 'inventory' | 'customers' | 'tasks' | 'income' | 'expenses' | 'deviceModels' | 'customerDues';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  deliveryMethod: 'whatsapp' | 'email' | 'notification';
  recipients: string[];
  lastSent?: string;
  nextRun: string;
}

export interface ActivityLoggerSettings {
  enabled: boolean; // تفعيل أو إيقاف مسجل الحركة كلياً

  // أنواع الكيانات والحركات المطلوب تسجيلها
  logTasks: boolean; // حركات وعمليات المهام
  logTransactions: boolean; // حركات الماليات والحسابات
  logCustomers: boolean; // حركات العملاء
  logInventory: boolean; // حركات المخزن وقطع الغيار
  logSettings: boolean; // تغييرات الإعدادات والخيارات
  logUsers: boolean; // حركات المستخدمين والصلاحيات
  logAppSessions: boolean; // حركات جلسات التطبيق والتواجد على الشاشة

  // أنواع الإجراءات المطلوب تسجيلها
  logActionsAdd: boolean; // عمليات الإضافة
  logActionsEdit: boolean; // عمليات التعديل والتحديث
  logActionsDelete: boolean; // عمليات الحذف
  logActionsSettings: boolean; // تغيير وضبط الإعدادات
  logActionsSessions: boolean; // جلسات وتواجد التطبيق

  // فترات التسجيل وجدولة العمل
  timeScheduleType: 'all_day' | 'working_hours'; // طوال اليوم أم خلال ساعات العمل
  workingHoursStart: string; // وقت بداية التسجيل e.g. "08:00"
  workingHoursEnd: string; // وقت نهاية التسجيل e.g. "22:00"
  workingDays: number[]; // أيام الأسبوع المحددة للتسجيل [0,1,2,3,4,5,6] (0=الأحد)

  // فترة الاحتفاظ بالسجلات والتنظيف التلقائي
  retentionDays: number; // مدة الاحتفاظ بالأيام (0 = دائم بلا حدود)
  autoCleanOldRecords: boolean; // تنظيف تلقائي للسجلات الأقدم من الفترة

  // حساسية تسجيل الجلسات والتواجد
  minSessionDurationSeconds: number; // الحد الأدنى بالثواني لتسجيل حركة التواجد/الخلفية
}
