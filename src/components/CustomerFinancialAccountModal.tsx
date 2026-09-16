import React, { useState, useMemo } from 'react';
import {
  Wallet,
  X,
  PhoneCall,
  MessageSquare,
  Share2,
  FileText,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Layers,
  ExternalLink,
  Plus,
  CreditCard,
  Receipt,
  Smartphone,
  Wrench,
  ChevronLeft,
  Copy,
  Check,
  Building,
  User,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Task, Customer, Transaction, Currency, ExchangeRates } from '../types';
import { cn, getInUSD, formatAmount, normalizeName } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';

interface CustomerFinancialAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone?: string;
  customers: Customer[];
  tasks: Task[];
  transactions: Transaction[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  onEditTask?: (task: Task) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onAddPaymentToTask?: (task: Task) => void;
  onAddTransaction?: (type: 'income' | 'expense', customerName: string) => void;
  onViewAllCustomerTasks?: (customerName: string) => void;
  onNavigateToAccounts?: (customerName: string) => void;
  renderColoredText?: (text: string | null | undefined) => React.ReactNode;
  appName?: string;
}

type TabType = 'all' | 'tasks' | 'deposits' | 'transactions' | 'unpaid';

export const CustomerFinancialAccountModal: React.FC<CustomerFinancialAccountModalProps> = ({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  customers,
  tasks,
  transactions,
  systemCurrency,
  exchangeRates,
  onEditTask,
  onEditTransaction,
  onAddPaymentToTask,
  onAddTransaction,
  onViewAllCustomerTasks,
  onNavigateToAccounts,
  renderColoredText,
  appName = 'نظام إدارة الصيانة والمبيعات'
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(systemCurrency);
  const [copiedText, setCopiedText] = useState(false);

  // Normalize current customer name
  const normalizedTarget = useMemo(() => normalizeName(customerName), [customerName]);

  // Find customer object
  const customerObj = useMemo(() => {
    return customers.find(c => normalizeName(c.name) === normalizedTarget);
  }, [customers, normalizedTarget]);

  const phoneToUse = customerPhone || customerObj?.phone || '';
  const allPhones = customerObj?.phones && customerObj.phones.length > 0 ? customerObj.phones : (phoneToUse ? [phoneToUse] : []);

  // Helper for task financials
  const getTaskFinancials = (task: Task) => {
    const totalCostUSD = getInUSD(task.cost || 0, task.currency || systemCurrency, exchangeRates);
    let totalPaidUSD = 0;
    if (task.depositHistory && task.depositHistory.length > 0) {
      totalPaidUSD = task.depositHistory.reduce(
        (sum, item) => sum + getInUSD(item.amount || 0, item.currency || task.currency || systemCurrency, exchangeRates),
        0
      );
    } else {
      totalPaidUSD = getInUSD(task.deposit || 0, task.currency || systemCurrency, exchangeRates);
    }
    const balanceUSD = totalCostUSD - totalPaidUSD;
    return { totalCost: totalCostUSD, totalPaid: totalPaidUSD, balance: balanceUSD };
  };

  // Filter tasks belonging to this customer
  const customerTasks = useMemo(() => {
    if (!normalizedTarget) return [];
    return tasks.filter(t => normalizeName(t.customer) === normalizedTarget);
  }, [tasks, normalizedTarget]);

  // Filter transactions belonging to this customer
  const customerTransactions = useMemo(() => {
    if (!normalizedTarget) return [];
    return transactions.filter(t => normalizeName(t.customerName) === normalizedTarget);
  }, [transactions, normalizedTarget]);

  // Financial aggregates
  const financials = useMemo(() => {
    let totalTasksCostUSD = 0;
    let totalTasksPaidUSD = 0;
    let totalTasksBalanceUSD = 0;

    customerTasks.forEach(t => {
      const { totalCost, totalPaid, balance } = getTaskFinancials(t);
      totalTasksCostUSD += totalCost;
      totalTasksPaidUSD += totalPaid;
      totalTasksBalanceUSD += balance;
    });

    let totalIncomeUSD = 0;
    let totalExpenseUSD = 0;

    customerTransactions.forEach(tr => {
      const amountUSD = getInUSD(tr.amount || 0, tr.currency || systemCurrency, exchangeRates);
      if (tr.type === 'income') {
        totalIncomeUSD += amountUSD;
      } else if (tr.type === 'expense') {
        totalExpenseUSD += amountUSD;
      }
    });

    // Net balance:
    // إجمالي ما عليه: تكاليف المهام والمصروفات المسجلة عليه
    // إجمالي ما له: مقدمات المهام والواصل والإيرادات المسجلة له
    // الباقي للحساب: ناتج إجمالي ما عليه مطروح منه ماله
    const totalOverallCostUSD = totalTasksCostUSD + totalExpenseUSD;
    const totalOverallPaidUSD = totalTasksPaidUSD + totalIncomeUSD;
    const netDuesUSD = totalOverallCostUSD - totalOverallPaidUSD;

    return {
      tasksCostUSD: totalTasksCostUSD,
      tasksPaidUSD: totalTasksPaidUSD,
      tasksBalanceUSD: totalTasksBalanceUSD,
      incomeUSD: totalIncomeUSD,
      expenseUSD: totalExpenseUSD,
      netDuesUSD: netDuesUSD,
      totalOverallCostUSD: totalOverallCostUSD,
      totalOverallPaidUSD: totalOverallPaidUSD,
      tasksCount: customerTasks.length,
      transactionsCount: customerTransactions.length,
      unpaidCount: customerTasks.filter(t => getTaskFinancials(t).balance > 0.01).length
    };
  }, [customerTasks, customerTransactions, systemCurrency, exchangeRates]);

  // Unified items feed
  interface UnifiedItem {
    id: string;
    type: 'task' | 'deposit' | 'transaction';
    date: string;
    title: string;
    subTitle: string;
    badgeText: string;
    badgeColor: string;
    amountUSD: number;
    paidUSD?: number;
    balanceUSD?: number;
    rawTask?: Task;
    rawTransaction?: Transaction;
    note?: string;
  }

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    // Add tasks
    customerTasks.forEach(t => {
      const { totalCost, totalPaid, balance } = getTaskFinancials(t);
      const isSale = t.taskType === 'sale';
      const isPurchase = t.taskType === 'purchase';
      let typeLabel = 'مهمة صيانة';
      let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      if (isSale) {
        typeLabel = 'فاتورة مبيعات';
        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (isPurchase) {
        typeLabel = 'فاتورة مشتريات';
        badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
      }

      items.push({
        id: `task-${t.id}`,
        type: 'task',
        date: t.createdAt,
        title: `${t.deviceType || 'جهاز'} ${t.brand ? `(${t.brand})` : ''}`,
        subTitle: t.issue || 'لا يوجد وصف للمشكلة',
        badgeText: typeLabel,
        badgeColor: badgeColor,
        amountUSD: totalCost,
        paidUSD: totalPaid,
        balanceUSD: balance,
        rawTask: t,
        note: t.storageLocation ? `الموقع: ${t.storageLocation}` : undefined
      });

      // Add individual deposits from depositHistory if present
      if (t.depositHistory && t.depositHistory.length > 0) {
        t.depositHistory.forEach((dep, idx) => {
          const depUSD = getInUSD(dep.amount || 0, dep.currency || t.currency || systemCurrency, exchangeRates);
          items.push({
            id: `dep-${t.id}-${dep.id || idx}`,
            type: 'deposit',
            date: dep.date || t.createdAt,
            title: `دفعة مسددة: ${t.deviceType || 'جهاز'}`,
            subTitle: dep.note || `دفعة من حساب ${t.customer}`,
            badgeText: 'سند قبض / دفعة',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            amountUSD: depUSD,
            rawTask: t,
            note: `رقم المهمة #${t.id}`
          });
        });
      } else if ((t.deposit || 0) > 0) {
        const depUSD = getInUSD(t.deposit || 0, t.currency || systemCurrency, exchangeRates);
        items.push({
          id: `dep-init-${t.id}`,
          type: 'deposit',
          date: t.createdAt,
          title: `عربون / دفعة أولى: ${t.deviceType || 'جهاز'}`,
          subTitle: `عربون مسدد عند استلام الجهاز`,
          badgeText: 'سند قبض / عربون',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          amountUSD: depUSD,
          rawTask: t,
          note: `رقم المهمة #${t.id}`
        });
      }
    });

    // Add standalone transactions
    customerTransactions.forEach(tr => {
      const amountUSD = getInUSD(tr.amount || 0, tr.currency || systemCurrency, exchangeRates);
      const isIncome = tr.type === 'income';
      items.push({
        id: `tr-${tr.id}`,
        type: 'transaction',
        date: tr.date,
        title: tr.description || (isIncome ? 'سند قبض مالي' : 'سند صرف مالي'),
        subTitle: tr.category ? `التصنيف: ${tr.category}` : 'معاملة مالية مستقلة',
        badgeText: isIncome ? 'وارد (له)' : 'منصرف (عليه)',
        badgeColor: isIncome ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200',
        amountUSD: amountUSD,
        rawTransaction: tr
      });
    });

    // Sort by date descending
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerTasks, customerTransactions, systemCurrency, exchangeRates]);

  // Filtered feed
  const filteredFeed = useMemo(() => {
    let list = unifiedItems;

    if (activeTab === 'tasks') {
      list = list.filter(i => i.type === 'task');
    } else if (activeTab === 'deposits') {
      list = list.filter(i => i.type === 'deposit');
    } else if (activeTab === 'transactions') {
      list = list.filter(i => i.type === 'transaction');
    } else if (activeTab === 'unpaid') {
      list = list.filter(i => i.type === 'task' && (i.balanceUSD || 0) > 0.01);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.subTitle.toLowerCase().includes(q) ||
          (i.note && i.note.toLowerCase().includes(q)) ||
          i.badgeText.toLowerCase().includes(q) ||
          i.date.includes(q)
      );
    }

    return list;
  }, [unifiedItems, activeTab, searchQuery]);

  // Format text report for copying / WhatsApp
  const generateAccountReportText = () => {
    const formattedTotalCost = `${formatAmount(financials.totalOverallCostUSD, displayCurrency, exchangeRates)} ${displayCurrency}`;
    const formattedTotalPaid = `${formatAmount(financials.totalOverallPaidUSD, displayCurrency, exchangeRates)} ${displayCurrency}`;
    const formattedBalance = `${formatAmount(financials.netDuesUSD, displayCurrency, exchangeRates)} ${displayCurrency}`;

    let text = `🧾 *كشف حساب العميل والعمليات المالية*\n`;
    text += `🏬 *${appName}*\n`;
    text += `👤 *العميل:* ${customerName}\n`;
    if (phoneToUse) text += `📱 *الهاتف:* ${phoneToUse}\n`;
    text += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `═════════════════════════\n`;
    text += `📊 *الموقف المالي العام:*\n`;
    text += `💰 *إجمالي التكلفة / المبيعات:* ${formattedTotalCost}\n`;
    text += `💵 *إجمالي المسدد والواصل:* ${formattedTotalPaid}\n`;
    text += `📌 *صافي الرصيد المتبقي (المستحق):* ${formattedBalance}\n`;
    text += `═════════════════════════\n\n`;

    text += `📋 *تفاصيل العمليات والمهام:*\n`;
    customerTasks.forEach((t, idx) => {
      const { totalCost, totalPaid, balance } = getTaskFinancials(t);
      const costStr = `${formatAmount(totalCost, displayCurrency, exchangeRates)} ${displayCurrency}`;
      const paidStr = `${formatAmount(totalPaid, displayCurrency, exchangeRates)} ${displayCurrency}`;
      const balStr = `${formatAmount(balance, displayCurrency, exchangeRates)} ${displayCurrency}`;
      const dateStr = new Date(t.createdAt).toLocaleDateString('ar-SA');
      text += `${idx + 1}. *[${dateStr}]* ${t.deviceType || 'جهاز'} ${t.brand ? `(${t.brand})` : ''}\n`;
      if (t.issue) text += `   • المشكلة/البيان: ${t.issue}\n`;
      text += `   • التكلفة: ${costStr} | الواصل: ${paidStr} | المتبقي: ${balStr}\n\n`;
    });

    if (customerTransactions.length > 0) {
      text += `💳 *المعاملات المالية والسندات المستقلة:*\n`;
      customerTransactions.forEach((tr, idx) => {
        const amtStr = `${formatAmount(getInUSD(tr.amount || 0, tr.currency || systemCurrency, exchangeRates), displayCurrency, exchangeRates)} ${displayCurrency}`;
        const dateStr = new Date(tr.date).toLocaleDateString('ar-SA');
        const typeStr = tr.type === 'income' ? 'قبض/وارد' : 'صرف/منصرف';
        text += `${idx + 1}. *[${dateStr}]* ${typeStr}: ${tr.description || 'معاملة'} (${amtStr})\n`;
      });
      text += `\n`;
    }

    text += `═════════════════════════\n`;
    if (financials.netDuesUSD > 0.01) {
      text += `⚠️ *المبلغ المطلوب سداده:* ${formattedBalance}\n`;
    } else {
      text += `✅ *الحساب مصفّى وخالص تماماً. شكراً لتعاملكم معنا.* ✨\n`;
    }

    return text;
  };

  const handleShareWhatsApp = () => {
    const text = generateAccountReportText();
    const cleanPhone = phoneToUse.replace(/[^\d+]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const text = generateAccountReportText();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id={`customer-financial-account-${normalizedTarget}`}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex flex-col gap-3 relative shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-black truncate">{customerName}</h3>
                  {customerObj?.classification && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                      {customerObj.classification}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  كشف الحساب والعمليات المالية الشاملة للعميل
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-all cursor-pointer shrink-0"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contact and Currency bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-white/15 text-xs">
            {/* Phone numbers */}
            <div className="flex items-center gap-2 flex-wrap">
              {allPhones.length > 0 ? (
                allPhones.map((ph, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-xl border border-white/20">
                    <span className="font-mono text-emerald-50 text-[11px] font-bold">{ph}</span>
                    <a
                      href={`tel:${ph}`}
                      className="p-1 hover:bg-white/20 rounded-md transition-colors text-emerald-100 hover:text-white"
                      title="اتصال هاتفي"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${ph.replace(/[^\d+]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-white/20 rounded-md transition-colors text-emerald-100 hover:text-white"
                      title="مراسلة واتساب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              ) : (
                <span className="text-emerald-200 text-xs italic">لا يوجد رقم هاتف مسجل</span>
              )}
            </div>

            {/* Currency selector */}
            <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-xl border border-white/20">
              {(['RY', 'SAR', 'USD'] as Currency[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDisplayCurrency(c)}
                  className={cn(
                    'px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer',
                    displayCurrency === c
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  )}
                >
                  {c === 'RY' ? 'ريال يمني' : c === 'SAR' ? 'سعودي' : 'دولار'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Key Financial Summary Cards (Clean, High Contrast, Optimized for Note 20 Ultra) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Cost */}
            <div className="bg-blue-500/12 border border-blue-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                إجمالي التكلفة
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-slate-950">
                  {formatAmount(financials.totalOverallCostUSD, displayCurrency, exchangeRates)}
                </span>
                <span className="text-[10px] font-bold text-slate-600 mr-1">{displayCurrency}</span>
              </div>
              <span className="text-[9px] text-blue-600/80 mt-0.5 font-medium">مهام ومشتريات</span>
            </div>

            {/* Total Paid */}
            <div className="bg-emerald-500/12 border border-emerald-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                المسدد والواصل
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-slate-950">
                  {formatAmount(financials.totalOverallPaidUSD, displayCurrency, exchangeRates)}
                </span>
                <span className="text-[10px] font-bold text-slate-600 mr-1">{displayCurrency}</span>
              </div>
              <span className="text-[9px] text-emerald-600/80 mt-0.5 font-medium">سندات وعرابين</span>
            </div>

            {/* Remaining Balance */}
            <div
              className={cn(
                'rounded-2xl p-3 flex flex-col justify-between border',
                financials.netDuesUSD > 0.01
                  ? 'bg-red-500/20 border-red-300/80 text-slate-950 shadow-xs'
                  : financials.netDuesUSD < -0.01
                  ? 'bg-blue-500/12 border-blue-200/80 text-slate-950'
                  : 'bg-emerald-500/12 border-emerald-200/80 text-slate-950'
              )}
            >
              <span className="text-[11px] font-bold flex items-center gap-1">
                {financials.netDuesUSD > 0.01 ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {financials.netDuesUSD > 0.01
                  ? 'المتبقي بذمته'
                  : financials.netDuesUSD < -0.01
                  ? 'فائض له'
                  : 'الرصيد المتبقي'}
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-slate-950">
                  {formatAmount(Math.abs(financials.netDuesUSD), displayCurrency, exchangeRates)}
                </span>
                <span className="text-[10px] font-bold opacity-70 mr-1">{displayCurrency}</span>
              </div>
              <span className="text-[9px] font-bold opacity-80 mt-0.5">
                {financials.netDuesUSD > 0.01 ? 'ذمة مستحقة للسداد' : 'خالص تماماً'}
              </span>
            </div>

            {/* Total Records */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                إجمالي العمليات
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-slate-800">
                  {financials.tasksCount + financials.transactionsCount}
                </span>
                <span className="text-[10px] font-bold text-slate-400 mr-1">عملية</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium">
                {financials.unpaidCount > 0 ? `${financials.unpaidCount} غير مسددة` : 'كلها مسددة'}
              </span>
            </div>
          </div>

          {/* Quick Action Tools Bar */}
          <div className="flex items-center gap-2 flex-wrap bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200">
            {/* Add Payment / Income */}
            {onAddTransaction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddTransaction('income', customerName);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                title="تسجيل سند قبض أو إيراد من العميل"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>سند قبض جديد</span>
              </button>
            )}

            {/* Add Expense */}
            {onAddTransaction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddTransaction('expense', customerName);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                title="تسجيل سند صرف أو تكلفة على العميل"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>سند صرف</span>
              </button>
            )}

            {/* View All Customer Tasks */}
            {onViewAllCustomerTasks && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewAllCustomerTasks(customerName);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                title="عرض جميع مهام العميل في قائمة المهام"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>كل مهام العميل</span>
              </button>
            )}

            {/* Open in General Accounts Page */}
            {onNavigateToAccounts && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAccounts(customerName);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                title="الانتقال لشاشة الحسابات العامة مصفاة للعميل"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>فتح بالحسابات العامة</span>
              </button>
            )}

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              title="مشاركة كشف الحساب المنسق عبر الواتساب"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>مشاركة واتساب</span>
            </button>

            {/* Copy Statement Text */}
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
              title="نسخ نص كشف الحساب الكامل"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'تم النسخ' : 'نسخ الكشف'}</span>
            </button>

            {/* Export Toolbar (PDF / JPG / Copy) */}
            <ExportToolbar
              targetElementId={`customer-financial-account-${normalizedTarget}`}
              filenamePrefix={`كشف_حساب_${customerName.replace(/\s+/g, '_')}`}
              title={`كشف حساب العميل: ${customerName}`}
              getTextToCopy={generateAccountReportText}
              size="xs"
              compact={true}
            />
          </div>

          {/* Search and Tabs Bar */}
          <div className="space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="بحث في عمليات كشف الحساب (بالجهاز، البيان، التاريخ، السند)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-800"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: `الكل (${unifiedItems.length})` },
                { id: 'tasks', label: `المهام والفواتير (${customerTasks.length})` },
                { id: 'deposits', label: `سندات القبض والدفعات` },
                { id: 'transactions', label: `المعاملات المالية (${customerTransactions.length})` },
                {
                  id: 'unpaid',
                  label: `غير المسددة (${financials.unpaidCount})`,
                  color: financials.unpaidCount > 0 ? 'text-red-700 bg-red-50 border-red-200' : ''
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer border text-xs',
                    activeTab === tab.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : tab.color || 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unified Ledger Feed */}
          <div className="space-y-2">
            {filteredFeed.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">لا توجد حركات مالية مطابقة</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {searchQuery ? 'جرب البحث بكلمة أخرى أو تغيير التبويب المختار' : 'لم يتم تسجيل أي عمليات مالية لهذا العميل حتى الآن'}
                </p>
              </div>
            ) : (
              filteredFeed.map(item => {
                const formattedDate = new Date(item.date).toLocaleDateString('ar-SA', {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric'
                });
                const formattedTime = new Date(item.date).toLocaleTimeString('ar-SA', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const isTask = item.type === 'task' && item.rawTask;
                const isTransaction = item.type === 'transaction' && item.rawTransaction;
                const isDeposit = item.type === 'deposit';

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-3.5 rounded-2xl border bg-white transition-all shadow-2xs flex flex-col gap-2 relative group hover:border-emerald-300',
                      isTask && (item.balanceUSD || 0) > 0.01 ? 'border-red-200/80 bg-red-50/10' : 'border-slate-200/90'
                    )}
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            item.badgeColor
                          )}
                        >
                          {item.badgeText}
                        </span>

                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{item.title}</h4>

                        {isTask && item.rawTask?.status && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {item.rawTask.status === 'completed'
                              ? 'مكتملة ومسلمة'
                              : item.rawTask.status === 'ready-to-deliver'
                              ? 'جاهزة للتسليم'
                              : item.rawTask.status === 'in-progress'
                              ? 'قيد الصيانة'
                              : item.rawTask.status === 'pending'
                              ? 'في الانتظار'
                              : item.rawTask.status}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-medium text-slate-400 shrink-0 font-mono">
                        {formattedDate} {formattedTime}
                      </span>
                    </div>

                    {/* Subtitle / Description */}
                    {item.subTitle && (
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {renderColoredText ? renderColoredText(item.subTitle) : item.subTitle}
                      </p>
                    )}

                    {/* Financial Numbers & Actions Row */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-3 flex-wrap font-bold">
                        {isTask ? (
                          <>
                            <span className="text-blue-700">
                              التكلفة:{' '}
                              <span className="text-blue-600 font-black">
                                {formatAmount(item.amountUSD, displayCurrency, exchangeRates)}
                              </span>
                            </span>

                            <span className="text-emerald-700">
                              الواصل:{' '}
                              <span className="text-emerald-600 font-black">
                                {formatAmount(item.paidUSD || 0, displayCurrency, exchangeRates)}
                              </span>
                            </span>

                            {(item.balanceUSD || 0) > 0.01 ? (
                              <span className="text-slate-950 font-black bg-red-500/20 px-2 py-0.5 rounded-lg border border-red-300/80">
                                المتبقي: {formatAmount(item.balanceUSD || 0, displayCurrency, exchangeRates)} {displayCurrency}
                              </span>
                            ) : (
                              <span className="text-emerald-600 text-[11px] font-bold">مصفى وخالص ✓</span>
                            )}
                          </>
                        ) : (
                          <span className={item.type === 'deposit' ? 'text-emerald-700' : 'text-slate-800'}>
                            المبلغ:{' '}
                            <span className="font-black">
                              {formatAmount(item.amountUSD, displayCurrency, exchangeRates)} {displayCurrency}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Interactive Buttons for this item */}
                      <div className="flex items-center gap-1.5">
                        {/* Quick Add Payment to Task if balance > 0 */}
                        {isTask && (item.balanceUSD || 0) > 0.01 && onAddPaymentToTask && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onAddPaymentToTask(item.rawTask!);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="إضافة دفعة وسداد لهذه المهمة"
                          >
                            + إضافة دفعة
                          </button>
                        )}

                        {/* Edit Task / View Task */}
                        {isTask && onEditTask && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditTask(item.rawTask!);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                            title="تعديل وتفاصيل المهمة"
                          >
                            عرض المهمة
                          </button>
                        )}

                        {/* Edit Transaction */}
                        {isTransaction && onEditTransaction && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditTransaction(item.rawTransaction!);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                            title="تعديل المعاملة المالية"
                          >
                            تعديل السند
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-semibold text-[11px]">
            <span>إجمالي الذمة المستحقة:</span>
            <span
              className={cn(
                'font-black',
                financials.netDuesUSD > 0.01 ? 'text-red-600 text-sm' : 'text-emerald-700'
              )}
            >
              {formatAmount(Math.abs(financials.netDuesUSD), displayCurrency, exchangeRates)} {displayCurrency}
            </span>
            {financials.netDuesUSD > 0.01 && <span className="text-[10px] text-red-500">(مطلوبة من العميل)</span>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer active:scale-95 text-xs"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
export default CustomerFinancialAccountModal;
