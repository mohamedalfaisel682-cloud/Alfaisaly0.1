import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  SlidersHorizontal, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Check, 
  RotateCcw, 
  Trash2, 
  Power, 
  Layers, 
  ClipboardList, 
  Banknote, 
  Users, 
  Package, 
  UserCheck, 
  Eye, 
  Hourglass, 
  AlertTriangle,
  Info,
  CheckCircle2,
  CalendarRange
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ActivityLoggerSettings } from '../types';
import { db } from '../lib/db';

export const DEFAULT_ACTIVITY_LOGGER_SETTINGS: ActivityLoggerSettings = {
  enabled: true,
  logTasks: true,
  logTransactions: true,
  logCustomers: true,
  logInventory: true,
  logSettings: true,
  logUsers: true,
  logAppSessions: true,

  logActionsAdd: true,
  logActionsEdit: true,
  logActionsDelete: true,
  logActionsSettings: true,
  logActionsSessions: true,

  timeScheduleType: 'all_day',
  workingHoursStart: '08:00',
  workingHoursEnd: '22:00',
  workingDays: [0, 1, 2, 3, 4, 5, 6],

  retentionDays: 90,
  autoCleanOldRecords: true,
  minSessionDurationSeconds: 3
};

interface ActivityLoggerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ActivityLoggerSettings;
  onSave: (newSettings: ActivityLoggerSettings) => void;
  onRefreshLogs?: () => void;
}

const DAYS_OF_WEEK = [
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' },
  { id: 5, name: 'الجمعة' },
  { id: 6, name: 'السبت' },
];

export const ActivityLoggerSettingsModal: React.FC<ActivityLoggerSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onRefreshLogs
}) => {
  const [localSettings, setLocalSettings] = useState<ActivityLoggerSettings>(settings);
  const [activeTab, setActiveTab] = useState<'schedule' | 'types' | 'retention'>('schedule');
  const [cleaningStatus, setCleaningStatus] = useState<string | null>(null);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setCleaningStatus(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggleDay = (dayId: number) => {
    const current = localSettings.workingDays || [];
    let updated: number[];
    if (current.includes(dayId)) {
      if (current.length === 1) return; // Keep at least one day
      updated = current.filter(d => d !== dayId);
    } else {
      updated = [...current, dayId].sort();
    }
    setLocalSettings({ ...localSettings, workingDays: updated });
  };

  const handleSelectAllTypes = (val: boolean) => {
    setLocalSettings({
      ...localSettings,
      logTasks: val,
      logTransactions: val,
      logCustomers: val,
      logInventory: val,
      logSettings: val,
      logUsers: val,
      logAppSessions: val,
      logActionsAdd: val,
      logActionsEdit: val,
      logActionsDelete: val,
      logActionsSettings: val,
      logActionsSessions: val
    });
  };

  const handleCleanOldLogsNow = async () => {
    if (localSettings.retentionDays <= 0) {
      setCleaningStatus('فترة الاحتفاظ محددة كـ "دائم"، لا توجد سجلات للحذف.');
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - localSettings.retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      const allLogs = await db.auditLogs.toArray();
      const toDelete = allLogs.filter(l => l.timestamp < cutoffIso).map(l => l.id).filter(Boolean) as number[];

      if (toDelete.length === 0) {
        setCleaningStatus('لم يتم العثور على أي سجلات أقدم من الفترة المحددة.');
      } else {
        await db.auditLogs.bulkDelete(toDelete);
        setCleaningStatus(`✅ تم تنظيف وحذف ${toDelete.length} سجل قديم تجاوزت مدتها ${localSettings.retentionDays} يوم بنجاح.`);
        if (onRefreshLogs) onRefreshLogs();
      }
    } catch (e) {
      console.error(e);
      setCleaningStatus('حدث خطأ أثناء تنظيف السجلات.');
    }
  };

  const handleSaveAndClose = () => {
    onSave(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    setLocalSettings(DEFAULT_ACTIVITY_LOGGER_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-[95000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 95000 }} dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>إعدادات مسجل الحركة</span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-black border",
                  localSettings.enabled 
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30"
                )}>
                  {localSettings.enabled ? '🟢 المسجل قيد التشغيل' : '🔴 المسجل متوقف'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">التحكم بمسجل الحركات، تحديد أنواع العمليات، وفترات التسجيل والاحتفاظ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Power Switch Banner */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-750 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              localSettings.enabled 
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
            )}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 dark:text-white block">تشغيل مسجل الحركة والعمليات</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {localSettings.enabled 
                  ? 'المسجل يراقب ويوثق الحركات والتعديلات تلقائياً طبقاً للخيارات المحددة أدناه'
                  : 'تم إيقاف التسجيل مؤقتاً، لن يتم تدوين أي حركات جديدة في السجل حتى إعادة التفعيل'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLocalSettings({ ...localSettings, enabled: !localSettings.enabled })}
            className={cn(
              "w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shrink-0",
              localSettings.enabled ? "bg-emerald-500 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
            )}
          >
            <motion.div layout className="bg-white w-5 h-5 rounded-full shadow-md" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 px-4 pt-2 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
              activeTab === 'schedule'
                ? "text-rose-600 dark:text-rose-400 border-rose-500 bg-white dark:bg-slate-800/90 shadow-2xs"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/40"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>فترات وجدولة التسجيل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('types')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
              activeTab === 'types'
                ? "text-rose-600 dark:text-rose-400 border-rose-500 bg-white dark:bg-slate-800/90 shadow-2xs"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/40"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>أنواع الحركات والعمليات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retention')}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
              activeTab === 'retention'
                ? "text-rose-600 dark:text-rose-400 border-rose-500 bg-white dark:bg-slate-800/90 shadow-2xs"
                : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/40"
            )}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>فترة الاحتفاظ والحساسية</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: فترات وجدولة التسجيل */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-3">
                <label className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <CalendarRange className="w-4 h-4" />
                  <span>تحديد فترات تسجيل الحركات اليومية والأسبوعية:</span>
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  يمكنك اختيار تسجيل الحركات على مدار اليوم بالكامل (24 ساعة) أو حصر التسجيل خلال ساعات وأيام عمل محددة:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Option 1: All Day */}
                  <div
                    onClick={() => setLocalSettings({ ...localSettings, timeScheduleType: 'all_day' })}
                    className={cn(
                      "p-3.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all",
                      localSettings.timeScheduleType === 'all_day'
                        ? "bg-rose-500/15 border-rose-500 text-slate-900 dark:text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">طوال اليوم (24 ساعة / 7 أيام)</span>
                      {localSettings.timeScheduleType === 'all_day' && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">تسجيل وتوثيق أي حركة أو تعديل يحدث في أي وقت دون قيود</span>
                  </div>

                  {/* Option 2: Working Hours Only */}
                  <div
                    onClick={() => setLocalSettings({ ...localSettings, timeScheduleType: 'working_hours' })}
                    className={cn(
                      "p-3.5 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all",
                      localSettings.timeScheduleType === 'working_hours'
                        ? "bg-rose-500/15 border-rose-500 text-slate-900 dark:text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">خلال ساعات وأيام محددة فقط</span>
                      {localSettings.timeScheduleType === 'working_hours' && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">تسجيل الحركات فقط ضمن نافذة التوقيت والأيام المحددة أدناه</span>
                  </div>
                </div>

                {/* Sub-settings for working hours */}
                {localSettings.timeScheduleType === 'working_hours' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-rose-500/30 space-y-3 mt-2 shadow-2xs"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">وقت بداية التسجيل (يومياً)</label>
                        <input
                          type="time"
                          value={localSettings.workingHoursStart}
                          onChange={(e) => setLocalSettings({ ...localSettings, workingHoursStart: e.target.value })}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">وقت نهاية التسجيل (يومياً)</label>
                        <input
                          type="time"
                          value={localSettings.workingHoursEnd}
                          onChange={(e) => setLocalSettings({ ...localSettings, workingHoursEnd: e.target.value })}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">الأيام المعتمدة للتسجيل:</label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                        {DAYS_OF_WEEK.map(day => {
                          const isSelected = (localSettings.workingDays || []).includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => handleToggleDay(day.id)}
                              className={cn(
                                "py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center border",
                                isSelected
                                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                              )}
                            >
                              {day.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: تحديد أنواع الحركات والعمليات */}
          {activeTab === 'types' && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">حدد الأقسام والإجراءات التي ترغب أن يقوم المسجل بتدوينها:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllTypes(true)}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-slate-400 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllTypes(false)}
                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              {/* Entity types grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 block">1. الأقسام والمجالات المشمولة بالتسجيل:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'logTasks', label: 'المهام والصيانة', desc: 'إضافة المهام، تعديل الحالات، والتسليم', icon: ClipboardList },
                    { key: 'logTransactions', label: 'الماليات والحسابات', desc: 'سندات القبض، الصرف، الدفعات، والتحويلات', icon: Banknote },
                    { key: 'logCustomers', label: 'سجل العملاء', desc: 'إضافة، تعديل وحذف بيانات العملاء', icon: Users },
                    { key: 'logInventory', label: 'المخزن وقطع الغيار', desc: 'إدخال القطع، تعديل الأسعار، وسحب المواد', icon: Package },
                    { key: 'logSettings', label: 'الإعدادات والخيارات', desc: 'تغيير خيارات النظام وتخصيص الواجهات', icon: Settings },
                    { key: 'logUsers', label: 'المستخدمون والصلاحيات', desc: 'إدارة المستخدمين، تسجيل الدخول والأذونات', icon: UserCheck },
                    { key: 'logAppSessions', label: 'جلسات التطبيق والتواجد', desc: 'فتح التطبيق، الانتقال للخلفية، والعودة', icon: Eye }
                  ].map(item => {
                    const Icon = item.icon;
                    const isChecked = (localSettings as any)[item.key];
                    return (
                      <div
                        key={item.key}
                        onClick={() => setLocalSettings({ ...localSettings, [item.key]: !isChecked })}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/70 flex items-center justify-between cursor-pointer transition-all select-none shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("p-2 rounded-lg shrink-0", isChecked ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500")}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{item.label}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{item.desc}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mr-2",
                          isChecked ? "bg-rose-600 border-rose-500 text-white shadow-xs" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50"
                        )}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action types */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-750">
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 block">2. نوع الإجراءات المسجلة:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'logActionsAdd', label: 'عمليات الإضافة (جديد)' },
                    { key: 'logActionsEdit', label: 'عمليات التعديل والتحديث' },
                    { key: 'logActionsDelete', label: 'عمليات الحذف والإلغاء' },
                    { key: 'logActionsSettings', label: 'تغيير خيارات الإعدادات' },
                    { key: 'logActionsSessions', label: 'حركات التواجد والجلسات' }
                  ].map(action => {
                    const isChecked = (localSettings as any)[action.key];
                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, [action.key]: !isChecked })}
                        className={cn(
                          "p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer",
                          isChecked
                            ? "bg-rose-50 dark:bg-slate-800 border-rose-300 dark:border-rose-500/40 text-slate-900 dark:text-white shadow-2xs"
                            : "bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        <span className="text-xs font-bold truncate">{action.label}</span>
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 mr-1.5",
                          isChecked ? "bg-rose-600 border-rose-500 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent"
                        )}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: فترات الاحتفاظ بالسجلات والحساسية */}
          {activeTab === 'retention' && (
            <div className="space-y-4">
              {/* Retention period */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-3">
                <label className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <Hourglass className="w-4 h-4" />
                  <span>فترة الاحتفاظ بالسجلات وتخزين الحركات:</span>
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  حدد المدة الزمنية التي يظل فيها سجل الحركة محفوظاً قبل أن يتم تنظيفه لتوفير مساحة الذاكرة وسرعة الأداء:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { days: 7, label: '7 أيام', sub: 'أسبوع واحد' },
                    { days: 15, label: '15 يوماً', sub: 'أسبوعين' },
                    { days: 30, label: '30 يوماً', sub: 'شهر كامل' },
                    { days: 90, label: '90 يوماً', sub: '3 أشهر (موصى به)' },
                    { days: 180, label: '180 يوماً', sub: '6 أشهر' },
                    { days: 365, label: 'سنة كاملة', sub: '365 يوماً' },
                    { days: 0, label: 'دائم بلا حدود', sub: 'لا يتم الحذف أبداً' }
                  ].map(ret => (
                    <button
                      key={ret.days}
                      type="button"
                      onClick={() => setLocalSettings({ ...localSettings, retentionDays: ret.days })}
                      className={cn(
                        "p-2.5 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                        localSettings.retentionDays === ret.days
                          ? "bg-rose-500/15 border-rose-500 text-slate-900 dark:text-white shadow-2xs"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
                      )}
                    >
                      <span className="text-xs font-black">{ret.label}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{ret.sub}</span>
                    </button>
                  ))}
                </div>

                {/* Auto clean checkbox */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">التنظيف التلقائي للسجلات القديمة</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">حذف السجلات المتجاوزة للفترة المحددة تلقائياً عند تشغيل التطبيق</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, autoCleanOldRecords: !localSettings.autoCleanOldRecords })}
                    className={cn(
                      "w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer",
                      localSettings.autoCleanOldRecords ? "bg-rose-600 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                    )}
                  >
                    <motion.div layout className="bg-white w-4 h-4 rounded-full shadow-md" />
                  </button>
                </div>

                {/* Manual Clean Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCleanOldLogsNow}
                    className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تنظيف السجلات التي تجاوزت الفترة الآن</span>
                  </button>
                  {cleaningStatus && (
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-slate-900 px-3 py-1 rounded-lg border border-amber-200 dark:border-slate-700">
                      {cleaningStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Sensitivity of Session Tracking */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-3">
                <label className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>حساسية تدوين حركات الجلسات والتواجد:</span>
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  تجاهل حركات التبديل السريع جداً للتطبيق في الخلفية أو الواجهة إذا كانت أقل من هذا الحد لتجنب تضخم السجل بحركات غير هامة:
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={localSettings.minSessionDurationSeconds}
                    onChange={(e) => setLocalSettings({ ...localSettings, minSessionDurationSeconds: parseInt(e.target.value) || 1 })}
                    className="flex-1 accent-rose-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
                  />
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[80px] text-center shadow-2xs">
                    {localSettings.minSessionDurationSeconds} ثواني
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  (أي حركة بقاء في الواجهة أو الخلفية تقل عن {localSettings.minSessionDurationSeconds} ثوانٍ لن يتم تسجيلها كحركة تواجد منفصلة).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
            title="استعادة الإعدادات الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط للافتراضي</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-transparent transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
