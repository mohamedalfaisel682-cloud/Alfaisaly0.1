import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Eye, 
  PlusCircle, 
  Banknote, 
  CalendarClock, 
  Smartphone, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Clock, 
  Settings, 
  RotateCcw, 
  Check, 
  Palette, 
  SlidersHorizontal, 
  Play, 
  Pause, 
  User,
  CheckCircle2,
  ClockPlus,
  Layers,
  ChevronDown,
  Hourglass,
  CheckCheck,
  Maximize2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/db';

export type CountdownPosition = 'details-inline' | 'top-header' | 'bottom-bar' | 'badge-corner';
export type TickerSize = 'compact' | 'medium' | 'large';

export interface FlashTickerSettings {
  displayDuration: number; // in seconds
  autoRotate: boolean;
  tickerSize: TickerSize;

  // Countdown placement & colors
  countdownPosition: CountdownPosition;
  countdownTextColor: string;
  countdownBgColor: string;
  countdownBorderColor: string;
  overdueTextColor: string;
  overdueBgColor: string;
  overdueBorderColor: string;

  // Visibility flags
  showCustomer: boolean;
  showStatusDropdown: boolean;
  showDeviceCount: boolean;
  showDeviceModel: boolean;
  showFinancials: boolean;
  showCountdown: boolean;
  showBottomBar: boolean;
  showActions: boolean;

  // Header bar styling (النص والأيقونات أعلى الواجهة)
  headerBg: string;
  headerTextBg: string;
  headerBorderColor: string;
  headerTextColor: string;
  headerIconColor: string;

  // Card & details styling (إطار وتفاصيل المهمة وخلفيتها)
  containerBg: string;
  containerBorderColor: string;
  containerBorderWidth: number;
  detailsBg: string;
  detailsTextColor: string;
  detailsLabelColor: string;
  detailsDividerColor: string;
  detailsIconColor: string;
}

const DEFAULT_SETTINGS: FlashTickerSettings = {
  displayDuration: 3.5,
  autoRotate: true,
  tickerSize: 'medium',

  // Countdown
  countdownPosition: 'details-inline',
  countdownTextColor: '#facc15',
  countdownBgColor: 'rgba(161, 98, 7, 0.28)',
  countdownBorderColor: '#ca8a04',
  overdueTextColor: '#f87171',
  overdueBgColor: 'rgba(225, 29, 72, 0.25)',
  overdueBorderColor: '#e11d48',

  // Visibility flags
  showCustomer: true,
  showStatusDropdown: true,
  showDeviceCount: true,
  showDeviceModel: true,
  showFinancials: true,
  showCountdown: true,
  showBottomBar: true,
  showActions: true,

  // Header: افتراضي شفاف بلون أصفر غامق للأيقونات والنص
  headerBg: 'rgba(161, 98, 7, 0.22)',
  headerTextBg: 'rgba(202, 138, 4, 0.30)',
  headerBorderColor: 'rgba(202, 138, 4, 0.45)',
  headerTextColor: '#facc15',
  headerIconColor: '#facc15',

  // Card & details: خلفية المهام بلا لون (شفافة تماماً) وإطار متناسق
  containerBg: 'transparent',
  containerBorderColor: '#ca8a04',
  containerBorderWidth: 2,
  detailsBg: 'transparent',
  detailsTextColor: '#ffffff',
  detailsLabelColor: '#cbd5e1',
  detailsDividerColor: 'rgba(202, 138, 4, 0.35)',
  detailsIconColor: '#facc15'
};

const DEFAULT_STATUS_LIST = [
  'معلقة',
  'جاري التنفيذ',
  'تمت الصيانة',
  'للتسليم',
  'تم التسليم',
  'منتهية'
];

const COLOR_PRESETS = [
  {
    name: 'الأصفر الذهبي الشفاف (الافتراضي)',
    color: '#facc15',
    settings: {
      headerBg: 'rgba(161, 98, 7, 0.22)',
      headerTextBg: 'rgba(202, 138, 4, 0.30)',
      headerTextColor: '#facc15',
      headerIconColor: '#facc15',
      headerBorderColor: 'rgba(202, 138, 4, 0.45)',
      containerBg: 'transparent',
      containerBorderColor: '#ca8a04',
      detailsBg: 'transparent',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#cbd5e1',
      detailsDividerColor: 'rgba(202, 138, 4, 0.35)',
      detailsIconColor: '#facc15',
      countdownTextColor: '#facc15',
      countdownBgColor: 'rgba(161, 98, 7, 0.28)',
      countdownBorderColor: '#ca8a04'
    }
  },
  {
    name: 'الزمردي الكلاسيكي الشفاف',
    color: '#10b981',
    settings: {
      headerBg: 'rgba(6, 78, 59, 0.25)',
      headerTextBg: 'rgba(16, 185, 129, 0.20)',
      headerTextColor: '#34d399',
      headerIconColor: '#34d399',
      headerBorderColor: 'rgba(16, 185, 129, 0.4)',
      containerBg: 'transparent',
      containerBorderColor: '#10b981',
      detailsBg: 'transparent',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#94a3b8',
      detailsDividerColor: 'rgba(16, 185, 129, 0.3)',
      detailsIconColor: '#34d399',
      countdownTextColor: '#34d399',
      countdownBgColor: 'rgba(6, 78, 59, 0.3)',
      countdownBorderColor: '#10b981'
    }
  },
  {
    name: 'السيان المستقبلي الشفاف',
    color: '#06b6d4',
    settings: {
      headerBg: 'rgba(8, 51, 68, 0.25)',
      headerTextBg: 'rgba(6, 182, 212, 0.20)',
      headerTextColor: '#22d3ee',
      headerIconColor: '#22d3ee',
      headerBorderColor: 'rgba(6, 182, 212, 0.4)',
      containerBg: 'transparent',
      containerBorderColor: '#06b6d4',
      detailsBg: 'transparent',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#93c5fd',
      detailsDividerColor: 'rgba(6, 182, 212, 0.3)',
      detailsIconColor: '#22d3ee',
      countdownTextColor: '#22d3ee',
      countdownBgColor: 'rgba(8, 51, 68, 0.3)',
      countdownBorderColor: '#06b6d4'
    }
  },
  {
    name: 'الأرجواني الملكي الشفاف',
    color: '#a855f7',
    settings: {
      headerBg: 'rgba(59, 7, 100, 0.25)',
      headerTextBg: 'rgba(168, 85, 247, 0.20)',
      headerTextColor: '#c084fc',
      headerIconColor: '#c084fc',
      headerBorderColor: 'rgba(168, 85, 247, 0.4)',
      containerBg: 'transparent',
      containerBorderColor: '#a855f7',
      detailsBg: 'transparent',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#d8b4fe',
      detailsDividerColor: 'rgba(168, 85, 247, 0.3)',
      detailsIconColor: '#c084fc',
      countdownTextColor: '#c084fc',
      countdownBgColor: 'rgba(59, 7, 100, 0.3)',
      countdownBorderColor: '#a855f7'
    }
  },
  {
    name: 'الأسود الليلي الفاحم',
    color: '#38bdf8',
    settings: {
      headerBg: '#0f172a',
      headerTextBg: '#1e293b',
      headerTextColor: '#38bdf8',
      headerIconColor: '#38bdf8',
      headerBorderColor: '#334155',
      containerBg: '#020617',
      containerBorderColor: '#38bdf8',
      detailsBg: '#020617',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#94a3b8',
      detailsDividerColor: '#1e293b',
      detailsIconColor: '#38bdf8',
      countdownTextColor: '#38bdf8',
      countdownBgColor: '#0f172a',
      countdownBorderColor: '#38bdf8'
    }
  },
  {
    name: 'النهاري الفاتح الراقي',
    color: '#d97706',
    settings: {
      headerBg: '#fef3c7',
      headerTextBg: '#fde68a',
      headerTextColor: '#b45309',
      headerIconColor: '#b45309',
      headerBorderColor: '#f59e0b',
      containerBg: '#ffffff',
      containerBorderColor: '#d97706',
      detailsBg: '#ffffff',
      detailsTextColor: '#0f172a',
      detailsLabelColor: '#64748b',
      detailsDividerColor: '#fef3c7',
      detailsIconColor: '#d97706',
      countdownTextColor: '#b45309',
      countdownBgColor: '#fef3c7',
      countdownBorderColor: '#d97706'
    }
  }
];

export const FlashTicker = ({ 
  tasks, 
  notes = [], 
  statusOptions = [],
  onAddNote, 
  onViewNote, 
  onEditTask,
  onUpdateStatus,
  onUpdateExecutionTime,
  onClose,
  uiSettings 
}: {
  tasks: any[];
  notes?: any[];
  statusOptions?: string[];
  onAddNote?: (taskId: number) => void;
  onViewNote?: (taskId: number) => void;
  onEditTask?: (task: any) => void;
  onUpdateStatus?: (task: any, newStatus: string) => void;
  onUpdateExecutionTime?: (task: any, newTimeIso: string) => void;
  onClose?: () => void;
  uiSettings?: any;
}) => {
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'countdown' | 'fields' | 'colors'>('general');
  const [isExtendMenuOpen, setIsExtendMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live second-by-second ticker for the countdown timer
  const [nowTime, setNowTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Load persistent settings with migration to the requested new defaults
  const [settings, setSettings] = useState<FlashTickerSettings>(() => {
    try {
      const saved = localStorage.getItem('flash_ticker_custom_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If old default background was solid #0f172a and without headerIconColor, update to new default
        if (parsed.containerBg === '#0f172a' && !parsed.headerIconColor) {
          return DEFAULT_SETTINGS;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (partial: Partial<FlashTickerSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('flash_ticker_custom_settings', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem('flash_ticker_custom_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // ignore
    }
  };

  // Filter tasks scheduled within the next 48 hours and sort by execution time ascending (closest first)
  const activeTasks = useMemo(() => {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return tasks.filter((t: any) => {
      if (!t.executionTime) return false;
      const d = new Date(t.executionTime).getTime();
      if (isNaN(d)) return false;
      const isTerminalStatus = ['completed', 'cancelled-delivered', 'archived', 'ملغية', 'إلغاء المهمة', 'maintenance-done', 'reported-cancelled'].includes(t.status);
      if (isTerminalStatus) return false;
      return d >= (startOfToday - 12 * 60 * 60 * 1000) && d <= in48Hours.getTime();
    }).sort((a: any, b: any) => new Date(a.executionTime).getTime() - new Date(b.executionTime).getTime());
  }, [tasks]);

  // Automatic rotation
  useEffect(() => {
    if (!settings.autoRotate || activeTasks.length <= 1) return;
    const totalTasks = activeTasks.length;
    const durationMs = Math.max(1000, (settings.displayDuration || 3.5) * 1000);

    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % totalTasks);
    }, durationMs);
    return () => clearInterval(timer);
  }, [activeTasks.length, settings.autoRotate, settings.displayDuration]);

  // Adjust index bounds if activeTasks change
  const currentTask = activeTasks.length > 0 ? activeTasks[tickerIndex % activeTasks.length] : null;
  const hasNote = currentTask && notes.some((n: any) => n.taskId === currentTask.id);

  // Available statuses list
  const availableStatuses = useMemo(() => {
    const list = (statusOptions && statusOptions.length > 0) ? statusOptions : DEFAULT_STATUS_LIST;
    return list.filter(s => s !== 'تم الفحص والابلاغ' && s !== 'ملغية');
  }, [statusOptions]);

  // Dynamic Size Classes & Styles
  const sizeStyles = useMemo(() => {
    switch (settings.tickerSize) {
      case 'compact':
        return {
          wrapper: 'my-1.5 mx-0.5',
          headerPad: 'px-3 py-1.5',
          headerTitleSize: 'text-[11px]',
          detailsPad: 'px-3 py-2',
          customerSize: 'text-xs',
          customerLabel: 'text-[9px]',
          modelSize: 'text-[11px]',
          badgeText: 'text-[9px] px-1 py-0.5',
          finValSize: 'text-[11px]',
          bottomPad: 'pt-1.5',
          buttonClass: 'px-2.5 py-1 text-[11px] rounded-lg',
          iconSize: 'w-3 h-3',
        };
      case 'large':
        return {
          wrapper: 'my-3.5 mx-1',
          headerPad: 'px-5 py-3',
          headerTitleSize: 'text-sm font-black',
          detailsPad: 'px-5 py-3.5',
          customerSize: 'text-sm sm:text-base font-black',
          customerLabel: 'text-xs font-bold',
          modelSize: 'text-xs sm:text-sm font-bold',
          badgeText: 'text-[11px] px-2 py-0.5',
          finValSize: 'text-sm font-black',
          bottomPad: 'pt-2.5',
          buttonClass: 'px-4 py-2 text-xs sm:text-sm rounded-xl',
          iconSize: 'w-4 h-4',
        };
      case 'medium':
      default:
        return {
          wrapper: 'my-2.5 mx-1',
          headerPad: 'px-3.5 sm:px-4 py-2',
          headerTitleSize: 'text-xs font-black',
          detailsPad: 'px-3.5 sm:px-4 py-2.5',
          customerSize: 'text-xs sm:text-sm font-black',
          customerLabel: 'text-[10px] font-bold',
          modelSize: 'text-xs font-bold',
          badgeText: 'text-[10px] px-1.5 py-0.5',
          finValSize: 'text-xs font-black',
          bottomPad: 'pt-2',
          buttonClass: 'px-3 py-1.5 text-xs rounded-xl',
          iconSize: 'w-3.5 h-3.5',
        };
    }
  }, [settings.tickerSize]);

  // Live countdown calculation
  const getCountdown = (execTimeStr: string) => {
    if (!execTimeStr) return null;
    const target = new Date(execTimeStr).getTime();
    if (isNaN(target)) return null;

    const diff = target - nowTime;
    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);

    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return {
        isOverdue,
        text: isOverdue ? `متأخر: ${days}ي و ${remHours}س` : `متبقي: ${days}ي و ${remHours}س`,
        formatted: `${days}d ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`
      };
    }

    return {
      isOverdue,
      text: isOverdue ? `متأخر: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `متبقي: ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
      formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    };
  };

  const formatExecTime = (dStr: string) => {
    try {
      const d = new Date(dStr);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      const isTomorrow = d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
      
      const timeStr = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `اليوم ${timeStr}`;
      if (isTomorrow) return `غداً ${timeStr}`;
      
      const dayName = d.toLocaleDateString('ar-SA', { weekday: 'short' });
      return `${dayName} ${timeStr}`;
    } catch {
      return dStr;
    }
  };

  const getDeviceCount = (task: any) => {
    if (task.devices && Array.isArray(task.devices) && task.devices.length > 0) {
      return task.devices.reduce((acc: number, d: any) => acc + (Number(d.quantity) || 1), 0);
    }
    if (task.deviceCount && typeof task.deviceCount === 'number') {
      return task.deviceCount;
    }
    return 1;
  };

  const getDeviceModel = (task: any) => {
    if (task.devices && Array.isArray(task.devices) && task.devices.length > 0) {
      return task.devices.map((d: any) => `${d.brand || ''} ${d.type || ''}`.trim()).filter(Boolean).join('، ') || 'غير محدد';
    }
    const model = `${task.brand || ''} ${task.deviceType || ''}`.trim();
    return model || 'غير محدد';
  };

  const handleStatusChange = async (task: any, newStatus: string) => {
    if (!task) return;
    try {
      if (onUpdateStatus) {
        onUpdateStatus(task, newStatus);
      } else {
        await db.tasks.update(task.id, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      }
      showToast(`تم تغيير الحالة إلى: ${newStatus}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkReadyForDelivery = async (task: any) => {
    if (!task) return;
    const readyStatus = 'للتسليم';
    try {
      if (onUpdateStatus) {
        onUpdateStatus(task, readyStatus);
      } else {
        await db.tasks.update(task.id, {
          status: readyStatus,
          updatedAt: new Date().toISOString()
        });
      }
      showToast('✅ تم اعتماد الحالة: للتسليم');
    } catch (err) {
      console.error(err);
    }
  };

  const handleExtendExecutionTime = async (task: any, newTimeIso: string, label: string) => {
    if (!task) return;
    try {
      if (onUpdateExecutionTime) {
        await onUpdateExecutionTime(task, newTimeIso);
      } else {
        await db.tasks.update(task.id, {
          executionTime: newTimeIso,
          updatedAt: new Date().toISOString()
        });
      }
      setIsExtendMenuOpen(false);
      showToast(`تم تمديد وقت المهمة (${label})`);
    } catch (err) {
      console.error(err);
    }
  };

  const addMinutes = (dateStr: string, minutes: number) => {
    const base = Math.max(Date.now(), new Date(dateStr).getTime());
    return new Date(base + minutes * 60 * 1000).toISOString();
  };

  const getNextTaskTime = (current: any, allTasks: any[]) => {
    const currentTime = new Date(current.executionTime).getTime();
    const subsequentTasks = allTasks
      .filter(t => t.id !== current.id && new Date(t.executionTime).getTime() >= currentTime)
      .sort((a, b) => new Date(a.executionTime).getTime() - new Date(b.executionTime).getTime());

    if (subsequentTasks.length > 0) {
      const nextTask = subsequentTasks[0];
      const nextTime = new Date(nextTask.executionTime).getTime();
      return {
        iso: new Date(nextTime + 30 * 60 * 1000).toISOString(),
        info: `بعد ${nextTask.customer} (+30د)`
      };
    }
    return {
      iso: new Date(Math.max(Date.now(), currentTime) + 30 * 60 * 1000).toISOString(),
      info: '+30 دقيقة'
    };
  };

  const getAfterLastTaskTime = (current: any, allTasks: any[]) => {
    const otherTasks = allTasks
      .filter(t => t.id !== current.id)
      .sort((a, b) => new Date(b.executionTime).getTime() - new Date(a.executionTime).getTime());

    if (otherTasks.length > 0) {
      const latestTask = otherTasks[0];
      const lastTime = new Date(latestTask.executionTime).getTime();
      return {
        iso: new Date(Math.max(Date.now(), lastTime) + 30 * 60 * 1000).toISOString(),
        info: `بعد آخر مهمة (${latestTask.customer})`
      };
    }
    return {
      iso: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      info: '+30 دقيقة'
    };
  };

  const actionBg = 'rgba(255, 255, 255, 0.08)';

  // Countdown badge element (reusable across positions)
  const renderCountdownBadge = (extraClasses = '') => {
    if (!currentTask || !settings.showCountdown) return null;
    const cd = getCountdown(currentTask.executionTime);
    if (!cd) return null;

    const textColor = cd.isOverdue ? settings.overdueTextColor : settings.countdownTextColor;
    const bgColor = cd.isOverdue ? settings.overdueBgColor : settings.countdownBgColor;
    const borderColor = cd.isOverdue ? settings.overdueBorderColor : settings.countdownBorderColor;

    return (
      <span
        style={{
          color: textColor,
          backgroundColor: bgColor,
          borderColor: borderColor
        }}
        className={cn(
          "px-2 py-0.5 rounded-lg font-black border tracking-wider flex items-center gap-1 transition-all select-none",
          settings.tickerSize === 'compact' ? "text-[10px]" : "text-[11px]",
          cd.isOverdue && "animate-pulse",
          extraClasses
        )}
      >
        <Hourglass className="w-3 h-3 shrink-0" style={{ color: textColor }} />
        <span>{cd.text}</span>
      </span>
    );
  };

  // Renders the settings modal
  const renderSettingsModal = () => (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            className="w-full max-w-xl bg-slate-50 border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-950"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-950">إعدادات الواجهة الفلاشية</h3>
                  <p className="text-[11px] text-slate-600 font-medium">تخصيص الحجم، مكان ولون عداد الوقت، وخيارات الألوان والشفافية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-3 pt-2 gap-1 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSettingsTab('general')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
                  settingsTab === 'general'
                    ? "text-amber-900 border-amber-500 bg-amber-50/80 font-black"
                    : "text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100/60"
                )}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>الحجم والسرعة</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('countdown')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
                  settingsTab === 'countdown'
                    ? "text-amber-900 border-amber-500 bg-amber-50/80 font-black"
                    : "text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100/60"
                )}
              >
                <Hourglass className="w-3.5 h-3.5" />
                <span>مكان ولون العداد</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('fields')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
                  settingsTab === 'fields'
                    ? "text-amber-900 border-amber-500 bg-amber-50/80 font-black"
                    : "text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100/60"
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>إظهار التفاصيل</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab('colors')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer shrink-0",
                  settingsTab === 'colors'
                    ? "text-amber-900 border-amber-500 bg-amber-50/80 font-black"
                    : "text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100/60"
                )}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>الألوان والشفافية</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50">
              {/* TAB 1: General (Size, duration, auto-rotate) */}
              {settingsTab === 'general' && (
                <div className="space-y-4">
                  {/* Size Selector */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-amber-600" />
                      <span>حجم الواجهة الفلاشية في الصفحة الرئيسية:</span>
                    </label>
                    <p className="text-[11px] text-slate-600 font-medium">اختر الحجم الأنسب لجهازك وشاشتك (صغير مدمج، قياسي متوازن، أو كبير بارز):</p>
                    
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { id: 'compact', label: 'مدمج (صغير)', desc: 'موفر للمساحة' },
                        { id: 'medium', label: 'قياسي (متوسط)', desc: 'الحجم المعتاد' },
                        { id: 'large', label: 'بارز (كبير)', desc: 'خطوط وعناصر أوضح' }
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateSettings({ tickerSize: s.id as TickerSize })}
                          className={cn(
                            "p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer",
                            settings.tickerSize === s.id
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs font-black"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 font-bold"
                          )}
                        >
                          <span className="text-xs font-black text-slate-950">{s.label}</span>
                          <span className="text-[10px] text-slate-600 font-medium">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-rotate toggle */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("p-2 rounded-lg", settings.autoRotate ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>
                        {settings.autoRotate ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-950 block">التبديل التلقائي للمهام</span>
                        <span className="text-[11px] text-slate-600 font-medium">الانتقال التلقائي للمهمة التالية عند انتهاء المدة</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSettings({ autoRotate: !settings.autoRotate })}
                      className={cn(
                        "w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer",
                        settings.autoRotate ? "bg-amber-500 justify-end" : "bg-slate-300 justify-start"
                      )}
                    >
                      <motion.div layout className="bg-white w-4 h-4 rounded-full shadow-md" />
                    </button>
                  </div>

                  {/* Display duration slider */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>زمن بقاء المهمة قبل ظهور التالية:</span>
                      </label>
                      <span className="text-sm font-black text-amber-900 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-300">
                        {settings.displayDuration} ثانية
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.5"
                      value={settings.displayDuration}
                      onChange={(e) => updateSettings({ displayDuration: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                    />

                    {/* Preset buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[1.5, 2.5, 3.5, 5, 7, 10].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateSettings({ displayDuration: val })}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer border",
                            settings.displayDuration === val
                              ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs font-black"
                              : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                          )}
                        >
                          {val} ثواني
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Countdown Timer Position and Colors */}
              {settingsTab === 'countdown' && (
                <div className="space-y-4">
                  {/* Countdown Position Selector */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                      <Hourglass className="w-4 h-4 text-amber-600" />
                      <span>مكان عداد الوقت في الواجهة الفلاشية:</span>
                    </label>
                    <p className="text-[11px] text-slate-600 font-medium">حدد الموضع الذي تود أن يظهر فيه عداد الوقت المتبقي:</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {[
                        { id: 'details-inline', title: 'بجانب موعد التنفيذ', desc: 'داخل حقل موعد التنفيذ في التفاصيل' },
                        { id: 'top-header', title: 'في شريط العنوان أعلى الواجهة', desc: 'بجانب عنوان مهام الـ 48 ساعة' },
                        { id: 'bottom-bar', title: 'في الشريط السفلي', desc: 'بجانب أزرار الإجراءات في الأسفل' },
                        { id: 'badge-corner', title: 'شارة زاوية البطاقة', desc: 'شارة عائمة بارزة في زاوية البطاقة' }
                      ].map(pos => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updateSettings({ countdownPosition: pos.id as CountdownPosition })}
                          className={cn(
                            "p-3 rounded-xl border flex flex-col items-start gap-1 text-right transition-all cursor-pointer",
                            settings.countdownPosition === pos.id
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black text-slate-950">{pos.title}</span>
                            {settings.countdownPosition === pos.id && <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />}
                          </div>
                          <span className="text-[10px] text-slate-600 font-medium">{pos.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Countdown Colors */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                    <span className="text-xs font-black text-slate-950 block border-b border-slate-200 pb-1.5">
                      تحديد ألوان عداد الوقت:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Countdown Text Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون نص العداد</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.countdownTextColor}
                            onChange={(e) => updateSettings({ countdownTextColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.countdownTextColor}</span>
                        </div>
                      </div>

                      {/* Countdown Bg Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون خلفية العداد</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.countdownBgColor.startsWith('#') ? settings.countdownBgColor : '#a16207'}
                            onChange={(e) => updateSettings({ countdownBgColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => updateSettings({ countdownBgColor: 'rgba(161, 98, 7, 0.28)' })}
                            className="text-[10px] text-amber-700 hover:underline font-bold shrink-0"
                            title="شفاف أصفر"
                          >
                            شفاف
                          </button>
                        </div>
                      </div>

                      {/* Countdown Border Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون إطار العداد</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.countdownBorderColor}
                            onChange={(e) => updateSettings({ countdownBorderColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.countdownBorderColor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Overdue alert colors */}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-black text-rose-700 block mb-2">لون العداد عند تأخر موعد التنفيذ:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">لون نص التأخير</label>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                            <input
                              type="color"
                              value={settings.overdueTextColor}
                              onChange={(e) => updateSettings({ overdueTextColor: e.target.value })}
                              className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.overdueTextColor}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">إطار التأخير</label>
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                            <input
                              type="color"
                              value={settings.overdueBorderColor}
                              onChange={(e) => updateSettings({ overdueBorderColor: e.target.value })}
                              className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                            />
                            <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.overdueBorderColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Visibility Fields */}
              {settingsTab === 'fields' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-700 font-bold mb-2">اختر التفاصيل التي ترغب بإظهارها أو إخفائها من بطاقة المهمة الفلاشية:</p>
                  
                  {[
                    { key: 'showCustomer', label: 'اسم العميل', desc: 'إظهار اسم صاحب المهمة', icon: User },
                    { key: 'showStatusDropdown', label: 'القائمة المنسدلة لحالة المهمة', desc: 'إمكانية تغيير حالة المهمة مباشرة من البطاقة', icon: ChevronDown },
                    { key: 'showDeviceCount', label: 'عدد الأجهزة', desc: 'إظهار إجمالي عدد الأجهزة بالمهمة', icon: Layers },
                    { key: 'showDeviceModel', label: 'طراز وموديل الجهاز', desc: 'إظهار ماركة ونوع الموديل', icon: Smartphone },
                    { key: 'showFinancials', label: 'البيانات المالية (التكلفة / الحساب / الباقي)', desc: 'عرض التكلفة الإجمالية والمدفوع والمتبقي', icon: Banknote },
                    { key: 'showCountdown', label: 'عداد الوقت المتبقي للتنفيذ', desc: 'عرض عداد تنازلي حي بالثواني لوقت التنفيذ', icon: Hourglass },
                    { key: 'showBottomBar', label: 'شريط أسفل الواجهة (تم التنفيذ وتمديد الوقت)', desc: 'إظهار أزرار اعتماد التسليم وتمديد الموعد', icon: CheckCircle2 },
                    { key: 'showActions', label: 'أزرار فتح المهمة والملاحظات', desc: 'إظهار زر فتح وتعديل المهمة وزر الملاحظة', icon: Eye }
                  ].map(item => {
                    const Icon = item.icon;
                    const isChecked = (settings as any)[item.key];
                    return (
                      <div 
                        key={item.key}
                        onClick={() => updateSettings({ [item.key]: !isChecked } as any)}
                        className="p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", isChecked ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-950 block">{item.label}</span>
                            <span className="text-[11px] text-slate-600 font-medium">{item.desc}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                          isChecked ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-slate-100"
                        )}>
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: Colors, Transparency & Borders */}
              {settingsTab === 'colors' && (
                <div className="space-y-4">
                  {/* Presets */}
                  <div>
                    <label className="text-xs font-black text-slate-950 block mb-2">نماذج ألوان سريعة:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COLOR_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateSettings(preset.settings)}
                          className="flex items-center gap-2 p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer text-right group shadow-2xs"
                        >
                          <span 
                            className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-2xs" 
                            style={{ backgroundColor: preset.color }}
                          />
                          <span className="text-[11px] font-black text-slate-900 group-hover:text-black truncate">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top Bar (الشريط والنص والأيقونات أعلى الواجهة) */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                    <span className="text-xs font-black text-slate-950 block border-b border-slate-200 pb-1.5">
                      ألوان شريط النص والأيقونات أعلى الواجهة:
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Header Text Bg */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">خلفية نص العنوان</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.headerTextBg.startsWith('#') ? settings.headerTextBg : '#ca8a04'}
                            onChange={(e) => updateSettings({ headerTextBg: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => updateSettings({ headerTextBg: 'rgba(202, 138, 4, 0.30)' })}
                            className="text-[10px] text-amber-700 hover:underline font-bold shrink-0"
                          >
                            شفاف أصفر
                          </button>
                        </div>
                      </div>

                      {/* Header Bg */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">خلفية الشريط العلوي</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.headerBg.startsWith('#') ? settings.headerBg : '#a16207'}
                            onChange={(e) => updateSettings({ headerBg: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => updateSettings({ headerBg: 'rgba(161, 98, 7, 0.22)' })}
                            className="text-[10px] text-amber-700 hover:underline font-bold shrink-0"
                          >
                            شفاف أصفر
                          </button>
                        </div>
                      </div>

                      {/* Header Text Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون نص العنوان</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.headerTextColor}
                            onChange={(e) => updateSettings({ headerTextColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.headerTextColor}</span>
                        </div>
                      </div>

                      {/* Header Icons Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون أيقونات الشريط العلوي</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.headerIconColor}
                            onChange={(e) => updateSettings({ headerIconColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.headerIconColor}</span>
                        </div>
                      </div>

                      {/* Header Border */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">إطار فاصل العنوان</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.headerBorderColor.startsWith('#') ? settings.headerBorderColor : '#ca8a04'}
                            onChange={(e) => updateSettings({ headerBorderColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">
                            {settings.headerBorderColor.slice(0, 7)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card & Details Styling (خلفية المهام بلا لون وإطار وتفاصيل المهمة) */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <span className="text-xs font-black text-slate-950">
                        ألوان إطار وخلفية وتفاصيل المهمة:
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSettings({ containerBg: 'transparent', detailsBg: 'transparent' })}
                        className="text-[11px] text-amber-700 hover:text-amber-800 font-black underline cursor-pointer"
                      >
                        جعل خلفية المهام بلا لون (شفافة)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Container Border Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون الإطار الخارجي</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.containerBorderColor}
                            onChange={(e) => updateSettings({ containerBorderColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.containerBorderColor}</span>
                        </div>
                      </div>

                      {/* Container Background */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">خلفية الواجهة</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.containerBg === 'transparent' ? '#ffffff' : settings.containerBg}
                            onChange={(e) => updateSettings({ containerBg: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => updateSettings({ containerBg: 'transparent' })}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer font-bold",
                              settings.containerBg === 'transparent' ? "bg-amber-100 text-amber-900 border-amber-300" : "text-slate-600 border-slate-300"
                            )}
                          >
                            بلا لون
                          </button>
                        </div>
                      </div>

                      {/* Details Icons Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون أيقونات تفاصيل المهمة</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.detailsIconColor}
                            onChange={(e) => updateSettings({ detailsIconColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.detailsIconColor}</span>
                        </div>
                      </div>

                      {/* Details Text Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون نصوص التفاصيل</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.detailsTextColor}
                            onChange={(e) => updateSettings({ detailsTextColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.detailsTextColor}</span>
                        </div>
                      </div>

                      {/* Details Labels Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون عناوين الحقول</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          <input
                            type="color"
                            value={settings.detailsLabelColor}
                            onChange={(e) => updateSettings({ detailsLabelColor: e.target.value })}
                            className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{settings.detailsLabelColor}</span>
                        </div>
                      </div>

                      {/* Border Width */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">سماكة الإطار (بكسل)</label>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
                          {[1, 2, 3, 4].map(px => (
                            <button
                              key={px}
                              type="button"
                              onClick={() => updateSettings({ containerBorderWidth: px })}
                              className={cn(
                                "flex-1 py-1 text-xs font-bold rounded cursor-pointer transition-all",
                                settings.containerBorderWidth === px
                                  ? "bg-amber-500 text-slate-950 font-black shadow-2xs"
                                  : "text-slate-700 hover:bg-slate-200"
                              )}
                            >
                              {px}px
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-between items-center gap-3 shadow-2xs">
              <button
                type="button"
                onClick={resetSettings}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                title="استعادة الإعدادات الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط للافتراضي</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                حفظ وإغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // If there are no scheduled tasks within the next 48 hours, show an elegant animated card
  if (activeTasks.length === 0) {
    return (
      <>
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          style={{ 
            backgroundColor: settings.containerBg, 
            borderColor: settings.containerBorderColor,
            borderWidth: `${settings.containerBorderWidth}px`
          }}
          className={cn(
            "rounded-2xl shadow-xl overflow-hidden relative backdrop-blur-xs",
            sizeStyles.wrapper
          )}
        >
          <div 
            style={{ backgroundColor: settings.containerBorderColor }} 
            className="absolute top-0 right-0 h-full w-1.5 animate-pulse" 
          />
          
          <div 
            style={{ 
              backgroundColor: settings.headerBg, 
              borderBottomColor: settings.headerBorderColor 
            }} 
            className={cn("border-b flex justify-between items-center", sizeStyles.headerPad)}
          >
            <div 
              style={{ 
                backgroundColor: settings.headerTextBg,
                color: settings.headerTextColor 
              }} 
              className="flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg border border-white/5"
            >
              <CalendarClock className="w-4 h-4" style={{ color: settings.headerIconColor }} />
              <span className={sizeStyles.headerTitleSize}>مهام الـ 48 ساعة القادمة (0)</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="إعدادات الواجهة الفلاشية"
              >
                <Settings className="w-4 h-4" style={{ color: settings.headerIconColor }} />
              </button>

              {onClose && (
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="إغلاق والعودة للأزرار الرئيسية"
                >
                  <X className="w-4 h-4" style={{ color: settings.headerIconColor }} />
                </button>
              )}
            </div>
          </div>

          <div className={cn("flex items-center justify-between gap-3 text-slate-300", sizeStyles.detailsPad)}>
            <div className="flex items-center gap-3">
              <div 
                style={{ borderColor: settings.containerBorderColor }} 
                className="w-10 h-10 rounded-xl bg-white/5 border flex items-center justify-center shrink-0"
              >
                <Sparkles style={{ color: settings.headerIconColor }} className="w-5 h-5" />
              </div>
              <div>
                <p style={{ color: settings.detailsTextColor }} className="font-bold text-sm">
                  لا توجد مهام صيانة مجدولة للـ 48 ساعة المقبلة
                </p>
                <p style={{ color: settings.detailsLabelColor }} className="text-xs mt-0.5">
                  يمكنك تحديد موعد تنفيذ لأي مهمة من نافذة المهمة لتظهر هنا تلقائياً
                </p>
              </div>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                style={{ 
                  borderColor: settings.containerBorderColor,
                  color: settings.headerTextColor
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer active:scale-95"
              >
                الأزرار الرئيسية
              </button>
            )}
          </div>
        </motion.div>

        {renderSettingsModal()}
      </>
    );
  }

  const deviceCount = currentTask ? getDeviceCount(currentTask) : 1;
  const deviceModel = currentTask ? getDeviceModel(currentTask) : '';
  const totalCost = currentTask?.cost || 0;
  const depositPaid = currentTask?.deposit || 0;
  const remainingBalance = totalCost - depositPaid;
  const isReadyForDelivery = currentTask?.status === 'للتسليم' || currentTask?.status === 'ready-to-deliver';

  // Calculated times for extension options
  const nextTaskExt = currentTask ? getNextTaskTime(currentTask, activeTasks) : null;
  const afterLastTaskExt = currentTask ? getAfterLastTaskTime(currentTask, activeTasks) : null;

  return (
    <>
      <div 
        style={{ 
          backgroundColor: settings.containerBg, 
          borderColor: settings.containerBorderColor,
          borderWidth: `${settings.containerBorderWidth}px`
        }} 
        className={cn(
          "rounded-2xl shadow-2xl overflow-hidden relative group transition-colors flex flex-col backdrop-blur-xs",
          sizeStyles.wrapper
        )}
      >
        <div 
          style={{ backgroundColor: settings.containerBorderColor }} 
          className="absolute top-0 right-0 h-full w-2 animate-pulse" 
        />

        {/* Corner Badge Countdown (if selected) */}
        {settings.countdownPosition === 'badge-corner' && (
          <div className="absolute top-2 left-12 z-20">
            {renderCountdownBadge()}
          </div>
        )}

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-amber-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-amber-400/50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 1. Header bar (الشريط والنص والأيقونات أعلى الواجهة) */}
        <div 
          style={{ 
            backgroundColor: settings.headerBg, 
            borderBottomColor: settings.headerBorderColor 
          }} 
          className={cn("border-b flex justify-between items-center transition-colors", sizeStyles.headerPad)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span 
                style={{ backgroundColor: settings.headerIconColor }} 
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              />
              <span 
                style={{ backgroundColor: settings.headerIconColor }} 
                className="relative inline-flex rounded-full h-2.5 w-2.5"
              />
            </span>

            {/* Custom Header Text with its own background & text color */}
            <div 
              style={{ 
                backgroundColor: settings.headerTextBg, 
                color: settings.headerTextColor 
              }} 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 transition-colors shadow-xs"
            >
              <CalendarClock className="w-4 h-4 shrink-0" style={{ color: settings.headerIconColor }} />
              <span className={sizeStyles.headerTitleSize}>
                مهام الـ 48 ساعة القادمة ({activeTasks.length})
              </span>
            </div>

            {/* Top-Header Countdown Position (if selected) */}
            {settings.countdownPosition === 'top-header' && (
              <div className="mr-1">
                {renderCountdownBadge()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto-rotate status indicator */}
            {!settings.autoRotate && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 hidden xs:flex items-center gap-1 font-bold">
                <Pause className="w-2.5 h-2.5" />
                متوقف
              </span>
            )}

            {/* Pagination dots */}
            <div className="flex gap-1 items-center">
              {activeTasks.slice(0, 10).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTickerIndex(i)}
                  style={{ 
                    backgroundColor: i === (tickerIndex % activeTasks.length) ? settings.headerTextColor : settings.headerBorderColor 
                  }} 
                  className={cn("h-1.5 rounded-full transition-all cursor-pointer", i === (tickerIndex % activeTasks.length) ? "w-3" : "w-1.5")} 
                  title={`المهمة ${i + 1}`}
                />
              ))}
            </div>

            {/* Prev / Next controls */}
            {activeTasks.length > 1 && (
              <div className="flex items-center gap-0.5 mr-0.5">
                <button
                  type="button"
                  onClick={() => setTickerIndex(prev => (prev - 1 + activeTasks.length) % activeTasks.length)}
                  className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="المهمة السابقة"
                >
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: settings.headerIconColor }} />
                </button>
                <button
                  type="button"
                  onClick={() => setTickerIndex(prev => (prev + 1) % activeTasks.length)}
                  className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="المهمة التالية"
                >
                  <ChevronLeft className="w-3.5 h-3.5" style={{ color: settings.headerIconColor }} />
                </button>
              </div>
            )}

            {/* Settings button in the corner */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer active:scale-95 border border-transparent hover:border-white/20"
              title="إعدادات الواجهة الفلاشية (الحجم، العداد، الألوان، الشفافية)"
            >
              <Settings className="w-4 h-4 transition-colors" style={{ color: settings.headerIconColor }} />
            </button>

            {/* Close button */}
            {onClose && (
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="إغلاق الواجهة الفلاشية والعودة للأزرار الرئيسية"
              >
                <X className="w-4 h-4" style={{ color: settings.headerIconColor }} />
              </button>
            )}
          </div>
        </div>

        {/* 2. Main Details Content (تفاصيل المهمة) */}
        <div 
          style={{ backgroundColor: settings.detailsBg }} 
          className={cn("relative transition-colors", sizeStyles.detailsPad)}
        >
          <AnimatePresence mode="wait">
            {currentTask && (
              <motion.div
                key={currentTask.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-2.5"
              >
                {/* Upper row of details */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    
                    {/* Customer */}
                    {settings.showCustomer && (
                      <div 
                        className={cn(
                          "flex flex-col min-w-0 max-w-[130px] sm:max-w-[180px]",
                          onEditTask && "cursor-pointer"
                        )}
                        onClick={() => onEditTask && onEditTask(currentTask)}
                        title="انقر لفتح تفاصيل المهمة"
                      >
                        <span style={{ color: settings.detailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                          <User className="w-2.5 h-2.5" style={{ color: settings.detailsIconColor }} /> العميل
                        </span>
                        <span style={{ color: settings.detailsTextColor }} className={cn("truncate", sizeStyles.customerSize)}>
                          {currentTask.customer}
                        </span>
                      </div>
                    )}

                    {/* Status Dropdown */}
                    {settings.showStatusDropdown && (
                      <div 
                        style={{ borderRightColor: settings.detailsDividerColor }}
                        className="flex flex-col border-r pr-2.5 sm:pr-3 shrink-0"
                      >
                        <span style={{ color: settings.detailsLabelColor }} className={cn("font-bold block mb-0.5", sizeStyles.customerLabel)}>
                          حالة المهمة
                        </span>
                        <div className="relative inline-block">
                          <select
                            value={currentTask.status}
                            onChange={(e) => handleStatusChange(currentTask, e.target.value)}
                            style={{ 
                              borderColor: settings.detailsDividerColor,
                              backgroundColor: 'rgba(15, 23, 42, 0.7)'
                            }}
                            className={cn(
                              "appearance-none text-[11px] font-bold py-1 pl-6 pr-2 rounded-lg border focus:outline-none transition-all cursor-pointer",
                              currentTask.status === 'للتسليم' ? "text-emerald-400 border-emerald-500/50" :
                              currentTask.status === 'جاري التنفيذ' ? "text-blue-400 border-blue-500/50" :
                              currentTask.status === 'تمت الصيانة' ? "text-teal-300 border-teal-500/50" :
                              "text-slate-200"
                            )}
                          >
                            {availableStatuses.map(st => (
                              <option key={st} value={st} className="bg-slate-900 text-white py-1">
                                {st}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Device Count & Model */}
                    {(settings.showDeviceCount || settings.showDeviceModel) && (
                      <div 
                        style={{ borderRightColor: settings.detailsDividerColor }} 
                        className="flex flex-col border-r pr-2.5 sm:pr-3 min-w-0 max-w-[170px] sm:max-w-[220px]"
                      >
                        <span style={{ color: settings.detailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                          <Smartphone className="w-2.5 h-2.5" style={{ color: settings.detailsIconColor }} /> الجهاز والموديل
                        </span>
                        <div className="flex items-center gap-1.5 truncate">
                          {settings.showDeviceCount && (
                            <span className={cn("font-extrabold rounded bg-white/10 text-amber-300 shrink-0 border border-white/10", sizeStyles.badgeText)}>
                              {deviceCount} {deviceCount > 1 ? 'أجهزة' : 'جهاز'}
                            </span>
                          )}
                          {settings.showDeviceModel && (
                            <span style={{ color: settings.detailsTextColor }} className={cn("truncate", sizeStyles.modelSize)}>
                              {deviceModel}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Financials: Cost / Deposit / Balance */}
                    {settings.showFinancials && (
                      <div 
                        style={{ borderRightColor: settings.detailsDividerColor }} 
                        className="flex flex-col shrink-0 border-r pr-2.5 sm:pr-3"
                      >
                        <span style={{ color: settings.detailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                          <Banknote className="w-2.5 h-2.5" style={{ color: settings.detailsIconColor }} /> التكلفة / الحساب / الباقي
                        </span>
                        <div className="flex items-center gap-1.5 font-black">
                          <span className={cn("text-blue-400 font-black", sizeStyles.finValSize)} title="التكلفة الإجمالية">
                            {totalCost}
                          </span>
                          <span style={{ color: settings.detailsLabelColor }} className="text-[10px]">/</span>
                          <span className={cn("text-emerald-400 font-black", sizeStyles.finValSize)} title="الواصل / المقدم">
                            {depositPaid}
                          </span>
                          <span style={{ color: settings.detailsLabelColor }} className="text-[10px]">/</span>
                          <span className={cn(remainingBalance > 0 ? "text-red-400 font-black" : "text-emerald-400 font-black", sizeStyles.finValSize)} title="المتبقي">
                            {remainingBalance}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Scheduled Time & Details-Inline Countdown */}
                    <div 
                      style={{ borderRightColor: settings.detailsDividerColor }} 
                      className="flex flex-col shrink-0 border-r pr-2.5 sm:pr-3"
                    >
                      <span style={{ color: settings.detailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                        <Clock className="w-2.5 h-2.5" style={{ color: settings.detailsIconColor }} /> موعد التنفيذ
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[11px] text-amber-300">
                          {formatExecTime(currentTask.executionTime)}
                        </span>
                        {/* Details-Inline Countdown Position (default) */}
                        {settings.countdownPosition === 'details-inline' && renderCountdownBadge()}
                      </div>
                    </div>
                  </div>

                  {/* Note and open buttons */}
                  {settings.showActions && (
                    <div className="shrink-0 flex items-center gap-1 mr-auto">
                      {hasNote ? (
                        <button 
                          type="button"
                          onClick={() => onViewNote && onViewNote(currentTask.id)}
                          style={{ backgroundColor: actionBg, borderColor: settings.detailsDividerColor }}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/15 rounded-xl transition-colors cursor-pointer text-xs font-bold border text-amber-400 active:scale-95"
                          title="معاينة الملاحظة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">ملاحظة</span>
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => onAddNote && onAddNote(currentTask.id)}
                          style={{ backgroundColor: actionBg, borderColor: settings.detailsDividerColor }}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/15 rounded-xl transition-colors cursor-pointer text-xs font-bold border text-slate-300 active:scale-95"
                          title="إضافة ملاحظة"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">ملاحظة</span>
                        </button>
                      )}

                      {onEditTask && (
                        <button
                          type="button"
                          onClick={() => onEditTask(currentTask)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all font-black text-xs cursor-pointer shadow-md active:scale-95 shrink-0"
                          title="فتح المهمة للتعديل أو المتابعة"
                        >
                          <span>فتح</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Bottom Actions Bar (أسفل الواجهة: تم التنفيذ + تمديد الوقت + عداد الوقت السفلي) */}
                {settings.showBottomBar && (
                  <div 
                    style={{ 
                      borderColor: settings.detailsDividerColor,
                      backgroundColor: 'rgba(0, 0, 0, 0.2)'
                    }}
                    className={cn("border-t flex flex-wrap items-center justify-between gap-2 mt-0.5", sizeStyles.bottomPad)}
                  >
                    <div className="flex items-center gap-2">
                      {/* زر تم التنفيذ (اعتماد الحالة للتسليم) */}
                      <button
                        type="button"
                        onClick={() => handleMarkReadyForDelivery(currentTask)}
                        className={cn(
                          "flex items-center gap-1.5 font-black transition-all cursor-pointer active:scale-95 shadow-sm border",
                          sizeStyles.buttonClass,
                          isReadyForDelivery
                            ? "bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-teal-500/20"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40"
                        )}
                        title="اعتماد الحالة للتسليم مباشرة"
                      >
                        {isReadyForDelivery ? (
                          <>
                            <CheckCheck className="w-4 h-4 text-teal-300 stroke-[2.5]" />
                            <span>تم الاعتماد (للتسليم)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white stroke-[2.5]" />
                            <span>تم التنفيذ (للتسليم)</span>
                          </>
                        )}
                      </button>

                      {/* زر تمديد الوقت */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsExtendMenuOpen(!isExtendMenuOpen)}
                          className={cn(
                            "flex items-center gap-1.5 font-bold transition-all cursor-pointer active:scale-95 border",
                            sizeStyles.buttonClass,
                            isExtendMenuOpen
                              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                              : "bg-slate-800/90 hover:bg-slate-750 text-amber-300 border-amber-500/40"
                          )}
                          title="تمديد وقت تنفيذ المهمة"
                        >
                          <ClockPlus className="w-4 h-4" />
                          <span>تمديد الوقت</span>
                          <ChevronDown className={cn("w-3 h-3 transition-transform", isExtendMenuOpen && "rotate-180")} />
                        </button>

                        {/* قائمة خيارات تمديد الوقت */}
                        <AnimatePresence>
                          {isExtendMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute bottom-full mb-1.5 right-0 z-40 w-64 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-right"
                            >
                              <div className="px-2.5 py-1 text-[10px] font-black text-amber-400 border-b border-slate-800 flex items-center justify-between">
                                <span>تمديد وقت التنفيذ:</span>
                                <Clock className="w-3 h-3" />
                              </div>

                              {/* 1. نصف ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTask, 
                                  addMinutes(currentTask.executionTime, 30),
                                  '+30 دقيقة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>نصف ساعة (+30د)</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTask.executionTime, 30)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 2. ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTask, 
                                  addMinutes(currentTask.executionTime, 60),
                                  '+1 ساعة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>ساعة كاملة (+1س)</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTask.executionTime, 60)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 3. 6 ساعات */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTask, 
                                  addMinutes(currentTask.executionTime, 360),
                                  '+6 ساعات'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>6 ساعات (+6س)</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTask.executionTime, 360)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 4. 24 ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTask, 
                                  addMinutes(currentTask.executionTime, 1440),
                                  '+24 ساعة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>24 ساعة (يوم كامل)</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  غداً {new Date(addMinutes(currentTask.executionTime, 1440)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              <div className="my-0.5 border-t border-slate-800" />

                              {/* 5. بعد المهمة التالية */}
                              {nextTaskExt && (
                                <button
                                  type="button"
                                  onClick={() => handleExtendExecutionTime(
                                    currentTask, 
                                    nextTaskExt.iso,
                                    nextTaskExt.info
                                  )}
                                  className="px-2.5 py-1.5 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/25 rounded-lg transition-all text-right flex flex-col cursor-pointer font-bold"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>بعد المهمة التالية (+30د)</span>
                                    <span className="text-[10px] font-mono">
                                      {new Date(nextTaskExt.iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    {nextTaskExt.info}
                                  </span>
                                </button>
                              )}

                              {/* 6. بعد آخر مهمة */}
                              {afterLastTaskExt && (
                                <button
                                  type="button"
                                  onClick={() => handleExtendExecutionTime(
                                    currentTask, 
                                    afterLastTaskExt.iso,
                                    'بعد آخر مهمة'
                                  )}
                                  className="px-2.5 py-1.5 text-xs text-teal-300 hover:text-teal-200 hover:bg-teal-500/20 rounded-lg transition-all text-right flex flex-col cursor-pointer font-bold"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>بعد آخر مهمة (+30د)</span>
                                    <span className="text-[10px] font-mono">
                                      {new Date(afterLastTaskExt.iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    نقل المهمة لتنتهي بعد آخر مهمة مجدولة
                                  </span>
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Bottom-Bar Countdown Position (if selected) */}
                      {settings.countdownPosition === 'bottom-bar' && (
                        <div className="mr-1">
                          {renderCountdownBadge()}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <span>الترتيب: المهمة</span>
                      <span className="font-bold text-white">{(tickerIndex % activeTasks.length) + 1}</span>
                      <span>من</span>
                      <span className="font-bold text-white">{activeTasks.length}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {renderSettingsModal()}
    </>
  );
};
