import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Wallet, 
  Receipt, 
  Package, 
  Users, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Phone, 
  MessageCircle, 
  Coins, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Eye,
  FileText
} from 'lucide-react';
import { Task, Customer, InventoryItem, Transaction, CashAccount, DebtAccount } from '../types';

interface QuickDataInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  customers: Customer[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  cashAccounts: CashAccount[];
  debtAccounts: DebtAccount[];
  systemCurrency: string;
  onOpenTask?: (taskId: number) => void;
  onOpenCustomer?: (customerName: string) => void;
}

export const QuickDataInspectorModal: React.FC<QuickDataInspectorModalProps> = ({
  isOpen,
  onClose,
  tasks = [],
  customers = [],
  inventory = [],
  transactions = [],
  cashAccounts = [],
  debtAccounts = [],
  systemCurrency = 'RY',
  onOpenTask,
  onOpenCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'financial' | 'transactions' | 'inventory' | 'customers'>('financial');
  const [searchQuery, setSearchQuery] = useState('');
  const [transTypeFilter, setTransTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [transDateFilter, setTransDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low'>('all');

  // 1. Calculate Financial Center Metrics
  const financialMetrics = useMemo(() => {
    // Total cash liquidity across vaults/cashboxes
    const totalCash = cashAccounts.length > 0 
      ? cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      : transactions.reduce((sum, t) => sum + (t.type === 'income' ? (t.amount || 0) : -(t.amount || 0)), 0);

    // Total Inventory Value
    const totalInventoryValue = inventory.reduce((sum, item) => sum + ((item.costPrice || item.sellingPrice || 0) * (item.stock || 0)), 0);

    // Total Customer Receivables (Dues)
    let customerReceivables = 0;
    tasks.forEach(t => {
      const cost = t.cost || 0;
      const deposit = (t.depositHistory && t.depositHistory.length > 0)
        ? t.depositHistory.reduce((acc, cur) => acc + (cur.amount || 0), 0)
        : (t.deposit || 0);
      const remaining = cost - deposit;
      if (remaining > 0 && t.status !== 'ملغية') {
        customerReceivables += remaining;
      }
    });

    // Total Supplier Debts (Liabilities)
    const supplierLiabilities = debtAccounts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);

    // Assets & Net Worth
    const totalAssets = totalCash + totalInventoryValue + customerReceivables;
    const netWorth = totalAssets - supplierLiabilities;

    return {
      totalCash,
      totalInventoryValue,
      customerReceivables,
      supplierLiabilities,
      totalAssets,
      netWorth
    };
  }, [cashAccounts, inventory, tasks, debtAccounts, transactions]);

  // 2. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return transactions.filter(t => {
      // Type Filter
      if (transTypeFilter !== 'all' && t.type !== transTypeFilter) return false;

      // Date Filter
      if (transDateFilter === 'today') {
        if (!t.date || !t.date.startsWith(todayStr)) return false;
      } else if (transDateFilter === 'week') {
        if (!t.date) return false;
        const diffMs = now.getTime() - new Date(t.date).getTime();
        if (diffMs > 7 * 24 * 3600 * 1000) return false;
      } else if (transDateFilter === 'month') {
        if (!t.date) return false;
        const diffMs = now.getTime() - new Date(t.date).getTime();
        if (diffMs > 30 * 24 * 3600 * 1000) return false;
      }

      // Search Query
      if (q) {
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const custMatch = (t.customerName || '').toLowerCase().includes(q);
        const catMatch = (t.category || '').toLowerCase().includes(q);
        const amtMatch = String(t.amount || '').includes(q);
        if (!descMatch && !custMatch && !catMatch && !amtMatch) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [transactions, searchQuery, transTypeFilter, transDateFilter]);

  // Transaction Totals
  const transTotals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  // 3. Filtered Inventory
  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.filter(item => {
      if (stockFilter === 'low' && (item.stock || 0) > (item.minStock || 2)) return false;
      if (q) {
        const nameMatch = (item.name || '').toLowerCase().includes(q);
        const catMatch = (item.category || '').toLowerCase().includes(q);
        const codeMatch = (item.code || '').toLowerCase().includes(q);
        if (!nameMatch && !catMatch && !codeMatch) return false;
      }
      return true;
    });
  }, [inventory, searchQuery, stockFilter]);

  // 4. Filtered Customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.map(c => {
      const custTasks = tasks.filter(t => t.customer && t.customer.toLowerCase().trim() === c.name.toLowerCase().trim());
      let custDebt = 0;
      custTasks.forEach(t => {
        const cost = t.cost || 0;
        const deposit = (t.depositHistory && t.depositHistory.length > 0)
          ? t.depositHistory.reduce((acc, cur) => acc + (cur.amount || 0), 0)
          : (t.deposit || 0);
        const rem = cost - deposit;
        if (rem > 0 && t.status !== 'ملغية') custDebt += rem;
      });

      return {
        ...c,
        activeTasksCount: custTasks.filter(t => t.status !== 'مكتملة' && t.status !== 'ملغية').length,
        totalDebt: custDebt
      };
    }).filter(c => {
      if (!q) return true;
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').includes(q);
      const addressMatch = (c.address || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || addressMatch;
    });
  }, [customers, tasks, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 dir-rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col transition-all">
        
        {/* Header Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl text-slate-950 shadow-md">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white leading-tight">المعاين والباحث الذكي الشامل ⚡</h2>
              <p className="text-[10.5px] font-bold text-amber-300">معاينة استكشافية سريعة للمركز المالي، الحركات، المستودع والعملاء</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-all cursor-pointer active:scale-95"
            title="إغلاق المعاين"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Switcher Bar */}
        <div className="p-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === 'financial'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>المركز المالي والأصول</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === 'transactions'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>كشف المعاملات والعمليات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === 'inventory'
                ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>المخزن وقطع الغيار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>دليل العملاء والأرقام</span>
          </button>
        </div>

        {/* Global Instant Search Bar */}
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-indigo-500" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث وتصفية فورية في المعاين... (اسم، مبلغ، هاتف، صنف، بيان)"
              dir="rtl"
              className="w-full pr-10 pl-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-0 top-0 bottom-0 h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold rounded-l-2xl"
                title="مسح النص وإلغاء المدخلات بنقرة واحدة"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            ) : null}
          </div>
        </div>

        {/* TAB 1: FINANCIAL CENTER & ASSETS */}
        {activeTab === 'financial' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Top Key Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">صافي رأس المال</span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 block truncate dir-ltr">
                  {Number(financialMetrics.netWorth).toLocaleString()} {systemCurrency}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">إجمالي الأصول</span>
                <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 block truncate dir-ltr">
                  {Number(financialMetrics.totalAssets).toLocaleString()} {systemCurrency}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-blue-300 dark:border-blue-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">السيولة النقدية</span>
                <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 block truncate dir-ltr">
                  {Number(financialMetrics.totalCash).toLocaleString()} {systemCurrency}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-teal-300 dark:border-teal-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">رأس مال المخزون</span>
                <span className="text-sm sm:text-base font-black text-teal-600 dark:text-teal-400 block truncate dir-ltr">
                  {Number(financialMetrics.totalInventoryValue).toLocaleString()} {systemCurrency}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">مستحقات العملاء (لنا)</span>
                <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 block truncate dir-ltr">
                  {Number(financialMetrics.customerReceivables).toLocaleString()} {systemCurrency}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 border-2 border-rose-300 dark:border-rose-700 rounded-2xl shadow-xs space-y-1">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">ديون الموردين (علينا)</span>
                <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 block truncate dir-ltr">
                  {Number(financialMetrics.supplierLiabilities).toLocaleString()} {systemCurrency}
                </span>
              </div>
            </div>

            {/* Cash Accounts & Vaults Grid */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>أرصدة الصناديق والحسابات النقدية الخزائن ({cashAccounts.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cashAccounts.map(acc => (
                  <div key={acc.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">{acc.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        {acc.type === 'vault' ? 'خزينة رئيسية' : acc.type === 'bank' ? 'حساب بنكي' : acc.type === 'wallet' ? 'محفظة إلكترونية' : 'صندوق نقدي'}
                      </div>
                    </div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 dir-ltr">
                      {Number(acc.balance || 0).toLocaleString()} {acc.currency || systemCurrency}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Creditor Debts */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>ديون الموردين والممولين القائمة ({debtAccounts.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {debtAccounts.map(debt => {
                  const remaining = Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
                  return (
                    <div key={debt.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">{debt.creditorName || debt.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{debt.purpose || 'التزام توريد'}</div>
                      </div>
                      <div className="text-sm font-black text-rose-600 dark:text-rose-400 dir-ltr">
                        {Number(remaining).toLocaleString()} {debt.currency || systemCurrency}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS LOG */}
        {activeTab === 'transactions' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-colors ${transTypeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setTransTypeFilter('income')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-colors ${transTypeFilter === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  إيرادات 📥
                </button>
                <button
                  type="button"
                  onClick={() => setTransTypeFilter('expense')}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-colors ${transTypeFilter === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  مصروفات 📤
                </button>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransDateFilter('all')}
                  className={`px-2 py-1 rounded-lg font-black text-[11px] ${transDateFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  كافة الفترات
                </button>
                <button
                  type="button"
                  onClick={() => setTransDateFilter('today')}
                  className={`px-2 py-1 rounded-lg font-black text-[11px] ${transDateFilter === 'today' ? 'bg-slate-800 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setTransDateFilter('week')}
                  className={`px-2 py-1 rounded-lg font-black text-[11px] ${transDateFilter === 'week' ? 'bg-slate-800 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  الأسبوع
                </button>
              </div>

              {/* Summary Totals */}
              <div className="flex items-center gap-3 text-xs font-black">
                <span className="text-emerald-600">مقادير المقبوضات: {Number(transTotals.income).toLocaleString()}</span>
                <span className="text-rose-600">إجمالي المصروفات: {Number(transTotals.expense).toLocaleString()}</span>
                <span className="text-indigo-600">الصافي: {Number(transTotals.net).toLocaleString()}</span>
              </div>
            </div>

            {/* Transactions Table/List */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold text-xs">لا توجد أي معاملات مطابقة لخيارات البحث</div>
              ) : (
                filteredTransactions.slice(0, 100).map(t => (
                  <div key={t.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl text-white shrink-0 ${t.type === 'income' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        {t.type === 'income' ? <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" /> : <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 dark:text-white truncate">
                          {t.description || (t.type === 'income' ? 'إيراد صيانة' : 'مصروف عام')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2 flex-wrap">
                          {t.customerName && <span>العميل: {t.customerName}</span>}
                          {t.category && <span>· التصنيف: {t.category}</span>}
                          <span>· {new Date(t.date || 0).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`font-black text-sm dir-ltr shrink-0 ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {t.type === 'income' ? '+' : '-'}{Number(t.amount || 0).toLocaleString()} {t.currency || systemCurrency}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INVENTORY & SPARE PARTS */}
        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Filter Toggle */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-700 dark:text-slate-200">إجمالي الأصناف: ({filteredInventory.length})</span>
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === 'all' ? 'low' : 'all')}
                  className={`px-3 py-1 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                    stockFilter === 'low' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {stockFilter === 'low' ? 'عرض الأصناف المنخفضة فقط ⚠️' : 'تصفية الأصناف القاربة على النفاد'}
                </button>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInventory.map(item => {
                const isLow = (item.stock || 0) <= (item.minStock || 2);
                return (
                  <div key={item.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-xs text-slate-900 dark:text-white">{item.name}</h4>
                        <span className="text-[10px] text-slate-500 font-bold block">{item.category || 'قطع غيار'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isLow ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-emerald-100 text-emerald-700'}`}>
                        الكمية: {item.stock || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700/80 font-bold">
                      <span className="text-slate-600 dark:text-slate-400">سعر البيع: <strong className="text-emerald-600 dark:text-emerald-400">{Number(item.sellingPrice || 0).toLocaleString()} {systemCurrency}</strong></span>
                      <span className="text-slate-500">التكلفة: {Number(item.costPrice || 0).toLocaleString()} {systemCurrency}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMERS & DIRECTORY */}
        {activeTab === 'customers' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-xs font-black text-slate-700 dark:text-slate-200 px-1">
              إجمالي العملاء المسجلين: ({filteredCustomers.length})
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCustomers.map(cust => (
                <div key={cust.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-black text-xs text-slate-900 dark:text-white">{cust.name}</h4>
                      {cust.phone ? (
                        <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5 dir-ltr">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{cust.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">بدون رقم هاتف</span>
                      )}
                    </div>

                    {cust.totalDebt > 0 && (
                      <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                        دين: {Number(cust.totalDebt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/80 text-xs">
                    <div className="text-[10px] font-bold text-slate-500">
                      مهام صيانة نشطة: {cust.activeTasksCount}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {cust.phone && (
                        <>
                          <a
                            href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors"
                            title="مراسلة واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`tel:${cust.phone}`}
                            className="p-1.5 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                            title="اتصال هاتفي"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
