import toast from 'react-hot-toast';
import { getExportSettings, resolveExportDimensions } from './exportSettings';

export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }, 2000);
    return true;
  } catch (err) {
    console.error('downloadBlob error:', err);
    return false;
  }
}

export async function shareOrSaveFile({
  dataUrl,
  blob,
  filename,
  title,
  mimeType = 'image/jpeg'
}: {
  dataUrl?: string;
  blob?: Blob;
  filename: string;
  title: string;
  mimeType?: string;
}) {
  try {
    let effectiveBlob = blob;
    let base64Data = '';

    if (dataUrl) {
      base64Data = dataUrl.split(',')[1] || dataUrl;
      if (!effectiveBlob) {
        const parts = dataUrl.split(',');
        const mime = parts[0]?.match(/:(.*?);/)?.[1] || mimeType;
        const bin = atob(parts[1] || '');
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        effectiveBlob = new Blob([arr], { type: mime });
      }
    } else if (effectiveBlob) {
      const reader = new FileReader();
      base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(effectiveBlob!);
      });
    }

    // 1. Support Custom AndroidInterface save directly into native Android storage
    if (typeof (window as any).AndroidInterface !== 'undefined' && base64Data) {
      try {
        if ((window as any).AndroidInterface.saveFile) {
          (window as any).AndroidInterface.saveFile(base64Data, filename);
          toast.success(`تم حفظ الملف مباشرة في ذاكرة الجوال: ${filename}`);
          return;
        } else if ((window as any).AndroidInterface.saveImage && mimeType.startsWith('image/')) {
          (window as any).AndroidInterface.saveImage(base64Data, filename);
          toast.success(`تم حفظ الصورة في ملفات الجوال: ${filename}`);
          return;
        }
      } catch (nativeErr) {
        console.warn('AndroidInterface direct save error, continuing with browser download:', nativeErr);
      }
    }

    // 2. Support Capacitor Native Platform (Write directly to Documents directory without opening share sheet)
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor && Capacitor.isNativePlatform() && base64Data) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents
        });
        toast.success(`تم حفظ الملف في مستندات الهاتف: ${filename}`);
        return;
      }
    } catch (capErr) {
      console.warn('Capacitor native write error, falling back to direct download:', capErr);
    }

    // 3. Direct browser download to phone's Downloads folder (التنزيلات / وحدة التخزين)
    if (effectiveBlob) {
      await downloadBlob(effectiveBlob, filename);
      toast.success(`تم تنزيل ${filename} تلقائياً إلى ملفات الهاتف`);
    } else if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 2000);
      toast.success(`تم تنزيل ${filename} تلقائياً إلى ملفات الهاتف`);
    }
  } catch (err) {
    console.error('Save/Download error:', err);
    toast.error('تعذر إكمال التنزيل التلقائي للملف');
  }
}

export interface ExportCanvasOptions {
  minWidth?: number;
  scale?: number;
  backgroundColor?: string | null;
  padding?: number;
  orientation?: 'portrait' | 'landscape' | 'auto';
  filename?: string;
  title?: string;
}

/**
 * Safely captures an HTML element into a canvas with full support for modern CSS
 * including OKLCH / OKLAB / LAB / LCH colors (Tailwind CSS v4) and custom viewport bounds.
 */
export async function captureElementToCanvas(
  element: HTMLElement,
  options: {
    backgroundColor?: string | null;
    scale?: number;
    logging?: boolean;
    windowWidth?: number;
    windowHeight?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
  } = {}
): Promise<HTMLCanvasElement> {
  const {
    backgroundColor = '#ffffff',
    scale = 2.5,
    logging = false,
    windowWidth,
    windowHeight,
  } = options;

  // Use html2canvas-pro which natively supports OKLCH colors used by Tailwind CSS v4
  const { default: html2canvasPro } = await import('html2canvas-pro');

  return await html2canvasPro(element, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: backgroundColor ?? undefined,
    scale,
    logging,
    x: options.x ?? 0,
    y: options.y ?? 0,
    scrollX: options.scrollX ?? 0,
    scrollY: options.scrollY ?? 0,
    width: options.width ?? (windowWidth || element.scrollWidth),
    height: options.height ?? (windowHeight || element.scrollHeight),
    windowWidth: windowWidth || element.scrollWidth,
    windowHeight: windowHeight || element.scrollHeight,
    onclone: (_clonedDoc, clonedEl) => {
      if (!clonedEl) return;
      try {
        // Safe DOM color normalization pass for any computed/relative color functions
        const canvasCtx = document.createElement('canvas').getContext('2d');
        if (canvasCtx) {
          const elements = clonedEl.querySelectorAll<HTMLElement>('*');
          for (let i = 0; i < elements.length; i++) {
            const node = elements[i];
            if (node && node.style) {
              const styleProps: (keyof CSSStyleDeclaration)[] = [
                'color',
                'backgroundColor',
                'borderColor',
                'outlineColor',
              ];
              for (const prop of styleProps) {
                const val = node.style[prop];
                if (typeof val === 'string' && val.includes('oklch')) {
                  try {
                    canvasCtx.fillStyle = '#000000';
                    canvasCtx.fillStyle = val;
                    const converted = canvasCtx.fillStyle;
                    if (converted && converted !== val) {
                      (node.style as any)[prop] = converted;
                    }
                  } catch {
                    // ignore individual conversion error
                  }
                }
              }
            }
          }
        }
      } catch (cloneErr) {
        console.warn('DOM color normalization notice:', cloneErr);
      }
    },
  });
}

/**
 * Prepares a clone of the target element inside an isolated, unconstrained sandbox.
 * This guarantees that reports viewed on mobile devices (e.g., Galaxy Note 20 Ultra)
 * are rendered at full desktop/print width (e.g., 1240px+) so that all 8-10 table columns
 * and multi-row sections are captured completely without horizontal or vertical truncation.
 */
export async function prepareElementForExport(
  elementOrId: HTMLElement | string,
  options: ExportCanvasOptions = {}
): Promise<{
  sandbox: HTMLElement;
  clone: HTMLElement;
  fullWidth: number;
  fullHeight: number;
  cleanup: () => void;
}> {
  const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    throw new Error('العنصر المراد تصديره غير موجود');
  }

  // 1. Determine if this element is a full report / tabular data or a narrow receipt
  const isReceipt =
    el.classList.contains('receipt-preview') ||
    el.id.includes('receipt') ||
    el.classList.contains('w-[80mm]') ||
    el.classList.contains('max-w-[80mm]');

  // Load configured export settings (defaults to Mobile FHD+ Note 20 Ultra)
  const exportSettings = getExportSettings();
  const resolved = resolveExportDimensions(exportSettings, isReceipt);

  const targetMinWidth = Math.max(options.minWidth || resolved.minWidth, isReceipt ? 380 : 540);

  // 2. Create the sandbox container placed at fixed (0, 0) with deep negative z-index
  const sandbox = document.createElement('div');
  sandbox.id = `export-render-sandbox-${Date.now()}`;
  sandbox.setAttribute('data-export-sandbox', 'true');
  sandbox.setAttribute('dir', el.getAttribute('dir') || 'rtl');

  Object.assign(sandbox.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: `${targetMinWidth}px`,
    minWidth: `${targetMinWidth}px`,
    maxWidth: `${targetMinWidth}px`,
    height: 'auto',
    minHeight: '200px',
    maxHeight: 'none',
    margin: '0px',
    padding: '0px',
    zIndex: '-99999',
    pointerEvents: 'none',
    opacity: '1',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    overflow: 'visible',
  });

  // 3. Clone the node
  const clone = el.cloneNode(true) as HTMLElement;
  clone.id = `${el.id || 'export'}-cloned-preview`;

  // 4. Remove interactive, non-exportable, or printing UI elements
  const removeSelectors = [
    '.no-export',
    '.export-exclude',
    '.no-print',
    'button:not([data-export-keep])',
    '.shadow-xl',
    '.shadow-2xl',
  ];
  clone.querySelectorAll(removeSelectors.join(', ')).forEach((node) => node.remove());

  // 5. Clean up restrictive classes from clone
  const restrictiveClasses = [
    'max-w-[480px]',
    'max-w-[500px]',
    'max-w-[210mm]',
    'max-w-xs',
    'max-w-sm',
    'max-w-md',
    'max-w-lg',
    'max-w-xl',
    'max-w-2xl',
    'max-w-3xl',
    'max-w-4xl',
    'max-w-5xl',
    'overflow-hidden',
    'overflow-y-auto',
    'overflow-x-auto',
    'overflow-auto',
    'max-h-[85vh]',
    'max-h-[80vh]',
    'max-h-[90vh]',
    'max-h-screen',
    'h-[85vh]',
    'h-[90vh]',
  ];
  restrictiveClasses.forEach((cls) => clone.classList.remove(cls));

  // Determine computed background of original element so we keep custom themes (like dark luxury)
  const originalBg = window.getComputedStyle(el).backgroundColor;
  const safeBg =
    originalBg && originalBg !== 'rgba(0, 0, 0, 0)' && originalBg !== 'transparent'
      ? originalBg
      : '#ffffff';

  Object.assign(clone.style, {
    position: 'relative',
    top: '0px',
    left: '0px',
    width: '100%',
    minWidth: '100%',
    maxWidth: 'none',
    height: 'auto',
    minHeight: 'auto',
    maxHeight: 'none',
    overflow: 'visible',
    transform: 'none',
    margin: '0px',
    padding: options.padding !== undefined ? `${options.padding}px` : `${resolved.padding}px`,
    boxSizing: 'border-box',
    backgroundColor: safeBg,
    borderRadius: '12px',
  });

  // 6. Unconstrain all descendants (tables, scroll containers, cards)
  const descendants = clone.querySelectorAll<HTMLElement>('*');
  descendants.forEach((child) => {
    restrictiveClasses.forEach((cls) => child.classList.remove(cls));

    child.style.maxWidth = 'none';
    child.style.maxHeight = 'none';

    // If it was a scrollable container
    if (
      child.classList.contains('overflow-x-auto') ||
      child.classList.contains('overflow-y-auto') ||
      child.classList.contains('overflow-hidden') ||
      child.classList.contains('overflow-auto')
    ) {
      child.classList.remove('overflow-x-auto', 'overflow-y-auto', 'overflow-hidden', 'overflow-auto');
      child.style.overflow = 'visible';
      child.style.width = '100%';
    }

    // Tables
    if (child.tagName.toLowerCase() === 'table') {
      child.style.width = '100%';
      child.style.minWidth = '100%';
      child.style.maxWidth = 'none';
      child.style.tableLayout = 'auto';
      child.style.borderCollapse = 'collapse';
    }

    // Table Cells
    if (child.tagName.toLowerCase() === 'th' || child.tagName.toLowerCase() === 'td') {
      child.style.whiteSpace = 'normal';
      child.style.wordBreak = 'break-word';
      child.style.overflow = 'visible';
      child.style.textOverflow = 'clip';
    }
  });

  // 7. Mount sandbox into DOM to calculate actual layout dimensions
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  // 8. Check if any table requires even more width than targetMinWidth
  let maxRequiredWidth = targetMinWidth;
  const tables = clone.querySelectorAll('table');
  tables.forEach((t) => {
    if (t.scrollWidth > maxRequiredWidth) {
      maxRequiredWidth = t.scrollWidth;
    }
  });

  if (maxRequiredWidth > targetMinWidth) {
    const adjusted = maxRequiredWidth + 40;
    sandbox.style.width = `${adjusted}px`;
    sandbox.style.minWidth = `${adjusted}px`;
    sandbox.style.maxWidth = `${adjusted}px`;
  }

  // 9. Ensure images inside clone are fully loaded
  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 600); // 600ms safety timeout
      });
    })
  );

  // 10. Wait for font rendering and next animation frame for reflow
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const fullWidth = Math.ceil(sandbox.offsetWidth || maxRequiredWidth);
  const fullHeight = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight, sandbox.scrollHeight, 400));

  const cleanup = () => {
    if (sandbox && sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  };

  return {
    sandbox,
    clone,
    fullWidth,
    fullHeight,
    cleanup,
  };
}

/**
 * Generates an unconstrained high-resolution canvas snapshot of the target element.
 */
export async function generateExportCanvas(
  elementOrId: HTMLElement | string,
  options: ExportCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const prepared = await prepareElementForExport(elementOrId, options);
  try {
    const { clone, fullWidth, fullHeight } = prepared;
    const exportSettings = getExportSettings();
    const isReceipt = typeof elementOrId === 'string'
      ? (elementOrId.includes('receipt') || elementOrId.includes('voucher'))
      : (elementOrId.classList?.contains('receipt-preview') || elementOrId.id?.includes('receipt'));
    const resolved = resolveExportDimensions(exportSettings, isReceipt);
    const scale = options.scale ?? resolved.scale;

    const canvas = await captureElementToCanvas(clone, {
      backgroundColor: options.backgroundColor !== undefined ? options.backgroundColor : '#ffffff',
      scale,
      logging: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight + 100,
    });

    return canvas;
  } finally {
    prepared.cleanup();
  }
}

/**
 * Generates a high-quality multi-page PDF blob from an element, guaranteeing that all
 * wide columns, rows, and financial cards fit comfortably and are sliced cleanly.
 */
export async function generateElementPDFBlob(
  elementOrId: HTMLElement | string,
  options: ExportCanvasOptions = {}
): Promise<{ blob: Blob; filename: string; canvas: HTMLCanvasElement }> {
  const canvas = await generateExportCanvas(elementOrId, options);
  const { default: jsPDF } = await import('jspdf');

  const exportSettings = getExportSettings();
  const isReceipt = typeof elementOrId === 'string'
    ? (elementOrId.includes('receipt') || elementOrId.includes('voucher'))
    : (elementOrId.classList?.contains('receipt-preview') || elementOrId.id?.includes('receipt'));
  const resolved = resolveExportDimensions(exportSettings, isReceipt);

  // Choose orientation:
  // If explicitly provided, use it; otherwise use resolved or auto-detect
  let orientation: 'portrait' | 'landscape' = 'portrait';
  if (options.orientation && options.orientation !== 'auto') {
    orientation = options.orientation;
  } else if (resolved.pdfOrientation && resolved.pdfOrientation !== 'auto') {
    orientation = resolved.pdfOrientation;
  } else if (canvas.width > 1200 && canvas.width >= canvas.height * 0.85) {
    orientation = 'landscape';
  } else {
    orientation = 'portrait';
  }

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: resolved.pdfFormat || 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = isReceipt ? 4 : 10; // 4mm for receipts, 10mm for documents
  const availableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const pixelsPerMm = canvas.width / availableWidth;
  const pageHeightPx = Math.floor(usableHeight * pixelsPerMm);
  const totalPages = Math.ceil(canvas.height / pageHeightPx);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage();
    }

    const srcY = page * pageHeightPx;
    const currentSliceHeightPx = Math.min(pageHeightPx, canvas.height - srcY);
    const currentSliceHeightMm = currentSliceHeightPx / pixelsPerMm;

    // Create temporary canvas slice for current page
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentSliceHeightPx;
    const sliceCtx = sliceCanvas.getContext('2d');

    if (sliceCtx) {
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0,
        srcY,
        canvas.width,
        currentSliceHeightPx,
        0,
        0,
        canvas.width,
        currentSliceHeightPx
      );

      const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(sliceDataUrl, 'JPEG', margin, margin, availableWidth, currentSliceHeightMm);
    }
  }

  const rawFilename = options.filename || `report_${Date.now()}.pdf`;
  const filename = rawFilename.endsWith('.pdf') ? rawFilename : `${rawFilename}.pdf`;
  const blob = pdf.output('blob');

  return { blob, filename, canvas };
}

export async function exportElementAsJPG(
  elementOrId: HTMLElement | string,
  filename?: string,
  title: string = 'تصدير صورة',
  options: ExportCanvasOptions = {}
) {
  const exportSettings = getExportSettings();
  const imageFormat = exportSettings.imageFormat || 'image/jpeg';
  const imageQuality = exportSettings.imageQuality || 0.95;
  const isPng = imageFormat === 'image/png';
  const ext = isPng ? 'png' : 'jpg';

  const toastId = toast.loading(`جاري إنشاء الصورة بجودة فائقة (${ext.toUpperCase()})...`);
  try {
    const canvas = await generateExportCanvas(elementOrId, options);
    const effectiveFilename =
      filename || `تقرير_${new Date().toISOString().split('T')[0]}_${Date.now()}.${ext}`;
    const finalFilename = effectiveFilename.replace(/\.(jpg|jpeg|png)$/i, '') + `.${ext}`;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, imageFormat, imageQuality));
    const dataUrl = canvas.toDataURL(imageFormat, imageQuality);

    if (blob) {
      await shareOrSaveFile({
        dataUrl,
        blob,
        filename: finalFilename,
        title,
        mimeType: imageFormat,
      });
    }

    toast.dismiss(toastId);
  } catch (err) {
    console.error('Export image error:', err);
    toast.error('حدث خطأ أثناء تصدير الصورة', { id: toastId });
  }
}

export async function exportElementAsPDF(
  elementOrId: HTMLElement | string,
  filename?: string,
  title: string = 'تصدير مستند PDF',
  options: ExportCanvasOptions = {}
) {
  const toastId = toast.loading('جاري إعداد وتوليد مستند PDF كامل وبكامل الجداول...');
  try {
    const effectiveFilename =
      filename || `تقرير_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;
    const { blob, filename: finalFilename } = await generateElementPDFBlob(elementOrId, {
      ...options,
      filename: effectiveFilename,
      title,
    });

    await shareOrSaveFile({
      blob,
      filename: finalFilename,
      title,
      mimeType: 'application/pdf',
    });

    toast.dismiss(toastId);
  } catch (err) {
    console.error('Export PDF error:', err);
    toast.error('حدث خطأ أثناء تصدير مستند PDF', { id: toastId });
  }
}

export async function copyFormattedText(text: string, successMsg: string = 'تم نسخ النص بنجاح للحافظة') {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success(successMsg, { icon: '📋' });
      return;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    toast.success(successMsg, { icon: '📋' });
  } catch (err) {
    console.error('Copy text error:', err);
    toast.error('تعذر نسخ النص إلى الحافظة');
  }
}