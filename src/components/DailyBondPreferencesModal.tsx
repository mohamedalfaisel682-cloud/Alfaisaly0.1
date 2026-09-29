import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Star, 
  Building2, 
  User, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  Check, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Customer, CashAccount, Currency, DailyBondShortcut } from '../types';
import { 
  getDailyBondShortcuts, 
  saveDailyBondShortcuts, 
  addDailyBondShortcut, 
  updateDailyBondShortcut, 
  deleteDailyBondShortcut, 
  resetDailyBondShortcuts 
} from '../utils/dailyBondShortcuts';
import { AccountOrCustomerSelect } from './AccountOrCustomerSelect';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { db } from '../lib/db';
import { VoiceInputButton } from './VoiceInputButton';

interface DailyBondPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  cashAccounts: CashAccount[];
  systemCurrency: Currency;
  classificationOptions: string[];
  onSelectShortcut?: (shortcut: DailyBondShortcut) => void;
}

export const DailyBondPreferencesModal: React.FC<DailyBondPreferencesModalProps> = ({
  isOpen,
  onClose,
  customers,
  cashAccounts,
  systemCurrency,
  classificationOptions,
  onSelectShortcut
}) => {
  const [shortcuts, setShortcuts] = useState<DailyBondShortcut[]>(() => getDailyBondShortcuts());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [defaultAmount, setDefaultAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(systemCurrency);
  const [targetType, setTargetType] = useState<'account' | 'customer' | 'none'>('account');
  const [targetName, setTargetName] = useState('');
  const [isFavorite, setIsFavorite] = useState(true);

  if (!isOpen) return null;

  const refreshList = () => {
    setShortcuts(getDailyBondShortcuts());
  };

  const resetForm = () => {
    setTitle('');
    setType('expense');
    setDescription('');
    setCategory('');
    setDefaultAmount('');
    setCurrency(systemCurrency);
    setTargetType('account');
    setTargetName('');
    setIsFavorite(true);
    setEditingId(null);
    setIsAddingNew(false);
  };

  const handleStartEdit = (s: DailyBondShortcut) => {
    setEditingId(s.id);
    setTitle(s.title);
    setType(s.type);
    setDescription(s.description || '');
    setCategory(s.category || '');
    setDefaultAmount(s.defaultAmount ? String(s.defaultAmount) : '');
    setCurrency(s.currency || systemCurrency);
    setTargetType(s.targetType || 'none');
    setTargetName(s.targetName || '');
    setIsFavorite(Boolean(s.isFavorite));
    setIsAddingNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('يرجى إدخال عنوان الاختصار');
      return;
    }

    const payload: Omit<DailyBondShortcut, 'id'> = {
      title: title.trim(),
      type,
      description: description.trim() || title.trim(),
      category: category.trim() || 'أخرى',
      defaultAmount: defaultAmount ? parseFloat(defaultAmount) : undefined,
      currency: currency || systemCurrency,
      targetType,
      targetName: targetType === 'none' ? undefined : targetName.trim(),
      isFavorite,
      color: type === 'income' ? 'emerald' : 'rose'
    };

    // If account was chosen and doesn't exist in cashAccounts, auto-create it
    if (targetType === 'account' && targetName.trim()) {
      const exists = cashAccounts.some(a => a.name.trim().toLowerCase() === targetName.trim().toLowerCase());
      if (!exists) {
        try {
          await db.cashAccounts.add({
            name: targetName.trim(),
            type: 'general',
            balance: 0,
            currency: currency || systemCurrency || 'RY',
            classification: category || 'حسابات عامة',
            createdAt: new Date().toISOString(),
            notes: 'حساب مالي مستقل أضيف تلقائياً من تفضيلات السندات اليومية',
            statement: title.trim()
          });
        } catch (err) {
          console.error('Failed to auto-create cash account:', err);
        }
      }
    }

    if (editingId) {
      updateDailyBondShortcut({ ...payload, id: editingId });
    } else {
      addDailyBondShortcut(payload);
    }

    hapticSuccess();
    refreshList();
    resetForm();
  };

  const handleToggleFavorite = (id: string) => {
    hapticLight();
    const next = shortcuts.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    saveDailyBondShortcuts(next);
    setShortcuts(next);
  };

  const handleDelete = (id: string, sTitle: string) => {
    if (confirm(`هل أنت متأكد من حذف الاختصار "${sTitle}"؟`)) {
      deleteDailyBondShortcut(id);
      refreshList();
    }
  };

  const handleRestoreDefaults = () => {
    if (confirm('هل تريد استعادة قائمة الاختصارات والتفضيلات الافتراضية؟')) {
      const defs = resetDailyBondShortcuts();
      setShortcuts(defs);
      resetForm();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 bg-slate-900/35 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/80 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto text-right">
        {/* Header - Lighter, translucent, and high-contrast */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-emerald-100/90 text-slate-900 border-b border-emerald-200/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900">تفضيلات واختصارات السندات اليومية</h3>
              <p className="text-[11px] text-emerald-800 font-bold">تسجيل وتحديد سندات القبض والصرف المتكررة بنقرة واحدة</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-emerald-100/60 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Note Banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5 leading-relaxed">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black">فصل دقيق للحسابات:</span> يمكنك ربط كل اختصار بسند يومي إما بـ <strong>حساب مالي مستقل</strong> (مثل: مصاريف بوفية، إيجار، كهرباء) ليُحفظ خارج مهام العملاء، أو بـ <strong>عميل من العملاء</strong> لمتابعة ديونه ومدفوعاته.
            </div>
          </div>

          {/* Form to Add or Edit */}
          {isAddingNew ? (
            <form onSubmit={handleSave} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  {editingId ? 'تعديل الاختصار اليومي' : 'إضافة اختصار وتفضيل يومي جديد'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                >
                  إلغاء
                </button>
              </div>

              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">عنوان الاختصار السريع *</label>
                  <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="مثال: إيجار المحل، بوفية، كهرباء..."
                      className="w-full p-2 bg-transparent text-xs font-bold text-slate-800 outline-none"
                    />
                    <div className="pl-1.5 shrink-0">
                      <VoiceInputButton
                        target="daily-shortcut-title"
                        onResult={(text) => setTitle(prev => prev ? `${prev} ${text}` : text)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-md cursor-pointer"
                        buttonTitle="تحويل الكلام إلى نص"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">نوع السند</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black border transition-all ${
                        type === 'expense'
                          ? 'bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-400/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                      <span>سند صرف (ما عليه)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black border transition-all ${
                        type === 'income'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-400/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      <span>سند قبض (ما له)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Selector: Independent Account vs Customer vs None */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <label className="block text-[11px] font-black text-slate-800">
                  تحديد الجهة المرتبطة بالسند اليومي
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setTargetType('account'); }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-black border transition-all ${
                      targetType === 'account'
                        ? 'bg-blue-50 text-blue-800 border-blue-400 ring-2 ring-blue-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">حساب مالي مستقل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTargetType('customer'); }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-black border transition-all ${
                      targetType === 'customer'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">عميل من العملاء</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTargetType('none'); setTargetName(''); }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-black border transition-all ${
                      targetType === 'none'
                        ? 'bg-slate-200 text-slate-800 border-slate-400 ring-2 ring-slate-400/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">عام (غير مرتبط)</span>
                  </button>
                </div>

                {targetType === 'account' && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>اختر حساباً مالياً مستقلاً أو اكتب اسماً جديداً:</span>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">خارج مهام العملاء</span>
                    </div>
                    <AccountOrCustomerSelect
                      value={targetName}
                      onChange={(val) => setTargetName(val)}
                      customers={[]}
                      cashAccounts={cashAccounts}
                      placeholder="ابحث أو اختر حساب مالي مستقل..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {targetType === 'customer' && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>اختر عميلاً من قائمة العملاء:</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">عميل مهام وصيانة</span>
                    </div>
                    <AccountOrCustomerSelect
                      value={targetName}
                      onChange={(val) => setTargetName(val)}
                      customers={customers}
                      cashAccounts={[]}
                      placeholder="ابحث أو اختر عميل..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Description & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">البيان التلقائي</label>
                  <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="بيان المعاملة التلقائي..."
                      className="w-full p-2 bg-transparent text-xs font-bold text-slate-800 outline-none"
                    />
                    <div className="pl-1.5 shrink-0">
                      <VoiceInputButton
                        target="daily-shortcut-description"
                        onResult={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-md cursor-pointer"
                        buttonTitle="تحويل الكلام إلى نص"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-black text-slate-700">التصنيف المالي</label>
                    {classificationOptions && classificationOptions.length > 0 && (
                      <select
                        aria-label="اختر من التصنيفات الجاهزة"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 outline-none cursor-pointer"
                      >
                        <option value="">-- اختر تصنيفاً --</option>
                        {classificationOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="relative flex items-center w-full bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="مثال: مصاريف عامة، إيجارات..."
                      className="w-full p-2 bg-transparent text-xs font-bold text-slate-800 outline-none"
                    />
                    <div className="pl-1.5 shrink-0">
                      <VoiceInputButton
                        target="daily-shortcut-category"
                        onResult={(text) => setCategory(prev => prev ? `${prev} ${text}` : text)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-md cursor-pointer"
                        buttonTitle="تحويل الكلام إلى نص"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount & Currency & Favorite */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">المبلغ التلقائي (اختياري)</label>
                  <input
                    type="number"
                    step="any"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value)}
                    placeholder="اتركه فارغاً للتحديد لاحقاً"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">العملة</label>
                  <select
                    aria-label="العملة"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="RY">ريال يمني RY</option>
                    <option value="SAR">ريال سعودي SAR</option>
                    <option value="USD">دولار أمريكي USD</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="isFavoriteCheck"
                    checked={isFavorite}
                    onChange={(e) => setIsFavorite(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="isFavoriteCheck" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    ⭐ مفضل بالشريط السريع
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingId ? 'حفظ التعديلات' : 'إضافة إلى التفضيلات اليومية'}</span>
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="flex items-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-3xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة اختصار سند يومي جديد</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="flex items-center gap-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="استعادة الاختصارات الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>استعادة الافتراضي</span>
              </button>
            </div>
          )}

          {/* List of Shortcuts */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-black text-slate-700 flex items-center justify-between">
              <span>قائمة الاختصارات والتفضيلات النشطة ({shortcuts.length}):</span>
              <span className="text-[10px] text-slate-400 font-normal">انقر على النجمة لتثبيته بالشريط اليومي</span>
            </h4>

            {shortcuts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                لا توجد اختصارات يومية حالياً. انقر على "إضافة اختصار جديد" بالأعلى.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shortcuts.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2.5 shadow-xs ${
                      s.type === 'income'
                        ? 'bg-emerald-50/90 border-emerald-300 hover:border-emerald-500'
                        : 'bg-rose-50/90 border-rose-300 hover:border-rose-500'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                          s.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {s.type === 'income' ? <ArrowUpRight className="w-4 h-4 stroke-[3]" /> : <ArrowDownLeft className="w-4 h-4 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-black text-slate-950 flex items-center gap-1.5 flex-wrap">
                            <span>{s.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                              s.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}>
                              {s.type === 'income' ? 'قبض (وارد)' : 'صرف (منصرف)'}
                            </span>
                          </div>
                          {s.targetName ? (
                            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 mt-1">
                              {s.targetType === 'account' ? (
                                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-blue-200 text-blue-900 font-black">
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>حساب: {s.targetName}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-900 font-black">
                                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>عميل: {s.targetName}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-slate-500 mt-1">عام / غير محدد</div>
                          )}
                        </div>
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(s.id)}
                        className={`p-1.5 rounded-xl transition-colors bg-white border border-slate-200 shadow-2xs ${
                          s.isFavorite ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-slate-500'
                        }`}
                        title={s.isFavorite ? 'مفضل في الشريط السريع' : 'غير مفضل'}
                      >
                        <Star className={`w-4 h-4 ${s.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-xs font-bold text-slate-700">
                      <div className="truncate max-w-[170px]" title={s.description}>
                        {s.description || s.category}
                      </div>

                      <div className="flex items-center gap-1">
                        {onSelectShortcut && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectShortcut(s);
                              onClose();
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 rounded text-[10px] shadow-3xs"
                            title="تطبيق هذا السند الآن"
                          >
                            تطبيق
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(s)}
                          className="p-1 text-blue-600 hover:text-blue-800 rounded"
                          title="تعديل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.title)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
