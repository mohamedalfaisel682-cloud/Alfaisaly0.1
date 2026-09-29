import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Calendar, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Printer, 
  Share2, 
  CheckCircle2, 
  X, 
  Building2, 
  ShieldCheck, 
  FileText,
  Clock,
  User,
  Scale
} from 'lucide-react';
import { Transaction, CashAccount, Customer } from '../types';
import { db } from '../lib/db';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { VoiceInputButton } from './VoiceInputButton';

interface FinancialClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  cashAccounts: CashAccount[];
  systemCurrency: string;
  currentUserName?: string;
}

export const FinancialClosingModal: React.FC<FinancialClosingModalProps> = ({
  isOpen,
  onClose,
  transactions,
  cashAccounts,
  systemCurrency,
  currentUserName = 'مدير النظام'
}) => {
  const [periodType, setPeriodType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [closingNote, setClosingNote] = useState<string>('');
  const [isSavedAudit, setIsSavedAudit] = useState(false);

  // حساب مجال التاريخ
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (periodType === 'today') {
      return { start: todayStr, end: todayStr, title: 'إقفال اليوم الحالي' };
    }
    if (periodType === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      return { start: yStr, end: yStr, title: 'إقفال يوم أمس' };
    }
    if (periodType === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart.toISOString().split('T')[0], end: todayStr, title: 'إقفال الأسبوع' };
    }
    if (periodType === 'month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: monthStart, end: todayStr, title: 'إقفال الشهر الحالي' };
    }
    return { start: customStartDate, end: customEndDate, title: 'إقفال فترة مخصصة' };
  }, [periodType, customStartDate, customEndDate]);

  // تصفية المعاملات حسب الفترة والحساب
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = (t.date || '').split('T')[0];
      if (txDate < dateRange.start || txDate > dateRange.end) return false;

      if (selectedAccountId !== 'all') {
        const targetAcc = cashAccounts.find(a => String(a.id) === String(selectedAccountId));
        if (targetAcc && t.customerName !== targetAcc.name) return false;
      }
      return true;
    });
  }, [transactions, dateRange, selectedAccountId, cashAccounts]);

  // تجميع الإحصائيات حسب العملات
  const currencyStats = useMemo(() => {
    const stats: Record<string, { income: number; expense: number; net: number; count: number }> = {};

    filteredTransactions.forEach(t => {
      const curr = t.currency || systemCurrency || 'ريال يمني';
      if (!stats[curr]) {
        stats[curr] = { income: 0, expense: 0, net: 0, count: 0 };
      }
      const amount = Number(t.amount) || 0;
      stats[curr].count += 1;
      if (t.type === 'income') {
        stats[curr].income += amount;
        stats[curr].net += amount;
      } else {
        stats[curr].expense += amount;
        stats[curr].net -= amount;
      }
    });

    return stats;
  }, [filteredTransactions, systemCurrency]);

  if (!isOpen) return null;

  // تسجيل اعتماد الإقفال في سجل التدقيق
  const handleSaveAuditClosing = async () => {
    hapticLight();
    try {
      const closingSummary = Object.entries(currencyStats)
        .map(([curr, s]) => `${curr}: وارد ${s.income.toLocaleString()} | صادر ${s.expense.toLocaleString()} | صافي ${s.net.toLocaleString()}`)
        .join(' || ');

      await db.auditLogs.add({
        actionType: 'system',
        entityType: 'financial_account',
        entityName: 'إقفال مالي دوري',
        details: `تم اعتماد ${dateRange.title} (${dateRange.start} إلى ${dateRange.end}) بواسطة ${currentUserName}. الحركات: ${filteredTransactions.length}. الملخص: [${closingSummary}]. ملاحظة: ${closingNote || 'تم الاعتماد بنجاح'}`,
        user: currentUserName,
        timestamp: new Date().toISOString()
      });

      setIsSavedAudit(true);
      hapticSuccess();
      setTimeout(() => setIsSavedAudit(false), 3000);
      alert('✅ تم اعتماد وحفظ محضر الإقفال المالي في سجل التدقيق الموثق بنجاح!');
    } catch (err) {
      console.error('Failed to save closing audit point:', err);
    }
  };

  // طباعة محضر الإقفال
  const handlePrintClosing = () => {
    hapticLight();
    window.print();
  };

  // مشاركة نص المحضر عبر واتساب
  const handleShareWhatsApp = () => {
    hapticLight();
    const targetAccountName = selectedAccountId === 'all' 
      ? 'كافة الصناديق والحسابات' 
      : cashAccounts.find(a => String(a.id) === String(selectedAccountId))?.name || 'حساب محدد';

    const lines = [
      `📑 *محضر إقفال مالي رسمي - ${dateRange.title}*`,
      `📅 الفترة: من ${dateRange.start} إلى ${dateRange.end}`,
      `👤 المعتمد: ${currentUserName}`,
      `🏢 الحساب: ${targetAccountName}`,
      `🔢 إجمالي السندات: ${filteredTransactions.length} سند`,
      '--------------------------------',
      '*ملخص الأرصدة والتدفقات النقدية:*'
    ];

    Object.entries(currencyStats).forEach(([curr, s]) => {
      lines.push(`💰 *العملة:* ${curr}`);
      lines.push(`  • إجمالي الوارد (له): +${s.income.toLocaleString()}`);
      lines.push(`  • إجمالي المنصرف (عليه): -${s.expense.toLocaleString()}`);
      lines.push(`  • صافي التدفق: ${s.net >= 0 ? '+' : ''}${s.net.toLocaleString()} ${curr}`);
      lines.push('--------------------------------');
    });

    if (closingNote) {
      lines.push(`📝 *ملاحظة الإقفال:* ${closingNote}`);
    }
    lines.push(`⏰ وُثّق بتاريخ: ${new Date().toLocaleString('ar-SA')}`);

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[96000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" onClick={onClose}>
      <div 
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 flex items-center justify-center">
              <Scale className="w-6 h-6 text-indigo-300 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black leading-tight">الإقفال المالي الدوري (يومي / أسبوعي / شهري)</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-bold border border-indigo-400/30">
                  محضر معتمد
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                حصر شامل للمقبوضات والمصروفات وصافي الصناديق والحسابات المستقلة
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          {/* Period selector chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { id: 'today', label: 'إقفال اليوم' },
              { id: 'yesterday', label: 'يوم أمس' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر الحالي' },
              { id: 'custom', label: 'فترة مخصصة' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setPeriodType(p.id as any);
                }}
                className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  periodType === p.id 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-white hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Account Filter & Custom dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">تحديد الحساب أو الصندوق:</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2"
              >
                <option value="all">🏢 كافة الصناديق والحسابات المالية</option>
                {cashAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency || systemCurrency})
                  </option>
                ))}
              </select>
            </div>

            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">من تاريخ:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 block mb-1">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Body / Financial Closing Statement */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin" id="financial-closing-printable-area">
          {/* Statement Header Card */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-3xs">
            <div>
              <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider block">
                {dateRange.title}
              </span>
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                محضر الحسابات النقدية والتدفق المالي
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                الفترة: من {dateRange.start} إلى {dateRange.end} | الحركات المسجلة: {filteredTransactions.length}
              </p>
            </div>

            <div className="text-left bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs shrink-0">
              <span className="text-[10px] text-slate-400 block font-bold">المعتمد المسؤول</span>
              <span className="text-xs font-black text-slate-800">{currentUserName}</span>
            </div>
          </div>

          {/* Currencies Summary Cards */}
          <div>
            <span className="text-xs font-black text-slate-700 block mb-2">صافي التدفقات حسب العملات:</span>
            {Object.keys(currencyStats).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs font-bold">
                لا توجد سندات أو معاملات مسجلة في هذه الفترة المحددة.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(currencyStats).map(([curr, s]) => {
                  const isPositive = s.net >= 0;

                  return (
                    <div key={curr} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-3xs space-y-2">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-black text-slate-900">{curr}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-600">
                          {s.count} سند
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-[10px] text-emerald-800 block font-bold">المقبوضات (وارد)</span>
                          <span className="text-xs font-black text-emerald-700">+{s.income.toLocaleString()}</span>
                        </div>

                        <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-[10px] text-rose-800 block font-bold">المدفوعات (صادر)</span>
                          <span className="text-xs font-black text-rose-700">-{s.expense.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isPositive ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950' : 'bg-rose-500/10 border-rose-300 text-rose-950'
                      }`}>
                        <span className="text-xs font-black">صافي حركة الفترة:</span>
                        <span className="text-xs font-black dir-ltr">
                          {isPositive ? '+' : ''}{s.net.toLocaleString()} {curr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transactions List Preview (Up to 20 recent) */}
          {filteredTransactions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-700 block">تفصيل السندات في محضر الإقفال ({filteredTransactions.length}):</span>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {filteredTransactions.slice(0, 30).map(t => {
                  const isInc = t.type === 'income';

                  return (
                    <div key={t.id} className="p-2 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isInc ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="font-extrabold text-slate-900">{t.description || (isInc ? 'سند قبض' : 'سند صرف')}</span>
                        {t.customerName && (
                          <span className="text-[10px] text-slate-500 font-bold">({t.customerName})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-black ${isInc ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isInc ? '+' : '-'}{Number(t.amount).toLocaleString()} {t.currency || systemCurrency}
                        </span>
                        <span className="text-[9px] text-slate-400">{(t.date || '').split('T')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closing Notes */}
          <div>
            <label className="text-[10px] font-black text-slate-600 block mb-1">
              ملاحظة الإقفال أو توثيق العهدة النقدية (اختياري):
            </label>
            <div className="relative flex items-center w-full bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
              <input
                type="text"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="مثال: تم تسليم الصندوق ومطابقة السيولة النقدية مع الجرد الفعلي..."
                className="w-full text-xs font-bold bg-transparent p-2.5 outline-none text-slate-800"
              />
              <div className="pl-2 shrink-0">
                <VoiceInputButton
                  target="closing-note-input"
                  onResult={(text) => setClosingNote(prev => prev ? `${prev} ${text}` : text)}
                  className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                  buttonTitle="تحويل الكلام إلى نص"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrintClosing}
              className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-3xs active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>طباعة المحضر</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-3xs active:scale-95 transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>مشاركة واتساب</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAuditClosing}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-200" />
              <span>{isSavedAudit ? 'تم الاعتماد بنجاح ✅' : 'اعتماد وتوثيق الإقفال'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
