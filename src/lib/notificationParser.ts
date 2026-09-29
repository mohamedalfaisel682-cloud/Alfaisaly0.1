import { NotificationSenderRule } from './voiceSettings';

export interface ParsedFinancialNotification {
  isFinancial: boolean;
  type: 'deposit' | 'transfer';
  sourceEntity?: string;
  rawText: string;
  partyName: string; // Depositor name if deposit, or recipient name if transfer
  amount: number;
  currency: string;
  referenceNumber?: string;
  accountNumber?: string;
  confidence: number;
}

// Convert Arabic & Persian digits to standard western Arabic numerals (0-9)
export function normalizeNumerals(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

// Clean and extract monetary amount from text
export function extractAmount(text: string): { amount: number; currency: string } | null {
  const normalized = normalizeNumerals(text);
  
  // Patterns matching amount with currency or keywords
  // e.g. "مبلغ 25,000 ريال", "مبلغ 50000 ر.ي", "25000 ريال", "1500 SAR", "$500"
  const amountRegexes = [
    /(?:مبلغ|قيمة|بقيمة|قدره|قدرها)\s*[:=]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(ريال(?:\s+يمني|\s+سعودي)?|ر\.ي|ر\.س|سعودي|دولار|\$|RY|SAR|USD)?/i,
    /([0-9]+(?:[\.,][0-9]+)?)\s*(ريال(?:\s+يمني|\s+سعودي)?|ر\.ي|ر\.س|سعودي|دولار|\$|RY|SAR|USD)/i,
    /(?:مبلغ|قيمة|بقيمة)\s*[:=]?\s*([0-9]+(?:[\.,][0-9]+)?)/i
  ];

  for (const regex of amountRegexes) {
    const match = normalized.match(regex);
    if (match) {
      let rawNum = match[1].replace(/,/g, '');
      const parsed = parseFloat(rawNum);
      if (!isNaN(parsed) && parsed > 0) {
        let curr = (match[2] || '').trim();
        if (/سعودي|ر\.س|SAR/i.test(curr)) {
          curr = 'SAR';
        } else if (/دولار|\$|USD/i.test(curr)) {
          curr = 'USD';
        } else {
          curr = 'RY';
        }
        return { amount: parsed, currency: curr };
      }
    }
  }

  // Fallback: search for any lone standalone number that looks like a monetary amount (> 100)
  const standaloneMatch = normalized.match(/\b([1-9][0-9]{2,8})\b/);
  if (standaloneMatch) {
    const parsed = parseFloat(standaloneMatch[1]);
    if (!isNaN(parsed) && parsed > 0) {
      return { amount: parsed, currency: 'RY' };
    }
  }

  return null;
}

// Clean party name (removes common filler words, colons, slashes)
function cleanPartyName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/^[\s/:،,-]+|[\s/:،,-]+$/g, '')
    .replace(/^(?:السيد|الأخ|العميل|المودع|المستلم|صالح|لصالح|إلى|من|لك)\s+/g, '')
    .replace(/\s+(?:مبلغ|بحساب|لحساب|في\s+حساب|رقم|برقم|بتاريخ|عبر|من\s+حساب|إلى\s+حساب).*$/g, '')
    .trim();
  return cleaned;
}

/**
 * Main parser: Analyzes message to see if it matches financial notifications:
 * 1. Starts with "أودع" (Deposit -> Suggest Income for Customer / Account / Inventory)
 * 2. Starts with "تم تحويل" (Transfer -> Suggest Expense for Account / Customer)
 */
export function parseFinancialNotification(
  rawText: string,
  allowedSenders: NotificationSenderRule[] = []
): ParsedFinancialNotification | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const trimmed = rawText.trim();
  const normalized = normalizeNumerals(trimmed);

  // Check if any registered sender is mentioned in the message or prefix
  let detectedSender: string | undefined = undefined;
  const activeSenders = allowedSenders.filter(s => s.enabled);

  for (const sender of activeSenders) {
    const senderPattern = new RegExp(`(?:^|\\s|\\[|\\(|:)${sender.name}(?:$|\\s|\\]|\\)|:)`, 'i');
    if (senderPattern.test(trimmed)) {
      detectedSender = sender.name;
      break;
    }
  }

  // CASE 1: DEPOSIT - Starts with "أودع" or contains "تم إيداع" / "حوالة واردة"
  // User Requirement: "والتي تبدأ بكلمة أودع/يليه اسم المودع حيث يقترح اضافة المبلغ ك ايراد لعميل او حساب او مخزون"
  const isDepositPattern = /(?:^|\n)\s*(?:\[[^\]]+\]\s*:?\s*)?(?:أودع|اودع|تم\s+إيداع|تم\s+ايداع|إيداع|ايداع|حوالة\s+واردة|وصلتك\s+حوالة)/i.test(normalized);

  if (isDepositPattern) {
    let rawDepositor = '';
    
    // Check "أودع [الاسم] مبلغ" or "أودع/[الاسم]" or "أودع لك [الاسم]"
    const depositMatch1 = normalized.match(/(?:أودع|اودع)(?:\s*\/|\s*:\s*|\s+لك\s+|\s+)?([^\d\n,،\r\t]+?)(?=\s+(?:مبلغ|بحساب|لحساب|في\s+حساب|برقم|\d)|$)/i);
    if (depositMatch1) {
      rawDepositor = depositMatch1[1];
    } else {
      // Check "تم إيداع ... من [الاسم]" or "من [الاسم]" or "حوالة واردة من [الاسم]"
      const fromMatch = normalized.match(/(?:من|بواسطة|عبر|المودع)\s+([^\d\n,،\r\t]+?)(?=\s+(?:مبلغ|بحساب|لحساب|في\s+حساب|برقم|\d)|$)/i);
      if (fromMatch) {
        rawDepositor = fromMatch[1];
      } else {
        const fallbackMatch = normalized.match(/(?:تم\s+إيداع|تم\s+ايداع|إيداع|ايداع)\s+(?:مبلغ\s+[0-9.,]+\s*\S*\s+)?(?:من\s+)?([^\d\n,،\r\t]+?)(?=\s+(?:مبلغ|بحساب|لحساب|في\s+حساب|\d)|$)/i);
        if (fallbackMatch) {
          rawDepositor = fallbackMatch[1];
        }
      }
    }

    const depositorName = cleanPartyName(rawDepositor) || 'مودع غير محدد';
    const amountData = extractAmount(normalized);

    // Extract reference number or account number if present
    const refMatch = normalized.match(/(?:مرجع|رقم\s+العملية|حوالة\s+رقم|إشعار\s+رقم|رقم\s+الحساب|حساب\s+رقم|رقم)\s*[:=]?\s*([0-9A-Za-z_-]{4,20})/i);
    const refNumber = refMatch ? refMatch[1] : undefined;

    const accMatch = normalized.match(/(?:حساب\s+رقم|إلى\s+حساب|بحساب)\s*[:=]?\s*([0-9]{4,16})/i);
    const accNumber = accMatch ? accMatch[1] : undefined;

    return {
      isFinancial: true,
      type: 'deposit',
      sourceEntity: detectedSender,
      rawText: trimmed,
      partyName: depositorName,
      amount: amountData ? amountData.amount : 0,
      currency: amountData ? amountData.currency : 'RY',
      referenceNumber: refNumber,
      accountNumber: accNumber,
      confidence: amountData && depositorName !== 'مودع غير محدد' ? 0.95 : 0.75
    };
  }

  // CASE 2: TRANSFER - Starts with "تم تحويل"
  // User Requirement: "اما الرسائل التي تبدا بكلمة تم تحويل اريد منه اعطائي اقتراح انشاء مصروف لحساب او عميل"
  const isTransferPattern = /(?:^|\n)\s*(?:\[[^\]]+\]\s*:?\s*)?(?:تم\s+تحويل|تحويل|حوالة\s+صادرة|تم\s+خصم|سحب\s+نقدي)/i.test(normalized);

  if (isTransferPattern) {
    // Extract recipient party name (e.g. "تم تحويل مبلغ ... إلى [اسم المستلم]" or "تم تحويل إلى [اسم] مبلغ ...")
    let recipientName = '';
    const toMatch1 = normalized.match(/(?:إلى|لصالح|لـ|للعميل|للمورد|المستلم)\s+([^\d\n,،\r\t]+?)(?=\s+(?:مبلغ|بحساب|لحساب|في\s+حساب|برقم|\d)|$)/i);
    if (toMatch1) {
      recipientName = cleanPartyName(toMatch1[1]);
    }

    if (!recipientName) {
      const toMatch2 = normalized.match(/(?:تم\s+تحويل|تحويل)\s+(?:إلى|لـ)?\s*([^\d\n,،\r\t]+?)(?=\s+(?:مبلغ|\d)|$)/i);
      if (toMatch2) {
        recipientName = cleanPartyName(toMatch2[1]);
      }
    }

    const finalRecipient = recipientName || 'مستلم / جهة تحويل';
    const amountData = extractAmount(normalized);

    const refMatch = normalized.match(/(?:مرجع|رقم\s+العملية|حوالة\s+رقم|إشعار\s+رقم|رقم\s+الحساب|حساب\s+رقم|رقم)\s*[:=]?\s*([0-9A-Za-z_-]{4,20})/i);
    const refNumber = refMatch ? refMatch[1] : undefined;

    return {
      isFinancial: true,
      type: 'transfer',
      sourceEntity: detectedSender,
      rawText: trimmed,
      partyName: finalRecipient,
      amount: amountData ? amountData.amount : 0,
      currency: amountData ? amountData.currency : 'RY',
      referenceNumber: refNumber,
      confidence: amountData ? 0.95 : 0.75
    };
  }

  return null;
}
