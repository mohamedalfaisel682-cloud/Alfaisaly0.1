export type PageSizeFormat = 'mobile' | 'a4' | 'a3' | 'a5' | 'thermal_80' | 'thermal_58' | 'custom';
export type QualityPreset = 'ultra' | 'high' | 'standard' | 'compact';
export type ExportImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type ExportOrientation = 'auto' | 'portrait' | 'landscape';

export interface CustomSizePreset {
  id: string;
  name: string;
  width: number;
  height?: number;
  unit: 'px' | 'mm';
  description?: string;
  isDefault?: boolean;
}

export interface AppExportSettings {
  // Page size & dimensions
  format: PageSizeFormat;
  defaultFormat: PageSizeFormat;
  customSizeId?: string;
  
  // Custom presets list
  customPresets: CustomSizePreset[];

  // Orientation
  orientation: ExportOrientation;

  // Resolution / Scale
  quality: QualityPreset;
  customScale?: number;

  // Image Format & Compression
  imageQuality: number; // 0.7 - 1.0 (default 0.95)
  imageFormat: ExportImageFormat;

  // Mobile specific settings
  mobileWidth: number; // default 1080 (FHD+ Note 20 Ultra width)
  mobilePadding: number; // default 16px

  // Document specific settings
  desktopWidth: number; // default 1240px for A4 landscape tables
  padding: number; // default 24px
  backgroundColor: string; // default '#ffffff'

  // Default templates & formats for Reports
  reportDefaultImageTemplate?: string;
  reportDefaultDocumentTemplate?: string;
  reportDefaultExportType?: 'pdf' | 'image';
  autoSwitchToDefaultOnExport?: boolean;

  // Default templates & formats for Tasks / Receipts
  taskDefaultTemplate?: string;
  taskDefaultImageTemplate?: string;
  taskDefaultDocumentTemplate?: string;
  taskDefaultExportType?: 'pdf' | 'image' | 'print';
  taskPrintMode?: 'all' | 'financial_only' | 'services_only';
  taskFontScale?: 'large' | 'normal' | 'compact';
  taskPageWidth?: 'mobile' | 'desktop' | 'a4';
  taskElements?: string[];
  applyWhatsAppPrefsOnTaskPrint?: boolean;
}

const STORAGE_KEY = 'al_faisali_export_settings_v1';

export const DEFAULT_CUSTOM_PRESETS: CustomSizePreset[] = [
  {
    id: 'preset-insta-story',
    name: 'ستوري / شاشة رأسية (1080 × 1920)',
    width: 1080,
    height: 1920,
    unit: 'px',
    description: 'ملائم للمشاركة في واتساب وحالات التواصل'
  },
  {
    id: 'preset-desktop-fhd',
    name: 'شاشة عريضة Full HD (1920 × 1080)',
    width: 1920,
    height: 1080,
    unit: 'px',
    description: 'ملائم للعرض على شاشات العرض الكبيرة والكمبيوتر'
  },
  {
    id: 'preset-mini-card',
    name: 'بطاقة جيب مدمجة (85 × 55 مم)',
    width: 85,
    height: 55,
    unit: 'mm',
    description: 'حجم بطاقة العمل / كارت الصيانة السريع'
  }
];

export const DEFAULT_EXPORT_SETTINGS: AppExportSettings = {
  format: 'mobile',
  defaultFormat: 'mobile',
  customPresets: DEFAULT_CUSTOM_PRESETS,
  orientation: 'auto',
  quality: 'high', // 2.5x scale (optimal for Note 20 Ultra AMOLED display)
  imageQuality: 0.95,
  imageFormat: 'image/jpeg',
  mobileWidth: 1080,
  mobilePadding: 16,
  desktopWidth: 1240,
  padding: 24,
  backgroundColor: '#ffffff',
  reportDefaultImageTemplate: 'mobile-flow',
  reportDefaultDocumentTemplate: 'unlimited-a4',
  reportDefaultExportType: 'pdf',
  autoSwitchToDefaultOnExport: true,
  taskDefaultTemplate: 'receipt-default',
  taskDefaultImageTemplate: 'receipt-luxury',
  taskDefaultDocumentTemplate: 'receipt-default',
  taskDefaultExportType: 'pdf',
  taskPrintMode: 'all',
  taskFontScale: 'normal',
  taskPageWidth: 'mobile',
  taskElements: ['اسم العميل', 'الهاتف', 'الأجهزة', 'الموديل', 'المشكلة', 'التكلفة', 'المقدم', 'المتبقي', 'الباركود', 'الختم', 'شروط الاستلام'],
  applyWhatsAppPrefsOnTaskPrint: false
};

let cachedSettings: AppExportSettings | null = null;
const listeners = new Set<(settings: AppExportSettings) => void>();

/**
 * Retrieve current export settings from localStorage or defaults
 */
export function getExportSettings(): AppExportSettings {
  if (cachedSettings) return cachedSettings;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = {
        ...DEFAULT_EXPORT_SETTINGS,
        ...parsed,
        customPresets: Array.isArray(parsed.customPresets) && parsed.customPresets.length > 0
          ? parsed.customPresets
          : DEFAULT_CUSTOM_PRESETS
      };
      return cachedSettings!;
    }
  } catch (err) {
    console.warn('Failed to parse export settings from localStorage:', err);
  }

  cachedSettings = { ...DEFAULT_EXPORT_SETTINGS };
  return cachedSettings;
}

/**
 * Save updated export settings to localStorage and notify listeners
 */
export function saveExportSettings(newSettings: Partial<AppExportSettings>): AppExportSettings {
  const current = getExportSettings();
  const updated: AppExportSettings = {
    ...current,
    ...newSettings
  };

  cachedSettings = updated;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to persist export settings to localStorage:', err);
  }

  listeners.forEach(fn => {
    try { fn(updated); } catch (e) {}
  });

  return updated;
}

/**
 * Set a specific format as the default for all future exports
 */
export function setDefaultExportFormat(format: PageSizeFormat, customSizeId?: string): AppExportSettings {
  return saveExportSettings({
    format,
    defaultFormat: format,
    customSizeId: format === 'custom' ? customSizeId : undefined
  });
}

/**
 * Reset export settings to factory defaults (Mobile friendly Note 20 Ultra)
 */
export function resetExportSettings(): AppExportSettings {
  cachedSettings = { ...DEFAULT_EXPORT_SETTINGS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  listeners.forEach(fn => {
    try { fn(DEFAULT_EXPORT_SETTINGS); } catch (e) {}
  });

  return { ...DEFAULT_EXPORT_SETTINGS };
}

/**
 * Add a new custom size preset
 */
export function addCustomSizePreset(preset: Omit<CustomSizePreset, 'id'>): CustomSizePreset {
  const settings = getExportSettings();
  const newPreset: CustomSizePreset = {
    ...preset,
    id: `custom-preset-${Date.now()}`
  };

  const updatedPresets = [...settings.customPresets, newPreset];
  saveExportSettings({
    customPresets: updatedPresets,
    format: 'custom',
    customSizeId: newPreset.id
  });

  return newPreset;
}

/**
 * Remove a custom size preset
 */
export function removeCustomSizePreset(presetId: string): void {
  const settings = getExportSettings();
  const updatedPresets = settings.customPresets.filter(p => p.id !== presetId);
  const nextSettings: Partial<AppExportSettings> = { customPresets: updatedPresets };

  if (settings.customSizeId === presetId) {
    nextSettings.format = settings.defaultFormat !== 'custom' ? settings.defaultFormat : 'mobile';
    nextSettings.customSizeId = undefined;
  }

  saveExportSettings(nextSettings);
}

/**
 * Subscribe to export settings changes
 */
export function subscribeExportSettings(callback: (s: AppExportSettings) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Global trigger to open the export settings modal
 */
export function openExportSettingsModal(): void {
  window.dispatchEvent(new CustomEvent('open-export-settings-modal'));
}

/**
 * Subscribe to the open-export-settings-modal event
 */
export function subscribeExportSettingsModal(callback: (open: boolean) => void): () => void {
  const handler = () => callback(true);
  window.addEventListener('open-export-settings-modal', handler);
  return () => {
    window.removeEventListener('open-export-settings-modal', handler);
  };
}

/**
 * Scale factor calculation from quality preset
 */
export function getScaleFromQuality(quality: QualityPreset, customScale?: number): number {
  if (customScale && customScale > 0) return customScale;
  switch (quality) {
    case 'ultra':
      return 3.0; // 300 DPI equivalent
    case 'high':
      return 2.5; // Optimal for AMOLED / Galaxy Note 20 Ultra
    case 'standard':
      return 1.5; // Fast generation
    case 'compact':
      return 1.0; // Small file size
    default:
      return 2.0;
  }
}

export function resolveExportDimensions(
  settings: AppExportSettings,
  isNarrowReceipt: boolean = false
): {
  minWidth: number;
  padding: number;
  scale: number;
  pdfFormat: any;
  pdfOrientation: 'portrait' | 'landscape' | 'auto';
  label: string;
} {
  const scale = getScaleFromQuality(settings.quality, settings.customScale);
  const format = settings.format;
  if (isNarrowReceipt) {
    return {
      minWidth: format === 'thermal_58' ? 380 : 540,
      padding: 12,
      scale,
      pdfFormat: format === 'thermal_58' ? [58, 200] : [80, 297],
      pdfOrientation: 'portrait',
      label: format === 'thermal_58' ? 'إيصال 58 مم' : 'إيصال 80 مم'
    };
  }
  switch (format) {
    case 'mobile':
      return {
        minWidth: settings.mobileWidth || 1080,
        padding: settings.mobilePadding || 16,
        scale,
        pdfFormat: [1080 * 0.264583, 2316 * 0.264583],
        pdfOrientation: settings.orientation === 'landscape' ? 'landscape' : 'portrait',
        label: 'ملائم لشاشة الجوال (Note 20 Ultra)'
      };
    case 'a4':
      return {
        minWidth: 1240,
        padding: 24,
        scale,
        pdfFormat: 'a4',
        pdfOrientation: settings.orientation === 'landscape' ? 'landscape' : settings.orientation === 'portrait' ? 'portrait' : 'auto',
        label: 'ورق A4 (210 × 297 مم)'
      };
    case 'a3':
      return {
        minWidth: 1754,
        padding: 32,
        scale,
        pdfFormat: 'a3',
        pdfOrientation: settings.orientation === 'portrait' ? 'portrait' : 'landscape',
        label: 'ورق A3 عريض (297 × 420 مم)'
      };
    case 'a5':
      return {
        minWidth: 874,
        padding: 16,
        scale,
        pdfFormat: 'a5',
        pdfOrientation: settings.orientation === 'landscape' ? 'landscape' : 'portrait',
        label: 'ورق A5 مدمج (148 × 210 مم)'
      };
    case 'thermal_80':
      return {
        minWidth: 540,
        padding: 12,
        scale,
        pdfFormat: [80, 297],
        pdfOrientation: 'portrait',
        label: 'ورق حراري 80 مم'
      };
    case 'thermal_58':
      return {
        minWidth: 380,
        padding: 10,
        scale,
        pdfFormat: [58, 200],
        pdfOrientation: 'portrait',
        label: 'ورق حراري 58 مم'
      };
    case 'custom': {
      const customPreset = settings.customPresets.find(p => p.id === settings.customSizeId) || settings.customPresets[0];
      if (customPreset) {
        const pxWidth = customPreset.unit === 'mm' ? Math.round(customPreset.width * 3.7795) : customPreset.width;
        const mmWidth = customPreset.unit === 'px' ? customPreset.width * 0.264583 : customPreset.width;
        const mmHeight = customPreset.height
          ? (customPreset.unit === 'px' ? customPreset.height * 0.264583 : customPreset.height)
          : undefined;
        return {
          minWidth: pxWidth,
          padding: 20,
          scale,
          pdfFormat: mmHeight ? [mmWidth, mmHeight] : [mmWidth, mmWidth * 1.414],
          pdfOrientation: settings.orientation === 'auto' ? 'auto' : settings.orientation,
          label: `${customPreset.name} (${customPreset.width} ${customPreset.unit})`
        };
      }
      return {
        minWidth: 1080,
        padding: 16,
        scale,
        pdfFormat: 'a4',
        pdfOrientation: 'auto',
        label: 'مخصص'
      };
    }
    default:
      return {
        minWidth: 1080,
        padding: 16,
        scale,
        pdfFormat: 'a4',
        pdfOrientation: 'auto',
        label: 'ملائم لشاشة الجوال'
      };
  }
}
