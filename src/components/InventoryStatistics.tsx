import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Layers, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Boxes,
  Sparkles,
  Archive,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { Currency, ExchangeRates, InventoryItem } from '../types';
import { cn, formatAmount, getInUSD } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';

export interface InventoryStatisticsProps {
  inventory: InventoryItem[];
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  inventoryCategoryOptions?: string[];
  onSelectItem?: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
}

// ألوان احترافية متباينة ومتناسقة مع شاشات الهواتف عالية الدقة AMOLED
const CATEGORY_COLORS = [
  '#0284c7', // Sky blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#64748b', // Slate
  '#84cc16'  // Lime
];

export const InventoryStatistics: React.FC<InventoryStatisticsProps> = ({
  inventory,
  systemCurrency,
  exchangeRates,
  onSelectItem,
  onEditItem
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [chartMetric, setChartMetric] = useState<'value' | 'count' | 'units'>('value');
  const [sortBy, setSortBy] = useState<'value' | 'count' | 'units' | 'name'>('value');

  // 1. العمليات الحسابية الكلية للمخزون
  const totals = useMemo(() => {
    let totalCostUSD = 0;
    let totalSellingUSD = 0;
    let totalUnits = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyStockCount = 0;

    inventory.forEach(item => {
      const stock = item.stock || 0;
      const minStock = item.minStock ?? 5;
      const costInUSD = getInUSD(item.costPrice || 0, item.currency || 'RY', exchangeRates);
      const sellingInUSD = getInUSD(item.sellingPrice || 0, item.currency || 'RY', exchangeRates);

      totalCostUSD += (costInUSD * stock);
      totalSellingUSD += (sellingInUSD * stock);
      totalUnits += stock;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      } else {
        healthyStockCount++;
      }
    });

    const expectedProfitUSD = totalSellingUSD - totalCostUSD;
    const profitMarginPercent = totalCostUSD > 0 ? (expectedProfitUSD / totalCostUSD) * 100 : 0;

    return {
      totalItems: inventory.length,
      totalUnits,
      totalCostUSD,
      totalSellingUSD,
      expectedProfitUSD,
      profitMarginPercent,
      outOfStockCount,
      lowStockCount,
      healthyStockCount,
      criticalTotal: outOfStockCount + lowStockCount
    };
  }, [inventory, exchangeRates]);

  // 2. تحليل وتجميع البيانات حسب التصنيفات
  const categoriesAnalysis = useMemo(() => {
    const map = new Map<string, {
      category: string;
      itemCount: number;
      totalUnits: number;
      totalCostUSD: number;
      totalSellingUSD: number;
      expectedProfitUSD: number;
      items: InventoryItem[];
    }>();

    inventory.forEach(item => {
      const cat = (item.category && item.category.trim()) ? item.category.trim() : 'بدون تصنيف';
      const stock = item.stock || 0;
      const costInUSD = getInUSD(item.costPrice || 0, item.currency || 'RY', exchangeRates);
      const sellingInUSD = getInUSD(item.sellingPrice || 0, item.currency || 'RY', exchangeRates);

      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          itemCount: 0,
          totalUnits: 0,
          totalCostUSD: 0,
          totalSellingUSD: 0,
          expectedProfitUSD: 0,
          items: []
        });
      }

      const entry = map.get(cat)!;
      entry.itemCount += 1;
      entry.totalUnits += stock;
      entry.totalCostUSD += (costInUSD * stock);
      entry.totalSellingUSD += (sellingInUSD * stock);
      entry.expectedProfitUSD += ((sellingInUSD - costInUSD) * stock);
      entry.items.push(item);
    });

    const list = Array.from(map.values()).map((entry, idx) => {
      const percentageOfTotalCost = totals.totalCostUSD > 0 
        ? (entry.totalCostUSD / totals.totalCostUSD) * 100 
        : 0;
      const percentageOfTotalUnits = totals.totalUnits > 0 
        ? (entry.totalUnits / totals.totalUnits) * 100 
        : 0;
      const percentageOfTotalItems = totals.totalItems > 0 
        ? (entry.itemCount / totals.totalItems) * 100 
        : 0;

      return {
        ...entry,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        percentageOfTotalCost,
        percentageOfTotalUnits,
        percentageOfTotalItems,
        costFormatted: formatAmount(entry.totalCostUSD, systemCurrency, exchangeRates),
        sellingFormatted: formatAmount(entry.totalSellingUSD, systemCurrency, exchangeRates),
        profitFormatted: formatAmount(entry.expectedProfitUSD, systemCurrency, exchangeRates)
      };
    });

    // الترتيب
    return list.sort((a, b) => {
      if (sortBy === 'value') return b.totalCostUSD - a.totalCostUSD;
      if (sortBy === 'units') return b.totalUnits - a.totalUnits;
      if (sortBy === 'count') return b.itemCount - a.itemCount;
      return a.category.localeCompare(b.category, 'ar');
    });
  }, [inventory, exchangeRates, totals, systemCurrency, sortBy]);

  // 3. بيانات المخطط الدائري لتوزيع التصنيفات
  const pieChartData = useMemo(() => {
    return categoriesAnalysis.map(cat => ({
      name: cat.category,
      value: chartMetric === 'value' 
        ? Number(cat.costFormatted.replace(/,/g, '')) || 0.1 
        : chartMetric === 'units' 
          ? cat.totalUnits 
          : cat.itemCount,
      percentage: chartMetric === 'value' 
        ? cat.percentageOfTotalCost 
        : chartMetric === 'units' 
          ? cat.percentageOfTotalUnits 
          : cat.percentageOfTotalItems,
      color: cat.color,
      itemCount: cat.itemCount,
      totalUnits: cat.totalUnits,
      costFormatted: cat.costFormatted
    }));
  }, [categoriesAnalysis, chartMetric]);

  // 4. بيانات مخطط الأعمدة المالي (التكلفة مقابل البيع)
  const barChartData = useMemo(() => {
    return categoriesAnalysis.slice(0, 8).map(cat => ({
      name: cat.category.length > 12 ? cat.category.slice(0, 10) + '...' : cat.category,
      fullName: cat.category,
      'قيمة التكلفة': Number(cat.costFormatted.replace(/,/g, '')) || 0,
      'قيمة البيع': Number(cat.sellingFormatted.replace(/,/g, '')) || 0,
      itemCount: cat.itemCount,
      units: cat.totalUnits
    }));
  }, [categoriesAnalysis]);

  // 5. أعلى 5 أصناف قيمة رأسمالية في المخزون
  const topValuedItems = useMemo(() => {
    return [...inventory]
      .map(item => {
        const costUSD = getInUSD(item.costPrice || 0, item.currency || 'RY', exchangeRates);
        const totalValUSD = costUSD * (item.stock || 0);
        return {
          ...item,
          totalValUSD,
          formattedTotal: formatAmount(totalValUSD, systemCurrency, exchangeRates)
        };
      })
      .sort((a, b) => b.totalValUSD - a.totalValUSD)
      .slice(0, 6);
  }, [inventory, exchangeRates, systemCurrency]);

  // 6. أصناف حرجة بحاجة لإعادة طلب
  const criticalItems = useMemo(() => {
    return [...inventory]
      .filter(i => (i.stock || 0) <= (i.minStock ?? 5))
      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
      .slice(0, 6);
  }, [inventory]);

  // 7. الأصناف حسب الفلتر المختار
  const filteredCategoryItems = useMemo(() => {
    if (selectedCategoryFilter === 'all') return [];
    return inventory.filter(i => (i.category || 'بدون تصنيف') === selectedCategoryFilter);
  }, [inventory, selectedCategoryFilter]);

  if (inventory.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <Package className="w-6 h-6" />
        </div>
        <h4 className="font-bold text-slate-700 text-base">لا توجد أصناف في المخزن حالياً</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          قم بإضافة أصناف جديدة وقطع غيار للمخزن لعرض المؤشرات والإحصائيات والرسوم البيانية بدقة.
        </p>
      </div>
    );
  }

  return (
    <div id="inventory-statistics-dashboard" className="space-y-4 dir-rtl text-right">
      {/* شريط الإجراءات والترويسة */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-purple-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/30 border border-purple-400/40 flex items-center justify-center shadow-inner text-purple-200">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">
                  تحليلات وإحصائيات قطاع المخزون والأصناف
                </h3>
                <span className="text-[10px] bg-purple-500/40 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-black">
                  مباشر
                </span>
              </div>
              <p className="text-xs text-purple-200/80 font-semibold mt-0.5">
                توزيع الأصناف، تقييم رأس المال المخزون، ونسب الربحية المتوقعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <ExportToolbar 
              targetElementId="inventory-statistics-dashboard"
              title={`إحصائيات_المخزون_${new Date().toISOString().split('T')[0]}`}
              getTextContent={() => {
                const lines = [
                  `═══════════════════════════════════════`,
                  `📊 تقرير إحصائيات وتقييم المخزون المالي`,
                  `📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}`,
                  `═══════════════════════════════════════`,
                  `• إجمالي عدد الأصناف: ${totals.totalItems} صنف`,
                  `• إجمالي عدد الوحدات: ${totals.totalUnits} قطعة`,
                  `• إجمالي قيمة المخزون (سعر التكلفة): ${formatAmount(totals.totalCostUSD, systemCurrency, exchangeRates)} ${systemCurrency}`,
                  `• إجمالي قيمة المخزون (سعر البيع): ${formatAmount(totals.totalSellingUSD, systemCurrency, exchangeRates)} ${systemCurrency}`,
                  `• هامش الربح المتوقع: ${formatAmount(totals.expectedProfitUSD, systemCurrency, exchangeRates)} ${systemCurrency} (${totals.profitMarginPercent.toFixed(1)}%)`,
                  `• عدد التصنيفات: ${categoriesAnalysis.length} تصنيف`,
                  `• الأصناف الناقصة والحرجة: ${totals.criticalTotal} صنف`,
                  `═══════════════════════════════════════`,
                  `📋 تفصيل التصنيفات:`,
                  ...categoriesAnalysis.map(c => 
                    `- ${c.category}: ${c.itemCount} صنف (${c.totalUnits} قطعة) | القيمة: ${c.costFormatted} ${systemCurrency} (${c.percentageOfTotalCost.toFixed(1)}%)`
                  ),
                  `═══════════════════════════════════════`
                ];
                return lines.join('\n');
              }}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* 1. شبكة البطاقات الإحصائية الرئيسية لقيمة المخزون */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* إجمالي قيمة المخزون بسعر التكلفة */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">قيمة المخزون (التكلفة)</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {formatAmount(totals.totalCostUSD, systemCurrency, exchangeRates)}
            <span className="text-xs font-bold text-purple-700 mr-1.5">{systemCurrency}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-1">
            <span>رأس المال المستثمر في المخزن</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>

        {/* إجمالي قيمة المخزون بسعر البيع */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">قيمة المخزون (البيع)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-emerald-800 tracking-tight">
            {formatAmount(totals.totalSellingUSD, systemCurrency, exchangeRates)}
            <span className="text-xs font-bold text-emerald-700 mr-1.5">{systemCurrency}</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span>العائد المتوقع عند بيع البضاعة</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* الأرباح المتوقعة وهامش الربح */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">الربح الإجمالي المتوقع</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-amber-900 tracking-tight flex items-baseline gap-1">
            <span>{formatAmount(totals.expectedProfitUSD, systemCurrency, exchangeRates)}</span>
            <span className="text-xs font-bold text-amber-700">{systemCurrency}</span>
          </div>
          <div className="text-[10px] text-amber-700 font-extrabold mt-1 flex items-center gap-1">
            <span className="bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
              هامش: {totals.profitMarginPercent.toFixed(1)}%
            </span>
            <span>من قيمة التكلفة</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* إجمالي الأصناف والقطع */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500">تعداد المخزن</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
            <span>{totals.totalItems} <span className="text-xs font-bold text-slate-500">صنف</span></span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-sky-700">{totals.totalUnits} <span className="text-xs font-bold text-sky-600">قطعة</span></span>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1 flex items-center justify-between">
            <span>{categoriesAnalysis.length} تصنيفات مسجلة</span>
            {totals.criticalTotal > 0 && (
              <span className="text-rose-600 font-extrabold flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                {totals.criticalTotal} حرج
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500" />
        </div>
      </div>

      {/* 2. قسم الرسوم البيانية التفاعلية: التوزيع الدائري والأعمدة المقارنة */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* مخطط توزيع الأصناف حسب التصنيفات (Pie / Donut Chart) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100">
                  <PieIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    توزيع الأصناف حسب التصنيفات
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    نسبة استيعاب كل تصنيف من المخزن
                  </p>
                </div>
              </div>

              {/* أزرار تبديل معيار الرسم البياني */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartMetric('value')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all cursor-pointer",
                    chartMetric === 'value' ? "bg-white text-purple-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="توزيع حسب القيمة المالية"
                >
                  القيمة
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('units')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all cursor-pointer",
                    chartMetric === 'units' ? "bg-white text-purple-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="توزيع حسب عدد القطع"
                >
                  القطع
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('count')}
                  className={cn(
                    "px-2 py-1 rounded-lg transition-all cursor-pointer",
                    chartMetric === 'count' ? "bg-white text-purple-700 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
                  )}
                  title="توزيع حسب عدد الأصناف الفريدة"
                >
                  الأصناف
                </button>
              </div>
            </div>

            {/* مساحة الرسم البياني الدائري */}
            <div className="h-64 sm:h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white text-xs p-2.5 rounded-xl shadow-xl border border-slate-700 dir-rtl text-right">
                            <div className="font-black text-sm text-purple-300 mb-1 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                              <span>{data.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-300 space-y-0.5">
                              <div>القيمة: <span className="font-bold text-white">{data.costFormatted} {systemCurrency}</span></div>
                              <div>عدد القطع: <span className="font-bold text-white">{data.totalUnits} قطعة</span></div>
                              <div>عدد الأصناف: <span className="font-bold text-white">{data.itemCount} صنف</span></div>
                              <div className="text-emerald-400 font-extrabold pt-1 border-t border-slate-700/60 mt-1">
                                النسبة: {data.percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* وسيلة إيضاح سريعة لنسب التصنيفات */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
            <span>ملاحظة: النقر على المخطط يوضح تفاصيل التصنيف</span>
            <span className="text-purple-700 font-black">{categoriesAnalysis.length} تصنيف</span>
          </div>
        </div>

        {/* مخطط المقارنة المالية: قيمة التكلفة مقابل البيع (Bar Chart) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    القيمة المالية للمخزون حسب التصنيف
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    مقارنة رأس المال بالتكلفة مع العائد المتوقع بسعر البيع (بالـ {systemCurrency})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  التكلفة
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  البيع
                </span>
              </div>
            </div>

            {/* مساحة مخطط الأعمدة */}
            <div className="h-64 sm:h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white text-xs p-2.5 rounded-xl shadow-xl border border-slate-700 dir-rtl text-right">
                            <div className="font-black text-sm text-sky-300 mb-1">
                              {data.fullName}
                            </div>
                            <div className="text-[11px] text-slate-300 space-y-1">
                              <div className="flex items-center justify-between gap-3">
                                <span>قيمة التكلفة:</span>
                                <span className="font-bold text-purple-300">{data['قيمة التكلفة']} {systemCurrency}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span>قيمة البيع:</span>
                                <span className="font-bold text-emerald-400">{data['قيمة البيع']} {systemCurrency}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700 text-amber-300 font-black">
                                <span>الربح المقدر:</span>
                                <span>{data['قيمة البيع'] - data['قيمة التكلفة']} {systemCurrency}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="قيمة التكلفة" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="قيمة البيع" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
            <span>تظهر أعلى 8 تصنيفات بحسب القيمة المالية الإجمالية</span>
            <span className="text-emerald-700 font-black">الربح الإجمالي: {formatAmount(totals.expectedProfitUSD, systemCurrency, exchangeRates)} {systemCurrency}</span>
          </div>
        </div>
      </div>

      {/* 3. جدول تحليلي وتفصيلي لتصنيفات المخزون مع أشرطة التقدم */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                جدول التحليل الشامل لقطاعات وتصنيفات المخزن
              </h4>
              <p className="text-[10px] text-slate-500 font-medium">
                تفصيل دقيق للأصناف، كميات القطع، القيمة المالية، والنسب المئوية
              </p>
            </div>
          </div>

          {/* فلتر الترتيب */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>ترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="value">القيمة المالية (الأعلى)</option>
              <option value="units">عدد القطع والكمية</option>
              <option value="count">عدد الأصناف</option>
              <option value="name">أبجدياً بالاسم</option>
            </select>
          </div>
        </div>

        {/* الجدول التفاعلي المتجاوب مع شاشة الجوال */}
        <div className="overflow-x-auto no-scrollbar rounded-xl border border-slate-200">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                <th className="p-2.5">التصنيف</th>
                <th className="p-2.5 text-center">الأصناف</th>
                <th className="p-2.5 text-center">القطع المتوفرة</th>
                <th className="p-2.5">قيمة التكلفة</th>
                <th className="p-2.5">قيمة البيع</th>
                <th className="p-2.5">الربح المتوقع</th>
                <th className="p-2.5 min-w-[130px]">النسبة من المخزون</th>
                <th className="p-2.5 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {categoriesAnalysis.map((cat, idx) => (
                <tr 
                  key={idx}
                  className={cn(
                    "hover:bg-purple-50/40 transition-colors",
                    selectedCategoryFilter === cat.category && "bg-purple-50/70 ring-1 ring-purple-300"
                  )}
                >
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs" 
                        style={{ backgroundColor: cat.color }} 
                      />
                      <span className="font-extrabold text-slate-900">{cat.category}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[11px]">
                      {cat.itemCount}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="font-extrabold text-indigo-900">
                      {cat.totalUnits}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-purple-900">
                    {cat.costFormatted} <span className="text-[10px] text-slate-500">{systemCurrency}</span>
                  </td>
                  <td className="p-2.5 font-bold text-emerald-800">
                    {cat.sellingFormatted} <span className="text-[10px] text-slate-500">{systemCurrency}</span>
                  </td>
                  <td className="p-2.5 font-bold text-amber-900">
                    {cat.profitFormatted} <span className="text-[10px] text-slate-500">{systemCurrency}</span>
                  </td>
                  <td className="p-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-extrabold">
                        <span className="text-slate-600">{cat.percentageOfTotalCost.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${Math.min(100, Math.max(3, cat.percentageOfTotalCost))}%`,
                            backgroundColor: cat.color 
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat.category ? 'all' : cat.category)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
                        selectedCategoryFilter === cat.category
                          ? "bg-purple-600 text-white border-purple-700"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-purple-50"
                      )}
                    >
                      {selectedCategoryFilter === cat.category ? 'إلغاء' : 'عرض الأصناف'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* عرض الأصناف التابعة للتصنيف المحدد إن وجد */}
        {selectedCategoryFilter !== 'all' && (
          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 mt-3 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                الأصناف المسجلة في تصنيف: <span className="text-purple-800 underline font-black">{selectedCategoryFilter}</span>
                <span className="text-[11px] text-slate-500 font-bold">({filteredCategoryItems.length} صنف)</span>
              </span>
              <button 
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className="text-xs text-purple-700 hover:text-purple-900 font-bold cursor-pointer"
              >
                إغلاق التصفية
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredCategoryItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => onSelectItem && onSelectItem(item)}
                  className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs hover:border-purple-300 transition-all cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500">
                      الكمية: <span className="font-bold text-purple-700">{item.stock}</span> | التكلفة: {item.costPrice} {item.currency || 'RY'}
                    </div>
                  </div>
                  {onEditItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditItem(item);
                      }}
                      className="p-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 text-[10px] font-bold"
                    >
                      تعديل
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. بطاقات الأصناف الأعلى قيمة والأصناف الحرجة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* أعلى الأصناف قيمة رأسمالية في المخزون */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">
                أعلى الأصناف قيمة رأسمالية (Top Assets)
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400">الكمية × سعر التكلفة</span>
          </div>

          <div className="space-y-2">
            {topValuedItems.map((item, idx) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-amber-50/40 border border-slate-100 transition-all text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {item.category} • {item.stock} قطع متوفرة
                    </p>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  <div className="font-black text-slate-900 text-xs">
                    {item.formattedTotal} <span className="text-[10px] text-amber-700 font-bold">{systemCurrency}</span>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    سعر القطعة: {item.costPrice} {item.currency || 'RY'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* تنبيهات النقص وإعادة الطلب الحرجة */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-900">
                أصناف تحتاج إعادة توريد (حد النقص)
              </h4>
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              {totals.criticalTotal} صنف حرج
            </span>
          </div>

          {criticalItems.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-emerald-800">مستويات المخزون ممتازة!</p>
              <p className="text-[10px] text-slate-500">لا توجد أصناف وصلت لحد الخطر أو النفاد حالياً.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {criticalItems.map((item) => {
                const isZero = (item.stock || 0) === 0;
                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border transition-all text-xs",
                      isZero ? "bg-rose-50/60 border-rose-200" : "bg-amber-50/50 border-amber-200"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isZero ? "bg-rose-600 animate-pulse" : "bg-amber-500"
                      )} />
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500">
                          التصنيف: {item.category} • الحد الأدنى: {item.minStock ?? 5}
                        </p>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-black border",
                        isZero 
                          ? "bg-rose-600 text-white border-rose-700" 
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      )}>
                        {isZero ? 'نفد تماماً (0)' : `متبقي: ${item.stock} فقط`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default InventoryStatistics;
