/**
 * Arabic spoken words to number parser.
 * Supports spoken Arabic numbers, colloquial dialects (مية, الفين, نص, ميتين, etc.),
 * compound numbers (خمسة آلاف وخمسمائة وخمسين), and cleaning financial strings.
 */

const DIGIT_MAP: Record<string, string> = {
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
  '٫': '.'
};

export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩۰-۹०-९٫]/g, (d) => DIGIT_MAP[d] || d);
}

const ONES: Record<string, number> = {
  'صفر': 0, 'واحد': 1, 'واحده': 1, 'واحدة': 1, 'أحد': 1, 'احد': 1,
  'إثنين': 2, 'اثنين': 2, 'إثنان': 2, 'اثنان': 2, 'ثنتين': 2, 'اثنتين': 2,
  'ثلاثة': 3, 'ثلاثه': 3, 'ثلاث': 3,
  'أربعة': 4, 'اربعه': 4, 'أربع': 4, 'اربع': 4,
  'خمسة': 5, 'خمسه': 5, 'خمس': 5,
  'ستة': 6, 'سته': 6, 'ست': 6,
  'سبعة': 7, 'سبعه': 7, 'سبع': 7,
  'ثمانية': 8, 'ثمانيه': 8, 'ثمان': 8, 'تمانية': 8, 'تمنية': 8,
  'تسعة': 9, 'تسعه': 9, 'تسع': 9,
  'عشرة': 10, 'عشره': 10, 'عشر': 10
};

const TEENS: Record<string, number> = {
  'إحدى عشر': 11, 'احدى عشر': 11, 'أحد عشر': 11, 'احد عشر': 11, 'حداش': 11, 'احداعش': 11,
  'إثنا عشر': 12, 'اثنا عشر': 12, 'إثني عشر': 12, 'اثني عشر': 12, 'اثنعش': 12, 'تناش': 12,
  'ثلاثة عشر': 13, 'ثلاثه عشر': 13, 'ثلاث عشر': 13, 'تلاتاش': 13, 'ثلطاش': 13,
  'أربعة عشر': 14, 'اربعه عشر': 14, 'اربع عشر': 14, 'اربعتاش': 14,
  'خمسة عشر': 15, 'خمسه عشر': 15, 'خمس عشر': 15, 'خمسطاش': 15,
  'ستة عشر': 16, 'سته عشر': 16, 'ست عشر': 16, 'سطاش': 16,
  'سبعة عشر': 17, 'سبعه عشر': 17, 'سبع عشر': 17, 'سبعطاش': 17,
  'ثمانية عشر': 18, 'ثمانيه عشر': 18, 'ثمان عشر': 18, 'تمنطاش': 18,
  'تسعة عشر': 19, 'تسعه عشر': 19, 'تسع عشر': 19, 'تسعطاش': 19
};

const TENS: Record<string, number> = {
  'عشرون': 20, 'عشرين': 20,
  'ثلاثون': 30, 'ثلاثين': 30, 'تلاتين': 30,
  'أربعون': 40, 'اربعون': 40, 'أربعين': 40, 'اربعين': 40,
  'خمسون': 50, 'خمسين': 50,
  'ستون': 60, 'ستين': 60,
  'سبعون': 70, 'سبعين': 70,
  'ثمانون': 80, 'ثمانين': 80, 'تمنين': 80,
  'تسعون': 90, 'تسعين': 90
};

const HUNDREDS: Record<string, number> = {
  'مئة': 100, 'مائة': 100, 'ميه': 100, 'مية': 100,
  'مئتان': 200, 'مئتين': 200, 'مائتان': 200, 'مائتين': 200, 'ميتين': 200,
  'ثلاثمائة': 300, 'ثلاثمئة': 300, 'ثلاثمية': 300, 'تلاتمية': 300,
  'أربعمائة': 400, 'اربعمائة': 400, 'أربعمئة': 400, 'اربعمئة': 400, 'اربعمية': 400,
  'خمسمائة': 500, 'خمسمئة': 500, 'خمسمية': 500,
  'ستمائة': 600, 'ستمئة': 600, 'ستمية': 600,
  'سبعمائة': 700, 'سبعمئة': 700, 'سبعمية': 700,
  'ثمانمائة': 800, 'ثمانمئة': 800, 'ثمانمية': 800, 'تمنمية': 800,
  'تسعمائة': 900, 'تسعمئة': 900, 'تسعمية': 900
};

const FRACTIONS: Record<string, number> = {
  'نصف': 0.5, 'نص': 0.5,
  'ربع': 0.25,
  'ثلاثة أرباع': 0.75, 'تلات تربع': 0.75
};

/**
 * Extracts and parses financial amounts from spoken text.
 * Returns a clean numeric string (e.g. "5000", "150.5") or original text if not parsable.
 */
export function parseArabicSpeechToNumber(input: string): string {
  if (!input || !input.trim()) return '';

  let text = input.trim();
  text = normalizeArabicDigits(text);

  // If text contains digits directly (e.g. "450" or "المبلغ 1200 ريال")
  const digitMatch = text.match(/\d+(?:\.\d+)?/);
  // Check if text is mostly digits or contains digits
  if (digitMatch && (text.replace(/[^\d.]/g, '').length >= 1)) {
    // If the input was just a number like "150" or "150 ريال"
    const wordsWithoutNumber = text.replace(/[\d.]+/g, '').replace(/(ريال|سعودي|يمني|دولار|درهم|جنيه|دينار|حساب|مبلغ|تكلفة|واصل|باقي|فقط|لاغير)/g, '').trim();
    if (wordsWithoutNumber.length <= 3) {
      return digitMatch[0];
    }
  }

  // Remove common currency and conversational words
  const cleanTokens = text
    .replace(/[،,]/g, ' ')
    .replace(/(ريال|سعودي|يمني|دولار|درهم|جنيه|دينار|حساب|مبلغ|تكلفة|تكلفه|واصل|باقي|دفع|دفعة|دفعه|فقط|لاغير|الف|ألف|آلاف)/gi, (m) => {
      if (m === 'الف' || m === 'ألف' || m === 'آلاف') return m;
      return ' ';
    })
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  let total = 0;
  let currentThousands = 0;
  let currentGroup = 0;
  let hasParsedAny = false;

  for (let i = 0; i < cleanTokens.length; i++) {
    let token = cleanTokens[i];

    // Remove leading 'و' conjunction (e.g. "وخمسمائة" -> "خمسمائة")
    if (token.startsWith('و') && token.length > 2) {
      const stripped = token.substring(1);
      if (
        ONES[stripped] !== undefined ||
        TENS[stripped] !== undefined ||
        HUNDREDS[stripped] !== undefined ||
        FRACTIONS[stripped] !== undefined ||
        stripped === 'الف' || stripped === 'ألف' || stripped === 'الفين' || stripped === 'ألفين' ||
        stripped === 'مليون' || stripped === 'مليونين' || stripped === 'ملايين'
      ) {
        token = stripped;
      }
    }

    // Check fractions
    if (FRACTIONS[token] !== undefined) {
      currentGroup += FRACTIONS[token];
      hasParsedAny = true;
      continue;
    }

    // Direct digit
    if (/^\d+(\.\d+)?$/.test(token)) {
      currentGroup += parseFloat(token);
      hasParsedAny = true;
      continue;
    }

    // Check millions
    if (token === 'مليون' || token === 'المليون') {
      const mult = currentGroup || 1;
      total += mult * 1000000;
      currentGroup = 0;
      hasParsedAny = true;
      continue;
    }
    if (token === 'مليونين' || token === 'مليونان') {
      total += 2000000;
      currentGroup = 0;
      hasParsedAny = true;
      continue;
    }
    if (token === 'ملايين') {
      const mult = currentGroup || 3;
      total += mult * 1000000;
      currentGroup = 0;
      hasParsedAny = true;
      continue;
    }

    // Check thousands
    if (token === 'ألفين' || token === 'الفين' || token === 'ألفان' || token === 'الفان') {
      currentThousands = 2000;
      total += currentThousands;
      currentThousands = 0;
      hasParsedAny = true;
      continue;
    }
    if (token === 'ألف' || token === 'الف' || token === 'آلاف' || token === 'الاف') {
      const mult = currentGroup || 1;
      total += mult * 1000;
      currentGroup = 0;
      hasParsedAny = true;
      continue;
    }

    // Check hundreds
    if (HUNDREDS[token] !== undefined) {
      currentGroup += HUNDREDS[token];
      hasParsedAny = true;
      continue;
    }

    // Check teens (two words or single word)
    const twoWordToken = i + 1 < cleanTokens.length ? `${token} ${cleanTokens[i + 1]}` : '';
    if (twoWordToken && TEENS[twoWordToken] !== undefined) {
      currentGroup += TEENS[twoWordToken];
      hasParsedAny = true;
      i++;
      continue;
    }
    if (TEENS[token] !== undefined) {
      currentGroup += TEENS[token];
      hasParsedAny = true;
      continue;
    }

    // Check tens
    if (TENS[token] !== undefined) {
      currentGroup += TENS[token];
      hasParsedAny = true;
      continue;
    }

    // Check ones
    if (ONES[token] !== undefined) {
      currentGroup += ONES[token];
      hasParsedAny = true;
      continue;
    }
  }

  total += currentGroup;

  if (hasParsedAny && total > 0) {
    // If it has decimal places, format cleanly
    return total % 1 === 0 ? total.toString() : total.toFixed(2).replace(/\.?0+$/, '');
  }

  // Fallback: search for any standalone numbers
  const finalDigits = normalizeArabicDigits(input).replace(/[^\d.]/g, '');
  if (finalDigits) return finalDigits;

  return input.trim();
}
