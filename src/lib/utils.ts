import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Currency, ExchangeRates } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes numbers written with Eastern Arabic digits (٠-٩), Persian/Urdu (۰-۹),
 * or Indian/Devanagari digits (०-९) to standard Western Arabic/English digits (0-9).
 * Also replaces Arabic decimal separator '٫' with '.', and handles thousand suffix 'k'/'K' (e.g. 50k -> 50000).
 */
export function normalizeIndicDigits(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  let s = String(str).trim();
  
  const digitMap: { [key: string]: string } = {
    // Eastern Arabic numerals (٠-٩)
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    // Persian / Urdu numerals (۰-۹)
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    // Indian / Devanagari numerals (०-९)
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    // Arabic decimal separator
    '٫': '.',
  };

  s = s.replace(/[٠-٩۰-۹०-९٫]/g, (ch) => digitMap[ch] || ch);

  // If user entered numbers with 'k' or 'K' suffix (e.g. 50k, 25k, 5.5k), expand to full zeroes
  if (/^[\d.]+\s*[kK]$/.test(s)) {
    const numPart = parseFloat(s.replace(/[kK]/g, '').trim());
    if (!isNaN(numPart)) {
      s = String(Math.round(numPart * 1000));
    }
  }

  return s;
}

export function parseNormalizedNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const normalized = normalizeIndicDigits(val);
  const clean = normalized.replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? fallback : parsed;
}

export function parseAmountInput(val: string | number | null | undefined, fallback: number = 0): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const normalized = normalizeIndicDigits(val);
  const sum = normalized.replace(/\s/g, '').split('+').reduce((acc, p) => {
    const clean = p.replace(/,/g, '');
    const num = parseFloat(clean);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
  return isNaN(sum) ? fallback : sum;
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\(\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getInUSD(amount: number | string | undefined | null, currency: Currency | string | undefined | null, rates: ExchangeRates): number {
  const parsedAmount = typeof amount === 'number' ? amount : parseNormalizedNumber(amount, 0);
  if (parsedAmount === undefined || parsedAmount === null || isNaN(parsedAmount)) return 0;
  const curr = (!currency || currency === 'YER' || currency === 'ريال يمني') ? 'RY' : currency;
  const sarRate = (rates && Number(rates.SAR)) ? Number(rates.SAR) : 3.8;
  const ryRate = (rates && Number(rates.RY)) ? Number(rates.RY) : 1575;

  if (curr === 'SAR' || curr === 'ريال سعودي') return parsedAmount / sarRate;
  if (curr === 'RY' || curr === 'YER' || curr === 'ريال يمني') return parsedAmount / ryRate;
  return parsedAmount;
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

export function formatAmount(amountInUSD: number | string | undefined | null, targetCurrency: Currency | string | undefined | null, rates: ExchangeRates): string {
  const parsedUSD = typeof amountInUSD === 'number' ? amountInUSD : parseNormalizedNumber(amountInUSD, 0);
  if (parsedUSD === undefined || parsedUSD === null || isNaN(parsedUSD)) return '0';
  const normTo = (!targetCurrency || targetCurrency === 'YER' || targetCurrency === 'ريال يمني') ? 'RY' : targetCurrency;
  
  const sarRate = (rates && Number(rates.SAR)) ? Number(rates.SAR) : 3.8;
  const ryRate = (rates && Number(rates.RY)) ? Number(rates.RY) : 1575;

  let converted = parsedUSD;
  if (normTo === 'SAR' || normTo === 'ريال سعودي') converted = parsedUSD * sarRate;
  else if (normTo === 'RY' || normTo === 'YER' || normTo === 'ريال يمني') converted = parsedUSD * ryRate;
  else if (normTo === 'USD' || normTo === 'دولار') converted = parsedUSD;
  
  // بالنسبة للريال السعودي والدولار: التقريب لعشرة فقط (أقرب خانة عشرية واحدة 0.1)
  if (normTo === 'SAR' || normTo === 'ريال سعودي' || normTo === 'USD' || normTo === 'دولار') {
    const rounded = Math.round(converted * 10) / 10;
    return rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
  
  // بالنسبة للريال اليمني: لا يتم عرض التقريب لألف في المبالغ ولا حرف k، بل يُعرض المبلغ كاملاً بالأصفار العادية
  return Math.round(converted).toLocaleString();
}

export function convertAndRound(amount: number | undefined | null, fromCurrency: Currency | string | undefined | null, toCurrency: Currency | string | undefined | null, rates: ExchangeRates): number {
  const converted = convertCurrency(amount, fromCurrency, toCurrency, rates);
  const normTo = (!toCurrency || toCurrency === 'YER' || toCurrency === 'ريال يمني') ? 'RY' : toCurrency;
  if (normTo === 'SAR' || normTo === 'ريال سعودي' || normTo === 'USD' || normTo === 'دولار') {
    return Math.round(converted * 10) / 10;
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
