import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * محرك التغذية اللمسية التفاعلية (Haptic Feedback) المخصص لشاشة سامسونج نوت 20 ألترا وبيئة أندرويد 13
 * يوفر اهتزازات لمسية حركية رشيقة واحترافية للمستخدم عند النقر على الأزرار والاختصارات مع توافق الويب.
 */

// فحص سريع إذا كانت التغذية اللمسية مفعلة
let isHapticsEnabled = true;

try {
  const stored = localStorage.getItem('app_haptics_enabled');
  if (stored !== null) {
    isHapticsEnabled = stored !== 'false';
  }
} catch {
  isHapticsEnabled = true;
}

export const setHapticsEnabled = (enabled: boolean) => {
  isHapticsEnabled = enabled;
  try {
    localStorage.setItem('app_haptics_enabled', String(enabled));
  } catch {}
};

export const getHapticsEnabled = (): boolean => isHapticsEnabled;

/**
 * اهتزاز خفيف وناعم (Light Impact)
 * مثالي للنقر على الاختصارات، التبديل بين التبويبات، واختيار الحسابات
 */
export const hapticLight = async () => {
  if (!isHapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // تجاوز أي حظر في المتصفحات
  }
};

/**
 * اهتزاز متوسط (Medium Impact)
 * مثالي لتغيير حالة المهمة، التبديل في الواجهة الفلاشية، أو فتح النوافذ
 */
export const hapticMedium = async () => {
  if (!isHapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(22);
    }
  } catch {}
};

/**
 * إشعار بنجاح العملية (Success Notification)
 * نمط اهتزاز مزدوج ناعم عند حفظ السندات، تحديث المهام، إتمام الإقفال المالي، أو النسخ الاحتياطي
 */
export const hapticSuccess = async () => {
  if (!isHapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 40, 25]);
    }
  } catch {}
};

/**
 * إشعار تحذيري (Warning Notification)
 * عند حذف سند أو تأكيد عملية حساسة
 */
export const hapticWarning = async () => {
  if (!isHapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([35, 50, 35]);
    }
  } catch {}
};
