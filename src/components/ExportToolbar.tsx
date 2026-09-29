import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Copy, Printer, Check, SlidersHorizontal, Settings2, Database } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportElementAsJPG, exportElementAsPDF, copyFormattedText } from '../utils/exportUtils';
import { openExportSettingsModal, getExportSettings, subscribeExportSettings } from '../utils/exportSettings';
import { cn } from '../lib/utils';

export interface ExportToolbarProps {
  targetElementId: string;
  filenamePrefix?: string;
  title: string;
  getTextToCopy?: () => string;
  getTextContent?: () => string;
  getJsonData?: () => any;
  className?: string;
  size?: 'sm' | 'md' | 'xs';
  showPrint?: boolean;
  showSettings?: boolean;
  onPrint?: () => void;
  compact?: boolean;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  targetElementId,
  filenamePrefix,
  title,
  getTextToCopy,
  getTextContent,
  getJsonData,
  className,
  size = 'sm',
  showPrint = false,
  showSettings = true,
  onPrint,
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingJpg, setIsExportingJpg] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [currentFormatLabel, setCurrentFormatLabel] = useState('جوال');

  useEffect(() => {
    const updateLabel = () => {
      const s = getExportSettings();
      if (s.format === 'mobile') setCurrentFormatLabel('جوال');
      else if (s.format === 'a4') setCurrentFormatLabel('A4');
      else if (s.format === 'a3') setCurrentFormatLabel('A3');
      else if (s.format === 'a5') setCurrentFormatLabel('A5');
      else if (s.format === 'thermal_80') setCurrentFormatLabel('80mm');
      else if (s.format === 'thermal_58') setCurrentFormatLabel('58mm');
      else setCurrentFormatLabel('مخصص');
    };
    updateLabel();
    return subscribeExportSettings(updateLabel);
  }, []);

  const getEffectiveText = getTextToCopy || getTextContent;
  const effectivePrefix = filenamePrefix || title.replace(/\s+/g, '_');

  const handleCopy = async () => {
    if (!getEffectiveText) return;
    const text = getEffectiveText();
    if (!text) return;
    await copyFormattedText(text, `تم نسخ بيانات ${title}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${effectivePrefix}_${dateStr}.pdf`;
    await exportElementAsPDF(targetElementId, filename, `${title} - مستند PDF`);
    setIsExportingPdf(false);
  };

  const handleExportJPG = async () => {
    setIsExportingJpg(true);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${effectivePrefix}_${dateStr}.jpg`;
    await exportElementAsJPG(targetElementId, filename, `${title} - صورة JPG`);
    setIsExportingJpg(false);
  };

  const handleExportJSON = async () => {
    setIsExportingJson(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${effectivePrefix}_backup_${dateStr}.json`;
      let dataToExport: any = null;

      if (getJsonData) {
        dataToExport = getJsonData();
      } else {
        // Collect real DB snapshot and document content
        let dbSnapshot: any = {};
        try {
          const { db } = await import('../lib/db');
          dbSnapshot = {
            tasks: await db.tasks.limit(50).toArray(),
            transactions: await db.transactions.limit(100).toArray(),
            cashAccounts: await db.cashAccounts.toArray(),
            customers: await db.customers.limit(50).toArray(),
            tasksCount: await db.tasks.count(),
            transactionsCount: await db.transactions.count()
          };
        } catch (err) {
          console.warn('DB snapshot in export toolbar:', err);
        }

        dataToExport = {
          app: 'نظام الفيصلي للصيانة والحسابات',
          title,
          exportedAt: new Date().toISOString(),
          format: 'json_backup',
          textContent: getEffectiveText ? getEffectiveText() : '',
          backupData: dbSnapshot
        };
      }

      const jsonStr = typeof dataToExport === 'string' ? dataToExport : JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
      toast.success(`تم التحميل المباشر لملف .json: ${filename}`);
    } catch (e) {
      console.error('Export JSON failed:', e);
      toast.error('تعذر تحميل ملف JSON');
    } finally {
      setIsExportingJson(false);
    }
  };

  const btnClasses = cn(
    "flex items-center gap-1.5 font-bold rounded-xl transition-all cursor-pointer shadow-xs select-none active:scale-95 shrink-0",
    compact && size === 'xs' ? "w-7 h-7 sm:w-8 sm:h-8 p-0 flex items-center justify-center" :
    size === 'xs' ? "px-2 py-1 text-[10px]" :
    size === 'sm' ? "px-2.5 py-1.5 text-xs" :
    "px-3.5 py-2 text-sm"
  );

  return (
    <div className={cn(compact ? "flex items-center gap-1 no-export flex-nowrap shrink-0" : "flex flex-wrap items-center gap-1.5 no-export", className)} dir="rtl">
      {/* Export Settings Icon Button - icon only, compact */}
      {showSettings && (
        <button
          type="button"
          onClick={openExportSettingsModal}
          title={`إعدادات الإخراج والأبعاد والدقة (الحالي: ${currentFormatLabel})`}
          className="p-1.5 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        </button>
      )}

      {/* Direct JSON Download Button */}
      <button
        type="button"
        onClick={handleExportJSON}
        disabled={isExportingJson}
        title="تحميل مباشر لملف النسخة الاحتياطية والبيانات (.json) إلى الهاتف"
        className={cn(
          btnClasses,
          "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80"
        )}
      >
        <Database className={cn("w-3.5 h-3.5 text-amber-700", isExportingJson && "animate-spin")} />
        {!compact && <span>.json</span>}
      </button>

      {/* Export as PDF */}
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={isExportingPdf}
        title="تنزيل مباشر كمستند PDF إلى ملفات الهاتف"
        className={cn(
          btnClasses,
          "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70"
        )}
      >
        <FileText className={cn("w-3.5 h-3.5", isExportingPdf && "animate-spin")} />
        {!compact && <span>PDF</span>}
      </button>

      {/* Export as JPG Image */}
      <button
        type="button"
        onClick={handleExportJPG}
        disabled={isExportingJpg}
        title="تنزيل مباشر كصورة JPG إلى ملفات الهاتف"
        className={cn(
          btnClasses,
          "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/70"
        )}
      >
        <ImageIcon className={cn("w-3.5 h-3.5", isExportingJpg && "animate-spin")} />
        {!compact && <span>صورة</span>}
      </button>

      {/* Copy Text */}
      {getTextToCopy && (
        <button
          type="button"
          onClick={handleCopy}
          title="نسخ نص التقرير/البيانات للحافظة"
          className={cn(
            btnClasses,
            copied 
              ? "bg-emerald-500 text-white border-emerald-500" 
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {!compact && <span>{copied ? 'تم النسخ!' : 'نسخ نص'}</span>}
        </button>
      )}

      {/* Print */}
      {showPrint && (
        <button
          type="button"
          onClick={onPrint ? onPrint : () => window.print()}
          title="طباعة فورية"
          className={cn(
            btnClasses,
            "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70"
          )}
        >
          <Printer className="w-3.5 h-3.5" />
          {!compact && <span>طباعة</span>}
        </button>
      )}
    </div>
  );
};
export default ExportToolbar;
