import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ClipboardList, 
  Users, 
  Package, 
  Wallet, 
  Search, 
  X, 
  Check, 
  Clock, 
  Wrench, 
  ChevronDown, 
  Phone, 
  Tag, 
  Building2, 
  CreditCard, 
  ShieldCheck 
} from 'lucide-react';
import { Task, Customer, InventoryItem, CashAccount, DebtAccount } from '../types';
import { cn } from '../lib/utils';

export type EntityType = 'task' | 'customer' | 'inventory' | 'account';

export interface NoteEntitySelectorProps {
  tasks: Task[];
  customers: Customer[];
  inventory: InventoryItem[];
  cashAccounts?: CashAccount[];
  debtAccounts?: DebtAccount[];
  
  // Selected IDs
  selectedTaskId?: string;
  onSelectTask?: (taskId: string) => void;
  selectedCustomerId?: string;
  onSelectCustomer?: (customerId: string) => void;
  selectedInventoryId?: string;
  onSelectInventory?: (inventoryId: string) => void;
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;

  // Unified selector callback
  onSelectEntity?: (type: EntityType, id: string) => void;

  className?: string;
}

export const NoteEntitySelector: React.FC<NoteEntitySelectorProps> = ({
  tasks = [],
  customers = [],
  inventory = [],
  cashAccounts = [],
  debtAccounts = [],
  selectedTaskId = '',
  onSelectTask,
  selectedCustomerId = '',
  onSelectCustomer,
  selectedInventoryId = '',
  onSelectInventory,
  selectedAccountId = '',
  onSelectAccount,
  onSelectEntity,
  className
}) => {
  // Determine initial active tab based on what's already selected
  const initialTab: EntityType | null = useMemo(() => {
    if (selectedTaskId) return 'task';
    if (selectedCustomerId) return 'customer';
    if (selectedInventoryId) return 'inventory';
    if (selectedAccountId) return 'account';
    return null;
  }, [selectedTaskId, selectedCustomerId, selectedInventoryId, selectedAccountId]);

  const [activeTab, setActiveTab] = useState<EntityType | null>(initialTab || 'task');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync active tab if selection changes externally
  useEffect(() => {
    if (selectedTaskId) setActiveTab('task');
    else if (selectedCustomerId) setActiveTab('customer');
    else if (selectedInventoryId) setActiveTab('inventory');
    else if (selectedAccountId) setActiveTab('account');
  }, [selectedTaskId, selectedCustomerId, selectedInventoryId, selectedAccountId]);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = status || '';
    if (s === 'completed' || s === 'تم التسليم' || s === 'جاهز' || s === 'مكتمل') {
      return { label: s === 'completed' ? 'مكتمل' : s, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (s === 'pending' || s === 'قيد الانتظار' || s === 'معلق') {
      return { label: s === 'pending' ? 'قيد الانتظار' : s, className: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (s === 'cancelled' || s === 'ملغي' || s === 'ملغية') {
      return { label: s === 'cancelled' ? 'ملغي' : s, className: 'bg-red-100 text-red-800 border-red-200' };
    }
    return { label: s || 'قيد الصيانة', className: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  // --- 1. TASKS: Sorted by latest modified and latest added first ---
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a: any, b: any) => {
      const timeA = new Date(a.updatedAt || a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || b.date || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return sortedTasks;
    const q = searchQuery.toLowerCase().trim();
    return sortedTasks.filter((t: any) => {
      const cust = (t.customer || '').toLowerCase();
      const dev = (t.deviceType || '').toLowerCase();
      const br = (t.brand || '').toLowerCase();
      const iss = (t.issue || '').toLowerCase();
      const idStr = String(t.id || '');
      const phones = (t.customerPhones || []).join(' ');
      return (
        cust.includes(q) ||
        dev.includes(q) ||
        br.includes(q) ||
        iss.includes(q) ||
        idStr.includes(q) ||
        phones.includes(q)
      );
    });
  }, [sortedTasks, searchQuery]);

  // Selected task object
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find(t => String(t.id) === String(selectedTaskId)) || null;
  }, [tasks, selectedTaskId]);

  // --- 2. CUSTOMERS ---
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return sortedCustomers;
    const q = searchQuery.toLowerCase().trim();
    return sortedCustomers.filter((c: any) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const phones = (c.phones || []).join(' ');
      const classif = (c.classification || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || phones.includes(q) || classif.includes(q);
    });
  }, [sortedCustomers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

  // --- 3. INVENTORY ITEMS ---
  const sortedInventory = useMemo(() => {
    return [...inventory].sort((a: any, b: any) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return sortedInventory;
    const q = searchQuery.toLowerCase().trim();
    return sortedInventory.filter((item: any) => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q);
    });
  }, [sortedInventory, searchQuery]);

  const selectedInventory = useMemo(() => {
    if (!selectedInventoryId) return null;
    return inventory.find(i => String(i.id) === String(selectedInventoryId)) || null;
  }, [inventory, selectedInventoryId]);

  // --- 4. ACCOUNTS (Cash & Debt) ---
  const allAccounts = useMemo(() => {
    const list: { id: string; name: string; type: string; category: 'cash' | 'debt'; currency: string; balance?: number; creditorName?: string }[] = [];
    cashAccounts.forEach(acc => {
      list.push({
        id: String(acc.id),
        name: acc.name,
        type: acc.type,
        category: 'cash',
        currency: acc.currency,
        balance: acc.balance
      });
    });
    debtAccounts.forEach(debt => {
      list.push({
        id: String(debt.id),
        name: debt.name,
        type: debt.purpose || 'debt',
        category: 'debt',
        currency: debt.currency,
        creditorName: debt.creditorName,
        balance: (debt.totalAmount || 0) - (debt.paidAmount || 0)
      });
    });
    return list;
  }, [cashAccounts, debtAccounts]);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return allAccounts;
    const q = searchQuery.toLowerCase().trim();
    return allAccounts.filter(acc => {
      const name = (acc.name || '').toLowerCase();
      const type = (acc.type || '').toLowerCase();
      const cred = (acc.creditorName || '').toLowerCase();
      return name.includes(q) || type.includes(q) || cred.includes(q);
    });
  }, [allAccounts, searchQuery]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return allAccounts.find(a => String(a.id) === String(selectedAccountId)) || null;
  }, [allAccounts, selectedAccountId]);

  // Entity selection handlers supporting both unified onSelectEntity and individual handlers
  const handleSelectTask = (taskId: string) => {
    if (onSelectEntity) {
      onSelectEntity('task', taskId);
    } else {
      if (onSelectTask) onSelectTask(taskId);
      if (onSelectCustomer) onSelectCustomer('');
      if (onSelectInventory) onSelectInventory('');
      if (onSelectAccount) onSelectAccount('');
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectCustomer = (customerId: string) => {
    if (onSelectEntity) {
      onSelectEntity('customer', customerId);
    } else {
      if (onSelectCustomer) onSelectCustomer(customerId);
      if (onSelectTask) onSelectTask('');
      if (onSelectInventory) onSelectInventory('');
      if (onSelectAccount) onSelectAccount('');
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectInventory = (inventoryId: string) => {
    if (onSelectEntity) {
      onSelectEntity('inventory', inventoryId);
    } else {
      if (onSelectInventory) onSelectInventory(inventoryId);
      if (onSelectTask) onSelectTask('');
      if (onSelectCustomer) onSelectCustomer('');
      if (onSelectAccount) onSelectAccount('');
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectAccount = (accountId: string) => {
    if (onSelectEntity) {
      onSelectEntity('account', accountId);
    } else {
      if (onSelectAccount) onSelectAccount(accountId);
      if (onSelectTask) onSelectTask('');
      if (onSelectCustomer) onSelectCustomer('');
      if (onSelectInventory) onSelectInventory('');
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Clear all selections
  const handleClear = () => {
    if (onSelectEntity) {
      onSelectEntity(activeTab || 'task', '');
    } else {
      if (onSelectTask) onSelectTask('');
      if (onSelectCustomer) onSelectCustomer('');
      if (onSelectInventory) onSelectInventory('');
      if (onSelectAccount) onSelectAccount('');
    }
    setIsOpen(false);
  };

  // Has any entity linked?
  const hasLinkedEntity = Boolean(selectedTask || selectedCustomer || selectedInventory || selectedAccount);

  return (
    <div ref={containerRef} className={cn("relative w-full text-right dir-rtl space-y-2", className)}>
      {/* سطر الاختيار الرئيسي: ربط بـ: [مهمة] [عميل] [صنف] [حساب] */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50/90 p-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-black text-slate-800 select-none shrink-0">
            ربط بـ:
          </span>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
            {/* خيار مهمة */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('task');
                setIsOpen(true);
                setSearchQuery('');
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'task'
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-slate-600 hover:text-amber-700 hover:bg-amber-50"
              )}
            >
              <ClipboardList className="w-3.5 h-3.5 shrink-0" />
              <span>مهمة</span>
              {selectedTaskId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 ring-1 ring-white"></span>}
            </button>

            {/* خيار عميل */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('customer');
                setIsOpen(true);
                setSearchQuery('');
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'customer'
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
              )}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>عميل</span>
              {selectedCustomerId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 ring-1 ring-white"></span>}
            </button>

            {/* خيار صنف */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('inventory');
                setIsOpen(true);
                setSearchQuery('');
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'inventory'
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-purple-700 hover:bg-purple-50"
              )}
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>صنف</span>
              {selectedInventoryId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 ring-1 ring-white"></span>}
            </button>

            {/* خيار حساب */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('account');
                setIsOpen(true);
                setSearchQuery('');
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'account'
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
              )}
            >
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span>حساب</span>
              {selectedAccountId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 ring-1 ring-white"></span>}
            </button>
          </div>
        </div>

        {/* زر إلغاء أو تفريغ الربط */}
        {hasLinkedEntity && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title="إلغاء الربط بالكامل"
          >
            <X className="w-3 h-3" />
            <span>فك الارتباط</span>
          </button>
        )}
      </div>

      {/* بطاقة الكيان المربوط حالياً إن وجد */}
      {selectedTask && (
        <div className="p-2.5 bg-amber-50/95 border border-amber-300 rounded-xl text-xs shadow-2xs space-y-1.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <ClipboardList className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">
                مهمة #{selectedTask.id} - {selectedTask.customer}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('task');
                  setIsOpen(prev => !prev);
                }}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="تغيير المهمة"
              >
                <span>تغيير</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && activeTab === 'task' && "rotate-180")} />
              </button>
              <button
                type="button"
                onClick={() => handleSelectTask('')}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                title="إلغاء الربط بالمهمة"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-200/70">
            <div className="flex items-center gap-1.5 text-blue-700 font-semibold truncate">
              <Wrench className="w-3 h-3 shrink-0 text-blue-500" />
              <span>{selectedTask.deviceType} - {selectedTask.brand}</span>
            </div>
            {(() => {
              const badge = getStatusBadge(selectedTask.status);
              return (
                <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-extrabold border shrink-0", badge.className)}>
                  {badge.label}
                </span>
              );
            })()}
          </div>

          {selectedTask.issue && (
            <p className="text-[11px] text-slate-600 truncate bg-white/70 px-2 py-1 rounded-md border border-amber-200/50">
              <span className="font-bold text-slate-700">المشكلة:</span> {selectedTask.issue}
            </p>
          )}
        </div>
      )}

      {selectedCustomer && (
        <div className="p-2.5 bg-blue-50/95 border border-blue-300 rounded-xl text-xs shadow-2xs space-y-1.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">
                عميل: {selectedCustomer.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('customer');
                  setIsOpen(prev => !prev);
                }}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-100/80 hover:bg-blue-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="تغيير العميل"
              >
                <span>تغيير</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && activeTab === 'customer' && "rotate-180")} />
              </button>
              <button
                type="button"
                onClick={() => handleSelectCustomer('')}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                title="إلغاء الربط بالعميل"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {(selectedCustomer.phone || (selectedCustomer.phones && selectedCustomer.phones.length > 0)) && (
            <div className="flex items-center gap-1.5 text-slate-600 text-[11px] pt-1 border-t border-blue-200/70">
              <Phone className="w-3 h-3 text-slate-400" />
              <span className="font-mono">{selectedCustomer.phone || selectedCustomer.phones?.[0]}</span>
              {selectedCustomer.classification && (
                <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold mr-auto">
                  {selectedCustomer.classification}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {selectedInventory && (
        <div className="p-2.5 bg-purple-50/95 border border-purple-300 rounded-xl text-xs shadow-2xs space-y-1.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Package className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">
                صنف: {selectedInventory.name}
              </span>
              {selectedInventory.code && (
                <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold font-mono">
                  #{selectedInventory.code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('inventory');
                  setIsOpen(prev => !prev);
                }}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="تغيير الصنف"
              >
                <span>تغيير</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && activeTab === 'inventory' && "rotate-180")} />
              </button>
              <button
                type="button"
                onClick={() => handleSelectInventory('')}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                title="إلغاء الربط بالصنف"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-200/70 text-slate-600">
            <span>الفئة: {selectedInventory.category}</span>
            <span className="font-bold text-purple-800">الكمية: {selectedInventory.stock}</span>
          </div>
        </div>
      )}

      {selectedAccount && (
        <div className="p-2.5 bg-emerald-50/95 border border-emerald-300 rounded-xl text-xs shadow-2xs space-y-1.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">
                حساب: {selectedAccount.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('account');
                  setIsOpen(prev => !prev);
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="تغيير الحساب"
              >
                <span>تغيير</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && activeTab === 'account' && "rotate-180")} />
              </button>
              <button
                type="button"
                onClick={() => handleSelectAccount('')}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                title="إلغاء الربط بالحساب"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/70 text-slate-600">
            <span>النوع: {selectedAccount.type}</span>
            {selectedAccount.balance !== undefined && (
              <span className="font-bold text-emerald-800">
                الرصيد: {selectedAccount.balance} {selectedAccount.currency}
              </span>
            )}
          </div>
        </div>
      )}

      {/* القائمة المنسدلة الاحترافية مع مربع البحث السريع حسب التبويب المختار */}
      {isOpen && (
        <div className="absolute z-60 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* رأس القائمة ومربع البحث السريع */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800">
                {activeTab === 'task' && <ClipboardList className="w-3.5 h-3.5 text-amber-600" />}
                {activeTab === 'customer' && <Users className="w-3.5 h-3.5 text-blue-600" />}
                {activeTab === 'inventory' && <Package className="w-3.5 h-3.5 text-purple-600" />}
                {activeTab === 'account' && <Wallet className="w-3.5 h-3.5 text-emerald-600" />}
                <span>
                  {activeTab === 'task' && 'اختر مهمة للربط بها:'}
                  {activeTab === 'customer' && 'اختر عميلاً للربط به:'}
                  {activeTab === 'inventory' && 'اختر صنفاً من المخزن للربط به:'}
                  {activeTab === 'account' && 'اختر حساباً للربط به:'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {activeTab === 'task' ? 'مرتبة: الأحدث تعديلاً وإضافة' : 'البحث المباشر'}
              </span>
            </div>

            {/* مربع البحث السريع الشبيه بمربع البحث السريع في التطبيق */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'task'
                    ? "بحث سريع في المهام (العميل، الهاتف، الجهاز، المشكلة، رقم المهمة)..."
                    : activeTab === 'customer'
                    ? "بحث سريع في العملاء (الاسم، الهاتف، التصنيف)..."
                    : activeTab === 'inventory'
                    ? "بحث سريع في المخزن (اسم الصنف، الكود، الفئة)..."
                    : "بحث سريع في الحسابات (اسم الحساب، النوع، العملة)..."
                }
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder-slate-400"
                autoFocus
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-0 top-0 bottom-0 h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold rounded-l-xl"
                  title="مسح النص وإلغاء المدخلات بنقرة واحدة"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              ) : null}
            </div>
          </div>

          {/* محتوى القائمة بحسب التبويب النشط */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
            {/* 1. قائمة المهام */}
            {activeTab === 'task' && (
              filteredTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  لا توجد مهام مطابقة للبحث
                </div>
              ) : (
                filteredTasks.map((t: any) => {
                  const isSelected = String(t.id) === String(selectedTaskId);
                  const badge = getStatusBadge(t.status);
                  const dateToShow = t.updatedAt || t.createdAt || t.date;
                  const dateLabel = t.updatedAt ? 'آخر تعديل:' : 'أُضيفت:';
                  const dateStr = formatDate(dateToShow);

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTask(String(t.id))}
                      className={cn(
                        "w-full text-right p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer group text-xs",
                        isSelected
                          ? "bg-amber-50/80 border border-amber-300 shadow-2xs"
                          : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      )}
                    >
                      {/* السطر الأول: العميل ورقم المهمة ونوع الجهاز */}
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn(
                            "font-mono text-[10px] px-1.5 py-0.5 rounded font-extrabold",
                            isSelected ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-800"
                          )}>
                            #{t.id}
                          </span>
                          <span className="font-bold text-slate-900 group-hover:text-amber-900 transition-colors truncate">
                            {t.customer}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-blue-600 font-semibold">
                            {t.deviceType} {t.brand ? `- ${t.brand}` : ''}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* السطر الثاني: وصف المشكلة */}
                      {t.issue && (
                        <div className="text-[11px] text-slate-600 truncate pr-1">
                          <span className="text-slate-400 font-medium">المشكلة: </span>
                          <span>{t.issue}</span>
                        </div>
                      )}

                      {/* السطر الثالث: الحالة والتاريخ والوقت */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100/70 text-[10px]">
                        <span className={cn("px-1.5 py-0.5 rounded-full font-extrabold border text-[8.5px]", badge.className)}>
                          {badge.label}
                        </span>
                        {dateStr && (
                          <span className="text-slate-400 font-mono text-[9px] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-300" />
                            <span>{dateLabel} {dateStr}</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}

            {/* 2. قائمة العملاء */}
            {activeTab === 'customer' && (
              filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  لا يوجد عملاء مطابقين للبحث
                </div>
              ) : (
                filteredCustomers.map((c: any) => {
                  const isSelected = String(c.id) === String(selectedCustomerId);
                  const phoneStr = c.phone || (c.phones && c.phones[0]) || '';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(String(c.id))}
                      className={cn(
                        "w-full text-right p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer group text-xs",
                        isSelected
                          ? "bg-blue-50/80 border border-blue-300 shadow-2xs"
                          : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name ? c.name.charAt(0) : <Users className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                            {c.name}
                          </span>
                          {phoneStr && (
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{phoneStr}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.classification && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold border border-slate-200">
                            {c.classification}
                          </span>
                        )}
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}

            {/* 3. قائمة الأصناف في المخزن */}
            {activeTab === 'inventory' && (
              filteredInventory.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  لا توجد أصناف مطابقة للبحث
                </div>
              ) : (
                filteredInventory.map((item: any) => {
                  const isSelected = String(item.id) === String(selectedInventoryId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectInventory(String(item.id))}
                      className={cn(
                        "w-full text-right p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer group text-xs",
                        isSelected
                          ? "bg-purple-50/80 border border-purple-300 shadow-2xs"
                          : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                              {item.name}
                            </span>
                            {item.code && (
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-mono font-bold">
                                #{item.code}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            الفئة: {item.category || 'عام'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                          (item.stock || 0) <= 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          المتوفر: {item.stock || 0}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}

            {/* 4. قائمة الحسابات */}
            {activeTab === 'account' && (
              filteredAccounts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  لا توجد حسابات مطابقة للبحث
                </div>
              ) : (
                filteredAccounts.map((acc: any) => {
                  const isSelected = String(acc.id) === String(selectedAccountId);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelectAccount(String(acc.id))}
                      className={cn(
                        "w-full text-right p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer group text-xs",
                        isSelected
                          ? "bg-emerald-50/80 border border-emerald-300 shadow-2xs"
                          : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          {acc.type === 'vault' ? <ShieldCheck className="w-4 h-4" /> :
                           acc.type === 'bank' ? <Building2 className="w-4 h-4" /> :
                           acc.type === 'wallet' ? <CreditCard className="w-4 h-4" /> :
                           <Wallet className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                            {acc.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {acc.category === 'debt' ? `دين / تمويل (${acc.creditorName || ''})` : `حساب مالي: ${acc.type}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {acc.balance !== undefined && (
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {acc.balance} {acc.currency}
                          </span>
                        )}
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
;
};
export default NoteEntitySelector;
