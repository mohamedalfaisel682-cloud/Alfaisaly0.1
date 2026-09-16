import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Loader2, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2, 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Settings, 
  Cpu, 
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Wallet,
  Package,
  UserCheck,
  ClipboardPaste,
  FileCheck,
  Bell
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';
import { db } from '../lib/db';
import { CashAccount } from '../types';
import { 
  getVoiceSettings, 
  saveVoiceSettings, 
  cleanTextForArabicSpeech, 
  getBestArabicVoice, 
  VoiceAssistantSettings 
} from '../lib/voiceSettings';
import { parseFinancialNotification, ParsedFinancialNotification } from '../lib/notificationParser';
import { VoiceAssistantSettingsModal } from './VoiceAssistantSettingsModal';
import { getApiUrl } from '../lib/nativeService';
import { startUnifiedSpeechRecognition, stopUnifiedSpeechRecognition } from '../lib/nativeSpeechService';

let sessionActionStack: { type: string, data: any }[] = [];

export const GeminiIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2" />
  </svg>
);

interface PendingAction {
  fnName: string;
  args: any;
  description: string;
}

export interface FinancialSuggestionData {
  type: 'deposit' | 'transfer';
  partyName: string;
  amount: number;
  currency: string;
  sourceEntity?: string;
  rawText: string;
  referenceNumber?: string;
  executed?: boolean;
  executedDetails?: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  financialSuggestion?: FinancialSuggestionData;
}

export const VoiceAssistant = ({ 
  className, 
  onClick,
  onClose,
}: { 
  className?: string; 
  onClick?: (e: React.MouseEvent, toggleVoice: () => void) => void;
  onClose?: () => void;
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantMessage, setAssistantMessage] = useState(getVoiceSettings().welcomeMessage || 'أهلاً بك، أنا جاهز لتنفيذ الأوامر.');
  const [chatMessages, setChatMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: getVoiceSettings().welcomeMessage || 'أهلاً بك، أنا جاهز للاستماع لأوامرك الصوتية وتنفيذها.',
      timestamp: new Date()
    }
  ]);
  const [liveInterimText, setLiveInterimText] = useState('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSpokenBufferRef = useRef<string>('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceAssistantSettings>(getVoiceSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [assistantEngineMode, setAssistantEngineMode] = useState<1 | 2 | 3 | 4 | 5 | 6>((getVoiceSettings().assistantEngineMode as any) || 6);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [pendingTaskSelection, setPendingTaskSelection] = useState<{ customerName: string; tasks: any[] } | null>(null);

  // Financial notification handling & cash accounts state
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [activeSuggestionAccount, setActiveSuggestionAccount] = useState<{ [msgId: string]: number }>({});
  const [isClipboardReading, setIsClipboardReading] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Synchronized state refs to avoid stale closure issues during async voice operations
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const noSpeechCountRef = useRef<number>(0);

  // Load cash accounts for financial operations
  const loadCashAccounts = async () => {
    try {
      const accs = await db.cashAccounts?.toArray().catch(() => []) || [];
      setCashAccounts(accs);
    } catch (e) {
      console.warn('Failed to load cash accounts for assistant', e);
    }
  };

  useEffect(() => {
    loadCashAccounts();
    const handleCashUpdate = () => loadCashAccounts();
    window.addEventListener('cash_accounts_changed', handleCashUpdate);
    window.addEventListener('financial_update', handleCashUpdate);
    return () => {
      window.removeEventListener('cash_accounts_changed', handleCashUpdate);
      window.removeEventListener('financial_update', handleCashUpdate);
    };
  }, []);

  // Listen to external/native broadcasted bank notifications
  useEffect(() => {
    const handleExternalNotification = (e: any) => {
      const text = e.detail?.text || e.detail?.body || e.detail?.message;
      if (text && typeof text === 'string') {
        const notif = parseFinancialNotification(text, voiceSettings.allowedNotificationSenders);
        if (notif.isFinancial && (voiceSettings.notificationMonitoringEnabled ?? true)) {
          setIsActive(true);
          handleFinancialNotification(notif);
        }
      }
    };

    window.addEventListener('bank_notification_received', handleExternalNotification);
    window.addEventListener('incoming_notification', handleExternalNotification);
    return () => {
      window.removeEventListener('bank_notification_received', handleExternalNotification);
      window.removeEventListener('incoming_notification', handleExternalNotification);
    };
  }, [voiceSettings, cashAccounts]);

  // Subscribe to active task changes
  useEffect(() => {
    const handleActiveTask = (e: any) => {
      const { taskId } = e.detail || {};
      if (taskId) {
        setActiveTaskId(Number(taskId));
      }
    };
    window.addEventListener('active-task-changed', handleActiveTask);
    return () => window.removeEventListener('active-task-changed', handleActiveTask);
  }, []);

  // Subscribe to voice settings changes
  useEffect(() => {
    const handleSettingsChange = () => {
      const current = getVoiceSettings();
      setVoiceSettings(current);
      if (current.assistantEngineMode) {
        setAssistantEngineMode(current.assistantEngineMode as any);
      }
    };
    window.addEventListener('voice_settings_changed', handleSettingsChange);
    return () => window.removeEventListener('voice_settings_changed', handleSettingsChange);
  }, []);

  // Subscribe to native Android speech recognition events and callbacks
  useEffect(() => {
    const handleNativeSpeechResult = (e: any) => {
      const target = e.detail?.target;
      if (target === 'search') return;
      const text = e.detail?.text;
      if (text) {
        setIsListening(false);
        commitUserVoiceCommand(text);
      }
    };

    const handleNativeSpeechCancel = (e: any) => {
      const target = e.detail?.target;
      if (target === 'search') return;
      setIsListening(false);
      setAssistantMessage('تم إيقاف الاستماع.');
    };

    (window as any).onSpeechRecognized = (text: string, target?: string) => {
      if (target === 'search') return;
      if (text) {
        setIsListening(false);
        commitUserVoiceCommand(text);
      }
    };

    (window as any).onSpeechError = (errType: string, target?: string) => {
      if (target === 'search') return;
      setIsListening(false);
      if (errType === 'permission_denied') {
        setAssistantMessage('إذن الميكروفون مطلوب للتعرف الصوتي. يرجى منحه من إعدادات الهاتف.');
      } else if (errType === 'cancelled' || errType === 'no_match') {
        setAssistantMessage('تم إلغاء الاستماع أو لم يُلتقط صوت. انقر للمحاولة مجدداً.');
      } else if (errType === 'service_not_installed' || errType === 'service_not_available') {
        setAssistantMessage('خدمة التعرف الصوتي غير مفعلة، يرجى تفعيل تطبيق Google في الهاتف أو كتابة الأمر أدناه.');
      } else {
        setAssistantMessage('تعذر التقاط الصوت، يمكنك النقر للمحاولة أو كتابة الأمر أدناه.');
      }
    };

    window.addEventListener('native_speech_result', handleNativeSpeechResult);
    window.addEventListener('native_speech_cancel', handleNativeSpeechCancel);

    return () => {
      window.removeEventListener('native_speech_result', handleNativeSpeechResult);
      window.removeEventListener('native_speech_cancel', handleNativeSpeechCancel);
      delete (window as any).onSpeechRecognized;
      delete (window as any).onSpeechError;
    };
  }, []);

  // Handle popstate for native/mobile back button if needed
  useEffect(() => {
    const handlePopState = () => {
      if (isActive) {
        stopAssistant(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActive]);

  // Dynamic CSS classes for assistant themes
  const getBgStyleClass = () => {
    switch (voiceSettings.bgStyle) {
      case 'glass_dark':
        return 'bg-slate-950/95 backdrop-blur-2xl border-2 border-slate-800 text-white shadow-2xl shadow-slate-950/80';
      case 'glass_emerald':
        return 'bg-emerald-950/95 backdrop-blur-2xl border-2 border-emerald-500/60 text-white shadow-2xl shadow-emerald-950/80';
      case 'solid_white':
        return 'bg-white border-2 border-slate-300 text-slate-900 shadow-2xl shadow-slate-900/20';
      case 'solid_slate':
        return 'bg-slate-900 border-2 border-slate-700 text-white shadow-2xl shadow-slate-900/50';
      case 'glass_white':
      default:
        return 'bg-white/95 backdrop-blur-2xl border-2 border-white/90 text-slate-900 shadow-2xl shadow-slate-900/20';
    }
  };

  const getTextColorClass = () => {
    switch (voiceSettings.textColor) {
      case 'emerald':
        return 'text-emerald-950 dark:text-emerald-300';
      case 'sky':
        return 'text-sky-950 dark:text-sky-300';
      case 'amber':
        return 'text-amber-950 dark:text-amber-300';
      case 'dark':
        return 'text-slate-950 dark:text-slate-100';
      case 'light':
        return 'text-white';
      case 'default':
      default:
        return voiceSettings.bgStyle.includes('dark') || voiceSettings.bgStyle.includes('emerald') || voiceSettings.bgStyle === 'solid_slate'
          ? 'text-white'
          : 'text-slate-900';
    }
  };

  const getEffectColorClass = () => {
    switch (voiceSettings.effectColor) {
      case 'sky':
        return {
          iconBg: 'bg-sky-500',
          titleColor: 'text-sky-800 dark:text-sky-300',
          msgBg: 'bg-sky-50/90 border-2 border-sky-400 text-sky-950',
          msgIconBg: 'bg-sky-100 text-sky-800 border border-sky-300'
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-500',
          titleColor: 'text-amber-800 dark:text-amber-300',
          msgBg: 'bg-amber-50/90 border-2 border-amber-400 text-amber-950',
          msgIconBg: 'bg-amber-100 text-amber-800 border border-amber-300'
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-600',
          titleColor: 'text-purple-800 dark:text-purple-300',
          msgBg: 'bg-purple-50/90 border-2 border-purple-400 text-purple-950',
          msgIconBg: 'bg-purple-100 text-purple-800 border border-purple-300'
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-600',
          titleColor: 'text-rose-800 dark:text-rose-300',
          msgBg: 'bg-rose-50/90 border-2 border-rose-400 text-rose-950',
          msgIconBg: 'bg-rose-100 text-rose-800 border border-rose-300'
        };
      case 'emerald':
      default:
        return {
          iconBg: 'bg-emerald-600',
          titleColor: 'text-emerald-800 dark:text-emerald-300',
          msgBg: 'bg-emerald-50/90 border-2 border-emerald-400 text-emerald-950',
          msgIconBg: 'bg-emerald-100 text-emerald-800 border border-emerald-300'
        };
    }
  };

  // Helper to speak back in clean, natural Arabic with 4-Layer Architecture (Native Android Bridge -> Native Capacitor TTS -> Universal Audio Stream -> Web SpeechSynthesis)
  const speakArabic = async (text: string) => {
    if (!text) return;

    // Stop previous audio playback & speech synthesis
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}

    // Clean text for smooth Arabic speech synthesis
    let cleanedText = text
      .replace(/[\*#_`~]/g, '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/المساعد الصوتي/g, 'أنا')
      .replace(/تم بنجاح/g, 'تَمَّ بِنَجَاح')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
      .trim();

    if (!cleanedText) return;

    setIsSpeaking(true);

    const onSpeechFinished = () => {
      setIsSpeaking(false);
      if (isActiveRef.current) {
        setTimeout(() => restartListening(), 350);
      }
    };

    const provider = voiceSettings.voiceEngineProvider || 'auto';

    // Method 1: Android Native Interface Bridge (if provided by custom Android container)
    try {
      if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.speakText === 'function') {
        (window as any).AndroidInterface.speakText(cleanedText);
        const estDuration = Math.min(8000, Math.max(1200, cleanedText.length * 65));
        setTimeout(onSpeechFinished, estDuration);
        return;
      }
    } catch (e) {}

    // Method 2: Android Capacitor Native TTS (Samsung Note 20 Ultra / Android 13)
    // Runs when in native platform or when specific samsung/google provider is chosen
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        try { await TextToSpeech.stop(); } catch (e) {}

        let voiceIndex: number | undefined = undefined;
        try {
          const { voices } = await TextToSpeech.getSupportedVoices();
          if (voices && voices.length > 0) {
            if (provider === 'samsung_voice' || provider === 'samsung_tts') {
              const sIdx = voices.findIndex(v => (v.name || '').toLowerCase().includes('samsung') || (v.name || '').toLowerCase().includes('galaxy'));
              if (sIdx >= 0) voiceIndex = sIdx;
            } else if (provider === 'google_voice' || provider === 'google_tts') {
              const gIdx = voices.findIndex(v => (v.name || '').toLowerCase().includes('google') || (v.name || '').toLowerCase().includes('speech services'));
              if (gIdx >= 0) voiceIndex = gIdx;
            }

            if (typeof voiceIndex === 'undefined') {
              const maleKeywords = ['male', 'رجل', 'ذكور', 'ذكر', 'ard', 'arb', 'arz', 'naayf', 'shakir', 'tarik', 'maged', 'salman', 'hamdan', 'ar-xa', 'ar-sa-x'];
              const maleIdx = voices.findIndex(v => 
                ((v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || (v.name || '').toLowerCase().includes('arabic') || (v.name || '').includes('العربية')) &&
                maleKeywords.some(kw => (v.name || '').toLowerCase().includes(kw))
              );
              if (maleIdx >= 0) {
                voiceIndex = maleIdx;
              } else {
                const anyArIdx = voices.findIndex(v => 
                  (v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || 
                  (v.name || '').toLowerCase().includes('arabic') || 
                  (v.name || '').includes('العربية')
                );
                if (anyArIdx >= 0) voiceIndex = anyArIdx;
              }
            }
          }
        } catch (vErr) {}

        const speakOptions: any = {
          text: cleanedText,
          lang: 'ar-SA',
          rate: voiceSettings.rate || 0.95,
          pitch: voiceSettings.pitch || 0.88,
          volume: voiceSettings.volume || 1.0,
          category: 'ambient',
        };
        if (typeof voiceIndex === 'number') {
          speakOptions.voice = voiceIndex;
        }

        await TextToSpeech.speak(speakOptions);
        onSpeechFinished();
        return;
      }
    } catch (nativeErr) {
      console.warn("Capacitor Native TTS failed, switching to streaming audio:", nativeErr);
    }

    // Method 3: Pristine Natural Arabic Audio Stream (Universal across Web, Mobile, Capacitor)
    // Used when provider is auto or gemini_stream, or as fallback
    if (provider !== 'samsung_tts' && provider !== 'system_default') {
      try {
        const { getApiUrl } = await import('../lib/nativeService');
        const ttsUrl = getApiUrl(`/api/assistant/tts?text=${encodeURIComponent(cleanedText)}`);
        const audio = new Audio(ttsUrl);
        activeAudioRef.current = audio;
        audio.playbackRate = voiceSettings.rate || 1.0;

        let hasFinished = false;
        const completeOnce = () => {
          if (!hasFinished) {
            hasFinished = true;
            activeAudioRef.current = null;
            onSpeechFinished();
          }
        };

        audio.onended = completeOnce;
        audio.onerror = (audioErr) => {
          console.warn("TTS Audio Stream playback failed, falling back to Web Speech:", audioErr);
          activeAudioRef.current = null;
          fallbackWebSpeech(cleanedText, onSpeechFinished);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            console.warn("Audio autoplay blocked, falling back to Web Speech:", playErr);
            activeAudioRef.current = null;
            fallbackWebSpeech(cleanedText, onSpeechFinished);
          });
        }
        return;
      } catch (streamErr) {
        console.warn("Audio creation failed, falling back to Web Speech:", streamErr);
      }
    }

    // Method 4: Browser Web SpeechSynthesis API Fallback
    fallbackWebSpeech(cleanedText, onSpeechFinished);
  };

  const fallbackWebSpeech = (textToSpeak: string, onFinish: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onFinish();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ar-SA';
      utterance.volume = voiceSettings.volume ?? 1.0;
      utterance.rate = voiceSettings.rate ?? 0.95;
      utterance.pitch = voiceSettings.pitch ?? 0.88;

      let finished = false;
      const endFn = () => {
        if (!finished) {
          finished = true;
          onFinish();
        }
      };

      utterance.onend = endFn;
      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        endFn();
      };

      const voices = window.speechSynthesis.getVoices();
      const bestVoice = getBestArabicVoice(voiceSettings.voiceName, voiceSettings.voiceEngineProvider) || voices.find(v => 
        (v.lang || '').toLowerCase().startsWith('ar') || (v.name || '').includes('Arabic') || (v.name || '').includes('العربية')
      );
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      window.speechSynthesis.speak(utterance);

      // Failsafe timer in case onend never fires
      setTimeout(() => {
        if (!finished && !window.speechSynthesis.speaking) {
          endFn();
        }
      }, Math.min(10000, Math.max(2000, textToSpeak.length * 75)));
    } catch (e) {
      console.warn("Web SpeechSynthesis failed:", e);
      onFinish();
    }
  };

  const handleProcessSpeechRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Send assistant reply: updates message, adds to conversational chat, and reads aloud in Arabic
  const sendAssistantReply = (replyText: string) => {
    setAssistantMessage(replyText);
    setChatMessages(prev => [
      ...prev,
      {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date()
      }
    ]);
    speakArabic(replyText);
    setIsProcessing(false);
  };

  // Commit user voice command: converts silence or final recognition into chat message and triggers processing
  const commitUserVoiceCommand = (rawText: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const clean = rawText.trim();
    if (!clean) return;

    currentSpokenBufferRef.current = '';
    setLiveInterimText('');
    setTranscript(clean);

    setChatMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'user',
        text: clean,
        timestamp: new Date()
      }
    ]);

    if (handleProcessSpeechRef.current) {
      handleProcessSpeechRef.current(clean);
    }
  };

  // Auto-scroll chat drawer to bottom on new messages or speech activity
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, liveInterimText, isListening, isProcessing]);

  // Helper to generate concise human-readable action description
  const getCommandDescription = (fnName: string, args: any): string => {
    try {
      if (fnName === 'addNote') {
        return `إضافة ملاحظة "${args.title || 'جديدة'}"`;
      } else if (fnName === 'undoAction') {
        return `محاولة التراجع عن آخر إجراء`;
      } else if (fnName === 'setTaskReminder') {
        const t = args.taskId ? `للمهمة ${args.taskId}` : '';
        return `ضبط تنبيه ${t} بعد ${args.amount} ${args.unit}`.trim();
      } else if (fnName === 'addTask') {
        const cust = args.customerName || 'عميل عام';
        return `إضافة مهمة لـ ${cust}`;
      } else if (fnName === 'updateTaskStatus') {
        return `تحديث المهمة #${args.taskId || ''} إلى ${args.status || ''}`;
      } else if (fnName === 'deleteTask') {
        return `حذف المهمة #${args.taskId || ''}`;
      } else if (fnName === 'updateTaskCost') {
        return `تعديل تكلفة المهمة #${args.taskId || ''} إلى ${args.cost || 0}`;
      } else if (fnName === 'addCustomer') {
        return `إضافة العميل ${args.name || ''}`;
      } else if (fnName === 'addDeposit') {
        return `إضافة دفعة ${args.amount || 0} للمهمة #${args.taskId || ''}`;
      } else if (fnName === 'addDeviceModel') {
        return `إضافة الموديل ${args.modelName || ''}`;
      } else if (fnName === 'shareToWhatsApp') {
        return `مشاركة المهمة #${args.taskId || ''} بالواتساب`;
      } else if (fnName === 'searchQuery') {
        return `البحث عن ${args.query || ''}`;
      } else if (fnName === 'triggerDriveBackup') {
        return `النسخ الاحتياطي السحابي`;
      } else if (fnName === 'openTab') {
        return `فتح قسم ${args.tabName || ''}`;
      } else if (fnName === 'countTasks') {
        return `إحصاء المهام`;
      } else if (fnName === 'getFinancialSummary') {
        return `عرض التقرير المالي`;
      } else if (fnName === 'getFinancialCenterDetails') {
        return `عرض مؤشرات وبيانات المركز المالي`;
      } else if (fnName === 'listCashAccounts') {
        return `عرض الحسابات النقدية وأرصدة الخزائن`;
      } else if (fnName === 'listDebts') {
        return `عرض ديون والتزامات الموردين`;
      } else if (fnName === 'getTaskDetails') {
        return `عرض تفاصيل المهمة #${args.taskId || ''}`;
      } else if (fnName === 'listCustomers') {
        return `عرض قائمة العملاء`;
      } else if (fnName === 'openCustomerTask') {
        return `فتح مهمة العميل ${args.customerName || ''}`;
      }
    } catch (e) {
      console.warn('Error formatting description:', e);
    }
    return `تنفيذ ${fnName}`;
  };

  // Helper to execute tool calls on client DB
  const executeToolCall = async (fnName: string, args: any): Promise<string> => {
    try {
      if (fnName === 'addTask') {
        const { customerName, deviceType, brand, issue, cost } = args;
        let customer = await db.customers.where('name').equals(customerName || 'عميل عام').first();
        if (!customer && customerName) {
          const cid = await db.customers.add({
            name: customerName,
            phone: '',
            address: '',
            classification: 'عادي'
          });
          customer = await db.customers.get(cid);
        }
        const tId = await db.tasks.add({
          customer: customerName || 'عميل عام',
          deviceType: deviceType || 'هاتف',
          brand: brand || '',
          issue: issue || 'صيانة عامة',
          status: 'معلقة',
          cost: cost || 0,
          deposit: 0,
          currency: 'RY',
          notes: 'تمت الإضافة عبر المساعد الصوتي',
          createdAt: new Date().toISOString()
        } as any);
        sessionActionStack.push({ type: 'addTask', data: { taskId: tId } });
        return `تم إنشاء المهمة بنجاح برقم: ${tId}`;
      } 
      
      else if (fnName === 'openCustomerTask') {
        const { customerName, choice } = args;
        const allTasks = await db.tasks.toArray();
        const matched = allTasks
          .filter(t => t.customer && t.customer.toLowerCase().includes((customerName || '').toLowerCase()))
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        
        if (matched.length === 0) {
          return `لم يتم العثور على أي مهمة مسجلة للعميل ${customerName}`;
        }
        
        if (matched.length === 1 && !choice) {
          const t = matched[0];
          setActiveTaskId(t.id!);
          window.dispatchEvent(new CustomEvent('open-task-id', { detail: { taskId: t.id } }));
          return `تم العثور على مهمة وحيدة للعميل ${customerName} (مهمة رقم 1 - #${t.id} - ${t.deviceType} ${t.brand} - ${t.status}). تم فتحها تلقائياً. أنا أستمع لك الآن لأي تعديل أو إضافة تريدها.`;
        }
        
        if (choice) {
          const choiceStr = String(choice).toLowerCase();
          let target: any = null;
          const numMatch = choiceStr.match(/(?:رقم\s*)?(\d+)/);
          if (numMatch) {
            const idx = parseInt(numMatch[1]) - 1;
            if (idx >= 0 && idx < matched.length) {
              target = matched[idx];
            }
          }
          if (!target) {
            if (/^(الأولى|اولى|1)$/.test(choiceStr)) target = matched[0];
            else if (/^(الثانية|ثانية|2)$/.test(choiceStr)) target = matched[1];
            else if (/^(الثالثة|ثالثة|3)$/.test(choiceStr)) target = matched[2];
            else {
              target = matched.find(t => 
                (t.status && t.status.toLowerCase().includes(choiceStr)) || 
                (t.deviceType && t.deviceType.toLowerCase().includes(choiceStr)) || 
                (t.brand && t.brand.toLowerCase().includes(choiceStr)) ||
                (t.issue && t.issue.toLowerCase().includes(choiceStr))
              );
            }
          }

          if (target) {
            setActiveTaskId(target.id!);
            window.dispatchEvent(new CustomEvent('open-task-id', { detail: { taskId: target.id } }));
            setPendingTaskSelection(null);
            const seq = matched.indexOf(target) + 1;
            return `تم فتح مهمة رقم (${seq}) للعميل ${customerName} (رقم #${target.id} - ${target.status}) بنجاح. ما هي التعديلات أو الإضافات التي تود القيام بها عليها؟`;
          }
        }

        setPendingTaskSelection({ customerName, tasks: matched });
        const listStr = matched.map((t, idx) => `مهمة رقم (${idx + 1}) - #${t.id} (${t.deviceType} - ${t.status})`).join('، ');
        return `يوجد للعميل ${customerName} عدة مهام: ${listStr}. هل تود فتح المهمة رقم 1 أم 2 أم المعلقة أم قيد التنفيذ؟`;
      }

      else if (fnName === 'setTaskReminder') {
        const { taskId, amount, unit } = args;
        
        let multiplier = 1;
        if (unit.includes('دقيق')) multiplier = 60 * 1000;
        else if (unit.includes('ساع')) multiplier = 60 * 60 * 1000;
        else if (unit.includes('ثاني')) multiplier = 1000;

        const delayMs = amount * multiplier;
        const fireDate = new Date(Date.now() + delayMs);
        
        const title = "تنبيه مهمة صيانة ⏰";
        const body = taskId ? `تذكير بموعد المهمة رقم #${taskId}` : 'تذكير بموعد المهمة التي طلبتها';

        if ((await import('@capacitor/core')).Capacitor.isNativePlatform()) {
           try {
             const { LocalNotifications } = await import('@capacitor/local-notifications');
             const perm = await LocalNotifications.requestPermissions();
             if (perm.display === 'granted') {
               await LocalNotifications.schedule({
                 notifications: [
                   {
                     title,
                     body,
                     id: Math.floor(Math.random() * 100000),
                     schedule: { at: fireDate }
                   }
                 ]
               });
             }
           } catch(e) { console.error("Local notification err", e); }
        }

        // Web or foreground fallback audio
        setTimeout(() => {
           window.dispatchEvent(new CustomEvent('play-reminder-audio', { detail: { title, body, taskId } }));
        }, delayMs);

        return `تم ضبط المنبه ${taskId ? 'للمهمة '+taskId : ''} بعد ${amount} ${unit}`;
      }
      else if (fnName === 'updateTaskStatus') {
        const { taskId, status } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          const isDelivered = status === 'completed' || status === 'تم التسليم' || status === 'مكتملة ومسلمة' || status === 'مسلمة';
          const totalCost = task.cost || 0;
          const totalDeposit = (task.depositHistory && task.depositHistory.length > 0)
            ? task.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
            : (task.deposit || 0);
          const balance = totalCost - totalDeposit;
          const shouldAutoArchive = isDelivered && balance <= 0;

          await db.tasks.update(Number(taskId), { 
            status,
            updatedAt: new Date().toISOString(),
            ...(shouldAutoArchive ? { isArchived: true, hiddenAt: undefined } : {})
          });
          return shouldAutoArchive 
            ? `تم تحديث حالة المهمة ${taskId} إلى ${status} وأرشفتها تلقائياً لاكتمال الحساب`
            : `تم تحديث حالة المهمة ${taskId} إلى: ${status}`;
        }
        return `المهمة رقم ${taskId} غير موجودة`;
      } 

      else if (fnName === 'deleteTask') {
        const { taskId } = args;
        const numId = Number(taskId);
        const task = await db.tasks.get(numId);
        if (task) {
          await db.tasks.delete(numId);
          try {
            await db.transactions.where('taskId').equals(numId).delete();
          } catch (e) {}
          return `تم حذف المهمة رقم ${taskId} وحذف كافة المعاملات المالية والتكاليف المرتبطة بها بنجاح`;
        }
        return `المهمة رقم ${taskId} غير موجودة`;
      }

      else if (fnName === 'getInventorySummary') {
        const totalItems = await db.inventory.count();
        const items = await db.inventory.toArray();
        const lowStock = items.filter(i => (i.stock || 0) <= (i.minStock || 2));
        return `إجمالي أصناف المخزون: ${totalItems}، والأصناف المنخفضة: ${lowStock.length}${lowStock.length > 0 ? ' (' + lowStock.slice(0, 3).map(i => i.name).join('، ') + ')' : ''}`;
      }

      else if (fnName === 'getBoxBalance') {
        const transactions = await db.transactions.toArray();
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        const balance = income - expense;
        return `رصيد الصندوق والخزينة المتاح حالياً هو ${balance.toLocaleString()} ريال يمني (إجمالي المقبوضات: ${income.toLocaleString()}، وإجمالي المصروفات: ${expense.toLocaleString()}).`;
      }

      else if (fnName === 'getDebtsSummary') {
        const allTasks = await db.tasks.toArray();
        let totalDebt = 0;
        let debtorsCount = 0;
        allTasks.forEach(t => {
          const cost = t.cost || 0;
          const deposit = (t.depositHistory && t.depositHistory.length > 0)
            ? t.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
            : (t.deposit || 0);
          const remaining = cost - deposit;
          if (remaining > 0 && t.status !== 'ملغية') {
            totalDebt += remaining;
            debtorsCount++;
          }
        });
        return `إجمالي المبالغ والديون المتبقية على العملاء هي ${totalDebt.toLocaleString()} ريال يمني موزعة على ${debtorsCount} جهاز صيانة.`;
      }

      else if (fnName === 'getFinancialCenterDetails') {
        const allCashAccounts = await db.cashAccounts?.toArray().catch(() => []) || [];
        const allDebtAccounts = await db.debtAccounts?.toArray().catch(() => []) || [];
        const allInventory = await db.inventory.toArray();
        const allTasks = await db.tasks.toArray();
        const allTransactions = await db.transactions.toArray();

        let totalCash = 0;
        if (allCashAccounts.length > 0) {
          totalCash = allCashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        } else {
          const inc = allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
          const exp = allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
          totalCash = inc - exp;
        }

        const totalInventoryValue = allInventory.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.stock || 0)), 0);

        let customerDues = 0;
        allTasks.forEach(t => {
          const cost = t.cost || 0;
          const deposit = (t.depositHistory && t.depositHistory.length > 0)
            ? t.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
            : (t.deposit || 0);
          const rem = cost - deposit;
          if (rem > 0 && t.status !== 'ملغية') customerDues += rem;
        });

        const totalAssets = totalCash + totalInventoryValue + customerDues;
        const totalDebts = allDebtAccounts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
        const netWorth = totalAssets - totalDebts;

        return `بيانات المركز المالي الشاملة:
• صافي رأس المال العام: ${netWorth.toLocaleString()} ريال
• إجمالي الأصول الكلية: ${totalAssets.toLocaleString()} ريال
• السيولة النقدية وأرصدة الخزائن: ${totalCash.toLocaleString()} ريال
• قيمة رأس مال المخزون: ${totalInventoryValue.toLocaleString()} ريال (${allInventory.length} صنف)
• مستحقات وذمم العملاء (لنا): ${customerDues.toLocaleString()} ريال
• الديون القائمة للموردين (علينا): ${totalDebts.toLocaleString()} ريال`;
      }

      else if (fnName === 'listCashAccounts') {
        const accounts = await db.cashAccounts?.toArray().catch(() => []) || [];
        if (accounts.length === 0) {
          const trans = await db.transactions.toArray();
          const inc = trans.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
          const exp = trans.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
          return `رصيد الصندوق النقدي المتاح هو ${(inc - exp).toLocaleString()} ريال يمني.`;
        }
        const lines = accounts.map(a => `• ${a.name} (${a.type === 'vault' ? 'خزينة' : a.type === 'bank' ? 'بنك' : a.type === 'wallet' ? 'محفظة' : 'صندوق'}): ${Number(a.balance || 0).toLocaleString()} ${a.currency || 'RY'}`).join('\n');
        return `أرصدة الحسابات النقدية والخزائن:\n${lines}`;
      }

      else if (fnName === 'listDebts') {
        const debts = await db.debtAccounts?.toArray().catch(() => []) || [];
        if (debts.length === 0) {
          return 'لا توجد أي ديون أو التزامات قائمة مسجلة على المحل حالياً.';
        }
        const lines = debts.map(d => {
          const rem = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
          return `• ${d.creditorName || d.name}: متبقي ${rem.toLocaleString()} ${d.currency || 'RY'} (${d.purpose || 'التزام'})`;
        }).join('\n');
        const total = debts.reduce((s, d) => s + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
        return `إجمالي الالتزامات والديون القائمة للموردين: ${total.toLocaleString()} ريال\n${lines}`;
      }

      else if (fnName === 'addInventoryItem') {
        const { name, category, price, quantity } = args;
        const itemId = await db.inventory.add({
          name: name || 'صنف جديد',
          category: category || 'قطع غيار',
          sellingPrice: Number(price || 0),
          costPrice: 0,
          stock: Number(quantity || 1),
          minStock: 2,
          currency: 'RY',
          code: 'INV-' + Math.floor(1000 + Math.random() * 9000)
        } as any);
        return `تمت إضافة الصنف "${name}" إلى المخزون برقم #${itemId}`;
      }

      else if (fnName === 'updateTaskCost') {
        const { taskId, cost } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          await db.tasks.update(Number(taskId), { cost: Number(cost) });
          return `تم تحديث تكلفة المهمة ${taskId} إلى ${cost}`;
        }
        return `المهمة رقم ${taskId} غير موجودة`;
      } 
      
      else if (fnName === 'addCustomer') {
        const { name, phone } = args;
        const cid = await db.customers.add({
          name: name,
          phone: phone || '',
          address: '',
          classification: 'عادي'
        });
        return `تم إضافة العميل بنجاح برقم: ${cid}`;
      } 
      
      else if (fnName === 'searchQuery') {
        const { query } = args;
        window.dispatchEvent(new CustomEvent('global-search', { detail: { query } }));
        return `تم تنفيذ البحث عن "${query}" في النظام`;
      } 

      else if (fnName === 'triggerDriveBackup') {
        window.dispatchEvent(new CustomEvent('trigger-drive-backup'));
        return `جاري فتح نافذة النسخ الاحتياطي`;
      }

      else if (fnName === 'openTab') {
        const { tabId, filterQuery } = args;
        if (tabId) {
          window.dispatchEvent(new CustomEvent('change-tab', { detail: { tabId, query: filterQuery } }));
          return `تم الانتقال لقسم ${args.tabName || tabId} ${filterQuery ? 'وتصفيته بـ ' + filterQuery : ''}`;
        }
        return `تم الفتح`;
      }
      else if (fnName === 'addNote') {
        const { title, content, taskId, reminderAmount, reminderUnit } = args;
        window.dispatchEvent(new CustomEvent('add-note-voice', { detail: { title, content, taskId, reminderAmount, reminderUnit } }));
        return `تم إضافة الملاحظة ${title} ${reminderAmount ? 'مع تنبيه' : ''}`;
      }
      else if (fnName === 'undoAction') {
         if (sessionActionStack.length === 0) {
            return 'لا يوجد أي إجراءات سابقة للتراجع عنها.';
         }
         const lastAction = sessionActionStack.pop();
         if (!lastAction) return 'لا يمكن التراجع.';
         
         if (lastAction.type === 'addTask') {
            await db.tasks.delete(lastAction.data.taskId);
            return 'تم التراجع: تم حذف المهمة التي أُضيفت مؤخراً بنجاح.';
         } else if (lastAction.type === 'addCustomer') {
            await db.customers.delete(lastAction.data.customerId);
            return 'تم التراجع: تم حذف العميل الأخير بنجاح.';
         } else if (lastAction.type === 'addNote') {
            // Need to remove note, but notes are stored in localStorage via state in App.tsx
            // We can dispatch an event 'remove-note' that App.tsx can listen to, or we let the user know.
            window.dispatchEvent(new CustomEvent('remove-note-voice', { detail: { noteId: lastAction.data.noteId } }));
            return 'تم التراجع: تم إرسال أمر حذف الملاحظة الأخيرة.';
         }
         return 'تم التراجع عن الإجراء الأخير.';
      }

      else if (fnName === 'countTasks') {
        const total = await db.tasks.count();
        const pending = await db.tasks.where('status').equals('معلقة').count();
        const inProgress = await db.tasks.where('status').equals('قيد التنفيذ').count();
        return `إجمالي المهام المسجلة: ${total}، منها ${pending} معلقة و ${inProgress} قيد التنفيذ.`;
      }

      else if (fnName === 'getFinancialSummary') {
        const transactions = await db.transactions.toArray();
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        const net = income - expense;
        return `المقبوضات: ${income}، المصروفات: ${expense}، والأرباح الصافية: ${net}`;
      }

      else if (fnName === 'getTaskDetails') {
        const { taskId } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          return `تفاصيل المهمة #${task.id}: العميل ${task.customer} - الجهاز: ${task.deviceType} ${task.brand} - المشكلة: ${task.issue} - الحالة: ${task.status} - التكلفة: ${task.cost}`;
        }
        return `المهمة رقم ${taskId} غير موجودة`;
      }

      else if (fnName === 'listCustomers') {
        const count = await db.customers.count();
        const sample = await db.customers.limit(3).toArray();
        const names = sample.map(c => c.name).join('، ');
        return `إجمالي العملاء: ${count}. من أبرزهم: ${names || 'لا يوجد'}`;
      }
      
      else if (fnName === 'addDeposit') {
        const { taskId, amount } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          const newDeposit = (task.deposit || 0) + Number(amount);
          const history = task.depositHistory || [];
          history.push({
            id: Math.random().toString(36).substr(2, 9),
            amount: Number(amount),
            currency: task.currency || 'RY',
            date: new Date().toISOString(),
            note: 'إيداع عبر المساعد الصوتي'
          });
          await db.tasks.update(Number(taskId), { deposit: newDeposit, depositHistory: history });
          
          await db.transactions.add({
            type: 'income',
            amount: Number(amount),
            currency: task.currency || 'RY',
            date: new Date().toISOString(),
            description: `دفعة مقدم لمهمة رقم ${taskId}`,
            customerName: task.customer,
            taskId: Number(taskId)
          } as any);
          return `تم تسجيل دفعة بقيمة ${amount} للمهمة #${taskId}`;
        }
        return `المهمة ${taskId} غير موجودة`;
      } 
      
      else if (fnName === 'addDeviceModel') {
        const { deviceType, brand, modelName } = args;
        await db.deviceModels.add({
          type: deviceType || 'هاتف',
          name: modelName
        } as any);
        return `تم حفظ الموديل ${modelName}`;
      } 
      
      else if (fnName === 'shareToWhatsApp') {
        const { taskId, target } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          const message = `تفاصيل المهمة رقم: ${task.id}\nالعميل: ${task.customer}\nالجهاز: ${task.deviceType} - ${task.brand}\nالعطل: ${task.issue}\nالحالة: ${task.status}\nالتكلفة: ${task.cost}`;
          let phoneNumber = '';
          if (target === 'faisali') {
            phoneNumber = '967770000000';
          } else {
            let customer = await db.customers.where('name').equals(task.customer).first();
            if (customer && customer.phone) {
              phoneNumber = customer.phone;
            }
          }
          if (phoneNumber) {
            window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
          } else {
            navigator.clipboard.writeText(message);
          }
          return `تم جهيز تفاصيل المهمة وفتح الواتساب`;
        }
        return `المهمة غير موجودة`;
      }
    } catch (err: any) {
      console.error("Tool execution error:", err);
      return `حدث خطأ أثناء التنفيذ: ${err.message || ''}`;
    }
    return 'تم الإجراء بنجاح';
  };

  // Local Arabic NLP parser fallback for fast offline recognition
  const parseLocalCommand = (text: string): { handled: boolean; fnName?: string; args?: any; description?: string } => {
    const clean = text.trim().toLowerCase();
    
    // 0. Pending task selection check (when multiple tasks existed for a customer)
    if (pendingTaskSelection) {
      const custName = pendingTaskSelection.customerName;
      const choiceVal = clean;
      setPendingTaskSelection(null);
      return {
        handled: true,
        fnName: 'openCustomerTask',
        args: { customerName: custName, choice: choiceVal },
        description: getCommandDescription('openCustomerTask', { customerName: custName })
      };
    }

    // Customer Task Opening Intent: e.g. "افتح مهمة العميل محمد رقم 1", "مهمة أحمد 2"
    const openCustTaskMatch = clean.match(/(?:افتح|فتح|عرض|هات|أريد|مهمة|مهام)\s+(?:مهمة|مهام)?\s*(?:العميل|لعميل|للعميل|عميل)?\s*(.+)/i);
    if (openCustTaskMatch) {
      let rawText = openCustTaskMatch[1].trim();
      let choiceNum: string | undefined = undefined;
      const numEndMatch = rawText.match(/(.+?)\s+(?:رقم\s*)?(\d+)$/);
      if (numEndMatch) {
        rawText = numEndMatch[1].trim();
        choiceNum = numEndMatch[2];
      }
      const customerName = rawText;
      if (customerName && !/^(المهام|العملاء|المستودع|المحاسبة|التقارير|الإعدادات)$/.test(customerName)) {
        return {
          handled: true,
          fnName: 'openCustomerTask',
          args: { customerName, choice: choiceNum },
          description: getCommandDescription('openCustomerTask', { customerName })
        };
      }
    }

    // Active Task Shorthand Modifications (when a task window is currently open)
    if (activeTaskId) {
      // 1. Status update shorthand
      const statusShortMatch = clean.match(/(?:تحديث|تغيير|تعديل|اجعل)\s+الحالة\s+(?:الى|إلى|بحالة)?\s*(.+)/) || clean.match(/(?:الحالة|بحالة)\s+(.+)/);
      if (statusShortMatch) {
        const newStatus = statusShortMatch[1].trim();
        return {
          handled: true,
          fnName: 'updateTaskStatus',
          args: { taskId: activeTaskId, status: newStatus },
          description: getCommandDescription('updateTaskStatus', { taskId: activeTaskId, status: newStatus })
        };
      }

      // 2. Deposit shorthand
      const depShortMatch = clean.match(/(?:إضافة|اضافة|أضف|اضف)?\s*دفعة\s+(\d+)/);
      if (depShortMatch) {
        const amount = depShortMatch[1];
        return {
          handled: true,
          fnName: 'addDeposit',
          args: { taskId: activeTaskId, amount },
          description: getCommandDescription('addDeposit', { taskId: activeTaskId, amount })
        };
      }

      // 3. Cost update shorthand
      const costShortMatch = clean.match(/(?:تعديل|تغيير|اجعل|تحديد)\s+التكلفة\s+(?:الى|إلى|هي|بـ)?\s*(\d+)/);
      if (costShortMatch) {
        const cost = costShortMatch[1];
        return {
          handled: true,
          fnName: 'updateTaskCost',
          args: { taskId: activeTaskId, cost },
          description: getCommandDescription('updateTaskCost', { taskId: activeTaskId, cost })
        };
      }

      // 4. Delete shorthand
      if (/^(?:حذف|امسح|إزالة)\s*(?:المهمة|مهمة)?$/.test(clean)) {
        return {
          handled: true,
          fnName: 'deleteTask',
          args: { taskId: activeTaskId },
          description: getCommandDescription('deleteTask', { taskId: activeTaskId })
        };
      }
    }

    // 1. Google Drive Backup Intent
    if (/نسخ|درايف|سحابي|تصدير|درائف|backup/i.test(clean) && /احتياط|درايف|جوجل|سحاب|درائف/i.test(clean)) {
      return {
        handled: true,
        fnName: 'triggerDriveBackup',
        args: {},
        description: getCommandDescription('triggerDriveBackup', {})
      };
    }

    // 2. Navigation Intent
    if (/(?:فتح|انتقال|ذهاب|عرض|شاشة|صفحة|قسم)\s+(إعدادات|اعدادات|حسابات|محاسبة|مستودع|مخزون|عملاء|مهام|تقارير|رئيسية)/i.test(clean) || /^(المهام|العملاء|المستودع|المحاسبة|التقارير|الإعدادات)$/.test(clean)) {
      let tabId = 'tasks';
      let tabName = 'المهام';
      if (/إعدادات|اعدادات/.test(clean)) { tabId = 'settings'; tabName = 'الإعدادات'; }
      else if (/حسابات|محاسبة/.test(clean)) { tabId = 'accounting'; tabName = 'المحاسبة'; }
      else if (/مستودع|مخزون/.test(clean)) { tabId = 'inventory'; tabName = 'المستودع'; }
      else if (/عملاء/.test(clean)) { tabId = 'customers'; tabName = 'العملاء'; }
      else if (/مهام/.test(clean)) { tabId = 'tasks'; tabName = 'المهام'; }
      else if (/تقارير/.test(clean)) { tabId = 'reports'; tabName = 'التقارير'; }

      return {
        handled: true,
        fnName: 'openTab',
        args: { tabId, tabName },
        description: getCommandDescription('openTab', { tabName })
      };
    }

    // 3. Count / Status Query Intent
    if (/(?:كم|عدد|إحصائية)\s+(?:المهام|مهام)/i.test(clean) || clean === 'كم عدد المهام') {
      return {
        handled: true,
        fnName: 'countTasks',
        args: {},
        description: getCommandDescription('countTasks', {})
      };
    }

    // 4. Financial Query
    if (/مالي|أرباح|مقبوضات|مصروفات|حسابات|تقرير مالي|التقرير المالي/i.test(clean)) {
      return {
        handled: true,
        fnName: 'getFinancialSummary',
        args: {},
        description: getCommandDescription('getFinancialSummary', {})
      };
    }

    // 4.1 Cash box / Balance Query
    if (/(?:رصيد|فلوس|مبلغ|كم في|كم باقي في)\s*(?:الصندوق|الخزينة|الدرج|الصندوق المتاح|الخزينه)/i.test(clean) || clean.includes('رصيد الصندوق') || clean.includes('رصيد الخزينة')) {
      return {
        handled: true,
        fnName: 'getBoxBalance',
        args: {},
        description: 'معرفة رصيد الصندوق والخزينة المتاح'
      };
    }

    // 4.2 Customer Debts Query
    if (/(?:ديون|مستحقات|متبقي|بواقي|كم الديون|ديون العملاء|ديون الزبائن|باقي على العملاء)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'getDebtsSummary',
        args: {},
        description: 'معرفة إجمالي ديون ومستحقات العملاء المتبقية'
      };
    }

    // 4.3 Financial Center & Net Worth Query
    if (/(?:المركز المالي|راس المال|رأس المال|الأصول|الاصول|صافي رأس المال|مؤشرات المركز المالي)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'getFinancialCenterDetails',
        args: {},
        description: 'معرفة بيانات ومؤشرات المركز المالي ورأس المال والأصول'
      };
    }

    // 4.4 Cash Accounts & Vaults Query
    if (/(?:الحسابات النقدية|الخزائن|البنوك|المحافظ|حسابات الخزائن|ارصدة الحسابات|أرصدة الحسابات|أرصدة الخزائن|ارصدة الخزائن)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'listCashAccounts',
        args: {},
        description: 'عرض تفاصيل وأرصدة كافة الحسابات النقدية والخزائن'
      };
    }

    // 4.5 Debts to Creditors / Liabilities Query
    if (/(?:الديون التي علينا|ديون الموردين|التزامات|الالتزامات|ديون علينا|الممولين)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'listDebts',
        args: {},
        description: 'عرض تفاصيل الديون والالتزامات القائمة للموردين والممولين'
      };
    }

    // 4.6 Inventory Query
    if (/(?:مخزون|المخزون|قطع الغيار|قطع غيار|بضاعة|الأصناف)/i.test(clean) && /(?:كم|عدد|فحص|جرد|عرض|حالة)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'getInventorySummary',
        args: {},
        description: 'جرد أصناف المخزون وقطع الغيار'
      };
    }

    // 5. Customers List Query
    if (/(?:عرض|قائمة|كم عدد)\s+(?:العملاء|عملاء)/i.test(clean)) {
      return {
        handled: true,
        fnName: 'listCustomers',
        args: {},
        description: getCommandDescription('listCustomers', {})
      };
    }

    // 6. Search intent
    if (clean.startsWith('بحث عن') || clean.startsWith('ابحث عن') || clean.startsWith('بحث')) {
      const q = clean.replace(/^(بحث عن|ابحث عن|بحث)\s*/, '');
      if (q) {
        return {
          handled: true,
          fnName: 'searchQuery',
          args: { query: q },
          description: getCommandDescription('searchQuery', { query: q })
        };
      }
    }

    // 6.5 Reminder Intent
    if (/(?:تنبيه|تذكير|ذكرني|منبه)/i.test(clean)) {
      let amount = null;
      let unit = '';
      const timeMatch = clean.match(/بعد\s*(\d+)\s*(دقيقة|ساعة|دقائق|ساعات|دقيقه|ساعه|ثانية|ثواني)/i);
      if (timeMatch) {
         amount = parseInt(timeMatch[1], 10);
         unit = timeMatch[2];
      }
      
      let taskId = activeTaskId ? String(activeTaskId) : undefined;
      const taskMatch = clean.match(/(?:مهمة|المهمة)\s*(?:رقم\s*)?(\d+)/i);
      if (taskMatch) {
         taskId = taskMatch[1];
      }
      
      if (amount) {
         return {
            handled: true,
            fnName: 'setTaskReminder',
            args: { taskId, amount, unit },
            description: getCommandDescription('setTaskReminder', { taskId, amount, unit })
         };
      }
    }

    // 7. Add Task intent: e.g. "إضافة مهمة للعميل محمد جالاكسي اس 21 الشاشة مكسورة"
    const addTaskMatch = clean.match(/(?:إضافة|اضافة|أضف|اضف|إنشاء|انشاء)\s+مهمة\s+(?:جديدة\s+)?(?:لـ|للعميل|لعميل)?\s*([^\d]+)?/i);
    if (addTaskMatch) {
      const rest = addTaskMatch[1] ? addTaskMatch[1].trim() : '';
      const parts = rest.split(/\s+/);
      const customerName = parts[0] || 'عميل جديد';
      const deviceType = parts[1] || 'هاتف';
      const brand = parts[2] || '';
      const issue = parts.slice(3).join(' ') || 'صيانة عامة';

      return {
        handled: true,
        fnName: 'addTask',
        args: { customerName, deviceType, brand, issue, cost: 0 },
        description: getCommandDescription('addTask', { customerName })
      };
    }

    // 8. Status update intent: e.g. "تحديث حالة المهمة 1 الى تم الفحص"
    const statusMatch = clean.match(/(?:تحديث|تغيير|تعديل)\s+حالة\s+(?:المهمة|مهمة)?\s*(\d+)\s+(?:الى|إلى|بحالة)?\s*(.+)/);
    if (statusMatch) {
      const taskId = statusMatch[1];
      const newStatus = statusMatch[2].trim();
      return {
        handled: true,
        fnName: 'updateTaskStatus',
        args: { taskId, status: newStatus },
        description: getCommandDescription('updateTaskStatus', { taskId, status: newStatus })
      };
    }

    // Delete task intent: e.g. "حذف المهمة 3"
    const delMatch = clean.match(/(?:حذف|امسح|إزالة)\s+(?:المهمة|مهمة)?\s*(\d+)/);
    if (delMatch) {
      const taskId = delMatch[1];
      return {
        handled: true,
        fnName: 'deleteTask',
        args: { taskId },
        description: getCommandDescription('deleteTask', { taskId })
      };
    }

    // Update task cost intent: e.g. "تعديل تكلفة المهمة 2 إلى 15000"
    const costMatch = clean.match(/(?:تعديل|تغيير|اجعل|تحديد)\s+تكلفة\s+(?:المهمة|مهمة)?\s*(\d+)\s+(?:الى|إلى|هي|بـ)?\s*(\d+)/);
    if (costMatch) {
      const taskId = costMatch[1];
      const cost = costMatch[2];
      return {
        handled: true,
        fnName: 'updateTaskCost',
        args: { taskId, cost },
        description: getCommandDescription('updateTaskCost', { taskId, cost })
      };
    }

    // 9. Add customer intent: e.g. "اضافة عميل محمد برقم 771234567"
    const custMatch = clean.match(/(?:إضافة|اضافة|أضف|اضف)\s+عميل\s+(?:جديد)?\s*([^\d]+)(?:\s+(?:برقم|رقم|هاتف)\s*(\d+))?/);
    if (custMatch) {
      const cName = custMatch[1].trim();
      const cPhone = custMatch[2] || '';
      if (cName) {
        return {
          handled: true,
          fnName: 'addCustomer',
          args: { name: cName, phone: cPhone },
          description: getCommandDescription('addCustomer', { name: cName, phone: cPhone })
        };
      }
    }

    // 10. Add deposit intent: e.g. "اضافة دفعة 2000 للمهمة 3"
    const depMatch = clean.match(/(?:إضافة|اضافة|أضف|اضف)\s+دفعة\s+(\d+)\s+(?:للمهمة|مهمة|رقم)?\s*(\d+)/);
    if (depMatch) {
      const amount = depMatch[1];
      const taskId = depMatch[2];
      return {
        handled: true,
        fnName: 'addDeposit',
        args: { taskId, amount },
        description: getCommandDescription('addDeposit', { taskId, amount })
      };
    }

    // 11. Task details intent: e.g. "تفاصيل المهمة 5"
    const detailMatch = clean.match(/(?:تفاصيل|معلومات|استعلام)\s+(?:المهمة|مهمة)?\s*(\d+)/);
    if (detailMatch) {
      const taskId = detailMatch[1];
      return {
        handled: true,
        fnName: 'getTaskDetails',
        args: { taskId },
        description: getCommandDescription('getTaskDetails', { taskId })
      };
    }

    return { handled: false };
  };

  // Confirm pending action manually if ever needed
  const confirmAction = async () => {
    if (!pendingAction) return;
    const actionToRun = pendingAction;
    setPendingAction(null);
    setIsProcessing(true);

    const resultStr = await executeToolCall(actionToRun.fnName, actionToRun.args);
    const successMsg = `تم ${actionToRun.description}. ${resultStr}`;
    sendAssistantReply(successMsg);
  };

  // Cancel pending action
  const cancelAction = () => {
    if (!pendingAction) return;
    setPendingAction(null);
    const cancelMsg = `تم الإلغاء.`;
    sendAssistantReply(cancelMsg);
  };

  // Handle extracted financial notifications (أودع / تم تحويل)
  const handleFinancialNotification = (notif: ParsedFinancialNotification) => {
    setIsProcessing(false);
    
    // Attempt to match default cash account from sourceEntity
    let defaultAccId = cashAccounts.length > 0 ? cashAccounts[0].id : undefined;
    if (notif.sourceEntity) {
      const matched = cashAccounts.find(a => a.name.includes(notif.sourceEntity!) || notif.sourceEntity!.includes(a.name));
      if (matched && matched.id) {
        defaultAccId = matched.id;
      }
    }

    const msgId = `msg-fin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (defaultAccId) {
      setActiveSuggestionAccount(prev => ({ ...prev, [msgId]: defaultAccId! }));
    }

    const isDeposit = notif.type === 'deposit';
    const amountStr = `${Number(notif.amount).toLocaleString()} ${notif.currency}`;

    let replyText = '';
    let spokenText = '';

    if (isDeposit) {
      replyText = `📥 إشعار إيداع مستلم:
• المودع: ${notif.partyName}
• المبلغ: ${amountStr}
${notif.sourceEntity ? `• الجهة: ${notif.sourceEntity}\n` : ''}${notif.referenceNumber ? `• رقم المرجع: ${notif.referenceNumber}\n` : ''}
يرجى اختيار أحد الإجراءات لإضافة المبلغ:
1. إيراد لحساب نقدي (خزينة/بنك)
2. إيراد لعميل
3. إيراد للمخزون (مبيعات قطع غيار)`;

      spokenText = `تم استخلاص إشعار إيداع بقيمة ${notif.amount} ${notif.currency} من ${notif.partyName}. يمكنك الآن اختيار إضافة المبلغ كإيراد لحساب نقدي، أو لعميل، أو للمخزون.`;
    } else {
      replyText = `📤 إشعار تحويل صادر:
• المحول له: ${notif.partyName}
• المبلغ: ${amountStr}
${notif.sourceEntity ? `• الجهة: ${notif.sourceEntity}\n` : ''}${notif.referenceNumber ? `• رقم المرجع: ${notif.referenceNumber}\n` : ''}
يرجى اختيار الإجراء لإنشاء المصروف:
1. إنشاء مصروف لحساب نقدي
2. إنشاء مصروف لعميل أو مورد`;

      spokenText = `تم استخلاص إشعار تحويل بقيمة ${notif.amount} ${notif.currency} لصالح ${notif.partyName}. يمكنك الآن إنشاء المصروف لحساب نقدي أو لعميل.`;
    }

    setAssistantMessage(replyText);

    setChatMessages(prev => [
      ...prev,
      {
        id: msgId,
        role: 'assistant',
        text: replyText,
        timestamp: new Date(),
        financialSuggestion: {
          type: notif.type,
          partyName: notif.partyName,
          amount: notif.amount,
          currency: notif.currency,
          sourceEntity: notif.sourceEntity,
          rawText: notif.rawText,
          referenceNumber: notif.referenceNumber,
          executed: false
        }
      }
    ]);

    if (voiceSettings.autoSpeak) {
      speakArabic(spokenText);
    }
  };

  // Execute financial suggestion action
  const handleExecuteSuggestion = async (
    msgId: string,
    actionType: 'cash_account' | 'customer' | 'inventory' | 'account_expense' | 'customer_expense'
  ) => {
    const msg = chatMessages.find(m => m.id === msgId);
    if (!msg || !msg.financialSuggestion) return;
    const { financialSuggestion } = msg;
    if (financialSuggestion.executed) return;

    try {
      const selectedAccId = activeSuggestionAccount[msgId] || (cashAccounts.length > 0 ? cashAccounts[0].id : undefined);
      const selectedAcc = cashAccounts.find(a => a.id === selectedAccId);
      const accName = selectedAcc ? selectedAcc.name : 'الصندوق العام';
      const amount = financialSuggestion.amount;
      const currency = financialSuggestion.currency || 'RY';
      const party = financialSuggestion.partyName;
      const source = financialSuggestion.sourceEntity ? `(عبر ${financialSuggestion.sourceEntity})` : '';
      const ref = financialSuggestion.referenceNumber ? `مرجع: ${financialSuggestion.referenceNumber}` : '';

      let executedDetails = '';

      if (actionType === 'cash_account') {
        // 1. Income to Cash Account
        await db.transactions.add({
          type: 'income',
          amount: Number(amount),
          currency: currency as any,
          date: new Date().toISOString(),
          description: `إيراد إيداع مستلم: ${party} ${source} ${ref}`.trim(),
          category: 'إيداعات بنكية ومحافظ',
          customerName: party,
          cashAccountId: selectedAccId,
          sourceAccount: accName,
          addedBy: 'المساعد الذكي (إشعار)'
        } as any);

        if (selectedAccId && selectedAcc) {
          await db.cashAccounts.update(selectedAccId, {
            balance: (selectedAcc.balance || 0) + Number(amount),
            updatedAt: new Date().toISOString()
          });
        }

        executedDetails = `تم بنجاح قيد إيراد بقيمة ${Number(amount).toLocaleString()} ${currency} لحساب [${accName}]`;
        speakArabic(`تم تسجيل الإيراد بنجاح لحساب ${accName}`);
      } 
      else if (actionType === 'customer') {
        // 2. Income to Customer
        const allCust = await db.customers.toArray();
        const matchedCust = allCust.find(c => c.name.toLowerCase().includes(party.toLowerCase()) || party.toLowerCase().includes(c.name.toLowerCase()));
        const custName = matchedCust ? matchedCust.name : party;

        await db.transactions.add({
          type: 'income',
          amount: Number(amount),
          currency: currency as any,
          date: new Date().toISOString(),
          description: `دفعة إيراد من العميل ${custName} ${source} ${ref}`.trim(),
          category: 'سداد ومستحقات عملاء',
          customerName: custName,
          cashAccountId: selectedAccId,
          sourceAccount: accName,
          addedBy: 'المساعد الذكي (إشعار)'
        } as any);

        if (selectedAccId && selectedAcc) {
          await db.cashAccounts.update(selectedAccId, {
            balance: (selectedAcc.balance || 0) + Number(amount),
            updatedAt: new Date().toISOString()
          });
        }

        // If customer exists, check for pending tasks with dues to credit
        if (matchedCust) {
          const custTasks = await db.tasks.where('customer').equals(custName).toArray();
          const pendingWithDues = custTasks.filter(t => {
            const cost = t.cost || 0;
            const dep = (t.depositHistory && t.depositHistory.length > 0)
              ? t.depositHistory.reduce((s: number, h: any) => s + (h.amount || 0), 0)
              : (t.deposit || 0);
            return (cost - dep) > 0 && t.status !== 'ملغية';
          });

          if (pendingWithDues.length > 0) {
            const targetTask = pendingWithDues[0];
            const history = targetTask.depositHistory || [];
            history.push({
              id: `dep-${Date.now()}`,
              amount: Number(amount),
              currency: (targetTask.currency || currency) as any,
              date: new Date().toISOString(),
              note: `سداد عبر إشعار إيداع (${source})`
            });
            const oldDep = (targetTask.deposit || 0);
            await db.tasks.update(targetTask.id!, {
              deposit: oldDep + Number(amount),
              depositHistory: history
            });
          }
        }

        executedDetails = `تم قيد إيراد وسداد بقيمة ${Number(amount).toLocaleString()} ${currency} لحساب العميل [${custName}] وإيداعها في [${accName}]`;
        speakArabic(`تم تسجيل الإيراد لحساب العميل ${custName} بنجاح`);
      }
      else if (actionType === 'inventory') {
        // 3. Income to Inventory
        await db.transactions.add({
          type: 'income',
          amount: Number(amount),
          currency: currency as any,
          date: new Date().toISOString(),
          description: `إيراد مبيعات مخزون وقطع غيار: من ${party} ${source} ${ref}`.trim(),
          category: 'مبيعات قطع غيار ومخزون',
          customerName: party,
          cashAccountId: selectedAccId,
          sourceAccount: accName,
          addedBy: 'المساعد الذكي (إشعار)'
        } as any);

        if (selectedAccId && selectedAcc) {
          await db.cashAccounts.update(selectedAccId, {
            balance: (selectedAcc.balance || 0) + Number(amount),
            updatedAt: new Date().toISOString()
          });
        }

        executedDetails = `تم قيد إيراد مبيعات مخزون بقيمة ${Number(amount).toLocaleString()} ${currency} لحساب [${accName}]`;
        speakArabic(`تم تسجيل إيراد مبيعات المخزون بنجاح`);
      }
      else if (actionType === 'account_expense') {
        // 4. Expense from Cash Account
        await db.transactions.add({
          type: 'expense',
          amount: Number(amount),
          currency: currency as any,
          date: new Date().toISOString(),
          description: `مصروف تحويل صادر إلى: ${party} ${source} ${ref}`.trim(),
          category: 'مصروفات وتحويلات نقدية',
          customerName: party,
          cashAccountId: selectedAccId,
          sourceAccount: accName,
          addedBy: 'المساعد الذكي (إشعار)'
        } as any);

        if (selectedAccId && selectedAcc) {
          await db.cashAccounts.update(selectedAccId, {
            balance: Math.max(0, (selectedAcc.balance || 0) - Number(amount)),
            updatedAt: new Date().toISOString()
          });
        }

        executedDetails = `تم بنجاح إنشاء مصروف بقيمة ${Number(amount).toLocaleString()} ${currency} مخصوماً من [${accName}]`;
        speakArabic(`تم إنشاء المصروف وخصمه من حساب ${accName}`);
      }
      else if (actionType === 'customer_expense') {
        // 5. Expense to Customer / Supplier
        await db.transactions.add({
          type: 'expense',
          amount: Number(amount),
          currency: currency as any,
          date: new Date().toISOString(),
          description: `مصروف مسدد لـ: ${party} ${source} ${ref}`.trim(),
          category: 'مستحقات عملاء وموردين',
          customerName: party,
          cashAccountId: selectedAccId,
          sourceAccount: accName,
          addedBy: 'المساعد الذكي (إشعار)'
        } as any);

        if (selectedAccId && selectedAcc) {
          await db.cashAccounts.update(selectedAccId, {
            balance: Math.max(0, (selectedAcc.balance || 0) - Number(amount)),
            updatedAt: new Date().toISOString()
          });
        }

        executedDetails = `تم بنجاح إنشاء مصروف مقيد للطرف [${party}] بقيمة ${Number(amount).toLocaleString()} ${currency}`;
        speakArabic(`تم إنشاء المصروف مقيداً للطرف ${party} بنجاح`);
      }

      // Mark suggestion executed in chat
      setChatMessages(prev => prev.map(m => {
        if (m.id === msgId && m.financialSuggestion) {
          return {
            ...m,
            financialSuggestion: {
              ...m.financialSuggestion,
              executed: true,
              executedDetails
            }
          };
        }
        return m;
      }));

      // Broadcast changes
      window.dispatchEvent(new CustomEvent('financial_update'));
      window.dispatchEvent(new CustomEvent('cash_accounts_changed'));
      window.dispatchEvent(new CustomEvent('transaction_added'));
      loadCashAccounts();
    } catch (err: any) {
      console.error('Failed to execute financial suggestion', err);
      alert('حدث خطأ أثناء تنفيذ العملية: ' + (err?.message || 'غير معروف'));
    }
  };

  // Clipboard reader for financial notifications
  const handleReadNotificationFromClipboard = async () => {
    try {
      setIsClipboardReading(true);
      if (!navigator.clipboard?.readText) {
        const text = prompt('الصق نص رسالة الإشعار البنكي هنا (مثال: أودع/محمد أو تم تحويل...):');
        if (text && text.trim()) {
          commitUserVoiceCommand(text.trim());
        }
        return;
      }
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText || !clipboardText.trim()) {
        const text = prompt('الحافظة فارغة، يرجى كتابة أو لصق نص رسالة الإشعار:');
        if (text && text.trim()) {
          commitUserVoiceCommand(text.trim());
        }
        return;
      }
      commitUserVoiceCommand(clipboardText.trim());
    } catch (err) {
      const text = prompt('تعذر الوصول للحافظة تلقائياً. الصق نص رسالة الإشعار هنا:');
      if (text && text.trim()) {
        commitUserVoiceCommand(text.trim());
      }
    } finally {
      setIsClipboardReading(false);
    }
  };

  // Direct, fast, practical speech processor
  const handleProcessSpeech = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text) return;

    setIsProcessing(true);
    setAssistantMessage('جاري معالجة الأمر...');

    try {
      // 0. Check for Financial Notifications starting with "أودع" or "تم تحويل"
      const financialNotif = parseFinancialNotification(text, voiceSettings.allowedNotificationSenders);
      if (financialNotif && financialNotif.isFinancial && (voiceSettings.notificationMonitoringEnabled ?? true)) {
        handleFinancialNotification(financialNotif);
        return;
      }

      // 1. Local fast parser (Instant execution)
      const localParsed = parseLocalCommand(text);
      if (localParsed.handled && localParsed.fnName) {
        const resultStr = await executeToolCall(localParsed.fnName, localParsed.args || {});
        const desc = localParsed.description || 'تنفيذ الأمر';
        const briefMsg = `تم ${desc}. ${resultStr}`;
        sendAssistantReply(briefMsg);
        return;
      }

      // 2. Try Gemini Server Endpoint
      const apiUrl = getApiUrl('/api/assistant/chat');
      
      // Build deep context for Gemini to learn and understand current state
      const tCount = await db.tasks.count();
      const cCount = await db.customers.count();
      
      const allTasks = await db.tasks.toArray();
      const allCustomers = await db.customers.toArray();
      const allDeviceTypes = await db.deviceTypes.toArray();
      const allInventory = await db.inventory.toArray();
      const allTransactions = await db.transactions.toArray();
      const allCashAccounts = await db.cashAccounts?.toArray().catch(() => []) || [];
      const allDebtAccounts = await db.debtAccounts?.toArray().catch(() => []) || [];
      const allNotes = await db.notes?.toArray().catch(() => []) || [];
      
      const income = allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
      const boxBalance = income - expense;

      // Cash Accounts Liquidity
      const totalCashAccounts = allCashAccounts.length > 0 
        ? allCashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
        : boxBalance;

      // Customer Debts
      let totalDebts = 0;
      allTasks.forEach(t => {
        const cost = t.cost || 0;
        const deposit = (t.depositHistory && t.depositHistory.length > 0)
          ? t.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
          : (t.deposit || 0);
        const rem = cost - deposit;
        if (rem > 0 && t.status !== 'ملغية') totalDebts += rem;
      });

      // Inventory valuation
      const totalInventoryValue = allInventory.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.stock || 0)), 0);

      // Creditor debts (liabilities)
      const totalCreditorDebts = allDebtAccounts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);

      // Total assets and net worth
      const totalAssets = totalCashAccounts + totalInventoryValue + totalDebts;
      const netWorth = totalAssets - totalCreditorDebts;
      
      const pendingTasks = allTasks.filter(t => t.status === 'معلقة');
      const inProgressTasks = allTasks.filter(t => t.status === 'قيد التنفيذ' || t.status === 'قيد الصيانة');
      const readyTasks = allTasks.filter(t => t.status === 'جاهزة' || t.status === 'مكتملة');
      const recentTasks = [...allTasks].sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 4);
      
      const brands = [...new Set(allTasks.map(t => t.brand).filter(Boolean))];
      const inventoryNames = allInventory.map(i => `${i.name} (كمية: ${i.stock}، بيع: ${i.sellingPrice} ريال)`).slice(0, 15).join('، ');
      const lowStockItems = allInventory.filter(i => (i.stock || 0) <= (i.minStock || 2));
      const customerNames = allCustomers.map(c => `${c.name}${c.phone ? ' (' + c.phone + ')' : ''}`).slice(0, 30).join('، ');
      const deviceNames = allDeviceTypes.map(d => d.name).join('، ');

      const cashAccountsSummary = allCashAccounts.length > 0 
        ? allCashAccounts.map(a => `${a.name} [${a.type}]: ${Number(a.balance || 0).toLocaleString()} ${a.currency || 'RY'}`).join('، ')
        : `الصندوق الرئيسي: ${boxBalance.toLocaleString()} ريال`;

      const debtsSummary = allDebtAccounts.length > 0
        ? allDebtAccounts.map(d => `${d.creditorName || d.name} (متبقي: ${Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)).toLocaleString()} ${d.currency || 'RY'})`).join('، ')
        : 'لا توجد ديون لموردين';

      const contextString = `
[قاعدة المعرفة الحية الشاملة لتطبيق الفيصل للصيانة:
• بيانات المركز المالي ورأس المال:
  - صافي رأس المال العام (Net Worth): ${netWorth.toLocaleString()} ريال يمني
  - إجمالي الأصول الكلية (Assets): ${totalAssets.toLocaleString()} ريال يمني
  - السيولة النقدية الكلية (Cash Liquidity): ${totalCashAccounts.toLocaleString()} ريال يمني
  - رأس مال المخزون وقطع الغيار: ${totalInventoryValue.toLocaleString()} ريال يمني (${allInventory.length} صنف)
  - مستحقات وديون العملاء المتبقية (Receivables): ${totalDebts.toLocaleString()} ريال يمني
  - التزامات وديون الموردين والممولين (Liabilities): ${totalCreditorDebts.toLocaleString()} ريال يمني

• الحسابات النقدية والخزائن:
  - ${cashAccountsSummary}

• الديون والالتزامات القائمة للموردين:
  - ${debtsSummary}

• إحصائيات المهام وأجهزة الصيانة (${tCount} مهمة):
  - معلقة (${pendingTasks.length})، قيد التنفيذ (${inProgressTasks.length})، جاهزة للتسليم (${readyTasks.length})
  - المهام المعلقة حالياً: ${pendingTasks.slice(0, 5).map(t => `#${t.id}: ${t.customer} (${t.deviceType} ${t.brand})`).join('، ')}
  - أحدث المهام: ${recentTasks.map(t => `#${t.id}: ${t.customer} - ${t.deviceType} (${t.status})`).join('، ')}

• العملاء (${cCount} عميل مسجل):
  - من أبرزهم: ${customerNames}

• المستودع والمخزون:
  - إجمالي الأصناف: ${allInventory.length}
  - عينات الأصناف: ${inventoryNames}
  - أصناف قاربت على النفاد: ${lowStockItems.map(i => `${i.name} (متبقي ${i.stock})`).join('، ') || 'لا يوجد'}

• الملاحظات المسجلة: ${allNotes.length} ملاحظة وتنبيه.

• أقسام التطبيق المتاحة للتنقل والتحكم:
  - tasks (المهام والصيانة)، customers (دليل العملاء)، inventory (المخزن وقطع الغيار)، accounting (الحسابات والخزائن والمركز المالي)، reports (التقارير وسندات القبض)، notes (الملاحظات)، settings (الإعدادات والنسخ الاحتياطي).

تعليمات العمل للمساعد:
أنت المساعد الذكي الخبير المسؤول عن الإجابة عن كل بيانات وتفاصيل وأقسام التطبيق. تحدث باللغة العربية باحترافية وسرعة ودقة مطلقة وأعط الأرقام والإحصائيات والأسماء بوضوح عند السؤال عنها، ويمكنك استدعاء أدوات النظام مباشرة مثل getFinancialCenterDetails أو listCashAccounts أو getDebtsSummary أو countTasks وغيرها.]
`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: text + "\n\n" + contextString,
          mode: voiceSettings.assistantMode || 'professional'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.functionCalls && data.functionCalls.length > 0) {
          const call = data.functionCalls[0];
          const desc = getCommandDescription(call.name, call.args || {});
          const resultStr = await executeToolCall(call.name, call.args || {});
          const briefMsg = `تم ${desc}. ${resultStr}`;
          sendAssistantReply(briefMsg);
          return;
        }

        const reply = data.responseText || 'تم الفهم واستقبال الأمر.';
        sendAssistantReply(reply);
        return;
      }
    } catch (err: any) {
      console.warn("Speech server call fallback:", err);
    }

    // 3. Fallback: Re-try local parsing with broader match
    const fuzzyParsed = parseLocalCommand(text);
    if (fuzzyParsed.handled && fuzzyParsed.fnName) {
      const resultStr = await executeToolCall(fuzzyParsed.fnName, fuzzyParsed.args || {});
      const desc = fuzzyParsed.description || 'تنفيذ الأمر';
      const briefMsg = `تم ${desc}. ${resultStr}`;
      sendAssistantReply(briefMsg);
    } else {
      const fallbackReply = 'أهلاً بك! يمكنك إعطائي أوامر صريحة مثل: "اضف مهمة للعميل محمد"، "فتح المحاسبة"، "كم عدد المهام"، أو "بحث عن جالاكسي".';
      sendAssistantReply(fallbackReply);
    }
  };

  handleProcessSpeechRef.current = handleProcessSpeech;

  // Method 1: Web Browser Microphone & Speech Recognition
  const startWebSpeechRecognition = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setAssistantMessage('إذن الميكروفون مطلوب للبحث الصوتي. يرجى السماح للمتصفح بالوصول للميكروفون.');
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setAssistantMessage('استخدام الميكروفون غير مدعوم على هذا المتصفح، يمكنك كتابة أوامرك في الصندوق أدناه.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {                  
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setAssistantMessage('جاري الاستماع...');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
        setTranscript(finalTranscript);
        handleProcessSpeech(finalTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
          setAssistantMessage('الميكروفون غير متاح أو يحتاج لإذن.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn("Speech recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      // Ensure OS permission is requested in case WebView handles it but Android OS blocked it
      if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.requestAudioPermission === 'function') {
         (window as any).AndroidInterface.requestAudioPermission();
      }

      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsListening(false);
      setAssistantMessage('حدث خطأ في بدء الميكروفون.');
    }
  };

  // Unified Speech Recognition for Assistant
  const restartListening = async () => {
    if (!isActiveRef.current) return;
    if (isSpeakingRef.current) return;

    setIsListening(true);
    setLiveInterimText('');
    currentSpokenBufferRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setAssistantMessage('جاري الاستماع لصوتك عبر الميكروفون... تفضل بنطق أوامرك 🎙️');

    try {
      await startUnifiedSpeechRecognition({
        target: 'assistant',
        language: 'ar-SA',
        prompt: 'مساعد الفيصلي يستمع لك الآن... تفضل بالتحدث بأمرك',
        interimResults: true,
        continuous: true,
        onStart: () => {
          setIsListening(true);
          setAssistantMessage('استمع إليك الآن... تحدث بأمرك');
        },
        onPartialResult: (partialText: string) => {
          noSpeechCountRef.current = 0;
          const clean = partialText.trim();
          if (!clean) return;
          setLiveInterimText(clean);
          currentSpokenBufferRef.current = clean;

          // Silence detection timer: 1200ms of silence commits the text directly to chat
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            const spoken = currentSpokenBufferRef.current.trim();
            if (spoken) {
              commitUserVoiceCommand(spoken);
            }
          }, 1200);
        },
        onResult: (finalTranscript: string) => {
          noSpeechCountRef.current = 0;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          const clean = finalTranscript.trim() || currentSpokenBufferRef.current.trim();
          if (clean) {
            commitUserVoiceCommand(clean);
          }
        },
        onError: async (errMsg: string) => {
          // If error 12 (Android 13 speech recognizer error) or language engine missing, switch to MediaRecorder seamlessly
          if (errMsg && (errMsg === '12' || errMsg.includes('12') || errMsg.toLowerCase().includes('language') || errMsg === 'service_not_installed')) {
            console.log("Error 12 caught in assistant, launching MediaRecorder fallback smoothly...");
            setAssistantMessage('استمع لصوتك الآن عبر الذكاء الاصطناعي... تفضل بالتحدث 🎙️');
            setIsListening(true);
            try {
              const { startMediaRecorderFallback } = await import('../lib/nativeSpeechService');
              await startMediaRecorderFallback({
                target: 'assistant',
                language: 'ar-SA',
                onStart: () => {
                  setIsListening(true);
                  setAssistantMessage('استمع إليك الآن... تفضل بالتحدث 🎙️');
                },
                onResult: (finalTranscript: string) => {
                  setIsListening(false);
                  const clean = finalTranscript.trim();
                  if (clean) {
                    commitUserVoiceCommand(clean);
                  }
                },
                onError: (fbErr: string) => {
                  setIsListening(false);
                  setAssistantMessage(fbErr || 'لم يتم التقاط صوت واضح. انقر على الميكروفون للبدء مجدداً.');
                },
                onEnd: () => {
                  setIsListening(false);
                }
              });
              return;
            } catch (fbErr) {
              console.warn("Direct MediaRecorder fallback error:", fbErr);
            }
          }

          if (errMsg === 'no-speech') {
            noSpeechCountRef.current += 1;
            // If no-speech happens twice, switch seamlessly to MediaRecorder AI to capture microphone directly
            if (noSpeechCountRef.current >= 2) {
              console.log("Repeated no-speech, switching to direct MediaRecorder capture...");
              noSpeechCountRef.current = 0;
              setAssistantMessage('استمع لصوتك الآن... تفضل بنطق طلبك 🎙️');
              setIsListening(true);
              try {
                const { startMediaRecorderFallback } = await import('../lib/nativeSpeechService');
                await startMediaRecorderFallback({
                  target: 'assistant',
                  language: 'ar-SA',
                  onStart: () => {
                    setIsListening(true);
                    setAssistantMessage('استمع إليك الآن... تفضل بالتحدث 🎙️');
                  },
                  onResult: (finalTranscript: string) => {
                    setIsListening(false);
                    const clean = finalTranscript.trim();
                    if (clean) {
                      commitUserVoiceCommand(clean);
                    }
                  },
                  onError: (fbErr: string) => {
                    setIsListening(false);
                    setAssistantMessage(fbErr || 'لم يتم التقاط صوت واضح. انقر على الميكروفون للبدء مجدداً.');
                  },
                  onEnd: () => {
                    setIsListening(false);
                  }
                });
                return;
              } catch (e) {}
            }

            if (isActiveRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
              setTimeout(() => {
                restartListening();
              }, 250);
            }
            return;
          }

          setIsListening(false);
          if (errMsg && errMsg !== 'تم إلغاء الاستماع' && errMsg !== 'cancelled' && errMsg !== 'no_match' && errMsg !== '12') {
            setAssistantMessage(errMsg);
          } else {
            setAssistantMessage('تم إيقاف الاستماع. انقر على أيقونة الميكروفون للبدء مجدداً.');
          }
        },
        onEnd: () => {
          if (currentSpokenBufferRef.current.trim()) {
            commitUserVoiceCommand(currentSpokenBufferRef.current.trim());
          }
        }
      });
    } catch (err: any) {
      console.warn("Speech recognition error in assistant:", err);
      setIsListening(false);
      setAssistantMessage('حدث تعذر في الميكروفون. يرجى التأكد من منحه الإذن.');
    }
  };

  // Start Voice Recognition
  const startAssistant = async () => {
    // إيقاف أي أصوات ناطقة سابقة فوراً لتفريغ قناة الصوت للميكروفون ومنع التداخل
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        try {
          const tts = await import('@capacitor-community/text-to-speech');
          await tts.TextToSpeech.stop();
        } catch (e) {}
      }
    } catch (e) {}

    setIsActive(true);
    setTranscript('');
    setLiveInterimText('');
    currentSpokenBufferRef.current = '';
    setPendingAction(null);
    setIsListening(true);
    setAssistantMessage('استمع إليك الآن... تفضل بنطق أمرك بصوتك 🎙️');

    // Immediate haptic feedback on Android
    try {
      if (navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
    } catch (e) {}

    // بدء الاستماع الصوتي المباشر فوراً
    restartListening();
  };

  const stopAssistant = async (isFromPopState = false) => {
    // إغلاق الواجهة فوراً لضمان الاستجابة السريعة
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    currentSpokenBufferRef.current = '';
    setLiveInterimText('');
    setIsListening(false);
    setIsActive(false);
    setPendingAction(null);
    setTranscript('');

    stopUnifiedSpeechRecognition();

    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
    } catch (e) {}

    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        try { await (await import('@capacitor-community/text-to-speech')).TextToSpeech.stop(); } catch (e) {}
      }
    } catch (e) {}

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    try {
      onClose?.();
      window.dispatchEvent(new CustomEvent('assistant-closed'));
    } catch (e) {}
  };

  const toggleVoice = () => {
    if (isActive) {
      stopAssistant();
    } else {
      startAssistant();
    }
  };


  const handleSendText = () => {
    if (!textInput.trim() || isProcessing) return;
    const msg = textInput.trim();
    setTextInput('');
    setTranscript(msg);
    setChatMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'user',
        text: msg,
        timestamp: new Date()
      }
    ]);
    handleProcessSpeech(msg);
  };

  const handleClick = (e: React.MouseEvent) => {
    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch (err) {}
    if (onClick) {
      onClick(e, toggleVoice);
    } else {
      toggleVoice();
    }
  };

  return (
    <div className="relative inline-flex items-center group">
      {/* Visual glowing aura rings on the icon itself when active */}
      {isActive && (
        <>
          <span className="absolute -inset-2 rounded-full bg-sky-400/30 animate-ping pointer-events-none z-0"></span>
          <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-pulse pointer-events-none z-0"></span>
        </>
      )}

      {/* Main Assistant Button */}
      <button
        type="button"
        onClick={handleClick}
        style={{ touchAction: 'manipulation' }}
        className={cn(
          className || "p-3 rounded-full transition-all shadow-xl flex items-center justify-center relative cursor-pointer z-10",
          isActive
            ? "bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 text-white ring-4 ring-purple-300/80 shadow-purple-500/50 scale-110 border-2 border-purple-200"
            : "bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 text-white border-2 border-white/80 hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/30"
        )}
        title={isActive ? "المساعد الرئيسي نشط... انقر للإيقاف" : "تفعيل المساعد الرئيسي الذكي"}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        ) : isListening ? (
          <div className="relative flex items-center justify-center">
            <Mic className="w-6 h-6 text-sky-200 animate-bounce" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-300 rounded-full animate-ping"></span>
          </div>
        ) : isActive ? (
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <GeminiIcon className="w-6 h-6 text-white transition-transform duration-500 hover:rotate-12" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping"></span>
          </div>
        )}
      </button>

      {/* Mobile-Responsive Floating Assistant Chat Drawer - تغطي ثلثي واجهة التطبيق بالكامل من اليمين لليسار */}
      {isActive && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop Overlay for touch dismiss - خفيف ومناسب للسماح برؤية شريط الإحصائيات والبيانات أعلاه */}
          <div 
            className="fixed inset-0 z-[9998] bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300 animate-in fade-in"
            onClick={(e) => {
              e.stopPropagation();
              stopAssistant();
            }}
          />
          <div 
            dir="rtl"
            className={cn(
              "fixed inset-x-0 bottom-0 z-[9999] w-full left-0 right-0 h-[67dvh] max-h-[68dvh] rounded-t-[28px] sm:rounded-t-[32px] p-3.5 sm:p-4 text-right select-none shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom border-t-2 border-slate-300/80 dark:border-slate-700/80 pb-[max(1.25rem,env(safe-area-inset-bottom,20px))]",
              getBgStyleClass(),
              getTextColorClass()
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top drag handle indicator */}
            <div 
              className="pt-0 pb-2.5 flex justify-center cursor-pointer select-none shrink-0" 
              onClick={() => stopAssistant()}
              title="انقر أو اسحب للإغلاق"
            >
              <div className="w-14 h-1.5 bg-slate-400/40 hover:bg-slate-500/60 rounded-full transition-colors" />
            </div>

            {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/40 pb-2.5 mb-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 border border-white/30 relative",
                isListening ? "bg-sky-500 animate-pulse ring-2 ring-sky-300" : getEffectColorClass().iconBg
              )}>
                {isListening ? <Mic className="w-4 h-4" /> : <GeminiIcon className="w-4 h-4" />}
                {isListening && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs sm:text-sm font-black tracking-wide truncate", getEffectColorClass().titleColor)}>
                    مساعد الفيصلي
                  </span>
                  <span className={cn(
                    "text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-extrabold shrink-0 border",
                    isListening 
                      ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40 animate-pulse" 
                      : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  )}>
                    {isListening ? '🎙️ يستمع' : 'جاهز'}
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  نظام أندرويد و Gemini
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 relative">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 sm:p-2 opacity-85 hover:opacity-100 hover:bg-slate-500/20 rounded-xl transition-colors cursor-pointer border border-slate-400/30 text-xs"
                title="إعدادات المساعد الصوتي"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); stopAssistant(); }}
                className="p-1.5 sm:p-2 opacity-85 hover:opacity-100 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-colors cursor-pointer border border-rose-400/30 text-xs"
                title="إغلاق المساعد الصوتي"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body - Generously sized for 2/3 screen */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-1 text-right">
            {/* Live voice listening waveform indicator */}
            {isListening && (
              <div 
                onClick={() => {
                  stopUnifiedSpeechRecognition();
                  setIsListening(false);
                  setAssistantMessage('تم إيقاف الاستماع. انقر على أيقونة الميكروفون للتحدث مجدداً.');
                }}
                className="bg-gradient-to-r from-sky-500/15 via-indigo-500/20 to-purple-500/15 border border-sky-400/40 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 text-center cursor-pointer active:scale-98 transition-all shadow-inner shrink-0"
                title="انقر لإيقاف الاستماع الصوتي"
              >
                <div className="flex items-center gap-1.5 h-6">
                  <span className="w-1.5 bg-sky-500 rounded-full animate-pulse h-3"></span>
                  <span className="w-1.5 bg-sky-600 rounded-full animate-pulse h-5" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 bg-indigo-500 rounded-full animate-pulse h-6" style={{ animationDelay: '300ms' }}></span>
                  <span className="w-1.5 bg-purple-600 rounded-full animate-pulse h-4" style={{ animationDelay: '450ms' }}></span>
                  <span className="w-1.5 bg-sky-500 rounded-full animate-pulse h-3" style={{ animationDelay: '200ms' }}></span>
                </div>
                <div className="text-xs sm:text-sm font-black text-sky-950 dark:text-sky-200">
                  الميكروفون نشط الآن... تحدث بأمرك الصوتي مباشرة 🎙️
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  (يتم التعرف على صوتك تلقائياً وإرساله فور التوقف عن الكلام)
                </div>
              </div>
            )}

            {/* Conversation Messages List */}
            {chatMessages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                {msg.role === 'user' ? (
                  <div className="flex items-start justify-end gap-1.5 pl-6">
                    <div className="bg-sky-600 text-white rounded-2xl rounded-tr-xs p-2.5 text-xs sm:text-sm font-bold leading-relaxed shadow-sm max-w-[90%]">
                      <div className="flex items-center justify-between gap-2 mb-0.5 text-[10px] text-sky-200 border-b border-sky-500/50 pb-0.5">
                        <span className="font-black flex items-center gap-1">
                          <Mic className="w-2.5 h-2.5 text-sky-200" />
                          أمرك الصوتي
                        </span>
                        <span className="text-[9px] opacity-80">
                          {msg.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-right whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-start gap-1.5 pr-6">
                    <div className={cn(
                      "rounded-2xl rounded-tl-xs p-2.5 text-xs sm:text-sm font-bold leading-relaxed shadow-sm max-w-[92%] border border-emerald-500/30",
                      getEffectColorClass().msgBg
                    )}>
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-emerald-400/30 pb-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                          <div className={cn("p-0.5 rounded-full", getEffectColorClass().msgIconBg)}>
                            <GeminiIcon className="w-2.5 h-2.5 text-emerald-700" />
                          </div>
                          <span>مساعد الفيصلي</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => speakArabic(msg.text)}
                          className="flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-1.5 py-0.5 rounded cursor-pointer active:scale-90 transition-all"
                          title="نطق هذا الرد بالصوت مجدداً"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>نطق</span>
                        </button>
                      </div>
                      <div className="text-right leading-relaxed whitespace-pre-wrap">{msg.text}</div>

                      {/* Interactive Financial Notification Suggestions */}
                      {msg.financialSuggestion && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-400/40 dark:border-emerald-700/60 space-y-2">
                          {msg.financialSuggestion.executed ? (
                            <div className="p-2.5 bg-emerald-100/95 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-700 rounded-xl text-emerald-950 dark:text-emerald-100 flex items-start gap-2 shadow-2xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <div className="text-[11px] font-bold leading-snug">
                                <span className="block font-black text-xs text-emerald-900 dark:text-emerald-200 mb-0.5">
                                  تم إتمام الإجراء بنجاح وتحديث القيود المالية
                                </span>
                                <span>{msg.financialSuggestion.executedDetails}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 bg-white/80 dark:bg-slate-900/90 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                              {/* Account selector if multiple accounts exist */}
                              {cashAccounts.length > 0 && (
                                <div className="flex items-center justify-between gap-1.5 text-[10.5px] bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <label className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1 shrink-0">
                                    <Building2 className="w-3 h-3 text-emerald-600" />
                                    <span>الحساب المقترن:</span>
                                  </label>
                                  <select
                                    value={activeSuggestionAccount[msg.id] || (cashAccounts[0]?.id || '')}
                                    onChange={(e) => setActiveSuggestionAccount({
                                      ...activeSuggestionAccount,
                                      [msg.id]: Number(e.target.value)
                                    })}
                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 font-bold text-slate-800 dark:text-slate-200 outline-none text-[10.5px] max-w-[60%] truncate"
                                  >
                                    {cashAccounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {acc.name} ({Number(acc.balance || 0).toLocaleString()} {acc.currency || 'RY'})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Action Buttons */}
                              {msg.financialSuggestion.type === 'deposit' ? (
                                <div className="space-y-1.5">
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                    <span>خيارات إدراج الإيداع ({Number(msg.financialSuggestion.amount).toLocaleString()} {msg.financialSuggestion.currency}):</span>
                                    <span className="text-emerald-600 font-extrabold text-[9.5px]">اختر جهة الإيراد</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                    {/* Action 1: Cash Account */}
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSuggestion(msg.id, 'cash_account')}
                                      className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Wallet className="w-3.5 h-3.5 shrink-0" />
                                      <span>إيراد لحساب نقدي</span>
                                    </button>

                                    {/* Action 2: Customer */}
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSuggestion(msg.id, 'customer')}
                                      className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                      <span>إيراد لعميل</span>
                                    </button>

                                    {/* Action 3: Inventory */}
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSuggestion(msg.id, 'inventory')}
                                      className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    >
                                      <Package className="w-3.5 h-3.5 shrink-0" />
                                      <span>إيراد لمخزون</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-between">
                                    <span>خيارات إنشاء المصروف ({Number(msg.financialSuggestion.amount).toLocaleString()} {msg.financialSuggestion.currency}):</span>
                                    <span className="text-rose-600 font-extrabold text-[9.5px]">اختر جهة القيد</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {/* Action 1: Cash Account Expense */}
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSuggestion(msg.id, 'account_expense')}
                                      className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    >
                                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                                      <span>مصروف لحساب نقدي</span>
                                    </button>

                                    {/* Action 2: Customer/Supplier Expense */}
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteSuggestion(msg.id, 'customer_expense')}
                                      className="p-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                      <span>مصروف لعميل أو مورد</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live interim spoken voice buffer before silence commit */}
            {liveInterimText && (
              <div className="flex items-start justify-end gap-1.5 pl-6 animate-pulse">
                <div className="bg-sky-500/20 border border-sky-400/60 rounded-2xl rounded-tr-xs p-2 text-xs text-sky-950 dark:text-sky-200 font-bold max-w-[90%] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
                  <span className="italic truncate">{liveInterimText}</span>
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-300/40 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>جاري معالجة الأمر والرد صوتياً...</span>
              </div>
            )}

            {/* Confirmation Prompt Area if Pending Action */}
            {pendingAction && (
              <div className="bg-amber-500/15 border border-amber-400/60 rounded-xl p-2.5 space-y-2 text-slate-900 dark:text-amber-100 shadow-2xs">
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300 font-black text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>تأكيد الإجراء: {pendingAction.description}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={confirmAction}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>نعم (تأكيد)</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelAction}
                    className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>لا (إلغاء)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom scroll anchor */}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick command prompt chips for rapid CRUD voice commands */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 opacity-95 no-scrollbar text-[11px] font-bold shrink-0 border-t border-slate-200/30">
            {(voiceSettings.quickPrompts && voiceSettings.quickPrompts.length > 0 ? voiceSettings.quickPrompts : [
              '📥 لصق إشعار مالي',
              '🏦 أودع/سالم 20,000 عبر الكريمي',
              '💸 تم تحويل 15,000 لشركة الأمل',
              '➕ إضافة مهمة جديدة',
              '📊 التقرير المالي والأرباح',
              '🔍 بحث عن عميل أو جهاز',
              '📋 كم عدد المهام؟',
              '📦 جرد المخزون',
              '📝 كتابة ملاحظة سريعة'
            ]).map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  try { if (navigator.vibrate) navigator.vibrate(20); } catch(e){}
                  if (prompt.includes('لصق إشعار مالي')) {
                    handleReadNotificationFromClipboard();
                    return;
                  }
                  const cleanPrompt = prompt.replace(/^[📥🏦💸➕📊🔍📋📦📝⏰👥]\s*/, '');
                  setTranscript(cleanPrompt);
                  setChatMessages(prev => [
                    ...prev,
                    {
                      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      role: 'user',
                      text: cleanPrompt,
                      timestamp: new Date()
                    }
                  ]);
                  handleProcessSpeech(cleanPrompt);
                }}
                className="px-3 py-1.5 bg-slate-200/80 dark:bg-slate-800/90 hover:bg-emerald-600 hover:text-white border border-slate-300/40 dark:border-slate-700/60 rounded-xl whitespace-nowrap transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center gap-1"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Text Input & Voice Controls Footer Bar */}
          <div className="pt-2 mt-auto border-t border-slate-200/40 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleReadNotificationFromClipboard}
              disabled={isClipboardReading || isProcessing}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60 rounded-xl shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0 flex items-center gap-1"
              title="قراءة واستخلاص إشعار مالي من الحافظة (أودع / تم تحويل)"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendText();
              }}
              placeholder="اكتب أمرك، أو الصق إشعاراً بنكياً..."
              className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleSendText}
              disabled={!textInput.trim() || isProcessing}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 disabled:opacity-40 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
              title="إرسال الأمر"
            >
              <Send className="w-4 h-4 text-slate-800" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopUnifiedSpeechRecognition();
                  setIsListening(false);
                  setAssistantMessage('تم إيقاف الاستماع. انقر للبدء أو اكتب أمرك.');
                } else {
                  restartListening();
                }
              }}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                "p-2 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 shrink-0 border",
                isListening ? "bg-rose-500 animate-pulse text-white border-rose-600" : "bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-yellow-500"
              )}
              title={isListening ? "إيقاف الاستماع الصوتي" : "بدء الاستماع الصوتي"}
            >
              {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-slate-900" />}
            </button>
          </div>
        </div>
        </>,
        document.body
      )}

      {/* Settings Modal */}
      <VoiceAssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
