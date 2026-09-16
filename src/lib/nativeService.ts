import { speakImportantNotification } from './ttsService';
// src/lib/nativeService.ts

import { Capacitor } from '@capacitor/core';




export const isNativeApp = () => {
  return (
    Capacitor.isNativePlatform() ||
    typeof (window as any).AndroidInterface !== 'undefined' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
};

/**
 * Returns the resolved API base URL or path, avoiding localhost origin failures on Android WebViews.
 */
export const getApiUrl = (endpoint: string, customServerUrl?: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If custom backend server URL is configured
  const configuredBase = customServerUrl || import.meta.env.VITE_API_BASE_URL || '';
  if (configuredBase) {
    const base = configuredBase.endsWith('/') ? configuredBase.slice(0, -1) : configuredBase;
    return `${base}${cleanEndpoint}`;
  }

  // On standard Web (HTTP/HTTPS with port or domain)
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost') {
    return cleanEndpoint;
  }

  // If running locally in dev server or Express
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return cleanEndpoint;
  }

  // Fallback for Android Native WebView
  return cleanEndpoint;
};

/**
 * Safely opens an external OAuth URL in the default system browser on Android.
 */
export const openExternalUrlNative = (url: string) => {
  if (typeof (window as any).AndroidInterface !== 'undefined' && (window as any).AndroidInterface.openExternalUrl) {
    (window as any).AndroidInterface.openExternalUrl(url);
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Native Android 1-click Backup & Save to Google Drive / Files app sheet.
 */
export const exportBackupToAndroidNativeDrive = async (jsonContent: string, fileName: string = 'Alfaisaly_Backup.json'): Promise<boolean> => {
  try {
    if ((window as any).AndroidInterface) {
       const base64Data = btoa(unescape(encodeURIComponent(jsonContent)));
       if ((window as any).AndroidInterface.backupToGoogleDriveDirect) {
           (window as any).AndroidInterface.backupToGoogleDriveDirect(base64Data, fileName);
           return true;
       } else if ((window as any).AndroidInterface.saveToDrive) {
           (window as any).AndroidInterface.saveToDrive(base64Data, fileName);
           return true;
       } else if ((window as any).AndroidInterface.saveFileAndShare) {
           (window as any).AndroidInterface.saveFileAndShare(base64Data, fileName);
           return true;
       } else if ((window as any).AndroidInterface.saveFile) {
           (window as any).AndroidInterface.saveFile(base64Data, fileName);
           return true;
       }
    }

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });

    // On mobile Android (like Note 20 Ultra) in Chrome / Samsung Internet:
    // Web Share API lets user pick Google Drive / My Files directly!
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: 'نسخة احتياطية لتطبيق الفيصلي - حفظ في Google Drive أو ذاكرة الجهاز'
          });
          return true;
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return true;
        console.warn('Share to drive failed, falling back to downloadBlob:', e);
      }
    }

    return await downloadBlob(blob, fileName);
  } catch (err) {
    console.error('Failed native drive backup export:', err);
    return false;
  }
};

export const downloadBlob = async (blob: Blob, fileName: string): Promise<boolean> => {
  // 1. Support Custom AndroidInterface save and share capability
  if ((window as any).AndroidInterface) {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (base64Data) {
        if ((window as any).AndroidInterface.saveFileAndShare) {
          (window as any).AndroidInterface.saveFileAndShare(base64Data, fileName);
          return true;
        } else if ((window as any).AndroidInterface.saveFile) {
          (window as any).AndroidInterface.saveFile(base64Data, fileName);
          return true;
        }
      }
    } catch (err) {
      console.error('Custom AndroidInterface print/save error:', err);
    }
  }

  // 2. Support Capacitor native app platform ONLY if truly running on native platform
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (!base64Data) {
         throw new Error("Base64 string is empty");
      }

      // Write file to device Documents folder directly
      await (await import('@capacitor/filesystem')).Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: (await import('@capacitor/filesystem')).Directory.Documents,
      });

      // Also trigger browser/device download trigger for notifications and download history
      fallbackDownload(blob, fileName);
      return true;
    } catch (e) {
      console.error('Native download/save error:', e);
      return fallbackDownload(blob, fileName);
    }
  } else {
    return fallbackDownload(blob, fileName);
  }
};

export const fallbackDownload = (blob: Blob, fileName: string): boolean => {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {}
    }, 3000);
    return true;
  } catch (error) {
    console.warn('Standard download link failed, attempting Data-URI fallback:', error);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try { document.body.removeChild(link); } catch {}
        }, 3000);
      };
      reader.readAsDataURL(blob);
      return true;
    } catch (err2) {
      console.error('All fallback download methods failed:', err2);
      return false;
    }
  }
};

export const requestNotificationPermission = async () => {
  if (isNativeApp()) {
    try {
      const result = await (await import('@capacitor/local-notifications')).LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (e) {
      console.error('Capacitor notifications permission error', e);
      return false;
    }
  } else if ('Notification' in window) {
    if (Notification.permission === 'granted') return true;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      return false;
    }
  }
  return false;
};

export const showNotificationNative = async (title: string, message: string, date?: Date, id?: number) => {
  if (!date || date <= new Date()) {
    speakImportantNotification(title, message);
  }
  if (isNativeApp()) {
    try {
      const notificationId = id || Math.floor(Math.random() * 1000000) + 1;
      const LocalNotifications = (await import('@capacitor/local-notifications')).LocalNotifications;

      // Create a high-importance channel for Android to ensure it wakes the screen and makes a sound
      try {
        await LocalNotifications.createChannel({
          id: 'maintenance_alerts',
          name: 'Maintenance Alerts',
          description: 'Notifications for maintenance tasks and alarms',
          importance: 5, // 5 = High importance (makes sound and pops on screen)
          visibility: 1, // 1 = Public (shows on lock screen)
          vibration: true,
        });
      } catch (channelErr) {
        console.warn('Could not create notification channel', channelErr);
      }
      
      // If the date is in the past, or undefined, show immediately
      const scheduleOptions = date && date > new Date() 
        ? { at: date, allowWhileIdle: true } 
        : { at: new Date(Date.now() + 100), allowWhileIdle: true };
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: message,
            id: notificationId,
            schedule: scheduleOptions,
            channelId: 'maintenance_alerts', // Use the high-importance channel
            actionTypeId: '',
            extra: null
          }
        ]
      });
      return true;
    } catch (e) {
      console.error("Native notification failed", e);
      return false;
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // For Web, we can't easily schedule using OS, so we ignore future schedules
    // The web app handles this with its setInterval anyway
    if (!date || date <= new Date()) {
      try {
        new Notification(title, { body: message });
        return true;
      } catch (e) {
        console.warn('Web notification failed', e);
        return false;
      }
    }
  }
  return false;
};

export const cancelNativeNotification = async (id: number) => {
  if (isNativeApp()) {
    try {
      await (await import('@capacitor/local-notifications')).LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (e) {
      console.error("Cancel notification failed", e);
    }
  }
};

/**
 * Triggers native file picker via AndroidInterface if available.
 * Resolves with a base64 string or file path depending on implementation.
 */
export const pickFileNative = (accept: string = '*/*'): Promise<string | null> => {
  return new Promise((resolve) => {
    if ((window as any).AndroidInterface && (window as any).AndroidInterface.pickFile) {
      (window as any).onFilePicked = (base64Data: string) => {
        resolve(base64Data);
      };
      try {
        (window as any).AndroidInterface.pickFile(accept);
      } catch (e) {
        resolve(null);
      }
    } else {
      // Fallback: Web standard file picker is expected to be handled via <input type="file">
      resolve(null);
    }
  });
};

/**
 * Triggers native image picker via AndroidInterface if available.
 */
export const pickImageNative = (): Promise<string | null> => {
  return pickFileNative('image/*');
};

export const shareTextNative = async (text: string, title: string = 'مشاركة التقرير') => {
  if (isNativeApp()) {
    try {
      await (await import('@capacitor/share')).Share.share({
        title,
        text,
        dialogTitle: title,
      });
      return true;
    } catch (e) {
      console.error('Native text share error:', e);
      return false;
    }
  } else {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
        });
        return true;
      } catch (e) {
        console.error('Web share API error:', e);
        return false;
      }
    } else {
      // Fallback
      await navigator.clipboard.writeText(text);
      alert('تم نسخ النص إلى الحافظة لعدم دعم المتصفح لواجهة المشاركة');
      return true;
    }
  }
};

/**
 * Android 13 (Galaxy Note 20 Ultra) Floating Overlay & Background Standby Service
 */
export const requestOverlayPermission = async (): Promise<boolean> => {
  try {
    if ((window as any).AndroidInterface && (window as any).AndroidInterface.requestOverlayPermission) {
      return !!(window as any).AndroidInterface.requestOverlayPermission();
    }
    // On native Capacitor, trigger intent to ACTION_MANAGE_OVERLAY_PERMISSION
    if (Capacitor.isNativePlatform()) {
      try {
        const App = (await import('@capacitor/app')).App;
        // Broadcast custom event or intent if available
        return true;
      } catch (e) {
        console.warn('Capacitor overlay permission intent failed:', e);
      }
    }
    return true;
  } catch (err) {
    console.warn('Overlay permission request error:', err);
    return false;
  }
};

export const hasOverlayPermission = (): boolean => {
  if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.hasOverlayPermission === 'function') {
    return !!(window as any).AndroidInterface.hasOverlayPermission();
  }
  return true;
};

/**
 * Open or restore full application window from floating assistant view
 */
export const openFullAppNative = async () => {
  try {
    // 1. AndroidInterface direct hook
    if ((window as any).AndroidInterface && (window as any).AndroidInterface.openFullApp) {
      (window as any).AndroidInterface.openFullApp();
      return;
    }

    // 2. Bring window / app to foreground
    if (typeof window !== 'undefined') {
      window.focus();
      // Notify main app to exit mini/chat-only mode
      window.dispatchEvent(new CustomEvent('open_full_app'));
      window.dispatchEvent(new CustomEvent('restore_app_window'));
    }
  } catch (e) {
    console.warn('Could not restore full app natively:', e);
  }
};

/**
 * Sync floating widget state with native Android background service
 */
export const setFloatingWidgetNativeState = (enabled: boolean) => {
  try {
    if ((window as any).AndroidInterface && (window as any).AndroidInterface.setFloatingWidgetEnabled) {
      (window as any).AndroidInterface.setFloatingWidgetEnabled(enabled);
    }
  } catch (e) {}
};
