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
  MapPin
} from 'lucide-react';
import { CashAccount, Transaction, Currency, ExchangeRates, Task } from '../types';
import { cn, formatAmount, convertAndRound, getInUSD } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';

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

  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('month');
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

      const src = t.sourceAccount?.toLowerCase().trim();
      const dst = t.destinationAccount?.toLowerCase().trim();

      if (src && (src === accName || src === accType)) return true;
      if (dst && (dst === accName || dst === accType)) return true;

      // Also fallback match description if contains account name
      if (t.description && t.description.toLowerCase().includes(accName)) return true;

      return false;
    });

    matched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalIncome = 0;
    let totalExpense = 0;

    matched.forEach(t => {
      const amountInSys = convertAndRound(t.amount, t.currency, systemCurrency, exchangeRates);
      if (t.type === 'income') {
        totalIncome += amountInSys;
      } else {
        totalExpense += amountInSys;
      }
    });

    // احتساب الباقي للحساب من ناتج إجمالي ما عليه مطروح منه ما له
    const remainingBalance = totalExpense - totalIncome;
    const netMovement = totalIncome - totalExpense;

    return {
      transactions: matched,
      totalIncome,
      totalExpense,
      remainingBalance,
      netMovement
    };
  }, [currentAccount, transactions, period, startDate, endDate, systemCurrency, exchangeRates]);

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

    filteredData.transactions.slice(0, 20).forEach((t, i) => {
      lines.push(`${i + 1}. [${t.date ? t.date.slice(0, 10) : ''}] ${t.type === 'income' ? 'له' : 'عليه'}: ${t.amount} ${t.currency} - ${t.description || t.customerName || 'معاملة'}`);
    });

    if (filteredData.transactions.length > 20) {
      lines.push(`+ و ${filteredData.transactions.length - 20} حركة أخرى مسجلة في السجل.`);
    }

    lines.push(`═══════════════════════════════════════`);
    lines.push(`تاريخ التوليد: ${new Date().toLocaleDateString('ar-SA')} - نظام ${appName}`);
    return lines.join('\n');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">توليد وتصدير تقرير حساب</h3>
              <p className="text-xs text-slate-300">كشف حساب مالي تفصيلي مع الرصيد والحركات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Account Selector */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">اختر الحساب:</label>
              <select
                value={currentAccount.id}
                onChange={(e) => setActiveAccId(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type === 'vault' ? 'خزينة' : a.type === 'bank' ? 'بنك' : a.type === 'wallet' ? 'محفظة' : 'صندوق'})
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">فترة التقرير:</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="today">اليوم</option>
                <option value="week">هذا الأسبوع</option>
                <option value="month">هذا الشهر</option>
                <option value="year">هذا العام</option>
                <option value="all">كامل الحركات (الكل)</option>
                <option value="custom">فترة مخصصة</option>
              </select>
            </div>

            {/* Custom Dates */}
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-1.5 sm:col-span-2 md:col-span-1">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500">من تاريخ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500">إلى تاريخ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {onOpenInFullReports && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onOpenInFullReports(currentAccount.name);
                  onClose();
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>فتح هذا الحساب في مركز التقارير المتقدمة</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div
            id={targetReportId}
            className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
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
                <p className="text-[10px] font-black text-red-600 uppercase">إجمالي ما عليه (المصروف)</p>
                <p className="text-base font-black text-red-800 mt-1">
                  {formatAmount(filteredData.totalExpense, systemCurrency, exchangeRates)} {systemCurrency}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase">إجمالي ما له (الإيراد)</p>
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
                  {filteredData.remainingBalance > 0.01 ? 'الباقي عليه (مطلوب)' : filteredData.remainingBalance < -0.01 ? 'الباقي له (فائض)' : 'خالص ومصفى'}
                </p>
                <p className={cn(
                  "text-base font-black mt-1",
                  filteredData.remainingBalance > 0.01 ? "text-amber-900" : filteredData.remainingBalance < -0.01 ? "text-blue-900" : "text-emerald-900"
                )}>
                  {formatAmount(Math.abs(filteredData.remainingBalance), systemCurrency, exchangeRates)} {systemCurrency}
                </p>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xs">
                <p className="text-[10px] font-black text-slate-300 uppercase">الرصيد الدفتري الحالي</p>
                <p className="text-base font-black text-emerald-400 mt-1">
                  {formatAmount(currentAccount.balance, currentAccount.currency, exchangeRates)} {currentAccount.currency}
                </p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">
                  سجل حركات الحساب ({filteredData.transactions.length})
                </span>
                <span className="text-[10px] text-slate-500 font-bold">انقر على أي صف لمعاينة وتعديل المعاملة</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">البيان / الوصف</th>
                      <th className="px-3 py-2">الفئة</th>
                      <th className="px-3 py-2 text-left">المبلغ</th>
                      <th className="px-3 py-2 text-center">النوع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                          لا توجد حركات مسجلة لهذا الحساب في الفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      filteredData.transactions.map((t) => {
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
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                              {t.date ? t.date.slice(0, 10) : ''}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-800">
                              {t.description || t.customerName || 'معاملة مالية'}
                              {t.customerName && t.description && (
                                <span className="text-[10px] text-slate-400 font-normal mr-1">
                                  ({t.customerName})
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {t.category || (isIncome ? 'وارد' : 'منصرف')}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-black text-left whitespace-nowrap">
                              {formatAmount(t.amount, t.currency, exchangeRates)} {t.currency}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-black",
                                isIncome ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              )}>
                                {isIncome ? 'له' : 'عليه'}
                              </span>
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
