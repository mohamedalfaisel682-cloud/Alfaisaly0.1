import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
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
  Bell,
  LayoutDashboard,
  ExternalLink,
  Layers,
  Smartphone,
  History,
  Copy,
  Trash2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { db } from '../lib/db';
import { GoogleGenAI, Type } from '@google/genai';
import { CashAccount } from '../types';
import { VoiceAssistantChatHistoryModal } from './VoiceAssistantChatHistoryModal';
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

export const GeminiIcon = ({ className = "w-5 h-5", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
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
  hideMainButton = false,
}: { 
  className?: string; 
  onClick?: (e: React.MouseEvent, toggleVoice: () => void) => void;
  onClose?: () => void;
  hideMainButton?: boolean;
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceAssistantSettings>(getVoiceSettings());

  const [assistantMessage, setAssistantMessage] = useState(
    getVoiceSettings().welcomeMessage || 'أهلاً بك، أنا جاهز لتنفيذ الأوامر.'
  );
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
  const [isDirectChatOnly, setIsDirectChatOnly] = useState(false);
  const [isMainScreenExited, setIsMainScreenExited] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return { x: Math.max(16, window.innerWidth - 76), y: Math.max(80, window.innerHeight - 190) };
    }
    return { x: 20, y: 150 };
  });
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0, bubbleX: 0, bubbleY: 0 });
  const hasMovedRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [assistantEngineMode, setAssistantEngineMode] = useState<1 | 2 | 3 | 4 | 5 | 6>((getVoiceSettings().assistantEngineMode as any) || 6);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);

  // Financial notification handling & cash accounts state
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [activeSuggestionAccount, setActiveSuggestionAccount] = useState<{ [msgId: string]: number }>({});
  const [isClipboardReading, setIsClipboardReading] = useState(false);
  const [showManualPasteModal, setShowManualPasteModal] = useState(false);
  const [manualPasteText, setManualPasteText] = useState('');
  const [isChatHistoryModalOpen, setIsChatHistoryModalOpen] = useState(false);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<AssistantChatMessage | null>(null);
  const touchTimerRef = useRef<any>(null);

  const handleTouchStartMessage = (msg: AssistantChatMessage) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setSelectedMessageForAction(msg);
    }, 450);
  };

  const handleTouchEndMessage = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  const handleDeleteChatMessage = async (msgId: string | number) => {
    const strId = String(msgId);
    setChatMessages(prev => prev.filter(m => String(m.id) !== strId));
    try {
      await db.voiceChats.delete(strId);
    } catch (e) {}
    toast.success('تم حذف الرسالة بنجاح');
    setSelectedMessageForAction(null);
  };

  const handleCopyChatMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ النص إلى الحافظة');
    setSelectedMessageForAction(null);
  };

  const handleShareChatMessage = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مساعد الفيصلي الذكي',
          text: text
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('تم نسخ النص للمشاركة');
    }
    setSelectedMessageForAction(null);
  };

  // Back button (Popstate) support for VoiceAssistant modals
  useEffect(() => {
    if (isChatHistoryModalOpen || isSettingsOpen || isActive) {
      window.history.pushState({ voiceAssistantState: true }, '');

      const handleAssistantPopState = () => {
        if (isChatHistoryModalOpen) {
          setIsChatHistoryModalOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isActive) {
          setIsActive(false);
        }
      };

      window.addEventListener('popstate', handleAssistantPopState);
      return () => {
        window.removeEventListener('popstate', handleAssistantPopState);
      };
    }
  }, [isActive, isSettingsOpen, isChatHistoryModalOpen]);

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
  const lastCommittedTextRef = useRef<string>('');
  const lastCommittedTimeRef = useRef<number>(0);

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
        if (notif && notif.isFinancial && (voiceSettings.notificationMonitoringEnabled ?? true)) {
          setIsActive(true);
          handleFinancialNotification(notif);
        }
      }
    };

    const handleExplicitAssistantSuggestion = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      setIsActive(true);
      if (detail.text || (detail.partyName && detail.amount)) {
        const notif: ParsedFinancialNotification = (detail.text ? parseFinancialNotification(detail.text, voiceSettings.allowedNotificationSenders) : null) || {
          isFinancial: true,
          type: detail.type || 'deposit',
          partyName: detail.partyName || 'مودع / مستلم',
          amount: Number(detail.amount) || 0,
          currency: detail.currency || 'RY',
          sourceEntity: detail.sourceEntity,
          referenceNumber: detail.referenceNumber,
          rawText: detail.text || `${detail.type === 'deposit' ? 'أودع' : 'تم تحويل'} ${detail.partyName} مبلغ ${detail.amount}`,
          confidence: 1.0
        };
        handleFinancialNotification(notif);
      }
    };

    window.addEventListener('bank_notification_received', handleExternalNotification);
    window.addEventListener('incoming_notification', handleExternalNotification);
    window.addEventListener('sms_received', handleExternalNotification);
    window.addEventListener('open_assistant_with_financial_suggestion', handleExplicitAssistantSuggestion);
    return () => {
      window.removeEventListener('bank_notification_received', handleExternalNotification);
      window.removeEventListener('incoming_notification', handleExternalNotification);
      window.removeEventListener('sms_received', handleExternalNotification);
      window.removeEventListener('open_assistant_with_financial_suggestion', handleExplicitAssistantSuggestion);
    };
  }, [voiceSettings, cashAccounts]);

  // Synchronize floating assistant position with main assistant button coordinates or configured position when exiting main screen
  useEffect(() => {
    if (isMainScreenExited) {
      try {
        const saved = localStorage.getItem('faisali_floating_pos_main');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const screenW = window.innerWidth || 412;
            const screenH = window.innerHeight || 915;
            setBubblePos({
              x: Math.min(Math.max(8, parsed.x), screenW - 64),
              y: Math.min(Math.max(50, parsed.y), screenH - 85)
            });
            return;
          }
        }
      } catch (err) {}

      try {
        const btn = document.getElementById('floating-assistant-btn') || document.getElementById('main-assistant-btn');
        if (btn) {
          const rect = btn.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            setBubblePos({
              x: Math.round(rect.left),
              y: Math.round(rect.top)
            });
            return;
          }
        }
      } catch (err) {}

      // Fallback according to configured floating position on edges of mobile screen
      const pos = voiceSettings.floatingExitAssistantPosition || 'bottom-right';
      if (typeof window !== 'undefined') {
        const screenW = window.innerWidth || 412;
        const screenH = window.innerHeight || 915;
        if (pos === 'bottom-left') {
          setBubblePos({ x: 10, y: Math.max(75, screenH - 145) });
        } else if (pos === 'top-right') {
          setBubblePos({ x: Math.max(10, screenW - 68), y: 75 });
        } else if (pos === 'top-left') {
          setBubblePos({ x: 10, y: 75 });
        } else {
          setBubblePos({ x: Math.max(10, screenW - 68), y: Math.max(75, screenH - 145) });
        }
      }
    }
  }, [isMainScreenExited, voiceSettings.floatingExitAssistantPosition]);

  // Cancel any ongoing TTS speech when the component unmounts or exits
  useEffect(() => {
    return () => {
      stopOngoingSpeech();
    };
  }, []);

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
    const handleSettingsChange = (e?: any) => {
      const current = e?.detail || getVoiceSettings();
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

    (window as any).onSpeechError = async (errType: string, target?: string) => {
      if (target === 'search') return;
      console.warn("Native onSpeechError caught:", errType);

      // On Android 13 Samsung Note 20 Ultra: error 12 (ERROR_LANGUAGE_NOT_SUPPORTED) or service missing
      if (errType === '12' || errType?.includes('12') || errType === 'service_not_installed' || errType === 'service_not_available') {
        console.log("Switching to MediaRecorder fallback on Android 13 error 12...");
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
        } catch (fbErr) {}
      }

      setIsListening(false);
      if (errType === 'permission_denied') {
        setAssistantMessage('إذن الميكروفون مطلوب للتعرف الصوتي. يرجى منحه من إعدادات الهاتف.');
      } else if (errType === 'cancelled' || errType === 'no_match') {
        setAssistantMessage('تم إلغاء الاستماع أو لم يُلتقط صوت. انقر للمحاولة مجدداً.');
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

  // Sync settings dynamically when altered in VoiceAssistantSettingsModal
  useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      if (e?.detail) {
        setVoiceSettings(e.detail);
      } else {
        setVoiceSettings(getVoiceSettings());
      }
    };
    window.addEventListener('voice_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('voice_settings_changed', handleSettingsChanged);
  }, []);

  // Listen for exiting main screen or returning to main app
  useEffect(() => {
    const handleExitToFloating = () => {
      setIsMainScreenExited(true);
    };
    const handleFocusMainApp = () => {
      setIsMainScreenExited(false);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsMainScreenExited(true);
      }
    };
    window.addEventListener('exit_to_floating_assistant', handleExitToFloating);
    window.addEventListener('focus_main_app', handleFocusMainApp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('exit_to_floating_assistant', handleExitToFloating);
      window.removeEventListener('focus_main_app', handleFocusMainApp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Direct chat event handler (for first-click open from notifications or external trigger)
  useEffect(() => {
    const handleOpenDirectChat = () => {
      setIsActive(true);
      setIsDirectChatOnly(true);
      restartListening();
    };
    window.addEventListener('open_direct_assistant_chat', handleOpenDirectChat);
    return () => window.removeEventListener('open_direct_assistant_chat', handleOpenDirectChat);
  }, []);

  // Android 13 & Capacitor Background Service & Floating Notification
  useEffect(() => {
    if (!voiceSettings.floatingAssistantOnExit) return;

    let appListenerHandle: any = null;
    let notifListenerHandle: any = null;

    const setupBackgroundService = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { LocalNotifications } = await import('@capacitor/local-notifications');

        // Android 13 High Importance Notification Channel for Floating Assistant
        await LocalNotifications.createChannel({
          id: 'assistant-floating-service',
          name: 'المساعد الصوتي العائم',
          description: 'تشغيل المساعد الصوتي والدردشة الفورية في الخلفية والشاشة الرئيسية',
          importance: 5,
          visibility: 1,
          vibration: false
        }).catch(() => {});

        // Listen for when app goes to background or resumes
        appListenerHandle = await App.addListener('appStateChange', async (state) => {
          if (state.isActive) {
            setIsMainScreenExited(false);
          }
          try {
            await LocalNotifications.cancel({ notifications: [{ id: 88880 }] });
          } catch (err) {}
        });

        // Listen for Notification Tap
        notifListenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          if (notification.notification?.extra?.action === 'open_direct_chat' || notification.notification?.id === 88880) {
            setIsActive(true);
            setIsDirectChatOnly(true);
            restartListening();
          }
        });
      } catch (err) {
        // Fallback or web environment
      }
    };

    setupBackgroundService();

    return () => {
      if (appListenerHandle && typeof appListenerHandle.remove === 'function') appListenerHandle.remove();
      if (notifListenerHandle && typeof notifListenerHandle.remove === 'function') notifListenerHandle.remove();
    };
  }, [voiceSettings.floatingAssistantOnExit]);

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
          msgBg: 'bg-sky-50/90 dark:bg-sky-950/80 border-2 border-sky-400 text-sky-950 dark:text-sky-100',
          msgIconBg: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 border border-sky-300',
          btnActive: 'bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white ring-4 ring-sky-300/80 shadow-sky-500/50 scale-110 border-2 border-white',
          btnNormal: 'bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white border-2 border-white/90 hover:scale-105 active:scale-95 shadow-lg shadow-sky-500/40',
          auraPing: 'bg-sky-400/40',
          auraColor: '#38bdf8',
          geminiColor: '#38bdf8',
          actionBtn: 'bg-sky-600 hover:bg-sky-500 text-white',
          chipHover: 'hover:bg-sky-600 hover:text-white hover:border-sky-600'
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-500',
          titleColor: 'text-amber-800 dark:text-amber-300',
          msgBg: 'bg-amber-50/90 dark:bg-amber-950/80 border-2 border-amber-400 text-amber-950 dark:text-amber-100',
          msgIconBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300',
          btnActive: 'bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 text-slate-950 ring-4 ring-amber-300/80 shadow-amber-500/50 scale-110 border-2 border-white',
          btnNormal: 'bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 text-slate-950 border-2 border-white/90 hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/40',
          auraPing: 'bg-amber-400/40',
          auraColor: '#fbbf24',
          geminiColor: '#fbbf24',
          actionBtn: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
          chipHover: 'hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500'
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-600',
          titleColor: 'text-purple-800 dark:text-purple-300',
          msgBg: 'bg-purple-50/90 dark:bg-purple-950/80 border-2 border-purple-400 text-purple-950 dark:text-purple-100',
          msgIconBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-300',
          btnActive: 'bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 text-white ring-4 ring-purple-300/80 shadow-purple-500/50 scale-110 border-2 border-white',
          btnNormal: 'bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 text-white border-2 border-white/90 hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/40',
          auraPing: 'bg-purple-400/40',
          auraColor: '#c084fc',
          geminiColor: '#c084fc',
          actionBtn: 'bg-purple-600 hover:bg-purple-500 text-white',
          chipHover: 'hover:bg-purple-600 hover:text-white hover:border-purple-600'
        };
      case 'rose':
        return {
          iconBg: 'bg-rose-600',
          titleColor: 'text-rose-800 dark:text-rose-300',
          msgBg: 'bg-rose-50/90 dark:bg-rose-950/80 border-2 border-rose-400 text-rose-950 dark:text-rose-100',
          msgIconBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-300',
          btnActive: 'bg-gradient-to-tr from-rose-600 via-pink-600 to-red-600 text-white ring-4 ring-rose-300/80 shadow-rose-500/50 scale-110 border-2 border-white',
          btnNormal: 'bg-gradient-to-tr from-rose-600 via-pink-600 to-red-600 text-white border-2 border-white/90 hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/40',
          auraPing: 'bg-rose-400/40',
          auraColor: '#fb7185',
          geminiColor: '#fb7185',
          actionBtn: 'bg-rose-600 hover:bg-rose-500 text-white',
          chipHover: 'hover:bg-rose-600 hover:text-white hover:border-rose-600'
        };
      case 'emerald':
      default:
        return {
          iconBg: 'bg-emerald-600',
          titleColor: 'text-emerald-800 dark:text-emerald-300',
          msgBg: 'bg-emerald-50/90 dark:bg-emerald-950/80 border-2 border-emerald-400 text-emerald-950 dark:text-emerald-100',
          msgIconBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300',
          btnActive: 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white ring-4 ring-emerald-300/80 shadow-emerald-500/50 scale-110 border-2 border-white',
          btnNormal: 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white border-2 border-white/90 hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/40',
          auraPing: 'bg-emerald-400/40',
          auraColor: '#34d399',
          geminiColor: '#adffbc',
          actionBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
          chipHover: 'hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
        };
    }
  };

  const isSpeakingCancelledRef = useRef<boolean>(false);
  const speechTimeoutRef = useRef<any>(null);

  // Helper to stop any ongoing speech synthesis immediately across all engines
  const stopOngoingSpeech = async () => {
    isSpeakingCancelledRef.current = true;
    setIsSpeaking(false);

    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
    } catch (e) {}

    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.stop().catch(() => {});
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    try {
      if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.stopSpeaking === 'function') {
        (window as any).AndroidInterface.stopSpeaking();
      }
    } catch (e) {}
  };

  // Helper to speak back in clean, natural Arabic without diacritics/tashkeel using the phone's native default engine
  const speakArabic = async (text: string) => {
    if (!text) return;

    // Reset cancellation flag
    isSpeakingCancelledRef.current = false;

    // Stop previous audio playback & speech synthesis
    await stopOngoingSpeech();
    isSpeakingCancelledRef.current = false;

    // Clean text for pristine, natural Arabic speech synthesis without any diacritics / tashkeel (حركات النطق)
    const cleanedText = cleanTextForArabicSpeech(text);
    if (!cleanedText) return;

    if (isSpeakingCancelledRef.current || !isActiveRef.current) return;

    setIsSpeaking(true);

    const onSpeechFinished = () => {
      if (isSpeakingCancelledRef.current) return;
      setIsSpeaking(false);
      setIsListening(false);
    };

    const gender = voiceSettings.voiceGender || 'male';
    const effectivePitch = gender === 'male' ? 0.72 : gender === 'female' ? 1.05 : (voiceSettings.pitch || 0.95);
    const effectiveRate = gender === 'male' ? 0.92 : (voiceSettings.rate || 0.95);

    // Method 1: Android Native Interface Bridge (Android WebView)
    try {
      if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.speakText === 'function') {
        (window as any).AndroidInterface.speakText(cleanedText);
        const estDuration = Math.min(8000, Math.max(1200, cleanedText.length * 65));
        setTimeout(() => {
          if (!isSpeakingCancelledRef.current) onSpeechFinished();
        }, estDuration);
        return;
      }
    } catch (e) {}

    // Method 2: Android Capacitor Native TTS (Samsung Note 20 Ultra / Android 13)
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        try { await TextToSpeech.stop(); } catch (e) {}

        if (isSpeakingCancelledRef.current || !isActiveRef.current) return;

        let voiceIndex: number | undefined = undefined;
        try {
          const { voices } = await TextToSpeech.getSupportedVoices();
          if (voices && voices.length > 0) {
            const maleKeywords = ['male', 'رجل', 'ذكور', 'ذكر', 'ard', 'arb', 'arz', 'naayf', 'shakir', 'tarik', 'maged', 'salman', 'hamdan', 'ar-xa', 'ar-sa-x'];
            const femaleKeywords = ['female', 'امرأة', 'أنثى', 'انثى', 'fatima', 'zariyah', 'layla', 'mariam', 'nour', 'zeina', 'salma'];

            if (gender === 'male') {
              const maleIdx = voices.findIndex(v => 
                ((v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || (v.name || '').toLowerCase().includes('arabic') || (v.name || '').includes('العربية')) &&
                maleKeywords.some(kw => (v.name || '').toLowerCase().includes(kw))
              );
              if (maleIdx >= 0) voiceIndex = maleIdx;
            } else if (gender === 'female') {
              const femIdx = voices.findIndex(v => 
                ((v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || (v.name || '').toLowerCase().includes('arabic') || (v.name || '').includes('العربية')) &&
                femaleKeywords.some(kw => (v.name || '').toLowerCase().includes(kw))
              );
              if (femIdx >= 0) voiceIndex = femIdx;
            }

            if (typeof voiceIndex === 'undefined') {
              const anyArIdx = voices.findIndex(v => 
                (v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || 
                (v.name || '').toLowerCase().includes('arabic') || 
                (v.name || '').includes('العربية')
              );
              if (anyArIdx >= 0) voiceIndex = anyArIdx;
            }
          }
        } catch (vErr) {}

        const speakOptions: any = {
          text: cleanedText,
          lang: 'ar-SA',
          rate: effectiveRate,
          pitch: effectivePitch,
          volume: voiceSettings.volume || 1.0,
          category: 'ambient',
        };
        if (typeof voiceIndex === 'number') {
          speakOptions.voice = voiceIndex;
        }

        if (isSpeakingCancelledRef.current || !isActiveRef.current) return;
        await TextToSpeech.speak(speakOptions);
        if (!isSpeakingCancelledRef.current) {
          onSpeechFinished();
        }
        return;
      }
    } catch (nativeErr) {
      console.warn("Capacitor Native TTS fallback:", nativeErr);
    }

    // Method 3: Device Default Web SpeechSynthesis API Fallback
    fallbackWebSpeech(cleanedText, onSpeechFinished);
  };

  const fallbackWebSpeech = (textToSpeak: string, onFinish: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onFinish();
      return;
    }

    if (isSpeakingCancelledRef.current || !isActiveRef.current) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'ar-SA';
      const gender = voiceSettings.voiceGender || 'male';
      const effectivePitch = gender === 'male' ? 0.72 : gender === 'female' ? 1.05 : (voiceSettings.pitch || 0.95);
      const effectiveRate = gender === 'male' ? 0.92 : (voiceSettings.rate || 0.95);

      utterance.volume = voiceSettings.volume ?? 1.0;
      utterance.rate = effectiveRate;
      utterance.pitch = effectivePitch;

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

      const bestVoice = getBestArabicVoice(gender, voiceSettings.voiceName);
      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang || 'ar-SA';
      }

      // Android Chromium & WebView fix: cancel() right before speak() silences SpeechSynthesis.
      // A small timeout with resume() guarantees voice output on Android 13 & modern browsers.
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
      speechTimeoutRef.current = setTimeout(() => {
        if (isSpeakingCancelledRef.current || !isActiveRef.current) {
          try { window.speechSynthesis.cancel(); } catch (e) {}
          return;
        }
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (spkErr) {
          console.warn("SpeechSynthesis speak exception:", spkErr);
          endFn();
        }
      }, 50);

      // Failsafe timer in case onend never fires
      setTimeout(() => {
        if (!finished && !window.speechSynthesis.speaking) {
          endFn();
        }
      }, Math.min(12000, Math.max(2500, textToSpeak.length * 80)));
    } catch (err) {
      console.error("Web Speech Synthesis error:", err);
      onFinish();
    }
  };

  const handleProcessSpeechRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Send assistant reply: updates message, adds to conversational chat, and reads aloud in Arabic
  const sendAssistantReply = (replyText: string) => {
    setAssistantMessage(replyText);
    
    setChatMessages(prev => {
      // Prevent adding exact duplicate assistant message if it was just added as the last message
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.text === replyText) {
        return prev;
      }
      const msgId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const msg = {
        id: msgId,
        role: 'assistant' as const,
        text: replyText,
        timestamp: new Date()
      };

      try {
        db.voiceChats.put({
          id: msgId,
          role: 'assistant',
          text: replyText,
          timestamp: new Date().toISOString()
        });
      } catch (e) {}

      return [...prev, msg];
    });

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

    // Deduping check: ignore duplicate prompt sent within 2.2 seconds
    const now = Date.now();
    if (lastCommittedTextRef.current === clean && (now - lastCommittedTimeRef.current) < 2200) {
      return;
    }
    lastCommittedTextRef.current = clean;
    lastCommittedTimeRef.current = now;

    stopUnifiedSpeechRecognition();
    setIsListening(false);
    currentSpokenBufferRef.current = '';
    setLiveInterimText('');
    setTextInput(''); // Completely clear text input box without leaving leftover text
    setTranscript(clean);

    const userMsgId = `user-${now}-${Math.random().toString(36).substring(2, 6)}`;
    const userMsg = {
      id: userMsgId,
      role: 'user' as const,
      text: clean,
      timestamp: new Date()
    };

    setChatMessages(prev => {
      // Failsafe check to prevent duplicate user message in state
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'user' && lastMsg.text === clean) {
        return prev;
      }
      return [...prev, userMsg];
    });

    // Save user command to IndexedDB
    try {
      db.voiceChats.put({
        id: userMsgId,
        role: 'user',
        text: clean,
        timestamp: new Date().toISOString()
      });
    } catch (e) {}

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
      } else if (fnName === 'openWindow') {
        const namesMap: Record<string, string> = {
          newTask: 'نافذة إضافة مهمة جديدة',
          newCustomer: 'نافذة إضافة عميل',
          newInventory: 'نافذة إضافة صنف للمخزون',
          accounts: 'نافذة الحسابات والمعاملات',
          debts: 'نافذة الديون والالتزامات',
          flashSettings: 'إعدادات الواجهة الفلاشية',
          voiceSettings: 'إعدادات المساعد الصوتي',
          backup: 'نافذة النسخ الاحتياطي',
          quickNotes: 'الملاحظات السريعة',
          closeModals: 'إغلاق النوافذ'
        };
        return `فتح ${namesMap[args.windowName] || args.windowName}`;
      } else if (fnName === 'toggleSetting') {
        return `${args.enable ? 'تفعيل' : 'إلغاء تفعيل'} ${args.setting === 'flashTicker' ? 'الواجهة الفلاشية' : args.setting === 'darkMode' ? 'الوضع الليلي' : args.setting === 'voiceSpeech' ? 'النطق الصوتي' : args.setting}`;
      } else if (fnName === 'setFlashTaskRange') {
        return `تغيير نطاق مهام الواجهة الفلاشية`;
      } else if (fnName === 'filterTasks') {
        return `تصفية المهام لعرض (${args.status || 'الكل'})`;
      } else if (fnName === 'addFinancialTransaction') {
        return `تسجيل ${args.type === 'expense' ? 'مصروف' : 'إيراد'} بقيمة ${args.amount || 0}`;
      } else if (fnName === 'addDebtAccount') {
        return `تسجيل دين للمورد ${args.creditorName || ''}`;
      } else if (fnName === 'payDebt') {
        return `سداد دفعة للمورد ${args.creditorName || ''}`;
      } else if (fnName === 'deleteCustomer') {
        return `حذف العميل ${args.name || ''}`;
      } else if (fnName === 'deleteInventoryItem') {
        return `حذف الصنف ${args.name || ''}`;
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
          executionTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isAlarmActive: true,
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
            const seq = matched.indexOf(target) + 1;
            return `تم فتح مهمة رقم (${seq}) للعميل ${customerName} (رقم #${target.id} - ${target.status}) بنجاح. ما هي التعديلات أو الإضافات التي تود القيام بها عليها؟`;
          }
        }

        const latestTask = matched[matched.length - 1];
        setActiveTaskId(latestTask.id!);
        window.dispatchEvent(new CustomEvent('open-task-id', { detail: { taskId: latestTask.id } }));
        const listStr = matched.map((t, idx) => `مهمة رقم (${idx + 1}) - #${t.id} (${t.deviceType} - ${t.status})`).join('، ');
        return `تم فتح المهمة الأخيرة للعميل ${customerName} (#${latestTask.id} - ${latestTask.status}). المهام المسجلة له: ${listStr}.`;
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
        const { taskId, customerName, status } = args;
        let task: any = null;
        if (taskId && !isNaN(Number(taskId))) {
          task = await db.tasks.get(Number(taskId));
        }
        if (!task && customerName) {
          const clean = String(customerName).trim().toLowerCase();
          const all = await db.tasks.toArray();
          const matched = all
            .filter(t => t.customer && t.customer.toLowerCase().includes(clean))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          if (matched.length > 0) task = matched[0];
        }
        if (!task && activeTaskId) {
          task = await db.tasks.get(activeTaskId);
        }

        if (task && task.id) {
          const isDelivered = status === 'completed' || status === 'تم التسليم' || status === 'مكتملة ومسلمة' || status === 'مسلمة';
          const totalCost = task.cost || 0;
          const totalDeposit = (task.depositHistory && task.depositHistory.length > 0)
            ? task.depositHistory.reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0)
            : (task.deposit || 0);
          const balance = totalCost - totalDeposit;
          const shouldAutoArchive = isDelivered && balance <= 0;

          await db.tasks.update(task.id, { 
            status,
            updatedAt: new Date().toISOString(),
            ...(shouldAutoArchive ? { isArchived: true, hiddenAt: undefined } : {})
          });
          return shouldAutoArchive 
            ? `تم تحديث حالة المهمة #${task.id} للعميل "${task.customer}" إلى ${status} وأرشفتها تلقائياً لاكتمال الحساب`
            : `تم تحديث حالة المهمة #${task.id} للعميل "${task.customer}" إلى: ${status}`;
        }
        return `لم يتم العثور على مهمة صيانة مطابقة لتعديل حالتها.`;
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
        const { name, category, price, sellingPrice, costPrice, quantity, stock } = args;
        const itemId = await db.inventory.add({
          name: name || 'صنف جديد',
          category: category || 'قطع غيار',
          sellingPrice: Number(sellingPrice || price || 0),
          costPrice: Number(costPrice || 0),
          stock: Number(stock || quantity || 1),
          minStock: 2,
          currency: 'RY',
          code: 'INV-' + Math.floor(1000 + Math.random() * 9000)
        } as any);
        return `تمت إضافة الصنف "${name}" إلى المخزون بنجاح برقم #${itemId}`;
      }

      else if (fnName === 'updateInventoryItem') {
        const { itemId, name, stock, sellingPrice } = args;
        let item = null;
        if (itemId) {
          item = await db.inventory.get(Number(itemId));
        } else if (name) {
          item = await db.inventory.where('name').equalsIgnoreCase(name).first();
          if (!item) {
            const all = await db.inventory.toArray();
            item = all.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
          }
        }
        if (item && item.id) {
          const updates: any = {};
          if (stock !== undefined) updates.stock = Number(stock);
          if (sellingPrice !== undefined) updates.sellingPrice = Number(sellingPrice);
          await db.inventory.update(item.id, updates);
          return `تم تحديث بيانات الصنف "${item.name}" في المخزون بنجاح (الكمية: ${updates.stock ?? item.stock}، السعر: ${updates.sellingPrice ?? item.sellingPrice} ريال).`;
        }
        return `لم يتم العثور على الصنف المحدد في المخزون.`;
      }

      else if (fnName === 'updateCustomer') {
        const { customerId, name, phone, classification } = args;
        let customer = null;
        if (customerId) {
          customer = await db.customers.get(Number(customerId));
        } else if (name) {
          customer = await db.customers.where('name').equalsIgnoreCase(name).first();
          if (!customer) {
            const all = await db.customers.toArray();
            customer = all.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
          }
        }
        if (customer && customer.id) {
          const updates: any = {};
          if (phone !== undefined) updates.phone = phone;
          if (classification !== undefined) updates.classification = classification;
          await db.customers.update(customer.id, updates);
          return `تم تحديث بيانات العميل "${customer.name}" بنجاح.`;
        }
        return `لم يتم العثور على العميل المراد تعديل بياناته.`;
      }

      else if (fnName === 'addCashAccount') {
        const { name, type, balance, currency } = args;
        const aid = await db.cashAccounts?.add({
          name: name || 'حساب جديد',
          type: (type || 'cashbox') as any,
          balance: Number(balance || 0),
          currency: (currency || 'RY') as any,
          createdAt: new Date().toISOString()
        } as any);
        return `تم إضافة الحساب النقدي "${name}" برصيد ${Number(balance || 0).toLocaleString()} ${currency || 'RY'} بنجاح (رقم #${aid}).`;
      }

      else if (fnName === 'updateTaskDetails') {
        const { taskId, issue, deviceType, brand, cost } = args;
        const task = await db.tasks.get(Number(taskId));
        if (task) {
          const updates: any = { updatedAt: new Date().toISOString() };
          if (issue) updates.issue = issue;
          if (deviceType) updates.deviceType = deviceType;
          if (brand) updates.brand = brand;
          if (cost !== undefined) updates.cost = Number(cost);
          await db.tasks.update(Number(taskId), updates);
          return `تم تعديل بيانات المهمة #${taskId} بنجاح.`;
        }
        return `المهمة رقم ${taskId} غير موجودة.`;
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

      else if (fnName === 'getFinancialSummary' || fnName === 'getDailySummary') {
        const transactions = await db.transactions.toArray();
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTrans = transactions.filter(t => (t.date || '').startsWith(todayStr));
        const todayIncome = todayTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
        const todayExpense = todayTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        const todayNet = todayIncome - todayExpense;

        const allIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
        const allExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        const allNet = allIncome - allExpense;

        const allTasks = await db.tasks.toArray();
        const readyTasks = allTasks.filter(t => t.status === 'جاهزة' || t.status === 'جاهز للتسليم');

        if (todayTrans.length > 0) {
          return `دخل اليوم: ${todayIncome.toLocaleString()} ريال، والمصروفات: ${todayExpense.toLocaleString()} ريال، وصافي أرباح اليوم: ${todayNet.toLocaleString()} ريال. ولديك ${readyTasks.length} أجهزة جاهزة للتسليم.`;
        }
        return `إجمالي المقبوضات: ${allIncome.toLocaleString()} ريال، والمصروفات: ${allExpense.toLocaleString()} ريال، والأرباح الصافية: ${allNet.toLocaleString()} ريال، ويوجد ${readyTasks.length} أجهزة جاهزة للتسليم.`;
      }

      else if (fnName === 'getReadyTasksSummary') {
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'filterTasks', status: 'جاهزة' } }));
        const allTasks = await db.tasks.toArray();
        const ready = allTasks.filter(t => t.status === 'جاهزة' || t.status === 'جاهز للتسليم');
        if (ready.length === 0) {
          return 'لا توجد أجهزة جاهزة للتسليم حالياً في جدول الصيانة.';
        }
        const sampleNames = ready.slice(0, 3).map(t => `${t.deviceType || 'جهاز'} ${t.brand || ''} للعميل ${t.customer || ''}`).join('، و ');
        const extra = ready.length > 3 ? `، بالإضافة إلى ${ready.length - 3} أجهزة أخرى` : '';
        return `لديك ${ready.length} أجهزة جاهزة للتسليم: ${sampleNames}${extra}.`;
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
        const { taskId, customerName, amount, isLastTask } = args;
        const numAmount = Number(amount || 0);
        if (numAmount <= 0) return 'يرجى تحديد مبلغ الدفعة بشكل صحيح.';

        let targetTask: any = null;

        // 1. If explicit numeric taskId is provided
        if (taskId && !isNaN(Number(taskId))) {
          targetTask = await db.tasks.get(Number(taskId));
        }

        // 2. If customerName is provided (or if task not found by ID yet)
        if (!targetTask && customerName) {
          const cleanCust = String(customerName).trim().toLowerCase();
          const allTasks = await db.tasks.toArray();
          const matchedTasks = allTasks
            .filter(t => t.customer && t.customer.toLowerCase().includes(cleanCust))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          if (matchedTasks.length > 0) {
            targetTask = matchedTasks[0]; // latest task for customer
          } else {
            // Customer might exist without tasks or partial name match on customers table
            const allCust = await db.customers.toArray();
            const matchedCust = allCust.find(c => c.name.toLowerCase().includes(cleanCust) || cleanCust.includes(c.name.toLowerCase()));
            const finalCustName = matchedCust ? matchedCust.name : customerName;

            // Record direct income transaction for customer
            const transId = await db.transactions.add({
              type: 'income',
              amount: numAmount,
              currency: 'RY',
              date: new Date().toISOString(),
              description: `سداد دفعة حساب للعميل ${finalCustName}`,
              customerName: finalCustName,
              addedBy: 'المساعد الصوتي'
            } as any);

            // Update default cash account balance
            const accounts = await db.cashAccounts?.toArray().catch(() => []) || [];
            if (accounts.length > 0) {
              const firstAcc = accounts[0];
              await db.cashAccounts?.update(firstAcc.id!, {
                balance: (firstAcc.balance || 0) + numAmount
              });
            }

            return `تم بنجاح تسجيل دفعة حساب بقيمة ${numAmount.toLocaleString()} ريال للعميل "${finalCustName}" (سند رقم #${transId}).`;
          }
        }

        // 3. Fallback: Check activeTaskId or last overall task
        if (!targetTask && !customerName) {
          if (activeTaskId) {
            targetTask = await db.tasks.get(activeTaskId);
          }
          if (!targetTask) {
            const all = await db.tasks.toArray();
            if (all.length > 0) {
              all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
              targetTask = all[0];
            }
          }
        }

        if (targetTask && targetTask.id) {
          const newDeposit = (targetTask.deposit || 0) + numAmount;
          const history = targetTask.depositHistory || [];
          history.push({
            id: 'dep-' + Math.random().toString(36).substr(2, 9),
            amount: numAmount,
            currency: targetTask.currency || 'RY',
            date: new Date().toISOString(),
            note: 'دفعة سداد عبر المساعد الصوتي'
          });
          await db.tasks.update(targetTask.id, { deposit: newDeposit, depositHistory: history });
          
          await db.transactions.add({
            type: 'income',
            amount: numAmount,
            currency: targetTask.currency || 'RY',
            date: new Date().toISOString(),
            description: `دفعة سداد لمهمة رقم #${targetTask.id} (${targetTask.deviceType || 'جهاز'} ${targetTask.brand || ''})`,
            customerName: targetTask.customer,
            taskId: targetTask.id,
            addedBy: 'المساعد الصوتي'
          } as any);

          // Update default cash account balance
          const accounts = await db.cashAccounts?.toArray().catch(() => []) || [];
          if (accounts.length > 0) {
            const firstAcc = accounts[0];
            await db.cashAccounts?.update(firstAcc.id!, {
              balance: (firstAcc.balance || 0) + numAmount
            });
          }

          const rem = Math.max(0, (targetTask.cost || 0) - newDeposit);
          return `تم بنجاح تسجيل دفعة بقيمة ${numAmount.toLocaleString()} ريال للمهمة #${targetTask.id} للعميل "${targetTask.customer}" (${targetTask.deviceType} ${targetTask.brand}). المتبقي: ${rem.toLocaleString()} ريال.`;
        }

        return `لم يتم العثور على أي مهمة أو عميل مطابق لتسجيل الدفعة.`;
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
      } else if (fnName === 'openWindow') {
        const { windowName } = args;
        if (windowName === 'closeModals' || windowName === 'close') {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'closeModals' } }));
          return 'تم إغلاق كافة النوافذ المفتوحة بنجاح.';
        }
        if (windowName === 'voiceSettings') {
          setIsSettingsOpen(true);
          return 'تم فتح نافذة إعدادات المساعد الصوتي.';
        }
        if (windowName === 'chat_history') {
          setIsChatHistoryModalOpen(true);
          return 'تم فتح سجل محادثات وأوامر المساعد الصوتي.';
        }
        if (windowName === 'ui_settings') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'ui_settings' } }));
          return 'تم فتح نافذة تخصيص وإعدادات الواجهة والمظهر.';
        }
        if (windowName === 'user_management') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'user_management' } }));
          return 'تم فتح نافذة إدارة المستخدمين والصلاحيات.';
        }
        if (windowName === 'export_settings') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'export_settings' } }));
          return 'تم فتح نافذة إعدادات التصدير والطباعة.';
        }
        if (windowName === 'daily_shortcuts') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'daily_shortcuts' } }));
          return 'تم فتح نافذة اختصارات البند اليومي.';
        }
        if (windowName === 'rates') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'rates' } }));
          return 'تم فتح نافذة أسعار الصرف والعملات.';
        }
        if (windowName === 'omni_preview') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'omni_preview' } }));
          return 'تم فتح شاشة اللمحة الشاملة والمعاينة الخاطفة للبيانات.';
        }
        if (windowName === 'backup') {
          window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'backup' } }));
          return 'تم فتح نافذة النسخ الاحتياطي وإدارة البيانات.';
        }
        if (windowName === 'flashSettings') {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'flashSettings' } }));
          return 'تم فتح نافذة إعدادات الواجهة الفلاشية.';
        }
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: windowName } }));
        const namesMap: Record<string, string> = {
          newTask: 'إضافة مهمة صيانة جديدة',
          newCustomer: 'دليل وإضافة العملاء',
          newInventory: 'إضافة صنف للمخزون والمستودع',
          accounts: 'الحسابات والمعاملات المالية',
          debts: 'الديون والالتزامات',
          backup: 'النسخ الاحتياطي السحابي',
          quickNotes: 'الملاحظات السريعة'
        };
        return `تم فتح شاشة ${namesMap[windowName] || windowName} بنجاح دون الحاجة للنقر على الشاشة.`;
      } else if (fnName === 'toggleSetting') {
        const { setting, enable } = args;
        const isTrue = enable === true || enable === 'true' || enable === 1;
        if (setting === 'flashTicker') {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'toggleFlashTicker', value: isTrue } }));
          return isTrue ? 'تم تفعيل وإظهار شريط المهام الفلاشي.' : 'تم إيقاف وإخفاء شريط المهام الفلاشي.';
        }
        if (setting === 'darkMode') {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'toggleDarkMode', value: isTrue } }));
          return isTrue ? 'تم تفعيل الوضع الليلي (المظلم).' : 'تم تفعيل الوضع النهاري (الفاتح).';
        }
        if (setting === 'voiceSpeech') {
          const cur = getVoiceSettings();
          saveVoiceSettings({ ...cur, autoSpeak: isTrue });
          setVoiceSettings(prev => ({ ...prev, autoSpeak: isTrue }));
          return isTrue ? 'تم تفعيل النطق الصوتي لردود المساعد.' : 'تم إيقاف النطق الصوتي وجعله صامتاً.';
        }
        if (setting === 'assistantIcon') {
          window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'toggleAssistantFloating', value: isTrue } }));
          return isTrue ? 'تم إظهار أيقونة المساعد.' : 'تم إخفاء أيقونة المساعد.';
        }
        return `تم ضبط إعداد ${setting} بنجاح.`;
      } else if (fnName === 'setFlashTaskRange') {
        const { range } = args;
        const validRanges = ['1day', '2days', '3days', '4days', '1week', '1month'];
        const targetRange = validRanges.includes(range) ? range : '2days';
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'setFlashRange', range: targetRange } }));
        const labels: Record<string, string> = {
          '1day': 'اليوم القادم',
          '2days': 'اليومين القادمين',
          '3days': 'الثلاثة أيام القادمة',
          '4days': 'الأربعة أيام القادمة',
          '1week': 'الأسبوع القادم',
          '1month': 'الشهر القادم'
        };
        return `تم تغيير نطاق عرض مهام الواجهة الفلاشية إلى: ${labels[targetRange] || targetRange}.`;
      } else if (fnName === 'filterTasks') {
        const { status } = args;
        window.dispatchEvent(new CustomEvent('voice-action', { detail: { action: 'filterTasks', status: status || 'الكل' } }));
        return `تم تصفية قائمة المهام لعرض: ${status || 'كافة المهام'}.`;
      } else if (fnName === 'addFinancialTransaction') {
        const { type, amount, description, category } = args;
        const transType = (type === 'expense' || type === 'صرف' || type === 'مصروف') ? 'expense' : 'income';
        const numAmount = Number(amount || 0);
        const transId = await db.transactions.add({
          type: transType,
          amount: numAmount,
          currency: 'RY',
          date: new Date().toISOString(),
          description: description || (transType === 'expense' ? 'مصروف عام' : 'إيراد صيانة'),
          category: category || (transType === 'expense' ? 'مصروفات' : 'إيرادات'),
        } as any);

        const accounts = await db.cashAccounts?.toArray().catch(() => []) || [];
        if (accounts.length > 0) {
          const firstAcc = accounts[0];
          const diff = transType === 'income' ? numAmount : -numAmount;
          await db.cashAccounts?.update(firstAcc.id!, {
            balance: (firstAcc.balance || 0) + diff
          });
        }

        return `تم تسجيل المعاملة المالية (${transType === 'expense' ? 'مصروف' : 'إيراد'} بقيمة ${numAmount.toLocaleString()} ريال: ${description || ''}) برقم #${transId}.`;
      } else if (fnName === 'addDebtAccount') {
        const { creditorName, totalAmount, purpose, currency } = args;
        const debtId = await db.debtAccounts?.add({
          name: creditorName || 'مورد عام',
          creditorName: creditorName || 'مورد عام',
          totalAmount: Number(totalAmount || 0),
          paidAmount: 0,
          currency: (currency as any) || 'RY',
          purpose: purpose || 'شراء بضاعة/التزام',
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'active',
          payments: [],
          createdAt: new Date().toISOString()
        } as any);
        return `تم تسجيل دين جديد للمورد "${creditorName}" بمبلغ ${Number(totalAmount).toLocaleString()} ${currency || 'ريال'} برقم #${debtId}.`;
      } else if (fnName === 'payDebt') {
        const { creditorName, debtId, amount } = args;
        const numAmount = Number(amount || 0);
        let debt = null;
        if (debtId) {
          debt = await db.debtAccounts?.get(Number(debtId));
        } else if (creditorName) {
          const debts = await db.debtAccounts?.toArray() || [];
          debt = debts.find((d: any) => (d.creditorName || d.name || '').toLowerCase().includes(creditorName.toLowerCase()));
        }
        if (debt && debt.id) {
          const newPaid = (debt.paidAmount || 0) + numAmount;
          const isFull = newPaid >= (debt.totalAmount || 0);
          const currentPayments = Array.isArray(debt.payments) ? [...debt.payments] : [];
          currentPayments.push({
            id: Date.now(),
            amount: numAmount,
            date: new Date().toISOString(),
            notes: 'سداد دفعة بالأمر الصوتي'
          });
          await db.debtAccounts?.update(debt.id, {
            paidAmount: newPaid,
            status: isFull ? 'settled' : 'active',
            payments: currentPayments,
            updatedAt: new Date().toISOString()
          } as any);
          await db.transactions.add({
            type: 'expense',
            amount: numAmount,
            currency: debt.currency || 'RY',
            date: new Date().toISOString(),
            description: `سداد دفعة من دين المورد ${debt.creditorName || debt.name}`,
            category: 'سداد ديون'
          } as any);
          return `تم سداد ${numAmount.toLocaleString()} ريال للمورد "${debt.creditorName || debt.name}" (المتبقي: ${Math.max(0, (debt.totalAmount || 0) - newPaid).toLocaleString()} ريال).`;
        }
        return `لم يتم العثور على حساب الدين للمورد ${creditorName || ''}.`;
      } else if (fnName === 'deleteCustomer') {
        const { customerId, name } = args;
        let customer = null;
        if (customerId) {
          customer = await db.customers.get(Number(customerId));
        } else if (name) {
          const all = await db.customers.toArray();
          customer = all.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()));
        }
        if (customer && customer.id) {
          await db.customers.delete(customer.id);
          return `تم حذف العميل "${customer.name}" بنجاح.`;
        }
        return `لم يتم العثور على العميل المراد حذفه.`;
      } else if (fnName === 'deleteInventoryItem') {
        const { itemId, name } = args;
        let item = null;
        if (itemId) {
          item = await db.inventory.get(Number(itemId));
        } else if (name) {
          const all = await db.inventory.toArray();
          item = all.find((i: any) => i.name.toLowerCase().includes(name.toLowerCase()));
        }
        if (item && item.id) {
          await db.inventory.delete(item.id);
          return `تم حذف الصنف "${item.name}" من المخزون بنجاح.`;
        }
        return `لم يتم العثور على الصنف المراد حذفه من المخزون.`;
      } else if (fnName === 'addDropdownOption') {
        const { listName, optionValue } = args;
        if (optionValue && optionValue.trim()) {
          const val = optionValue.trim();
          window.dispatchEvent(new CustomEvent('add-dropdown-option-voice', { detail: { listName, optionValue: val } }));
          return `تمت إضافة الخيار "${val}" إلى قائمة ${listName || 'الخيارات المنسدلة'} بنجاح.`;
        }
        return `يرجى تحديد النص المراد إضافته للقائمة المنسدلة.`;
      } else if (fnName === 'addCustomerPhone') {
        const { customerName, phone } = args;
        if (customerName) {
          const all = await db.customers.toArray();
          const customer = all.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()));
          if (customer && customer.id) {
            await db.customers.update(customer.id, { phone: phone || '' });
            return `تم تحديث وحفظ رقم الهاتف ${phone || ''} للعميل "${customer.name}" بنجاح.`;
          } else {
            const cid = await db.customers.add({
              name: customerName,
              phone: phone || '',
              address: '',
              classification: 'عادي'
            });
            return `تم تسجيل العميل "${customerName}" وحفظ رقم الهاتف ${phone || ''} له برقم #${cid}.`;
          }
        }
        return `يرجى تحديد اسم العميل لإضافة رقم الهاتف.`;
      } else if (fnName === 'updateCustomerTaskStatus') {
        const { customerName, status } = args;
        if (customerName && status) {
          const allTasks = await db.tasks.toArray();
          const matched = allTasks.filter(t => t.customer && t.customer.toLowerCase().includes(customerName.toLowerCase()));
          if (matched.length > 0) {
            const latestTask = matched[matched.length - 1];
            await db.tasks.update(latestTask.id!, { status, updatedAt: new Date().toISOString() });
            return `تم تغيير حالة المهمة #${latestTask.id} للعميل "${latestTask.customer}" إلى "${status}" بنجاح.`;
          }
          return `لم يتم العثور على أجهزة أو مهام مسجلة للعميل ${customerName}.`;
        }
        return `يرجى تحديد العميل والحالة الجديدة.`;
      } else if (fnName === 'exportTaskOrAccountDocument') {
        const { targetType, identifier } = args;
        if (targetType === 'task') {
          const tId = Number(identifier) || parseInt(String(identifier).replace(/\D/g, ''));
          if (tId) {
            window.dispatchEvent(new CustomEvent('open-task-id', { detail: { taskId: tId, print: true } }));
            return `تم فتح وطباعة سند ومستند المهمة رقم #${tId} بنجاح.`;
          }
        } else {
          window.dispatchEvent(new CustomEvent('open-account-report', { detail: { identifier } }));
          return `تم فتح كشف حساب ومستند "${identifier}" للتصدير والطباعة بنجاح.`;
        }
        return `تم تصدير وإخراج المستند المطلوبة.`;
      } else if (fnName === 'getCustomerData') {
        const { customerName } = args;
        if (customerName) {
          const customers = await db.customers.toArray();
          const cust = customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()));
          const tasks = await db.tasks.toArray();
          const custTasks = tasks.filter(t => t.customer && t.customer.toLowerCase().includes(customerName.toLowerCase()));
          
          if (!cust && custTasks.length === 0) {
            return `لم يتم العثور على أي بيانات مسجلة للعميل "${customerName}".`;
          }
          
          const phone = cust?.phone || custTasks.find(t => t.customerPhones && t.customerPhones.length > 0)?.customerPhones?.[0] || 'غير مسجل';
          const tasksSummary = custTasks.map(t => `• مهمة #${t.id}: ${t.deviceType || 'جهاز'} ${t.brand || ''} - العطل: ${t.issue || ''} - الحالة: ${t.status || 'معلقة'} - التكلفة: ${t.cost || 0}`).join('\n');
          
          return `بيانات العميل "${cust?.name || customerName}":
• الهاتف: ${phone}
• التصنيف: ${cust?.classification || 'عادي'}
• عدد المهام: ${custTasks.length}
${tasksSummary ? 'تفاصيل المهام:\n' + tasksSummary : 'لا توجد مهام حالية'}`;
        }
        return 'يرجى تحديد اسم العميل لاستخراج البيانات.';
      } else if (fnName === 'getInventoryItemData') {
        const { itemName } = args;
        if (itemName) {
          const items = await db.inventory.toArray();
          const matched = items.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
          if (matched) {
            return `تفاصيل الصنف "${matched.name}":
• الكود: ${matched.code || 'بدون'}
• القسم: ${matched.category || 'عام'}
• المتوفر بالمخزون: ${matched.stock || 0}
• سعر البيع: ${matched.sellingPrice || 0} ريال
• سعر التكلفة: ${matched.costPrice || 0} ريال`;
          }
          return `لم يتم العثور على الصنف "${itemName}" في المخزون.`;
        }
        return 'يرجى تحديد اسم الصنف.';
      }

      else if (fnName === 'addCurrency' || fnName === 'deleteCurrency') {
        const { currencyName } = args;
        window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'rates' } }));
        return `تم فتح شاشة أسعار الصرف والعملات لإجراء العملية على العملة "${currencyName || ''}" بنجاح.`;
      }

      else if (fnName === 'exportData' || fnName === 'saveReport') {
        window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'export_settings' } }));
        return 'تم فتح نافذة تصدير وحفظ البيانات والتقارير بملفات Excel / PDF / JSON بنجاح.';
      }

      else if (fnName === 'importData') {
        window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'backup' } }));
        return 'تم فتح نافذة استيراد واسترجاع ملفات البيانات والنسخ الاحتياطي بنجاح.';
      }

      else if (fnName === 'printReport') {
        window.dispatchEvent(new CustomEvent('open-modal-voice', { detail: { modal: 'export_settings' } }));
        return 'تم فتح نافذة إعدادات الطباعة والتصدير للمستندات والتقارير بنجاح.';
      }
    } catch (err: any) {
      console.error("Tool execution error:", err);
      return `حدث خطأ أثناء التنفيذ: ${err.message || ''}`;
    }
    return 'تم الإجراء بنجاح';
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

      // Synchronize with main notifications list
      try {
        const stored = JSON.parse(localStorage.getItem('faisali_financial_notifications') || '[]');
        const updated = stored.map((item: any) => {
          if (item.rawText === financialSuggestion.rawText || (item.amount === financialSuggestion.amount && item.partyName === financialSuggestion.partyName)) {
            return { ...item, isExecuted: true, executedDetails };
          }
          return item;
        });
        localStorage.setItem('faisali_financial_notifications', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('financial_notifications_updated'));
      } catch (e) {}

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

      // 1. Attempt using Capacitor Clipboard plugin (Native Android / Capacitor)
      try {
        const { Clipboard } = await import('@capacitor/clipboard');
        const capResult = await Clipboard.read();
        if (capResult && capResult.value && capResult.value.trim()) {
          toast.success('تم جلب نص الإشعار من الحافظة بنجاح');
          commitUserVoiceCommand(capResult.value.trim());
          return;
        }
      } catch (capErr) {
        // Fallback to web browser clipboard
      }

      // 2. Attempt using Web Clipboard API if available and document focused
      if (navigator.clipboard?.readText) {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && clipboardText.trim()) {
            toast.success('تم جلب نص الإشعار من الحافظة بنجاح');
            commitUserVoiceCommand(clipboardText.trim());
            return;
          }
        } catch (webErr) {
          // Fallback to manual paste modal
        }
      }

      // 3. Clean fallback: Open in-app smooth paste modal (No native browser prompt dialog!)
      setManualPasteText('');
      setShowManualPasteModal(true);
    } catch (err) {
      setManualPasteText('');
      setShowManualPasteModal(true);
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

      // 1. Process Voice Command via Gemini AI Assistant Engine (Internal App System Only)
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

• أقسام التطبيق المتاحة للتنقل والتحكم والوصول (عبر أداة openTab أو تنفيذ الإجراء المباشر):
  - tasks (مهام الصيانة والأجهزة، تصفية بالبحث أو الحالة)
  - customers (دليل العملاء، إضافة وتعديل العملاء والاتصال بهم)
  - inventory (المستودع والمخزون وقطع الغيار، إضافة وتعديل الأصناف)
  - accounting (الحسابات المالية، الصناديق، الخزائن، الحسابات النقدية، المركز المالي والديون)
  - reports (التقارير وسندات القبض وكشوفات الحسابات)
  - notes (الملاحظات السريعة والمفكرة)
  - settings (إعدادات التطبيق، التخصيص، والنسخ الاحتياطي)

تعليمات العمل الاحترافية للمساعد الذكي:
1. أنت المساعد الذكي والخبير الحصري والشامل لنظام (الفيصل للصيانة). تمتلك صلاحية كاملة لتنفيذ كل الأوامر والعمليات دون حاجة المستخدم للمس الشاشة.
2. يمكنك استدعاء الدوال بدقة:
   - إضافة مهمة: addTask، تعديل حالة مهمة: updateTaskStatus، تعديل تكلفة أو تفاصيل مهمة: updateTaskCost أو updateTaskDetails، حذف مهمة: deleteTask، البحث عن وفتح جهاز عميل: openCustomerTask.
   - إضافة عميل: addCustomer، تعديل عميل: updateCustomer، سرد العملاء: listCustomers.
   - إضافة صنف للمخزون: addInventoryItem، تعديل صنف مخزون: updateInventoryItem، ملخص المخزون: getInventorySummary.
   - إضافة حساب أو صندوق نقدي: addCashAccount، عرض الحسابات النقدية: listCashAccounts، رصيد الخزينة: getBoxBalance، المركز المالي: getFinancialCenterDetails، ديون العملاء: getDebtsSummary، ديون الموردين: listDebts.
   - التنقل بين النوافذ والأقسام: openTab، البحث الشامل: searchQuery، إضافة ملاحظة أو تنبيه: addNote / setTaskReminder، النسخ الاحتياطي: triggerDriveBackup، والتراجع: undoAction.
3. استجب دائماً باللغة العربية بأسلوب راقٍ، سريع، ومحكم، ونفذ الأوامر مباشرة ثم أخبر المستخدم بما تم بدقة وثقة.]
`;

      let isServerSuccess = false;
      try {
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
            const results: string[] = [];
            const isProfessional = (voiceSettings.assistantMode || 'professional') === 'professional';
            for (const call of data.functionCalls) {
              const desc = getCommandDescription(call.name, call.args || {});
              const resultStr = await executeToolCall(call.name, call.args || {});
              const isDirectAnswer = resultStr.startsWith('تم ') || resultStr.includes(':') || resultStr.includes('ريال') || resultStr.includes('أجهزة') || resultStr.includes('يوجد') || resultStr.includes('إجمالي') || resultStr.includes('رصيد') || resultStr.includes('دخل') || resultStr.includes('لديك');
              results.push(isProfessional && isDirectAnswer ? resultStr : `تم ${desc}. ${resultStr}`);
            }
            const combinedMsg = results.join(' | ');
            sendAssistantReply(combinedMsg);
            return;
          }

          const reply = data.responseText || 'تم الفهم واستقبال الأمر.';
          sendAssistantReply(reply);
          return;
        }
      } catch (err: any) {
        console.warn("Speech server call failed, trying direct client Gemini fallback:", err);
      }

      // 2.5 Direct Client Gemini Fallback (for Android APK Capacitor & offline/standalone mode)
      const directKey = voiceSettings.geminiApiKey || (import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '');
      if (directKey) {
        try {
          const aiInstance = new GoogleGenAI({ apiKey: directKey });
          const isProfessional = (voiceSettings.assistantMode || 'professional') === 'professional';
          const systemPrompt = isProfessional
            ? `أنت (مساعد الفيصل المحترف) - الخبير الصوتي والذكاء الاصطناعي لنظام "الفيصل للصيانة".
تتميز بالقدرة الفائقة على فهم الأوامر الصوتية باللغة العربية وتنفيذها فوراً مهما كانت صياغتها، واستخراج أسماء العملاء والأرقام والمهام.
نمطك الحالي: إجابة مباشرة وحاسمة بأقصر عبارة بدون مقدمات أو حشو وبدون تشكيل.`
            : `أنت المساعد الذكي والخبير الشامل لتطبيق (الفيصل للصيانة). تفهم الأوامر باللغة العربية وتعتمد على بيانات النظام المحفوظة.`;

          const clientTools = [{
            functionDeclarations: [
              { name: "searchQuery", description: "البحث في التطبيق عبر شريط البحث السريع", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
              { name: "addTask", description: "أضف مهمة صيانة جديدة.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, deviceType: { type: Type.STRING }, brand: { type: Type.STRING }, issue: { type: Type.STRING }, cost: { type: Type.NUMBER } }, required: ["customerName", "deviceType", "issue"] } },
              { name: "updateTaskStatus", description: "تحديث حالة مهمة صيانة موجودة.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, customerName: { type: Type.STRING }, status: { type: Type.STRING } }, required: ["status"] } },
              { name: "deleteTask", description: "حذف مهمة صيانة نهائياً.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER } }, required: ["taskId"] } },
              { name: "updateTaskCost", description: "تحديث أو تعديل التكلفة التقديرية لمهمة.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, customerName: { type: Type.STRING }, cost: { type: Type.NUMBER } }, required: ["cost"] } },
              { name: "openCustomerTask", description: "البحث عن مهام عميل معين لفتح إحداها.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, choice: { type: Type.STRING } }, required: ["customerName"] } },
              { name: "addCustomer", description: "إضافة عميل جديد.", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, phone: { type: Type.STRING } }, required: ["name"] } },
              { name: "addDeposit", description: "إضافة دفعة حساب أو مبلغ مقدم لمهمة صيانة أو لعميل معين.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, customerName: { type: Type.STRING }, amount: { type: Type.NUMBER }, isLastTask: { type: Type.BOOLEAN } }, required: ["amount"] } },
              { name: "openTab", description: "الانتقال إلى قسم أو شاشة محددة في التطبيق.", parameters: { type: Type.OBJECT, properties: { tabId: { type: Type.STRING }, filterQuery: { type: Type.STRING } }, required: ["tabId"] } },
              { name: "countTasks", description: "معرفة عدد المهام الكلية، المعلقة وقيد التنفيذ.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getFinancialSummary", description: "معرفة ملخص مالي للحسابات وإيرادات ومصروفات اليوم.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getReadyTasksSummary", description: "معرفة واستخراج الأجهزة والمهام الجاهزة للتسليم حالياً.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getDailySummary", description: "استخراج ملخص وتقرير أعمال اليوم الشاملة.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getBoxBalance", description: "معرفة رصيد الخزينة والصندوق المتاح حالياً بالريال اليمني.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getDebtsSummary", description: "معرفة إجمالي ديون ومستحقات العملاء المتبقية.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getFinancialCenterDetails", description: "معرفة تفاصيل ومؤشرات المركز المالي، إجمالي الأصول والرصيد.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "listCashAccounts", description: "عرض كافة الحسابات النقدية والخزائن والصناديق.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "listDebts", description: "عرض الديون والالتزامات القائمة للموردين.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "getInventorySummary", description: "معرفة إحصائيات قطع الغيار والمخزون.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "updateCustomerTaskStatus", description: "تحديث وتغيير حالة مهمة العميل مباشرة باسم العميل.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, status: { type: Type.STRING } }, required: ["customerName", "status"] } },
              { name: "openWindow", description: "فتح أو إغلاق أي نافذة أو نموذج بالصوت.", parameters: { type: Type.OBJECT, properties: { windowName: { type: Type.STRING } }, required: ["windowName"] } }
            ]
          }];

          const geminiRes = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: text + "\n\n" + contextString,
            config: {
              systemInstruction: systemPrompt,
              tools: clientTools
            }
          });

          if (geminiRes.functionCalls && geminiRes.functionCalls.length > 0) {
            const results: string[] = [];
            const isProfessional = (voiceSettings.assistantMode || 'professional') === 'professional';
            for (const call of geminiRes.functionCalls) {
              const desc = getCommandDescription(call.name, call.args || {});
              const resultStr = await executeToolCall(call.name, call.args || {});
              const isDirectAnswer = resultStr.startsWith('تم ') || resultStr.includes(':') || resultStr.includes('ريال') || resultStr.includes('أجهزة') || resultStr.includes('يوجد') || resultStr.includes('إجمالي') || resultStr.includes('رصيد') || resultStr.includes('دخل') || resultStr.includes('لديك');
              results.push(isProfessional && isDirectAnswer ? resultStr : `تم ${desc}. ${resultStr}`);
            }
            sendAssistantReply(results.join(' | '));
            return;
          }

          if (geminiRes.text) {
            sendAssistantReply(geminiRes.text);
            return;
          }
        } catch (directErr) {
          console.warn("Direct client Gemini call error:", directErr);
        }
      }

      // If neither server nor direct client Gemini succeeded
      const hasApiKey = Boolean(voiceSettings.geminiApiKey || (import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : ''));
      if (!hasApiKey) {
        sendAssistantReply('يرجى إدخال مفتاح Gemini API في إعدادات المساعد لتمكينه من المعالجة الذكية السريعة لكافة الأوامر وتنفيذ وتعديل العمليات بدقة.');
      } else {
        sendAssistantReply('تعذر الاتصال بمحرك الذكاء الاصطناعي (Gemini)، يرجى التحقق من اتصال الإنترنت أو التأكد من صلاحية مفتاح API.');
      }
    } catch (procErr) {
      console.error("Process speech error:", procErr);
      sendAssistantReply("عذراً، حدث خطأ أثناء تنفيذ الأمر.");
    } finally {
      setIsProcessing(false);
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
        setAssistantMessage('تفضل بالتحدث 🎙️');
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
      console.warn("Failed to start recognition:", err);
      setIsListening(false);
      setAssistantMessage('حدث خطأ في بدء الميكروفون.');
    }
  };

  // Unified Speech Recognition for Assistant
  const restartListening = async () => {
    setIsActive(true);
    isActiveRef.current = true;

    if (isSpeakingRef.current) {
      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        }
      } catch (e) {}
      setIsSpeaking(false);
    }

    setIsListening(true);
    setLiveInterimText('');
    currentSpokenBufferRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setAssistantMessage('تفضل بنطق أوامرك عبر الميكروفون 🎙️');

    try {
      await startUnifiedSpeechRecognition({
        target: 'assistant',
        provider: 'auto',
        language: 'ar-SA',
        prompt: 'المساعد الصوتي يستمع لك الآن عبر الأوامر الافتراضية... تفضل بنطق أوامرك',
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
          setTextInput(clean);
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
            setTextInput(clean);
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

            setIsListening(false);
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
    setIsDirectChatOnly(false);
    setPendingAction(null);
    setTranscript('');

    stopUnifiedSpeechRecognition();

    // إيقاف تحويل النص إلى كلام (TTS) عند الخروج وفقاً لإعدادات المساعد الصوتي
    const currentVoiceSettings = getVoiceSettings();
    if (currentVoiceSettings.stopVoiceOnExit !== false) {
      await stopOngoingSpeech();
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      onClose?.();
      window.dispatchEvent(new CustomEvent('assistant-closed'));
    } catch (e) {}
  };

  const toggleVoice = () => {
    // إيقاف أي نطق صوتي فوري عند النقر
    stopOngoingSpeech();
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
          <span className={cn("absolute -inset-2 rounded-full animate-ping pointer-events-none z-0", getEffectColorClass().auraPing)}></span>
          <span className={cn("absolute -inset-1 rounded-full animate-pulse pointer-events-none z-0", getEffectColorClass().auraPing)}></span>
        </>
      )}

      {/* Main or Local Assistant Dock Button */}
      {!hideMainButton && (
        <button
          id="main-assistant-btn"
          type="button"
          onClick={handleClick}
          style={{ touchAction: 'manipulation' }}
          className={cn(
            className || "p-3 rounded-full transition-all shadow-xl flex items-center justify-center relative cursor-pointer z-10",
            isActive ? getEffectColorClass().btnActive : getEffectColorClass().btnNormal
          )}
          title={isActive ? "المساعد الذكي نشط... انقر للإيقاف" : "تفعيل المساعد الصوتي والذكاء الاصطناعي"}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          ) : isListening ? (
            <div className="relative flex items-center justify-center">
              <Mic className="w-6 h-6 text-white animate-bounce" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></span>
            </div>
          ) : isActive ? (
            <div className="relative flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-800 animate-spin" style={{ animationDuration: '4s', backgroundColor: '#adffbc' }} />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <GeminiIcon className="w-6 h-6 text-emerald-800 transition-transform duration-500 hover:rotate-12" style={{ backgroundColor: '#adffbc' }} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
            </div>
          )}
        </button>
      )}

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
            style={{
              left: 0,
              right: 0,
              width: '100%',
              maxWidth: '100%',
              margin: 0,
              boxSizing: 'border-box'
            }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[9999] w-full left-0 right-0 m-0 max-w-full h-[66.67dvh] max-h-[66.67dvh] rounded-t-[24px] sm:rounded-t-[28px] p-3 sm:p-4 text-right select-none shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom border-t-2 border-slate-300/80 dark:border-slate-700/80 pb-[max(1.25rem,env(safe-area-inset-bottom,20px))]",
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
                  {isListening ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <GeminiIcon className="w-4 h-4" />
                  )}
                  {isListening && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs sm:text-sm font-black tracking-wide truncate", getEffectColorClass().titleColor)}>
                      {isDirectChatOnly ? 'مساعد الفيصلي (دردشة مباشرة)' : 'مساعد الفيصلي الذكي'}
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
                    الأوامر الصوتية الافتراضية للهاتف
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 relative">
                <button
                  type="button"
                  onClick={() => {
                    if (isSpeaking) {
                      stopOngoingSpeech();
                    } else {
                      const newMute = !voiceSettings.muteNotificationVoiceSpeech;
                      saveVoiceSettings({ ...voiceSettings, muteNotificationVoiceSpeech: newMute });
                      setVoiceSettings(prev => ({ ...prev, muteNotificationVoiceSpeech: newMute }));
                      if (newMute) stopOngoingSpeech();
                    }
                  }}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer border text-xs flex items-center justify-center shrink-0 active:scale-95 shadow-xs",
                    (voiceSettings.muteNotificationVoiceSpeech)
                      ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-rose-500/20"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/20"
                  )}
                  title={voiceSettings.muteNotificationVoiceSpeech ? "الصوت مكتوم - انقر للتفعيل" : "الصوت مفعل - انقر للإسكات"}
                >
                  {voiceSettings.muteNotificationVoiceSpeech ? (
                    <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatHistoryModalOpen(true)}
                  className="p-1.5 sm:p-2 opacity-85 hover:opacity-100 hover:bg-slate-500/20 rounded-xl transition-colors cursor-pointer border border-slate-400/30 text-xs text-indigo-600 dark:text-indigo-400"
                  title="سجل المحادثات والأوامر"
                >
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
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

            {/* Interactive Speech Mute/Stop Control Banner */}
            {isSpeaking && (
              <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl px-3 py-1.5 mb-2 flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 bg-emerald-600 text-white rounded-lg animate-bounce shrink-0">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate text-[11px] font-bold text-emerald-900 dark:text-emerald-200">جارِ القراءة والنطق بالصوت...</span>
                </div>
                <button
                  type="button"
                  onClick={() => stopOngoingSpeech()}
                  className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shrink-0 shadow-xs transition-all active:scale-95 flex items-center justify-center border border-rose-600"
                  title="إسكات الصوت فوراً"
                >
                  <VolumeX className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}

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
                  <div className="flex items-start justify-end gap-1.5 pl-2 sm:pl-4">
                    <div 
                      className="bg-sky-600 text-white rounded-2xl rounded-tr-xs p-2.5 text-xs sm:text-sm font-bold leading-relaxed shadow-sm max-w-[96%] relative cursor-pointer select-text"
                      onTouchStart={() => handleTouchStartMessage(msg)}
                      onTouchEnd={handleTouchEndMessage}
                      onTouchMove={handleTouchEndMessage}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedMessageForAction(msg);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5 text-[10px] text-sky-200 border-b border-sky-500/50 pb-0.5">
                        <span className="font-black flex items-center gap-1">
                          <Mic className="w-2.5 h-2.5 text-sky-200" />
                          أمرك الصوتي
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMessageForAction(msg);
                            }}
                            className="p-0.5 hover:bg-white/20 rounded text-sky-100 transition-colors"
                            title="خيارات الرسالة (نسخ، مشاركة، حذف)"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                          </button>
                          <span className="text-[9px] opacity-80">
                            {msg.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-start gap-1.5 pr-2 sm:pr-4">
                    <div 
                      className={cn(
                        "rounded-2xl rounded-tl-xs p-2.5 text-xs sm:text-sm font-bold leading-relaxed shadow-sm max-w-[96%] border border-emerald-500/30 relative cursor-pointer select-text",
                        getEffectColorClass().msgBg
                      )}
                      onTouchStart={() => handleTouchStartMessage(msg)}
                      onTouchEnd={handleTouchEndMessage}
                      onTouchMove={handleTouchEndMessage}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedMessageForAction(msg);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 border-b border-emerald-400/30 pb-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                          <div className={cn("p-0.5 rounded-full", getEffectColorClass().msgIconBg)}>
                            <GeminiIcon className="w-2.5 h-2.5 text-emerald-700" />
                          </div>
                          <span>مساعد الفيصلي</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMessageForAction(msg);
                            }}
                            className="p-1 hover:bg-emerald-500/20 rounded text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                            title="خيارات الرسالة (نسخ، مشاركة، حذف)"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isSpeaking) {
                                stopOngoingSpeech();
                              } else {
                                speakArabic(msg.text);
                              }
                            }}
                            className={cn(
                              "p-1.5 rounded-lg cursor-pointer active:scale-90 transition-all border shrink-0 flex items-center justify-center shadow-2xs",
                              isSpeaking
                                ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-rose-500/30 animate-pulse"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-emerald-600/20"
                            )}
                            title={isSpeaking ? "إسكات وإيقاف الصوت" : "نطق الرد بالصوت"}
                          >
                            {isSpeaking ? (
                              <VolumeX className="w-3.5 h-3.5 text-white shrink-0" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5 text-white shrink-0" />
                            )}
                          </button>
                        </div>
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
              <div className="flex items-start justify-end gap-1.5 pl-2 sm:pl-4 animate-pulse">
                <div className="bg-sky-500/20 border border-sky-400/60 rounded-2xl rounded-tr-xs p-2 text-xs text-sky-950 dark:text-sky-200 font-bold max-w-[96%] flex items-center gap-2">
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
                className={cn(
                  "px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl whitespace-nowrap transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 flex items-center gap-1 font-bold text-xs",
                  getEffectColorClass().chipHover
                )}
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
              className={cn(
                "flex-1 bg-white dark:bg-slate-800 border text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none transition-all",
                isListening ? "border-rose-400 ring-2 ring-rose-200 dark:ring-rose-900/40" : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500"
              )}
            />
            <button
              type="button"
              onClick={handleSendText}
              disabled={!textInput.trim() || isProcessing}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 disabled:opacity-40 rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
              title="إرسال الأمر"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
            <div className="relative shrink-0 flex items-center">
              <button
                type="button"
                onClick={() => {
                  // إيقاف تحويل النص إلى كلام فوراً عند النقر على الميكروفون
                  stopOngoingSpeech();

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
                  "p-2 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 shrink-0 border relative",
                  isListening ? "bg-rose-500 animate-pulse text-white border-rose-600 ring-2 ring-rose-300 shadow-md shadow-rose-500/30" : "bg-yellow-400 hover:bg-yellow-500 text-slate-900 border-yellow-500"
                )}
                title={isListening ? "إيقاف الاستماع" : "بدء الاستماع الصوتي"}
              >
                {isListening && (
                  <>
                    <span className="absolute -inset-1 rounded-xl bg-rose-500/35 animate-ping pointer-events-none" />
                    <span className="absolute -inset-2 rounded-xl bg-rose-500/20 animate-pulse pointer-events-none" />
                  </>
                )}
                {isListening ? <MicOff className="w-4 h-4 text-white relative z-10" /> : <Mic className="w-4 h-4 text-slate-900" />}
              </button>
            </div>
          </div>

          {/* أيقونة وزر مصغر أسفل نافذة الدردشة للانتقال للتطبيق الكامل */}
          {voiceSettings.showAppTransitionIcon && (
            <div className="pt-2 pb-0.5 flex items-center justify-center shrink-0 border-t border-slate-200/40 dark:border-slate-800/40 mt-1">
              <button
                type="button"
                onClick={() => {
                  stopAssistant();
                  setIsDirectChatOnly(false);
                  setIsMainScreenExited(false);
                  if (onClose) onClose();
                  try {
                    window.dispatchEvent(new CustomEvent('focus_main_app'));
                  } catch (e) {}
                }}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-600 dark:hover:text-white text-emerald-800 dark:text-emerald-200 text-xs font-black rounded-full transition-all cursor-pointer shadow-xs border-2 border-emerald-400/80 dark:border-emerald-600 active:scale-95 group"
                title="الانتقال إلى واجهة التطبيق الرئيسية الكاملة"
              >
                <div className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-700 group-hover:bg-white/20 group-hover:text-white transition-colors">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </div>
                <span>الانتقال للتطبيق الكامل</span>
                <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>
        </>,
        document.body
      )}

      {/* أيقونة المساعد العائمة على الشاشة للشاشة الرئيسية والخلفية - لا تظهر إلا بعد الخروج من شاشة التطبيق الرئيسية وبنفس حجم أيقونة المساعد الرئيسية */}
      {voiceSettings.floatingAssistantOnExit && isMainScreenExited && !isActive && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`,
            zIndex: 9990,
            touchAction: 'none'
          }}
          className="select-none animate-in fade-in zoom-in-90 duration-200"
        >
          <div className="relative group">
            <button
              id="floating-assistant-btn"
              type="button"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                isDraggingRef.current = true;
                hasMovedRef.current = false;
                dragStartPosRef.current = {
                  x: touch.clientX,
                  y: touch.clientY,
                  bubbleX: bubblePos.x,
                  bubbleY: bubblePos.y
                };
              }}
              onTouchMove={(e) => {
                if (!isDraggingRef.current) return;
                const touch = e.touches[0];
                const dx = touch.clientX - dragStartPosRef.current.x;
                const dy = touch.clientY - dragStartPosRef.current.y;
                if (Math.hypot(dx, dy) > 8) {
                  hasMovedRef.current = true;
                }
                const screenW = window.innerWidth || 412;
                const screenH = window.innerHeight || 915;
                const newX = Math.min(Math.max(6, dragStartPosRef.current.bubbleX + dx), screenW - 62);
                const newY = Math.min(Math.max(50, dragStartPosRef.current.bubbleY + dy), screenH - 75);
                setBubblePos({ x: newX, y: newY });
              }}
              onTouchEnd={() => {
                isDraggingRef.current = false;
                if (!hasMovedRef.current) {
                  // التفاعل بأول نقرة وفتح نافذة الدردشة فوراً!
                  try {
                    if (navigator.vibrate) navigator.vibrate(35);
                  } catch (err) {}
                  setIsActive(true);
                  setIsDirectChatOnly(true);
                  restartListening();
                } else {
                  // أيقونة عائمة حرة تستقر بمرونة على أطراف الشاشة (Edge docking)
                  if (typeof window !== 'undefined') {
                    const screenW = window.innerWidth || 412;
                    const screenH = window.innerHeight || 915;
                    const midX = screenW / 2;
                    const snapLeft = 8;
                    const snapRight = Math.max(8, screenW - 64);
                    const finalX = bubblePos.x < midX ? snapLeft : snapRight;
                    const finalY = Math.min(Math.max(55, bubblePos.y), screenH - 85);
                    setBubblePos({ x: finalX, y: finalY });
                    try {
                      localStorage.setItem('faisali_floating_pos_main', JSON.stringify({ x: finalX, y: finalY }));
                    } catch (e) {}
                  }
                }
              }}
              onMouseDown={(e) => {
                isDraggingRef.current = true;
                hasMovedRef.current = false;
                dragStartPosRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  bubbleX: bubblePos.x,
                  bubbleY: bubblePos.y
                };
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  if (!isDraggingRef.current) return;
                  const dx = moveEvent.clientX - dragStartPosRef.current.x;
                  const dy = moveEvent.clientY - dragStartPosRef.current.y;
                  if (Math.hypot(dx, dy) > 8) {
                    hasMovedRef.current = true;
                  }
                  const screenW = window.innerWidth || 412;
                  const screenH = window.innerHeight || 915;
                  const newX = Math.min(Math.max(6, dragStartPosRef.current.bubbleX + dx), screenW - 62);
                  const newY = Math.min(Math.max(50, dragStartPosRef.current.bubbleY + dy), screenH - 75);
                  setBubblePos({ x: newX, y: newY });
                };
                const handleMouseUp = () => {
                  isDraggingRef.current = false;
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('mouseup', handleMouseUp);
                  if (!hasMovedRef.current) {
                    // التفاعل بأول نقرة وفتح نافذة الدردشة فوراً
                    try {
                      if (navigator.vibrate) navigator.vibrate(35);
                    } catch (err) {}
                    setIsActive(true);
                    setIsDirectChatOnly(true);
                    restartListening();
                  } else {
                    // أيقونة عائمة حرة تستقر بمرونة على أطراف الشاشة (Edge docking)
                    if (typeof window !== 'undefined') {
                      const screenW = window.innerWidth || 412;
                      const screenH = window.innerHeight || 915;
                      const midX = screenW / 2;
                      const snapLeft = 8;
                      const snapRight = Math.max(8, screenW - 64);
                      const finalX = bubblePos.x < midX ? snapLeft : snapRight;
                      const finalY = Math.min(Math.max(55, bubblePos.y), screenH - 85);
                      setBubblePos({ x: finalX, y: finalY });
                      try {
                        localStorage.setItem('faisali_floating_pos_main', JSON.stringify({ x: finalX, y: finalY }));
                      } catch (e) {}
                    }
                  }
                };
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
              }}
              className={cn(
                "p-3 rounded-full transition-all shadow-xl flex items-center justify-center relative cursor-grab active:cursor-grabbing",
                isActive
                  ? getEffectColorClass().btnActive
                  : getEffectColorClass().btnNormal
              )}
              title="أيقونة المساعد الذكي العائمة - انقر لفتح الدردشة أو اسحب لتغيير المكان"
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin text-white pointer-events-none" />
              ) : isListening ? (
                <div className="relative flex items-center justify-center pointer-events-none">
                  <Mic className="w-6 h-6 text-white animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping"></span>
                </div>
              ) : isActive ? (
                <div className="relative flex items-center justify-center pointer-events-none">
                  <Sparkles className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              ) : (
                <div className="relative flex items-center justify-center pointer-events-none">
                  <GeminiIcon className="w-6 h-6 text-white transition-transform duration-500 hover:rotate-12 rounded-sm" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                </div>
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Manual Paste Modal for Notification Text (No browser native prompt!) */}
      {showManualPasteModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl dir-rtl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              لصق نص رسالة الإشعار البنكي / SMS
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              قم بلصق أو كتابة نص الرسالة الخاصة بالإيداع أو التحويل للتحليل المباشر:
            </p>
            <textarea
              rows={4}
              value={manualPasteText}
              onChange={(e) => setManualPasteText(e.target.value)}
              placeholder="مثال: أودع/محمد صالح مبلغ 25000 ريال بحساب..."
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualPasteModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (manualPasteText.trim()) {
                    setShowManualPasteModal(false);
                    commitUserVoiceCommand(manualPasteText.trim());
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
              >
                معالجة النص
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Options Action Sheet / Modal (Long Press / Click Context) */}
      {selectedMessageForAction && (
        <div className="fixed inset-0 z-[100001] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in dir-rtl">
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl p-4 max-w-xs w-full shadow-2xl space-y-3 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>خيارات الرسالة</span>
              </span>
              <button 
                type="button" 
                onClick={() => setSelectedMessageForAction(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl max-h-24 overflow-y-auto border border-slate-200/80 dark:border-slate-700 leading-relaxed whitespace-pre-wrap select-text">
              {selectedMessageForAction.text}
            </p>

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleCopyChatMessage(selectedMessageForAction.text)}
                className="w-full py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-100 border border-emerald-300/80 dark:border-emerald-700/60 rounded-xl font-black text-xs flex items-center justify-between cursor-pointer active:scale-95 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-emerald-600" />
                  <span>نسخ النص</span>
                </span>
                <span className="text-[10px] text-emerald-600/80 font-bold">إلى الحافظة</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareChatMessage(selectedMessageForAction.text)}
                className="w-full py-2.5 px-3 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-900 dark:text-sky-100 border border-sky-300/80 dark:border-sky-700/60 rounded-xl font-black text-xs flex items-center justify-between cursor-pointer active:scale-95 transition-all"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-sky-600" />
                  <span>مشاركة النص</span>
                </span>
                <span className="text-[10px] text-sky-600/80 font-bold">عبر التطبيقات</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteChatMessage(selectedMessageForAction.id)}
                className="w-full py-2.5 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-900 dark:text-rose-100 border border-rose-300/80 dark:border-rose-700/60 rounded-xl font-black text-xs flex items-center justify-between cursor-pointer active:scale-95 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>حذف الرسالة</span>
                </span>
                <span className="text-[10px] text-rose-600/80 font-bold">من الدردشة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <VoiceAssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Voice Chats History Modal */}
      <VoiceAssistantChatHistoryModal
        isOpen={isChatHistoryModalOpen}
        onClose={() => setIsChatHistoryModalOpen(false)}
        onSelectCommand={(cmdText) => commitUserVoiceCommand(cmdText)}
      />
    </div>
  );
};
