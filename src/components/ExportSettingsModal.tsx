import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Smartphone,
  FileText,
  Files,
  Receipt,
  Sparkles,
  Sliders,
  Check,
  CheckCircle2,
  RotateCcw,
  Star,
  Plus,
  Trash2,
  Info,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';
import {
  AppExportSettings,
  PageSizeFormat,
  QualityPreset,
  ExportOrientation,
  ExportImageFormat,
  CustomSizePreset,
  getExportSettings,
  saveExportSettings,
  resetExportSettings,
  setDefaultExportFormat,
  addCustomSizePreset,
  removeCustomSizePreset,
  resolveExportDimensions,
  subscribeExportSettings
} from '../utils/exportSettings';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

export interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportSettingsModal: React.FC<ExportSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppExportSettings>(getExportSettings());
  const [activeTab, setActiveTab] = useState<'sizes' | 'quality' | 'format'>('sizes');

  // New Custom preset inputs
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number | undefined>(1920);
  const [customUnit, setCustomUnit] = useState<'px' | 'mm'>('px');

  useEffect(() => {
    if (isOpen) {
      setSettings(getExportSettings());
    }
  }, [isOpen]);

  useEffect(() => {
    return subscribeExportSettings((newSettings) => {
      setSettings(newSettings);
    });
  }, []);

  if (!isOpen) return null;

  const handleSelectFormat = (format: PageSizeFormat, customId?: string) => {
    const updated = saveExportSettings({
      format,
      customSizeId: format === 'custom' ? customId : undefined
    });
    setSettings(updated);
    toast.success(`تم اختيار الحجم: ${getFormatTitle(format, customId)}`, { duration: 1500, icon: '📐' });
  };

  const handleSetAsDefault = (format: PageSizeFormat, customId?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = setDefaultExportFormat(format, customId);
    setSettings(updated);
    toast.success(`تم تعيين "${getFormatTitle(format, customId)}" كحجم افتراضي دائم للتطبيق!`, {
      icon: '⭐',
      duration: 2500
    });
  };

  const handleQualityChange = (quality: QualityPreset) => {
    const updated = saveExportSettings({ quality });
    setSettings(updated);
    toast.success(`تم تحديد الدقة: ${getQualityLabel(quality)}`, { duration: 1500, icon: '💎' });
  };

  const handleOrientationChange = (orientation: ExportOrientation) => {
    const updated = saveExportSettings({ orientation });
    setSettings(updated);
  };

  const handleImageFormatChange = (imageFormat: ExportImageFormat) => {
    const updated = saveExportSettings({ imageFormat });
    setSettings(updated);
  };

  const handleImageQualitySlider = (val: number) => {
    const updated = saveExportSettings({ imageQuality: val });
    setSettings(updated);
  };

  const handleReset = () => {
    const reset = resetExportSettings();
    setSettings(reset);
    toast.success('تمت استعادة الإعدادات الافتراضية المثالية لهاتف نوت 20 ألترا', { icon: '🔄' });
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error('يرجى كتابة اسم للحجم المخصص');
      return;
    }
    if (!customWidth || customWidth <= 0) {
      toast.error('يرجى تحديد عرض صالح');
      return;
    }

    const created = addCustomSizePreset({
      name: customName.trim(),
      width: Number(customWidth),
      height: customHeight ? Number(customHeight) : undefined,
      unit: customUnit,
      description: `حجم مخصص (${customWidth} × ${customHeight || 'تلقائي'} ${customUnit})`
    });

    setIsAddingCustom(false);
    setCustomName('');
    toast.success(`تم حفظ الحجم المخصص "${created.name}" وتفعيله!`, { icon: '📐' });
  };

  const handleDeleteCustom = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomSizePreset(presetId);
    toast.success('تم حذف الحجم المخصص بنجاح');
  };

  const resolved = resolveExportDimensions(settings);

  function getFormatTitle(f: PageSizeFormat, customId?: string): string {
    switch (f) {
      case 'mobile':
        return 'ملائم لشاشة الجوال (Note 20 Ultra)';
      case 'a4':
        return 'ورق A4 قياسي (210 × 297 مم)';
      case 'a3':
        return 'ورق A3 عريض (297 × 420 مم)';
      case 'a5':
        return 'ورق A5 مدمج (148 × 210 مم)';
      case 'thermal_80':
        return 'طابعة حرارية 80 مم';
      case 'thermal_58':
        return 'طابعة حرارية 58 مم';
      case 'custom': {
        const p = settings.customPresets.find(c => c.id === (customId || settings.customSizeId));
        return p ? p.name : 'أبعاد مخصصة';
      }
      default:
        return f;
    }
  }

  function getQualityLabel(q: QualityPreset): string {
    switch (q) {
      case 'ultra': return 'دقة فائقة Ultra HD (3.0x - 300 DPI)';
      case 'high': return 'دقة عالية High HD (2.5x - 250 DPI)';
      case 'standard': return 'دقة قياسية Standard (1.5x - 150 DPI)';
      case 'compact': return 'دقة مدمجة Compact (1.0x - 96 DPI)';
    }
  }

  const standardSizes: {
    id: PageSizeFormat;
    title: string;
    dims: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    {
      id: 'mobile',
      title: 'ملائم لشاشة الجوال',
      dims: '1080 × 2316 بكسل (FHD+)',
      description: 'أبعاد مثالية لشاشة سامسونج نوت 20 ألترا والمشاركة السريعة عبر واتساب بدقة متناهية دون حواف فارغة',
      icon: Smartphone,
      badge: 'موصى به للجوال'
    },
    {
      id: 'a4',
      title: 'ورق A4 قياسي',
      dims: '210 × 297 مم (قياس مكتبي)',
      description: 'المعيار الدولي لطباعة التقارير، كشوفات الحسابات، والفواتير بوضوح تام على الطابعات العادية',
      icon: FileText
    },
    {
      id: 'a3',
      title: 'ورق A3 عريض',
      dims: '297 × 420 مم (جداول موسعة)',
      description: 'مخصص للتقارير المالية الموسعة التي تحتوي على 10+ أعمدة وسجلات حسابات سنوية كاملة',
      icon: Files
    },
    {
      id: 'a5',
      title: 'ورق A5 مدمج',
      dims: '148 × 210 مم (نصف A4)',
      description: 'حجم مريح وموفر للورق، رائع لسندات الصيانة السريعة، إيصالات الاستلام، والمذكرات المختصرة',
      icon: FileText
    },
    {
      id: 'thermal_80',
      title: 'إيصال حراري 80 مم',
      dims: '80 مم عرض × طول مستمر',
      description: 'مخصص لطابعات الكاشير المحمولة والبلوتوث (POS) لإصدار وصولات الزبائن الفورية',
      icon: Receipt
    }
  ];

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden transition-all text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-sky-50/40 to-slate-50 dark:from-slate-800/80 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  إعدادات إخراج وتصدير المستندات والصور
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  شامل لكل التطبيق
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تحديد الأبعاد، الدقة، وحجم الورق لعمليات الحفظ والمشاركة والطباعة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-5 pt-2 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('sizes')}
            className={cn(
              "flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer",
              activeTab === 'sizes'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>الأبعاد وأحجام الورق</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quality')}
            className={cn(
              "flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer",
              activeTab === 'quality'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>الدقة ومعدل النقاء (DPI)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('format')}
            className={cn(
              "flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-all cursor-pointer",
              activeTab === 'format'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>الاتجاه وصيغة الصور</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* TAB 1: SIZES & DIMENSIONS */}
          {activeTab === 'sizes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  اختر حجم الإخراج للمستندات والصور:
                </span>
                <span className="text-[11px] text-slate-500">
                  الحجم الافتراضي الحالي: <strong className="text-indigo-600 dark:text-indigo-400">{getFormatTitle(settings.defaultFormat, settings.customSizeId)}</strong>
                </span>
              </div>

              {/* Standard Sizes List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {standardSizes.map((item) => {
                  const isSelected = settings.format === item.id;
                  const isDefault = settings.defaultFormat === item.id;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFormat(item.id)}
                      className={cn(
                        "relative p-3.5 rounded-2xl border transition-all cursor-pointer text-right flex flex-col justify-between gap-2.5 group",
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {item.title}
                              </h3>
                              {item.badge && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 mt-0.5">
                              {item.dims}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                        {isDefault ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>الحجم الافتراضي الدائم</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleSetAsDefault(item.id, undefined, e)}
                            className="text-[10px] font-bold text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-2 py-0.5 rounded-md transition-all flex items-center gap-1"
                            title="اجعل هذا الحجم هو الخيار الافتراضي لكل عمليات التصدير"
                          >
                            <Star className="w-3 h-3 text-slate-400" />
                            <span>تعيين كافتراضي</span>
                          </button>
                        )}

                        <span className="text-[10px] font-medium text-slate-400">
                          {isSelected ? 'مفعل حالياً' : 'انقر للتفعيل'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Presets Section */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      الأحجام والأبعاد المخصصة المحفوظة:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(!isAddingCustom)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingCustom ? 'إلغاء الإضافة' : 'إضافة حجم مخصص جديد'}</span>
                  </button>
                </div>

                {/* Add Custom Preset Form */}
                {isAddingCustom && (
                  <form onSubmit={handleSaveCustom} className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 mb-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الحجم المخصص:</label>
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="مثلاً: كارت الضمان"
                          className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">العرض والوحدة:</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(Number(e.target.value))}
                            className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                          />
                          <select
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value as 'px' | 'mm')}
                            className="text-xs font-bold px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                          >
                            <option value="px">بكسل</option>
                            <option value="mm">مم</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">الارتفاع (اختياري):</label>
                        <input
                          type="number"
                          value={customHeight || ''}
                          onChange={(e) => setCustomHeight(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="تلقائي حسب المحتوى"
                          className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingCustom(false)}
                        className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                      >
                        حفظ وتفعيل الحجم المخصص
                      </button>
                    </div>
                  </form>
                )}

                {/* Custom Presets Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {settings.customPresets.map((preset) => {
                    const isSelected = settings.format === 'custom' && settings.customSizeId === preset.id;
                    const isDefault = settings.defaultFormat === 'custom' && settings.customSizeId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectFormat('custom', preset.id)}
                        className={cn(
                          "p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs truncate text-slate-900 dark:text-white">{preset.name}</span>
                            {isDefault && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {preset.width} {preset.unit} {preset.height ? `× ${preset.height} ${preset.unit}` : '(طول تلقائي)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isDefault && (
                            <button
                              type="button"
                              onClick={(e) => handleSetAsDefault('custom', preset.id, e)}
                              className="text-[10px] text-slate-400 hover:text-amber-600 p-1"
                              title="تعيين كافتراضي"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustom(preset.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="حذف هذا الحجم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESOLUTION & QUALITY */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              <div className="text-xs font-black text-slate-700 dark:text-slate-300">
                اختر معدل الدقة ونقاء النصوص والصور المولدة:
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'ultra' as QualityPreset,
                    title: 'دقة فائقة Ultra HD (3.0x - 300 DPI)',
                    desc: 'أعلى دقة نقاء ممكنة للطباعة الاحترافية وإبراز أدق الأرقام والتفاصيل.',
                    tag: 'أعلى نقاء',
                    color: 'text-purple-600 dark:text-purple-400'
                  },
                  {
                    id: 'high' as QualityPreset,
                    title: 'دقة عالية High HD (2.5x - 250 DPI)',
                    desc: 'المعدل المثالي والموصى به لشاشات AMOLED لهاتف سامسونج نوت 20 ألترا، تجمع بين الجمال الفائق وسرعة المعالجة.',
                    tag: 'الافتراضي الموصى به',
                    color: 'text-indigo-600 dark:text-indigo-400'
                  },
                  {
                    id: 'standard' as QualityPreset,
                    title: 'دقة قياسية Standard (1.5x - 150 DPI)',
                    desc: 'مناسبة للمستندات السريعة ومشاركة الواتساب الخفيفة مع حجم ملف صغير.',
                    tag: 'متوازن وسريع',
                    color: 'text-emerald-600 dark:text-emerald-400'
                  },
                  {
                    id: 'compact' as QualityPreset,
                    title: 'دقة مدمجة Compact (1.0x - 96 DPI)',
                    desc: 'توليد فوري بحجم ملف خفيف جداً ومناسب للشبكات الضعيفة.',
                    tag: 'أقل حجم',
                    color: 'text-slate-600 dark:text-slate-400'
                  }
                ].map((q) => {
                  const isSelected = settings.quality === q.id;

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleQualityChange(q.id)}
                      className={cn(
                        "p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3",
                        isSelected
                          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className={cn("font-bold text-xs sm:text-sm", q.color)}>
                            {q.title}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {q.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {q.desc}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ORIENTATION & IMAGE FORMAT */}
          {activeTab === 'format' && (
            <div className="space-y-4">
              {/* Orientation */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                  اتجاه الصفحة لمستندات PDF:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'auto' as ExportOrientation, label: 'تلقائي ذكي (حسب المحتوى)' },
                    { id: 'portrait' as ExportOrientation, label: 'عمودي (Portrait)' },
                    { id: 'landscape' as ExportOrientation, label: 'أفقي (Landscape)' }
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleOrientationChange(o.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer",
                        settings.orientation === o.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Format */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-2">
                  صيغة الصور المصدرة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'image/jpeg' as ExportImageFormat, label: 'JPG مضغوط (متوافق مع كل الهواتف وحجم خفيف)' },
                    { id: 'image/png' as ExportImageFormat, label: 'PNG عالي النقاء (نقاء تام بدون أي فقد تفاصيل)' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleImageFormatChange(f.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer",
                        settings.imageFormat === f.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Slider */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    جودة وضغط الصور:
                  </label>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {Math.round(settings.imageQuality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="1.00"
                  step="0.05"
                  value={settings.imageQuality}
                  onChange={(e) => handleImageQualitySlider(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>حجم ملف أصغر (70%)</span>
                  <span>متوازن فائق (95%)</span>
                  <span>أقصى جودة ونقاء (100%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ملخص إعدادات التصدير النشطة حالياً:
              </span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                {resolved.label}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
              <div>
                العرض الأدنى: <strong className="text-slate-900 dark:text-white">{resolved.minWidth}px</strong>
              </div>
              <div>
                معدل الدقة: <strong className="text-slate-900 dark:text-white">{resolved.scale}x</strong>
              </div>
              <div>
                الاتجاه: <strong className="text-slate-900 dark:text-white">{settings.orientation === 'auto' ? 'تلقائي' : settings.orientation === 'portrait' ? 'عمودي' : 'أفقي'}</strong>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الضبط الافتراضي (نوت 20 ألترا)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleSetAsDefault(settings.format, settings.customSizeId);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>حفظ كافتراضي دائم</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              إغلاق وتطبيق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
