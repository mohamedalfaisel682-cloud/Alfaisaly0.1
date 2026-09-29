import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Building2, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Eye, 
  BarChart3, 
  Layers, 
  Sparkles,
  Phone,
  Calendar,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Task, Customer, InventoryItem, Transaction, CashAccount, DebtAccount } from '../types';

interface OmniQuickPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  customers: Customer[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  cashAccounts: CashAccount[];
  debtAccounts: DebtAccount[];
  onSelectTask?: (taskId: number) => void;
  onSelectCustomer?: (customerName: string) => void;
  onSelectInventoryItem?: (itemId: number) => void;
}

type TabType = 'financial_center' | 'assets' | 'transactions' | 'inventory' | 'customers';

export const OmniQuickPreviewModal: React.FC<OmniQuickPreviewModalProps> = ({
  isOpen,
  onClose,
  tasks = [],
  customers = [],
  inventory = [],
  transactions = [],
  cashAccounts = [],
  debtAccounts = [],
  onSelectTask,
  onSelectCustomer,
  onSelectInventoryItem
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('financial_center');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate Financial Center Metrics
  const financialMetrics = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const boxBalance = totalIncome - totalExpense;

    const totalCashLiquidity = cashAccounts.length > 0 
      ? cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      : boxBalance;

    const totalInventoryValue = inventory.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.stock || 0)), 0);

    let customerDues = 0;
    tasks.forEach(t => {
      const cost = t.cost || 0;
      const deposit = (t.depositHistory && t.depositHistory.length > 0)
        ? t.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
        : (t.deposit || 0);
      const remaining = cost - deposit;
      if (remaining > 0 && t.status !== 'ملغية') customerDues += remaining;
    });

    const totalAssets = totalCashLiquidity + totalInventoryValue + customerDues;
    const totalLiabilities = debtAccounts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    const netWorth = totalAssets - totalLiabilities;

    return {
      totalIncome,
      totalExpense,
      boxBalance,
      totalCashLiquidity,
      totalInventoryValue,
      customerDues,
      totalAssets,
      totalLiabilities,
      netWorth
    };
  }, [transactions, cashAccounts, inventory, tasks, debtAccounts]);

  // Filtered lists based on search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return transactions.filter(t => 
      (t.description || '').toLowerCase().includes(q) ||
      (t.customerName || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      String(t.amount || '').includes(q)
    ).slice(0, 50);
  }, [transactions, searchQuery]);

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const q = searchQuery.toLowerCase();
    return inventory.filter(i => 
      (i.name || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.code || '').toLowerCase().includes(q)
    );
  }, [inventory, searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[98000] bg-slate-950/70 backdrop-blur-md flex flex-col justify-end sm:justify-center sm:p-4 animate-in fade-in duration-200 dir-rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right">
        
        {/* Header Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl text-slate-950 shadow-md">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                اللمحة الشاملة والمعاينة الخاطفة للبيانات
              </h3>
              <p className="text-[10.5px] text-slate-400 font-bold">
                معاينة فورية وسريعة لكل أركان المركز المالي والأصول والمخزن والعملاء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Live Search Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث خاطف وسريع عبر كل الحسابات والعملاء والمخزن والمعاملات..."
              className="w-full pr-10 pl-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs placeholder-slate-400"
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

        {/* Navigation Tab Chips */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none shrink-0 px-3">
          {[
            { id: 'financial_center', label: 'المركز المالي', icon: Building2 },
            { id: 'assets', label: 'الأصول والسيولة', icon: Wallet },
            { id: 'transactions', label: 'كشف المعاملات', icon: Layers },
            { id: 'inventory', label: 'المستودع والمخزن', icon: Package },
            { id: 'customers', label: 'العملاء والديون', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-[1.02]"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          
          {/* TAB 1: FINANCIAL CENTER */}
          {activeTab === 'financial_center' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Big KPI Net Worth Card */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    مؤشر صافي رأس المال والمركز المالي الشامل
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black">
                    محدث حياً
                  </span>
                </div>

                <div className="relative z-10 mb-4">
                  <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {financialMetrics.netWorth.toLocaleString()} <span className="text-sm font-bold text-emerald-400">ريال يمني</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-1">
                    صافي القيمة الكلية للمشروع (إجمالي الأصول مطروحاً منها كافة التزامات الموردين)
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-indigo-500/20 text-right relative z-10">
                  <div className="bg-indigo-900/40 p-2.5 rounded-2xl border border-indigo-400/20">
                    <span className="text-[10px] text-indigo-200 block font-bold">إجمالي الأصول</span>
                    <span className="text-xs font-black text-white">{financialMetrics.totalAssets.toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-emerald-900/40 p-2.5 rounded-2xl border border-emerald-400/20">
                    <span className="text-[10px] text-emerald-200 block font-bold">السيولة النقدية</span>
                    <span className="text-xs font-black text-emerald-300">{financialMetrics.totalCashLiquidity.toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-amber-900/40 p-2.5 rounded-2xl border border-amber-400/20">
                    <span className="text-[10px] text-amber-200 block font-bold">رأس مال المخزون</span>
                    <span className="text-xs font-black text-amber-300">{financialMetrics.totalInventoryValue.toLocaleString()} ريال</span>
                  </div>
                  <div className="bg-purple-900/40 p-2.5 rounded-2xl border border-purple-400/20">
                    <span className="text-[10px] text-purple-200 block font-bold">مستحقات العملاء</span>
                    <span className="text-xs font-black text-purple-300">{financialMetrics.customerDues.toLocaleString()} ريال</span>
                  </div>
                </div>
              </div>

              {/* Income vs Expense Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> إجمالي المقبوضات والإيرادات
                    </span>
                    <div className="text-lg font-black text-emerald-900 dark:text-emerald-200">
                      {financialMetrics.totalIncome.toLocaleString()} ريال
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-black text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4 text-rose-600" /> إجمالي المصروفات والنفقات
                    </span>
                    <div className="text-lg font-black text-rose-900 dark:text-rose-200">
                      {financialMetrics.totalExpense.toLocaleString()} ريال
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ASSETS & LIQUIDITY */}
          {activeTab === 'assets' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                أرصدة الخزائن والصناديق والحسابات النقدية المسجلة ({cashAccounts.length})
              </div>

              {cashAccounts.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  الصندوق الرئيسي العام: {financialMetrics.boxBalance.toLocaleString()} ريال يمني
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cashAccounts.map(acc => (
                    <div key={acc.id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-black text-xs text-slate-900 dark:text-white">{acc.name}</h5>
                          <span className="text-[10px] text-slate-500 font-bold">{acc.type === 'vault' ? 'خزينة' : acc.type === 'bank' ? 'حساب بنكي' : 'صندوق نقدي'}</span>
                        </div>
                      </div>
                      <div className="text-left font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {Number(acc.balance || 0).toLocaleString()} <span className="text-[10px] text-slate-400">{acc.currency || 'RY'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Debt Accounts / Liabilities */}
              {debtAccounts.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block px-1">
                    ديون والتزامات الموردين والممولين ({debtAccounts.length})
                  </span>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    {debtAccounts.map(d => {
                      const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
                      return (
                        <div key={d.id} className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-black text-slate-900 dark:text-white">{d.creditorName || d.name}</span>
                            <span className="text-[10px] text-slate-400 block">{d.purpose || 'التزام توريد'}</span>
                          </div>
                          <span className="font-black text-rose-600 dark:text-rose-400">{rem.toLocaleString()} {d.currency || 'RY'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSACTIONS LEDGER */}
          {activeTab === 'transactions' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                <span>سجل المعاملات والقيود المالية الأخيرة ({filteredTransactions.length})</span>
                <span className="text-[10px] text-indigo-600">معاينة فورية</span>
              </div>

              <div className="space-y-2">
                {filteredTransactions.map((t, idx) => {
                  const isInc = t.type === 'income';
                  return (
                    <div 
                      key={t.id || idx}
                      className="p-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl shadow-2xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={cn(
                          "p-2 rounded-xl shrink-0",
                          isInc ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600" : "bg-rose-50 dark:bg-rose-900/40 text-rose-600"
                        )}>
                          {isInc ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">{t.description || 'معاملة مالية'}</h5>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{t.customerName ? `العميل: ${t.customerName}` : (t.category || 'عام')}</span>
                            <span>•</span>
                            <span>{t.date ? new Date(t.date).toLocaleDateString('ar-YE') : ''}</span>
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        "font-black text-xs shrink-0 text-left",
                        isInc ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {isInc ? '+' : '-'}{Number(t.amount || 0).toLocaleString()} {t.currency || 'RY'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY & STOCK */}
          {activeTab === 'inventory' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                <span>أصناف المستودع وقطع الغيار ({filteredInventory.length})</span>
                <span className="text-[10px] text-emerald-600">إجمالي الأصناف</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredInventory.map((item, idx) => {
                  const isLow = (item.stock || 0) <= (item.minStock || 2);
                  return (
                    <div 
                      key={item.id || idx}
                      onClick={() => {
                        if (item.id && onSelectInventoryItem) {
                          onSelectInventoryItem(item.id);
                          onClose();
                        }
                      }}
                      className={cn(
                        "p-3.5 bg-white dark:bg-slate-800 border rounded-2xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-400 transition-all",
                        isLow ? "border-amber-300 dark:border-amber-800 bg-amber-50/20" : "border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "p-2 rounded-xl shrink-0",
                          isLow ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" : "bg-purple-50 dark:bg-purple-900/40 text-purple-600"
                        )}>
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            {item.name}
                            {isLow && <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-black">منخفض</span>}
                          </h5>
                          <span className="text-[10px] text-slate-400 block">{item.category || 'قطع غيار'} • كود: {item.code || '-'}</span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="font-black text-xs text-slate-900 dark:text-white">
                          {Number(item.sellingPrice || 0).toLocaleString()} <span className="text-[9px] text-slate-400">ريال</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 block">المتاح: {item.stock || 0} قطعة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOMERS & RECEIVABLES */}
          {activeTab === 'customers' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                <span>دليل العملاء والحسابات ({filteredCustomers.length})</span>
                <span className="text-[10px] text-indigo-600">معاينة مباشرة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredCustomers.map((cust, idx) => {
                  const custTasks = tasks.filter(t => t.customer && t.customer.toLowerCase() === (cust.name || '').toLowerCase());
                  let totalDues = 0;
                  custTasks.forEach(t => {
                    const cost = t.cost || 0;
                    const deposit = (t.depositHistory && t.depositHistory.length > 0)
                      ? t.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
                      : (t.deposit || 0);
                    const rem = cost - deposit;
                    if (rem > 0 && t.status !== 'ملغية') totalDues += rem;
                  });

                  return (
                    <div 
                      key={cust.id || idx}
                      onClick={() => {
                        if (cust.name && onSelectCustomer) {
                          onSelectCustomer(cust.name);
                          onClose();
                        }
                      }}
                      className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-indigo-400 transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white">{cust.name}</h5>
                          <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {cust.phone || 'بدون رقم هاتف'}
                          </span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        {totalDues > 0 ? (
                          <div className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-[10.5px] font-black text-rose-600 dark:text-rose-400">
                            متبقي: {totalDues.toLocaleString()} ريال
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                            الحساب مكتمل 🟢
                          </span>
                        )}
                        <span className="text-[9.5px] text-slate-400 block text-center mt-0.5">{custTasks.length} أجهزة صيانة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
            تطبيق الفيصل للصيانة • المعاينة الخاطفة
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق المعاينة
          </button>
        </div>

      </div>
    </div>
  );
};
