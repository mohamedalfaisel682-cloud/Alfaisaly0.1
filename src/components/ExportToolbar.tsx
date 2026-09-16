import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Copy, Printer, Check, SlidersHorizontal, Settings2 } from 'lucide-react';
import { exportElementAsJPG, exportElementAsPDF, copyFormattedText } from '../utils/exportUtils';
import { openExportSettingsModal, getExportSettings, subscribeExportSettings } from '../utils/exportSettings';
import { cn } from '../lib/utils';

export interface ExportToolbarProps {
  targetElementId: string;
  filenamePrefix?: string;
  title: string;
  getTextToCopy?: () => string;
  getTextContent?: () => string;
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
