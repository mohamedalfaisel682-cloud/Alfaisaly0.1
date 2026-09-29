import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Calendar, 
  Trash2, 
  MessageSquare, 
  Bot, 
  User, 
  Clock, 
  Sparkles, 
  Copy, 
  Check, 
  Filter
} from 'lucide-react';
import { db } from '../lib/db';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface VoiceAssistantChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand?: (text: string) => void;
}

type DateFilterType = 'today' | 'week' | 'month' | 'all';

export const VoiceAssistantChatHistoryModal: React.FC<VoiceAssistantChatHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectCommand
}) => {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load chat history from IndexedDB
  const loadHistory = async () => {
    try {
      const logs = await db.voiceChats.toArray();
      logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setHistoryItems(logs);
    } catch (err) {
      console.warn('Failed to load voice chats history:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  // Clear all voice chat history
  const handleClearHistory = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في مسح سجل محادثات المساعد الصوتي كاملاً؟')) {
      try {
        await db.voiceChats.clear();
        setHistoryItems([]);
        toast.success('تم مسح سجل المحادثات بنجاح');
      } catch (e) {
        toast.error('حدث خطأ أثناء مسح السجل');
      }
    }
  };

  // Filter messages by date and search query
  const filteredMessages = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    return historyItems.filter(item => {
      const itemTime = new Date(item.timestamp || 0).getTime();
      
      // Date filtering
      if (dateFilter === 'today' && itemTime < todayStart) return false;
      if (dateFilter === 'week' && itemTime < weekStart) return false;
      if (dateFilter === 'month' && itemTime < monthStart) return false;

      // Text search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (item.text || '').toLowerCase().includes(q);
      }

      return true;
    });
  }, [historyItems, dateFilter, searchQuery]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 dir-rtl">
      <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right">
        
        {/* Header - Styled to match Voice Assistant emerald theme */}
        <div className="p-4 bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white flex items-center justify-between border-b border-emerald-600/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/30 border border-emerald-400/40 rounded-xl text-emerald-200 shadow-sm">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                <span>سجل محادثات وأوامر المساعد الصوتي</span>
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </h3>
              <p className="text-[10.5px] text-emerald-200/80 font-bold">
                تصفح وبحث وفلترة كافة استفسارات وأوامر المحادثة الصوتية والأوفلاين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {historyItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 rounded-xl text-[10.5px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                title="مسح السجل كاملاً"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مسح السجل</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Date Filter Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          
          {/* Live Search Input */}
          <div className="relative w-full sm:w-auto sm:flex-1 flex items-center">
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في محادثات وأوامر المساعد..."
              className="w-full pr-9 pl-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-0 top-0 bottom-0 h-full aspect-square bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 font-bold rounded-l-2xl"
                title="مسح النص وإلغاء المدخلات بنقرة واحدة"
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            ) : null}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto shrink-0 pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'هذا الأسبوع' },
              { id: 'month', label: 'هذا الشهر' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateFilter(tab.id as DateFilterType)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap",
                  dateFilter === tab.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Message Logs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لا توجد رسائل أو محادثات مسجلة ضمن النطاق المحدد
              </p>
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleString('ar-YE', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short'
              }) : '';

              return (
                <div
                  key={msg.id || idx}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all text-xs flex flex-col gap-1.5 relative group shadow-2xs",
                    isUser
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 mr-0 sm:mr-8 text-emerald-950 dark:text-emerald-100"
                      : "bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 ml-0 sm:ml-8 text-slate-900 dark:text-slate-100"
                  )}
                >
                  {/* Role Header */}
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      {isUser ? (
                        <>
                          <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <strong className="text-emerald-900 dark:text-emerald-300 font-black">المستخدم</strong>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <strong className="text-teal-800 dark:text-teal-300 font-black">المساعد الصوتي</strong>
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-slate-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {timeStr}
                      </span>

                      {/* Copy or Execute Button */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text || '');
                          setCopiedId(msg.id || String(idx));
                          toast.success('تم نسخ النص');
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                        title="نسخ النص"
                      >
                        {copiedId === (msg.id || String(idx)) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {isUser && onSelectCommand && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCommand(msg.text);
                            onClose();
                          }}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-black transition-colors shadow-2xs"
                        >
                          إعادة تنفيذ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <p className="text-slate-900 dark:text-slate-100 font-semibold leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>

                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <span>إجمالي المحادثات المسجلة: {filteredMessages.length} رسالة</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
