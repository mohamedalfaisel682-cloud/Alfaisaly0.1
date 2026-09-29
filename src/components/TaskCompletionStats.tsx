import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  UserCheck,
  Smartphone,
  Layers,
  Calendar,
  Filter,
  ArrowUpDown,
  Sparkles,
  Percent,
  Flame,
  Award,
  Search,
  Zap,
  X,
  PieChart as PieIcon,
  RefreshCw,
  FolderKanban
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { Task, Customer, InventoryItem, User, Currency, ExchangeRates } from '../types';
import { cn, formatAmount, getInUSD } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';

export type TaskCompletionDimension = 
  | 'technician'      // الفنيين / الموظفين
  | 'customer'        // العميل
  | 'model'           // الموديل
  | 'deviceType'      // نوع الجهاز
  | 'category'        // الصنف / العطل
  | 'timePeriod';     // الفترة الزمنية (يومي / أسبوعي / شهري)

export type TimeRangeFilter = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export type ChartTypeView = 'bar' | 'pie' | 'line';

interface TaskCompletionStatsProps {
  tasks: Task[];
  customers?: Customer[];
  inventory?: InventoryItem[];
  users?: User[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  onSelectTask?: (task: Task) => void;
  onFilterTasksByEntity?: (dimension: TaskCompletionDimension, entityValue: string) => void;
}

// ألوان احترافية متباينة لشاشات سامسونج نوت 20 ألترا AMOLED
const PALETTE_COLORS = [
  '#0284c7', // Sky Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#3b82f6', // Blue
  '#84cc16'  // Lime
];

export const TaskCompletionStats: React.FC<TaskCompletionStatsProps> = ({
  tasks,
  customers = [],
  inventory = [],
  users = [],
  systemCurrency,
  exchangeRates,
  onSelectTask,
  onFilterTasksByEntity
}) => {
  // الأبعاد والفلاتر
  const [dimension, setDimension] = useState<TaskCompletionDimension>('technician');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [chartType, setChartType] = useState<ChartTypeView>('bar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rate' | 'completed' | 'total' | 'revenue'>('rate');
  const [minTasksThreshold, setMinTasksThreshold] = useState<number>(1);
  const [selectedEntityForDetails, setSelectedEntityForDetails] = useState<string | null>(null);

  // حساب المهام المكتملة بناءً على الحالات الشائعة
  const isTaskCompleted = (t: Task) => {
    const s = (t.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'تمت الصيانة' || s === 'تم التسليم' || s === 'جاهزة' || s === 'ready-to-deliver' || s === 'منتهية';
  };

  const isTaskPending = (t: Task) => {
    const s = (t.status || '').toLowerCase().trim();
    return s === 'in-progress' || s === 'جاري التنفيذ' || s === 'معلقة' || s === 'pending' || s === 'للتسليم' || s === 'انتظار قطع';
  };

  // 1. فلترة المهام حسب الفترة الزمنية
  const filteredTasksByTime = useMemo(() => {
    const now = new Date();
    
    return tasks.filter(task => {
      if (!task.createdAt) return true;
      const taskDate = new Date(task.createdAt);
      if (isNaN(taskDate.getTime())) return true;

      if (timeRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return taskDate >= startOfDay;
      }
      if (timeRange === 'this_week') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        return taskDate >= startOfWeek;
      }
      if (timeRange === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return taskDate >= startOfMonth;
      }
      if (timeRange === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return taskDate >= startOfLastMonth && taskDate <= endOfLastMonth;
      }
      if (timeRange === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return taskDate >= startOfYear;
      }
      if (timeRange === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate + 'T00:00:00');
          if (taskDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate + 'T23:59:59');
          if (taskDate > end) return false;
        }
        return true;
      }
      return true; // 'all'
    });
  }, [tasks, timeRange, customStartDate, customEndDate]);

  // 2. تجميع وحساب معدل الإنجاز حسب البُعد المختار
  const aggregatedStats = useMemo(() => {
    const groups: Record<string, {
      key: string;
      label: string;
      subLabel?: string;
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
      totalRevenueUSD: number;
      totalDepositsUSD: number;
      tasksList: Task[];
    }> = {};

    // خريطة المستخدمين/الفنيين للربط
    const userNamesMap = new Map<string, string>();
    users.forEach(u => {
      if (u.username) userNamesMap.set(u.username.toLowerCase(), u.username);
    });

    filteredTasksByTime.forEach(task => {
      let key = '';
      let label = '';
      let subLabel = '';

      switch (dimension) {
        case 'technician': {
          // استخراج الفني من المهمة
          const tech = task.technician || task.assignedEmployee || (task as any).assignedTo || (task as any).addedBy || 'غير محدد';
          key = tech.trim() || 'غير محدد';
          label = key === 'غير محدد' ? 'فني غير محدد / عام' : key;
          subLabel = users.find(u => u.username === key)?.role === 'admin' ? 'مدير / فني' : 'طاقم الفنيين';
          break;
        }

        case 'customer': {
          key = (task.customer || 'عميل غير مسجل').trim();
          label = key;
          const matchedCust = customers.find(c => c.name === key);
          subLabel = matchedCust?.phone || matchedCust?.classification || 'عميل';
          break;
        }

        case 'deviceType': {
          let devType = task.deviceType || 'غير محدد';
          if (task.devices && task.devices.length > 0) {
            devType = task.devices.map(d => d.type).filter(Boolean).join(' + ') || devType;
          }
          key = devType.trim() || 'غير محدد';
          label = key;
          subLabel = 'نوع الجهاز';
          break;
        }

        case 'model': {
          let brandAndModel = task.brand || '';
          if (task.devices && task.devices.length > 0) {
            brandAndModel = task.devices.map(d => `${d.brand || ''}`.trim()).filter(Boolean).join(' + ') || brandAndModel;
          }
          key = (brandAndModel || 'غير محدد').trim();
          label = key;
          subLabel = task.deviceType || 'موديل / ماركة';
          break;
        }

        case 'category': {
          // الصنف أو تصنيف العطل
          const cat = task.category || (task as any).issueCategory || task.issue || 'صيانة عامة';
          // أخذ أول جزء من العطل للتلخيص إذا كان طويلاً
          const shortIssue = cat.split(/[-–—,،]/)[0].trim().slice(0, 30);
          key = shortIssue || 'صيانة عامة';
          label = key;
          subLabel = 'عطل / صنف الصيانة';
          break;
        }

        case 'timePeriod': {
          // تقسيم زمني حسب تاريخ الإدخال (يومي إذا كانت الفترة صغيرة، شهري إذا كانت واسعة)
          if (!task.createdAt) {
            key = 'تاريخ غير معروف';
            label = key;
          } else {
            const d = new Date(task.createdAt);
            if (timeRange === 'this_month' || timeRange === 'last_month' || timeRange === 'this_week' || timeRange === 'today') {
              // تنسيق يومي
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              key = `${yyyy}-${mm}-${dd}`;
              label = `${dd}/${mm}`;
              subLabel = d.toLocaleDateString('ar-SA', { weekday: 'short' });
            } else {
              // شهري
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              key = `${yyyy}-${mm}`;
              label = d.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
              subLabel = `${yyyy}`;
            }
          }
          break;
        }
      }

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          subLabel,
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          totalRevenueUSD: 0,
          totalDepositsUSD: 0,
          tasksList: []
        };
      }

      const grp = groups[key];
      grp.totalTasks += 1;
      grp.tasksList.push(task);

      if (isTaskCompleted(task)) {
        grp.completedTasks += 1;
      } else {
        grp.inProgressTasks += 1;
      }

      // الإيرادات والتكلفة
      const taskCurrency = task.currency || systemCurrency;
      const costUSD = getInUSD(task.cost || 0, taskCurrency, exchangeRates);
      const depositUSD = getInUSD(task.deposit || 0, taskCurrency, exchangeRates);
      grp.totalRevenueUSD += costUSD;
      grp.totalDepositsUSD += depositUSD;
    });

    // تحويل الكائن لمصفوفة وحساب نسبة الإنجاز المئوية
    let resultList = Object.values(groups).map(g => {
      const completionRate = g.totalTasks > 0 ? Math.round((g.completedTasks / g.totalTasks) * 100) : 0;
      return {
        ...g,
        completionRate,
        revenueFormatted: formatAmount(g.totalRevenueUSD, systemCurrency, exchangeRates),
        depositsFormatted: formatAmount(g.totalDepositsUSD, systemCurrency, exchangeRates)
      };
    });

    // فلترة بالحد الأدنى لعدد المهام والبحث
    if (minTasksThreshold > 1) {
      resultList = resultList.filter(item => item.totalTasks >= minTasksThreshold);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      resultList = resultList.filter(item => 
        item.label.toLowerCase().includes(q) || 
        (item.subLabel && item.subLabel.toLowerCase().includes(q))
      );
    }

    // الترتيب
    resultList.sort((a, b) => {
      if (sortBy === 'rate') return b.completionRate - a.completionRate || b.completedTasks - a.completedTasks;
      if (sortBy === 'completed') return b.completedTasks - a.completedTasks;
      if (sortBy === 'total') return b.totalTasks - a.totalTasks;
      if (sortBy === 'revenue') return b.totalRevenueUSD - a.totalRevenueUSD;
      return 0;
    });

    return resultList;
  }, [filteredTasksByTime, dimension, users, customers, systemCurrency, exchangeRates, minTasksThreshold, searchQuery, sortBy, timeRange]);

  // الإحصائيات العامة الإجمالية للوحة
  const summaryKPIs = useMemo(() => {
    const total = filteredTasksByTime.length;
    const completed = filteredTasksByTime.filter(isTaskCompleted).length;
    const pending = total - completed;
    const overallRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const totalRevenueUSD = filteredTasksByTime.reduce((acc, t) => {
      return acc + getInUSD(t.cost || 0, t.currency || systemCurrency, exchangeRates);
    }, 0);

    // أفضل فئة أو فني أداءً
    const topPerformer = aggregatedStats.length > 0 ? aggregatedStats[0] : null;

    return {
      total,
      completed,
      pending,
      overallRate,
      totalRevenueUSD,
      totalRevenueFormatted: formatAmount(totalRevenueUSD, systemCurrency, exchangeRates),
      topPerformer
    };
  }, [filteredTasksByTime, systemCurrency, exchangeRates, aggregatedStats]);

  // إعداد بيانات الرسم البياني (أعلى 10 عناصر لمنع الازدحام على شاشة النوت 20 ألترا)
  const chartData = useMemo(() => {
    const topItems = aggregatedStats.slice(0, 10);
    return topItems.map((item, idx) => ({
      name: item.label.length > 14 ? item.label.slice(0, 14) + '..' : item.label,
      fullName: item.label,
      نسبة_الإنجاز: item.completionRate,
      المهام_المكتملة: item.completedTasks,
      إجمالي_المهام: item.totalTasks,
      fill: PALETTE_COLORS[idx % PALETTE_COLORS.length]
    }));
  }, [aggregatedStats]);

  // حساب وقت تنفيذ المهمة بالساعات
  const calculateTaskExecutionHours = (task: Task): number => {
    if (task.createdAt) {
      const endStr = task.deliveredAt || task.updatedAt;
      if (endStr) {
        const start = new Date(task.createdAt).getTime();
        const end = new Date(endStr).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          const hours = (end - start) / (1000 * 60 * 60);
          if (hours > 0.05 && hours < 1000) return parseFloat(hours.toFixed(1));
        }
      }
    }
    if (task.executionTime) {
      if (task.executionTime.includes('ساعة')) {
        const match = task.executionTime.match(/(\d+(\.\d+)?)/);
        if (match) return parseFloat(match[1]);
      }
      if (task.executionTime.includes('يوم')) {
        const match = task.executionTime.match(/(\d+(\.\d+)?)/);
        if (match) return parseFloat(match[1]) * 24;
      }
      const target = new Date(task.executionTime).getTime();
      const created = task.createdAt ? new Date(task.createdAt).getTime() : Date.now() - 4 * 3600 * 1000;
      if (!isNaN(target) && !isNaN(created) && target >= created) {
        const h = (target - created) / (1000 * 60 * 60);
        if (h > 0) return parseFloat(h.toFixed(1));
      }
    }
    return 4; // تقدير افتراضي متوسط 4 ساعات
  };

  // تجميع وقارنة متوسط وقت التنفيذ لكل فني صيانة مقارنة بمتوسط الفريق
  const technicianExecutionStats = useMemo(() => {
    const techMap: Record<string, { totalHours: number; count: number }> = {};
    let teamTotalHours = 0;
    let teamTotalTasks = 0;

    filteredTasksByTime.forEach(task => {
      if (isTaskCompleted(task)) {
        const tech = (task.technician || task.assignedEmployee || (task as any).assignedTo || 'غير محدد').trim() || 'غير محدد';
        const hours = calculateTaskExecutionHours(task);
        if (!techMap[tech]) {
          techMap[tech] = { totalHours: 0, count: 0 };
        }
        techMap[tech].totalHours += hours;
        techMap[tech].count += 1;
        teamTotalHours += hours;
        teamTotalTasks += 1;
      }
    });

    const teamAvgHours = teamTotalTasks > 0 ? parseFloat((teamTotalHours / teamTotalTasks).toFixed(1)) : 0;

    const techList = Object.entries(techMap).map(([name, data]) => {
      const avgHours = data.count > 0 ? parseFloat((data.totalHours / data.count).toFixed(1)) : 0;
      const diffFromTeam = teamAvgHours > 0 ? parseFloat((avgHours - teamAvgHours).toFixed(1)) : 0;
      const isFaster = avgHours <= teamAvgHours;
      return {
        name: name.length > 14 ? name.slice(0, 14) + '..' : name,
        fullName: name,
        متوسط_وقت_التنفيذ: avgHours,
        متوسط_الفريق: teamAvgHours,
        taskCount: data.count,
        diffFromTeam,
        isFaster
      };
    }).sort((a, b) => a.متوسط_وقت_التنفيذ - b.متوسط_وقت_التنفيذ);

    return {
      techList,
      teamAvgHours,
      teamTotalTasks
    };
  }, [filteredTasksByTime]);

  // العنصر المحدد حالياً لعرض تفاصيل مهامه المنفذة
  const activeDetailGroup = useMemo(() => {
    if (!selectedEntityForDetails) return null;
    return aggregatedStats.find(g => g.key === selectedEntityForDetails) || null;
  }, [selectedEntityForDetails, aggregatedStats]);

  const dimensionLabels: Record<TaskCompletionDimension, { title: string; desc: string; icon: any }> = {
    technician: { title: 'الفنيين والموظفين', desc: 'معدل إنجاز وسرعة صيانة كل فني أو موظف', icon: UserCheck },
    customer: { title: 'العملاء', desc: 'معدل إنجاز وتسليم أجهزة كل عميل', icon: Users },
    deviceType: { title: 'نوع الجهاز', desc: 'معدل إنجاز المهام حسب نوع الجهاز (راوتر، هاتف، مودم...) ', icon: Smartphone },
    model: { title: 'الموديل والماركة', desc: 'نسبة النجاح والإنجاز لكل موديل وماركة', icon: Layers },
    category: { title: 'الأعطال والأصناف', desc: 'معدل إنهاء المهام حسب نوع العطل أو الصنف', icon: FolderKanban },
    timePeriod: { title: 'الفترات الزمنية', desc: 'تطور وتغير معدل الإنجاز عبر الأيام أو الشهور', icon: Calendar }
  };

  const CurrentDimensionIcon = dimensionLabels[dimension].icon;

  return (
    <div id="task-completion-statistics-root" className="space-y-4 text-right dir-rtl animate-in fade-in duration-300">
      
      {/* 1. رأس الصفحة والتحكم العلوي */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 shrink-0">
              <CurrentDimensionIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  معدل إنجاز المهام حسب {dimensionLabels[dimension].title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  لوحة تفاعلية
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {dimensionLabels[dimension].desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ExportToolbar 
              targetElementId="task-completion-statistics-root" 
              title={`معدل_إنجاز_المهام_حسب_${dimensionLabels[dimension].title}`}
              compact={true}
              size="sm"
            />
          </div>
        </div>

        {/* 2. شريط اختيار البعد (الأزرار الرئيسية) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3.5">
          {(Object.keys(dimensionLabels) as TaskCompletionDimension[]).map((dimKey) => {
            const dimInfo = dimensionLabels[dimKey];
            const DimIcon = dimInfo.icon;
            const isActive = dimension === dimKey;
            return (
              <button
                key={dimKey}
                onClick={() => {
                  setDimension(dimKey);
                  setSelectedEntityForDetails(null);
                }}
                className={cn(
                  "p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95",
                  isActive 
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 font-black" 
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 font-bold hover:border-slate-300"
                )}
              >
                <DimIcon className={cn("w-4 h-4 sm:w-5 sm:h-5", isActive ? "text-white" : "text-slate-500")} />
                <span className="text-[11px] sm:text-xs tracking-tight truncate w-full">
                  {dimInfo.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. شريط الفلاتر والوقت */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3.5 pt-3.5 border-t border-slate-100">
          {/* فلتر الفترة */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-black text-slate-500 block">الفترة الزمنية</label>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRangeFilter)}
                className="w-full h-9.5 pr-8 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="today">اليوم الحالي</option>
                <option value="this_week">هذا الأسبوع</option>
                <option value="this_month">هذا الشهر (الحالي)</option>
                <option value="last_month">الشهر الماضي</option>
                <option value="this_year">هذا العام</option>
                <option value="all">كل الفترات (شامل)</option>
                <option value="custom">فترة مخصصة (تواريخ)</option>
              </select>
              <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* الترتيب */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-black text-slate-500 block">ترتيب النتائج حسب</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full h-9.5 pr-8 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="rate">أعلى نسبة إنجاز (%)</option>
                <option value="completed">أكبر عدد مهام مكتملة</option>
                <option value="total">إجمالي حجم المهام المستلمة</option>
                <option value="revenue">الأعلى تحقيقاً للإيرادات</option>
              </select>
              <ArrowUpDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* البحث السريع */}
          <div className="space-y-1">
            <label className="text-[10.5px] font-black text-slate-500 block">بحث وتصفية</label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="ابحث بالاسم أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9.5 pr-8 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-0 top-0 bottom-0 h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold rounded-l-xl"
                  title="مسح النص وإلغاء المدخلات بنقرة واحدة"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* إذا كانت الفترة مخصصة، إظهار حقول التاريخ */}
        {timeRange === 'custom' && (
          <div className="grid grid-cols-2 gap-2.5 mt-2.5 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 animate-in fade-in">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-emerald-800">من تاريخ</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full h-8.5 px-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-emerald-800">إلى تاريخ</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full h-8.5 px-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. بطاقات المؤشرات الرقمية السريعة (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase block">إجمالي المهام</span>
            <span className="text-base sm:text-lg font-black text-slate-900 truncate block">
              {summaryKPIs.total} <span className="text-[10px] font-normal text-slate-500">مهمة</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center gap-3 bg-emerald-50/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-emerald-600 uppercase block">المهام المكتملة</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 truncate block">
              {summaryKPIs.completed} <span className="text-[10px] font-normal text-emerald-600">مهمة</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3 bg-amber-50/20">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-amber-600 uppercase block">قيد التنفيذ / معلقة</span>
            <span className="text-base sm:text-lg font-black text-amber-700 truncate block">
              {summaryKPIs.pending} <span className="text-[10px] font-normal text-amber-600">مهمة</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-sky-200/80 shadow-xs flex items-center gap-3 bg-sky-50/20">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-sky-600 uppercase block">المعدل العام للإنجاز</span>
            <span className="text-base sm:text-lg font-black text-sky-700 truncate block">
              {summaryKPIs.overallRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 5. قسم الرسم البياني التفاعلي التوضيحي */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h4 className="font-black text-sm sm:text-base text-slate-800">
              الرسم البياني لمعدل الإنجاز التفاعلي ({dimensionLabels[dimension].title})
            </h4>
          </div>

          {/* تبديل شكل الرسم البياني */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                chartType === 'bar' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>أعمدة</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                chartType === 'pie' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>دائري</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                chartType === 'line' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>خطّي</span>
            </button>
          </div>
        </div>

        {/* عرض الرسم البياني */}
        {chartData.length > 0 ? (
          <div className="h-72 sm:h-80 w-full pt-2 select-none" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 15, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(val: any, name: string) => [
                      name === 'نسبة_الإنجاز' ? `${val}%` : `${val} مهمة`, 
                      name.replace(/_/g, ' ')
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) return payload[0].payload.fullName;
                      return label;
                    }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #e2e8f0', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      direction: 'rtl',
                      textAlign: 'right',
                      fontFamily: 'inherit'
                    }} 
                  />
                  <Bar 
                    dataKey="نسبة_الإنجاز" 
                    radius={[8, 8, 0, 0]}
                    maxBarSize={45}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'pie' ? (
                <PieChart>
                  <Tooltip 
                    formatter={(val: any, name: string) => [`${val} مهمة مكتملة`, name]}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #e2e8f0',
                      direction: 'rtl',
                      textAlign: 'right',
                      fontFamily: 'inherit'
                    }} 
                  />
                  <Pie
                    data={chartData}
                    dataKey="المهام_المكتملة"
                    nameKey="fullName"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-pie-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip 
                    formatter={(val: any) => [`${val}%`, 'معدل الإنجاز']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #e2e8f0',
                      direction: 'rtl',
                      textAlign: 'right',
                      fontFamily: 'inherit'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="نسبة_الإنجاز" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 5, fill: '#10b981' }} 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 font-bold text-xs">
            لا توجد بيانات كافية لعرض الرسم البياني في هذه الفترة.
          </div>
        )}
      </div>

      {/* قسم رسم بياني: متوسط وقت التنفيذ لكل فني صيانة مقارنة بمتوسط الفريق */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base text-slate-800">
                متوسط وقت التنفيذ لكل فني صيانة مقارنة بمتوسط الفريق ⏱️
              </h4>
              <p className="text-xs text-slate-500 font-bold">
                تقييم الأداء والسرعة في إنجاز مهام الصيانة بالساعات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500">متوسط الفريق العام:</span>
            <span className="text-sm font-black text-blue-700 font-mono">
              {technicianExecutionStats.teamAvgHours} ساعة
            </span>
          </div>
        </div>

        {technicianExecutionStats.techList.length > 0 ? (
          <div className="space-y-4">
            <div className="h-64 sm:h-72 w-full pt-2 select-none" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={technicianExecutionStats.techList} margin={{ top: 15, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    unit="س"
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(val: any, name: string) => [
                      `${val} ساعة`, 
                      name.replace(/_/g, ' ')
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) return payload[0].payload.fullName;
                      return label;
                    }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #e2e8f0', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      direction: 'rtl',
                      textAlign: 'right',
                      fontFamily: 'inherit'
                    }} 
                  />
                  <Legend 
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                    formatter={(value) => value.replace(/_/g, ' ')}
                  />
                  <Bar 
                    dataKey="متوسط_وقت_التنفيذ" 
                    name="متوسط وقت الفني (ساعة)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={40}
                    fill="#0284c7"
                  >
                    {technicianExecutionStats.techList.map((entry, index) => (
                      <Cell key={`cell-tech-${index}`} fill={entry.isFaster ? '#10b981' : '#f59e0b'} />
                    ))}
                  </Bar>
                  <Bar 
                    dataKey="متوسط_الفريق" 
                    name="متوسط الفريق (ساعة)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={40}
                    fill="#64748b"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* بطاقات مقارنة سريعة لكل فني */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {technicianExecutionStats.techList.map((tech) => (
                <div 
                  key={tech.fullName}
                  className={cn(
                    "p-3 rounded-2xl border flex items-center justify-between gap-2 shadow-3xs",
                    tech.isFaster ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200"
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-slate-900 truncate">{tech.fullName}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-black shrink-0",
                        tech.isFaster ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      )}>
                        {tech.isFaster ? 'أسرع من الفريق⚡' : 'أبطأ من الفريق ⏱️'}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-slate-500 font-bold block">
                      نفذ {tech.taskCount} مهمة مكتملة | متوسط: <strong className="text-slate-800">{tech.متوسط_وقت_التنفيذ} ساعة</strong>
                    </span>
                  </div>

                  <div className="text-left shrink-0">
                    <span className={cn(
                      "text-xs font-black block font-mono",
                      tech.isFaster ? "text-emerald-700" : "text-amber-700"
                    )}>
                      {tech.diffFromTeam <= 0 ? `${Math.abs(tech.diffFromTeam)} س أسرع` : `+${tech.diffFromTeam} س`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            لا توجد مهام صيانة مكتملة مسندة لفنيين في هذه الفترة لحساب متوسط وقت التنفيذ.
          </div>
        )}
      </div>

      {/* 6. جدول تفاصيل الأداء ومعدل الإنجاز لكل عنصر */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h4 className="font-black text-sm sm:text-base text-slate-800">
              قائمة تفصيل الأداء وترتيب الإنجاز ({aggregatedStats.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">
              انقر على أي صف لمعاينة مهامه بالتفصيل
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right divide-y divide-slate-100 text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-black">
              <tr>
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">{dimensionLabels[dimension].title}</th>
                <th className="px-3 py-3 text-center">المكتملة</th>
                <th className="px-3 py-3 text-center">المتبقية</th>
                <th className="px-3 py-3 text-center">الإجمالي</th>
                <th className="px-4 py-3 text-center w-40">معدل الإنجاز</th>
                <th className="px-4 py-3 text-left">إجمالي القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {aggregatedStats.map((item, idx) => {
                const isSelected = selectedEntityForDetails === item.key;
                const isHighPerformer = item.completionRate >= 80;
                const isMediumPerformer = item.completionRate >= 50 && item.completionRate < 80;

                return (
                  <tr 
                    key={item.key}
                    onClick={() => setSelectedEntityForDetails(isSelected ? null : item.key)}
                    className={cn(
                      "hover:bg-emerald-50/40 transition-colors cursor-pointer select-none",
                      isSelected && "bg-emerald-50/70 ring-1 ring-emerald-300"
                    )}
                  >
                    <td className="px-4 py-3 text-center font-black text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900">{item.label}</span>
                        {item.subLabel && (
                          <span className="text-[10px] text-slate-400 font-bold">{item.subLabel}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-black text-emerald-600">
                      {item.completedTasks}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-amber-600">
                      {item.inProgressTasks}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-slate-700">
                      {item.totalTasks}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isHighPerformer ? "bg-emerald-500" :
                              isMediumPerformer ? "bg-sky-500" : "bg-amber-500"
                            )}
                            style={{ width: `${item.completionRate}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-xs font-black min-w-[34px] text-left",
                          isHighPerformer ? "text-emerald-700" :
                          isMediumPerformer ? "text-sky-700" : "text-amber-700"
                        )}>
                          {item.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left font-black text-slate-800">
                      {item.revenueFormatted} {systemCurrency}
                    </td>
                  </tr>
                );
              })}

              {aggregatedStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold">
                    لا توجد مهام مطابقة للخيارات المحددة في هذا البعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. لوحة تفصيلية فرعية تنبثق عند النقر على أي فني / عميل / موديل */}
      {activeDetailGroup && (
        <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-black">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-black text-sm sm:text-base text-white">
                  مهام وتفاصيل: {activeDetailGroup.label}
                </h5>
                <span className="text-xs text-emerald-400 font-bold">
                  إنجاز {activeDetailGroup.completionRate}% ({activeDetailGroup.completedTasks} من {activeDetailGroup.totalTasks} مكتملة)
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedEntityForDetails(null)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق التفاصيل ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pt-1">
            {activeDetailGroup.tasksList.map((t) => {
              const completed = isTaskCompleted(t);
              return (
                <div 
                  key={t.id}
                  onClick={() => onSelectTask && onSelectTask(t)}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700/80 flex flex-col justify-between gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">مهمة #{t.id}</span>
                      <h6 className="font-black text-xs text-white line-clamp-1">{t.customer}</h6>
                      <p className="text-[11px] text-slate-300 font-bold mt-0.5 line-clamp-1">
                        {t.deviceType} {t.brand ? `- ${t.brand}` : ''}
                      </p>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black shrink-0",
                      completed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    )}>
                      {t.status || 'غير محدد'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-700/60 font-bold">
                    <span>العطل: {t.issue?.slice(0, 20) || 'صيانة'}</span>
                    <span className="text-emerald-400 font-black">
                      {t.cost || 0} {t.currency || systemCurrency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
