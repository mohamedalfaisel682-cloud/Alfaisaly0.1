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
  Maximize2,
  ListOrdered,
  LayoutGrid,
  AlertTriangle,
  BookmarkCheck,
  PhoneCall
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/db';
import { hapticMedium } from '../utils/haptics';
import { ColorPickerField } from './ColorPickerField';

export type CountdownPosition = 'details-inline' | 'top-header' | 'bottom-bar' | 'badge-corner';
export type TickerSize = 'ultra_compact' | 'compact' | 'medium' | 'large';
export type FlashTaskRange = '1day' | '2days' | '3days' | '4days' | '1week' | '1month';
export type FlashViewLayout = 'carousel' | 'priority_rows' | 'structured_rows';

export const FLASH_TASK_RANGE_CONFIG: Record<FlashTaskRange, {
  label: string;
  shortLabel: string;
  headerTitle: string;
  hours: number;
  description: string;
}> = {
  '1day': {
    label: 'اليوم',
    shortLabel: 'اليوم (24 ساعة)',
    headerTitle: 'يوم',
    hours: 24,
    description: 'عرض المهام المجدولة لليوم خلال 24 ساعة'
  },
  '2days': {
    label: 'اليومين',
    shortLabel: 'اليومين (48 ساعة)',
    headerTitle: 'يومين',
    hours: 48,
    description: 'عرض المهام المجدولة لليومين (الافتراضي)'
  },
  '3days': {
    label: '3 أيام',
    shortLabel: '3 أيام (72 ساعة)',
    headerTitle: '3 يوم',
    hours: 72,
    description: 'عرض المهام المجدولة لـ 3 أيام'
  },
  '4days': {
    label: '4 أيام',
    shortLabel: '4 أيام (96 ساعة)',
    headerTitle: '4 يوم',
    hours: 96,
    description: 'عرض المهام المجدولة لـ 4 أيام'
  },
  '1week': {
    label: 'الأسبوع',
    shortLabel: 'الأسبوع (7 أيام)',
    headerTitle: 'أسبوع',
    hours: 24 * 7,
    description: 'عرض المهام المجدولة للأسبوع بالكامل'
  },
  '1month': {
    label: 'الشهر',
    shortLabel: 'الشهر (30 يوماً)',
    headerTitle: 'شهر',
    hours: 24 * 30,
    description: 'عرض المهام المجدولة للشهر بالكامل'
  }
};

export interface FlashTickerSettings {
  displayDuration: number; // in seconds
  autoRotate: boolean;
  tickerSize: TickerSize;
  taskRange: FlashTaskRange;
  viewLayout?: FlashViewLayout; // 'carousel', 'priority_rows', 'structured_rows'

  // Countdown placement & colors & custom prefixes
  countdownPosition: CountdownPosition;
  countdownTextColor: string;
  countdownBgColor: string;
  countdownBorderColor: string;
  overdueTextColor: string;
  overdueBgColor: string;
  overdueBorderColor: string;
  overduePrefixText?: string;
  pendingPrefixText?: string;

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

  // Dynamic visual footprint (مطابقة البصمة البصرية مع بطاقة المهمة وتغيرها مع تغير الحالة)
  matchTaskCardColor?: boolean;
}

const DEFAULT_SETTINGS: FlashTickerSettings = {
  displayDuration: 3.5,
  autoRotate: true,
  tickerSize: 'medium',
  taskRange: '2days',
  viewLayout: 'carousel',

  // Countdown
  countdownPosition: 'details-inline',
  countdownTextColor: '#facc15',
  countdownBgColor: 'rgba(161, 98, 7, 0.28)',
  countdownBorderColor: '#ca8a04',
  overdueTextColor: '#f87171',
  overdueBgColor: 'rgba(225, 29, 72, 0.25)',
  overdueBorderColor: '#e11d48',
  overduePrefixText: 'متأخر:',
  pendingPrefixText: 'متبقي:',

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
  detailsIconColor: '#facc15',

  // مطابقة لون واجهة المهمة في الواجهة الفلاشية بلون بطاقة المهمة وحالتها ديناميكياً
  matchTaskCardColor: true
};

export interface TaskVisualFingerprint {
  statusKey: string;
  containerBg: string;
  detailsBg: string;
  borderColor: string;
  accentColor: string;
  glowColor: string;
  headerBg: string;
  headerTextBg: string;
  headerBorderColor: string;
  headerTextColor: string;
  headerIconColor: string;
  statusBadgeBg: string;
  statusTextColor: string;
  statusBorderColor: string;
  detailsTextColor: string;
  detailsLabelColor: string;
  dividerColor: string;
  iconColor: string;
  countdownBgColor: string;
  countdownBorderColor: string;
  countdownTextColor: string;
}

export const getFlashStatusKey = (label: string): string => {
  if (!label) return 'pending';
  const trimmed = label.trim();
  const map: Record<string, string> = {
    'معلقة': 'pending',
    'Pending': 'pending',
    'pending': 'pending',

    'تم الفحص والابلاغ': 'inspected',
    'تم الفحص وجاري الإبلاغ': 'inspected',
    'Inspected': 'inspected',
    'inspected': 'inspected',

    'جاري التنفيذ': 'in-progress',
    'قيد التنفيذ': 'in-progress',
    'In Progress': 'in-progress',
    'in-progress': 'in-progress',
    'تم الإبلاغ وجاري التنفيذ': 'in-progress',
    'reported-in-progress': 'in-progress',

    'ملغية': 'cancelled',
    'تم الالغاء': 'cancelled',
    'تم إلغاء الصيانة': 'cancelled',
    'ملغية ومسلمة': 'cancelled',
    'Cancelled': 'cancelled',
    'cancelled': 'cancelled',
    'reported-cancelled': 'cancelled',
    'cancelled-delivered': 'cancelled',

    'تمت الصيانة': 'maintenance-done',
    'maintenance-done': 'maintenance-done',
    'Maintenance Done': 'maintenance-done',

    'للتسليم': 'ready-to-deliver',
    'جاهز للتسليم': 'ready-to-deliver',
    'Ready To Deliver': 'ready-to-deliver',
    'ready-to-deliver': 'ready-to-deliver',

    'تم التسليم': 'completed',
    'Completed': 'completed',
    'completed': 'completed',

    'مؤرشفة': 'archived',
    'archived': 'archived'
  };
  return map[trimmed] || trimmed;
};

export const getTaskVisualFingerprint = (task: any, uiSettings?: any): TaskVisualFingerprint => {
  if (!task) {
    return {
      statusKey: 'pending',
      containerBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
      detailsBg: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(248, 113, 113, 0.80)',
      accentColor: '#ef4444',
      glowColor: 'rgba(239, 68, 68, 0.35)',
      headerBg: 'rgba(185, 28, 28, 0.25)',
      headerTextBg: 'rgba(220, 38, 38, 0.35)',
      headerBorderColor: 'rgba(239, 68, 68, 0.45)',
      headerTextColor: '#fca5a5',
      headerIconColor: '#f87171',
      statusBadgeBg: 'rgba(239, 68, 68, 0.20)',
      statusTextColor: '#fca5a5',
      statusBorderColor: 'rgba(239, 68, 68, 0.6)',
      detailsTextColor: '#ffffff',
      detailsLabelColor: '#fca5a5',
      dividerColor: 'rgba(239, 68, 68, 0.30)',
      iconColor: '#f87171',
      countdownBgColor: 'rgba(185, 28, 28, 0.30)',
      countdownBorderColor: '#ef4444',
      countdownTextColor: '#fca5a5'
    };
  }

  const rawStatus = task.status || '';
  const key = getFlashStatusKey(rawStatus);

  // Check if custom styles exist in uiSettings
  const customBorder = uiSettings?.statusStyles?.[rawStatus]?.border;

  // Balance check for ready-to-deliver or completed
  const cost = parseFloat(task.cost || 0) + (Array.isArray(task.addedCosts) ? task.addedCosts.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0) : 0);
  const paid = parseFloat(task.deposit || 0) + (Array.isArray(task.payments) ? task.payments.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0) : 0);
  const balance = cost - paid;
  const hasUnpaidDebt = (key === 'completed' || key === 'ready-to-deliver') && balance > 0;

  switch (key) {
    case 'inspected':
      return {
        statusKey: 'inspected',
        containerBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(245, 158, 11, 0.08)',
        borderColor: customBorder || 'rgba(251, 191, 36, 0.80)',
        accentColor: '#f59e0b',
        glowColor: 'rgba(245, 158, 11, 0.35)',
        headerBg: 'rgba(180, 83, 9, 0.25)',
        headerTextBg: 'rgba(217, 119, 6, 0.35)',
        headerBorderColor: 'rgba(245, 158, 11, 0.45)',
        headerTextColor: '#fde68a',
        headerIconColor: '#fbbf24',
        statusBadgeBg: 'rgba(245, 158, 11, 0.20)',
        statusTextColor: '#fde68a',
        statusBorderColor: 'rgba(245, 158, 11, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#fde68a',
        dividerColor: 'rgba(245, 158, 11, 0.30)',
        iconColor: '#fbbf24',
        countdownBgColor: 'rgba(180, 83, 9, 0.30)',
        countdownBorderColor: '#f59e0b',
        countdownTextColor: '#fde68a'
      };

    case 'in-progress':
      return {
        statusKey: 'in-progress',
        containerBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(99, 102, 241, 0.08)',
        borderColor: customBorder || 'rgba(165, 180, 252, 0.80)',
        accentColor: '#6366f1',
        glowColor: 'rgba(99, 102, 241, 0.35)',
        headerBg: 'rgba(67, 56, 202, 0.25)',
        headerTextBg: 'rgba(79, 70, 229, 0.35)',
        headerBorderColor: 'rgba(99, 102, 241, 0.45)',
        headerTextColor: '#c7d2fe',
        headerIconColor: '#818cf8',
        statusBadgeBg: 'rgba(99, 102, 241, 0.20)',
        statusTextColor: '#c7d2fe',
        statusBorderColor: 'rgba(99, 102, 241, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#c7d2fe',
        dividerColor: 'rgba(99, 102, 241, 0.30)',
        iconColor: '#818cf8',
        countdownBgColor: 'rgba(67, 56, 202, 0.30)',
        countdownBorderColor: '#6366f1',
        countdownTextColor: '#c7d2fe'
      };

    case 'maintenance-done':
      return {
        statusKey: 'maintenance-done',
        containerBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(16, 185, 129, 0.08)',
        borderColor: customBorder || (hasUnpaidDebt ? 'rgba(239, 68, 68, 0.85)' : 'rgba(110, 231, 183, 0.80)'),
        accentColor: '#10b981',
        glowColor: 'rgba(16, 185, 129, 0.35)',
        headerBg: 'rgba(6, 95, 70, 0.25)',
        headerTextBg: 'rgba(5, 150, 105, 0.35)',
        headerBorderColor: 'rgba(16, 185, 129, 0.45)',
        headerTextColor: '#a7f3d0',
        headerIconColor: '#34d399',
        statusBadgeBg: 'rgba(16, 185, 129, 0.20)',
        statusTextColor: '#a7f3d0',
        statusBorderColor: 'rgba(16, 185, 129, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#a7f3d0',
        dividerColor: 'rgba(16, 185, 129, 0.30)',
        iconColor: '#34d399',
        countdownBgColor: 'rgba(6, 95, 70, 0.30)',
        countdownBorderColor: '#10b981',
        countdownTextColor: '#a7f3d0'
      };

    case 'ready-to-deliver':
      return {
        statusKey: 'ready-to-deliver',
        containerBg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(20, 184, 166, 0.08)',
        borderColor: customBorder || (hasUnpaidDebt ? 'rgba(239, 68, 68, 0.85)' : 'rgba(94, 234, 212, 0.80)'),
        accentColor: '#14b8a6',
        glowColor: 'rgba(20, 184, 166, 0.35)',
        headerBg: 'rgba(17, 94, 89, 0.25)',
        headerTextBg: 'rgba(13, 148, 136, 0.35)',
        headerBorderColor: 'rgba(20, 184, 166, 0.45)',
        headerTextColor: '#99f6e4',
        headerIconColor: '#2dd4bf',
        statusBadgeBg: 'rgba(20, 184, 166, 0.20)',
        statusTextColor: '#99f6e4',
        statusBorderColor: 'rgba(20, 184, 166, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#99f6e4',
        dividerColor: 'rgba(20, 184, 166, 0.30)',
        iconColor: '#2dd4bf',
        countdownBgColor: 'rgba(17, 94, 89, 0.30)',
        countdownBorderColor: '#14b8a6',
        countdownTextColor: '#99f6e4'
      };

    case 'completed':
      return {
        statusKey: 'completed',
        containerBg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(34, 197, 94, 0.08)',
        borderColor: customBorder || (hasUnpaidDebt ? 'rgba(239, 68, 68, 0.85)' : 'rgba(134, 239, 172, 0.80)'),
        accentColor: '#22c55e',
        glowColor: 'rgba(34, 197, 94, 0.35)',
        headerBg: 'rgba(22, 101, 52, 0.25)',
        headerTextBg: 'rgba(22, 163, 74, 0.35)',
        headerBorderColor: 'rgba(34, 197, 94, 0.45)',
        headerTextColor: '#bbf7d0',
        headerIconColor: '#4ade80',
        statusBadgeBg: 'rgba(34, 197, 94, 0.20)',
        statusTextColor: '#bbf7d0',
        statusBorderColor: 'rgba(34, 197, 94, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#bbf7d0',
        dividerColor: 'rgba(34, 197, 94, 0.30)',
        iconColor: '#4ade80',
        countdownBgColor: 'rgba(22, 101, 52, 0.30)',
        countdownBorderColor: '#22c55e',
        countdownTextColor: '#bbf7d0'
      };

    case 'cancelled':
    case 'archived':
      return {
        statusKey: key,
        containerBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(244, 63, 94, 0.08)',
        borderColor: customBorder || 'rgba(253, 164, 175, 0.80)',
        accentColor: '#f43f5e',
        glowColor: 'rgba(244, 63, 94, 0.35)',
        headerBg: 'rgba(159, 18, 57, 0.25)',
        headerTextBg: 'rgba(225, 29, 72, 0.35)',
        headerBorderColor: 'rgba(244, 63, 94, 0.45)',
        headerTextColor: '#fecdd3',
        headerIconColor: '#fb7185',
        statusBadgeBg: 'rgba(244, 63, 94, 0.20)',
        statusTextColor: '#fecdd3',
        statusBorderColor: 'rgba(244, 63, 94, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#fecdd3',
        dividerColor: 'rgba(244, 63, 94, 0.30)',
        iconColor: '#fb7185',
        countdownBgColor: 'rgba(159, 18, 57, 0.30)',
        countdownBorderColor: '#f43f5e',
        countdownTextColor: '#fecdd3'
      };

    case 'pending':
    default:
      return {
        statusKey: 'pending',
        containerBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(15, 23, 42, 0.94) 100%)',
        detailsBg: 'rgba(239, 68, 68, 0.08)',
        borderColor: customBorder || 'rgba(248, 113, 113, 0.80)',
        accentColor: '#ef4444',
        glowColor: 'rgba(239, 68, 68, 0.35)',
        headerBg: 'rgba(185, 28, 28, 0.25)',
        headerTextBg: 'rgba(220, 38, 38, 0.35)',
        headerBorderColor: 'rgba(239, 68, 68, 0.45)',
        headerTextColor: '#fca5a5',
        headerIconColor: '#f87171',
        statusBadgeBg: 'rgba(239, 68, 68, 0.20)',
        statusTextColor: '#fca5a5',
        statusBorderColor: 'rgba(239, 68, 68, 0.6)',
        detailsTextColor: '#ffffff',
        detailsLabelColor: '#fca5a5',
        dividerColor: 'rgba(239, 68, 68, 0.30)',
        iconColor: '#f87171',
        countdownBgColor: 'rgba(185, 28, 28, 0.30)',
        countdownBorderColor: '#ef4444',
        countdownTextColor: '#fca5a5'
      };
  }
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
  const [extendMenuTaskId, setExtendMenuTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, string>>({});

  // Touch swipe gesture handlers for Note 20 Ultra / touch screens
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null || activeTasks.length <= 1) return;
    const diffX = touchStartX - touchEndX;
    const minSwipeDistance = 35; // px required for swipe
    if (diffX > minSwipeDistance) {
      // Swiped Left -> Move to Next Task
      hapticMedium();
      setTickerIndex(prev => (prev + 1) % activeTasks.length);
      showToast('المهمة التالية ◄');
    } else if (diffX < -minSwipeDistance) {
      // Swiped Right -> Move to Previous Task
      hapticMedium();
      setTickerIndex(prev => (prev - 1 + activeTasks.length) % activeTasks.length);
      showToast('► المهمة السابقة');
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Live second-by-second ticker for the countdown timer
  const [nowTime, setNowTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice Assistant event listeners for controlling Flash Ticker
  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    const handleCloseSettings = () => setIsSettingsOpen(false);
    const handleUpdateRange = (e: any) => {
      if (e.detail?.taskRange) {
        updateSettings({ taskRange: e.detail.taskRange });
        showToast(`تم ضبط نطاق مهام الواجهة الفلاشية إلى: ${FLASH_TASK_RANGE_CONFIG[e.detail.taskRange as FlashTaskRange]?.label || e.detail.taskRange}`);
      }
    };
    window.addEventListener('open-flash-ticker-settings', handleOpenSettings);
    window.addEventListener('close-flash-ticker-settings', handleCloseSettings);
    window.addEventListener('set-flash-task-range', handleUpdateRange);
    return () => {
      window.removeEventListener('open-flash-ticker-settings', handleOpenSettings);
      window.removeEventListener('close-flash-ticker-settings', handleCloseSettings);
      window.removeEventListener('set-flash-task-range', handleUpdateRange);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleCustomerCallDirect = (e: React.MouseEvent, taskObj: any) => {
    e.stopPropagation();
    const phones = taskObj.customerPhones || (taskObj.customerPhone ? [taskObj.customerPhone] : []);
    if (phones && phones.length > 0) {
      const cleanNum = String(phones[0]).replace(/[^\d+]/g, '');
      window.location.href = `tel:${cleanNum}`;
    } else if (onEditTask) {
      onEditTask(taskObj);
    }
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

  // Filter tasks scheduled within the chosen time range and sort by execution time ascending (closest first)
  const activeTasks = useMemo(() => {
    const range = settings.taskRange || '2days';
    const rangeHours = FLASH_TASK_RANGE_CONFIG[range]?.hours || 48;
    const now = new Date();
    const endOfRange = new Date(now.getTime() + rangeHours * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return tasks.filter((t: any) => {
      if (!t.executionTime) return false;
      const d = new Date(t.executionTime).getTime();
      if (isNaN(d)) return false;
      const isTerminalStatus = ['completed', 'cancelled-delivered', 'archived', 'ملغية', 'إلغاء المهمة', 'maintenance-done', 'reported-cancelled'].includes(t.status);
      if (isTerminalStatus) return false;
      return d >= (startOfToday - 12 * 60 * 60 * 1000) && d <= endOfRange.getTime();
    }).sort((a: any, b: any) => new Date(a.executionTime).getTime() - new Date(b.executionTime).getTime());
  }, [tasks, settings.taskRange]);

  const currentRangeConfig = useMemo(() => {
    return FLASH_TASK_RANGE_CONFIG[settings.taskRange || '2days'] || FLASH_TASK_RANGE_CONFIG['2days'];
  }, [settings.taskRange]);

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
  const currentTaskEffective = useMemo(() => {
    if (!currentTask) return null;
    const effStatus = optimisticStatuses[currentTask.id] || currentTask.status;
    return { ...currentTask, status: effStatus };
  }, [currentTask, optimisticStatuses]);

  const hasNote = currentTaskEffective && notes.some((n: any) => n.taskId === currentTaskEffective.id);

  // Dynamic visual footprint (مطابقة لون واجهة المهمة بلون بطاقة المهمة وتغيرها مع تغير الحالة)
  const isDynamicFingerprint = settings.matchTaskCardColor === true;
  const activeFingerprint = useMemo(() => {
    if (isDynamicFingerprint && currentTaskEffective) {
      return getTaskVisualFingerprint(currentTaskEffective, uiSettings);
    }
    return null;
  }, [isDynamicFingerprint, currentTaskEffective, uiSettings]);

  // ألوان الواجهة الحقيقية المباشرة المعتمدة على اختيارات وتخصيصات المستخدم ونماذج الألوان
  const effectiveContainerBg = settings.containerBg || 'transparent';
  const effectiveContainerBorderColor = settings.containerBorderColor || '#ca8a04';
  const effectiveAccentBarColor = activeFingerprint ? activeFingerprint.accentColor : effectiveContainerBorderColor;
  const effectiveGlowShadow = activeFingerprint 
    ? `0 10px 30px -5px ${activeFingerprint.glowColor}` 
    : `0 10px 25px -5px ${effectiveContainerBorderColor}33`;

  const effectiveHeaderBg = settings.headerBg || 'rgba(161, 98, 7, 0.22)';
  const effectiveHeaderTextBg = settings.headerTextBg || 'rgba(202, 138, 4, 0.30)';
  const effectiveHeaderBorderColor = settings.headerBorderColor || 'rgba(202, 138, 4, 0.45)';
  const effectiveHeaderTextColor = settings.headerTextColor || '#facc15';
  const effectiveHeaderIconColor = settings.headerIconColor || '#facc15';

  const effectiveDetailsBg = settings.detailsBg || 'transparent';
  const effectiveDetailsTextColor = settings.detailsTextColor || '#ffffff';
  const effectiveDetailsLabelColor = settings.detailsLabelColor || '#cbd5e1';
  const effectiveDetailsDividerColor = settings.detailsDividerColor || 'rgba(202, 138, 4, 0.35)';
  const effectiveDetailsIconColor = settings.detailsIconColor || '#facc15';

  // Available statuses list
  const availableStatuses = useMemo(() => {
    const list = (statusOptions && statusOptions.length > 0) ? statusOptions : DEFAULT_STATUS_LIST;
    return list.filter(s => s !== 'تم الفحص والابلاغ' && s !== 'ملغية');
  }, [statusOptions]);

  // Dynamic Size Classes & Styles with rock-solid fixed layout heights
  const sizeStyles = useMemo(() => {
    switch (settings.tickerSize) {
      case 'ultra_compact':
        return {
          wrapper: 'my-1 mx-0.5 min-h-[115px]',
          headerPad: 'px-2 py-1',
          headerTitleSize: 'text-[10px] font-black',
          detailsPad: 'px-2 py-1.5',
          customerSize: 'text-xs sm:text-sm font-black',
          customerLabel: 'text-[9px] font-bold',
          modelSize: 'text-[10px] font-extrabold',
          badgeText: 'text-[8px] px-1 py-0.2',
          finValSize: 'text-[10px] font-black',
          bottomPad: 'pt-1',
          buttonClass: 'px-2 py-0.5 text-[10px] rounded-md',
          iconSize: 'w-2.5 h-2.5',
        };
      case 'compact':
        return {
          wrapper: 'my-1.5 mx-0.5 min-h-[148px]',
          headerPad: 'px-3 py-1.5',
          headerTitleSize: 'text-xs font-black',
          detailsPad: 'px-3 py-2',
          customerSize: 'text-sm sm:text-base font-black',
          customerLabel: 'text-[10px] font-bold',
          modelSize: 'text-xs font-extrabold',
          badgeText: 'text-[9px] px-1.5 py-0.5',
          finValSize: 'text-xs font-black',
          bottomPad: 'pt-1.5',
          buttonClass: 'px-2.5 py-1 text-xs rounded-lg',
          iconSize: 'w-3 h-3',
        };
      case 'large':
        return {
          wrapper: 'my-3 mx-1 min-h-[210px]',
          headerPad: 'px-5 py-3',
          headerTitleSize: 'text-sm sm:text-base font-black',
          detailsPad: 'px-5 py-3.5',
          customerSize: 'text-lg sm:text-xl font-black',
          customerLabel: 'text-xs sm:text-sm font-bold',
          modelSize: 'text-base sm:text-lg font-extrabold',
          badgeText: 'text-xs px-2.5 py-0.5',
          finValSize: 'text-base font-black',
          bottomPad: 'pt-2.5',
          buttonClass: 'px-4 py-2 text-sm rounded-xl',
          iconSize: 'w-4 h-4',
        };
      case 'medium':
      default:
        return {
          wrapper: 'my-2 mx-1 min-h-[175px]',
          headerPad: 'px-3.5 sm:px-4 py-2',
          headerTitleSize: 'text-xs sm:text-sm font-black',
          detailsPad: 'px-3.5 sm:px-4 py-2.5',
          customerSize: 'text-base sm:text-lg font-black',
          customerLabel: 'text-xs font-bold',
          modelSize: 'text-sm sm:text-base font-extrabold',
          badgeText: 'text-[10px] px-2 py-0.5',
          finValSize: 'text-xs sm:text-sm font-black',
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
    const prefixLate = settings.overduePrefixText || 'متأخر:';
    const prefixPending = settings.pendingPrefixText || 'متبقي:';

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return {
        isOverdue,
        text: isOverdue ? `${prefixLate} ${days}ي و ${remHours}س` : `${prefixPending} ${days}ي و ${remHours}س`,
        formatted: `${days}d ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`
      };
    }

    return {
      isOverdue,
      text: isOverdue ? `${prefixLate} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${prefixPending} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
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
    hapticMedium();
    setOptimisticStatuses(prev => ({ ...prev, [task.id]: newStatus }));
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(task, newStatus);
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
    hapticMedium();
    const readyStatus = 'للتسليم';
    setOptimisticStatuses(prev => ({ ...prev, [task.id]: readyStatus }));
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(task, readyStatus);
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
    hapticMedium();
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
  const renderCountdownBadge = (targetTask: any = currentTaskEffective, extraClasses = '') => {
    if (!targetTask || !settings.showCountdown) return null;
    const cd = getCountdown(targetTask.executionTime);
    if (!cd) return null;

    const taskStatus = optimisticStatuses[targetTask.id] || targetTask.status;
    const fp = isDynamicFingerprint ? getTaskVisualFingerprint({ ...targetTask, status: taskStatus }, uiSettings) : null;

    const textColor = cd.isOverdue 
      ? settings.overdueTextColor 
      : (fp ? fp.countdownTextColor : settings.countdownTextColor);
    const bgColor = cd.isOverdue 
      ? settings.overdueBgColor 
      : (fp ? fp.countdownBgColor : settings.countdownBgColor);
    const borderColor = cd.isOverdue 
      ? settings.overdueBorderColor 
      : (fp ? fp.countdownBorderColor : settings.countdownBorderColor);

    return (
      <span
        style={{
          color: textColor,
          backgroundColor: bgColor,
          borderColor: borderColor
        }}
        className={cn(
          "px-2 py-0.5 rounded-lg font-black border tracking-wider flex items-center gap-1 transition-all duration-300 select-none",
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
                <span>الحجم ونطاق المهام والسرعة</span>
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
              {/* TAB 1: General (Size, duration, auto-rotate, range) */}
              {settingsTab === 'general' && (
                <div className="space-y-4">
                  {/* Task Schedule Range Selector */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                        <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>نطاق عرض المهام المجدولة:</span>
                      </label>
                      <span className="text-[11px] font-black text-amber-900 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 shrink-0">
                        {currentRangeConfig.shortLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      حدد الفترة الزمنية لحصر وجلب المهام المجدولة لعرضها تلقائياً في الواجهة الفلاشية:
                    </p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {[
                        { id: '1day', label: 'اليوم القادم', sub: 'خلال 24 ساعة' },
                        { id: '2days', label: 'اليومين', sub: 'خلال 48 ساعة (افتراضي)' },
                        { id: '3days', label: 'الثلاثة أيام', sub: 'خلال 72 ساعة' },
                        { id: '4days', label: 'الأربعة أيام', sub: 'خلال 96 ساعة' },
                        { id: '1week', label: 'الأسبوع', sub: 'خلال 7 أيام' },
                        { id: '1month', label: 'الشهر', sub: 'خلال 30 يوماً' }
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => updateSettings({ taskRange: item.id as FlashTaskRange })}
                          className={cn(
                            "p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer min-h-[50px] active:scale-98",
                            (settings.taskRange || '2days') === item.id
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs font-black ring-1 ring-amber-400/60"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 font-bold"
                          )}
                        >
                          <div className="flex items-center justify-center gap-1 w-full">
                            <span className="text-xs font-black text-slate-950">{item.label}</span>
                            {(settings.taskRange || '2days') === item.id && (
                              <Check className="w-3.5 h-3.5 text-amber-600 stroke-[3]" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-600 font-medium">{item.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* View Layout Selector (شريط دوار vs صفوف مومضة vs عرض سطور هيكلي) */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                        <ListOrdered className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>طريقة عرض المهام بالواجهة الفلاشية:</span>
                      </label>
                      <span className="text-[11px] font-black text-amber-900 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 shrink-0">
                        {settings.viewLayout === 'priority_rows' ? 'صفوف مومضة حسب الأولوية' : settings.viewLayout === 'structured_rows' ? 'عرض السطور الهيكلي المرتب' : 'شريط دوار (افتراضي)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      حدد نمط العرض المناسب: شريط دوار لبطاقة مهمة واحدة، أو صفوف مومضة، أو عرض السطور الهيكلي المنظم:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => updateSettings({ viewLayout: 'carousel' })}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-start gap-1 text-right transition-all cursor-pointer",
                          (settings.viewLayout || 'carousel') === 'carousel'
                            ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-400/60"
                            : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-slate-950">شريط دوار (Carousel)</span>
                          {(settings.viewLayout || 'carousel') === 'carousel' && (
                            <Check className="w-4 h-4 text-amber-600 stroke-[3]" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-600 font-medium">
                          بطاقة مهمة واحدة والتبديل الدوري
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSettings({ viewLayout: 'priority_rows' })}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-start gap-1 text-right transition-all cursor-pointer",
                          settings.viewLayout === 'priority_rows'
                            ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-400/60"
                            : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-slate-950">صفوف مومضة للأولوية</span>
                          {settings.viewLayout === 'priority_rows' && (
                            <Check className="w-4 h-4 text-amber-600 stroke-[3]" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-600 font-medium">
                          صفوف ببطاقات بارزة وألوان حية
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSettings({ viewLayout: 'structured_rows' })}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-start gap-1 text-right transition-all cursor-pointer",
                          settings.viewLayout === 'structured_rows'
                            ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs ring-1 ring-amber-400/60"
                            : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-slate-950">عرض السطور الهيكلي</span>
                          {settings.viewLayout === 'structured_rows' && (
                            <Check className="w-4 h-4 text-amber-600 stroke-[3]" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-600 font-medium">
                          سطور مصفوفة أكثر ترتيباً وتنسيقاً
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Size Selector */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <label className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-amber-600" />
                      <span>حجم الواجهة الفلاشية في الصفحة الرئيسية:</span>
                    </label>
                    <p className="text-[11px] text-slate-600 font-medium">اختر الحجم الأنسب لجهازك وشاشتك (متناهي الصغر، مدمج، قياسي، أو كبير):</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {[
                        { id: 'ultra_compact', label: 'متناهي الصغر', desc: 'أصغر خط وضغط للحجم' },
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
                              ? "bg-amber-50 border-amber-400 text-amber-950 shadow-2xs font-black ring-1 ring-amber-400/60"
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
                        { id: 'top-header', title: 'في شريط العنوان أعلى الواجهة', desc: 'بجانب عنوان مهام الواجهة الفلاشية' },
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

                  {/* Countdown Colors & Custom Text Prefixes */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                    <span className="text-xs font-black text-slate-950 block border-b border-slate-200 pb-1.5">
                      تخصيص نص وألوان عداد الوقت:
                    </span>

                    {/* Custom Text Prefixes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-100">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">النص السابق لعداد المهام المتبقية</label>
                        <input
                          type="text"
                          value={settings.pendingPrefixText || 'متبقي:'}
                          onChange={(e) => updateSettings({ pendingPrefixText: e.target.value })}
                          placeholder="مثلاً: متبقي: أو الوقت المتبقي:"
                          className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-rose-800 block">النص السابق لعداد المهام المتأخرة</label>
                        <input
                          type="text"
                          value={settings.overduePrefixText || 'متأخر:'}
                          onChange={(e) => updateSettings({ overduePrefixText: e.target.value })}
                          placeholder="مثلاً: متأخر: أو تجاوز الوقت:"
                          className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Countdown Text Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون نص العداد</label>
                        <ColorPickerField
                          value={settings.countdownTextColor}
                          onChange={(val) => updateSettings({ countdownTextColor: val })}
                        />
                      </div>

                      {/* Countdown Bg Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون خلفية العداد</label>
                        <ColorPickerField
                          value={settings.countdownBgColor}
                          onChange={(val) => updateSettings({ countdownBgColor: val })}
                        />
                      </div>

                      {/* Countdown Border Color */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-800 block">لون إطار العداد</label>
                        <ColorPickerField
                          value={settings.countdownBorderColor}
                          onChange={(val) => updateSettings({ countdownBorderColor: val })}
                        />
                      </div>
                    </div>

                    {/* Overdue alert colors */}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-black text-rose-700 block mb-2">لون العداد عند تأخر موعد التنفيذ:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">لون نص التأخير</label>
                          <ColorPickerField
                            value={settings.overdueTextColor}
                            onChange={(val) => updateSettings({ overdueTextColor: val })}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">خلفية التأخير</label>
                          <ColorPickerField
                            value={settings.overdueBgColor}
                            onChange={(val) => updateSettings({ overdueBgColor: val })}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">إطار التأخير</label>
                          <ColorPickerField
                            value={settings.overdueBorderColor}
                            onChange={(val) => updateSettings({ overdueBorderColor: val })}
                          />
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
                  {/* Dynamic Visual Footprint Match */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 rounded-xl border border-amber-300/40 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-950 block">
                            مطابقة البصمة البصرية مع بطاقة المهمة وحالتها
                          </span>
                          <span className="text-[11px] text-slate-600 block">
                            تلوين إطار وخلفية الواجهة الفلاشية وأشرطتها تلقائياً وفقاً للون بطاقة المهمة وتغيرها فورياً بتغير حالتها
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.matchTaskCardColor === true}
                        onChange={(e) => updateSettings({ matchTaskCardColor: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer shrink-0"
                      />
                    </div>
                  </div>

                  {/* Presets */}
                  <div>
                    <label className="text-xs font-black text-slate-950 block mb-2">نماذج ألوان سريعة:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COLOR_PRESETS.map((preset, idx) => {
                        const isPresetActive = settings.containerBorderColor === preset.settings.containerBorderColor &&
                          settings.headerTextColor === preset.settings.headerTextColor;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              updateSettings({
                                ...preset.settings,
                                matchTaskCardColor: false
                              });
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer text-right group shadow-2xs",
                              isPresetActive 
                                ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-300/60 scale-[1.02]" 
                                : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-2xs" 
                                style={{ backgroundColor: preset.color }}
                              />
                              <span className="text-[11px] font-black text-slate-900 group-hover:text-black truncate">
                                {preset.name}
                              </span>
                            </div>
                            {isPresetActive && (
                              <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 stroke-[3]" />
                            )}
                          </button>
                        );
                      })}
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('flash_ticker_custom_settings', JSON.stringify(settings));
                    setIsSettingsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  title="حفظ الإعدادات الحالية ونمط العرض كافتراضي دائم"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>حفظ كافتراضي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  تم
                </button>
              </div>
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
              <span className={sizeStyles.headerTitleSize}>مهام {currentRangeConfig.headerTitle} (0)</span>
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
                  لا توجد مهام صيانة مجدولة لـ {currentRangeConfig.headerTitle}
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

  const deviceCount = currentTaskEffective ? getDeviceCount(currentTaskEffective) : 1;
  const deviceModel = currentTaskEffective ? getDeviceModel(currentTaskEffective) : '';
  const totalCost = currentTaskEffective?.cost || 0;
  const depositPaid = currentTaskEffective?.deposit || 0;
  const remainingBalance = totalCost - depositPaid;
  const isReadyForDelivery = currentTaskEffective?.status === 'للتسليم' || currentTaskEffective?.status === 'ready-to-deliver';

  // Calculated times for extension options
  const nextTaskExt = currentTaskEffective ? getNextTaskTime(currentTaskEffective, activeTasks) : null;
  const afterLastTaskExt = currentTaskEffective ? getAfterLastTaskTime(currentTaskEffective, activeTasks) : null;

  return (
    <>
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          background: effectiveContainerBg, 
          borderColor: effectiveContainerBorderColor,
          borderWidth: `${settings.containerBorderWidth}px`,
          boxShadow: effectiveGlowShadow
        }} 
        className={cn(
          "rounded-2xl shadow-2xl overflow-hidden relative group transition-all duration-300 ease-in-out flex flex-col backdrop-blur-md touch-pan-y",
          sizeStyles.wrapper
        )}
      >
        <div 
          style={{ backgroundColor: effectiveAccentBarColor }} 
          className="absolute top-0 right-0 h-full w-2 animate-pulse transition-colors duration-300" 
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
            backgroundColor: effectiveHeaderBg, 
            borderBottomColor: effectiveHeaderBorderColor 
          }} 
          className={cn("border-b flex justify-between items-center transition-colors duration-300", sizeStyles.headerPad)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span 
                style={{ backgroundColor: effectiveHeaderIconColor }} 
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 transition-colors duration-300"
              />
              <span 
                style={{ backgroundColor: effectiveHeaderIconColor }} 
                className="relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300"
              />
            </span>

            {/* Custom Header Text with its own background & text color */}
            <div 
              style={{ 
                backgroundColor: effectiveHeaderTextBg, 
                color: effectiveHeaderTextColor 
              }} 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 transition-colors duration-300 shadow-xs"
            >
              <CalendarClock className="w-4 h-4 shrink-0 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
              <span className={sizeStyles.headerTitleSize}>
                {currentRangeConfig.headerTitle} ({activeTasks.length})
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
                    backgroundColor: i === (tickerIndex % activeTasks.length) ? effectiveHeaderTextColor : effectiveHeaderBorderColor 
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
                  <ChevronRight className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
                </button>
                <button
                  type="button"
                  onClick={() => setTickerIndex(prev => (prev + 1) % activeTasks.length)}
                  className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="المهمة التالية"
                >
                  <ChevronLeft className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
                </button>
              </div>
            )}

            {/* Layout toggle button (Carousel vs Priority Rows) */}
            <button
              type="button"
              onClick={() => updateSettings({ viewLayout: settings.viewLayout === 'priority_rows' ? 'carousel' : 'priority_rows' })}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 border",
                settings.viewLayout === 'priority_rows'
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                  : "hover:bg-white/15 text-slate-300 border-transparent"
              )}
              title={settings.viewLayout === 'priority_rows' ? "التبديل للشريط الدوار" : "التبديل لعرض الصفوف المومضة حسب الأولوية"}
            >
              {settings.viewLayout === 'priority_rows' ? (
                <ListOrdered className="w-4 h-4 text-amber-400" />
              ) : (
                <LayoutGrid className="w-4 h-4 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
              )}
            </button>

            {/* Settings button in the corner */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer active:scale-95 border border-transparent hover:border-white/20"
              title="إعدادات الواجهة الفلاشية (الحجم، العداد، الألوان، الشفافية)"
            >
              <Settings className="w-4 h-4 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
            </button>

            {/* Close button */}
            {onClose && (
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="إغلاق الواجهة الفلاشية والعودة للأزرار الرئيسية"
              >
                <X className="w-4 h-4 transition-colors duration-300" style={{ color: effectiveHeaderIconColor }} />
              </button>
            )}
          </div>
        </div>

        {/* 2. Main Details Content (تفاصيل المهمة) */}
        <div 
          style={{ backgroundColor: effectiveDetailsBg }} 
          className={cn("relative transition-colors duration-300", sizeStyles.detailsPad)}
        >
          {settings.viewLayout === 'structured_rows' ? (
            <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-0.5 select-none custom-scrollbar dir-rtl">
              {activeTasks.map((task, idx) => {
                const effTaskStatus = optimisticStatuses[task.id] || task.status;
                const taskWithEffStatus = { ...task, status: effTaskStatus };
                const taskFp = isDynamicFingerprint ? getTaskVisualFingerprint(taskWithEffStatus, uiSettings) : null;
                const tDevCount = getDeviceCount(task);
                const tDevModel = getDeviceModel(task);
                const tCost = task.cost || 0;
                const tDep = task.deposit || 0;
                const tRem = tCost - tDep;

                return (
                  <div
                    key={task.id}
                    style={{
                      backgroundColor: taskFp ? taskFp.containerBg : 'rgba(255, 255, 255, 0.04)',
                      borderColor: taskFp ? taskFp.borderColor : settings.detailsDividerColor
                    }}
                    className="p-2.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs transition-all hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>
                      <span 
                        onClick={(e) => handleCustomerCallDirect(e, taskWithEffStatus)}
                        style={{ color: taskFp ? taskFp.detailsTextColor : settings.detailsTextColor }}
                        className="font-black text-sm text-white truncate cursor-pointer hover:underline flex items-center gap-1"
                        title={`اتصال مباشر بالعميل: ${task.customer}`}
                      >
                        {task.customer}
                      </span>
                      <span className="text-[11px] font-bold text-amber-300/80 bg-white/10 px-2 py-0.5 rounded truncate">
                        {tDevModel} ({tDevCount})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-[11px]">
                      <div className="flex items-center gap-1 font-mono text-slate-300">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{formatExecTime(task.executionTime)}</span>
                      </div>

                      {renderCountdownBadge(taskWithEffStatus, "text-[10px] py-0 px-1.5")}

                      {settings.showFinancials && (
                        <div className="font-mono font-bold text-slate-200">
                          باقي: <span className={tRem > 0 ? "text-red-400 font-black" : "text-emerald-400 font-black"}>{tRem}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onEditTask && onEditTask(taskWithEffStatus)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] transition-all cursor-pointer shadow-2xs"
                      >
                        فتح المهمة
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : settings.viewLayout === 'priority_rows' ? (
            <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-0.5 select-none custom-scrollbar">
              {activeTasks.map((task, idx) => {
                const effTaskStatus = optimisticStatuses[task.id] || task.status;
                const taskWithEffStatus = { ...task, status: effTaskStatus };
                const taskFp = isDynamicFingerprint ? getTaskVisualFingerprint(taskWithEffStatus, uiSettings) : null;

                const isTopPriority = idx === 0;
                const tDevCount = getDeviceCount(task);
                const tDevModel = getDeviceModel(task);
                const tCost = task.cost || 0;
                const tDep = task.deposit || 0;
                const tRem = tCost - tDep;
                const tReady = effTaskStatus === 'للتسليم' || effTaskStatus === 'ready-to-deliver';
                const isExtOpen = extendMenuTaskId === task.id;
                const tNextExt = getNextTaskTime(task, activeTasks);
                const tAfterLastExt = getAfterLastTaskTime(task, activeTasks);
                const tCd = getCountdown(task.executionTime);
                const isUrgent = isTopPriority || (tCd?.isOverdue) || false;
                const tHasNote = (task.internalNotes && task.internalNotes.trim().length > 0) || (task.note && task.note.trim().length > 0);

                const rowBg = taskFp ? taskFp.containerBg : (isUrgent ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)');
                const rowBorderColor = taskFp ? taskFp.borderColor : (isUrgent ? 'rgba(245, 158, 11, 0.45)' : settings.detailsDividerColor);
                const rowAccentColor = taskFp ? taskFp.accentColor : (isUrgent ? '#f59e0b' : settings.detailsDividerColor);

                return (
                  <div
                    key={task.id}
                    style={{
                      background: rowBg,
                      borderColor: rowBorderColor,
                    }}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all duration-300 relative overflow-hidden",
                      isUrgent && "shadow-xs ring-1 ring-amber-400/30"
                    )}
                  >
                    {/* Priority indicator bar */}
                    <div 
                      style={{ backgroundColor: rowAccentColor }}
                      className={cn("absolute right-0 top-0 bottom-0 w-1.5 transition-colors duration-300", isUrgent && "animate-pulse")}
                    />

                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-1.5">
                      {/* Rank badge */}
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span 
                          style={{
                            backgroundColor: taskFp ? taskFp.headerTextBg : undefined,
                            color: taskFp ? taskFp.headerTextColor : undefined,
                            borderColor: taskFp ? taskFp.headerBorderColor : undefined
                          }}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border transition-colors duration-300",
                            !taskFp && (isTopPriority 
                              ? "bg-amber-500 text-slate-950 border-amber-300 shadow-xs font-black animate-pulse" 
                              : "bg-white/10 text-slate-300 border-white/10")
                          )}
                        >
                          #{idx + 1}
                        </span>
                        {isTopPriority && (
                          <span className="text-[9px] font-black text-amber-400 mt-0.5 whitespace-nowrap">
                            الأولوية 1
                          </span>
                        )}
                      </div>

                      {/* Customer & Device */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            onClick={(e) => handleCustomerCallDirect(e, taskWithEffStatus)}
                            style={{ color: taskFp ? taskFp.detailsTextColor : settings.detailsTextColor }}
                            className="font-black text-sm sm:text-base cursor-pointer hover:underline truncate transition-colors duration-300"
                            title={`اتصال مباشر بالعميل: ${task.customer}`}
                          >
                            {task.customer}
                          </span>

                          {task.customerPhones && task.customerPhones.length > 0 && (
                            <a
                              href={`tel:${task.customerPhones[0]}`}
                              className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              title={`اتصال بالعميل: ${task.customerPhones[0]}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <span 
                            style={{
                              borderColor: taskFp ? taskFp.statusBorderColor : undefined,
                              backgroundColor: taskFp ? taskFp.statusBadgeBg : undefined,
                              color: taskFp ? taskFp.statusTextColor : undefined
                            }}
                            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-400/25 shrink-0 transition-colors duration-300"
                          >
                            <Smartphone className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{tDevModel}</span>
                            {tDevCount > 1 && (
                              <span className="text-[9px] font-black bg-amber-400/20 px-1 rounded mr-0.5">
                                ({tDevCount})
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Timing & Financial Info */}
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs flex-wrap">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-amber-300/90 font-bold">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{formatExecTime(task.executionTime)}</span>
                          </div>

                          {renderCountdownBadge(taskWithEffStatus, "text-[10px] py-0 px-1.5")}

                          {settings.showFinancials && (
                            <div className="flex items-center gap-1 text-[11px] font-black">
                              <span style={{ color: taskFp ? taskFp.detailsLabelColor : settings.detailsLabelColor }}>المتبقي:</span>
                              <span className={tRem > 0 ? "text-red-400" : "text-emerald-400"}>
                                {tRem}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Status */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap pt-1.5 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      {/* Status Selector - Rich Styled Select matching Task Card */}
                      {settings.showStatusDropdown && (
                        <div className="relative inline-block">
                          <select
                            value={effTaskStatus}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            style={{ 
                              borderColor: taskFp ? taskFp.statusBorderColor : 
                                (effTaskStatus === 'للتسليم' || effTaskStatus === 'ready-to-deliver' ? '#2dd4bf' :
                                 effTaskStatus === 'جاري التنفيذ' || effTaskStatus === 'in-progress' ? '#60a5fa' :
                                 effTaskStatus === 'تمت الصيانة' || effTaskStatus === 'maintenance-done' ? '#34d399' :
                                 effTaskStatus === 'تم التسليم' || effTaskStatus === 'completed' ? '#4ade80' :
                                 effTaskStatus === 'ملغية' || effTaskStatus === 'cancelled' ? '#fb7185' : '#fbbf24'),
                              backgroundColor: taskFp ? taskFp.statusBadgeBg : 
                                (effTaskStatus === 'للتسليم' || effTaskStatus === 'ready-to-deliver' ? 'rgba(20, 184, 166, 0.25)' :
                                 effTaskStatus === 'جاري التنفيذ' || effTaskStatus === 'in-progress' ? 'rgba(59, 130, 246, 0.25)' :
                                 effTaskStatus === 'تمت الصيانة' || effTaskStatus === 'maintenance-done' ? 'rgba(16, 185, 129, 0.25)' :
                                 effTaskStatus === 'تم التسليم' || effTaskStatus === 'completed' ? 'rgba(34, 197, 94, 0.25)' :
                                 effTaskStatus === 'ملغية' || effTaskStatus === 'cancelled' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)'),
                              color: taskFp ? taskFp.statusTextColor : 
                                (effTaskStatus === 'للتسليم' || effTaskStatus === 'ready-to-deliver' ? '#99f6e4' :
                                 effTaskStatus === 'جاري التنفيذ' || effTaskStatus === 'in-progress' ? '#bfdbfe' :
                                 effTaskStatus === 'تمت الصيانة' || effTaskStatus === 'maintenance-done' ? '#a7f3d0' :
                                 effTaskStatus === 'تم التسليم' || effTaskStatus === 'completed' ? '#bbf7d0' :
                                 effTaskStatus === 'ملغية' || effTaskStatus === 'cancelled' ? '#fecdd3' : '#fde68a')
                            }}
                            className="appearance-none text-[11px] font-black py-1 pl-6 pr-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all duration-300 cursor-pointer shadow-sm active:scale-95"
                          >
                            {availableStatuses.map(st => (
                              <option key={st} value={st} className="bg-slate-900 text-white py-1 font-bold">
                                {st === 'pending' ? '⏳ قيد الانتظار' :
                                 st === 'in-progress' ? '⚡ جاري التنفيذ' :
                                 st === 'maintenance-done' ? '🔧 تمت الصيانة' :
                                 st === 'ready-to-deliver' ? '📦 للتسليم' :
                                 st === 'completed' ? '✅ تم التسليم' :
                                 st === 'cancelled' ? '❌ ملغية' : `📍 ${st}`}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 opacity-80 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      )}

                      {/* زر تم التنفيذ */}
                      <button
                        type="button"
                        onClick={() => handleMarkReadyForDelivery(task)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-black rounded-lg transition-all active:scale-95 border cursor-pointer flex items-center gap-1",
                          tReady 
                            ? "bg-teal-500/20 text-teal-300 border-teal-500/50"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40"
                        )}
                        title="اعتماد الحالة للتسليم"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">{tReady ? 'للتسليم' : 'تم التنفيذ'}</span>
                      </button>

                      {/* زر الملاحظة */}
                      {tHasNote ? (
                        <button
                          type="button"
                          onClick={() => onViewNote && onViewNote(task.id)}
                          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-amber-400 transition-colors cursor-pointer"
                          title="معاينة الملاحظة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddNote && onAddNote(task.id)}
                          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                          title="إضافة ملاحظة"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* تمديد الوقت */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setExtendMenuTaskId(isExtOpen ? null : task.id)}
                          className={cn(
                            "p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold",
                            isExtOpen 
                              ? "bg-amber-500 text-slate-950 border-amber-400"
                              : "bg-white/10 hover:bg-white/15 text-amber-300 border-white/10"
                          )}
                          title="تمديد الوقت"
                        >
                          <ClockPlus className="w-3.5 h-3.5" />
                          <ChevronDown className={cn("w-3 h-3 transition-transform", isExtOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                          {isExtOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute bottom-full mb-1.5 left-0 z-50 w-56 bg-slate-900/95 backdrop-blur-md border border-amber-400/50 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-right"
                            >
                              <div className="px-2 py-1 text-[10px] font-black text-amber-400 border-b border-slate-800 flex items-center justify-between">
                                <span>تمديد موعد {task.customer}:</span>
                                <Clock className="w-3 h-3" />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleExtendExecutionTime(task, addMinutes(task.executionTime, 30), '+30 دقيقة');
                                  setExtendMenuTaskId(null);
                                }}
                                className="px-2 py-1 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>نصف ساعة (+30د)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleExtendExecutionTime(task, addMinutes(task.executionTime, 60), '+1 ساعة');
                                  setExtendMenuTaskId(null);
                                }}
                                className="px-2 py-1 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>ساعة كاملة (+1س)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleExtendExecutionTime(task, addMinutes(task.executionTime, 360), '+6 ساعات');
                                  setExtendMenuTaskId(null);
                                }}
                                className="px-2 py-1 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>6 ساعات (+6س)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleExtendExecutionTime(task, addMinutes(task.executionTime, 1440), '+24 ساعة');
                                  setExtendMenuTaskId(null);
                                }}
                                className="px-2 py-1 text-xs text-slate-200 hover:text-white hover:bg-amber-500/20 rounded-lg text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>24 ساعة (غداً)</span>
                              </button>

                              {tNextExt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExtendExecutionTime(task, tNextExt.iso, tNextExt.info);
                                    setExtendMenuTaskId(null);
                                  }}
                                  className="px-2 py-1 text-[11px] text-amber-300 hover:text-white hover:bg-amber-500/20 rounded-lg text-right flex flex-col cursor-pointer font-bold border-t border-slate-800 pt-1"
                                >
                                  <span>بعد المهمة التالية (+30د)</span>
                                </button>
                              )}

                              {tAfterLastExt && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExtendExecutionTime(task, tAfterLastExt.iso, 'بعد آخر مهمة');
                                    setExtendMenuTaskId(null);
                                  }}
                                  className="px-2 py-1 text-[11px] text-teal-300 hover:text-white hover:bg-teal-500/20 rounded-lg text-right flex flex-col cursor-pointer font-bold"
                                >
                                  <span>بعد آخر مهمة (+30د)</span>
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* فتح المهمة */}
                      {onEditTask && (
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                          title="فتح المهمة"
                        >
                          فتح
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {currentTaskEffective && (
                <motion.div
                  key={currentTaskEffective.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col gap-2.5"
                >
                {/* Upper row of details: Customer, Device, Scheduled Time, and Note/Open Actions */}
                <div className="flex items-center justify-between gap-2.5 pb-1">
                  <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0 overflow-hidden">
                    
                    {/* Customer */}
                    {settings.showCustomer && (
                      <div 
                        className={cn(
                          "flex flex-col min-w-0 max-w-[150px] sm:max-w-[210px] shrink-0",
                          onEditTask && "cursor-pointer"
                        )}
                        onClick={() => onEditTask && onEditTask(currentTaskEffective)}
                        title="انقر لفتح تفاصيل المهمة"
                      >
                        <span style={{ color: effectiveDetailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                          <User className="w-2.5 h-2.5" style={{ color: effectiveDetailsIconColor }} /> العميل
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span 
                            onClick={(e) => handleCustomerCallDirect(e, currentTaskEffective)}
                            style={{ color: effectiveDetailsTextColor }} 
                            className={cn("truncate font-black cursor-pointer hover:underline", sizeStyles.customerSize)}
                            title={`اتصال مباشر بالعميل: ${currentTaskEffective.customer}`}
                          >
                            {currentTaskEffective.customer}
                          </span>
                          {currentTaskEffective.customerPhones && currentTaskEffective.customerPhones.length > 0 && (
                            <a
                              href={`tel:${currentTaskEffective.customerPhones[0]}`}
                              className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                              title={`اتصال بالعميل: ${currentTaskEffective.customerPhones[0]}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Device Count & Model */}
                    {(settings.showDeviceCount || settings.showDeviceModel) && (
                      <div 
                        style={{ borderRightColor: effectiveDetailsDividerColor }} 
                        className="flex flex-col border-r pr-2.5 sm:pr-3 min-w-0 max-w-[160px] sm:max-w-[220px] shrink-0"
                      >
                        <span style={{ color: effectiveDetailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                          <Smartphone className="w-2.5 h-2.5" style={{ color: effectiveDetailsIconColor }} /> الجهاز والموديل
                        </span>
                        <div className="flex items-center gap-1.5 truncate">
                          {settings.showDeviceCount && (
                            <span className={cn("font-extrabold rounded bg-white/10 text-amber-300 shrink-0 border border-white/10", sizeStyles.badgeText)}>
                              {deviceCount} {deviceCount > 1 ? 'أجهزة' : 'جهاز'}
                            </span>
                          )}
                          {settings.showDeviceModel && (
                            <span style={{ color: effectiveDetailsTextColor }} className={cn("truncate font-bold", sizeStyles.modelSize)}>
                              {deviceModel}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scheduled Time & Details-Inline Countdown */}
                    <div 
                      style={{ borderRightColor: effectiveDetailsDividerColor }} 
                      className="flex flex-col shrink-0 border-r pr-2.5 sm:pr-3"
                    >
                      <span style={{ color: effectiveDetailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                        <Clock className="w-2.5 h-2.5" style={{ color: effectiveDetailsIconColor }} /> موعد التنفيذ
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[11px] text-amber-300 whitespace-nowrap">
                          {formatExecTime(currentTaskEffective.executionTime)}
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
                          onClick={() => onViewNote && onViewNote(currentTaskEffective.id)}
                          style={{ backgroundColor: actionBg, borderColor: effectiveDetailsDividerColor }}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/15 rounded-xl transition-colors cursor-pointer text-xs font-bold border text-amber-400 active:scale-95"
                          title="معاينة الملاحظة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">ملاحظة</span>
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => onAddNote && onAddNote(currentTaskEffective.id)}
                          style={{ backgroundColor: actionBg, borderColor: effectiveDetailsDividerColor }}
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
                          onClick={() => onEditTask(currentTaskEffective)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all font-black text-xs cursor-pointer shadow-md active:scale-95 shrink-0"
                          title="فتح المهمة للتعديل أو المتابعة"
                        >
                          <span>فتح</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Secondary row of details: Financials & Status Selector */}
                <div 
                  style={{ borderTopColor: effectiveDetailsDividerColor }} 
                  className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t"
                >
                  {/* Financials: Cost / Deposit / Balance */}
                  {settings.showFinancials && (
                    <div className="flex items-center gap-2">
                      <span style={{ color: effectiveDetailsLabelColor }} className={cn("font-bold flex items-center gap-1", sizeStyles.customerLabel)}>
                        <Banknote className="w-3 h-3" style={{ color: effectiveDetailsIconColor }} /> الحساب المالي:
                      </span>
                      <div className="flex items-center gap-2 bg-black/20 px-2 py-0.5 rounded-lg border border-white/5 font-black text-xs sm:text-sm">
                        <span className="text-slate-300 font-bold" title="التكلفة الإجمالية">
                          إجمالي: {totalCost}
                        </span>
                        <span style={{ color: effectiveDetailsLabelColor }} className="text-[10px] opacity-40">|</span>
                        <span className="text-emerald-400 font-bold" title="الواصل / المقدم">
                          واصل: {depositPaid}
                        </span>
                        <span style={{ color: effectiveDetailsLabelColor }} className="text-[10px] opacity-40">|</span>
                        <span className={cn("font-black px-1.5 py-0.5 rounded", remainingBalance > 0 ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30")} title="المتبقي">
                          باقي: {remainingBalance}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status Dropdown */}
                  {settings.showStatusDropdown && (
                    <div className="flex items-center gap-1.5 mr-auto">
                      <span style={{ color: effectiveDetailsLabelColor }} className={cn("font-bold shrink-0", sizeStyles.customerLabel)}>
                        الحالة:
                      </span>
                      <div className="relative inline-block">
                        <select
                          value={currentTaskEffective.status}
                          onChange={(e) => handleStatusChange(currentTaskEffective, e.target.value)}
                          style={{ 
                            borderColor: activeFingerprint ? activeFingerprint.statusBorderColor : effectiveDetailsDividerColor,
                            backgroundColor: activeFingerprint ? activeFingerprint.headerBg : 'rgba(15, 23, 42, 0.7)',
                            color: activeFingerprint ? activeFingerprint.statusTextColor : undefined
                          }}
                          className={cn(
                            "appearance-none text-[11px] font-bold py-1 pl-6 pr-2 rounded-lg border focus:outline-none transition-all duration-300 cursor-pointer shadow-xs",
                            !activeFingerprint && (
                              currentTaskEffective.status === 'للتسليم' ? "text-emerald-400 border-emerald-500/50" :
                              currentTaskEffective.status === 'جاري التنفيذ' ? "text-blue-400 border-blue-500/50" :
                              currentTaskEffective.status === 'تمت الصيانة' ? "text-teal-300 border-teal-500/50" :
                              "text-slate-200"
                            )
                          )}
                        >
                          {availableStatuses.map(st => (
                            <option key={st} value={st} className="bg-slate-900 text-white py-1 font-bold">
                              {st}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Bottom Actions Bar (أسفل الواجهة: تم التنفيذ + تمديد الوقت + عداد الوقت السفلي) */}
                {settings.showBottomBar && (
                  <div 
                    style={{ 
                      borderColor: effectiveDetailsDividerColor,
                      backgroundColor: activeFingerprint ? activeFingerprint.headerBg : 'rgba(0, 0, 0, 0.2)'
                    }}
                    className={cn("border-t flex flex-wrap items-center justify-between gap-2 mt-0.5 rounded-lg p-1.5 transition-colors duration-300", sizeStyles.bottomPad)}
                  >
                    <div className="flex items-center gap-2">
                      {/* زر تم التنفيذ (اعتماد الحالة للتسليم) */}
                      <button
                        type="button"
                        onClick={() => handleMarkReadyForDelivery(currentTaskEffective)}
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
                              className="absolute bottom-full mb-1.5 right-0 z-40 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-amber-400 dark:border-amber-500/40 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 text-right"
                            >
                              <div className="px-2.5 py-1 text-[10px] font-black text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-slate-800 flex items-center justify-between">
                                <span>تمديد وقت التنفيذ:</span>
                                <Clock className="w-3 h-3" />
                              </div>

                              {/* 1. نصف ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTaskEffective, 
                                  addMinutes(currentTaskEffective.executionTime, 30),
                                  '+30 دقيقة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>نصف ساعة (+30د)</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTaskEffective.executionTime, 30)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 2. ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTaskEffective, 
                                  addMinutes(currentTaskEffective.executionTime, 60),
                                  '+1 ساعة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>ساعة كاملة (+1س)</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTaskEffective.executionTime, 60)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 3. 6 ساعات */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTaskEffective, 
                                  addMinutes(currentTaskEffective.executionTime, 360),
                                  '+6 ساعات'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>6 ساعات (+6س)</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {new Date(addMinutes(currentTaskEffective.executionTime, 360)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              {/* 4. 24 ساعة */}
                              <button
                                type="button"
                                onClick={() => handleExtendExecutionTime(
                                  currentTaskEffective, 
                                  addMinutes(currentTaskEffective.executionTime, 1440),
                                  '+24 ساعة'
                                )}
                                className="px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-all text-right flex items-center justify-between cursor-pointer font-bold"
                              >
                                <span>24 ساعة (يوم كامل)</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  غداً {new Date(addMinutes(currentTaskEffective.executionTime, 1440)).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </button>

                              <div className="my-0.5 border-t border-slate-200 dark:border-slate-800" />

                              {/* 5. بعد المهمة التالية */}
                              {nextTaskExt && (
                                <button
                                  type="button"
                                  onClick={() => handleExtendExecutionTime(
                                    currentTaskEffective, 
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
                                    currentTaskEffective, 
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
          )}
        </div>
      </div>

      {renderSettingsModal()}
    </>
  );
};
