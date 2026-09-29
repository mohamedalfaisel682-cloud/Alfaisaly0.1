import React, { useState, useEffect, useRef } from 'react';
import { Building2, User, Plus, X, ChevronDown, Check, Sparkles, BookmarkCheck } from 'lucide-react';
import { Customer, CashAccount } from '../types';
import { cn } from '../lib/utils';
import { VoiceInputButton } from './VoiceInputButton';
import { toStandardDigits } from '../lib/arabicDigitsConverter';

export interface AccountOrCustomerSelectProps {
  value: string;
  onChange: (value: string, meta?: { type: 'account' | 'customer' | 'new'; id?: number }) => void;
  customers: Customer[];
  cashAccounts: CashAccount[];
  name?: string;
  placeholder?: string;
  className?: string;
  onQuickCreateAccount?: (name: string) => Promise<void> | void;
}

// Smart Arabic normalizer for pristine search & autocompletion
const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[\s\-_]+/g, '');
};

export const AccountOrCustomerSelect: React.FC<AccountOrCustomerSelectProps> = ({
  value,
  onChange,
  customers = [],
  cashAccounts = [],
  name = 'customerName',
  placeholder = 'ابحث أو اكتب اسم حساب أو عميل جديد...',
  className = 'w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-700',
  onQuickCreateAccount
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [activeTab, setActiveTab] = useState<'all' | 'accounts' | 'customers'>(() => {
    return (localStorage.getItem('account_customer_select_tab_default') as any) || 'all';
  });
  const [savedTabFeedback, setSavedTabFeedback] = useState(false);

  const handleSaveTabDefault = () => {
    localStorage.setItem('account_customer_select_tab_default', activeTab);
    setSavedTabFeedback(true);
    setTimeout(() => setSavedTabFeedback(false), 2200);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const query = search.trim();
  const trimmedQuery = query.toLowerCase();
  const stdQuery = toStandardDigits(trimmedQuery);
  const normQuery = normalizeArabicText(query);

  // Filter accounts
  const filteredAccounts = cashAccounts.filter(acc => {
    if (!trimmedQuery) return true;
    const rawName = (acc.name || '').toLowerCase();
    const normName = normalizeArabicText(acc.name || '');
    const matchName = rawName.includes(trimmedQuery) || rawName.includes(stdQuery) || normName.includes(normQuery);
    const matchClass = (acc.classification || '').toLowerCase().includes(trimmedQuery);
    return matchName || matchClass;
  });

  // Filter customers
  const filteredCustomers = customers.filter(cust => {
    if (!trimmedQuery) return true;
    const rawName = (cust.name || '').toLowerCase();
    const normName = normalizeArabicText(cust.name || '');
    const matchName = rawName.includes(trimmedQuery) || rawName.includes(stdQuery) || normName.includes(normQuery);
    const matchPhone = (cust.phone || '').includes(trimmedQuery) || 
                       (cust.phone || '').includes(stdQuery) || 
                       (cust.phones && cust.phones.some(p => p && (p.includes(trimmedQuery) || p.includes(stdQuery))));
    const matchClass = (cust.classification || '').toLowerCase().includes(trimmedQuery);
    return matchName || matchPhone || matchClass;
  });

  const exactMatchAccount = cashAccounts.find(
    a => (a.name || '').trim().toLowerCase() === trimmedQuery || normalizeArabicText(a.name || '') === normQuery
  );
  const exactMatchCustomer = customers.find(
    c => (c.name || '').trim().toLowerCase() === trimmedQuery || normalizeArabicText(c.name || '') === normQuery
  );
  const hasExactMatch = Boolean(exactMatchAccount || exactMatchCustomer);
  const canShowCreateOption = trimmedQuery.length > 0 && !hasExactMatch;

  const handleSelectAccount = (acc: CashAccount) => {
    setSearch(acc.name);
    onChange(acc.name, { type: 'account', id: acc.id });
    setIsOpen(false);
  };

  const handleSelectCustomer = (cust: Customer) => {
    setSearch(cust.name);
    onChange(cust.name, { type: 'customer', id: cust.id });
    setIsOpen(false);
  };

  const handleQuickCreate = async () => {
    if (!search.trim()) return;
    const accountName = search.trim();
    if (onQuickCreateAccount) {
      await onQuickCreateAccount(accountName);
    }
    onChange(accountName, { type: 'new' });
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearch('');
    onChange('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          name={name}
          autoComplete="off"
          value={search}
          onClick={() => { if (!isOpen) setIsOpen(true); }}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            onChange(val);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(className, search ? 'pl-20 pr-8' : 'pl-14 pr-8')}
        />

        {/* Clear, Voice and Dropdown buttons at left edge */}
        <div className="absolute left-0 top-0 bottom-0 h-full flex items-center z-10 overflow-hidden rounded-l-xl">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-1 text-slate-400 hover:text-slate-600 transition-colors"
            title="إظهار الاقتراحات"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
          <div className="px-0.5">
            <VoiceInputButton
              inputRef={inputRef}
              isNumeric={false}
              target="account-customer-name"
              title="إدخال اسم الحساب أو العميل بالصوت"
              onResult={(text) => {
                setSearch(text);
                onChange(text, { type: 'new' });
                setIsOpen(true);
              }}
            />
          </div>
          {search ? (
            <button
              type="button"
              onClick={handleClear}
              className="h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold"
              title="مسح النص وإلغاء المدخلات بنقرة واحدة"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute z-[99999] right-0 left-0 mt-1.5 bg-white border-2 border-emerald-500/80 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col animate-in fade-in-50 duration-150">
          {/* Filter sub-header */}
          <div className="p-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-bold transition-all text-[11px]',
                  activeTab === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                )}
              >
                الكل ({filteredAccounts.length + filteredCustomers.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-bold transition-all text-[11px] flex items-center gap-1',
                  activeTab === 'accounts'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-50'
                )}
              >
                <Building2 className="w-3 h-3" />
                <span>الحسابات ({filteredAccounts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className={cn(
                  'px-2 py-0.5 rounded-md font-bold transition-all text-[11px] flex items-center gap-1',
                  activeTab === 'customers'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/60'
                )}
              >
                <User className="w-3 h-3" />
                <span>العملاء ({filteredCustomers.length})</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveTabDefault}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer border select-none",
                  savedTabFeedback
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                )}
                title="حفظ تبويب الاقتراحات كافتراضي"
              >
                <BookmarkCheck className="w-3 h-3 text-amber-700" />
                <span>{savedTabFeedback ? 'تم الحفظ' : 'حفظ كافتراضي'}</span>
              </button>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                اقتراحات الحسابات والعملاء
              </span>
            </div>
          </div>

          {/* Quick Create Prompt if typed name does not match existing account */}
          {canShowCreateOption && (
            <div
              onClick={handleQuickCreate}
              className="p-2.5 bg-blue-50/80 hover:bg-blue-100/80 border-b border-blue-200/60 cursor-pointer flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-blue-900 flex items-center gap-1">
                    <span>إضافة كحساب مالي جديد:</span>
                    <span className="underline font-mono">"{search.trim()}"</span>
                  </div>
                  <div className="text-[10px] text-blue-700">
                    سيتم إدراجه تلقائياً في سجل الحسابات والمركز المالي
                  </div>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
            </div>
          )}

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {/* Accounts Group */}
            {(activeTab === 'all' || activeTab === 'accounts') && filteredAccounts.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  <span>الحسابات المالية المستقلة ({filteredAccounts.length})</span>
                </div>
                {filteredAccounts.map(acc => {
                  const isSelected = (acc.name || '').trim().toLowerCase() === search.trim().toLowerCase();
                  return (
                    <div
                      key={`acc_${acc.id || acc.name}`}
                      onClick={() => handleSelectAccount(acc)}
                      className={cn(
                        'px-3 py-2 flex items-center justify-between hover:bg-blue-50/60 cursor-pointer transition-colors',
                        isSelected && 'bg-blue-50 font-black'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate text-right">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="truncate">{acc.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100/80 text-blue-800 shrink-0">
                              حساب
                            </span>
                          </div>
                          {acc.classification && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {acc.classification}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customers Group */}
            {(activeTab === 'all' || activeTab === 'customers') && filteredCustomers.length > 0 && (
              <div>
                <div className="px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 bg-emerald-50/50 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>العملاء ({filteredCustomers.length})</span>
                </div>
                {filteredCustomers.map(cust => {
                  const isSelected = (cust.name || '').trim().toLowerCase() === search.trim().toLowerCase();
                  return (
                    <div
                      key={`cust_${cust.id || cust.name}`}
                      onClick={() => handleSelectCustomer(cust)}
                      className={cn(
                        'px-3 py-2 flex items-center justify-between hover:bg-emerald-50/60 cursor-pointer transition-colors',
                        isSelected && 'bg-emerald-50 font-black'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate text-right">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="truncate">{cust.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 shrink-0">
                              عميل
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            {cust.phone && <span>{cust.phone}</span>}
                            {cust.classification && <span>• {cust.classification}</span>}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {filteredAccounts.length === 0 && filteredCustomers.length === 0 && !canShowCreateOption && (
              <div className="p-4 text-center text-xs text-slate-400 font-bold">
                لا توجد حسابات أو عملاء مسجلين بهذا الاسم
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
