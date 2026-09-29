import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  BarChart3, 
  LayoutList, 
  Table as TableIcon, 
  Calendar, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Users, 
  Clock, 
  Sparkles, 
  X, 
  ArrowUpDown, 
  Percent, 
  DollarSign, 
  Layers, 
  Eye, 
  Edit3,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  BookmarkCheck,
  Smartphone,
  Coins
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { Currency, ExchangeRates, Transaction, Task, Customer, CashAccount, DailyBondShortcut } from '../types';
import { cn, formatAmount, getInUSD, isFinancialCenterOnlyTransaction } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';
import { AccountReportModal } from './AccountReportModal';
import { DailyBondShortcutsBar } from './DailyBondShortcutsBar';
import { FinancialClosingModal } from './FinancialClosingModal';
import { Scale } from 'lucide-react';
import { db } from '../lib/db';
import { VoiceInputButton } from './VoiceInputButton';

export interface AccountsManagerProps {
  transactions: Transaction[];
  tasks: Task[];
  customers: Customer[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  dashboardFilter: string;
  selectedMonth: string;
  dashboardStartDate: string;
  dashboardEndDate: string;
  showRevenue: boolean;
  canChangeFilters?: boolean;
  canAccessAccounts?: boolean;
  classificationOptions: string[];
  expenseCategoryOptions: string[];
  appName: string;
  onOpenFilterModal?: () => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onAddAccount?: () => void;
  onSelectDailyBondShortcut?: (shortcut: DailyBondShortcut) => void;
  cashAccounts?: CashAccount[];
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction?: (id: number) => void;
  onEditTask: (task: Task) => void;
  renderColoredText?: (text: string | null | undefined) => React.ReactNode;
  searchQuery?: string;
}

export type ViewMode = 'compact_rows' | 'table' | 'analytics' | 'currency_lines' | 'cards';

export const AccountsManager: React.FC<AccountsManagerProps> = ({
  transactions,
  tasks,
  customers,
  cashAccounts = [],
  systemCurrency,
  exchangeRates,
  dashboardFilter,
  selectedMonth,
  dashboardStartDate,
  dashboardEndDate,
  showRevenue,
  canChangeFilters = true,
  canAccessAccounts = true,
  classificationOptions,
  expenseCategoryOptions,
  appName,
  onOpenFilterModal,
  onAddIncome,
  onAddExpense,
  onAddAccount,
  onSelectDailyBondShortcut,
  onEditTransaction,
  onDeleteTransaction,
  onEditTask,
  renderColoredText,
  searchQuery = ''
}) => {
  // View mode switcher: Default to saved preference or 'compact_rows' for Note 20 Ultra
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('accounts_view_mode_default') as ViewMode) || 'compact_rows';
  });
  const [savedViewDefaultFeedback, setSavedViewDefaultFeedback] = useState(false);

  const handleSaveViewModeDefault = () => {
    localStorage.setItem('accounts_view_mode_default', viewMode);
    setSavedViewDefaultFeedback(true);
    setTimeout(() => setSavedViewDefaultFeedback(false), 2200);
  };

  // Filters
  const [filterType, setFilterType] = useState<
    'all' | 'income' | 'expense' | 'dues' | 'customer' | 'standalone_accounts' | 'classification' | 'expense_category' | 'sale' | 'purchase'
  >('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isAccountReportModalOpen, setIsAccountReportModalOpen] = useState(false);
  const [selectedAccountIdForReport, setSelectedAccountIdForReport] = useState<number | null>(null);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  // Helper for task financials
  const getTaskFinancials = (task: Task) => {
    const totalCostUSD = getInUSD(task.cost || 0, task.currency || 'RY', exchangeRates);
    let totalPaidUSD = 0;
    if (task.depositHistory && task.depositHistory.length > 0) {
      totalPaidUSD = task.depositHistory.reduce((sum, item) => sum + getInUSD(item.amount || 0, item.currency || task.currency || 'RY', exchangeRates), 0);
    } else {
      totalPaidUSD = getInUSD(task.deposit || 0, task.currency || 'RY', exchangeRates);
    }
    const balanceUSD = totalCostUSD - totalPaidUSD;
    return { totalCost: totalCostUSD, totalPaid: totalPaidUSD, balance: balanceUSD };
  };

  // Filtered transactions by date range (excluding internal financial movements between vaults/cashboxes & debts)
  const dateFilteredTransactions = useMemo(() => {
    const start = new Date(dashboardStartDate + "T00:00:00");
    const end = new Date(dashboardEndDate + "T23:59:59");
    return transactions.filter(t => {
      // Exclude internal cash transfers, debt repayments, and initial capital from "ما له وما عليه"
      if (isFinancialCenterOnlyTransaction(t)) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  }, [transactions, dashboardStartDate, dashboardEndDate]);

  // Filtered tasks by date range
  const dateFilteredTasks = useMemo(() => {
    const start = new Date(dashboardStartDate + "T00:00:00");
    const end = new Date(dashboardEndDate + "T23:59:59");
    return tasks.filter(t => {
      const d = new Date(t.createdAt);
      return d >= start && d <= end;
    });
  }, [tasks, dashboardStartDate, dashboardEndDate]);

  // Financial calculations
  const stats = useMemo(() => {
    let incomeUSD = 0;
    let expenseUSD = 0;
    let duesUSD = 0;

    // From tasks: deposits are income
    dateFilteredTasks.forEach(t => {
      const { balance, totalPaid } = getTaskFinancials(t);
      incomeUSD += totalPaid;
      if (balance > 0) duesUSD += balance;
    });

    // From transactions
    dateFilteredTransactions.forEach(t => {
      const amtUSD = getInUSD(t.amount, t.currency || 'RY', exchangeRates);
      if (t.isTask) return; // avoid duplicate if tied to task
      if (t.type === 'income') {
        incomeUSD += amtUSD;
      } else if (t.type === 'expense') {
        expenseUSD += amtUSD;
      }
    });

    const netRevenueUSD = incomeUSD - expenseUSD;
    const totalTurnoverUSD = incomeUSD + expenseUSD;
    const operatingMargin = incomeUSD > 0 ? Math.round((netRevenueUSD / incomeUSD) * 100) : 0;
    const incomeExpenseRatio = expenseUSD > 0 ? (incomeUSD / expenseUSD).toFixed(2) : incomeUSD > 0 ? '100+' : '0';
    const totalTransactionsCount = dateFilteredTransactions.length;
    const averageTicketUSD = totalTransactionsCount > 0 ? totalTurnoverUSD / totalTransactionsCount : 0;

    return {
      incomeUSD,
      expenseUSD,
      netRevenueUSD,
      duesUSD,
      totalTurnoverUSD,
      operatingMargin,
      incomeExpenseRatio,
      totalTransactionsCount,
      averageTicketUSD
    };
  }, [dateFilteredTransactions, dateFilteredTasks, exchangeRates, systemCurrency]);

  // Unified items list for display
  interface UnifiedFinanceItem {
    id: string;
    originalId: number;
    sourceType: 'transaction' | 'task_deposit' | 'task_due';
    type: 'income' | 'expense' | 'due';
    date: string;
    customerName: string;
    description: string;
    category: string;
    amountUSD: number;
    currency: Currency;
    rawAmount: number;
    runningRemainingUSD?: number;
    rawTask?: Task;
    rawTransaction?: Transaction;
  }

  const unifiedItems: UnifiedFinanceItem[] = useMemo(() => {
    const list: UnifiedFinanceItem[] = [];

    // Transactions
    dateFilteredTransactions.forEach(t => {
      const amountUSD = getInUSD(t.amount, t.currency || 'RY', exchangeRates);
      list.push({
        id: `tx_${t.id}`,
        originalId: t.id,
        sourceType: 'transaction',
        type: t.type === 'income' ? 'income' : 'expense',
        date: t.date,
        customerName: t.customerName || '',
        description: t.description || (t.type === 'income' ? 'ما له (إيراد نقدي)' : 'ما عليه (مصروف منصرف)'),
        category: t.category || (t.type === 'income' ? 'إيرادات عامة' : 'مصاريف تشغيلية'),
        amountUSD,
        currency: t.currency || 'RY',
        rawAmount: t.amount,
        rawTransaction: t
      });
    });

    // Task Deposits (Income)
    dateFilteredTasks.forEach(t => {
      if (t.deposit > 0) {
        const depositUSD = getInUSD(t.deposit, t.currency || 'RY', exchangeRates);
        list.push({
          id: `task_dep_${t.id}`,
          originalId: t.id,
          sourceType: 'task_deposit',
          type: 'income',
          date: t.createdAt,
          customerName: t.customer,
          description: `دفعة مقدمة: ${t.deviceType} ${t.brand} (${t.issue || 'صيانة'})`,
          category: t.taskType === 'sale' ? 'مبيعات' : t.taskType === 'purchase' ? 'مشتريات' : 'صيانة وخدمات',
          amountUSD: depositUSD,
          currency: t.currency || 'RY',
          rawAmount: t.deposit,
          rawTask: t
        });
      }

      // Customer Dues
      const { balance } = getTaskFinancials(t);
      if (balance > 0) {
        list.push({
          id: `task_due_${t.id}`,
          originalId: t.id,
          sourceType: 'task_due',
          type: 'due',
          date: t.createdAt,
          customerName: t.customer,
          description: `متبقي على العميل: ${t.deviceType} ${t.brand}`,
          category: 'ذمم عملاء مستحقة',
          amountUSD: balance,
          currency: t.currency || 'RY',
          rawAmount: balance,
          rawTask: t
        });
      }
    });

    return list;
  }, [dateFilteredTransactions, dateFilteredTasks, exchangeRates, systemCurrency]);

  // Apply filters, search and sort
  const processedItems = useMemo(() => {
    let result = unifiedItems.filter(item => {
      // Type Filter
      if (filterType === 'income' && item.type !== 'income') return false;
      if (filterType === 'expense' && item.type !== 'expense') return false;
      if (filterType === 'dues' && item.type !== 'due') return false;
      if (filterType === 'sale' && item.category !== 'مبيعات') return false;
      if (filterType === 'purchase' && item.category !== 'مشتريات' && item.category !== 'مخزون') return false;

      // Customer Filter
      if (filterType === 'customer' && filterValue && item.customerName !== filterValue) return false;

      // Classification Filter
      if (filterType === 'classification' && filterValue) {
        const cust = customers.find(c => c.name === item.customerName);
        if (cust?.classification !== filterValue) return false;
      }

      // Expense Category Filter
      if (filterType === 'expense_category' && filterValue) {
        if (item.type !== 'expense' || item.category !== filterValue) return false;
      }

      // Search Query
      const q = (localSearchQuery || searchQuery || '').toLowerCase().trim();
      if (q) {
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchCust = item.customerName?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchAmt = item.rawAmount.toString().includes(q);
        if (!matchDesc && !matchCust && !matchCat && !matchAmt) return false;
      }

      return true;
    });

    // 1. Calculate running remaining balance chronologically from the first transaction to the last transaction
    const sortedAsc = [...result].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulative = 0;
    const itemsWithRunning = sortedAsc.map(item => {
      if (item.type === 'income') {
        cumulative += item.amountUSD;
      } else if (item.type === 'expense') {
        cumulative -= item.amountUSD;
      } else if (item.type === 'due') {
        cumulative -= item.amountUSD;
      }
      return {
        ...item,
        runningRemainingUSD: cumulative
      };
    });

    // 2. Sort according to selected sort preference
    itemsWithRunning.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount_desc') return b.amountUSD - a.amountUSD;
      if (sortBy === 'amount_asc') return a.amountUSD - b.amountUSD;
      return 0;
    });

    return itemsWithRunning;
  }, [unifiedItems, filterType, filterValue, searchQuery, localSearchQuery, sortBy, customers]);

  // Single Line per Currency Breakdown
  const currencyBreakdown = useMemo(() => {
    const map: Record<string, {
      currency: string;
      label: string;
      flag: string;
      totalIncome: number;
      totalExpense: number;
      totalDue: number;
      netBalance: number;
      accountsBalance: number;
      accountNames: string[];
      count: number;
    }> = {};

    const getMeta = (curr: string) => {
      const c = (curr || 'RY').toUpperCase();
      if (c === 'RY' || c === 'YER') return { label: 'ريال يمني', flag: '🇾🇪' };
      if (c === 'SAR' || c === 'SR') return { label: 'ريال سعودي', flag: '🇸🇦' };
      if (c === 'USD') return { label: 'دولار أمريكي', flag: '🇺🇸' };
      if (c === 'EUR') return { label: 'يورو أوروبي', flag: '🇪🇺' };
      return { label: c, flag: '💱' };
    };

    // Add cash accounts
    cashAccounts.forEach(acc => {
      const cKey = (acc.currency || 'RY').toUpperCase();
      if (!map[cKey]) {
        const meta = getMeta(cKey);
        map[cKey] = {
          currency: cKey,
          label: meta.label,
          flag: meta.flag,
          totalIncome: 0,
          totalExpense: 0,
          totalDue: 0,
          netBalance: 0,
          accountsBalance: 0,
          accountNames: [],
          count: 0
        };
      }
      map[cKey].accountsBalance += (acc.balance || 0);
      if (acc.name && !map[cKey].accountNames.includes(acc.name)) {
        map[cKey].accountNames.push(acc.name);
      }
    });

    // Add transactions / items
    processedItems.forEach(item => {
      const cKey = (item.currency || 'RY').toUpperCase();
      if (!map[cKey]) {
        const meta = getMeta(cKey);
        map[cKey] = {
          currency: cKey,
          label: meta.label,
          flag: meta.flag,
          totalIncome: 0,
          totalExpense: 0,
          totalDue: 0,
          netBalance: 0,
          accountsBalance: 0,
          accountNames: [],
          count: 0
        };
      }
      map[cKey].count += 1;
      if (item.type === 'income') {
        map[cKey].totalIncome += item.rawAmount;
      } else if (item.type === 'expense') {
        map[cKey].totalExpense += item.rawAmount;
      } else if (item.type === 'due') {
        map[cKey].totalDue += item.rawAmount;
      }
    });

    Object.values(map).forEach(obj => {
      obj.netBalance = obj.totalIncome - obj.totalExpense;
    });

    return Object.values(map);
  }, [cashAccounts, processedItems]);
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; incomeUSD: number; expenseUSD: number }> = {};
    
    processedItems.forEach(item => {
      const cat = item.category || 'أخرى';
      if (!map[cat]) {
        map[cat] = { count: 0, incomeUSD: 0, expenseUSD: 0 };
      }
      map[cat].count += 1;
      if (item.type === 'income') {
        map[cat].incomeUSD += item.amountUSD;
      } else if (item.type === 'expense') {
        map[cat].expenseUSD += item.amountUSD;
      }
    });

    const totalUSD = stats.totalTurnoverUSD || 1;
    return Object.entries(map).map(([name, data]) => {
      const totalCatUSD = data.incomeUSD + data.expenseUSD;
      const percent = Math.min(100, Math.round((totalCatUSD / totalUSD) * 100));
      return {
        name,
        count: data.count,
        incomeUSD: data.incomeUSD,
        expenseUSD: data.expenseUSD,
        netUSD: data.incomeUSD - data.expenseUSD,
        percent
      };
    }).sort((a, b) => (b.incomeUSD + b.expenseUSD) - (a.incomeUSD + a.expenseUSD));
  }, [processedItems, stats.totalTurnoverUSD]);

  // Time-series chart data (Daily comparison)
  const timeSeriesData = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {};
    
    processedItems.forEach(item => {
      const dayKey = item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (!map[dayKey]) {
        map[dayKey] = { date: dayKey.slice(5), income: 0, expense: 0 };
      }
      const val = Number(formatAmount(item.amountUSD, systemCurrency, exchangeRates));
      if (item.type === 'income') {
        map[dayKey].income += val;
      } else if (item.type === 'expense') {
        map[dayKey].expense += val;
      }
    });

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  }, [processedItems, systemCurrency, exchangeRates]);

  // Cumulative Cashflow trend data
  const cumulativeTrendData = useMemo(() => {
    let runningNet = 0;
    const sorted = [...processedItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.map((item, idx) => {
      const amt = Number(formatAmount(item.amountUSD, systemCurrency, exchangeRates));
      if (item.type === 'income') runningNet += amt;
      else if (item.type === 'expense') runningNet -= amt;
      return {
        idx: idx + 1,
        date: item.date ? item.date.slice(5, 10) : '',
        balance: runningNet
      };
    });
  }, [processedItems, systemCurrency, exchangeRates]);

  // Donut chart data
  const pieChartData = [
    { name: 'إيرادات واردة (له)', value: stats.incomeUSD > 0 ? stats.incomeUSD : 0.001, color: '#10b981' },
    { name: 'مصروفات جارية (عليه)', value: stats.expenseUSD > 0 ? stats.expenseUSD : 0.001, color: '#ef4444' },
    { name: 'مستحقات العملاء (ذمم)', value: stats.duesUSD > 0 ? stats.duesUSD : 0.001, color: '#0284c7' }
  ];

  // Helper text for export
  const getExportText = () => {
    let text = `📋 *${appName} - كشف الحسابات والمالية*\n`;
    text += `📅 الفترة: ${dashboardStartDate} إلى ${dashboardEndDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🟢 إجمالي ما له: ${formatAmount(stats.incomeUSD, systemCurrency, exchangeRates)} ${systemCurrency}\n`;
    text += `🔴 إجمالي ما عليه: ${formatAmount(stats.expenseUSD, systemCurrency, exchangeRates)} ${systemCurrency}\n`;
    text += `💰 صافي الرصيد: ${formatAmount(Math.abs(stats.netRevenueUSD), systemCurrency, exchangeRates)} ${systemCurrency} (${stats.netRevenueUSD >= 0 ? 'فائض/له' : 'عجز/عليه'})\n`;
    text += `📊 مستحقات العملاء: ${formatAmount(stats.duesUSD, systemCurrency, exchangeRates)} ${systemCurrency}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\nتفاصيل الحركات (${processedItems.length}):\n`;
    processedItems.forEach((item, idx) => {
      const typeLabel = item.type === 'income' ? 'ما له (+)' : item.type === 'expense' ? 'ما عليه (-)' : 'المتبقي (ذمة)';
      text += `${idx + 1}. [${item.date.slice(0, 10)}] ${typeLabel} | ${item.customerName ? `${item.customerName} - ` : ''}${item.description}: ${formatAmount(item.amountUSD, systemCurrency, exchangeRates)} ${systemCurrency} (${item.category})\n`;
    });
    return text;
  };

  const handleItemClick = (item: UnifiedFinanceItem) => {
    if (item.sourceType === 'task_deposit' || item.sourceType === 'task_due') {
      if (item.rawTask) {
        onEditTask(item.rawTask);
      } else {
        db.tasks.get(item.originalId).then(task => {
          if (task) onEditTask(task);
        });
      }
    } else if (item.rawTransaction) {
      onEditTransaction(item.rawTransaction);
    }
  };

  return (
    <div className="space-y-3.5 w-full max-w-full overflow-x-hidden" dir="rtl" id="accounts-manager-root">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP CONTROL BAR (Note 20 Ultra Responsive)       */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Title and date period */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center font-bold shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                <span>سجل الحسابات وما له وما عليه</span>
                <span className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                  {processedItems.length} حركة
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                إدارة احترافية للتدفقات النقدية ومستحقات العملاء مهيأة لشاشة هاتفك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/60 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {dashboardFilter === 'today' ? 'اليوم' : 
                 dashboardFilter === 'week' ? 'هذا الأسبوع' : 
                 dashboardFilter === 'month' ? 'هذا الشهر' : 
                 dashboardFilter === 'year' ? 'هذا العام' : 
                 dashboardFilter === 'specific_month' ? `شهر ${selectedMonth}` : 'الكل'}
              </span>
            </span>

            {canChangeFilters && onOpenFilterModal && (
              <button 
                type="button"
                onClick={onOpenFilterModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl transition-all text-xs font-extrabold border border-sky-200 cursor-pointer shadow-xs active:scale-95"
              >
                تغيير الفترة
              </button>
            )}

            {/* زر الإقفال المالي الدوري (يومي / شهري) */}
            <button
              type="button"
              onClick={() => setIsClosingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-900 rounded-xl transition-all text-xs font-black border border-indigo-200 cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="محضر الإقفال المالي الدوري وحصر الصناديق والحسابات"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              <span>إقفال مالي دوري</span>
            </button>
          </div>
        </div>

        {/* اختصارات الطباعة والحفظ منقولة لأسفل الصف لتلائم شاشة الهاتف وتمنع الخروج عن الإطار */}
        <div className="flex items-center justify-between w-full pt-1.5 pb-0.5 border-t border-slate-100 gap-2">
          <span className="text-[11px] font-extrabold text-slate-500">
            أدوات التصدير والطباعة:
          </span>
          <ExportToolbar
            targetElementId="accounts-manager-root"
            title="كشف_الحسابات_والمالية"
            filenamePrefix="كشف_الحسابات"
            getTextToCopy={getExportText}
            showPrint={true}
            compact={true}
            className="bg-slate-50 border border-slate-200/80 rounded-xl p-0.5 shrink-0"
          />
        </div>

        {/* شريط اختصارات وتفضيلات السندات اليومية (اختيار عميل أو حساب مستقل) */}
        {onSelectDailyBondShortcut && (
          <DailyBondShortcutsBar
            onSelectShortcut={onSelectDailyBondShortcut}
            customers={customers}
            cashAccounts={cashAccounts}
            systemCurrency={systemCurrency}
            classificationOptions={classificationOptions}
          />
        )}

        {/* Action Buttons: Quick Add Income / Quick Add Account / Quick Add Expense */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onAddIncome}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 border border-emerald-400/40 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs active:scale-[0.98] cursor-pointer"
            title="إضافة وارد جديد (له)"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            <span className="truncate">وارد جديد</span>
          </button>

          <button
            type="button"
            onClick={onAddAccount}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-800 border border-sky-400/40 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs active:scale-[0.98] cursor-pointer"
            title="إضافة حساب جديد للحسابات والمركز المالي (غير مرتبط بالعملاء أو المهام)"
          >
            <Building2 className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-sky-600 shrink-0" />
            <span className="truncate">حساب جديد</span>
          </button>

          <button
            type="button"
            onClick={onAddExpense}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 border border-rose-400/40 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs active:scale-[0.98] cursor-pointer"
            title="إضافة مصروف جديد (عليه)"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0" />
            <span className="truncate">مصروف جديد</span>
          </button>
        </div>

        {/* شريط وقائمة إنشاء تقرير كشف حساب لأي حساب مستقل ومشاركته */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedAccountIdForReport || (cashAccounts[0]?.id || '')}
              onChange={(e) => setSelectedAccountIdForReport(Number(e.target.value))}
              className="flex-1 bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="">-- اختر حساباً مستقلاً لإصدار كشفه --</option>
              {cashAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'vault' ? 'خزينة' : a.type === 'bank' ? 'بنك' : a.type === 'wallet' ? 'محفظة' : 'صندوق'}) - الرصيد: {formatAmount(a.balance, a.currency, exchangeRates)} {a.currency}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedAccountIdForReport && cashAccounts.length > 0) {
                setSelectedAccountIdForReport(cashAccounts[0].id || null);
              }
              setIsAccountReportModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-[0.98] cursor-pointer shrink-0"
            title="توليد وتصدير كشف حساب وتفاصيل الحركات ومشاركته"
          >
            <FileText className="w-4 h-4 text-emerald-100 shrink-0" />
            <span>إنشاء كشف حساب كامل ومشاركته</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. SUMMARY METRIC CARDS (الصندوق الرئيسي الشامل)     */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 p-2.5 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-xs sm:text-sm text-slate-900">
                الصندوق الرئيسي (المحرك اليومي الحاسم للحسابات)
              </h4>
              <p className="text-[10px] text-slate-600 font-bold truncate">
                يجمع كافة إيرادات ومصروفات العملاء والمهام والحسابات العامة ومصروفات المشروع
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Income Card (المقبوضات والإيرادات) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-200/90 shadow-xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                المقبوضات والإيرادات بالصندوق
              </span>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">عملاء ومهام ومشرع</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              <span className={cn(!showRevenue && "blur-xs")}>
                {formatAmount(stats.incomeUSD, systemCurrency, exchangeRates)}
              </span>
              <span className="text-xs font-bold text-slate-500 mr-1.5">{systemCurrency}</span>
            </p>
            <div className="text-[11px] font-bold text-emerald-800 flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>معدل ما له إلى ما عليه: {stats.incomeExpenseRatio}x</span>
              <span className="text-emerald-700 font-extrabold">مقبوضات مؤكدة</span>
            </div>
          </div>

          {/* Expenses Card (المصروفات والمدفوعات) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-rose-200/90 shadow-xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-lg border border-rose-200 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                المصروفات والمدفوعات بالصندوق
              </span>
              <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">تشغيلية ومشاريع</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
              <span className={cn(!showRevenue && "blur-xs")}>
                {formatAmount(stats.expenseUSD, systemCurrency, exchangeRates)}
              </span>
              <span className="text-xs font-bold text-slate-500 mr-1.5">{systemCurrency}</span>
            </p>
            <div className="text-[11px] font-bold text-rose-800 flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>نسبة المصروف: {stats.incomeUSD > 0 ? Math.round((stats.expenseUSD / stats.incomeUSD) * 100) : 0}%</span>
              <span className="text-rose-700 font-extrabold">مصاريف جارية</span>
            </div>
          </div>

          {/* Net Revenue Balance Card (صافي الصندوق الرئيسي المتاح) */}
          <div className={cn(
            "p-3.5 sm:p-4 rounded-2xl border-2 shadow-xs space-y-1 bg-gradient-to-br transition-all",
            stats.netRevenueUSD >= 0 
              ? "from-emerald-50 via-teal-50/60 to-white border-emerald-400" 
              : "from-rose-50 via-amber-50/60 to-white border-rose-400"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-xs font-black px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5",
                stats.netRevenueUSD >= 0 ? "text-emerald-950 bg-emerald-200/80 border-emerald-300" : "text-rose-950 bg-rose-200/80 border-rose-300"
              )}>
                <Coins className="w-3.5 h-3.5 text-emerald-700" />
                صافي رصيد الصندوق الرئيسي
              </span>
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-md border",
                stats.netRevenueUSD >= 0 ? "bg-emerald-600 text-white border-emerald-700" : "bg-rose-600 text-white border-rose-700"
              )}>
                {stats.netRevenueUSD >= 0 ? "فائض الصندوق" : "عجز الصندوق"}
              </span>
            </div>
            <p className={cn(
              "text-2xl sm:text-3xl font-black tracking-tight",
              stats.netRevenueUSD >= 0 ? "text-emerald-900" : "text-rose-700"
            )}>
              <span className={cn(!showRevenue && "blur-xs")}>
                {formatAmount(Math.abs(stats.netRevenueUSD), systemCurrency, exchangeRates)}
              </span>
              <span className="text-xs font-bold text-slate-500 mr-1.5">{systemCurrency}</span>
            </p>
            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between border-t border-slate-100 pt-1.5">
              <span>مستحقات العملاء (لنا):</span>
              <span className="text-sky-800 font-extrabold">
                {formatAmount(stats.duesUSD, systemCurrency, exchangeRates)} {systemCurrency}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. VIEW MODE SELECTOR (Responsive Grid - No Horizontal Overflow) */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs w-full max-w-full overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 w-full">
          {/* 1. Compact Rows (سطور وصفوف بسيطة) */}
          <button
            type="button"
            onClick={() => setViewMode('compact_rows')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none",
              viewMode === 'compact_rows'
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <LayoutList className="w-4 h-4 shrink-0" />
            <span className="truncate">سطور وصفوف</span>
          </button>

          {/* 2. Compact Table (جدول محاسبي بسيط) */}
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none",
              viewMode === 'table'
                ? "bg-sky-700 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <TableIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">جدول مالي</span>
          </button>

          {/* 3. Professional Analytics & Charts (تحليلات ورسوم ومخططات) */}
          <button
            type="button"
            onClick={() => setViewMode('analytics')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none",
              viewMode === 'analytics'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">مخططات ونسب</span>
          </button>

          {/* 4. Single Line Per Currency Option (مباشرة تحت خيار مخططات وننسب) */}
          <button
            type="button"
            onClick={() => setViewMode('currency_lines')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none border",
              viewMode === 'currency_lines'
                ? "bg-amber-600 text-white shadow-xs border-amber-700"
                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/80"
            )}
            title="عرض الحسابات والمعاملات كسطور بحيث يتم عرض كل عملة بسطر واحد"
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span className="truncate">عملة بسطر واحد</span>
          </button>

          {/* 5. Detailed Cards */}
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none",
              viewMode === 'cards'
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">بطاقات مفصلة</span>
          </button>
        </div>

        {/* 5. Save as Default Button */}
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleSaveViewModeDefault}
            className={cn(
              "flex items-center gap-1.5 py-1 px-3 rounded-xl text-[11px] font-black transition-all cursor-pointer select-none border",
              savedViewDefaultFeedback
                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105"
                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/80"
            )}
            title="حفظ نمط العرض الحالي كافتراضي عند فتح التطبيق"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{savedViewDefaultFeedback ? '✓ تم الحفظ كافتراضي' : 'حفظ كافتراضي'}</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. FILTER & SORT TOOLS WITH VOICE SEARCH             */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5 w-full max-w-full overflow-hidden">
        {/* مربع بحث الحسابات مع ميكروفون الإدخال الصوتي المباشر */}
        <div className="relative flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="بحث بالصوت أو النص في الحركات، البيان، المبالغ..."
            className="w-full py-2 px-1 bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="h-full flex items-center shrink-0">
            <VoiceInputButton
              target="accounts-manager-search"
              onResult={(text) => {
                setLocalSearchQuery(text);
              }}
              className="px-1.5 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
              buttonTitle="تحويل الكلام إلى نص للبحث الصوتي"
            />
            {localSearchQuery ? (
              <button
                type="button"
                onClick={(e) => {
                  setLocalSearchQuery('');
                  (e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLElement)?.blur?.();
                }}
                className="h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold"
                title="مسح النص وإلغاء المدخلات بنقرة واحدة"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Filter Type Dropdown */}
          <div>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setFilterValue('');
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="all">كل الحركات (شامل)</option>
              <option value="income">ما له فقط</option>
              <option value="expense">ما عليه فقط</option>
              <option value="dues">ذمم ومستحقات العملاء</option>
              <option value="customer">عميل محدد</option>
              <option value="standalone_accounts">قائمة الحسابات العامة المستقلة 🏦</option>
              <option value="classification">تصنيف عملاء</option>
              <option value="expense_category">تصنيف ما عليه محدد</option>
              <option value="sale">مبيعات فقط</option>
              <option value="purchase">مشتريات ومخزون</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="date_desc">الأحدث أولاً</option>
                <option value="date_asc">الأقدم أولاً</option>
                <option value="amount_desc">المبلغ: من الأعلى</option>
                <option value="amount_asc">المبلغ: من الأقل</option>
              </select>
            </div>
          </div>
        </div>

        {/* Secondary Filter if specific customer or category selected */}
        {(filterType === 'customer' || filterType === 'classification' || filterType === 'expense_category') && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-extrabold text-slate-500 whitespace-nowrap">
              {filterType === 'customer' ? 'اختر العميل أو الحساب:' : 
               filterType === 'classification' ? 'اختر تصنيف العملاء:' : 'اختر تصنيف ما عليه:'}
            </span>

            {filterType === 'customer' ? (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="flex-1 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- الكل (جميع العملاء والحسابات) --</option>
                {cashAccounts && cashAccounts.length > 0 && (
                  <optgroup label="الحسابات المالية المستقلة">
                    {cashAccounts.map(a => (
                      <option key={`acc_${a.id || a.name}`} value={a.name}>🏦 {a.name} ({a.classification || 'حساب'})</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="العملاء">
                  {customers.map(c => (
                    <option key={c.id || c.name} value={c.name}>👤 {c.name}</option>
                  ))}
                </optgroup>
              </select>
            ) : filterType === 'classification' ? (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="flex-1 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- اختر التصنيف --</option>
                {classificationOptions.filter(opt => opt !== "الكل").map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="flex-1 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- اختر فئة المصروف --</option>
                {expenseCategoryOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {filterValue && (
              <button
                type="button"
                onClick={() => setFilterValue('')}
                className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1 bg-red-50 rounded-lg cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4.5 STANDALONE GENERAL ACCOUNTS VIEW                 */}
      {/* ---------------------------------------------------- */}
      {filterType === 'standalone_accounts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>قائمة الحسابات العامة المستقلة ({cashAccounts.filter(a => a.type === 'general' || (!a.isDefault && a.type !== 'cashbox' && a.type !== 'vault')).length})</span>
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                تصفح ومعاينة واستعراض كشوفات الحسابات المستقلة المقترنة بـ (الصندوق الرئيسي)
              </p>
            </div>
            {onAddAccount && (
              <button
                type="button"
                onClick={onAddAccount}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ إنشاء حساب مستقل جديد</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cashAccounts.filter(a => a.type === 'general' || (!a.isDefault && a.type !== 'cashbox' && a.type !== 'vault')).length === 0 ? (
              <div className="col-span-full py-10 px-4 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Building2 className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
                <p className="text-xs font-bold text-slate-600">لا توجد حسابات عامة مستقلة مضافة حتى الآن</p>
                <p className="text-[10.5px] text-slate-400">عند إضافة أو اختيار أي حساب عام مستقل جديد، سيتم تجميع كافة معاملاته برأس مال الصندوق الرئيسي مع تخصيص كشف حساب منفصل له هنا لمراجعته مثل كشوفات العملاء تماماً</p>
              </div>
            ) : (
              cashAccounts
                .filter(a => a.type === 'general' || (!a.isDefault && a.type !== 'cashbox' && a.type !== 'vault'))
                .filter(a => !localSearchQuery || (a.name || '').toLowerCase().includes(localSearchQuery.toLowerCase()))
                .map(acc => {
                  const accTxCount = transactions.filter(t => 
                    t.cashAccountId === acc.id || 
                    (t.customerName || '').trim().toLowerCase() === (acc.name || '').trim().toLowerCase() ||
                    (t.sourceAccount || '').trim().toLowerCase() === (acc.name || '').trim().toLowerCase()
                  ).length;

                  return (
                    <div 
                      key={acc.id || acc.name}
                      className="p-3.5 bg-slate-50/90 hover:bg-white border border-slate-200/90 rounded-2xl transition-all shadow-2xs flex flex-col justify-between gap-3 group hover:border-indigo-400 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold shrink-0">
                            <Building2 className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-900 text-xs sm:text-sm leading-tight truncate">
                              {acc.name}
                            </h4>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/80 inline-block mt-0.5">
                              {acc.classification || 'حساب عام مستقل'}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shrink-0">
                          {accTxCount} حركة
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">رصيد الحساب:</span>
                          <span className={cn(
                            "font-black text-sm",
                            (acc.balance || 0) > 0 ? "text-emerald-700" : (acc.balance || 0) < 0 ? "text-red-600" : "text-slate-800"
                          )}>
                            {formatAmount(Math.abs(acc.balance || 0), acc.currency || systemCurrency, exchangeRates)} {acc.currency || systemCurrency}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (acc.id) {
                              setSelectedAccountIdForReport(acc.id);
                              setIsAccountReportModalOpen(true);
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-all shadow-2xs active:scale-95 shrink-0"
                          title="استعراض ومعاينة كشف الحساب كاملاً بنفس طريقة العملاء"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة الكشف</span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. VIEW 1: COMPACT ROWS & LINES (بسيط كسطور وصفوف)    */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'compact_rows' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <LayoutList className="w-4 h-4 text-emerald-600" />
              <span>قائمة السطور والصفوف السريعة ({processedItems.length})</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">انقر على أي سطر للتعديل أو التفاصيل</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[68vh] overflow-y-auto">
            {processedItems.map((item, idx) => {
              const isIncome = item.type === 'income';
              const isExpense = item.type === 'expense';
              const isDue = item.type === 'due';

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="p-2.5 sm:p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2.5 cursor-pointer active:bg-slate-100"
                >
                  {/* Right side: Icon, Customer/Desc, and Subtitle */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs",
                      isIncome ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                      isExpense ? "bg-red-100 text-red-700 border border-red-200" :
                      "bg-sky-100 text-sky-700 border border-sky-200"
                    )}>
                      {isIncome ? <ArrowDownLeft className="w-4 h-4" /> :
                       isExpense ? <ArrowUpRight className="w-4 h-4" /> :
                       <CreditCard className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p className="font-black text-slate-950 text-xs sm:text-sm truncate">
                          {item.customerName ? `${item.customerName}` : item.description}
                        </p>
                        {item.rawTask && (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                            <Smartphone className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate">{item.rawTask.deviceType} - {item.rawTask.brand}</span>
                          </span>
                        )}
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded",
                          isIncome ? "bg-emerald-100 text-emerald-800" :
                          isExpense ? "bg-red-100 text-red-800" : "bg-sky-100 text-sky-800"
                        )}>
                          {isIncome ? 'إيراد (ما له)' : isExpense ? 'صرف (ما عليه)' : 'تكلفة/مهمة (ما عليه)'}
                        </span>
                      </div>

                      {/* إظهار البيان بدلاً من التصنيف مع المتبقي التراكمي في الحساب */}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-700 flex-wrap font-bold min-w-0">
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.date ? item.date.slice(0, 10) : ''}</span>
                        <span>•</span>
                        <span className="bg-slate-100 text-slate-900 border border-slate-200 px-2 py-0.5 rounded font-black max-w-full break-words">
                          البيان: {item.description || (isIncome ? 'إيراد نقدي وارد' : isExpense ? 'مصروف منصرف' : 'تكلفة مهمة صيانة')}
                        </span>
                        {item.runningRemainingUSD !== undefined && (
                          <span className="bg-sky-50 text-sky-900 border border-sky-300/80 px-2 py-0.5 rounded text-[10px] font-black shrink-0">
                            المتبقي: {formatAmount(Math.abs(item.runningRemainingUSD), systemCurrency, exchangeRates)} {systemCurrency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left side: Amount with sign & delete action */}
                  <div className="text-left shrink-0 pl-1 flex items-center gap-1.5">
                    <div>
                      <p className={cn(
                        "font-black text-xs sm:text-sm whitespace-nowrap",
                        isIncome ? "text-emerald-700" :
                        isExpense ? "text-red-600" : "text-sky-800"
                      )}>
                        {isIncome ? '+' : isExpense ? '-' : ''}
                        {formatAmount(item.amountUSD, systemCurrency, exchangeRates)}
                        <span className="text-[10px] font-bold text-slate-500 mr-1">{systemCurrency}</span>
                      </p>
                    </div>
                    {item.sourceType === 'transaction' && onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTransaction(item.originalId);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-600 transition-colors"
                        title="حذف ومزامنة المركز المالي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {processedItems.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                <p className="font-bold">لا توجد حركات مالية مطابقة للمعايير المحددة</p>
                <p className="text-[10px]">جرّب تغيير التاريخ أو معايير البحث والتصفية</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 6. VIEW 2: COMPACT LEDGER TABLE (جدول محاسبي بسيط ثابت دون تمرير جانبي) */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <TableIcon className="w-4 h-4 text-sky-700" />
              <span>الجدول المحاسبي للحركات المالية ({processedItems.length})</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">عرض مالي مع البيان والمتبقي التراكمي</span>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full text-right text-xs table-fixed mobile-ledger-table">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-black">
                <tr>
                  <th className="p-2 w-[22%] sm:w-[18%]">التاريخ</th>
                  <th className="p-2 w-[40%] sm:w-[44%]">الطرف / البيان</th>
                  <th className="p-2 w-[20%] sm:w-[20%] text-center">الحركة</th>
                  <th className="p-2 w-[18%] sm:w-[18%] text-sky-800">المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {processedItems.map((item) => {
                  const isIncome = item.type === 'income';
                  const isExpense = item.type === 'expense';
                  const amtStr = formatAmount(item.amountUSD, systemCurrency, exchangeRates);

                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <td className="p-2 text-slate-500 text-[10px] sm:text-xs font-mono align-top">
                        {item.date ? item.date.slice(0, 10) : '-'}
                      </td>
                      <td className="p-2 align-top">
                        <p className="font-extrabold text-slate-900 text-xs truncate">
                          {item.customerName || (item.rawTask ? item.rawTask.customer : 'معاملة عامة')}
                        </p>
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-700 break-words mt-0.5">
                          البيان: {item.description || (isIncome ? 'إيراد نقدي وارد' : isExpense ? 'مصروف منصرف' : 'تكلفة مهمة صيانة')}
                        </p>
                      </td>
                      <td className="p-2 text-center align-top whitespace-nowrap">
                        <span className={cn(
                          "font-black text-xs block",
                          isIncome ? "text-emerald-700" : isExpense ? "text-red-600" : "text-sky-800"
                        )}>
                          {isIncome ? `+${amtStr}` : isExpense ? `-${amtStr}` : amtStr}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 rounded inline-block",
                          isIncome ? "bg-emerald-50 text-emerald-800" : isExpense ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-800"
                        )}>
                          {isIncome ? 'له' : isExpense ? 'عليه' : 'ذمة'}
                        </span>
                      </td>
                      <td className="p-2 align-top text-left font-black text-[11px] text-sky-900 whitespace-nowrap">
                        {item.runningRemainingUSD !== undefined 
                          ? `${formatAmount(Math.abs(item.runningRemainingUSD), systemCurrency, exchangeRates)}` 
                          : '-'}
                        <span className="text-[9px] text-slate-400 block font-normal">{systemCurrency}</span>
                      </td>
                    </tr>
                  );
                })}

                {processedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      لا توجد بيانات متاحة في الجدول
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 7. VIEW 3: PROFESSIONAL ANALYTICS & CHARTS & RATIOS  */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'analytics' && (
        <div className="space-y-4">
          {/* Key Financial Ratios Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Ratio 1: Operating Margin */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400">هامش الفائض التشغيلي</span>
              <p className="text-xl font-black text-slate-900">
                {stats.operatingMargin}%
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    stats.operatingMargin >= 20 ? "bg-emerald-500" : stats.operatingMargin > 0 ? "bg-sky-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.max(5, Math.min(100, Math.abs(stats.operatingMargin)))}%` }}
                />
              </div>
            </div>

            {/* Ratio 2: Cash In / Out Ratio */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400">نسبة ما له إلى ما عليه</span>
              <p className="text-xl font-black text-slate-900">
                {stats.incomeExpenseRatio} <span className="text-xs text-slate-400">مرات</span>
              </p>
              <span className={cn(
                "inline-block text-[9px] font-bold px-1.5 py-0.2 rounded",
                Number(stats.incomeExpenseRatio) >= 1.5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                {Number(stats.incomeExpenseRatio) >= 1.5 ? "تدفق إيجابي ممتاز" : "تدفق متقارب"}
              </span>
            </div>

            {/* Ratio 3: Total Financial Turnover */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400">إجمالي حجم التداول</span>
              <p className="text-xl font-black text-slate-900 truncate">
                {formatAmount(stats.totalTurnoverUSD, systemCurrency, exchangeRates)}
              </p>
              <span className="text-[9px] text-slate-500 font-bold">{systemCurrency} داخل وخارج</span>
            </div>

            {/* Ratio 4: Average Ticket */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400">متوسط قيمة الحركة</span>
              <p className="text-xl font-black text-slate-900 truncate">
                {formatAmount(stats.averageTicketUSD, systemCurrency, exchangeRates)}
              </p>
              <span className="text-[9px] text-slate-500 font-bold">{systemCurrency} لكل معاملة</span>
            </div>
          </div>

          {/* Charts Row 1: Pie Donut + Daily Comparison Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut Chart: Income vs Expense vs Dues */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  <span>توزيع التدفقات المالية والذمم</span>
                </h4>
                <span className="text-[10px] font-bold text-slate-400">نسبة مئوية</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [
                        `${val === 0.001 ? 0 : formatAmount(Number(val), systemCurrency, exchangeRates)} ${systemCurrency}`,
                        'القيمة'
                      ]}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Daily Inflow vs Outflow */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-700" />
                  <span>مقارنة ما له وما عليه عبر الأيام الأخيرة</span>
                </h4>
                <span className="text-[10px] font-bold text-slate-400">بالـ {systemCurrency}</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      formatter={(val: any) => [`${val} ${systemCurrency}`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar dataKey="income" name="ما له" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="expense" name="ما عليه" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Cumulative Trend Area Chart */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>مسار التدفق النقدي والرصيد التراكمي بالفترة</span>
              </h4>
              <span className="text-[10px] font-bold text-slate-400">تصاعد السيولة</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeTrendData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip formatter={(val: any) => [`${val} ${systemCurrency}`, 'الرصيد التراكمي']} />
                  <Area type="monotone" dataKey="balance" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown Matrix Table (مصفوفة الفئات والنسب المئوية) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-800" />
                <span>جدول تصنيف الفئات والنسب المئوية والأرباح</span>
              </h4>
              <span className="text-[10px] font-bold text-slate-400">{categoryBreakdown.length} فئات مسجلة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-black">
                  <tr>
                    <th className="p-2.5">الفئة / التصنيف</th>
                    <th className="p-2.5 text-center">العمليات</th>
                    <th className="p-2.5 text-emerald-700">ما له</th>
                    <th className="p-2.5 text-red-700">ما عليه</th>
                    <th className="p-2.5">الصافي</th>
                    <th className="p-2.5">النسبة والمشاركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {categoryBreakdown.map((cat, idx) => (
                    <tr key={cat.name} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-bold text-slate-900">{cat.name}</td>
                      <td className="p-2.5 text-center font-bold text-slate-500">{cat.count}</td>
                      <td className="p-2.5 font-black text-emerald-700">
                        {formatAmount(cat.incomeUSD, systemCurrency, exchangeRates)} {systemCurrency}
                      </td>
                      <td className="p-2.5 font-black text-red-600">
                        {formatAmount(cat.expenseUSD, systemCurrency, exchangeRates)} {systemCurrency}
                      </td>
                      <td className="p-2.5 font-black">
                        <span className={cat.netUSD >= 0 ? "text-emerald-700" : "text-red-600"}>
                          {formatAmount(cat.netUSD, systemCurrency, exchangeRates)} {systemCurrency}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                            <div 
                              className="h-full bg-sky-600 rounded-full" 
                              style={{ width: `${cat.percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-slate-600">{cat.percent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* VIEW: CURRENCY LINES (سطر واحد لكل عملة)               */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'currency_lines' && (
        <div className="space-y-4">
          {/* 1. Single Line Per Currency Summaries */}
          <div className="bg-white rounded-2xl border border-amber-200/80 shadow-xs p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>ملخص الحسابات والأرصدة بسطر واحد لكل عملة ({currencyBreakdown.length})</span>
              </span>
              <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                كل عملة بسطر واحد مستمر
              </span>
            </div>

            <div className="space-y-2">
              {currencyBreakdown.map((item) => (
                <div 
                  key={item.currency} 
                  className="p-3 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Currency Tag */}
                  <div className="flex items-center gap-2.5 shrink-0 min-w-[160px]">
                    <span className="text-xl">{item.flag}</span>
                    <div>
                      <h5 className="font-black text-xs text-white flex items-center gap-1.5">
                        <span>{item.label}</span>
                        <span className="text-[10px] text-amber-400 font-mono">({item.currency})</span>
                      </h5>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                        {item.count} سجلات • {item.accountNames.length > 0 ? item.accountNames.join('، ') : 'الصندوق العام'}
                      </span>
                    </div>
                  </div>

                  {/* Single Line Values Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-right flex-1 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 text-xs">
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-bold block">رصيد الخزائن والسيولة:</span>
                      <span className="text-xs font-black text-emerald-400">{item.accountsBalance.toLocaleString()} <span className="text-[9px] text-slate-400">{item.currency}</span></span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-bold block">إجمالي المقبوضات:</span>
                      <span className="text-xs font-black text-teal-300">+{item.totalIncome.toLocaleString()} <span className="text-[9px] text-slate-400">{item.currency}</span></span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-bold block">إجمالي المصروفات:</span>
                      <span className="text-xs font-black text-rose-400">-{item.totalExpense.toLocaleString()} <span className="text-[9px] text-slate-400">{item.currency}</span></span>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 font-bold block">صافي الفارق والرصيد:</span>
                      <span className={cn("text-xs font-black", item.netBalance >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        {item.netBalance >= 0 ? '+' : ''}{item.netBalance.toLocaleString()} <span className="text-[9px] text-slate-400">{item.currency}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Compact Transactions Ledger for Currency Lines View */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <LayoutList className="w-4 h-4 text-emerald-600" />
                <span>قائمة القيود والمعاملات المفلترة لكل عملة ({processedItems.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold">انقر للتعديل والتفاصيل</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
              {processedItems.map(item => {
                const isIncome = item.type === 'income';
                const isExpense = item.type === 'expense';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-2.5 hover:bg-amber-50/40 transition-colors flex items-center justify-between gap-2 cursor-pointer text-xs active:bg-amber-100/50"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 border",
                        isIncome ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                        isExpense ? "bg-red-50 text-red-800 border-red-200" : "bg-sky-50 text-sky-800 border-sky-200"
                      )}>
                        {item.currency}
                      </span>
                      <span className="font-black text-slate-900 truncate">
                        {item.customerName ? `${item.customerName} - ` : ''}{item.description}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{item.date ? item.date.slice(0, 10) : ''}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("font-black text-xs", isIncome ? "text-emerald-700" : isExpense ? "text-red-600" : "text-sky-800")}>
                        {isIncome ? '+' : isExpense ? '-' : ''}{Number(item.rawAmount || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">{item.currency}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 8. VIEW 4: DETAILED CARDS (بطاقات تفصيلية)             */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {processedItems.map(item => {
            const isIncome = item.type === 'income';
            const isExpense = item.type === 'expense';
            const amtStr = formatAmount(item.amountUSD, systemCurrency, exchangeRates);

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "bg-white p-3.5 rounded-2xl border shadow-xs space-y-2.5 transition-all hover:shadow-sm cursor-pointer active:scale-[0.99]",
                  isIncome ? "border-emerald-200/80 hover:border-emerald-300" :
                  isExpense ? "border-red-200/80 hover:border-red-300" : "border-sky-200/80 hover:border-sky-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-xs font-black px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5",
                    isIncome ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                    isExpense ? "bg-red-50 text-red-800 border-red-200" : "bg-sky-50 text-sky-800 border-sky-200"
                  )}>
                    {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> :
                     isExpense ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                     <CreditCard className="w-3.5 h-3.5" />}
                    {isIncome ? 'ما له' : isExpense ? 'ما عليه' : 'المتبقي'}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      {item.date ? item.date.slice(0, 10) : ''}
                    </span>
                    {item.sourceType === 'transaction' && onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTransaction(item.originalId);
                        }}
                        className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-600 transition-colors"
                        title="حذف ومزامنة المركز المالي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-950 text-base sm:text-lg">
                      {item.customerName ? `${item.customerName}` : item.description}
                    </h4>
                    {item.rawTask && (
                      <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                        <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{item.rawTask.deviceType} - {item.rawTask.brand}</span>
                      </span>
                    )}
                  </div>
                  {item.customerName && item.description && !item.rawTask && (
                    <p className="text-xs text-slate-500 font-medium">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 gap-2 flex-wrap">
                  <div className="flex flex-col min-w-0">
                    <span className="bg-slate-100 text-slate-900 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-black break-words">
                      البيان: {item.description || (isIncome ? 'إيراد نقدي' : 'مصروف منصرف')}
                    </span>
                    {item.runningRemainingUSD !== undefined && (
                      <span className="text-[10px] font-black text-sky-800 mt-0.5">
                        المتبقي في الحساب: {formatAmount(Math.abs(item.runningRemainingUSD), systemCurrency, exchangeRates)} {systemCurrency}
                      </span>
                    )}
                  </div>

                  <p className={cn(
                    "text-base font-black tracking-tight shrink-0",
                    isIncome ? "text-emerald-700" :
                    isExpense ? "text-red-600" : "text-sky-800"
                  )}>
                    {isIncome ? '+' : isExpense ? '-' : ''}
                    {amtStr} <span className="text-xs font-bold text-slate-500">{systemCurrency}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة توليد وتصدير ومشاركة تقرير حساب من الحسابات */}
      <AccountReportModal
        isOpen={isAccountReportModalOpen}
        onClose={() => setIsAccountReportModalOpen(false)}
        accounts={cashAccounts}
        selectedAccountId={selectedAccountIdForReport}
        transactions={transactions}
        systemCurrency={systemCurrency}
        exchangeRates={exchangeRates}
        appName={appName}
      />

      {/* نافذة الإقفال المالي الدوري (يومي / شهري) */}
      <FinancialClosingModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        transactions={transactions}
        cashAccounts={cashAccounts}
        systemCurrency={systemCurrency}
        currentUserName={appName || 'مدير النظام'}
      />
    </div>
  );
};

export default AccountsManager;
