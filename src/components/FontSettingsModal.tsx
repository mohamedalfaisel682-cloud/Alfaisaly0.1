import React from 'react';
import { Type, Check, RefreshCw, Layers, FileText, Hash, Edit3, Sliders, X } from 'lucide-react';

interface FontSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiSettings: any;
  updateUiSettings: (newSettings: any) => Promise<void> | void;
}

export const FontSettingsModal: React.FC<FontSettingsModalProps> = ({
  isOpen,
  onClose,
  uiSettings,
  updateUiSettings,
}) => {
  if (!isOpen) return null;

  const currentSettings = uiSettings || {};

  const handleResetFonts = async () => {
    await updateUiSettings({
      ...currentSettings,
      mainTabsFontFamily: '',
      mainTabsFontSize: '13px',
      mainTabsFontWeight: 'font-bold',
      detailsFontFamily: '',
      detailsFontSize: '12px',
      reportsFontFamily: '',
      reportsFontSize: '11px',
      inputsFontFamily: '',
      inputsFontSize: '13px',
      numbersFontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      numbersFontSize: '13px',
      numbersWeight: 'font-bold'
    });
  };

  return (
    <div className="fixed inset-0 z-[95000] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 dir-rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500 rounded-xl text-white shadow-xs">
              <Type className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">إعدادات وتنسيق الخطوط والأرقام</h3>
              <p className="text-[11px] text-slate-400">تعديل أحجام وأنواع الخطوط لكل التبويبات والقوائم والمدخلات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Banner */}
          <div className="p-4 bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-md border border-sky-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/20 text-sky-300 rounded-xl border border-sky-400/30 shrink-0">
                <Type className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-black text-xs sm:text-sm text-white">تحكّم شامل بخط التطبيق والأرقام</h4>
                <p className="text-[11px] text-sky-200/90 leading-relaxed font-medium">
                  يمكنك ضبط أحجام ونوعيات الخط للتبويبات الرئيسية، التفاصيل، القوائم، التقارير والمدخلات.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetFonts}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold text-white rounded-xl border border-white/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>استعادة الخطوط الافتراضية</span>
            </button>
          </div>

          {/* 1. التبويبات الرئيسية وشريط التنقل */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>1. التبويبات الرئيسية وشريط التنقل</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">نوع الخط:</label>
                <select
                  value={currentSettings.mainTabsFontFamily || ''}
                  onChange={(e) => updateUiSettings({ ...currentSettings, mainTabsFontFamily: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">مثل خط التطبيق العام (افتراضي)</option>
                  <option value='"Tajawal", sans-serif'>Tajawal - تجوال ملكي</option>
                  <option value='"Cairo", sans-serif'>Cairo - القاهرة بوضوح عالي</option>
                  <option value='"Almarai", sans-serif'>Almarai - المراعي المعاصر</option>
                  <option value='"Reem Kufi", sans-serif'>Reem Kufi - كوفي عربي</option>
                  <option value='"Changa", sans-serif'>Changa - تشانغا بوهيمي</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">حجم الخط:</label>
                <select
                  value={currentSettings.mainTabsFontSize || '13px'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, mainTabsFontSize: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="11px">11px - صغير مدمج</option>
                  <option value="12px">12px - صغير</option>
                  <option value="13px">13px - قياسي (افتراضي)</option>
                  <option value="14px">14px - متوسط بارز</option>
                  <option value="15px">15px - كبير مقروء</option>
                  <option value="17px">17px - ضخم للمس</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">سمك الخط:</label>
                <select
                  value={currentSettings.mainTabsFontWeight || 'font-bold'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, mainTabsFontWeight: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="font-normal">عادي (Normal)</option>
                  <option value="font-bold">عريض (Bold - افتراضي)</option>
                  <option value="font-black">عريض جداً (Extra Black)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. التفاصيل والقوائم والبطاقات */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>2. التفاصيل والقوائم والبطاقات والبيانات</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">نوع الخط:</label>
                <select
                  value={currentSettings.detailsFontFamily || ''}
                  onChange={(e) => updateUiSettings({ ...currentSettings, detailsFontFamily: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">مثل خط التطبيق العام (افتراضي)</option>
                  <option value='"Cairo", sans-serif'>Cairo - القاهرة</option>
                  <option value='"Tajawal", sans-serif'>Tajawal - تجوال</option>
                  <option value='"Almarai", sans-serif'>Almarai - المراعي</option>
                  <option value='"Alexandria", sans-serif'>Alexandria - الإسكندرية</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">حجم خط التفاصيل والقوائم:</label>
                <select
                  value={currentSettings.detailsFontSize || '12px'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, detailsFontSize: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="10px">10px - مدمج جداً</option>
                  <option value="11px">11px - صغير</option>
                  <option value="12px">12px - قياسي (افتراضي)</option>
                  <option value="13px">13px - متوسط</option>
                  <option value="14px">14px - كبير مقروء</option>
                  <option value="16px">16px - ضخم جداً</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. التقارير والكشوفات الرسمية */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>3. التقارير والكشوفات المطبوعة والرسمية</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">نوع خط التقارير:</label>
                <select
                  value={currentSettings.reportsFontFamily || ''}
                  onChange={(e) => updateUiSettings({ ...currentSettings, reportsFontFamily: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">مثل خط التطبيق العام (افتراضي)</option>
                  <option value='"Cairo", sans-serif'>Cairo - القاهرة للطباعة المودرن</option>
                  <option value='"Tajawal", sans-serif'>Tajawal - تجوال رسمية</option>
                  <option value='"Amiri", serif'>Amiri - خط أميري للمستندات</option>
                  <option value='"Almarai", sans-serif'>Almarai - المراعي واضحة</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">حجم خط التقارير:</label>
                <select
                  value={currentSettings.reportsFontSize || '11px'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, reportsFontSize: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="9px">9px - مدمج جداً للكشوفات الحافلة</option>
                  <option value="10px">10px - قياسي للطباعة</option>
                  <option value="11px">11px - متوسط (افتراضي)</option>
                  <option value="13px">13px - كبير وواضح</option>
                  <option value="15px">15px - ضخم جداً للمستندات</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. النصوص المدخلة يدوياً بالحقول والمربعات */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Edit3 className="w-4 h-4 text-purple-600" />
              <span>4. النصوص المدخلة يدوياً بالحقول ومربعات النص</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">نوع الخط لمربعات الكتابة والوصف:</label>
                <select
                  value={currentSettings.inputsFontFamily || ''}
                  onChange={(e) => updateUiSettings({ ...currentSettings, inputsFontFamily: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">مثل خط التطبيق العام (افتراضي)</option>
                  <option value='"Cairo", sans-serif'>Cairo - القاهرة</option>
                  <option value='"Tajawal", sans-serif'>Tajawal - تجوال</option>
                  <option value='ui-monospace, SFMono-Regular, monospace'>Monospace - مونو برمجية</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">حجم خط النصوص والمدخلات:</label>
                <select
                  value={currentSettings.inputsFontSize || '13px'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, inputsFontSize: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="11px">11px - صغير</option>
                  <option value="12px">12px - قياسي</option>
                  <option value="13px">13px - متوسط (افتراضي)</option>
                  <option value="15px">15px - كبير ومريح للكتابة</option>
                  <option value="17px">17px - ضخم لكتابة الملاحظات</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. الأرقام والمبالغ والتكاليف والحسابات */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Hash className="w-4 h-4 text-amber-600" />
              <span>5. الأرقام والمبالغ والتكاليف والحسابات (الخط والسمك)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">خط الأرقام والمبالغ:</label>
                <select
                  value={currentSettings.numbersFontFamily || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, numbersFontFamily: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Monospace / Fira Code - خط الأرقام المالي (افتراضي)</option>
                  <option value='"Cairo", sans-serif'>Cairo - خط القاهرة البارز للأرقام</option>
                  <option value='"Tajawal", sans-serif'>Tajawal - تجوال عادي</option>
                  <option value='"Reem Kufi", sans-serif'>Reem Kufi - كوفي للأرقام</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">حجم خط الأرقام والمبالغ:</label>
                <select
                  value={currentSettings.numbersFontSize || '13px'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, numbersFontSize: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="11px">11px - صغير</option>
                  <option value="12px">12px - قياسي</option>
                  <option value="13px">13px - متوسط (افتراضي)</option>
                  <option value="15px">15px - كبير وبارز</option>
                  <option value="18px">18px - ضخم جداً للمبالغ المالية</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">سمك الأرقام:</label>
                <select
                  value={currentSettings.numbersWeight || 'font-bold'}
                  onChange={(e) => updateUiSettings({ ...currentSettings, numbersWeight: e.target.value })}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="font-normal">عادي (Normal)</option>
                  <option value="font-bold">عريض (Bold - افتراضي)</option>
                  <option value="font-black">عريض جداً (Extra Black)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6. ميزة معالجة الأرقام الهندية والعربية والإنجليزية */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Check className="w-5 h-5 text-emerald-600 shrink-0 stroke-[3]" />
              <h4 className="font-black text-xs sm:text-sm">قبول وتحويل الأرقام العربية والهندية والإنجليزية (١٢٣ / 123 / ٠١٢) مفعّل تلقائياً</h4>
            </div>
            <p className="text-[11.5px] text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed font-medium pr-7">
              تضمن لك منظومة الفيصلي قبول كافة صيغ الأرقام المكتوبة من الكيبورد بالعربي (١٢٣٤٥٦٧٨٩) أو بالإنجليزي (123456789) في جميع مربعات نص التكلفة والعدد والمبالغ والحسابات داخل التطبيق، وتحويلها لحظياً كرقم موحد دون الحاجة للتبديل للكيبورد بالإنجليزية.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">تم تفعيل التعديلات وتطبيقها على واجهة التطبيق</span>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
          >
            حفظ وإغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

export default FontSettingsModal;
