import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Settings2, 
  Volume2, 
  VolumeX,
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
  Bot,
  Search,
  Layers,
  LayoutDashboard,
  ExternalLink,
  MousePointerClick,
  Smartphone,
  AppWindow,
  ArrowRight
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
import { speakImportantNotification, speakTtsText } from '../lib/ttsService';
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
  const [isTestingNotification, setIsTestingNotification] = useState(false);

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

  const updateSettingImmediate = (key: keyof VoiceAssistantSettings, value: any) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      saveVoiceSettings(updated);
      return updated;
    });
  };

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
      const sampleText = cleanTextForArabicSpeech(
        settings.voiceGender === 'male'
          ? 'مرحباً بك! أنا مساعد الفيصل الصوتي، أعمل بصوت رجالي فصيح وبدقة عالية وفق محرك هاتفك الافتراضي بدون أي حركات نطق.'
          : settings.voiceGender === 'female'
          ? 'مرحباً بك! أنا مساعدة الفيصل الصوتية، أعمل بنبرة أنثوية نقية وفق محرك هاتفك الافتراضي بدون حركات نطق.'
          : 'مرحباً بك! أنا مساعد الفيصل الصوتي، أعمل وفق المحرك الصوتي الافتراضي لهاتفك مباشرة.'
      );
      setIsTestingSpeech(true);

      // Save current selection momentarily to memory so speakTtsText respects changes before saving
      saveVoiceSettings(settings);

      await speakTtsText(sampleText, {
        rate: settings.voiceGender === 'male' ? (settings.rate || 0.94) : (settings.rate || 0.95),
        pitch: settings.voiceGender === 'male' ? (settings.pitch || 0.82) : settings.voiceGender === 'female' ? (settings.pitch || 1.05) : (settings.pitch || 0.95),
        volume: settings.volume || 1.0,
        voiceGender: settings.voiceGender || 'male'
      });

      setIsTestingSpeech(false);
    } catch (e) {
      console.warn('Speech test error:', e);
      setIsTestingSpeech(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex flex-col dir-rtl text-right">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      {/* Full screen modal container */}
      <div 
        dir="rtl"
        style={{
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          margin: 0,
          boxSizing: 'border-box'
        }}
        className="fixed inset-0 z-[9999] w-full h-full m-0 max-w-full max-h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-none shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom pb-[max(0.75rem,env(safe-area-inset-bottom,16px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top drag handle indicator matching VoiceAssistant */}
        <div 
          className="pt-2 pb-1.5 flex justify-center cursor-pointer select-none shrink-0" 
          onClick={onClose}
          title="انقر للإغلاق"
        >
          <div className="w-14 h-1.5 bg-slate-400/40 hover:bg-slate-500/60 rounded-full transition-colors" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer shadow-xs text-xs font-black flex items-center gap-1.5 shrink-0 active:scale-95"
              title="إغلاق والرجوع"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
            <div className="min-w-0 border-r border-slate-200 dark:border-slate-700 pr-2.5">
              <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">إعدادات المساعد</h3>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">محرك الذكاء الاصطناعي، نطق التنبيهات، والواجهة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 text-xs shrink-0"
            title="إغلاق الإعدادات والعودة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">

          {/* SECTION 0.5: Welcome Message */}
          <div className="space-y-2 bg-gradient-to-br from-sky-50 to-slate-50/40 p-3.5 rounded-2xl border border-sky-100/80 shadow-2xs">
            <h4 className="font-black text-xs text-slate-900 flex items-center gap-2 border-b border-sky-100/60 pb-1.5">
              <MessageSquare className="w-4 h-4 text-sky-500 fill-sky-400" />
              <span>الرسالة الترحيبية للمساعد</span>
            </h4>
            <div className="pt-0.5">
              <textarea
                value={settings.welcomeMessage || ''}
                onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                placeholder="أهلاً بك، أنا جاهز لتنفيذ الأوامر."
                className="w-full text-right p-2.5 rounded-xl border border-slate-300 focus:border-sky-500 outline-none text-xs font-bold min-h-[60px]"
                dir="rtl"
              />
            </div>
          </div>
          
          {/* SECTION 0.75: Quick Prompts */}
          <div className="space-y-2 bg-gradient-to-br from-indigo-50 to-slate-50/40 p-3.5 rounded-2xl border border-indigo-100/80 shadow-2xs">
            <h4 className="font-black text-xs text-slate-900 flex items-center gap-2 border-b border-indigo-100/60 pb-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-500 fill-indigo-400" />
              <span>الأزرار والنصوص السريعة</span>
            </h4>
            <div className="pt-0.5">
              <textarea
                value={(settings.quickPrompts || []).join('\n')}
                onChange={(e) => setSettings({ ...settings, quickPrompts: e.target.value.split('\n') })}
                placeholder="ملخص اليوم\nكم الدخل؟\nالمهام الجاهزة"
                className="w-full text-right p-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-xs font-bold min-h-[80px]"
                dir="rtl"
              />
            </div>
          </div>

          {/* SECTION: Floating Assistant & App Interface Icons */}
          <div className="space-y-3 bg-gradient-to-br from-purple-50/80 via-indigo-50/60 to-slate-50 p-3.5 rounded-2xl border border-purple-200/80 shadow-2xs">
            <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-black text-xs text-slate-900">
                  أيقونات المساعد والواجهة
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold border border-purple-200">
                أندرويد 13
              </span>
            </div>

            {/* Toggle 0: Main Assistant Button in Application */}
            <div className="p-3 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h5 className="font-black text-xs text-slate-900">
                    أيقونة المساعد الرئيسي داخل التطبيق
                  </h5>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, mainAssistantButtonEnabled: settings.mainAssistantButtonEnabled === false ? true : false })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.mainAssistantButtonEnabled !== false ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.mainAssistantButtonEnabled !== false ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>

              {settings.mainAssistantButtonEnabled !== false && (
                <div className="pt-1.5 border-t border-slate-100">
                  <select
                    value={settings.mainAssistantPosition || 'bottom-right'}
                    onChange={(e) => setSettings({ ...settings, mainAssistantPosition: e.target.value as any })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none"
                  >
                    <option value="bottom-right">أسفل الشاشة جهة اليمين</option>
                    <option value="bottom-left">أسفل الشاشة جهة اليسار</option>
                    <option value="top-right">أعلى الشاشة جهة اليمين</option>
                    <option value="top-left">أعلى الشاشة جهة اليسار</option>
                  </select>
                </div>
              )}
            </div>

            {/* Toggle 1: Floating Assistant on Exit */}
            <div className="p-3 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <h5 className="font-black text-xs text-slate-900">
                    الأيقونة العائمة عند الخروج
                  </h5>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, floatingAssistantOnExit: !settings.floatingAssistantOnExit })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.floatingAssistantOnExit ? "bg-purple-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.floatingAssistantOnExit ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>

              {settings.floatingAssistantOnExit && (
                <div className="pt-1.5 border-t border-purple-100">
                  <select
                    value={settings.floatingExitAssistantPosition || 'bottom-right'}
                    onChange={(e) => setSettings({ ...settings, floatingExitAssistantPosition: e.target.value as any })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none"
                  >
                    <option value="bottom-right">أسفل الشاشة جهة اليمين</option>
                    <option value="bottom-left">أسفل الشاشة جهة اليسار</option>
                    <option value="top-right">أعلى الشاشة جهة اليمين</option>
                    <option value="top-left">أعلى الشاشة جهة اليسار</option>
                  </select>
                </div>
              )}
            </div>

            {/* SECTION: Gemini AI Assistant Engine */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white space-y-3.5 shadow-md">
              <div className="flex items-center gap-2.5 border-b border-slate-700/80 pb-2">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-white">
                    محرك الذكاء الاصطناعي (Gemini AI)
                  </h4>
                  <p className="text-[10.5px] text-emerald-300 font-bold">
                    أعلى مستويات السرعة والدقة في استخراج البيانات وتنفيذ وتعديل كافة الأوامر
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-black text-slate-200 block">
                  مفتاح Gemini API للتفاعل الفوري المستقل (على أندرويد APK والمُتصفح):
                </label>
                <input
                  type="password"
                  placeholder="أدخل مفتاح Gemini API هنا (مثال: AIzaSy...)"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  className="w-full text-left font-mono p-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none text-xs bg-slate-800 text-white"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Toggle: Mute Voice Reading for Notifications */}
            <div className="p-3.5 rounded-xl bg-white/90 border border-amber-200/80 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <VolumeX className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-xs sm:text-sm text-slate-900">
                      إسكات قراءة الإشعارات بالصوت
                    </h5>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      عند تفعيل هذا الخيار، يتم كتم قراءة تذكيرات المهام والتنبيهات بالصوت تلقائياً والاعتماد على التنبيه المرئي مع إمكانية إسكات الرنين يدوياً دون قراءة نص الإشعار.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, muteNotificationVoiceSpeech: !settings.muteNotificationVoiceSpeech })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.muteNotificationVoiceSpeech ? "bg-amber-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.muteNotificationVoiceSpeech ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Toggle 2: First-click direct chat interaction */}
            <div className="p-3.5 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                    <MousePointerClick className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-xs sm:text-sm text-slate-900">
                      التفاعل بأول نقرة وفتح نافذة الدردشة مباشرة فقط
                    </h5>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      عند النقر على أيقونة المساعد العائمة، يتم التفاعل فوراً من أول نقرة وفتح نافذة الدردشة المباشرة فقط بدون فك ربط أو خطوات إضافية.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, directChatFirstClick: !settings.directChatFirstClick })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.directChatFirstClick ? "bg-sky-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.directChatFirstClick ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Toggle 3: Show small app transition icon at the bottom of the chat window */}
            <div className="p-3.5 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-xs sm:text-sm text-slate-900">
                      إظهار أيقونة صغيرة أسفل النافذة للانتقال للتطبيق
                    </h5>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      عرض زر وأيقونة مصغرة أنيقة أسفل نافذة الدردشة المباشرة للرجوع أو الانتقال لواجهة التطبيق الرئيسية بكل سهولة.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, showAppTransitionIcon: !settings.showAppTransitionIcon })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.showAppTransitionIcon ? "bg-emerald-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.showAppTransitionIcon ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>

              {settings.showAppTransitionIcon && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>معاينة الزر في أسفل الدردشة:</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px]">
                    <LayoutDashboard className="w-3 h-3 text-emerald-600" />
                    <span>الانتقال للتطبيق</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </div>
                </div>
              )}
            </div>

            {/* Toggle 4: Show/Hide Direct Chat Notification */}
            <div className="p-3.5 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-xs sm:text-sm text-slate-900">
                      إظهار إشعار "انقر لفتح نافذة الدردشة الصوتية المباشرة"
                    </h5>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      التحكم في ظهور أو إخفاء الإشعار المستمر "انقر لفتح نافذة الدردشة الصوتية المباشرة فوراً" في شريط إشعارات الهاتف عند مغادرة التطبيق إلى الخلفية.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, showDirectChatNotification: settings.showDirectChatNotification === false ? true : false })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.showDirectChatNotification !== false ? "bg-blue-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.showDirectChatNotification !== false ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Toggle 5: Show/Hide Assistant Icons in App Interface */}
            <div className="p-3.5 rounded-xl bg-white/90 border border-purple-100 space-y-2 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-black text-xs sm:text-sm text-slate-900">
                      إظهار أيقونة المساعد في واجهة التطبيق
                    </h5>
                    <p className="text-[11px] text-slate-600 font-semibold mt-0.5 leading-relaxed">
                      التحكم في إظهار أو إخفاء أيقونة المساعد الصوتي من داخل واجهة التطبيق الرئيسية، مع استمرار ظهورها كأيقونة عائمة حرة على أطراف الشاشة عند الخروج من التطبيق.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, showAppAssistantIcons: settings.showAppAssistantIcons === false ? true : false })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none self-center",
                    settings.showAppAssistantIcons !== false ? "bg-purple-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.showAppAssistantIcons !== false ? "translate-x-0" : "-translate-x-5"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Note 20 Ultra Android 13 permission guide */}
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1 text-amber-950">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>إرشاد تشغيل الأيقونة العائمة على أندرويد 13 (نوت 20 الترا):</span>
              </div>
              <p className="text-[10.5px] text-amber-800 leading-relaxed font-semibold">
                لكي تطفو أيقونة المساعد فوق شاشة الهاتف الرئيسية وبقية التطبيقات في أندرويد 13، توجه في هاتفك إلى: 
                <span className="font-black text-slate-900"> الضبط ⚙️ ⇦ التطبيقات ⇦ تطبيق الفيصلي ⇦ تفعيل خيار (الظهور في الأعلى / Display over other apps)</span>.
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
                  disabled={isTestingNotification}
                  onClick={async () => {
                    try {
                      setIsTestingNotification(true);
                      saveVoiceSettings(settings);
                      await speakImportantNotification('تنبيه صيانة عاجل', 'موعد صيانة جهاز سامسونج جالاكسي للعميل محمد الفيصل', { force: true });
                    } catch (e) {
                      console.warn('Notification test error:', e);
                    } finally {
                      setTimeout(() => setIsTestingNotification(false), 2000);
                    }
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer",
                    isTestingNotification ? "bg-amber-700 animate-pulse" : "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isTestingNotification ? 'جاري القراءة...' : 'تجربة قراءة التنبيه صوتياً 🔊'}</span>
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

            {/* Phone Default Engine & Voice Gender Selection */}
            <div className="space-y-3">
              {/* System Default Engine Notice */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="font-black text-xs text-emerald-950">محرك الصوت والتعرف: افتراضي الهاتف ونظام أندرويد (تلقائي)</h5>
                    <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                      افتراضي الهاتف
                    </span>
                  </div>
                  <p className="text-[10.5px] font-bold text-emerald-800/90 leading-relaxed mt-1">
                    يعتمد المساعد كلياً على محرك الهاتف الافتراضي للتعرف على الصوت (تحويل الكلام لنص) ونظام أندرويد 13 المدمج (تحويل النص لصوت) دون أي محركات خارجية أو استهلاك للبيانات، مع تحسين النطق العربي ليكون نقياً وطبيعياً وبدون حركات نطق.
                  </p>
                </div>
              </div>

              {/* Voice Gender Selection (Male / Female / System Default) */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>نوع ونبرة صوت المساعد</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    نطق عربي فصيح بدون حركات
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Male Voice */}
                  <button
                    type="button"
                    onClick={() => setSettings({ 
                      ...settings, 
                      voiceGender: 'male',
                      pitch: 0.82,
                      rate: 0.94
                    })}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between gap-2 active:scale-98",
                      (settings.voiceGender || 'male') === 'male'
                        ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-90 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-2xl">👨‍💼</span>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-white border border-slate-200 text-emerald-700">
                        موصى به
                      </span>
                    </div>
                    <div>
                      <h5 className="font-black text-xs text-slate-950 leading-snug">صوت رجل (فصيح ووقور)</h5>
                      <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">نبرة رجالية هادئة ورصينة، نطق عربي واضح ومباشر بدون حركات</p>
                    </div>
                    {(settings.voiceGender || 'male') === 'male' && (
                      <div className="absolute top-2 left-2 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>

                  {/* Female / Current Voice */}
                  <button
                    type="button"
                    onClick={() => setSettings({ 
                      ...settings, 
                      voiceGender: 'female',
                      pitch: 1.05,
                      rate: 0.98
                    })}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between gap-2 active:scale-98",
                      settings.voiceGender === 'female'
                        ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-90 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-2xl">👩‍💼</span>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        الصوت الحالي
                      </span>
                    </div>
                    <div>
                      <h5 className="font-black text-xs text-slate-950 leading-snug">صوت امرأة (الحالي)</h5>
                      <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">نبرة أنثوية نقية وواضحة، قراءة عربية دقيقة للأوامر والبيانات</p>
                    </div>
                    {settings.voiceGender === 'female' && (
                      <div className="absolute top-2 left-2 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>

                  {/* System Phone Default */}
                  <button
                    type="button"
                    onClick={() => setSettings({ 
                      ...settings, 
                      voiceGender: 'default',
                      pitch: 0.95,
                      rate: 0.95
                    })}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between gap-2 active:scale-98",
                      settings.voiceGender === 'default'
                        ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-90 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-2xl">📱</span>
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        نظام الجهاز
                      </span>
                    </div>
                    <div>
                      <h5 className="font-black text-xs text-slate-950 leading-snug">افتراضي الهاتف</h5>
                      <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">مطابق تماماً للصوت المحدد في إعدادات اللغة وتحويل النص بنظام جهازك</p>
                    </div>
                    {settings.voiceGender === 'default' && (
                      <div className="absolute top-2 left-2 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
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
            <h4 className="font-black text-xs sm:text-sm text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-sky-600" />
                <span>مظهر ونمط نافذة المساعد الصوتي والتأثيرات</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                تطبيق فوري مباشر
              </span>
            </h4>

            {/* Live Interactive Preview Box */}
            <div className={cn(
              "p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex items-center justify-between gap-3 shadow-sm",
              settings.bgStyle === 'glass_dark' ? "bg-slate-950/95 border-slate-800 text-white" :
              settings.bgStyle === 'glass_emerald' ? "bg-emerald-950/95 border-emerald-600/50 text-white" :
              settings.bgStyle === 'solid_white' ? "bg-white border-slate-300 text-slate-900" :
              settings.bgStyle === 'solid_slate' ? "bg-slate-900 border-slate-700 text-white" :
              "bg-white/90 border-slate-200 text-slate-900"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shadow-md relative transition-all duration-300",
                  settings.effectColor === 'emerald' ? "bg-emerald-600 shadow-emerald-500/30 text-white" :
                  settings.effectColor === 'sky' ? "bg-sky-600 shadow-sky-500/30 text-white" :
                  settings.effectColor === 'amber' ? "bg-amber-500 shadow-amber-500/30 text-slate-950" :
                  settings.effectColor === 'purple' ? "bg-purple-600 shadow-purple-500/30 text-white" :
                  "bg-rose-600 shadow-rose-500/30 text-white"
                )}>
                  <Bot className="w-5 h-5" />
                  <span className={cn(
                    "absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping opacity-75",
                    settings.effectColor === 'emerald' ? "bg-emerald-400" :
                    settings.effectColor === 'sky' ? "bg-sky-400" :
                    settings.effectColor === 'amber' ? "bg-amber-400" :
                    settings.effectColor === 'purple' ? "bg-purple-400" :
                    "bg-rose-400"
                  )} />
                </div>
                <div>
                  <span className="text-[10px] opacity-70 block font-bold">معاينة حية للمظهر المختار:</span>
                  <p className={cn(
                    "text-xs font-black transition-colors duration-300",
                    settings.textColor === 'emerald' ? "text-emerald-500" :
                    settings.textColor === 'sky' ? "text-sky-500" :
                    settings.textColor === 'amber' ? "text-amber-500" :
                    settings.textColor === 'light' ? "text-slate-100" :
                    settings.textColor === 'dark' ? "text-slate-900" :
                    ""
                  )}>
                    أهلاً بك! أنا جاهز لتنفيذ أوامرك فورياً
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] px-2 py-1 rounded-lg font-bold border",
                  settings.effectColor === 'emerald' ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                  settings.effectColor === 'sky' ? "bg-sky-500/15 border-sky-500/30 text-sky-400" :
                  settings.effectColor === 'amber' ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                  settings.effectColor === 'purple' ? "bg-purple-500/15 border-purple-500/30 text-purple-400" :
                  "bg-rose-500/15 border-rose-500/30 text-rose-400"
                )}>
                  هالة {settings.effectColor}
                </span>
              </div>
            </div>

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
                    onClick={() => updateSettingImmediate('bgStyle', bg.id)}
                    className={cn(
                      "p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-18",
                      bg.preview,
                      settings.bgStyle === bg.id ? "ring-2 ring-emerald-500 border-emerald-500 scale-[1.02]" : "hover:border-slate-400"
                    )}
                  >
                    <span className="text-xs font-black">{bg.label}</span>
                    {settings.bgStyle === bg.id && (
                      <span className="absolute bottom-2 left-2 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xs">
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
                    onClick={() => updateSettingImmediate('textColor', tc.id)}
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
              <label className="block text-xs font-black text-slate-700 mb-2">لون التناغم والتأثيرات المرئية (الهالة وزر المساعد)</label>
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
                    onClick={() => updateSettingImmediate('effectColor', eff.id)}
                    className={cn(
                      "py-2 px-1 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-[10.5px] font-black text-slate-700",
                      settings.effectColor === eff.id ? "border-slate-900 ring-2 ring-emerald-400 bg-slate-50 scale-[1.02]" : "border-slate-200 hover:border-slate-300"
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
