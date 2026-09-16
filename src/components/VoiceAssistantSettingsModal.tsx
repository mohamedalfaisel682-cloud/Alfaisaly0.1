import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Settings2, 
  Volume2, 
  Mic, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Play, 
  Palette, 
  Shield, 
  SlidersHorizontal, 
  X, 
  Zap, 
  FileText, 
  MessageSquare, 
  Cpu,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Smartphone,
  AppWindow,
  ExternalLink,
  Radio,
  Eye,
  Layers
} from 'lucide-react';
import { 
  VoiceAssistantSettings, 
  VoiceEngineProvider,
  NotificationSenderRule,
  DEFAULT_VOICE_SETTINGS, 
  DEFAULT_NOTIFICATION_SENDERS,
  getVoiceSettings, 
  saveVoiceSettings, 
  cleanTextForArabicSpeech, 
  getBestArabicVoice 
} from '../lib/voiceSettings';
import { parseFinancialNotification, ParsedFinancialNotification } from '../lib/notificationParser';
import { speakImportantNotification } from '../lib/ttsService';
import { 
  requestOverlayPermission, 
  hasOverlayPermission, 
  setFloatingWidgetNativeState 
} from '../lib/nativeService';
import { cn } from '../lib/utils';

interface VoiceAssistantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAssistantSettingsModal: React.FC<VoiceAssistantSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<VoiceAssistantSettings>(getVoiceSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);

  // Financial notification senders state
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderType, setNewSenderType] = useState<'bank' | 'wallet' | 'exchange' | 'other'>('bank');
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [editingSenderName, setEditingSenderName] = useState('');
  const [testNotificationText, setTestNotificationText] = useState('أودع/محمد سالم مبلغ 35000 ريال إلى حسابك رقم 123456 عبر الكريمي');
  const [testParseResult, setTestParseResult] = useState<ParsedFinancialNotification | null>(null);

  // Fetch available voices on load
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Filter Arabic and all voices
      const arVoices = voices.filter(v => v.lang.startsWith('ar') || v.name.includes('Arabic') || v.name.includes('العربية'));
      setAvailableVoices(arVoices.length > 0 ? arVoices : voices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSettings(getVoiceSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const finalSettings = { ...settings };
    if (finalSettings.quickPrompts) {
      finalSettings.quickPrompts = finalSettings.quickPrompts.filter(p => p.trim() !== '');
    }
    saveVoiceSettings(finalSettings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_VOICE_SETTINGS);
    saveVoiceSettings(DEFAULT_VOICE_SETTINGS);
  };

  const handleToggleSender = (id: string) => {
    const currentSenders = settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS;
    const updated = currentSenders.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSettings({ ...settings, allowedNotificationSenders: updated });
  };

  const handleStartEditSender = (sender: NotificationSenderRule) => {
    setEditingSenderId(sender.id);
    setEditingSenderName(sender.name);
  };

  const handleSaveEditSender = (id: string) => {
    if (!editingSenderName.trim()) return;
    const currentSenders = settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS;
    const updated = currentSenders.map(s => s.id === id ? { ...s, name: editingSenderName.trim() } : s);
    setSettings({ ...settings, allowedNotificationSenders: updated });
    setEditingSenderId(null);
    setEditingSenderName('');
  };

  const handleDeleteSender = (id: string) => {
    const currentSenders = settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS;
    const updated = currentSenders.filter(s => s.id !== id);
    setSettings({ ...settings, allowedNotificationSenders: updated });
  };

  const handleAddSender = () => {
    if (!newSenderName.trim()) return;
    const currentSenders = settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS;
    const newSender: NotificationSenderRule = {
      id: `sender-${Date.now()}`,
      name: newSenderName.trim(),
      enabled: true,
      type: newSenderType
    };
    setSettings({
      ...settings,
      allowedNotificationSenders: [...currentSenders, newSender]
    });
    setNewSenderName('');
  };

  const handleResetSenders = () => {
    setSettings({
      ...settings,
      allowedNotificationSenders: DEFAULT_NOTIFICATION_SENDERS
    });
  };

  const handleRunTestParse = () => {
    const res = parseFinancialNotification(
      testNotificationText,
      settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS
    );
    setTestParseResult(res);
  };

  const testSpeech = async () => {
    try {
      const sampleText = cleanTextForArabicSpeech('مرحباً بك! أنا مساعد الفيصل الصوتي الذكي، أعمل بدقة عالية وجودة نطق عربية ممتازة.');
      setIsTestingSpeech(true);

      const provider = settings.voiceEngineProvider || 'auto';

      // If provider is gemini_stream or auto (and user didn't pick samsung/google specifically)
      if (provider === 'gemini_stream') {
        try {
          const { getApiUrl } = await import('../lib/nativeService');
          const ttsUrl = getApiUrl(`/api/assistant/tts?text=${encodeURIComponent(sampleText)}`);
          const audio = new Audio(ttsUrl);
          audio.playbackRate = settings.rate || 1.0;
          audio.onended = () => setIsTestingSpeech(false);
          audio.onerror = () => setIsTestingSpeech(false);
          await audio.play();
          return;
        } catch (e) {
          console.warn("TTS Stream preview failed:", e);
        }
      }

      // Try native Capacitor next
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
          const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
          await TextToSpeech.stop().catch(() => {});
          
          let voiceIndex: number | undefined = undefined;
          let hasArabicNative = false;
          try {
            const { voices } = await TextToSpeech.getSupportedVoices();
            if (voices && voices.length > 0) {
              // Check if Samsung or Google voice requested
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
                  hasArabicNative = true;
                } else {
                  const anyArIdx = voices.findIndex(v => 
                    (v.lang || '').toLowerCase().replace('_', '-').startsWith('ar') || 
                    (v.name || '').toLowerCase().includes('arabic') || 
                    (v.name || '').includes('العربية')
                  );
                  if (anyArIdx >= 0) {
                    voiceIndex = anyArIdx;
                    hasArabicNative = true;
                  }
                }
              } else {
                hasArabicNative = true;
              }
            }
          } catch (vErr) {}

          if (hasArabicNative) {
            const speakOptions: any = {
              text: sampleText,
              lang: 'ar-SA',
              rate: settings.rate || 0.95,
              pitch: settings.pitch || 0.84,
              volume: settings.volume || 1.0,
              category: 'ambient',
            };
            if (typeof voiceIndex === 'number') {
              speakOptions.voice = voiceIndex;
            }
            await TextToSpeech.speak(speakOptions);
            setIsTestingSpeech(false);
            return;
          }
        }
      } catch (capErr) {}

      // Fallback to Web Speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = 'ar-SA';
        utterance.volume = settings.volume;
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch || 0.84;

        utterance.onstart = () => setIsTestingSpeech(true);
        utterance.onend = () => setIsTestingSpeech(false);
        utterance.onerror = () => setIsTestingSpeech(false);

        const voice = getBestArabicVoice(settings.voiceName, settings.voiceEngineProvider);
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Speech test error:', e);
      setIsTestingSpeech(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-4 dir-rtl text-right animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border border-emerald-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">إعدادات المساعد الصوتي</h3>
              <p className="text-xs font-bold text-slate-500">تخصيص جودة النطق، أصوات الجيميني، والمظهر المرئي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">

          {/* SECTION 0.5: Welcome Message */}
          <div className="space-y-3 bg-gradient-to-br from-sky-50 to-slate-50/40 p-4 rounded-2xl border border-sky-100/80 shadow-2xs">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center justify-between border-b border-sky-100/60 pb-2">
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-500 fill-sky-400" />
                <span>الرسالة الترحيبية للمساعد</span>
              </span>
            </h4>
            <div className="pt-1">
              <textarea
                value={settings.welcomeMessage || ''}
                onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                placeholder="أهلاً بك، أنا جاهز لتنفيذ الأوامر."
                className="w-full text-right p-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-xs sm:text-sm font-bold min-h-[80px]"
                dir="rtl"
              />
              <p className="text-[10px] text-slate-500 font-bold mt-1.5">
                هذه هي الرسالة التي ينطقها المساعد فور تفعيله.
              </p>
            </div>
          </div>
          
          {/* SECTION 0.75: Quick Prompts */}
          <div className="space-y-3 bg-gradient-to-br from-indigo-50 to-slate-50/40 p-4 rounded-2xl border border-indigo-100/80 shadow-2xs">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center justify-between border-b border-indigo-100/60 pb-2">
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500 fill-indigo-400" />
                <span>النصوص الافتراضية الجاهزة (الأزرار السريعة)</span>
              </span>
            </h4>
            <div className="pt-1">
              <textarea
                value={(settings.quickPrompts || []).join('\n')}
                onChange={(e) => setSettings({ ...settings, quickPrompts: e.target.value.split('\n') })}
                placeholder="ملخص اليوم\nكم الدخل؟\nالمهام الجاهزة"
                className="w-full text-right p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs sm:text-sm font-bold min-h-[100px]"
                dir="rtl"
              />
              <p className="text-[10px] text-slate-500 font-bold mt-1.5">
                أدخل كل نص في سطر جديد. ستظهر هذه النصوص كأزرار جاهزة للضغط المباشر.
              </p>
            </div>
          </div>

          {/* SECTION 0: Assistant Personality & Response Mode */}
          <div className="space-y-3 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 rounded-2xl border border-emerald-100/80 shadow-2xs">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center justify-between border-b border-emerald-100/60 pb-2">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>نمط شخصية ونظام استجابة المساعد</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold">
                {settings.assistantMode === 'professional' ? 'سريع وعملي' : 'مفصل وكامل'}
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Professional (Fast & Concise) */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, assistantMode: 'professional' })}
                className={cn(
                  "p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between gap-2.5",
                  settings.assistantMode === 'professional'
                    ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                    : "bg-white/80 border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Zap className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h5 className="font-black text-xs sm:text-sm text-slate-900">المساعد المحترف (السريع والعملي)</h5>
                      <span className="text-[10px] text-amber-600 font-extrabold">قليل التفاصيل • تنفيذ فوري</span>
                    </div>
                  </div>
                  {settings.assistantMode === 'professional' && (
                    <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                  إجابات مختصرة ومباشرة جداً، تنفيذ فوري للأوامر واختصار الشروحات لتوفير الوقت وسرعة الإنجاز.
                </p>
              </button>

              {/* Option 2: Standard Detailed */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, assistantMode: 'detailed' })}
                className={cn(
                  "p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between gap-2.5",
                  settings.assistantMode === 'detailed'
                    ? "bg-white border-teal-500 ring-2 ring-teal-500/20 shadow-md"
                    : "bg-white/80 border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-black text-xs sm:text-sm text-slate-900">المساعد العادي (المفصل)</h5>
                      <span className="text-[10px] text-teal-600 font-extrabold">كثير التفاصيل • شروحات كاملة</span>
                    </div>
                  </div>
                  {settings.assistantMode === 'detailed' && (
                    <span className="w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                  إجابات شاملة ومفصلة مع توضيح كامل لخطوات التنفيذ وتقديم معلومات إضافية مساندة.
                </p>
              </button>
            </div>
          </div>

          {/* SECTION 1: Arabic Speech & Voice Settings */}
          <div className="space-y-4">
            {/* Automatic Voice Notification Reading Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-200/80 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md shrink-0 mt-0.5">
                    <Volume2 className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-slate-900">
                      قراءة التنبيهات المهمة صوتياً (Web Speech API & Capacitor)
                    </h4>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      تنبيهك صوتياً بمواعيد الصيانة، التذكيرات، والإنذارات الحرجة حتى لو لم تكن تنظر للشاشة (متوافق مع أندرويد 13 ونوت 20 الترا).
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, speakImportantNotifications: !settings.speakImportantNotifications })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.speakImportantNotifications !== false ? "bg-emerald-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.speakImportantNotifications !== false ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                <span className="text-[10.5px] font-bold text-slate-500">تجربة الإنذار القارئ للتنبيهات:</span>
                <button
                  type="button"
                  onClick={() => {
                    speakImportantNotification('تنبيه صيانة عاجل', 'موعد صيانة جهاز سامسونج جالاكسي للعميل محمد الفيصل', { force: true });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تجربة قراءة التنبيه صوتياً 🔊</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>جودة ودقة النطق بالعربية</span>
              </h4>
              <button
                type="button"
                onClick={testSpeech}
                disabled={isTestingSpeech}
                className={cn(
                  "py-1.5 px-3 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border active:scale-95",
                  isTestingSpeech
                    ? "bg-amber-500 text-white border-amber-400 animate-pulse"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                )}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isTestingSpeech ? 'جاري التشغيل...' : 'اختبار النطق (معاينة)'}</span>
              </button>
            </div>

            {/* Voice Engine Provider Selection Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>محرك ومصدر صوت المساعد (مدعوم على نوت 20 ألترا وأندرويد)</span>
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-extrabold border border-emerald-200">
                  متوافق مع أندرويد 13
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'samsung_voice',
                    title: 'Samsung Voice',
                    subtitle: 'صوت سامسونج العربي الأصلي',
                    badge: 'نوت 20 ألترا',
                    icon: '📱'
                  },
                  {
                    id: 'samsung_tts',
                    title: 'Samsung TTS',
                    subtitle: 'محرك نطق سامسونج الافتراضي',
                    badge: 'Samsung Engine',
                    icon: '🔊'
                  },
                  {
                    id: 'google_voice',
                    title: 'Google Voice',
                    subtitle: 'صوت جوجل الصوتي الذكي',
                    badge: 'Google AI',
                    icon: '🌐'
                  },
                  {
                    id: 'google_tts',
                    title: 'Google Text to Voice',
                    subtitle: 'محرك جوجل لتحويل النص لكلام',
                    badge: 'Google TTS',
                    icon: '🎙️'
                  },
                  {
                    id: 'gemini_stream',
                    title: 'بث نقي فصيح (Universal)',
                    subtitle: 'نطق فائق النقاء أونلاين وأوفلاين',
                    badge: 'موصى به',
                    icon: '✨'
                  },
                  {
                    id: 'system_default',
                    title: 'افتراضي النظام',
                    subtitle: 'محرك الصوت النشط بالنظام',
                    badge: 'Android 13',
                    icon: '⚙️'
                  },
                ].map((engine) => {
                  const isSelected = (settings.voiceEngineProvider || 'auto') === engine.id || (settings.voiceEngineProvider === 'auto' && engine.id === 'gemini_stream');
                  return (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, voiceEngineProvider: engine.id as any })}
                      className={cn(
                        "p-2.5 rounded-xl border text-right transition-all cursor-pointer relative flex flex-col justify-between gap-1 active:scale-98",
                        isSelected
                          ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-90 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-base">{engine.icon}</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          {engine.badge}
                        </span>
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-slate-900 leading-snug">{engine.title}</h5>
                        <p className="text-[9.5px] font-bold text-slate-500 leading-tight mt-0.5">{engine.subtitle}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Dropdown */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">اختيار الصوت الفرعي المحدد (اختياري)</label>
              <select
                value={settings.voiceName}
                onChange={(e) => setSettings({ ...settings, voiceName: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="">تحديد تلقائي للأمثل من المحرك المختار</option>
                {availableVoices.map((v, idx) => (
                  <option key={idx} value={v.name}>
                    {v.name} ({v.lang}) {v.default ? '- الافتراضي' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] text-slate-400 font-bold mt-1">
                في هاتف جالكسي نوت 20 ألترا، يتوفر محرك Samsung TTS و Google Speech Services المدمجين بنظام أندرويد 13.
              </p>
            </div>

            {/* Sliders Grid: Volume, Rate, Pitch */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              
              {/* Volume */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-black text-slate-700">مستوى الصوت</label>
                  <span className="text-[11px] font-extrabold text-emerald-600">{Math.round(settings.volume * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.volume}
                  onChange={(e) => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Rate / Speed */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-black text-slate-700">سرعة النطق</label>
                  <span className="text-[11px] font-extrabold text-emerald-600">{settings.rate}x</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={settings.rate}
                  onChange={(e) => setSettings({ ...settings, rate: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Pitch */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-black text-slate-700">دقة ونبرة الصوت</label>
                  <span className="text-[11px] font-extrabold text-emerald-600">{settings.pitch}</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={settings.pitch}
                  onChange={(e) => setSettings({ ...settings, pitch: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

            </div>
          </div>

          {/* SECTION 2: Assistant Appearance & Themes */}
          <div className="space-y-4">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Palette className="w-4 h-4 text-sky-600" />
              <span>مظهر ونمط نافذة المساعد الصوتي</span>
            </h4>

            {/* Background Style */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2">نمط الخلفية والزجاج</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'glass_white', label: 'زجاجي أبيض', preview: 'bg-white/80 border-slate-200 text-slate-900 shadow-sm' },
                  { id: 'glass_dark', label: 'زجاجي داكن', preview: 'bg-slate-950/90 border-slate-800 text-white shadow-sm' },
                  { id: 'glass_emerald', label: 'زجاجي زمردي', preview: 'bg-emerald-950/90 border-emerald-500/50 text-white shadow-sm' },
                  { id: 'solid_white', label: 'أبيض ناصع', preview: 'bg-white border-slate-300 text-slate-900 shadow-sm' },
                  { id: 'solid_slate', label: 'رمادي داكن', preview: 'bg-slate-900 border-slate-700 text-white shadow-sm' }
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, bgStyle: bg.id as any })}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-18",
                      bg.preview,
                      settings.bgStyle === bg.id ? "ring-2 ring-emerald-500 border-emerald-500 scale-[1.02]" : "hover:border-slate-400"
                    )}
                  >
                    <span className="text-xs font-black">{bg.label}</span>
                    {settings.bgStyle === bg.id && (
                      <span className="absolute bottom-2 left-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Color Selection */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2">لون النصوص والاستجابات</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'default', label: 'افتراضي', colorClass: 'bg-slate-200 text-slate-900' },
                  { id: 'emerald', label: 'زمردي', colorClass: 'bg-emerald-100 text-emerald-950' },
                  { id: 'sky', label: 'سماوي', colorClass: 'bg-sky-100 text-sky-950' },
                  { id: 'amber', label: 'ذهبي', colorClass: 'bg-amber-100 text-amber-950' },
                  { id: 'dark', label: 'داكن', colorClass: 'bg-slate-800 text-white' },
                  { id: 'light', label: 'أبيض', colorClass: 'bg-slate-100 text-slate-900' }
                ].map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, textColor: tc.id as any })}
                    className={cn(
                      "py-2 px-2.5 rounded-xl border text-center text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1",
                      tc.colorClass,
                      settings.textColor === tc.id ? "ring-2 ring-emerald-500 border-emerald-500 font-extrabold" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span>{tc.label}</span>
                    {settings.textColor === tc.id && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Effect / Aura Color */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2">لون التناغم والتأثيرات المرئية (الهالة)</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'emerald', label: 'زمردي', bg: 'bg-emerald-500' },
                  { id: 'sky', label: 'سماوي', bg: 'bg-sky-500' },
                  { id: 'amber', label: 'ذهبي', bg: 'bg-amber-500' },
                  { id: 'purple', label: 'بنفسجي', bg: 'bg-purple-500' },
                  { id: 'rose', label: 'ياقوتي', bg: 'bg-rose-500' }
                ].map((eff) => (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, effectColor: eff.id as any })}
                    className={cn(
                      "py-2 px-1 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-[10.5px] font-black text-slate-700",
                      settings.effectColor === eff.id ? "border-slate-900 ring-2 ring-emerald-400 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span className={cn("w-4 h-4 rounded-full shadow-xs", eff.bg)} />
                    <span>{eff.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* SECTION 3: Notification Senders & Financial Parsing Rules */}
          <div className="space-y-4 pt-2 border-t-2 border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-slate-900">
                    جهات الإشعارات المعتمدة واستخلاص العمليات المالية
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    استخلاص الإيداعات (أودع) والمصروفات (تم تحويل) واقتراح إضافتها مباشرة
                  </p>
                </div>
              </div>

              {/* Master Monitoring Switch */}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, notificationMonitoringEnabled: !settings.notificationMonitoringEnabled })}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  settings.notificationMonitoringEnabled
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                )}
              >
                {settings.notificationMonitoringEnabled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مفعلة</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>معطلة</span>
                  </>
                )}
              </button>
            </div>

            {/* Notification Rules Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>قاعدة الإيداع (أودع...)</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  عند ورود رسالة تبدأ بكلمة <b className="text-emerald-700">أودع/</b> متبوعة باسم المودع والمبلغ، يقترح المساعد فوراً:
                </p>
                <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900">إيراد لحساب نقدي</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900">إيراد لعميل</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900">إيراد للمخزون</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-950 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-rose-800">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  <span>قاعدة التحويل (تم تحويل...)</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  عند ورود رسالة تبدأ بكلمة <b className="text-rose-700">تم تحويل</b> متبوعة بالمبلغ والمستلم، يقترح المساعد:
                </p>
                <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-rose-200/60 text-rose-900">مصروف من حساب نقدي</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-200/60 text-rose-900">مصروف لعميل أو مورد</span>
                </div>
              </div>
            </div>

            {/* Allowed Senders Management */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>الجهات المعتمدة المراقبة ({((settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS).length)})</span>
                </label>
                <button
                  type="button"
                  onClick={handleResetSenders}
                  className="text-[10.5px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>استعادة الجهات الافتراضية</span>
                </button>
              </div>

              {/* Senders List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                {(settings.allowedNotificationSenders || DEFAULT_NOTIFICATION_SENDERS).map((sender) => {
                  const isEditing = editingSenderId === sender.id;
                  const typeLabel = sender.type === 'wallet' ? 'محفظة' : sender.type === 'exchange' ? 'صرافة' : sender.type === 'bank' ? 'بنك' : 'أخرى';
                  const typeColor = sender.type === 'wallet' ? 'bg-amber-100 text-amber-800' : sender.type === 'exchange' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800';

                  return (
                    <div
                      key={sender.id}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-between gap-2 transition-all",
                        sender.enabled ? "bg-white border-slate-200" : "bg-slate-100/70 border-slate-200 opacity-60"
                      )}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingSenderName}
                            onChange={(e) => setEditingSenderName(e.target.value)}
                            className="flex-1 text-xs font-bold px-2 py-1 bg-white border border-emerald-500 rounded-lg outline-hidden"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditSender(sender.id)}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                            title="حفظ"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSenderId(null)}
                            className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                            title="إلغاء"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[9.5px] font-black px-1.5 py-0.5 rounded", typeColor)}>
                              {typeLabel}
                            </span>
                            <span className="text-xs font-black text-slate-800">{sender.name}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Toggle active */}
                            <button
                              type="button"
                              onClick={() => handleToggleSender(sender.id)}
                              className={cn(
                                "px-2 py-0.5 text-[10px] font-black rounded-md cursor-pointer transition-all",
                                sender.enabled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              )}
                            >
                              {sender.enabled ? 'مفعل' : 'معطل'}
                            </button>

                            {/* Edit Name */}
                            <button
                              type="button"
                              onClick={() => handleStartEditSender(sender)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                              title="تعديل اسم الجهة"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSender(sender.id)}
                              className="p-1 text-rose-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف هذه الجهة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Sender Form */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="اسم جهة إشعار جديدة (مثال: بنك اليمن والبحرين، كاش...)"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSender()}
                  className="flex-1 text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-hidden"
                />
                <select
                  value={newSenderType}
                  onChange={(e) => setNewSenderType(e.target.value as any)}
                  className="text-xs font-black px-2 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 outline-hidden cursor-pointer"
                >
                  <option value="bank">بنك</option>
                  <option value="wallet">محفظة</option>
                  <option value="exchange">صرافة</option>
                  <option value="other">أخرى</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddSender}
                  disabled={!newSenderName.trim()}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {/* Test Notification Simulator */}
            <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-sky-600" />
                  <span>اختبار استخلاص رسالة إشعار فورياً:</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTestNotificationText('أودع/محمد سالم مبلغ 35000 ريال إلى حسابك رقم 123456 عبر الكريمي');
                      setTestParseResult(null);
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer"
                  >
                    مثال إيداع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestNotificationText('تم تحويل مبلغ 18000 ريال إلى شركة الأمل لقطع الغيار');
                      setTestParseResult(null);
                    }}
                    className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold hover:bg-rose-200 cursor-pointer"
                  >
                    مثال تحويل
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testNotificationText}
                  onChange={(e) => {
                    setTestNotificationText(e.target.value);
                    setTestParseResult(null);
                  }}
                  className="flex-1 text-xs font-medium px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-hidden"
                  placeholder="اكتب أو الصق نص رسالة الإشعار هنا..."
                />
                <button
                  type="button"
                  onClick={handleRunTestParse}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-black cursor-pointer active:scale-95 transition-all"
                >
                  فحص واستخلاص
                </button>
              </div>

              {testParseResult && (
                <div className="p-2.5 rounded-lg bg-white border border-sky-300 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-black">
                    <span className={testParseResult.type === 'deposit' ? 'text-emerald-700' : 'text-rose-700'}>
                      {testParseResult.type === 'deposit' ? '📥 نوع العملية: إيداع مستلم (أودع)' : '📤 نوع العملية: تحويل صادر (تم تحويل)'}
                    </span>
                    {testParseResult.sourceEntity && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">
                        الجهة: {testParseResult.sourceEntity}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-700 text-[11px] font-bold">
                    الطرف: <b className="text-slate-900">{testParseResult.partyName}</b> | المبلغ المستخلص: <b className="text-emerald-600 text-sm font-black">{Number(testParseResult.amount).toLocaleString()} {testParseResult.currency}</b>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                    {testParseResult.type === 'deposit'
                      ? '💡 سيعرض المساعد في الدردشة: [إيراد لحساب نقدي] أو [إيراد لعميل] أو [إيراد لمخزون]'
                      : '💡 سيعرض المساعد في الدردشة: [مصروف لحساب نقدي] أو [مصروف لعميل أو مورد]'}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
