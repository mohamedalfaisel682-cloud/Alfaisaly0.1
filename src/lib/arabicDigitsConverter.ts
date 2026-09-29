/**
 * Universal Arabic / Hindi Digits Converter for Al-Faisali Maintenance System
 * Automatically converts Eastern Arabic / Hindi numerals (٠١٢٣٤٥٦٧٨٩) and Persian/Indian variants
 * to standard digits (0123456789) across all inputs, searches, pins, costs, and text areas.
 * Optimized specifically for Android (Samsung Keyboard, Gboard) & WebViews.
 */

export const HINDI_DIGITS_MAP: Record<string, string> = {
  // Eastern Arabic numerals (الأرقام الهندية / العربية المشرقية)
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  // Persian / Urdu numerals (الأرقام الفارسية والأردية)
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  // Indian / Devanagari numerals
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  // Arabic decimal comma / separator
  '٫': '.',
  '٬': '.',
  '،': '.'
};

export const HAS_HINDI_DIGITS_REGEX = /[٠-٩۰-۹०-९٫٬،]/;
export const HINDI_DIGITS_GLOBAL_REGEX = /[٠-٩۰-۹०-९٫٬،]/g;

/**
 * Converts any Eastern Arabic / Hindi digits to standard 0-9 digits.
 */
export function toStandardDigits(input: any): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  if (!HAS_HINDI_DIGITS_REGEX.test(str)) return str;
  return str.replace(HINDI_DIGITS_GLOBAL_REGEX, (ch) => {
    return HINDI_DIGITS_MAP[ch] !== undefined ? HINDI_DIGITS_MAP[ch] : ch;
  });
}

/**
 * Converts any input containing digits (Arabic, Hindi, Persian) or decimal separators
 * to a clean standard numeric string (e.g. "123.45").
 */
export function toStandardNumericString(input: any): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  str = toStandardDigits(str);
  // Replace any Arabic commas or standard commas with dots for decimal parsing
  str = str.replace(/[,،٫]/g, '.');
  // Strip characters except digits, minus, dot
  str = str.replace(/[^0-9.-]/g, '');
  // Keep only first minus sign at start and first dot
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts[0] + '.' + parts.slice(1).join('');
  }
  return str;
}

/**
 * Checks if a string contains any Hindi / Eastern Arabic numerals.
 */
export function hasHindiDigits(input: any): boolean {
  if (!input) return false;
  return HAS_HINDI_DIGITS_REGEX.test(String(input));
}

/**
 * Safe parseFloat that converts Hindi digits and Arabic decimal separators before parsing.
 */
export function safeParseFloat(input: any, fallback: number = 0): number {
  if (input === null || input === undefined || input === '') return fallback;
  if (typeof input === 'number') return isNaN(input) ? fallback : input;
  const normalized = toStandardNumericString(input);
  const num = parseFloat(normalized);
  return isNaN(num) ? fallback : num;
}

/**
 * Safe parseInt that converts Hindi digits before parsing.
 */
export function safeParseInt(input: any, fallback: number = 0, radix: number = 10): number {
  if (input === null || input === undefined || input === '') return fallback;
  if (typeof input === 'number') return isNaN(input) ? fallback : Math.trunc(input);
  const normalized = toStandardNumericString(input);
  const num = parseInt(normalized, radix);
  return isNaN(num) ? fallback : num;
}

let isGlobalConverterInitialized = false;

/**
 * Initializes global event listeners to seamlessly convert Hindi numerals
 * upon typing or pasting in ANY input or textarea element across the app.
 */
export function initGlobalHindiDigitsConverter(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (isGlobalConverterInitialized) {
    return () => {};
  }
  isGlobalConverterInitialized = true;

  // 0. Automatically change type="number" to text with inputMode="decimal" on focus
  // so native mobile keyboards (Android 13 / Samsung / Gboard) don't drop Arabic digits
  const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLInputElement | null;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
      try {
        target.dataset.isConvertedNumber = 'true';
        target.type = 'text';
        target.inputMode = 'decimal';
      } catch (err) {}
    }
  };

  // Convert all type="number" inputs in document on load or DOM updates
  const convertNumberInputs = () => {
    try {
      const numberInputs = document.querySelectorAll('input[type="number"]');
      numberInputs.forEach((inp) => {
        const target = inp as HTMLInputElement;
        target.type = 'text';
        target.inputMode = 'decimal';
        target.dataset.isConvertedNumber = 'true';
      });
    } catch (e) {}
  };

  convertNumberInputs();
  const observer = new MutationObserver(() => {
    convertNumberInputs();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  // 1. Intercept beforeinput to allow standard conversion BEFORE browser validation
  const handleBeforeInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    if (target.readOnly || target.disabled) return;

    const data = e.data;
    if (data && HAS_HINDI_DIGITS_REGEX.test(data)) {
      e.preventDefault();
      const converted = toStandardDigits(data);

      let success = false;
      try {
        success = document.execCommand('insertText', false, converted);
      } catch (err) {
        success = false;
      }

      if (!success) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const oldVal = target.value;
        const newVal = oldVal.slice(0, start) + converted + oldVal.slice(end);

        target.value = newVal;
        const newPos = start + converted.length;
        try {
          target.setSelectionRange(newPos, newPos);
        } catch (err) {}

        const tracker = (target as any)._valueTracker;
        if (tracker) tracker.setValue(oldVal);

        const inputEvt = new Event('input', { bubbles: true, cancelable: true });
        target.dispatchEvent(inputEvt);
      }
    }
  };

  // 2. Intercept input event (capture phase) to guarantee normalization for any remaining cases
  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;

    const rawValue = target.value;
    if (rawValue && HAS_HINDI_DIGITS_REGEX.test(rawValue)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const converted = toStandardDigits(rawValue);

      target.value = converted;
      try {
        if (start !== null && end !== null) {
          target.setSelectionRange(start, end);
        }
      } catch (err) {}

      const tracker = (target as any)._valueTracker;
      if (tracker) tracker.setValue(rawValue);

      // Trigger change notification for React form controllers
      const inputEvt = new Event('input', { bubbles: true });
      target.dispatchEvent(inputEvt);
    }
  };

  // 3. Intercept paste event to convert clipboard text containing Hindi numbers
  const handlePaste = (e: ClipboardEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    if (target.readOnly || target.disabled) return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    if (pastedText && HAS_HINDI_DIGITS_REGEX.test(pastedText)) {
      e.preventDefault();
      const converted = toStandardDigits(pastedText);

      let success = false;
      try {
        success = document.execCommand('insertText', false, converted);
      } catch (err) {
        success = false;
      }

      if (!success) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const oldVal = target.value;
        const newVal = oldVal.slice(0, start) + converted + oldVal.slice(end);

        target.value = newVal;
        const newPos = start + converted.length;
        try {
          target.setSelectionRange(newPos, newPos);
        } catch (err) {}

        const tracker = (target as any)._valueTracker;
        if (tracker) tracker.setValue(oldVal);

        const inputEvt = new Event('input', { bubbles: true, cancelable: true });
        target.dispatchEvent(inputEvt);
      }
    }
  };

  // 4. Intercept keydown for number inputs where keys might be Hindi digits
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key && e.key.length === 1 && HAS_HINDI_DIGITS_REGEX.test(e.key)) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
      if (target.readOnly || target.disabled) return;

      e.preventDefault();
      const std = toStandardDigits(e.key);
      try {
        document.execCommand('insertText', false, std);
      } catch (err) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const oldVal = target.value;
        target.value = oldVal.slice(0, start) + std + oldVal.slice(end);
        const newPos = start + std.length;
        try { target.setSelectionRange(newPos, newPos); } catch (e) {}
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  // Register listeners on document in capture phase
  document.addEventListener('focusin', handleFocus as any, true);
  document.addEventListener('beforeinput', handleBeforeInput as any, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('paste', handlePaste, true);
  document.addEventListener('keydown', handleKeyDown, true);

  return () => {
    try { observer.disconnect(); } catch (e) {}
    document.removeEventListener('focusin', handleFocus as any, true);
    document.removeEventListener('beforeinput', handleBeforeInput as any, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('paste', handlePaste, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    isGlobalConverterInitialized = false;
  };
}
