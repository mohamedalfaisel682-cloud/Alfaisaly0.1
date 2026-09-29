import { DailyBondShortcut } from '../types';

export const DAILY_BOND_SHORTCUTS_STORAGE_KEY = 'faisali_daily_bond_shortcuts';

export const DEFAULT_DAILY_BOND_SHORTCUTS: DailyBondShortcut[] = [
  {
    id: 'shortcut_exp_buffet',
    title: 'بوفية ومصاريف يومية',
    type: 'expense',
    description: 'مصاريف يومية وبوفية وضيافة المحل',
    category: 'مصاريف عامة',
    targetType: 'account',
    targetName: 'مصاريف وبوفية المحل',
    color: 'rose',
    isFavorite: true
  },
  {
    id: 'shortcut_exp_utilities',
    title: 'فواتير كهرباء وإنترنت',
    type: 'expense',
    description: 'سداد فواتير خدمات المحل (كهرباء / إنترنت)',
    category: 'خدمات ومرافق',
    targetType: 'account',
    targetName: 'فواتير وخدمات المحل',
    color: 'amber',
    isFavorite: true
  },
  {
    id: 'shortcut_exp_parts',
    title: 'شراء قطع غيار ومستلزمات',
    type: 'expense',
    description: 'شراء قطع غيار ومستلزمات صيانة للمحل',
    category: 'قطع غيار ومشتريات',
    targetType: 'account',
    targetName: 'مشتريات وموردي قطع الغيار',
    color: 'purple',
    isFavorite: true
  },
  {
    id: 'shortcut_exp_rent',
    title: 'إيجار المحل',
    type: 'expense',
    description: 'سداد دفعة إيجار المحل',
    category: 'إيجارات',
    targetType: 'account',
    targetName: 'إيجار المحل',
    color: 'red',
    isFavorite: false
  },
  {
    id: 'shortcut_inc_maintenance',
    title: 'إيراد صيانة نقدية',
    type: 'income',
    description: 'إيراد صيانة نقدية فورية بالصندوق',
    category: 'إيرادات صيانة',
    targetType: 'account',
    targetName: 'صندوق الصيانة والنقدية',
    color: 'emerald',
    isFavorite: true
  },
  {
    id: 'shortcut_inc_transfer',
    title: 'تحويل بنكي / صرافة',
    type: 'income',
    description: 'إيداع حوالة بنكية / صرافة واردة',
    category: 'حوالات بنكية',
    targetType: 'account',
    targetName: 'حساب البنك والصرافة',
    color: 'blue',
    isFavorite: true
  }
];

export function getDailyBondShortcuts(): DailyBondShortcut[] {
  try {
    const raw = localStorage.getItem(DAILY_BOND_SHORTCUTS_STORAGE_KEY);
    if (!raw) {
      saveDailyBondShortcuts(DEFAULT_DAILY_BOND_SHORTCUTS);
      return DEFAULT_DAILY_BOND_SHORTCUTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_DAILY_BOND_SHORTCUTS;
  } catch (e) {
    console.error('Failed to parse daily bond shortcuts:', e);
    return DEFAULT_DAILY_BOND_SHORTCUTS;
  }
}

export function saveDailyBondShortcuts(shortcuts: DailyBondShortcut[]): void {
  try {
    localStorage.setItem(DAILY_BOND_SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new CustomEvent('daily_bond_shortcuts_changed', { detail: shortcuts }));
  } catch (e) {
    console.error('Failed to save daily bond shortcuts:', e);
  }
}

export function addDailyBondShortcut(shortcut: Omit<DailyBondShortcut, 'id'>): DailyBondShortcut {
  const all = getDailyBondShortcuts();
  const newShortcut: DailyBondShortcut = {
    ...shortcut,
    id: `shortcut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  };
  const updated = [newShortcut, ...all];
  saveDailyBondShortcuts(updated);
  return newShortcut;
}

export function updateDailyBondShortcut(updated: DailyBondShortcut): void {
  const all = getDailyBondShortcuts();
  const next = all.map(s => s.id === updated.id ? updated : s);
  saveDailyBondShortcuts(next);
}

export function deleteDailyBondShortcut(id: string): void {
  const all = getDailyBondShortcuts();
  const next = all.filter(s => s.id !== id);
  saveDailyBondShortcuts(next);
}

export function resetDailyBondShortcuts(): DailyBondShortcut[] {
  saveDailyBondShortcuts(DEFAULT_DAILY_BOND_SHORTCUTS);
  return DEFAULT_DAILY_BOND_SHORTCUTS;
}
