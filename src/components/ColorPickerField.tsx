import React, { useState, useRef, useEffect } from 'react';
import { SketchPicker } from 'react-color';

interface ColorPickerFieldProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  hideHexInput?: boolean;
}

export function ColorPickerField({ value, onChange, className = '', hideHexInput = false }: ColorPickerFieldProps) {
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

  const handleChange = (color: any) => {
    if (color.rgb.a === 1) {
      onChange(color.hex);
    } else {
      onChange(`rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`);
    }
  };

  return (
    <div className={`relative flex items-center gap-1 preserve-colors ${className}`}>
      <div 
        className="w-10 h-7 rounded border border-slate-300 cursor-pointer shadow-sm relative overflow-hidden" 
        style={{ backgroundColor: value || '#ffffff' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="absolute inset-0 pattern-checkered opacity-20 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHg9IjQiIHk9IjQiIGZpbGw9IiNjY2MiLz4KPC9zdmc+')]"></div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[120000] flex items-center justify-center p-4" style={{ zIndex: 120000 }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-2 border border-slate-200 animate-scale-in" ref={popoverRef}>
             <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-bold text-slate-700">تحديد اللون</span>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg w-6 h-6 flex items-center justify-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <SketchPicker 
              color={value || '#ffffff'} 
              onChange={handleChange} 
              presetColors={['#0f172a','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#e2e8f0','#f1f5f9','#f8fafc','#ffffff','#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e']} 
              width="240px"
              disableAlpha={false}
              styles={{ default: { picker: { boxShadow: 'none' } } }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default ColorPickerField;
