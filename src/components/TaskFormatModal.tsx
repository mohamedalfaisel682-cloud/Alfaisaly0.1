import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  Monitor,
  Printer,
  FileText,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Download,
  RotateCcw,
  Type,
  LayoutGrid,
  ShieldCheck,
  Receipt,
  Crown,
  Eye,
  Settings2,
  Share2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import {
  AppExportSettings,
  getExportSettings,
  saveExportSettings,
  resetExportSettings,
} from '../utils/exportSettings';
import { ReceiptPrintLayout } from './ReceiptPrintLayout';

export interface TaskTemplateItem {
  id: string;
  title: string;
  desc: string;
  badge?: string;
  tags: string[];
  icon: React.ElementType;
}

export const TASK_TEMPLATES_CATALOG: TaskTemplateItem[] = [
  {
    id: 'receipt-default',
    title: '🎟️ سند الصيانة الكلاسيكي المعتمد',
    desc: 'التصميم التقليدي المعتمد لمراكز الصيانة؛ خطوط واضحة وهوامش متوازنة تجمع كافة بيانات العميل والماليات في هيكل كلاسيكي أنيق.',
    badge: 'الافتراضي المعتمد',
    tags: ['كلاسيكي', 'متوازن', 'معتمد'],
    icon: Receipt,
  },
  {
    id: 'receipt-modern',
    title: '🔵 سند الصيانة المودرن الحديث',
    desc: 'تصميم نيلي وتقني جذاب بلمسات عصرية وتدرجات لونية هادئة تعكس الاحترافية والتنظيم الإلكتروني الراقي.',
    badge: 'عصري ملون',
    tags: ['مودرن', 'ألوان تقنية', 'احترافي'],
    icon: Sparkles,
  },
  {
    id: 'receipt-luxury',
    title: '👑 سند الصيانة الملكي الفاخر',
    desc: 'تصميم داكن عالي التباين باللونين البني والذهبي الملوكي؛ يعطي فخامة استثنائية للهواتف الرائدة ولأصحاب الذوق الرفيع.',
    badge: 'فخامة ملكية',
    tags: ['داكن وفاخر', 'ذهبي', 'تباين فائق'],
    icon: Crown,
  },
  {
    id: 'mobile-slip',
    title: '📱 سند الجوال الذكي السريع (Note 20)',
    desc: 'مصمم خصيصاً لشاشات الهواتف الذكية (Note 20 Ultra) بدون الحاجة للتكبير أو التصغير؛ بطاقات مقروءة بوضوح فوري ومريحة للعين.',
    badge: 'موصى به للجوال',
    tags: ['بدون تكبير', 'AMOLED 2X', 'سريع'],
    icon: Smartphone,
  },
  {
    id: 'corporate-slip',
    title: '🏢 سند الأعمال والشركات المعتمد',
    desc: 'سند رسمي موثق مزود بصناديق توقيع وختم الفني المستلم والعميل وشروط الاستلام والضمان، ملائم للمؤسسات والشركات.',
    badge: 'رسمي معتمد',
    tags: ['ختم وتوقيع', 'شركات', 'توثيق قانوني'],
    icon: ShieldCheck,
  },
  {
    id: 'compact-slip',
    title: '📋 سند مالي مدمج وموجز',
    desc: 'سند سريع وموجز يركز على الالتزام المالي والتسليم الفوري؛ يوفر مساحة الورق وحبر الطباعة ومخصص للعمليات السريعة.',
    badge: 'موجز مالي',
    tags: ['توفير الحبر', 'مدمج', 'تسليم فوري'],
    icon: LayoutGrid,
  },
  {
    id: 'unlimited-a4',
    title: '🖨️ سند الطباعة الورقية القياسية A4',
    desc: 'مقاس متوافق تماماً مع طابعات المكاتب A4 بهوامش مخصصة للتدبيس والأرشفة الورقية وسجلات الصيانة اليومية.',
    badge: 'للطباعة الورقية',
    tags: ['A4 قياسي', 'أرشفة', 'هوامش واسعة'],
    icon: Printer,
  },
  {
    id: 'thermal-slip',
    title: '🧾 سند الإيصال الحراري الفوري (80 مم)',
    desc: 'تنسيق مونوكروم عالي التباين مخصص لطابعات الفواتير والإيصالات الحرارية POS وطابعات البلوتوث المحمولة.',
    badge: 'طابعات الفواتير',
    tags: ['حراري 80مم', 'بلوتوث', 'أسود وأبيض'],
    icon: Receipt,
  },
];

export const ALL_TASK_ELEMENTS = [
  { id: 'اسم العميل', label: 'اسم العميل وبياناته', desc: 'اسم العميل المسجل في التذكرة' },
  { id: 'الهاتف', label: 'أرقام هواتف العميل', desc: 'أرقام التواصل والواتساب' },
  { id: 'الأجهزة', label: 'قائمة الأجهزة والقطع', desc: 'نوع الأجهزة وعددها وتفاصيلها' },
  { id: 'الموديل', label: 'الموديل والماركة', desc: 'موديل الجهاز وماركته بدقة' },
  { id: 'المشكلة', label: 'وصف المشكلة والتشخيص', desc: 'تقرير الفحص والعطل المسجل' },
  { id: 'التكلفة', label: 'التكلفة الإجمالية', desc: 'المبلغ الإجمالي المتفق عليه' },
  { id: 'المقدم', label: 'المبلغ المدفوع (المقدم)', desc: 'الدفعة المقدمة المسلمة' },
  { id: 'المتبقي', label: 'المبلغ المتبقي (الحساب)', desc: 'صافي الحساب المتبقي عند الاستلام' },
  { id: 'الباركود', label: 'الباركود والرقم المرجعي', desc: 'شريط الباركود وكود التذكرة' },
  { id: 'الختم', label: 'أختام وتواقيع الاستلام', desc: 'صندوق توقيع الفني وتوقيع العميل' },
  { id: 'شروط الاستلام', label: 'شروط الاستلام والضمان', desc: 'تنبيهات الضمان وإثبات الملكية' },
];

interface TaskFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  uiSettings: any;
  exchangeRates: any;
  systemCurrency: any;
  formatAmount: any;
  onExportPDF?: (task: any, settings: AppExportSettings) => void;
  onExportImage?: (task: any, settings: AppExportSettings) => void;
  onPrintDirect?: (task: any, settings: AppExportSettings) => void;
}

export const TaskFormatModal: React.FC<TaskFormatModalProps> = ({
  isOpen,
  onClose,
  task,
  uiSettings,
  exchangeRates,
  systemCurrency,
  formatAmount,
  onExportPDF,
  onExportImage,
  onPrintDirect,
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'layout' | 'resolution' | 'elements' | 'preview'>('templates');
  const [exportSettings, setExportSettings] = useState<AppExportSettings>(getExportSettings());

  useEffect(() => {
    if (isOpen) {
      setExportSettings(getExportSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateSetting = (partial: Partial<AppExportSettings>) => {
    const updated = saveExportSettings(partial);
    setExportSettings(updated);
  };

  const currentTemplate = exportSettings.taskDefaultTemplate || 'receipt-default';
  const currentElements = exportSettings.taskElements || ALL_TASK_ELEMENTS.map(e => e.id);

  const handleToggleElement = (elementId: string) => {
    let next: string[];
    if (currentElements.includes(elementId)) {
      next = currentElements.filter(id => id !== elementId);
    } else {
      next = [...currentElements, elementId];
    }
    handleUpdateSetting({ taskElements: next });
  };

  const handleSelectAllElements = () => {
    const all = ALL_TASK_ELEMENTS.map(e => e.id);
    handleUpdateSetting({ taskElements: all });
    toast.success('تم تفعيل كافة عناصر وحقول السند');
  };

  const handleSelectEssentialElements = () => {
    const essentials = ['اسم العميل', 'الهاتف', 'الأجهزة', 'التكلفة', 'المقدم', 'المتبقي', 'المشكلة'];
    handleUpdateSetting({ taskElements: essentials });
    toast.success('تم تفعيل الحقول والبيانات الأساسية فقط');
  };

  // Sample mock task for preview if real task is missing
  const sampleTask = task || {
    id: 'SAMPLE-108',
    customer: 'أحمد الفيصلي (معاينة تجريبية)',
    customerPhones: ['777000111', '733000222'],
    devices: [{ type: 'سامسونج جالكسي نوت 20 ألترا', brand: 'Samsung Galaxy Note 20 Ultra' }],
    deviceType: 'سامسونج نوت 20 الترا',
    brand: 'Samsung',
    issue: 'شاشة مكسورة + استبدال بطارية أصلية وفحص دائرة الشحن السريع 45W',
    cost: 45000,
    deposit: 15000,
    currency: 'ريال يمني',
    createdAt: new Date().toISOString(),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>إعدادات وتنسيقات توليد المهمة والسند</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                  صورة ومستند
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حدد النسق الافتراضي لتوليد المهمة كصورة أو كمستند PDF، مع تخصيص الأبعاد والدقة وحجم الخطوط
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'templates', label: '🎨 نماذج السندات (8)', icon: Sparkles },
            { id: 'layout', label: '📐 العرض وحجم الخط', icon: Smartphone },
            { id: 'resolution', label: '💎 الدقة ومقاس الإخراج', icon: SlidersHorizontal },
            { id: 'elements', label: '👁️ تخصيص الحقول', icon: LayoutGrid },
            { id: 'preview', label: '👁️ المعاينة والتوليد', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-amber-500 text-white shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-3.5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <span className="font-black block mb-0.5">حدد نسق المهمة والخيارات الافتراضية للتوليد:</span>
                  يمكنك تحديد نسق مفضل لطباعة المهمة وتوليدها تلقائياً كصورة 🖼️ أو كمستند PDF 📄، بدون الحاجة لتكبير أو تصغير السند على شاشات الهواتف الذكية (Note 20 Ultra).
                </div>
              </div>

              {/* Default Presets Configuration Box */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>تحديد النسق الافتراضي لتوليد المهمة السريع:</span>
                  </span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-extrabold px-2 py-0.5 rounded-full">
                    توليد وحفظ فوري
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Default for Task Image */}
                  <div className="bg-white dark:bg-slate-850 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 space-y-1.5 shadow-2xs">
                    <label className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>النسق الافتراضي عند توليد المهمة كصورة 🖼️:</span>
                    </label>
                    <select
                      value={exportSettings.reportDefaultImageTemplate || 'mobile-slip'}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateSetting({ 
                          reportDefaultImageTemplate: val,
                          taskDefaultTemplate: val 
                        });
                        toast.success(`تم تعيين نسق الصورة الافتراضي للمهمة: ${TASK_TEMPLATES_CATALOG.find(t => t.id === val)?.title || val}`);
                      }}
                      className="w-full text-xs font-bold p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {TASK_TEMPLATES_CATALOG.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                      يُطبّق تلقائياً عند حفظ وتصدير سند المهمة كصورة للمشاركة عبر الواتساب
                    </p>
                  </div>

                  {/* Default for Task Document / PDF */}
                  <div className="bg-white dark:bg-slate-850 p-3 rounded-xl border border-blue-200/80 dark:border-blue-800/40 space-y-1.5 shadow-2xs">
                    <label className="text-xs font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>النسق الافتراضي عند توليد المهمة كمستند PDF 📄:</span>
                    </label>
                    <select
                      value={exportSettings.reportDefaultDocumentTemplate || 'corporate-slip'}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateSetting({ 
                          reportDefaultDocumentTemplate: val,
                          taskDefaultTemplate: val
                        });
                        toast.success(`تم تعيين نسق المستند الافتراضي للمهمة: ${TASK_TEMPLATES_CATALOG.find(t => t.id === val)?.title || val}`);
                      }}
                      className="w-full text-xs font-bold p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {TASK_TEMPLATES_CATALOG.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                      يُطبّق تلقائياً عند تصدير المهمة كمستند PDF أو أمر تسليم رسمي
                    </p>
                  </div>
                </div>

                {/* Quick Selection for Default Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                      الإجراء الافتراضي عند طلب توليد السند:
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="taskDefaultExportType"
                          checked={(exportSettings.taskDefaultExportType || 'pdf') === 'pdf'}
                          onChange={() => handleUpdateSetting({ taskDefaultExportType: 'pdf' })}
                          className="text-indigo-600"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">مستند PDF</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="taskDefaultExportType"
                          checked={exportSettings.taskDefaultExportType === 'image'}
                          onChange={() => handleUpdateSetting({ taskDefaultExportType: 'image' })}
                          className="text-emerald-600"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">صورة JPG</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="taskDefaultExportType"
                          checked={exportSettings.taskDefaultExportType === 'print'}
                          onChange={() => handleUpdateSetting({ taskDefaultExportType: 'print' })}
                          className="text-amber-600"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">طباعة مباشرة</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportSettings.autoSwitchToDefaultOnExport !== false}
                      onChange={(e) => handleUpdateSetting({ autoSwitchToDefaultOnExport: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                      التبديل التلقائي إلى النسق الافتراضي عند طلب التوليد
                    </span>
                  </label>
                </div>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TASK_TEMPLATES_CATALOG.map((tmpl) => {
                  const isSelected = currentTemplate === tmpl.id;
                  const isDefaultImage = (exportSettings.reportDefaultImageTemplate || 'mobile-slip') === tmpl.id;
                  const isDefaultDoc = (exportSettings.reportDefaultDocumentTemplate || 'corporate-slip') === tmpl.id;
                  const Icon = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => {
                        handleUpdateSetting({ taskDefaultTemplate: tmpl.id });
                        toast.success(`تم اختيار ${tmpl.title}`);
                      }}
                      className={cn(
                        "text-right p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 cursor-pointer relative shadow-xs",
                        isSelected
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-md ring-2 ring-amber-500/20"
                          : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                              isSelected ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            )}>
                              <Icon className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <span className="text-xs sm:text-sm font-black text-slate-950 dark:text-white leading-tight">
                              {tmpl.title}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs" title="النسق المحدد حالياً">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Badges for Defaults */}
                        {(isDefaultImage || isDefaultDoc) && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {isDefaultImage && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-emerald-600" />
                                <span>الافتراضي للصورة 🖼️</span>
                              </span>
                            )}
                            {isDefaultDoc && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-blue-600" />
                                <span>الافتراضي للمستند 📄</span>
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-slate-800 dark:text-slate-200 font-bold leading-relaxed mb-3 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                          {tmpl.desc}
                        </p>
                      </div>

                      {/* Quick Buttons to set as Default */}
                      <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateSetting({ 
                                reportDefaultImageTemplate: tmpl.id,
                                taskDefaultTemplate: tmpl.id 
                              });
                              toast.success(`تم تعيين "${tmpl.title.slice(0, 25)}" كالنسق الافتراضي لصورة المهمة 🖼️`);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isDefaultImage
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                : "bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            )}
                            title="تعيين هذا النسق تلقائياً عند تصدير المهمة كصورة"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>{isDefaultImage ? '✓ افتراضي الصورة' : 'تعيين للصورة 🖼️'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateSetting({ 
                                reportDefaultDocumentTemplate: tmpl.id,
                                taskDefaultTemplate: tmpl.id 
                              });
                              toast.success(`تم تعيين "${tmpl.title.slice(0, 25)}" كالنسق الافتراضي لمستند المهمة 📄`);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isDefaultDoc
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                : "bg-blue-50/70 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            )}
                            title="تعيين هذا النسق تلقائياً عند تصدير المهمة كمستند PDF"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{isDefaultDoc ? '✓ افتراضي المستند' : 'تعيين للمستند 📄'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1 pt-1 border-t border-dashed border-slate-100 dark:border-slate-800">
                          {tmpl.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded-md",
                                isSelected
                                  ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              )}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT & DISPLAY (Mobile & PC without Zooming) */}
          {activeTab === 'layout' && (
            <div className="space-y-5">
              {/* Task Print Mode */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      أسلوب ونمط محتوى سند المهمة
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    مخصص للجوال والكمبيوتر
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'all',
                      title: '📑 سند كامل تفصيلي',
                      desc: 'يعرض كافة أقسام السند: العميل، الأجهزة، التشخيص والأعطال، الحساب المالي، والباركود والأختام.',
                      badge: 'النمط الشامل',
                    },
                    {
                      id: 'financial_only',
                      title: '💰 ملخص مالي فقط',
                      desc: 'يركز على الدفعات والتكلفة والمقدم والمتبقي لإبراء الذمة والتحصيل المالي السريع.',
                      badge: 'للتحصيل المالي',
                    },
                    {
                      id: 'services_only',
                      title: '🛠️ خدمات وأجهزة فقط',
                      desc: 'مخصص لورش الصيانة والفنيين: يبرز نوع الجهاز، الموديل، الفحص، والتشخيص دون إظهار الأسعار.',
                      badge: 'للفنيين والورشة',
                    },
                  ].map((mode) => {
                    const isSelected = (exportSettings.taskPrintMode || 'all') === mode.id;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => {
                          handleUpdateSetting({ taskPrintMode: mode.id as any });
                          toast.success(`تم اختيار: ${mode.title}`);
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-right",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{mode.title}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-2">
                            {mode.desc}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md self-start">
                          {mode.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Font Scale Configuration */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      حجم خطوط وبيانات السند (حل مشكلة تكبير الشاشة)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">وضوح مريح للنظر</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'large',
                      title: 'كبير وواضح جداً (موصى به)',
                      desc: 'خطوط عريضة ومريحة لقراءة السند فورياً على جوال Note 20 Ultra والواتساب بدون تكبير.',
                    },
                    {
                      id: 'normal',
                      title: 'متوازن قياسي',
                      desc: 'الحجم القياسي الملائم للشاشات والطابعات مع الحفاظ على التناسق البصري.',
                    },
                    {
                      id: 'compact',
                      title: 'مدمج وموفر للمساحة',
                      desc: 'خطوط أصغر لحشر كافة البيانات في مساحة صغيرة أو إيصال حراري فوري.',
                    },
                  ].map((scale) => {
                    const isSelected = (exportSettings.taskFontScale || 'normal') === scale.id;
                    return (
                      <div
                        key={scale.id}
                        onClick={() => {
                          handleUpdateSetting({ taskFontScale: scale.id as any });
                          toast.success(`تم اختيار حجم الخط: ${scale.title}`);
                        }}
                        className={cn(
                          "p-3 rounded-2xl border-2 transition-all cursor-pointer text-right",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{scale.title}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {scale.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page Width & Target */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      أبعاد وعرض السند
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">ملاءمة العرض</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'mobile',
                      title: '📱 ملائم للجوال (380px)',
                      desc: 'يتوافق تماماً مع شاشات الجوال وهواتف Samsung Note 20 دون تمرير أفقي.',
                    },
                    {
                      id: 'desktop',
                      title: '💻 متوازن للشاشات (480px)',
                      desc: 'عرض متوازن للكمبيوتر واللوحات اللوحية والشاشات العريضة.',
                    },
                    {
                      id: 'a4',
                      title: '🖨️ عريض A4 قياسي (540px)',
                      desc: 'عرض مخصص للطباعة الورقية الكاملة وحفظ المستندات الرسمية.',
                    },
                  ].map((w) => {
                    const isSelected = (exportSettings.taskPageWidth || 'mobile') === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => {
                          handleUpdateSetting({ taskPageWidth: w.id as any });
                          toast.success(`تم اختيار العرض: ${w.title}`);
                        }}
                        className={cn(
                          "p-3 rounded-2xl border-2 transition-all cursor-pointer text-right",
                          isSelected
                            ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{w.title}</span>
                          {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {w.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESOLUTION & EXPORT DIMENSIONS */}
          {activeTab === 'resolution' && (
            <div className="space-y-4">
              <div className="bg-sky-50 dark:bg-sky-950/30 p-4 rounded-2xl border border-sky-200 dark:border-sky-800 space-y-1">
                <span className="text-xs font-black text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>دقة وجودة إخراج السند والصورة (شاشات AMOLED 2X):</span>
                </span>
                <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
                  تمت مضاعفة دقة التوليد بمقدار 2.5x و 3x لتظهر النصوص العربية والأرقام والباركود بوضوح فائق ومريح للعين عند الإرسال بالواتساب أو الطباعة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    preset: 'ultra',
                    scale: 3,
                    label: 'فائقة جداً (3x Retina)',
                    desc: 'أقصى حدة نصوص مجهرية؛ مثالية لشاشة Note 20 Ultra والطباعة الفاخرة.',
                    badge: 'نقاء مذهل',
                  },
                  {
                    preset: 'high',
                    scale: 2.5,
                    label: 'عالية (2.5x HD)',
                    desc: 'متوازنة جداً بين الحجم الصغير والجودة العالية للواتساب والأرشفة.',
                    badge: 'موصى به',
                  },
                  {
                    preset: 'standard',
                    scale: 2,
                    label: 'قياسية (2x)',
                    desc: 'أسرع في التوليد وحجم ملف أصغر للمشاركات السريعة والشبكات الضعيفة.',
                    badge: 'حجم خفيف',
                  },
                ].map((res) => {
                  const isSelected = (exportSettings.customScale || (exportSettings.quality === 'ultra' ? 3 : 2.5)) === res.scale;
                  return (
                    <div
                      key={res.scale}
                      onClick={() => {
                        handleUpdateSetting({ 
                          quality: res.preset as any,
                          customScale: res.scale 
                        });
                        toast.success(`تم تعيين الدقة: ${res.label}`);
                      }}
                      className={cn(
                        "p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-right flex flex-col justify-between",
                        isSelected
                          ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 ring-2 ring-sky-500/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{res.label}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                          {res.desc}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 px-2 py-0.5 rounded-md self-start">
                        {res.badge}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Target Format & Quality Slider */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Image Format */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      صيغة ملف الصورة المصدرة:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { mime: 'image/jpeg', label: 'JPEG' },
                        { mime: 'image/png', label: 'PNG' },
                        { mime: 'image/webp', label: 'WEBP' }
                      ].map((item) => (
                        <button
                          key={item.mime}
                          type="button"
                          onClick={() => {
                            handleUpdateSetting({ imageFormat: item.mime as any });
                            toast.success(`تم اختيار صيغة الصورة: ${item.label}`);
                          }}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer",
                            (exportSettings.imageFormat || 'image/jpeg') === item.mime
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:border-amber-500"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Percentage */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>نسبة جودة الضغط:</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                        {Math.round((exportSettings.imageQuality || 0.95) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="1.0"
                      step="0.05"
                      value={exportSettings.imageQuality || 0.95}
                      onChange={(e) => handleUpdateSetting({ imageQuality: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>60% (خفيف)</span>
                      <span>80%</span>
                      <span>95% (موصى به)</span>
                      <span>100% (أقصى جودة)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ELEMENTS & FIELDS CUSTOMIZATION */}
          {activeTab === 'elements' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    تحديد العناصر والحقول المراد ظهورها في السند:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    يمكنك إخفاء أو إظهار أي عنصر بما يناسب سرية البيانات أو طبيعة المهمة
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllElements}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectEssentialElements}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    الأساسية فقط
                  </button>
                </div>
              </div>

              {/* Elements Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_TASK_ELEMENTS.map((elem) => {
                  const isChecked = currentElements.includes(elem.id);
                  return (
                    <label
                      key={elem.id}
                      onClick={() => handleToggleElement(elem.id)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none text-right",
                        isChecked
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-2xs"
                          : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {elem.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {elem.desc}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>

              {/* WhatsApp Integration Toggle */}
              <div className="p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 block">
                    مزامنة وتطبيق تفضيلات الواتساب على السند
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    استخدام نفس إعدادات نسخ الواتساب المحفوظة في خيارات النظام عند طباعة المهمة
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={exportSettings.applyWhatsAppPrefsOnTaskPrint || false}
                  onChange={(e) => handleUpdateSetting({ applyWhatsAppPrefsOnTaskPrint: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
              </div>
            </div>
          )}

          {/* TAB 5: LIVE INTERACTIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>معاينة حية ومباشرة للسند بالسياق المختار:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {TASK_TEMPLATES_CATALOG.find(t => t.id === currentTemplate)?.title}
                </span>
              </div>

              {/* Centered Preview Container */}
              <div className="bg-slate-100 dark:bg-slate-950/80 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex justify-center items-center overflow-x-auto min-h-[300px]">
                <ReceiptPrintLayout
                  task={sampleTask}
                  uiSettings={{
                    ...uiSettings,
                    receiptTemplate: currentTemplate,
                  }}
                  exchangeRates={exchangeRates}
                  systemCurrency={systemCurrency}
                  formatAmount={formatAmount}
                  template={currentTemplate}
                  fontScale={exportSettings.taskFontScale || 'normal'}
                  enabledElements={currentElements}
                  printMode={exportSettings.taskPrintMode || 'all'}
                  customId="task-format-modal-preview-box"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetExportSettings();
                handleUpdateSetting({
                  taskDefaultTemplate: 'receipt-default',
                  reportDefaultImageTemplate: 'mobile-slip',
                  reportDefaultDocumentTemplate: 'corporate-slip',
                  taskFontScale: 'normal',
                  taskPageWidth: 'mobile',
                  taskPrintMode: 'all',
                });
                toast.success('تمت استعادة الإعدادات الافتراضية للجوال (Note 20 Ultra)');
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Generate Document PDF */}
            <button
              type="button"
              onClick={() => {
                if (onExportPDF) {
                  onExportPDF(sampleTask, exportSettings);
                } else {
                  toast.success('تم تحديد أمر تصدير المستند PDF');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="توليد مستند PDF بالنسق المختار"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>مستند PDF</span>
            </button>

            {/* Quick Generate Image */}
            <button
              type="button"
              onClick={() => {
                if (onExportImage) {
                  onExportImage(sampleTask, exportSettings);
                } else {
                  toast.success('تم تحديد أمر تصدير الصورة');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="توليد وحفظ كصورة بالنسق المختار"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>صورة JPG</span>
            </button>

            {/* Direct Print */}
            <button
              type="button"
              onClick={() => {
                if (onPrintDirect) {
                  onPrintDirect(sampleTask, exportSettings);
                } else {
                  toast.success('تم إرسال أمر الطباعة');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
              title="طباعة فورية"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            {/* Apply & Close */}
            <button
              type="button"
              onClick={() => {
                onClose();
                toast.success('✅ تم حفظ إعدادات المهمة وتعيين النمط بنجاح!', { icon: '✨' });
              }}
              className="px-5 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وإغلاق</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
