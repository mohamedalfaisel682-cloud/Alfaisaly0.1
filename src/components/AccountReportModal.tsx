import React, { useState, useMemo } from 'react';
import { 
  X, 
  Building2, 
  Calendar, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Printer, 
  Share2, 
  FileText, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  DollarSign,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CashAccount, Transaction, Currency, ExchangeRates, Task } from '../types';
import { cn, formatAmount, convertAndRound, getInUSD } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';
import { VoiceInputButton } from './VoiceInputButton';
import { Search } from 'lucide-react';

export interface AccountReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CashAccount[];
  selectedAccountId?: number | null;
  transactions: Transaction[];
  tasks?: Task[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  appName?: string;
  appLogo?: string;
  onOpenInFullReports?: (accountName: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onEditTask?: (task: Task) => void;
}

export const AccountReportModal: React.FC<AccountReportModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedAccountId,
  transactions,
  tasks = [],
  systemCurrency,
  exchangeRates,
  appName = 'الفيصلي',
  appLogo,
  onOpenInFullReports,
  onEditTransaction,
  onEditTask
}) => {
  const [activeAccId, setActiveAccId] = useState<number | null>(() => {
    if (selectedAccountId) return selectedAccountId;
    return accounts[0]?.id || null;
  });

  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync when selectedAccountId changes
  React.useEffect(() => {
    if (selectedAccountId) {
      setActiveAccId(selectedAccountId);
    } else if (accounts.length > 0 && !activeAccId) {
      setActiveAccId(accounts[0].id || null);
    }
  }, [selectedAccountId, accounts]);

  const currentAccount = useMemo(() => {
    return accounts.find(a => a.id === activeAccId) || accounts[0] || null;
  }, [accounts, activeAccId]);

  // Filter transactions for this account and date range
  const filteredData = useMemo(() => {
    if (!currentAccount) return { transactions: [], totalIncome: 0, totalExpense: 0, netMovement: 0 };

    const accName = currentAccount.name.toLowerCase().trim();
    const accType = currentAccount.type?.toLowerCase().trim();
    const accId = currentAccount.id;

    let start = new Date(startDate + "T00:00:00");
    let end = new Date(endDate + "T23:59:59");

    if (period === 'today') {
      const today = new Date().toISOString().split('T')[0];
      start = new Date(today + "T00:00:00");
      end = new Date(today + "T23:59:59");
    } else if (period === 'week') {
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      start = new Date(firstDay.toISOString().split('T')[0] + "T00:00:00");
      end = new Date(new Date().toISOString().split('T')[0] + "T23:59:59");
    } else if (period === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = new Date(firstDay.toISOString().split('T')[0] + "T00:00:00");
      end = new Date(new Date().toISOString().split('T')[0] + "T23:59:59");
    } else if (period === 'year') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), 0, 1);
      start = new Date(firstDay.toISOString().split('T')[0] + "T00:00:00");
      end = new Date(new Date().toISOString().split('T')[0] + "T23:59:59");
    }

    const matched = transactions.filter(t => {
      const d = new Date(t.date);
      if (period !== 'all' && (d < start || d > end)) {
        return false;
      }

      // Check if transaction is associated with this account
      if (t.cashAccountId && accId && t.cashAccountId === accId) {
        return true;
      }
      if (t.relatedAccountId && accId && t.relatedAccountId === accId) {
        return true;
      }
      if (t.customerName && accName && t.customerName.toLowerCase().trim() === accName) {
        return true;
      }

      const src = t.sourceAccount?.toLowerCase().trim();
      const dst = t.destinationAccount?.toLowerCase().trim();

      if (src && (src === accName || src === accType)) return true;
      if (dst && (dst === accName || dst === accType)) return true;

      // Also fallback match description if contains account name
      if (t.description && t.description.toLowerCase().includes(accName)) return true;

      return false;
    });

    // 1. Sort ascending from the very first transaction to the last to build the exact chronological running balance
    const sortedAsc = [...matched].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    const enrichedTransactions = sortedAsc.map(t => {
      const amountInSys = convertAndRound(t.amount, t.currency, systemCurrency, exchangeRates);
      if (t.type === 'income') {
        totalIncome += amountInSys;
        running += amountInSys;
      } else {
        totalExpense += amountInSys;
        running -= amountInSys;
      }
      return {
        ...t,
        amountInSys,
        runningBalance: running
      };
    });

    // احتساب الباقي للحساب من ناتج إجمالي ما عليه مطروح منه ما له
    const remainingBalance = totalExpense - totalIncome;
    const netMovement = totalIncome - totalExpense;

    // Display order according to sortOrder (asc = from first to last; desc = from last to first)
    const ordered = sortOrder === 'desc' ? [...enrichedTransactions].reverse() : enrichedTransactions;

    // Filter by search query (statement, party, amount, date)
    const finalTransactions = ordered.filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        t.description?.toLowerCase().includes(q) ||
        t.customerName?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.amount.toString().includes(q) ||
        (t.date && t.date.includes(q))
      );
    });

    return {
      transactions: finalTransactions,
      allEnrichedCount: enrichedTransactions.length,
      totalIncome,
      totalExpense,
      remainingBalance,
      netMovement
    };
  }, [currentAccount, transactions, period, startDate, endDate, sortOrder, searchQuery, systemCurrency, exchangeRates]);

  if (!isOpen || !currentAccount) return null;

  const targetReportId = `account-statement-export-${currentAccount.id || 'curr'}`;

  const getReportText = () => {
    const lines = [
      `═══════════════════════════════════════`,
      `🏢 ${appName} - كشف حساب مالي رسمي`,
      `🏦 اسم الحساب: ${currentAccount.name} (${currentAccount.type === 'vault' ? 'خزينة' : currentAccount.type === 'bank' ? 'بنك' : currentAccount.type === 'wallet' ? 'محفظة' : 'صندوق'})`,
      `📅 الفترة: ${period === 'all' ? 'كامل الحركات' : `من ${startDate} إلى ${endDate}`}`,
      `💰 الرصيد الحالي: ${formatAmount(currentAccount.balance, currentAccount.currency, exchangeRates)} ${currentAccount.currency}`,
      `═══════════════════════════════════════`,
      `▫️ إجمالي المقبوضات (له): ${formatAmount(filteredData.totalIncome, systemCurrency, exchangeRates)} ${systemCurrency}`,
      `▫️ إجمالي المدفوعات (عليه): ${formatAmount(filteredData.totalExpense, systemCurrency, exchangeRates)} ${systemCurrency}`,
      `▫️ صافي الحركة في الفترة: ${formatAmount(filteredData.netMovement, systemCurrency, exchangeRates)} ${systemCurrency}`,
      `▫️ عدد الحركات المنفذة: ${filteredData.transactions.length}`,
      `═══════════════════════════════════════`,
      `📋 تفاصيل الحركات الأخيرة:`,
    ];

    filteredData.transactions.slice(0, 30).forEach((t: any, i) => {
      lines.push(`${i + 1}. [${t.date ? t.date.slice(0, 10) : ''}] البيان: ${t.description || t.customerName || 'معاملة'} | ${t.type === 'income' ? 'له' : 'عليه'}: ${t.amount} ${t.currency} | المتبقي: ${formatAmount(t.runningBalance, systemCurrency, exchangeRates)} ${systemCurrency}`);
    });

    if (filteredData.transactions.length > 30) {
      lines.push(`+ و ${filteredData.transactions.length - 30} حركة أخرى مسجلة في السجل.`);
    }

    lines.push(`═══════════════════════════════════════`);
    lines.push(`تاريخ التوليد: ${new Date().toLocaleDateString('ar-SA')} - نظام ${appName}`);
    return lines.join('\n');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] max-w-full">
        {/* Modal Top Header */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">توليد وتصدير تقرير حساب</h3>
              <p className="text-[11px] text-slate-500">كشف حساب مالي تفصيلي مع الرصيد والحركات</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title={isHeaderCollapsed ? "إظهار خيارات التقرير" : "طي الخيارات لتكبير التقرير"}
            >
              {isHeaderCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isHeaderCollapsed ? 'إظهار الأدوات' : 'طي الأدوات للمعاينة'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Container (Collapsible & Shiftable Upwards) */}
        {!isHeaderCollapsed && (
          <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 space-y-2.5 transition-all">
            
            {/* 1. مربع البحث في رأس القائمة */}
            <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all shadow-2xs">
              <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالصوت أو النص في حركات كشف الحساب والبيان والمبالغ..."
                className="w-full py-2 px-1 bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400"
              />
              <div className="h-full flex items-center shrink-0">
                <VoiceInputButton
                  target="account-report-search"
                  onResult={(text) => {
                    setSearchQuery(text);
                  }}
                  className="px-1 text-slate-400 hover:text-emerald-600 rounded-lg"
                  buttonTitle="تحويل الكلام إلى نص"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold"
                    title="مسح النص وإلغاء المدخلات بنقرة واحدة"
                  >
                    <X className="w-4 h-4 stroke-[3]" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* 2. الحساب وتسلسل الحركات بصف واحد */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {/* Account Selector */}
              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-700 block truncate">اختر الحساب:</label>
                <select
                  value={currentAccount.id}
                  onChange={(e) => setActiveAccId(Number(e.target.value))}
                  className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-xl text-[10px] sm:text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 truncate"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === 'vault' ? 'خزينة' : a.type === 'bank' ? 'بنك' : a.type === 'wallet' ? 'محفظة' : 'صندوق'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Sequence Selector */}
              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-700 block truncate">تسلسل الحركات:</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-xl text-[10px] sm:text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 truncate"
                >
                  <option value="asc">من أول معاملة إلى آخر معاملة</option>
                  <option value="desc">من الأحدث إلى الأقدم</option>
                </select>
              </div>
            </div>

            {/* 3. فترة التقرير بصف واحد مع إمكانية اختيار تاريخ معين */}
            <div className="flex items-center gap-2 w-full">
              <div className="space-y-0.5 flex-1 min-w-0">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-700 block truncate">فترة التقرير:</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-xl text-[10px] sm:text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 truncate"
                >
                  <option value="all">كامل الحركات</option>
                  <option value="today">اليوم</option>
                  <option value="week">هذا الأسبوع</option>
                  <option value="month">هذا الشهر</option>
                  <option value="year">هذا العام</option>
                  <option value="custom">تاريخ معين (فترة مخصصة)</option>
                </select>
              </div>

              {/* Custom Date Pickers in same row */}
              {period === 'custom' && (
                <div className="flex items-center gap-1 flex-1 shrink-0">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <label className="text-[8.5px] font-bold text-slate-500 block truncate">من</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-1 sm:p-1.5 bg-white border border-slate-200 rounded-xl text-[9.5px] sm:text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <label className="text-[8.5px] font-bold text-slate-500 block truncate">إلى</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-1 sm:p-1.5 bg-white border border-slate-200 rounded-xl text-[9.5px] sm:text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {onOpenInFullReports && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpenInFullReports(currentAccount.name);
                    onClose();
                  }}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>فتح هذا الحساب في مركز التقارير المتقدمة</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 🚀 BANNER: تصدير ومشاركة التقرير المولد (Exact Requested Text and Toolbar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/70 px-4 py-3 border-b border-emerald-100 no-print">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-slate-800">تصدير ومشاركة التقرير المولد:</span>
          </div>
          <ExportToolbar
            targetElementId={targetReportId}
            title={`كشف_حساب_${currentAccount.name}_${new Date().toISOString().split('T')[0]}`}
            filenamePrefix={`كشف_حساب_${currentAccount.name}`}
            getTextContent={getReportText}
            showPrint={true}
            className="bg-white border border-emerald-200 rounded-xl p-0.5 shadow-2xs"
          />
        </div>

        {/* Printable & Exportable Report Canvas Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div
            id={targetReportId}
            className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 sm:space-y-5"
          >
            {/* Header with App Logo, Name, and Account Meta */}
            <div className="flex flex-col items-center justify-center text-center pb-4 border-b border-slate-200 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-md">
                  {appLogo ? (
                    <img src={appLogo} alt="Logo" className="w-10 h-10 object-contain" />
                  ) : (
                    <Building2 className="w-6 h-6" />
                  )}
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-black text-slate-900">{appName}</h2>
                  <p className="text-xs font-bold text-slate-500">كشف حساب مالي رسمي معتمد</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 mt-2 w-full flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">الحساب:</span>
                  <span className="text-emerald-800 font-black">{currentAccount.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">النوع:</span>
                  <span>{currentAccount.type === 'vault' ? 'خزينة' : currentAccount.type === 'bank' ? 'بنك' : currentAccount.type === 'wallet' ? 'محفظة' : 'صندوق نقد'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">تاريخ الإصدار:</span>
                  <span>{new Date().toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            </div>

            {/* Financial Summary Cards for the Account */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-[10px] font-black text-red-600 uppercase">إجمالي ما عليه</p>
                <p className="text-base font-black text-red-800 mt-1">
                  {formatAmount(filteredData.totalExpense, systemCurrency, exchangeRates)} {systemCurrency}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase">إجمالي ما له</p>
                <p className="text-base font-black text-emerald-800 mt-1">
                  {formatAmount(filteredData.totalIncome, systemCurrency, exchangeRates)} {systemCurrency}
                </p>
              </div>

              <div className={cn(
                "p-3 rounded-xl border",
                filteredData.remainingBalance > 0.01 
                  ? "bg-amber-50 border-amber-200" 
                  : filteredData.remainingBalance < -0.01 
                  ? "bg-blue-50 border-blue-200" 
                  : "bg-emerald-50 border-emerald-200"
              )}>
                <p className={cn(
                  "text-[10px] font-black uppercase",
                  filteredData.remainingBalance > 0.01 ? "text-amber-700" : filteredData.remainingBalance < -0.01 ? "text-blue-700" : "text-emerald-700"
                )}>
                  {filteredData.remainingBalance > 0.01 ? 'المتبقي عليه' : filteredData.remainingBalance < -0.01 ? 'المتبقي له' : 'خالص ومصفى'}
                </p>
                <p className={cn(
                  "text-base font-black mt-1",
                  filteredData.remainingBalance > 0.01 ? "text-amber-900" : filteredData.remainingBalance < -0.01 ? "text-blue-900" : "text-emerald-900"
                )}>
                  {formatAmount(Math.abs(filteredData.remainingBalance), systemCurrency, exchangeRates)} {systemCurrency}
                </p>
              </div>

              <div className="p-3 bg-emerald-50/80 text-slate-900 border border-emerald-200/90 rounded-xl shadow-2xs">
                <p className="text-[10px] font-black text-emerald-800 uppercase">الرصيد الحالي</p>
                <p className="text-base font-black text-emerald-700 mt-1">
                  {formatAmount(currentAccount.balance, currentAccount.currency, exchangeRates)} {currentAccount.currency}
                </p>
              </div>
            </div>

            {/* Transactions Table with Exact Mathematical Running Balance */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">
                  سجل حركات كشف الحساب المتسلسلة ({filteredData.transactions.length})
                </span>
                <span className="text-[10px] text-slate-500 font-bold">مع البيان والمتبقي التراكمي بعد كل عملية</span>
              </div>

              <div className="w-full overflow-hidden">
                <table className="w-full text-right text-xs table-fixed mobile-ledger-table">
                  <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-[20%] sm:w-[18%]">التاريخ</th>
                      <th className="p-2 w-[40%] sm:w-[42%]">البيان</th>
                      <th className="p-2 w-[20%] text-center">الحركة</th>
                      <th className="p-2 w-[20%] text-sky-800">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                          لا توجد حركات مسجلة لهذا الحساب في الفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      filteredData.transactions.map((t: any) => {
                        const isIncome = t.type === 'income';
                        return (
                          <tr 
                            key={t.id} 
                            onClick={() => {
                              if (t.taskId && onEditTask && tasks.length > 0) {
                                const matchedTask = tasks.find(tk => tk.id === t.taskId);
                                if (matchedTask) {
                                  onEditTask(matchedTask);
                                  return;
                                }
                              }
                              if (onEditTransaction) {
                                onEditTransaction(t);
                              }
                            }}
                            className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                            title="انقر لمعاينة وتعديل المعاملة أو المهمة"
                          >
                            <td className="p-2 text-slate-500 font-mono text-[10px] sm:text-xs align-top">
                              {t.date ? t.date.slice(0, 10) : ''}
                            </td>
                            <td className="p-2 text-slate-800 align-top">
                              <span className="font-extrabold text-slate-950 text-xs sm:text-sm block break-words">
                                {t.description || (isIncome ? 'إيراد نقدي وارد' : 'مصروف منصرف')}
                              </span>
                              {t.customerName && (
                                <span className="text-[10px] text-sky-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded inline-block mt-0.5 border border-sky-100">
                                  الطرف: {t.customerName}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center align-top whitespace-nowrap">
                              <span className={cn(
                                "font-black text-xs block",
                                isIncome ? "text-emerald-700" : "text-red-600"
                              )}>
                                {isIncome ? `+${formatAmount(t.amount, t.currency, exchangeRates)}` : `-${formatAmount(t.amount, t.currency, exchangeRates)}`}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2 rounded inline-block",
                                isIncome ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                              )}>
                                {isIncome ? 'له (إيراد)' : 'عليه (صرف)'}
                              </span>
                            </td>
                            <td className="p-2 font-black text-sky-900 whitespace-nowrap bg-sky-50/30 align-top text-left text-[11px]">
                              {formatAmount(t.runningBalance, systemCurrency, exchangeRates)}
                              <span className="text-[9px] text-slate-400 block font-normal">{systemCurrency}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature & Confirmation Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>تقرير حساب تم توليده آلياً من نظام إدارة الحسابات</span>
              <span>المسؤول المالي: ________________</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
export default AccountReportModal;
