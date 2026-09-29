import React from 'react';
import { LogOut, X, Download, CloudUpload } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  onDirectDownloadBackup?: () => void;
  onDriveBackup?: () => void;
  userName?: string;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  onDirectDownloadBackup,
  onDriveBackup,
  userName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99000] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 dir-rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-right overflow-hidden relative">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 relative z-10 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs shrink-0">
              <LogOut className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                تأكيد الخروج من التطبيق
              </h3>
              <p className="text-[10.5px] text-emerald-800 dark:text-emerald-300 font-extrabold mt-0.5">
                تطبيق الفيصل للصيانة المتقدمة ({userName || 'المستخدم'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Backup Export Options Section */}
        <div className="space-y-2 mb-5 relative z-10">
          <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 block mb-1">
            تصدير نسخة احتياطية للبيانات قبل الخروج (اختياري):
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {onDirectDownloadBackup && (
              <button
                type="button"
                onClick={onDirectDownloadBackup}
                className="p-3 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 group active:scale-95 shadow-2xs"
                title="تنزيل نسخة احتياطية كاملة مباشرة كملف على جهازك"
              >
                <div className="p-2 rounded-xl bg-indigo-600 text-white group-hover:scale-110 transition-transform shadow-xs">
                  <Download className="w-4 h-4" />
                </div>
                <span className="font-black text-xs text-indigo-950 dark:text-indigo-200">
                  تحميل مباشر
                </span>
              </button>
            )}

            {onDriveBackup && (
              <button
                type="button"
                onClick={onDriveBackup}
                className="p-3 bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/60 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 group active:scale-95 shadow-2xs"
                title="حفظ النسخة الاحتياطية مباشرة إلى Google Drive أو التخزين السحابي"
              >
                <div className="p-2 rounded-xl bg-sky-600 text-white group-hover:scale-110 transition-transform shadow-xs">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <span className="font-black text-xs text-sky-950 dark:text-sky-200">
                  سحابياً إلى Drive
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 relative z-10 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onConfirmExit}
            className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>تأكيد الخروج الآن</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 bg-white text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-xs transition-colors cursor-pointer shadow-xs"
          >
            إلغاء والعودة
          </button>
        </div>

      </div>
    </div>
  );
};
