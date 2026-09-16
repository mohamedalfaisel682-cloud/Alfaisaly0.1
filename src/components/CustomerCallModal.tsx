import React from 'react';
import { PhoneCall, User, X, MessageSquare, Copy, Phone } from 'lucide-react';
import { cn } from '../lib/utils';

interface CustomerCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  phones: string[];
  onCallNumber: (phone: string) => void;
}

export const CustomerCallModal: React.FC<CustomerCallModalProps> = ({
  isOpen,
  onClose,
  customerName,
  phones,
  onCallNumber,
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (phone: string, index: number) => {
    navigator.clipboard.writeText(phone);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanNum = phone.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${cleanNum}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-right flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner text-white shrink-0">
              <PhoneCall className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">اختيار رقم الاتصال</h3>
              <p className="text-xs text-emerald-100 font-bold flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 inline-block" />
                <span>{customerName || 'العميل'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-800">
          <span>يوجد {phones.length} أرقام هاتف مضافة لهذا العميل:</span>
          <span className="text-[11px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full font-black">
            اختر الرقم للاتصال
          </span>
        </div>

        {/* Phones List */}
        <div className="p-5 overflow-y-auto space-y-3 max-h-[60vh]">
          {phones.map((phone, idx) => {
            const cleanDisplayNum = phone.trim();
            return (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-300 rounded-2xl transition-all flex items-center justify-between gap-3 group shadow-xs"
              >
                {/* Left Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onCallNumber(cleanDisplayNum)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer"
                    title={`اتصال بـ ${cleanDisplayNum}`}
                  >
                    <PhoneCall className="w-4 h-4 fill-current" />
                    <span>اتصال</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWhatsApp(cleanDisplayNum)}
                    className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="مراسلة عبر واتساب"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(cleanDisplayNum, idx)}
                    className="p-2 bg-slate-200/70 text-slate-700 hover:bg-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="نسخ الرقم"
                  >
                    {copiedIndex === idx ? (
                      <span className="text-[10px] text-emerald-700 font-black">تم</span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Right Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-emerald-600 shrink-0 font-bold text-xs shadow-xs">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-right min-w-0">
                    <div className="text-[10px] font-extrabold text-slate-400">
                      رقم الهاتف {idx + 1}
                    </div>
                    <div 
                      dir="ltr" 
                      className="font-mono font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate"
                    >
                      {cleanDisplayNum}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl font-bold text-xs transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerCallModal;
