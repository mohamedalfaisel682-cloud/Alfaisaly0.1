import React from 'react';
import { Smartphone, Monitor, Edit2, TrendingUp, ShieldCheck, Receipt, Sparkles, Crown, CheckCircle2, FileText, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';

export const ReceiptPrintLayout = ({
  task,
  uiSettings,
  exchangeRates,
  systemCurrency,
  formatAmount,
  customId,
  printMode = 'all',
  template,
  fontScale = 'normal',
  maxWidth,
  enabledElements,
  stampLogo,
  signatureLogo,
}: {
  task: any;
  uiSettings: any;
  exchangeRates: any;
  systemCurrency: any;
  formatAmount: any;
  customId?: string;
  printMode?: 'all' | 'financial_only' | 'services_only';
  template?: string;
  fontScale?: 'large' | 'normal' | 'compact';
  maxWidth?: string;
  enabledElements?: string[];
  stampLogo?: string | null;
  signatureLogo?: string | null;
}) => {
  const receiptTemplate = template || uiSettings?.receiptTemplate || 'default';
  const copyPreferences = uiSettings?.copyPreferences || ['المشكلة'];
  const applyWhatsAppPrefsOnPrint = uiSettings?.applyWhatsAppPrefsOnPrint || false;

  const isElemEnabled = (name: string): boolean => {
    if (!enabledElements || enabledElements.length === 0) return true;
    return enabledElements.includes(name);
  };

  const isLuxury = receiptTemplate === 'luxury' || receiptTemplate === 'receipt-luxury';
  const isModern = receiptTemplate === 'modern' || receiptTemplate === 'receipt-modern';
  const isMobile = receiptTemplate === 'mobile-slip' || receiptTemplate === 'mobile';
  const isCorporate = receiptTemplate === 'corporate-slip' || receiptTemplate === 'corporate';
  const isCompact = receiptTemplate === 'compact-slip' || receiptTemplate === 'compact';
  const isA4 = receiptTemplate === 'unlimited-a4' || receiptTemplate === 'a4';
  const isThermal = receiptTemplate === 'thermal-slip' || receiptTemplate === 'thermal';

  const fontClass = fontScale === 'large' 
    ? 'text-sm' 
    : fontScale === 'compact' 
      ? 'text-[11px]' 
      : 'text-xs';

  return (
    <div
      id={customId || "receipt-live-preview-box"}
      dir="rtl"
      className={cn(
        "p-4 rounded-2xl border transition-all duration-300 font-sans leading-relaxed space-y-3 shadow-xs text-right w-full",
        maxWidth || (isA4 ? "max-w-[540px]" : isMobile ? "max-w-[380px]" : isCorporate ? "max-w-[460px]" : "max-w-[340px]"),
        fontClass,
        // Theme Colors
        (!isLuxury && !isModern && !isMobile && !isCorporate && !isCompact && !isA4 && !isThermal) && "bg-white border-slate-200 text-slate-800",
        isModern && "bg-gradient-to-b from-indigo-50/50 via-sky-50/20 to-white border-indigo-200/70 text-slate-850",
        isLuxury && "bg-[#090d16] border-amber-500/30 text-amber-100",
        isMobile && "bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 border-emerald-300/80 text-slate-900 shadow-sm",
        isCorporate && "bg-white border-slate-300 text-slate-900 ring-1 ring-slate-200 shadow-sm",
        isCompact && "bg-slate-50/90 border-slate-200 text-slate-800 p-2.5 space-y-2",
        isA4 && "bg-white border-2 border-slate-300 text-slate-900 p-6 space-y-4",
        isThermal && "bg-white border-2 border-dashed border-slate-800 font-mono text-black p-3 space-y-2"
      )}
    >
      {/* Store Identity Header */}
      <div className={cn(
        "text-center space-y-1 pb-3 mb-1 border-b border-dashed",
        isLuxury ? "border-amber-500/25" : isModern ? "border-indigo-200/60" : isMobile ? "border-emerald-200" : isThermal ? "border-black" : "border-slate-200"
      )}>
        <div className="flex justify-center items-center gap-1.5">
          {isLuxury ? (
            <Crown className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
          ) : isModern ? (
            <Sparkles className="w-4 h-4 text-indigo-650" />
          ) : isCorporate ? (
            <ShieldCheck className="w-4.5 h-4.5 text-sky-700" />
          ) : isMobile ? (
            <Smartphone className="w-4.5 h-4.5 text-emerald-600" />
          ) : isThermal ? (
            <Receipt className="w-4 h-4 text-black" />
          ) : (
            <Smartphone className="w-4 h-4 text-emerald-600" />
          )}

          <h2 className={cn(
            "text-xs font-black tracking-tight",
            fontScale === 'large' && "text-sm",
            isLuxury && "text-amber-400 font-serif",
            isModern && "text-indigo-950",
            isMobile && "text-emerald-950 font-black",
            isCorporate && "text-slate-950 text-sm",
            isThermal && "text-black uppercase font-bold",
            (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "text-slate-900"
          )}>
            {isLuxury 
              ? '👑 الإيصال الملكي الفاخر مراجع وموثق' 
              : isCorporate 
                ? '🏢 سند استلام وتسليم صيانة رسمي معتمد' 
                : isMobile 
                  ? '📱 سند الصيانة الذكي السريع' 
                  : isThermal 
                    ? '🧾 إيصال صيانة فوري' 
                    : 'سند استلام صيانة معتمد'}
          </h2>
        </div>
        <p className={cn(
          "text-[8px] font-bold text-center",
          fontScale === 'large' && "text-[9.5px]",
          isLuxury && "text-amber-500/70",
          isModern && "text-indigo-600",
          isMobile && "text-emerald-700 font-extrabold",
          isCorporate && "text-slate-600",
          isThermal && "text-black",
          (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "text-slate-500"
        )}>
          {uiSettings?.windowTitles?.['إعدادات النظام'] || 'مركز صيانة الأجهزة والالكترونيات الذكية - Al.faisaly'}
        </p>
      </div>

      {/* Ticket Reference and Date */}
      <div className={cn(
        "flex justify-between items-center text-[9px] font-bold px-2 py-1 rounded-lg",
        fontScale === 'large' && "text-[10.5px]",
        isLuxury && "bg-amber-950/40 text-amber-400 border border-amber-500/20",
        isModern && "bg-indigo-50/60 text-indigo-700 border border-indigo-100",
        isMobile && "bg-emerald-100/70 text-emerald-900 border border-emerald-200",
        isCorporate && "bg-slate-100 text-slate-800 border border-slate-200",
        isThermal && "bg-transparent text-black border-y border-dashed border-black font-mono",
        (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "bg-slate-50 text-slate-600 border border-slate-100"
      )}>
        <span className="font-mono font-black">رقم السند: ALT-TKT-{task?.id || 'NEW'}</span>
        <span>{new Date(task?.createdAt || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      </div>

      {/* Customer Info Card */}
      {isElemEnabled('اسم العميل') && (!applyWhatsAppPrefsOnPrint || copyPreferences.includes('العميل')) && (
        <div className={cn(
          "space-y-1 p-2 rounded-xl border text-[10px]",
          fontScale === 'large' && "text-xs space-y-1.5 p-2.5",
          isLuxury && "bg-slate-900/60 border-amber-500/15 text-amber-50",
          isModern && "bg-white/80 border-indigo-100/60 text-slate-800",
          isMobile && "bg-white border-emerald-200/80 text-slate-900 shadow-2xs",
          isCorporate && "bg-slate-50 border-slate-200 text-slate-900",
          isThermal && "bg-transparent border-b border-black text-black rounded-none p-1",
          (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "bg-slate-50/60 border-slate-150 text-slate-800"
        )}>
          <div className="flex items-center gap-1.5 text-[9px] font-extrabold pb-1 border-b mb-1">
            <span className={cn(
              isLuxury ? "text-amber-500/70 border-amber-500/10" : isModern ? "text-indigo-500 border-indigo-100" : isMobile ? "text-emerald-700 border-emerald-100" : "text-slate-400 border-slate-100"
            )}>العميل:</span>
            <span className="font-black flex-1 text-right truncate text-[10.5px]">
              {task?.customer || 'عميل غير مسجل'}
            </span>
          </div>

          {isElemEnabled('الهاتف') && (!applyWhatsAppPrefsOnPrint || copyPreferences.includes('الهاتف')) && (
            <div className="flex justify-between items-center text-[9.5px]">
              <span className={cn(
                "font-bold",
                isLuxury ? "text-amber-500/70" : isModern ? "text-indigo-400" : isMobile ? "text-emerald-700" : "text-slate-400"
              )}>الهاتف:</span>
              <span className="font-bold font-mono tracking-wider text-slate-800 dark:text-slate-200">
                {task?.customerPhones?.length > 0 ? task.customerPhones.join('، ') : 'لا يوجد رقم هاتف'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Devices Section */}
      {isElemEnabled('الأجهزة') && printMode !== 'financial_only' && (!applyWhatsAppPrefsOnPrint || copyPreferences.includes('الأجهزة')) && (
        <div className={cn(
          "space-y-1.5 p-2 rounded-xl border text-[10px]",
          fontScale === 'large' && "text-xs p-2.5",
          isLuxury && "bg-slate-900/60 border-amber-500/15 text-amber-100",
          isModern && "bg-white/80 border-indigo-200/50 text-slate-800",
          isMobile && "bg-white border-emerald-200/80 text-slate-900 shadow-2xs",
          isCorporate && "bg-slate-50 border-slate-200 text-slate-900",
          isThermal && "bg-transparent border-b border-black text-black rounded-none p-1",
          (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "bg-slate-50 border-slate-150 text-slate-800"
        )}>
          <div className={cn(
            "flex items-center gap-1.5 text-[9px] font-extrabold pb-1 border-b mb-1",
            isLuxury ? "text-amber-400 border-amber-500/10" : isModern ? "text-indigo-800 border-indigo-100/40" : isMobile ? "text-emerald-800 border-emerald-100" : "text-indigo-600 border-slate-100"
          )}>
            <Monitor className="w-3.5 h-3.5" />
            <span>تفاصيل الأجهزة ({task?.devices?.length || 1})</span>
          </div>
          <div className="space-y-1 text-[10px] font-bold">
            {(task?.devices || []).length > 0 ? task.devices.map((d: any, index: number) => (
              <div key={index} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                <span>جهاز #{index + 1}: <span className={cn(
                  "font-extrabold",
                  isLuxury ? "text-amber-300" : isModern ? "text-indigo-755" : isMobile ? "text-emerald-800" : "text-indigo-700"
                )}>{d.type || 'غير محدد'}</span></span>
                {isElemEnabled('الموديل') && (!applyWhatsAppPrefsOnPrint || copyPreferences.includes('الموديل')) && (
                  <span>الموديل: <span className={cn(
                    "font-extrabold",
                    isLuxury ? "text-amber-400" : isModern ? "text-indigo-700" : isMobile ? "text-emerald-700" : "text-emerald-700"
                  )}>{d.brand || 'غير محدد'}</span></span>
                )}
              </div>
            )) : (
              <div className="flex justify-between items-center">
                <span>جهاز: <span className="font-extrabold">{task?.deviceType || 'غير محدد'}</span></span>
                {isElemEnabled('الموديل') && <span>الموديل: <span className="font-extrabold">{task?.brand || 'غير محدد'}</span></span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financials Card */}
      {printMode !== 'services_only' && (isElemEnabled('التكلفة') || isElemEnabled('المقدم') || isElemEnabled('المتبقي')) && (
        <div className={cn(
          "p-2 rounded-xl border text-[10px]",
          fontScale === 'large' && "text-xs p-2.5",
          isLuxury && "bg-slate-900/60 border-amber-500/15 text-amber-100",
          isModern && "bg-indigo-50/20 border-indigo-100/50 text-slate-800",
          isMobile && "bg-white border-emerald-200/90 text-slate-900 shadow-2xs",
          isCorporate && "bg-slate-50 border-slate-200 text-slate-900",
          isThermal && "bg-transparent border-b border-black text-black rounded-none p-1",
          (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "bg-white border-slate-150 text-slate-800"
        )}>
          <div className={cn(
            "flex items-center gap-1.5 text-[9px] font-extrabold pb-1 border-b mb-1.5",
            isLuxury ? "text-amber-400 border-amber-500/10" : isModern ? "text-indigo-800 border-indigo-100/40" : isMobile ? "text-emerald-800 border-emerald-100" : "text-emerald-800 border-slate-100"
          )}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>الحساب والالتزام المالي للمهمة</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
            {isElemEnabled('التكلفة') && (
              <div className={cn(
                "p-1.5 rounded-lg border",
                isLuxury ? "bg-slate-950 border-amber-500/15 text-amber-100" : "bg-blue-500/12 border-blue-200/80 text-slate-950"
              )}>
                <p className={cn("text-[7.5px] font-bold", isLuxury ? "text-amber-400" : "text-blue-700")}>التكلفة</p>
                <p className="font-black mt-0.5 text-[10.5px]">
                  {task?.cost || 0} {task?.currency || 'RY'}
                </p>
              </div>
            )}
            {isElemEnabled('المقدم') && (
              <div className={cn(
                "p-1.5 rounded-lg border",
                isLuxury ? "bg-amber-955/20 text-amber-200 border-amber-500/20" : "bg-emerald-500/12 border-emerald-200/80 text-slate-950"
              )}>
                <p className={cn("text-[7.5px] font-bold", isLuxury ? "text-emerald-400" : "text-emerald-700")}>الواصل (المقدم)</p>
                <p className="font-black mt-0.5 text-[10.5px]">
                  {task?.deposit || 0} {task?.currency || 'RY'}
                </p>
              </div>
            )}
            {isElemEnabled('المتبقي') && (
              <div className={cn(
                "p-1.5 rounded-lg border",
                isLuxury ? "bg-red-500/20 text-amber-300 border-red-500/35" : "bg-red-500/20 border-red-300/80 text-slate-950"
              )}>
                <p className={cn("text-[7.5px] font-bold", isLuxury ? "text-red-400" : "text-red-700")}>المتبقي</p>
                <p className="font-black mt-0.5 text-[10.5px]">
                  {Math.max(0, (task?.cost || 0) - (task?.deposit || 0))} {task?.currency || 'RY'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diagnostics / Issue Card */}
      {isElemEnabled('المشكلة') && printMode !== 'financial_only' && (
        <div className={cn(
          "p-2 rounded-xl border space-y-1 text-[10px]",
          fontScale === 'large' && "text-xs p-2.5",
          isLuxury && "bg-slate-900/60 border-amber-500/15 text-amber-100",
          isModern && "bg-indigo-50/20 border-indigo-100/30 text-slate-800",
          isMobile && "bg-white border-emerald-200/80 text-slate-900 shadow-2xs",
          isCorporate && "bg-slate-50 border-slate-200 text-slate-900",
          isThermal && "bg-transparent border-b border-black text-black rounded-none p-1",
          (!isLuxury && !isModern && !isMobile && !isCorporate && !isThermal) && "bg-[#fffbeb] border-amber-105 text-slate-800"
        )}>
          <div className={cn(
            "flex items-center gap-1.5 text-[9px] font-extrabold pb-1 border-b mb-0.5",
            isLuxury ? "text-amber-400 border-amber-500/10" : isModern ? "text-indigo-800 border-indigo-100/40" : isMobile ? "text-emerald-800 border-emerald-100" : "text-slate-800 border-slate-100"
          )}>
            <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>التشغيل والتشخيص والمشكلة</span>
          </div>
          <div className={cn(
            "p-1.5 rounded-lg text-[9px] font-bold leading-relaxed whitespace-pre-wrap border text-right",
            fontScale === 'large' && "text-[10.5px]",
            isLuxury ? "bg-slate-950 border-amber-500/15 text-amber-100" : isModern ? "bg-indigo-55/10 border-indigo-100/35 text-slate-850" : isMobile ? "bg-emerald-50/40 border-emerald-150 text-slate-900" : "bg-slate-50 border-slate-150 text-slate-850"
          )}>
            {task?.issue || 'لا يوجد عطل مسجل.'}
          </div>
        </div>
      )}

      {/* Corporate Stamp & Signature Boxes (if Corporate template or enabled) */}
      {(isCorporate || isElemEnabled('الختم')) && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[8px] font-bold text-slate-600">
          <div className="border border-dashed border-slate-300 rounded-xl p-2 text-center space-y-1 bg-slate-50/50">
            <span>توقيع وختم الفني المستلم</span>
            <div className="min-h-7 flex items-center justify-center gap-2">
              {stampLogo ? (
                <img src={stampLogo} alt="الختم الرسمي" className="max-h-8 max-w-[65px] object-contain" style={{ mixBlendMode: 'multiply' }} />
              ) : null}
              {signatureLogo ? (
                <img src={signatureLogo} alt="التوقيع المعتمد" className="max-h-7 max-w-[65px] object-contain" style={{ mixBlendMode: 'multiply' }} />
              ) : null}
              {!stampLogo && !signatureLogo && (
                <ShieldCheck className="w-5 h-5 text-slate-400/50" />
              )}
            </div>
          </div>
          <div className="border border-dashed border-slate-300 rounded-xl p-2 text-center space-y-2 bg-slate-50/50">
            <span>توقيع العميل / المفوض</span>
            <div className="h-6 flex items-center justify-center text-slate-300">
              ...........................
            </div>
          </div>
        </div>
      )}

      {/* Visual Barcode Segment */}
      {isElemEnabled('الباركود') && (
        <div className="mt-1 space-y-0.5 opacity-75">
          <div className="flex justify-center items-center h-4 overflow-hidden gap-px">
            {[2, 1, 4, 1, 2, 3, 1, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 4].map((w, i) => (
              <div key={i} className={cn("h-full", isLuxury ? "bg-amber-700/50" : "bg-slate-800")} style={{ width: `${w}px` }} />
            ))}
          </div>
          <p className={cn("text-[7px] font-mono font-bold text-center", isLuxury ? "text-amber-600/70" : "text-slate-400")}>
            SECURE-ID-TKT-{task?.id || 'NEW'}
          </p>
        </div>
      )}

      {/* Footer Notes Terms and Conditions */}
      {isElemEnabled('شروط الاستلام') && (
        <div className={cn("text-center space-y-0.5 mt-1 border-t pt-2 pb-0.5", isLuxury ? "border-amber-500/20" : "border-slate-150")}>
          <p className={cn("text-[9px] font-black", isLuxury ? "text-amber-300" : "text-slate-800")}>شاكرين ومقدرين حسن اختياركم وثقتكم بنا</p>
          <p className={cn("text-[8px] font-medium leading-tight", isLuxury ? "text-amber-500/60" : "text-slate-400")}>
            يرجى إبراز هذا السند لإثبات ملكية جهازك عند الاستلام. فترة الضمان تخضع لشروط الصيانة.
          </p>
        </div>
      )}
    </div>
  );
};
export default ReceiptPrintLayout;
