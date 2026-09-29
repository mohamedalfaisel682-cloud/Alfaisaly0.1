import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  User, 
  Settings2, 
  Plus, 
  ChevronDown, 
  Receipt,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { DailyBondShortcut, Customer, CashAccount, Currency } from '../types';
import { getDailyBondShortcuts } from '../utils/dailyBondShortcuts';
import { DailyBondPreferencesModal } from './DailyBondPreferencesModal';
import { VoiceInputButton } from './VoiceInputButton';
import { hapticLight } from '../utils/haptics';

interface DailyBondShortcutsBarProps {
  onSelectShortcut: (shortcut: DailyBondShortcut) => void;
  customers: Customer[];
  cashAccounts: CashAccount[];
  systemCurrency: Currency;
  classificationOptions: string[];
  className?: string;
  compact?: boolean;
}

export const DailyBondShortcutsBar: React.FC<DailyBondShortcutsBarProps> = ({
  onSelectShortcut,
  customers,
  cashAccounts,
  systemCurrency,
  classificationOptions,
  className = '',
  compact = false
}) => {
  const [shortcuts, setShortcuts] = useState<DailyBondShortcut[]>(() => getDailyBondShortcuts());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedShortcutId, setSelectedShortcutId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setShortcuts(getDailyBondShortcuts());
    };
    window.addEventListener('daily_bond_shortcuts_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('daily_bond_shortcuts_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const filteredShortcuts = shortcuts.filter(s => {
    if (filterType !== 'all' && s.type !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(query);
    const targetMatch = s.targetName ? s.targetName.toLowerCase().includes(query) : false;
    const descMatch = s.description ? s.description.toLowerCase().includes(query) : false;
    return titleMatch || targetMatch || descMatch;
  });

  const selectedShortcut = shortcuts.find(s => s.id === selectedShortcutId);

  const handleSelect = (shortcut: DailyBondShortcut) => {
    hapticLight();
    setSelectedShortcutId(shortcut.id);
    setIsDropdownOpen(false);
    onSelectShortcut(shortcut);
  };

  const incomeCount = shortcuts.filter(s => s.type === 'income').length;
  const expenseCount = shortcuts.filter(s => s.type === 'expense').length;

  return (
    <>
      <div 
        ref={dropdownRef}
        className={`relative p-2.5 sm:p-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-lg ${className}`}
      >
        {/* Header row with high contrast background and crystal clear text */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-700/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-black">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
              اختصارات وتفضيلات السندات اليومية
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              setIsPreferencesOpen(true);
            }}
            className="flex items-center gap-1.5 py-1 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer shrink-0"
            title="تخصيص وإدارة السندات اليومية"
          >
            <Settings2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
            <span>إدارة وتخصيص</span>
          </button>
        </div>

        {/* Dropdown Selector Trigger Button with high-contrast text and clear background */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border-2 text-right transition-all cursor-pointer select-none active:scale-[0.99] ${
            isDropdownOpen 
              ? 'bg-slate-800 border-emerald-400 ring-4 ring-emerald-500/20 shadow-md' 
              : 'bg-slate-800/95 hover:bg-slate-800 border-slate-600 hover:border-slate-500 shadow-sm'
          }`}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-black">
              <Receipt className="w-4 h-4 stroke-[2.5]" />
            </div>

            <div className="flex flex-col min-w-0 text-right">
              <span className="text-xs sm:text-sm font-black text-white truncate drop-shadow-xs">
                {selectedShortcut ? selectedShortcut.title : 'اختر سنداً أو تفضيلاً سريعاً من القائمة...'}
              </span>
              <span className="text-[11px] font-black text-emerald-300 truncate mt-0.5">
                {selectedShortcut ? (
                  selectedShortcut.targetName ? `مرتبط بـ: ${selectedShortcut.targetName}` : 'سند عام مباشر'
                ) : (
                  `يتوفر ${shortcuts.length} تفضيل جاهز (${incomeCount} وارد، ${expenseCount} صادر)`
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedShortcut && (
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-xs ${
                selectedShortcut.type === 'income' 
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                  : 'bg-rose-500 text-white border-rose-400'
              }`}>
                {selectedShortcut.type === 'income' ? 'وارد (له)' : 'صادر (عليه)'}
              </span>
            )}
            <ChevronDown className={`w-5 h-5 text-emerald-400 transition-transform duration-200 stroke-[2.5] ${isDropdownOpen ? 'rotate-180 text-emerald-300' : ''}`} />
          </div>
        </button>

        {/* Dropdown Menu Overlay List with high-contrast text and clear colored backgrounds */}
        {isDropdownOpen && (
          <div 
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900 border-2 border-slate-600 rounded-2xl shadow-2xl overflow-hidden p-2.5 text-white animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Search and Filters inside dropdown */}
            <div className="space-y-2 pb-2.5 border-b border-slate-700">
              {shortcuts.length > 3 && (
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث سريع في تفضيلات السندات..."
                    className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl pr-9 pl-16 py-2 text-xs font-black text-white placeholder-slate-400 outline-none focus:border-emerald-400"
                    autoFocus
                  />
                  <div className="absolute left-0 top-0 bottom-0 h-full flex items-center z-10 overflow-hidden rounded-l-xl">
                    <VoiceInputButton
                      target="daily-bond-search"
                      onResult={(text) => setSearchQuery(text)}
                      className="p-1 hover:bg-slate-700/60 rounded-lg text-slate-300 hover:text-emerald-400"
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
              )}

              {/* Filter Tabs: الكل / وارد / صادر */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`flex-1 py-1.5 px-2 text-xs font-black rounded-xl border transition-all ${
                    filterType === 'all'
                      ? 'bg-slate-700 text-white border-slate-500 shadow-xs'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-750'
                  }`}
                >
                  الكل ({shortcuts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`flex-1 py-1.5 px-2 text-xs font-black rounded-xl border transition-all flex items-center justify-center gap-1 ${
                    filterType === 'income'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                      : 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-emerald-950/60'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                  <span>وارد ({incomeCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`flex-1 py-1.5 px-2 text-xs font-black rounded-xl border transition-all flex items-center justify-center gap-1 ${
                    filterType === 'expense'
                      ? 'bg-rose-600 text-white border-rose-400 shadow-xs'
                      : 'bg-slate-800 text-rose-400 border-slate-700 hover:bg-rose-950/60'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[3]" />
                  <span>صادر ({expenseCount})</span>
                </button>
              </div>
            </div>

            {/* Scrollable list of shortcuts with high-contrast text and clear backgrounds */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 pt-2 pr-0.5 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {filteredShortcuts.length === 0 ? (
                <div className="py-6 text-center text-slate-300 font-bold text-xs bg-slate-800/60 rounded-xl border border-slate-700">
                  لا توجد تفضيلات سندات مطابقة
                </div>
              ) : (
                filteredShortcuts.map((shortcut) => {
                  const isIncome = shortcut.type === 'income';
                  const isAccount = shortcut.targetType === 'account';
                  const isCustomer = shortcut.targetType === 'customer';
                  const isSelected = selectedShortcutId === shortcut.id;

                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      onClick={() => handleSelect(shortcut)}
                      className={`w-full group flex items-center justify-between gap-2.5 p-2.5 rounded-xl border-2 text-right transition-all cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-400/40 shadow-md'
                          : isIncome
                          ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/70 text-white'
                          : 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/70 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Type Icon Badge */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
                          isIncome ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                        }`}>
                          {isIncome ? <ArrowUpRight className="w-4 h-4 stroke-[3]" /> : <ArrowDownLeft className="w-4 h-4 stroke-[3]" />}
                        </div>

                        {/* Title and Target info with high-contrast text */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-black text-white group-hover:text-emerald-200 transition-colors truncate">
                            {shortcut.title}
                          </span>

                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md border ${
                              isIncome 
                                ? 'bg-emerald-900/80 text-emerald-100 border-emerald-600/70' 
                                : 'bg-rose-900/80 text-rose-100 border-rose-600/70'
                            }`}>
                              {isAccount ? (
                                <>
                                  <Building2 className="w-3 h-3 text-sky-300 shrink-0" />
                                  <span className="text-sky-200 truncate max-w-[140px]">{shortcut.targetName}</span>
                                </>
                              ) : isCustomer ? (
                                <>
                                  <User className="w-3 h-3 text-emerald-300 shrink-0" />
                                  <span className="text-emerald-200 truncate max-w-[140px]">{shortcut.targetName}</span>
                                </>
                              ) : (
                                <span>سند عام مباشر</span>
                              )}
                            </span>

                            {shortcut.defaultAmount ? (
                              <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-md border ${
                                isIncome 
                                  ? 'bg-emerald-900/80 text-amber-300 border-emerald-600/70' 
                                  : 'bg-rose-900/80 text-amber-300 border-rose-600/70'
                              }`}>
                                {shortcut.defaultAmount.toLocaleString('en-US')} {shortcut.currency || systemCurrency}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 stroke-[2.5]" />
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shadow-xs ${
                          isIncome ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
                        }`}>
                          {isIncome ? 'وارد' : 'صادر'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer Actions with high contrast */}
            <div className="pt-2.5 mt-2 border-t border-slate-700 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsPreferencesOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 hover:text-black border border-emerald-400 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>إضافة أو تخصيص السندات اليومية</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Managing Shortcuts */}
      <DailyBondPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        customers={customers}
        cashAccounts={cashAccounts}
        systemCurrency={systemCurrency}
        classificationOptions={classificationOptions}
        onSelectShortcut={onSelectShortcut}
      />
    </>
  );
};
