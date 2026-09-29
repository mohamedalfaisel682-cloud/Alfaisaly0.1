import React, { useState, useEffect } from 'react';
import {
  Palette,
  LayoutGrid,
  Smartphone,
  Monitor,
  Printer,
  FileText,
  Sliders,
  Check,
  CheckCircle2,
  Sparkles,
  Layers,
  Type,
  Image as ImageIcon,
  TrendingUp,
  ArrowUpDown,
  Eye,
  SlidersHorizontal,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  CreditCard,
  ShieldCheck,
  Crown,
  FileSpreadsheet,
  Receipt
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  AppExportSettings,
  PageSizeFormat,
  QualityPreset,
  ExportImageFormat,
  ExportOrientation,
  getExportSettings,
  saveExportSettings,
  resetExportSettings,
  resolveExportDimensions
} from '../utils/exportSettings';
import toast from 'react-hot-toast';

export interface ReportFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReportTemplate: string;
  onSelectTemplate: (templateId: string) => void;
  reportViewMode: 'cards' | 'table' | 'compact';
  onViewModeChange: (mode: 'cards' | 'table' | 'compact') => void;
  reportFontScale: 'large' | 'normal' | 'compact';
  onFontScaleChange: (scale: 'large' | 'normal' | 'compact') => void;
  reportPageWidth: 'mobile' | 'desktop' | 'full' | 'a4';
  onPageWidthChange: (width: 'mobile' | 'desktop' | 'full' | 'a4') => void;
  reportSortBy: string;
  onSortByChange: (sortBy: string) => void;
  reportElements: string[];
  onReportElementsChange: (elements: string[]) => void;
  reportIncludeImages: boolean;
  onIncludeImagesChange: (include: boolean) => void;
  isInteractiveChartsEnabled: boolean;
  onInteractiveChartsChange: (enabled: boolean) => void;
  onApplyAndRefresh: () => void;
}

export const REPORT_TEMPLATES_CATALOG = [
  {
    id: 'mobile-flow',
    title: '📱 1. قالب الجوال الذكي بدون تكبير (Mobile Smart Flow)',
    desc: 'مصمم خصيصاً لهواتف أندرويد (Note 20 Ultra) يعرض البيانات والمهام في بطاقات مدمجة متسلسلة وخطوط واضحة دون أي حاجة للتكبير أو التصغير أو التمرير الأفقي.',
    category: 'mobile',
    tags: ['الأفضل للجوال', 'بدون تكبير', 'بطاقات متجاوبة', 'نوت 20 ألترا'],
    icon: Smartphone,
    color: 'emerald'
  },
  {
    id: 'receipt-default',
    title: '🎟️ 2. سند الصيانة الكلاسيكي المعتمد (الافتراضي)',
    desc: 'تصميم سند الاستلام والتقرير التقليدي الفاتح مع ترويسة وهوامش معتمدة وتفاصيل فنية متوازنة.',
    category: 'receipt',
    tags: ['كلاسيكي', 'سند صيانة', 'فاتح'],
    icon: Receipt,
    color: 'slate'
  },
  {
    id: 'receipt-modern',
    title: '🔵 3. سند الصيانة المودرن الحديث',
    desc: 'تنسيق ملوّن بلون نيلي أنيق يعكس الاحترافية والتطور التقني والتنظيم الرقمي العالي.',
    category: 'receipt',
    tags: ['مودرن', 'نيلي فخم', 'أنيق'],
    icon: Sparkles,
    color: 'indigo'
  },
  {
    id: 'receipt-luxury',
    title: '👑 4. سند الصيانة الملكي الفاخر (البني والذهبي)',
    desc: 'تنسيق داكن فخم بخلفية بنية داكنة وتفاصيل مذهبة عالية التباين والوضوح لافتة للنظر.',
    category: 'luxury',
    tags: ['ملكي فاخر', 'بني وذهبي', 'عالي التباين'],
    icon: Crown,
    color: 'amber'
  },
  {
    id: 'executive-stats',
    title: '📊 5. لوحة المؤشرات والإحصائيات التنفيذية (Executive Stats)',
    desc: 'قالب تحليلي تنفيذي داكن للشاشات والكمبيوتر يركز على الرسوم البيانية، نسب الإنجاز، مؤشرات الأرباح الصافية، وترتيب الأعطال والعملاء.',
    category: 'stats',
    tags: ['إحصائي وتحليلي', 'كمبيوتر وشاشات', 'رسوم بيانية', 'أداء وأرباح'],
    icon: TrendingUp,
    color: 'blue'
  },
  {
    id: 'dense-table',
    title: '📑 6. قالب الجداول المكثفة الدقيقة (Dense Compact Table)',
    desc: 'جدول خطي فائق الكثافة بدون مساحات مهدرة، يجمع أكبر عدد ممكن من المهام بوضوح مريح للعين على شاشات الحواسيب والمستندات المطولة.',
    category: 'table',
    tags: ['جدول مكثف', 'للكمبيوتر والشاشات', 'أعلى سعة بيانات'],
    icon: FileSpreadsheet,
    color: 'cyan'
  },
  {
    id: 'corporate-business',
    title: '🏢 7. قالب الأعمال والشركات المعتمد (Corporate Business)',
    desc: 'ترويسة أعمال رسمية بالبيانات والاعتمادات وتنسيق مالي شامل مع جدول مفصل وإقرارات وتواقيع معتمدة.',
    category: 'corporate',
    tags: ['رسمي للشركات', 'ترويسة كاملة', 'توثيق معتمد'],
    icon: ShieldCheck,
    color: 'sky'
  },
  {
    id: 'short-fit',
    title: '📋 8. مختصر ذكي متجاوب',
    desc: 'قالب أخضر زمردي أنيق متجاوب ذكي للملفات والتقارير السريعة والمتوسطة.',
    category: 'compact',
    tags: ['مختصر وسريع', 'أخضر زمردي', 'خفيف'],
    icon: FileText,
    color: 'teal'
  },
  {
    id: 'long-scrollable',
    title: '📘 9. مفصل مع تصفح ذكي',
    desc: 'قالب أزرق مفصل للملفات والتقارير الطويلة مع شريط التصفح الذكي والأقسام المستقلة.',
    category: 'scrollable',
    tags: ['مفصل', 'شريط تصفح', 'أزرق احترافي'],
    icon: Layers,
    color: 'blue'
  },
  {
    id: 'unlimited-a4',
    title: '🖨️ 10. طباعة غير محدودة بالهوامش A4',
    desc: 'تنسيق قياسي مخصص للطباعة الورقية بمقاس A4 بهوامش عريضة كلاسيكية وجودة طباعة عالية.',
    category: 'print',
    tags: ['طباعة A4', 'ورق قياسي', 'هوامش رسمية'],
    icon: Printer,
    color: 'zinc'
  }
];

const ALL_REPORT_ELEMENTS_KEYS = [
  { id: 'توقيع الختم', label: 'توقيع الختم الرسمي', group: 'official' },
  { id: 'الرسوم البيانية', label: 'الرسوم البيانية والإحصائيات', group: 'analytics' },
  { id: 'الملخص المالي', label: 'كروت الملخص المالي الكلي', group: 'financial' },
  { id: 'ملخص المخزون', label: 'كارت ملخص المخزون الإجمالي', group: 'inventory' },
  { id: 'التاريخ', label: 'تاريخ وتوقيت المهام', group: 'task' },
  { id: 'اسم العميل', label: 'اسم العميل', group: 'task' },
  { id: 'الهاتف', label: 'هاتف العميل', group: 'task' },
  { id: 'نوع الجهاز', label: 'نوع الجهاز والماركة والموديل', group: 'task' },
  { id: 'الحالة', label: 'شارة حالة المهمة', group: 'task' },
  { id: 'المشكلة', label: 'وصف العطل والمشكلة', group: 'task' },
  { id: 'التكلفة', label: 'التكلفة الإجمالية', group: 'financial' },
  { id: 'المقدم', label: 'المبلغ المدفوع (المقدم)', group: 'financial' },
  { id: 'المتبقي', label: 'المبلغ المتبقي (الحساب/الدين)', group: 'financial' },
  { id: 'بيانات المخزون التفصيلية', label: 'جدول تفاصيل المخزون والأصناف', group: 'inventory' },
  { id: 'بيانات العملاء التفصيلية', label: 'جدول تفاصيل العملاء والإيرادات', group: 'customer' },
  { id: 'المعاملات المالية التفصيلية', label: 'جدول المعاملات المالية التفصيلية', group: 'financial' }
];

export const ReportFormatModal: React.FC<ReportFormatModalProps> = ({
  isOpen,
  onClose,
  selectedReportTemplate,
  onSelectTemplate,
  reportViewMode,
  onViewModeChange,
  reportFontScale,
  onFontScaleChange,
  reportPageWidth,
  onPageWidthChange,
  reportSortBy,
  onSortByChange,
  reportElements,
  onReportElementsChange,
  reportIncludeImages,
  onIncludeImagesChange,
  isInteractiveChartsEnabled,
  onInteractiveChartsChange,
  onApplyAndRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'layout' | 'resolution' | 'sorting' | 'elements'>('templates');
  const [exportSettings, setExportSettings] = useState<AppExportSettings>(getExportSettings());

  useEffect(() => {
    if (isOpen) {
      setExportSettings(getExportSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateExportSetting = (partial: Partial<AppExportSettings>) => {
    const updated = saveExportSettings(partial);
    setExportSettings(updated);
  };

  const handleToggleElement = (elementId: string) => {
    let next: string[];
    if (reportElements.includes(elementId)) {
      next = reportElements.filter(el => el !== elementId);
      if (elementId === 'نوع الجهاز') {
        next = next.filter(el => el !== 'الماركة' && el !== 'الموديل');
      }
    } else {
      next = [...reportElements, elementId];
      if (elementId === 'نوع الجهاز') {
        next.push('الماركة', 'الموديل');
      }
    }
    onReportElementsChange(next);
    localStorage.setItem('reportElements', JSON.stringify(next));
  };

  const handleSelectAllElements = () => {
    const all = ALL_REPORT_ELEMENTS_KEYS.map(e => e.id);
    all.push('الماركة', 'الموديل');
    onReportElementsChange(all);
    localStorage.setItem('reportElements', JSON.stringify(all));
    toast.success('تم تحديد كافة عناصر وحقول التقرير');
  };

  const handleDeselectAllElements = () => {
    onReportElementsChange(['اسم العميل', 'نوع الجهاز', 'الحالة']);
    localStorage.setItem('reportElements', JSON.stringify(['اسم العميل', 'نوع الجهاز', 'الحالة']));
    toast.success('تم الإبقاء على الحقول الأساسية فقط');
  };

  const resolved = resolveExportDimensions(exportSettings, selectedReportTemplate.startsWith('receipt-') || selectedReportTemplate === 'mobile-flow');

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/60 via-slate-50 to-indigo-50/60 dark:from-slate-850 dark:to-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>تخصيص وتنسيق التقرير الشامل</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                  نماذج وأبعاد ودقة فائقة
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                تنسيقات ذكية تلائم شاشة الجوال (Note 20 Ultra) والكمبيوتر بدون الحاجة للتكبير والتصغير
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation - Full View (No Horizontal Scroll) with 2 Rows and Dropdown */}
        <div className="p-2 sm:p-2.5 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0 text-xs font-black space-y-2">
          {/* Quick Dropdown Menu for all tabs (especially convenient on mobile) */}
          <div className="sm:hidden relative">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-amber-500/40 shadow-xs">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 relative">
                <select
                  id="select-report-tab-dropdown"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  className="w-full text-xs font-black bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer pr-1 pl-6 appearance-none"
                >
                  {[
                    { id: 'templates', label: '🎨 1. نماذج التقرير (10 نماذج)' },
                    { id: 'layout', label: '📐 2. العرض والخطوط والشاشة (Note 20)' },
                    { id: 'resolution', label: '💎 3. الدقة ومقاس التصدير (HD / 4K)' },
                    { id: 'sorting', label: '🔄 4. الفرز والتنظيم والإحصائيات' },
                    { id: 'elements', label: '👁️ 5. تخصيص الحقول والعناصر (16 حقل)' },
                  ].map((tab) => (
                    <option key={tab.id} value={tab.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-1.5 font-bold">
                      {tab.label}
                    </option>
                  ))}
                </select>
                <span className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </span>
              </div>
            </div>
          </div>

          {/* Desktop & Tablet: Full Single Grid Row */}
          <div className="hidden sm:grid sm:grid-cols-5 gap-1.5">
            {[
              { id: 'templates', label: '🎨 نماذج التقرير (10)', icon: Palette },
              { id: 'layout', label: '📐 العرض والخطوط', icon: LayoutGrid },
              { id: 'resolution', label: '💎 الدقة ومقاس التصدير', icon: Sliders },
              { id: 'sorting', label: '🔄 الفرز والإحصائيات', icon: ArrowUpDown },
              { id: 'elements', label: '👁️ تخصيص الحقول', icon: Eye },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all text-center cursor-pointer border text-xs whitespace-nowrap",
                    isActive
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border-amber-300 dark:border-amber-600/70 font-black ring-1 ring-amber-400/20"
                      : "bg-white/50 dark:bg-slate-850/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/60"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-amber-600 dark:text-amber-400" : "text-slate-400")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile (Note 20 Ultra): Two Balanced Rows displaying all 5 tabs completely without scrolling */}
          <div className="sm:hidden space-y-1.5">
            {/* Row 1: 3 Tabs */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'templates', label: 'النماذج (10)', icon: Palette, emoji: '🎨' },
                { id: 'layout', label: 'العرض والخطوط', icon: LayoutGrid, emoji: '📐' },
                { id: 'resolution', label: 'الدقة والمقاس', icon: Sliders, emoji: '💎' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all text-center cursor-pointer border text-[11px] font-black",
                      isActive
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border-amber-300 dark:border-amber-600 ring-1 ring-amber-400/30"
                        : "bg-white/60 dark:bg-slate-850/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200/80 dark:border-slate-700/60"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-amber-600 dark:text-amber-400" : "text-slate-400")} />
                    <span className="truncate w-full">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2: 2 Tabs */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'sorting', label: '🔄 الفرز والإحصائيات', icon: ArrowUpDown },
                { id: 'elements', label: '👁️ تخصيص الحقول', icon: Eye },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all text-center cursor-pointer border text-xs font-black",
                      isActive
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border-amber-300 dark:border-amber-600 ring-1 ring-amber-400/30"
                        : "bg-white/60 dark:bg-slate-850/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200/80 dark:border-slate-700/60"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-amber-600 dark:text-amber-400" : "text-slate-400")} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-3.5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <span className="font-black block mb-0.5">اختر النمط المناسب وحدد النسق الافتراضي لتوليد التقارير:</span>
                  تم توفير 10 نماذج مع إمكانية تحديد نسق مخصص كافتراضي عند التصدير كصورة 🖼️ أو كمستند PDF 📄، بالإضافة إلى أسلوب العرض المريح للجوال (Note 20 Ultra) بدون تكبير.
                </div>
              </div>

              {/* Default Export Preset Configuration Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs space-y-3 text-right" dir="rtl">
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>تحديد الأنساق الافتراضية لتوليد التقرير السريع:</span>
                  </span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-extrabold px-2 py-0.5 rounded-full">
                    توليد بنقرة واحدة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Default for Image */}
                  <div className="bg-white dark:bg-slate-850 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>النسق الافتراضي عند التوليد كصورة 🖼️:</span>
                      </label>
                    </div>
                    <select
                      value={exportSettings.reportDefaultImageTemplate || 'mobile-flow'}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateExportSetting({ reportDefaultImageTemplate: val });
                        toast.success(`تم تعيين نسق الصورة الافتراضي: ${REPORT_TEMPLATES_CATALOG.find(t => t.id === val)?.title.slice(0, 30)}...`);
                      }}
                      className="w-full text-xs font-bold p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {REPORT_TEMPLATES_CATALOG.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                      يُطبّق تلقائياً عند النقر على (تصدير/تحميل التقرير كصورة)
                    </p>
                  </div>

                  {/* Default for Document / PDF */}
                  <div className="bg-white dark:bg-slate-850 p-3 rounded-xl border border-blue-200/80 dark:border-blue-800/40 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>النسق الافتراضي عند التوليد كمستند PDF 📄:</span>
                      </label>
                    </div>
                    <select
                      value={exportSettings.reportDefaultDocumentTemplate || 'unlimited-a4'}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateExportSetting({ reportDefaultDocumentTemplate: val });
                        toast.success(`تم تعيين نسق المستند الافتراضي: ${REPORT_TEMPLATES_CATALOG.find(t => t.id === val)?.title.slice(0, 30)}...`);
                      }}
                      className="w-full text-xs font-bold p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {REPORT_TEMPLATES_CATALOG.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                      يُطبّق تلقائياً عند النقر على (تحميل/تصدير التقرير كمستند PDF)
                    </p>
                  </div>
                </div>

                {/* Additional Quick Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                      نوع الإجراء الافتراضي للتصدير:
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="reportDefaultExportType"
                          checked={(exportSettings.reportDefaultExportType || 'pdf') === 'pdf'}
                          onChange={() => handleUpdateExportSetting({ reportDefaultExportType: 'pdf' })}
                          className="text-indigo-600"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">مستند PDF</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="reportDefaultExportType"
                          checked={exportSettings.reportDefaultExportType === 'image'}
                          onChange={() => handleUpdateExportSetting({ reportDefaultExportType: 'image' })}
                          className="text-emerald-600"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">صورة JPG</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportSettings.autoSwitchToDefaultOnExport !== false}
                      onChange={(e) => handleUpdateExportSetting({ autoSwitchToDefaultOnExport: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                      التبديل التلقائي إلى النسق الافتراضي عند طلب التوليد
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REPORT_TEMPLATES_CATALOG.map((tmpl) => {
                  const isSelected = selectedReportTemplate === tmpl.id;
                  const isDefaultImage = (exportSettings.reportDefaultImageTemplate || 'mobile-flow') === tmpl.id;
                  const isDefaultDoc = (exportSettings.reportDefaultDocumentTemplate || 'unlimited-a4') === tmpl.id;
                  const Icon = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => {
                        localStorage.setItem('selected_report_template_manual', 'true');
                        onSelectTemplate(tmpl.id);
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

                        {/* Default Badges */}
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

                      {/* Quick Default Action Buttons */}
                      <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateExportSetting({ reportDefaultImageTemplate: tmpl.id });
                              toast.success(`تم تعيين "${tmpl.title.slice(0, 25)}" كالنسق الافتراضي للصورة 🖼️`);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isDefaultImage
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                : "bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            )}
                            title="تعيين هذا النسق تلقائياً عند تصدير التقرير كصورة"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>{isDefaultImage ? '✓ افتراضي الصورة' : 'تعيين للصورة 🖼️'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateExportSetting({ reportDefaultDocumentTemplate: tmpl.id });
                              toast.success(`تم تعيين "${tmpl.title.slice(0, 25)}" كالنسق الافتراضي للمستند 📄`);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center gap-1 cursor-pointer",
                              isDefaultDoc
                                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                : "bg-blue-50/70 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            )}
                            title="تعيين هذا النسق تلقائياً عند تصدير التقرير كمستند PDF"
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
              {/* Task Display Mode */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      أسلوب ونمط عرض المهام في التقرير
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    حل مشكلة التكبير والتصغير
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'cards',
                      title: '📱 بطاقات ذكية متجاوبة',
                      desc: 'الأفضل لشاشات الجوال والكمبيوتر: تعرض كل مهمة كبطاقة أنيقة مدمجة تمنع تصغير الخط وتلغي الحاجة للتكبير والتمرير الأفقي.',
                      badge: 'موصى به للجوال'
                    },
                    {
                      id: 'table',
                      title: '📊 جدول بيانات كلاسيكي',
                      desc: 'جدول بيانات أفقي كامل بكافة الأعمدة والترويسة والفرز، ملائم للحواسيب والطباعة العريضة.',
                      badge: 'للكمبيوتر والشاشات'
                    },
                    {
                      id: 'compact',
                      title: '📑 قائمة خطية مدمجة',
                      desc: 'سطر واحد لكل مهمة يجمع الاسم والجهاز والحالة والمتبقي لاختصار المساحة وطباعة عدد كبير من المهام.',
                      badge: 'أقصى كثافة'
                    },
                  ].map((mode) => {
                    const isSelected = reportViewMode === mode.id;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => {
                          onViewModeChange(mode.id as any);
                          localStorage.setItem('report_view_mode', mode.id);
                          toast.success(`تم تفعيل: ${mode.title}`);
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
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded text-center block mt-1",
                          isSelected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        )}>
                          {mode.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Font Scale */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    حجم الخط ومستوى القراءة المريحة (Font Scale)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'large', label: 'كبير ومريح (16px)', sub: 'مثالي لقراءة التقرير من شاشة الجوال دون تدقيق' },
                    { id: 'normal', label: 'قياسي متوازن (14px)', sub: 'المقاس الطبيعي المتوازن بين الحجم والمساحة' },
                    { id: 'compact', label: 'مدمج مكثف (12px)', sub: 'لاختصار الصفحات وإظهار أكبر قدر من البيانات' }
                  ].map((fs) => {
                    const isSelected = reportFontScale === fs.id;
                    return (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() => {
                          onFontScaleChange(fs.id as any);
                          localStorage.setItem('report_font_scale', fs.id);
                          toast.success(`تم اختيار الخط: ${fs.label}`);
                        }}
                        className={cn(
                          "p-3 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-100"
                        )}
                      >
                        <span className="text-xs font-black text-slate-900 dark:text-white mb-1">{fs.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">{fs.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Container Width / Screen Fit */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      أقصى عرض للتقرير على الشاشة
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">تحديد الإطار البصري</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'mobile', label: '📱 شاشة جوال (480px)', desc: 'مطابق لعرض الهاتف تماماً' },
                    { id: 'desktop', label: '💻 كمبيوتر (1000px)', desc: 'عرض متوازن للشاشات' },
                    { id: 'a4', label: '🖨️ مقاس A4 (210مم)', desc: 'مطابق لصفحة الطباعة' },
                    { id: 'full', label: '↔️ ملء الشاشة الكامل', desc: 'يمتد لملء العرض المتاح' },
                  ].map((w) => {
                    const isSelected = reportPageWidth === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          onPageWidthChange(w.id as any);
                          localStorage.setItem('report_page_width', w.id);
                          toast.success(`تم تعيين العرض: ${w.label}`);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between",
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 font-bold text-blue-900 dark:text-blue-200"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span className="text-[11px] font-black">{w.label}</span>
                        <span className="text-[9px] text-slate-400 mt-1">{w.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESOLUTION & EXPORT QUALITY */}
          {activeTab === 'resolution' && (
            <div className="space-y-5">
              {/* Quality & Scale */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      مقياس الدقة والوضوح (Resolution Scale)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                    المقياس الحالي: {resolved.scale}x
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'ultra',
                      title: '💎 دقة فائقة طباعية (3.0x - 300 DPI)',
                      desc: 'أعلى دقة نقاء ممكنة، تضمن بقاء النصوص والأرقام والباركود حادة تماماً عند الطباعة أو التكبير.',
                      tag: 'طباعة ونقاء استثنائي'
                    },
                    {
                      id: 'high',
                      title: '📱 دقة شاشات AMOLED العالية (2.5x)',
                      desc: 'مضبوطة ومثالية لهاتف سامسونج جالاكسي نوت 20 ألترا، تجمع بين صفاء الصورة وحجم ملف متوازن وسرعة التصدير.',
                      tag: 'الأمثل لجوال Note 20 Ultra'
                    },
                    {
                      id: 'standard',
                      title: '⚡ دقة قياسية سريعة (1.5x)',
                      desc: 'توليد سريع للصور والمستندات للمعاينة السريعة والمراسلات العادية.',
                      tag: 'سرعة قياسية'
                    },
                    {
                      id: 'compact',
                      title: '📦 دقة مدمجة خفيفة (1.0x)',
                      desc: 'حجم ملف صغير جداً ملائم لشبكات الإنترنت الضعيفة وتوفير استهلاك البيانات.',
                      tag: 'أصغر حجم ملف'
                    },
                  ].map((q) => {
                    const isSelected = exportSettings.quality === q.id;
                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          handleUpdateExportSetting({ quality: q.id as QualityPreset });
                          toast.success(`تم اختيار: ${q.title}`);
                        }}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between text-right",
                          isSelected
                            ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{q.title}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                            {q.desc}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded w-fit">
                          {q.tag}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Page Format & Dimensions */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      مقاس صفحة ومستند التصدير
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">{resolved.label}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'mobile', title: '📱 شاشة جوال (Note 20 Ultra)', desc: '1080 × 2316 بكسل رأسي' },
                    { id: 'a4', title: '📄 ورق A4 قياسي', desc: '210 × 297 مم' },
                    { id: 'a5', title: '📑 ورق A5 مدمج', desc: '148 × 210 مم' },
                    { id: 'thermal_80', title: '🧾 إيصال حراري 80 مم', desc: 'طابعات الفواتير الكبيرة' },
                    { id: 'thermal_58', title: '🧾 إيصال حراري 58 مم', desc: 'طابعات البلوتوث المحمولة' },
                    { id: 'custom', title: '📐 مقاس مخصص', desc: 'أبعاد محددة يدوياً' },
                  ].map((fmt) => {
                    const isSelected = exportSettings.format === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => {
                          handleUpdateExportSetting({ format: fmt.id as PageSizeFormat });
                          toast.success(`تم تعيين مقاس التصدير: ${fmt.title}`);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between",
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-bold"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span className="text-[11px] font-black">{fmt.title}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">{fmt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format & Orientation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Image Format */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    صيغة حفظ الصورة
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'image/jpeg', label: 'JPG (95%)', desc: 'صورة خفيفة عالية التوافق' },
                      { id: 'image/png', label: 'PNG نقي', desc: 'نقاء بدون فقدان للبيانات' },
                      { id: 'image/webp', label: 'WebP', desc: 'صيغة حديثة مضغوطة' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => handleUpdateExportSetting({ imageFormat: fmt.id as ExportImageFormat })}
                        className={cn(
                          "p-2 rounded-xl border text-center transition-all cursor-pointer",
                          exportSettings.imageFormat === fmt.id
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-black"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[11px]"
                        )}
                      >
                        <div className="text-xs font-bold">{fmt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    اتجاه صفحة المستند
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'auto', label: 'تلقائي ذكي' },
                      { id: 'portrait', label: 'رأسي (طولي)' },
                      { id: 'landscape', label: 'أفقي (عريض)' },
                    ].map((orient) => (
                      <button
                        key={orient.id}
                        type="button"
                        onClick={() => handleUpdateExportSetting({ orientation: orient.id as ExportOrientation })}
                        className={cn(
                          "p-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold",
                          exportSettings.orientation === orient.id
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {orient.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SORTING & ORGANIZATION */}
          {activeTab === 'sorting' && (
            <div className="space-y-5">
              {/* Task Sorting */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    ترتيب وفرز المهام داخل التقرير
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'latest', label: '🕒 الأحدث تاريخاً أولاً (تنازلي)', desc: 'أحدث العمليات في مقدمة التقرير' },
                    { id: 'oldest', label: '⏳ الأقدم تاريخاً أولاً (تصاعدي)', desc: 'ترتيب زمني متسلسل من البداية' },
                    { id: 'cost_desc', label: '💰 الأعلى تكلفة إجمالية', desc: 'ترتيب المهام حسب الأكبر قيمة مالية' },
                    { id: 'balance_desc', label: '🧾 الأكبر متبقياً (ديون مستحقة)', desc: 'المهام ذات المتبقي الأكبر للمتابعة السريعة' },
                    { id: 'customer_name', label: '🔤 أبجدياً حسب اسم العميل', desc: 'تسهيل مراجعة كشوفات العملاء' },
                    { id: 'status', label: '🏷️ حسب حالة المهمة', desc: 'تجميع المهام المتشابهة في الحالة معاً' },
                  ].map((s) => {
                    const isSelected = reportSortBy === s.id || (s.id === 'latest' && reportSortBy === 'default');
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSortByChange(s.id);
                          toast.success(`تم ضبط الترتيب: ${s.label}`);
                        }}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between text-right",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{s.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <span className="text-[10px] text-slate-500 leading-tight">{s.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Media and Charts options */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  خيارات الصور والإحصائيات التفاعلية
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">تضمين صور المهام والأصناف</span>
                        <span className="text-[10px] text-slate-500">عرض صور الأجهزة مباشرة في التقرير</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={reportIncludeImages}
                      onChange={(e) => onIncludeImagesChange(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">تفعيل الرسوم البيانية التفاعلية</span>
                        <span className="text-[10px] text-slate-500">عرض مخططات الإيرادات والمصروفات</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isInteractiveChartsEnabled}
                      onChange={(e) => onInteractiveChartsChange(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VISIBLE ELEMENTS & FIELDS */}
          {activeTab === 'elements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    تخصيص الحقول والعناصر المرئية بالتقرير
                  </span>
                  <span className="text-[10px] text-slate-500">
                    حدد البيانات التي تريد إظهارها أو إخفاءها في قالب التقرير
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllElements}
                    className="text-[10px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllElements}
                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    الأساسي فقط
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALL_REPORT_ELEMENTS_KEYS.map((elem) => {
                  const isChecked = reportElements.includes(elem.id);
                  return (
                    <label
                      key={elem.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                        isChecked
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                          : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100"
                      )}
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {elem.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleElement(elem.id)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetExportSettings();
                onViewModeChange('cards');
                onFontScaleChange('normal');
                onPageWidthChange('mobile');
                toast.success('تمت استعادة الإعدادات الافتراضية للجوال (Note 20 Ultra)');
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي للـ Note 20</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyAndRefresh();
                onClose();
                toast.success('✅ تم حفظ التنسيق وتحديث التقرير بنجاح!', { icon: '✨' });
              }}
              className="px-5 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق وتحديث التقرير</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
