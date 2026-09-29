import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ChevronDown, Check, Smartphone, Layers, CheckSquare, Square, Tag, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEVICE_TYPES, DEVICE_MODELS } from '../lib/utils';

export interface CompatibleModelsSelectProps {
  selectedModels: string[];
  onChange: (models: string[]) => void;
  deviceTypes?: { id?: number; name: string }[];
  deviceModels?: { id?: number; type: string; name: string }[];
  label?: string;
  className?: string;
  placeholder?: string;
}

export const CompatibleModelsSelect: React.FC<CompatibleModelsSelectProps> = ({
  selectedModels = [],
  onChange,
  deviceTypes = [],
  deviceModels = [],
  label = "الموديلات المخصصة",
  className,
  placeholder = "اختر الموديلات المخصصة للصنف...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('الكل');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });

  // Update floating dropdown coordinates
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Build full grouped models list across the entire application
  const groupedModels = useMemo(() => {
    // 1. Gather all unique device types
    const typesOrder: string[] = [];
    const addedTypes = new Set<string>();

    const addType = (t: string) => {
      const trimmed = t?.trim();
      if (trimmed && !addedTypes.has(trimmed)) {
        addedTypes.add(trimmed);
        typesOrder.push(trimmed);
      }
    };

    // First, default standard device types
    DEVICE_TYPES.forEach(addType);

    // From DB deviceTypes
    deviceTypes.forEach(dt => {
      if (dt.name) addType(dt.name);
    });

    // From DB deviceModels
    deviceModels.forEach(dm => {
      if (dm.type) addType(dm.type);
    });

    // 2. For each device type, gather all models
    const groups: { type: string; models: string[] }[] = [];

    typesOrder.forEach(type => {
      const modelsSet = new Set<string>();

      // From default DEVICE_MODELS
      if (DEVICE_MODELS[type]) {
        DEVICE_MODELS[type].forEach(m => {
          if (m?.trim()) modelsSet.add(m.trim());
        });
      }

      // From DB deviceModels
      deviceModels
        .filter(dm => dm.type === type)
        .forEach(dm => {
          if (dm.name?.trim()) modelsSet.add(dm.name.trim());
        });

      const list = Array.from(modelsSet).sort((a, b) => a.localeCompare(b, 'ar'));
      if (list.length > 0) {
        groups.push({ type, models: list });
      }
    });

    // Any untyped or unknown types in deviceModels
    const untyped = deviceModels.filter(dm => !dm.type || !addedTypes.has(dm.type));
    if (untyped.length > 0) {
      const extraSet = new Set<string>();
      untyped.forEach(dm => {
        if (dm.name?.trim()) extraSet.add(dm.name.trim());
      });
      if (extraSet.size > 0) {
        groups.push({
          type: 'موديلات أخرى',
          models: Array.from(extraSet).sort((a, b) => a.localeCompare(b, 'ar')),
        });
      }
    }

    return groups;
  }, [deviceTypes, deviceModels]);

  // Filter groups according to search and selected type filter
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupedModels
      .filter(group => {
        if (selectedTypeFilter !== 'الكل' && group.type !== selectedTypeFilter) {
          return false;
        }
        return true;
      })
      .map(group => {
        if (!q) return group;
        const matchesGroupType = group.type.toLowerCase().includes(q);
        if (matchesGroupType) {
          // If group type matches, show all models in this group or matching ones
          return group;
        }
        const filteredModels = group.models.filter(m => m.toLowerCase().includes(q));
        return {
          ...group,
          models: filteredModels,
        };
      })
      .filter(group => group.models.length > 0);
  }, [groupedModels, search, selectedTypeFilter]);

  // Total count of models across the entire app
  const totalModelsCount = useMemo(() => {
    return groupedModels.reduce((sum, g) => sum + g.models.length, 0);
  }, [groupedModels]);

  // Toggle single model selection
  const toggleModel = (modelName: string) => {
    if (selectedModels.includes(modelName)) {
      onChange(selectedModels.filter(m => m !== modelName));
    } else {
      onChange([...selectedModels, modelName]);
    }
  };

  // Toggle all models in a specific group
  const toggleGroupModels = (models: string[]) => {
    const allSelected = models.every(m => selectedModels.includes(m));
    if (allSelected) {
      onChange(selectedModels.filter(m => !models.includes(m)));
    } else {
      const newModels = Array.from(new Set([...selectedModels, ...models]));
      onChange(newModels);
    }
  };

  // Select all / Clear all
  const selectAllFiltered = () => {
    const allFilteredModels: string[] = [];
    filteredGroups.forEach(g => allFilteredModels.push(...g.models));
    onChange(Array.from(new Set([...selectedModels, ...allFilteredModels])));
  };

  const clearAllSelected = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full flex-col flex gap-0.5" ref={containerRef} dir="rtl">
      {/* Label and Dropdown Trigger Header */}
      <div className="flex items-center justify-between h-5">
        <div className="flex items-center gap-1.5">
          <label 
            className="text-[10px] sm:text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-700 select-none transition-colors flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>{label}</span>
          </label>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className={cn(
              "flex items-center justify-center p-0.5 w-6 h-6 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors border outline-none shadow-xs cursor-pointer",
              isOpen ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200"
            )}
            title="فتح قائمة الموديلات المخصصة"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>
        </div>

        {selectedModels.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black">
              {selectedModels.length} محدد
            </span>
            <button
              type="button"
              onClick={clearAllSelected}
              className="text-[9px] text-red-500 hover:underline font-bold"
              title="إلغاء التحديد"
            >
              مسح
            </button>
          </div>
        )}
      </div>

      {/* Input / Display Box */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full min-h-[42px] p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer flex items-center justify-between text-xs transition-all hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500",
          isOpen && "ring-2 ring-indigo-500 border-indigo-400 bg-white",
          className
        )}
      >
        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden max-h-[60px] pr-0.5 flex-1">
          {selectedModels.length === 0 ? (
            <span className="text-slate-400 font-medium select-none text-[11px] sm:text-xs">
              {placeholder}
            </span>
          ) : (
            <>
              {selectedModels.slice(0, 3).map((mod, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-[10px] font-bold shadow-3xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleModel(mod);
                  }}
                  title="انقر للإزالة"
                >
                  <span>{mod}</span>
                  <X className="w-2.5 h-2.5 text-indigo-500 hover:text-red-500" />
                </span>
              ))}
              {selectedModels.length > 3 && (
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[9px] font-black">
                  +{selectedModels.length - 3} أخرى
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 mr-1">
          {selectedModels.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAllSelected();
              }}
              className="p-1 text-slate-400 hover:text-red-500 rounded-full transition-colors cursor-pointer"
              title="مسح كل الموديلات"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* Floating Dropdown via Portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-[99998]" 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
              />
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -8 }}
                transition={{ duration: 0.15 }}
                className="fixed bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 z-[99999] flex flex-col font-sans"
                style={(() => {
                  const dropdownWidth = Math.max(340, Math.min(coords.width || 360, 480));
                  const isLeftHalf = coords.left + dropdownWidth / 2 < window.innerWidth / 2;
                  let calculatedLeft = isLeftHalf
                    ? Math.max(12, Math.min(window.innerWidth - dropdownWidth - 12, coords.left))
                    : Math.max(12, Math.min(window.innerWidth - dropdownWidth - 12, coords.right - dropdownWidth));

                  const spaceBelow = window.innerHeight - coords.bottom;
                  const spaceAbove = coords.top;
                  const effectiveDir = (spaceBelow < 380 && spaceAbove > spaceBelow) ? 'up' : 'down';

                  return {
                    top: effectiveDir === 'up' ? 'auto' : coords.bottom + 4,
                    bottom: effectiveDir === 'up' ? window.innerHeight - coords.top + 4 : 'auto',
                    left: calculatedLeft,
                    width: dropdownWidth,
                    maxHeight: '75vh',
                  };
                })()}
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
              >
                {/* Header identical to CustomerSelect */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                      className="p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                    <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                      <span>قائمة الموديلات المخصصة</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold">
                      {selectedModels.length} من {totalModelsCount}
                    </span>
                    {selectedModels.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllSelected}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                      >
                        إلغاء الكل
                      </button>
                    )}
                  </div>
                </div>

                {/* Search input identical to CustomerSelect */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/60">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      name="models-dropdown-search"
                      autoComplete="off"
                      placeholder="بحث في الموديلات أو نوع الجهاز..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pr-8 pl-8 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-3xs"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute left-0 top-0 bottom-0 h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold rounded-l-xl"
                        title="مسح النص وإلغاء المدخلات بنقرة واحدة"
                      >
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Type Filter Chips identical to CustomerSelect classification chips */}
                <div className="flex items-center gap-1 overflow-x-auto p-2 bg-indigo-50/40 border-b border-indigo-100 scrollbar-hide">
                  <span className="text-[10px] font-bold text-indigo-700 whitespace-nowrap ml-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-indigo-600" />
                    <span>النوع:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTypeFilter('الكل')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer",
                      selectedTypeFilter === 'الكل'
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                    )}
                  >
                    الكل ({totalModelsCount})
                  </button>
                  {groupedModels.map(g => (
                    <button
                      key={'filter-' + g.type}
                      type="button"
                      onClick={() => setSelectedTypeFilter(g.type)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer",
                        selectedTypeFilter === g.type
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                      )}
                    >
                      {g.type} ({g.models.length})
                    </button>
                  ))}
                </div>

                {/* Groups and Models List */}
                <div className="overflow-y-auto flex-1 p-2 space-y-3 max-h-[50vh]">
                  {filteredGroups.map(group => {
                    const allInGroupSelected = group.models.every(m => selectedModels.includes(m));
                    const someInGroupSelected = group.models.some(m => selectedModels.includes(m));

                    return (
                      <div 
                        key={group.type} 
                        className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-3xs"
                      >
                        {/* Group Header */}
                        <div className="p-2 px-2.5 bg-slate-100/80 border-b border-slate-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-xs font-black text-slate-800">{group.type}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-bold">
                              {group.models.length}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleGroupModels(group.models)}
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                              allInGroupSelected 
                                ? "bg-red-50 text-red-600 hover:bg-red-100" 
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            )}
                          >
                            {allInGroupSelected ? "إلغاء المجموعة" : "تحديد الكل"}
                          </button>
                        </div>

                        {/* Models in Group */}
                        <div className="p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {group.models.map(model => {
                            const isSelected = selectedModels.includes(model);
                            return (
                              <div
                                key={model}
                                onClick={() => toggleModel(model)}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer select-none",
                                  isSelected 
                                    ? "bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-3xs" 
                                    : "bg-slate-50/50 hover:bg-slate-100 border-slate-150 text-slate-700"
                                )}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className={cn(
                                    "w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0",
                                    isSelected 
                                      ? "bg-indigo-600 border-indigo-600 text-white" 
                                      : "border-slate-300 bg-white"
                                  )}>
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-xs font-bold truncate">
                                    {model}
                                  </span>
                                </div>

                                <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 font-medium shrink-0">
                                  {group.type}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state when searching */}
                  {filteredGroups.length === 0 && search.trim() !== '' && (
                    <div className="px-3 py-6 text-xs text-slate-400 text-center flex flex-col items-center gap-2">
                      <Smartphone className="w-8 h-8 text-slate-300" />
                      <span>لا توجد موديلات مطابقة لـ "{search}"</span>
                      <button
                        type="button"
                        onClick={() => {
                          // Allow adding custom model on the fly
                          toggleModel(search.trim());
                          setSearch('');
                        }}
                        className="mt-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold hover:bg-indigo-100 transition-all"
                      >
                        إضافة الموديل "{search.trim()}" وتحديده
                      </button>
                    </div>
                  )}

                  {filteredGroups.length === 0 && search.trim() === '' && (
                    <div className="px-3 py-6 text-xs text-slate-400 text-center flex flex-col items-center gap-2">
                      <Smartphone className="w-8 h-8 text-slate-300" />
                      <span>لا توجد موديلات مسجلة في هذا التصنيف</span>
                    </div>
                  )}
                </div>

                {/* Footer / Confirm button */}
                <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="text-xs text-slate-600 font-bold">
                    تم تحديد: <span className="font-black text-indigo-700">{selectedModels.length}</span> موديل
                  </div>
                  <div className="flex items-center gap-2">
                    {search && (
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                      >
                        تحديد النتائج
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                    >
                      تم الاعتماد ✓
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
export default CompatibleModelsSelect;
