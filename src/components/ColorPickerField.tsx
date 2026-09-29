import React, { useState, useRef, useEffect } from 'react';
import { SketchPicker } from 'react-color';

interface ColorPickerFieldProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  hideHexInput?: boolean;
  label?: string;
}

/**
 * Parse any color string (hex, rgb, rgba) to rgba components
 */
function parseToRgba(colorStr: string): { r: number; g: number; b: number; a: number } {
  if (!colorStr || colorStr === 'transparent') {
    return { r: 255, g: 255, b: 255, a: 0 };
  }
  
  if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
      };
    }
  }

  // Hex format
  let hex = colorStr.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const a = Math.round(((parseInt(hex.substring(6, 8), 16) || 255) / 255) * 100) / 100;
    return { r, g, b, a };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

export function ColorPickerField({ value, onChange, className = '', hideHexInput = false, label }: ColorPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const rgba = parseToRgba(value);
  const opacityPct = Math.round(rgba.a * 100);

  const handleChange = (color: any) => {
    if (color.rgb.a === 1) {
      onChange(color.hex);
    } else if (color.rgb.a === 0) {
      onChange('transparent');
    } else {
      onChange(`rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${Math.round(color.rgb.a * 100) / 100})`);
    }
  };

  const handleOpacityChange = (newAlphaPct: number) => {
    const alpha = Math.max(0, Math.min(100, newAlphaPct)) / 100;
    if (alpha === 0) {
      onChange('transparent');
    } else if (alpha === 1) {
      // hex string without alpha
      const hexR = rgba.r.toString(16).padStart(2, '0');
      const hexG = rgba.g.toString(16).padStart(2, '0');
      const hexB = rgba.b.toString(16).padStart(2, '0');
      onChange(`#${hexR}${hexG}${hexB}`);
    } else {
      onChange(`rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`);
    }
  };

  return (
    <div className={`relative flex items-center gap-1 preserve-colors ${className}`}>
      {label && <span className="text-[11px] font-bold text-slate-700 dir-rtl">{label}</span>}
      <div 
        className="w-10 h-7 rounded-lg border border-slate-300 cursor-pointer shadow-2xs relative overflow-hidden flex items-center justify-center transition-all hover:scale-105 active:scale-95" 
        style={{ backgroundColor: value === 'transparent' ? 'transparent' : (value || '#ffffff') }}
        onClick={() => setIsOpen(!isOpen)}
        title="انقر لتحديد اللون ومستوى الشفافية"
      >
        <div className="absolute inset-0 pattern-checkered opacity-30 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+CjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjQiIHg9IjQiIHk9IjQiIGZpbGw9IjNjY2MiLz4KPC9zdmc+')]"></div>
        {value === 'transparent' && (
          <span className="text-[9px] font-black text-rose-600 bg-white/90 px-1 rounded shadow-2xs">شفاف</span>
        )}
      </div>

      {!hideHexInput && (
        <input
          type="text"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg outline-none dir-ltr"
        />
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[120000] flex items-center justify-center p-3 sm:p-4" style={{ zIndex: 120000 }}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setIsOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-3 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150 max-w-sm w-full text-slate-900 dark:text-slate-100" ref={popoverRef} dir="rtl">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-md border border-slate-300 shadow-2xs relative overflow-hidden"
                  style={{ backgroundColor: value === 'transparent' ? 'transparent' : (value || '#ffffff') }}
                >
                  <div className="absolute inset-0 opacity-30 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHg9IjQiIHk9IjQiIGZpbGw9IjNjY2MiLz4KPC9zdmc+')]"></div>
                </div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">لوحة اختيار اللون والشفافية</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg w-7 h-7 flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Color Picker */}
            <div className="flex justify-center mb-3">
              <SketchPicker 
                color={value === 'transparent' ? 'rgba(255,255,255,0)' : (value || '#ffffff')} 
                onChange={handleChange} 
                presetColors={['#0f172a','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#e2e8f0','#f1f5f9','#ffffff','#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e']} 
                width="100%"
                disableAlpha={false}
                styles={{ default: { picker: { boxShadow: 'none', border: 'none', padding: '0px' } } }}
              />
            </div>

            {/* Dedicated Opacity / Transparency Controls */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-slate-800 dark:text-slate-200">درجة شفافية اللون (Opacity):</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                  {opacityPct}% {opacityPct === 0 ? '(شفاف)' : opacityPct === 100 ? '(معتم)' : ''}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={opacityPct}
                onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />

              {/* Quick Opacity Presets */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {[
                  { label: 'بلا لون', pct: 0 },
                  { label: '15%', pct: 15 },
                  { label: '30%', pct: 30 },
                  { label: '50%', pct: 50 },
                  { label: '75%', pct: 75 },
                  { label: 'معتم', pct: 100 }
                ].map(p => (
                  <button
                    key={p.pct}
                    type="button"
                    onClick={() => handleOpacityChange(p.pct)}
                    className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                      opacityPct === p.pct
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Color Value */}
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">قيمة اللون الحالية:</span>
              <input
                type="text"
                value={value || '#ffffff'}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dir-ltr text-center text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg shadow-2xs cursor-pointer"
              >
                اعتماد
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPickerField;

