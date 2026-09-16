import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Currency, ExchangeRates } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\(\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getInUSD(amount: number | undefined | null, currency: Currency | string | undefined | null, rates: ExchangeRates): number {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  const curr = (!currency || currency === 'YER' || currency === 'ريال يمني') ? 'RY' : currency;
  const sarRate = (rates && Number(rates.SAR)) ? Number(rates.SAR) : 3.8;
  const ryRate = (rates && Number(rates.RY)) ? Number(rates.RY) : 1575;

  if (curr === 'SAR' || curr === 'ريال سعودي') return amount / sarRate;
  if (curr === 'RY' || curr === 'YER' || curr === 'ريال يمني') return amount / ryRate;
  return amount;
}

export function convertCurrency(amount: number | undefined | null, fromCurrency: Currency | string | undefined | null, toCurrency: Currency | string | undefined | null, rates: ExchangeRates): number {
  if (amount === undefined || amount === null || isNaN(amount)) return 0;
  const normFrom = (!fromCurrency || fromCurrency === 'YER' || fromCurrency === 'ريال يمني') ? 'RY' : fromCurrency;
  const normTo = (!toCurrency || toCurrency === 'YER' || toCurrency === 'ريال يمني') ? 'RY' : toCurrency;
  
  if (normFrom === normTo) return amount;
  const inUSD = getInUSD(amount, normFrom, rates);
  
  const sarRate = (rates && Number(rates.SAR)) ? Number(rates.SAR) : 3.8;
  const ryRate = (rates && Number(rates.RY)) ? Number(rates.RY) : 1575;

  if (normTo === 'SAR' || normTo === 'ريال سعودي') return inUSD * sarRate;
  if (normTo === 'RY' || normTo === 'YER' || normTo === 'ريال يمني') return inUSD * ryRate;
  return inUSD;
}

export function formatAmount(amountInUSD: number | undefined | null, targetCurrency: Currency | string | undefined | null, rates: ExchangeRates): string {
  if (amountInUSD === undefined || amountInUSD === null || isNaN(amountInUSD)) return '0';
  const normTo = (!targetCurrency || targetCurrency === 'YER' || targetCurrency === 'ريال يمني') ? 'RY' : targetCurrency;
  
  const sarRate = (rates && Number(rates.SAR)) ? Number(rates.SAR) : 3.8;
  const ryRate = (rates && Number(rates.RY)) ? Number(rates.RY) : 1575;

  let converted = amountInUSD;
  if (normTo === 'SAR' || normTo === 'ريال سعودي') converted = amountInUSD * sarRate;
  else if (normTo === 'RY' || normTo === 'YER' || normTo === 'ريال يمني') converted = amountInUSD * ryRate;
  else if (normTo === 'USD' || normTo === 'دولار') converted = amountInUSD;
  
  if (normTo === 'USD' || normTo === 'دولار') {
    return Number(converted.toFixed(1)).toLocaleString();
  }
  
  return Math.round(converted).toLocaleString();
}

export function convertAndRound(amount: number | undefined | null, fromCurrency: Currency | string | undefined | null, toCurrency: Currency | string | undefined | null, rates: ExchangeRates): number {
  const converted = convertCurrency(amount, fromCurrency, toCurrency, rates);
  const normTo = (!toCurrency || toCurrency === 'YER' || toCurrency === 'ريال يمني') ? 'RY' : toCurrency;
  if (normTo === 'USD' || normTo === 'دولار') {
    return Number(converted.toFixed(1));
  }
  return Math.round(converted);
}

/**
 * Checks whether a transaction belongs strictly to the Financial Center
 * (e.g. internal transfers between cashboxes/vaults, debt repayments, opening capital)
 * and should NOT be displayed or calculated in "حسابات ما له وما عليه" (AccountsManager).
 */
export function isFinancialCenterOnlyTransaction(t: {
  category?: string | null;
  description?: string | null;
  isInternalFinancial?: boolean;
  scope?: string;
  isDebtRepayment?: boolean;
  debtAccountId?: number;
  sourceAccount?: string;
  destinationAccount?: string;
}): boolean {
  if (!t) return false;
  if (t.isInternalFinancial === true || t.scope === 'financial_center') return true;
  if (t.isDebtRepayment === true || t.debtAccountId != null) return true;
  if (t.sourceAccount && t.destinationAccount) return true;
  const cat = t.category || '';
  if (
    cat.includes('تحويل نقدي داخلي') || 
    cat.includes('تحويل داخلي') || 
    cat.includes('سداد ديون') || 
    cat.includes('رصيد افتتاحي') || 
    cat.includes('رأس مال')
  ) {
    return true;
  }
  const desc = t.description || '';
  if (
    desc.startsWith('تحويل داخلي') || 
    desc.startsWith('سداد دفعة دين') ||
    desc.startsWith('رصيد افتتاحي')
  ) {
    return true;
  }
  return false;
}


export const DEVICE_TYPES = ["راوتر", "رأس بث لاسلكي", "انتينة", "اكسس بوينت", "مودم", "سويتش", "اخرى"];

export const DEVICE_MODELS: Record<string, string[]> = {
  "راوتر": ["RB1100x4", "RB1100x2", "RB2011"],
  "رأس بث لاسلكي": ["PBE-M5-400", "PBE-M5-300", "PBE-M2-", "PBE-AC-620"],
  "انتينة": ["NSM2", "NSM5", "LOCOM2", "LOCOM5", "TL-7210N", "TL-WA5210G"],
  "اكسس بوينت": ["TL-801", "TL-901", "TOTON300RH"],
  "سويتش": ["S808/100", "S808G/1000"]
};

export const INVENTORY_CATEGORIES = ['ایسيهات', 'بوردات', 'اجهزة', 'ادوات', 'اخرى'];

export const DEFAULT_ISSUE_OPTIONS = ["لا يعمل", "إعادة تشغيل تلقائي", "ضعف الإشارة", "تلف المنفذ", "تحديث النظام"];
export const DEFAULT_INSPECTION_OPTIONS = ["تلف في المعالج", "تلف في المكثفات", "تلف في منفذ الطاقة", "يحتاج برمجة", "سليم"];
export const DEFAULT_ACCOUNT_OPTIONS = ["مدفوع", "متبقي", "مجاني", "خصم", "آجل"];
