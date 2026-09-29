import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer, CashAccount, InventoryItem, Transaction, Currency, ExchangeRates } from '../types';
import { Search, X, User, Building2, Wallet, ChevronRight, Package, StickyNote, CreditCard, ArrowDownLeft, ArrowUpRight, ArrowDownAZ, Clock, Landmark, BookmarkCheck } from 'lucide-react';
import { cn, formatAmount } from '../lib/utils';
import { VoiceInputButton } from './VoiceInputButton';

export interface FinancialMetricItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  currency: Currency;
  description: string;
  targetTab?: 'financials' | 'treasury' | 'debts';
  updatedAt?: string;
  createdAt?: string;
}

export interface GlobalReportsAccountsSearchProps {
  context: 'reports' | 'accounts';
  customers: Customer[];
  cashAccounts: CashAccount[];
  inventory: InventoryItem[];
  notes?: any[];
  transactions: Transaction[];
  financialMetrics?: FinancialMetricItem[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  onSelectCustomer?: (customer: Customer) => void;
  onSelectAccount?: (account: CashAccount) => void;
  onSelectFinancialMetric?: (metric: FinancialMetricItem) => void;
  onSelectInventory?: (item: InventoryItem) => void;
  onSelectNote?: (note: any) => void;
  onSelectTransaction?: (transaction: Transaction) => void;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export const GlobalReportsAccountsSearch: React.FC<GlobalReportsAccountsSearchProps> = ({
  context,
  customers = [],
  cashAccounts = [],
  inventory = [],
  notes = [],
  transactions = [],
  financialMetrics = [],
  systemCurrency,
  exchangeRates,
  onSelectCustomer,
  onSelectAccount,
  onSelectFinancialMetric,
  onSelectInventory,
  onSelectNote,
  onSelectTransaction,
  onQueryChange,
  placeholder,
  className
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'latest'>(() => {
    return (localStorage.getItem('global_search_sort_default') as any) || 'name';
  });
  const [activeCategory, setActiveCategory] = useState<'all' | 'customer' | 'account' | 'financial_center' | 'inventory' | 'note' | 'transaction'>(() => {
    return (localStorage.getItem('global_search_category_default') as any) || 'all';
  });
  const [savedSearchDefaultFeedback, setSavedSearchDefaultFeedback] = useState(false);

  const handleSaveSearchDefault = () => {
    localStorage.setItem('global_search_sort_default', sortBy);
    localStorage.setItem('global_search_category_default', activeCategory);
    setSavedSearchDefaultFeedback(true);
    setTimeout(() => setSavedSearchDefaultFeedback(false), 2200);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAccountsContext = context === 'accounts';

  // Accounts pool: Hide daily vault and savings vault when in accounts context
  const safeAccounts = useMemo(() => {
    if (isAccountsContext) {
      return cashAccounts.filter(a => {
        const name = (a.name || '').toLowerCase();
        const notes = (a.notes || '').toLowerCase();
        const isDaily = name.includes('يومي') || name.includes('يومية') || notes.includes('يومي');
        const isSavings = name.includes('ادخار') || name.includes('ادخارية') || name.includes('احتياط') || notes.includes('ادخار');
        return !(isDaily || isSavings);
      });
    }
    return cashAccounts;
  }, [cashAccounts, isAccountsContext]);

  // Notes pool: Hide notes completely when in accounts context
  const safeNotes = useMemo(() => {
    return isAccountsContext ? [] : notes;
  }, [notes, isAccountsContext]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();

  // Helper sorting function: alphabetical by name OR by latest added/modified
  const sortItems = <T extends any>(items: T[], getName: (item: T) => string, getDate: (item: T) => any): T[] => {
    return [...items].sort((a, b) => {
      if (sortBy === 'name') {
        return getName(a).localeCompare(getName(b), 'ar');
      } else {
        const dateA = new Date(getDate(a) || 0).getTime();
        const dateB = new Date(getDate(b) || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return ((b as any).id || 0) - ((a as any).id || 0);
      }
    });
  };

  // Search Results grouped by priority and sorted
  const results = useMemo(() => {
    if (!trimmed) {
      const sortedCust = sortItems(customers, c => c.name || '', c => (c as any).updatedAt || c.createdAt);
      const sortedAcc = sortItems(safeAccounts, a => a.name || '', a => a.updatedAt || a.createdAt);
      const sortedFin = sortItems(financialMetrics, m => m.title || '', m => m.updatedAt || m.createdAt);
      const sortedInv = sortItems(inventory, i => i.name || '', i => (i as any).updatedAt || (i as any).createdAt);
      const sortedNot = sortItems(safeNotes, n => n.title || n.content || '', n => n.updatedAt || n.createdAt);
      const sortedTx = sortItems(transactions, t => t.customerName || t.description || '', t => t.date || (t as any).createdAt);

      return {
        customers: sortedCust.slice(0, 6),
        accounts: sortedAcc.slice(0, 6),
        financialMetrics: sortedFin.slice(0, 6),
        inventory: sortedInv.slice(0, 6),
        notes: sortedNot.slice(0, 4),
        transactions: sortedTx.slice(0, 6),
        totalCount: 0
      };
    }

    // 1. Priority 1: Customers (العميل)
    const matchedCustomers = sortItems(
      customers.filter(c => 
        c.name.toLowerCase().includes(trimmed) || 
        (c.phone && c.phone.includes(trimmed)) ||
        (c.classification && c.classification.toLowerCase().includes(trimmed))
      ),
      c => c.name || '',
      c => (c as any).updatedAt || c.createdAt
    ).slice(0, 8);

    // 2. Priority 2: Accounts (اسم الحساب)
    const matchedAccounts = sortItems(
      safeAccounts.filter(a => 
        a.name.toLowerCase().includes(trimmed) || 
        (a.type && a.type.toLowerCase().includes(trimmed)) ||
        (a.classification && a.classification.toLowerCase().includes(trimmed)) ||
        (a.notes && a.notes.toLowerCase().includes(trimmed))
      ),
      a => a.name || '',
      a => a.updatedAt || a.createdAt
    ).slice(0, 8);

    // 3. Priority 3: Financial Center data (المركز المالي وبياناته)
    const matchedFinancialMetrics = sortItems(
      financialMetrics.filter(m =>
        m.title.toLowerCase().includes(trimmed) ||
        m.category.toLowerCase().includes(trimmed) ||
        m.description.toLowerCase().includes(trimmed) ||
        (m.amount !== undefined && m.amount.toString().includes(trimmed))
      ),
      m => m.title || '',
      m => m.updatedAt || m.createdAt
    ).slice(0, 8);

    // Inventory & Notes for non-accounts context
    const matchedInventory = isAccountsContext ? [] : sortItems(
      inventory.filter(i => 
        i.name.toLowerCase().includes(trimmed) || 
        (i.code && i.code.toLowerCase().includes(trimmed)) ||
        (i.category && i.category.toLowerCase().includes(trimmed))
      ),
      i => i.name || '',
      i => (i as any).updatedAt || (i as any).createdAt
    ).slice(0, 8);

    const matchedNotes = isAccountsContext ? [] : sortItems(
      safeNotes.filter(n => 
        (n.title && n.title.toLowerCase().includes(trimmed)) || 
        (n.content && n.content.toLowerCase().includes(trimmed)) ||
        (n.tag && n.tag.toLowerCase().includes(trimmed))
      ),
      n => n.title || n.content || '',
      n => n.updatedAt || n.createdAt
    ).slice(0, 6);

    // Priority 4 (Accounts Context): Transactions & Financial operations (العمليات المالية)
    const matchedTransactions = sortItems(
      transactions.filter(t => 
        (t.description && t.description.toLowerCase().includes(trimmed)) ||
        (t.customerName && t.customerName.toLowerCase().includes(trimmed)) ||
        (t.category && t.category.toLowerCase().includes(trimmed)) ||
        (t.amount !== undefined && t.amount.toString().includes(trimmed)) ||
        (t.sourceAccount && t.sourceAccount.toLowerCase().includes(trimmed)) ||
        (t.destinationAccount && t.destinationAccount.toLowerCase().includes(trimmed))
      ),
      t => t.customerName || t.description || '',
      t => t.date || (t as any).createdAt
    ).slice(0, 8);

    const totalCount = isAccountsContext
      ? (matchedCustomers.length + matchedAccounts.length + matchedFinancialMetrics.length + matchedTransactions.length)
      : (matchedCustomers.length + matchedAccounts.length + matchedFinancialMetrics.length + matchedInventory.length + matchedNotes.length + matchedTransactions.length);

    return {
      customers: matchedCustomers,
      accounts: matchedAccounts,
      financialMetrics: matchedFinancialMetrics,
      inventory: matchedInventory,
      notes: matchedNotes,
      transactions: matchedTransactions,
      totalCount
    };
  }, [trimmed, customers, safeAccounts, financialMetrics, inventory, safeNotes, transactions, sortBy, isAccountsContext]);

  const defaultPlaceholder = context === 'reports'
    ? 'بحث شامل في التقارير (العميل أولاً، اسم الحساب، المركز المالي، المعاملات)...'
    : 'بحث شامل رئيسي (العميل أولاً، اسم الحساب، المركز المالي وبياناته، العمليات المالية)...';

  const handleSelectCustomer = (c: Customer) => {
    onSelectCustomer?.(c);
    setIsOpen(false);
  };

  const handleSelectAccount = (a: CashAccount) => {
    onSelectAccount?.(a);
    setIsOpen(false);
  };

  const handleSelectFinancialMetric = (m: FinancialMetricItem) => {
    onSelectFinancialMetric?.(m);
    setIsOpen(false);
  };

  const handleSelectInventory = (item: InventoryItem) => {
    onSelectInventory?.(item);
    setIsOpen(false);
  };

  const handleSelectNote = (n: any) => {
    onSelectNote?.(n);
    setIsOpen(false);
  };

  const handleSelectTransaction = (t: Transaction) => {
    onSelectTransaction?.(t);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full z-40", className)}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-emerald-600">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onQueryChange?.(val);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full pr-10 pl-24 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs sm:text-sm font-bold rounded-2xl border border-slate-200/90 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all shadow-xs"
        />

        <div className="absolute left-0 top-0 bottom-0 h-full flex items-center z-10 overflow-hidden rounded-l-2xl">
          <span className="hidden sm:inline-block px-2 text-slate-500 text-[10px] font-black">
            بحث شامل
          </span>
          <VoiceInputButton
            target="global-reports-search"
            onResult={(text) => {
              setQuery(text);
              onQueryChange?.(text);
              if (!isOpen) setIsOpen(true);
            }}
            className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg"
            buttonTitle="تحويل الكلام إلى نص"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onQueryChange?.('');
                setIsOpen(false);
                inputRef.current?.blur();
              }}
              className="h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold"
              title="مسح النص وإلغاء المدخلات بنقرة واحدة"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Results & Suggestions */}
      {isOpen && (
        <div className="absolute right-0 left-0 top-full mt-1.5 bg-white rounded-2xl border-2 border-emerald-500/80 shadow-2xl overflow-hidden max-h-[75vh] sm:max-h-[520px] flex flex-col z-[99999] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header with categories priority chips */}
          <div className="p-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 text-[11px] font-black shrink-0">
              <span className="text-slate-400">ترتيب الأولوية:</span>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={cn(
                  "px-2 py-1 rounded-lg transition-all",
                  activeCategory === 'all' 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                الكل ({trimmed ? results.totalCount : 'مقترح'})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('customer')}
                className={cn(
                  "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                  activeCategory === 'customer' 
                    ? "bg-emerald-600 text-white shadow-xs" 
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                )}
              >
                <span>1. العملاء</span>
                <span className="text-[9px] px-1 bg-emerald-200/60 rounded-full font-extrabold">{results.customers.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('account')}
                className={cn(
                  "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                  activeCategory === 'account' 
                    ? "bg-sky-600 text-white shadow-xs" 
                    : "bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                )}
              >
                <span>2. الحسابات</span>
                <span className="text-[9px] px-1 bg-sky-200/60 rounded-full font-extrabold">{results.accounts.length}</span>
              </button>
              {isAccountsContext ? (
                <button
                  type="button"
                  onClick={() => setActiveCategory('financial_center')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                    activeCategory === 'financial_center' 
                      ? "bg-amber-600 text-white shadow-xs" 
                      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  )}
                >
                  <span>3. المركز المالي</span>
                  <span className="text-[9px] px-1 bg-amber-200/60 rounded-full font-extrabold">{results.financialMetrics.length}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveCategory('inventory')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                    activeCategory === 'inventory' 
                      ? "bg-amber-600 text-white shadow-xs" 
                      : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                  )}
                >
                  <span>3. المخزون</span>
                  <span className="text-[9px] px-1 bg-amber-200/60 rounded-full font-extrabold">{results.inventory.length}</span>
                </button>
              )}
              {!isAccountsContext && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('note')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                    activeCategory === 'note' 
                      ? "bg-purple-600 text-white shadow-xs" 
                      : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                  )}
                >
                  <span>4. الملاحظات</span>
                  <span className="text-[9px] px-1 bg-purple-200/60 rounded-full font-extrabold">{results.notes.length}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveCategory('transaction')}
                className={cn(
                  "px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                  activeCategory === 'transaction' 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                )}
              >
                <span>{isAccountsContext ? '4. العمليات المالية' : '5. المعاملات'}</span>
                <span className="text-[9px] px-1 bg-indigo-200/60 rounded-full font-extrabold">{results.transactions.length}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSortBy(prev => prev === 'name' ? 'latest' : 'name')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-3xs border",
                  sortBy === 'name' 
                    ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200" 
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                )}
                title="تبديل ترتيب الاقتراحات: حسب الاسم ↔ آخر إضافة وتعديل"
              >
                {sortBy === 'name' ? (
                  <>
                    <ArrowDownAZ className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">الترتيب:</span>
                    <span>حسب الاسم</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">الترتيب:</span>
                    <span>آخر إضافة وتعديل</span>
                  </>
                )}
              </button>

              {/* Save as default suggestions filter & sort */}
              <button
                type="button"
                onClick={handleSaveSearchDefault}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer border select-none",
                  savedSearchDefaultFeedback
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200/80"
                )}
                title="حفظ تصنيف وترتيب نتائج البحث كافتراضي لجميع مربعات البحث"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">{savedSearchDefaultFeedback ? '✓ تم الحفظ' : 'حفظ كافتراضي'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-3">
            {trimmed && results.totalCount === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">لا توجد نتائج مطابقة لـ "{query}"</p>
                <p className="text-xs text-slate-400">جرب البحث باسم عميل، اسم حساب، كود صنف، أو ملاحظة</p>
              </div>
            ) : null}

            {/* PRIORITY 1: CUSTOMERS */}
            {(activeCategory === 'all' || activeCategory === 'customer') && results.customers.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>الأولوية 1: العملاء ({results.customers.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3 h-3 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.customers.map(c => (
                    <div
                      key={c.id || c.name}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-100/60 hover:border-emerald-300 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-200/70 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                          {c.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate group-hover:text-emerald-900">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            {c.phone && <span>{c.phone}</span>}
                            {c.classification && (
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                                {c.classification}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY 2: ACCOUNTS (اسم الحساب والمالية) */}
            {(activeCategory === 'all' || activeCategory === 'account') && results.accounts.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-sky-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>الأولوية 2: الحسابات والمالية ({results.accounts.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3 h-3 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.accounts.map(a => (
                    <div
                      key={a.id || a.name}
                      onClick={() => handleSelectAccount(a)}
                      className="p-2.5 rounded-xl border border-sky-100 bg-sky-50/40 hover:bg-sky-100/60 hover:border-sky-300 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-200/70 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0">
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate group-hover:text-sky-900">
                            {a.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                            <span>الرصيد: {formatAmount(a.balance, a.currency, exchangeRates)} {a.currency}</span>
                            <span className="text-sky-700">({a.type === 'vault' ? 'خزينة' : a.type === 'bank' ? 'بنك' : a.type === 'wallet' ? 'محفظة' : 'صندوق'})</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-sky-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY 3 (Accounts): FINANCIAL CENTER (المركز المالي وبياناته) */}
            {(activeCategory === 'all' || activeCategory === 'financial_center') && results.financialMetrics.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-amber-700 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isAccountsContext ? 'الأولوية 3: المركز المالي وبياناته' : 'المركز المالي'} ({results.financialMetrics.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3.5 h-3.5 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.financialMetrics.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectFinancialMetric(m)}
                      className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-100/60 hover:border-amber-300 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-200/70 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate group-hover:text-amber-900">
                            {m.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold truncate">
                            <span className="text-amber-800 font-black">{formatAmount(m.amount, m.currency, exchangeRates)} {m.currency}</span>
                            <span>•</span>
                            <span className="truncate">{m.description}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY 3: INVENTORY */}
            {(activeCategory === 'all' || activeCategory === 'inventory') && results.inventory.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-amber-700 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span>الأولوية 3: المخزون والأصناف ({results.inventory.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3 h-3 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.inventory.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectInventory(item)}
                      className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-100/60 hover:border-amber-300 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-200/70 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate group-hover:text-amber-900">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                            <span>الكمية: {item.stock}</span>
                            <span>• السعر: {formatAmount(item.sellingPrice, item.currency, exchangeRates)} {item.currency}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY 4: NOTES (Hidden in accounts context) */}
            {!isAccountsContext && (activeCategory === 'all' || activeCategory === 'note') && results.notes.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-purple-700 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-purple-600" />
                    <span>الأولوية 4: الملاحظات ({results.notes.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3 h-3 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.notes.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleSelectNote(n)}
                      className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/40 hover:bg-purple-100/60 hover:border-purple-300 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-200/70 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0">
                          <StickyNote className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate group-hover:text-purple-900">
                            {n.title || 'ملاحظة بدون عنوان'}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate font-medium">
                            {n.content ? n.content.slice(0, 40) : 'لا يوجد محتوى'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-purple-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRIORITY 5: TRANSACTIONS & PENDING DUES */}
            {(activeCategory === 'all' || activeCategory === 'transaction') && results.transactions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[11px] font-black text-indigo-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isAccountsContext ? 'الأولوية 4' : 'الأولوية 5'}: المعاملات والمعلقات المالية ({results.transactions.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortBy(prev => prev === 'name' ? 'latest' : 'name');
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer shadow-3xs",
                      sortBy === 'name' 
                        ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" 
                        : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    )}
                    title="تبديل الترتيب بين حسب الاسم وآخر إضافة وتعديل"
                  >
                    {sortBy === 'name' ? (
                      <>
                        <ArrowDownAZ className="w-3 h-3 text-slate-500" />
                        <span>حسب الاسم</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>آخر إضافة وتعديل</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {results.transactions.map(t => {
                    const isIncome = t.type === 'income';
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTransaction(t)}
                        className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-100/60 hover:border-indigo-300 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                            isIncome ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate group-hover:text-indigo-900">
                              {t.customerName ? `${t.customerName} - ` : ''}{t.description || 'معاملة مالية'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              <span className={isIncome ? "text-emerald-600" : "text-red-600"}>
                                {isIncome ? 'له: ' : 'عليه: '}
                                {formatAmount(t.amount, t.currency, exchangeRates)} {t.currency}
                              </span>
                              <span className="text-slate-400">• {t.date ? t.date.slice(0, 10) : ''}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-indigo-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default GlobalReportsAccountsSearch;
