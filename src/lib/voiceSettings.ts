export type VoiceEngineProvider = 'device_default' | 'auto' | 'system_default';
export type VoiceGender = 'male' | 'female' | 'default';

export interface NotificationSenderRule {
  id: string;
  name: string;
  enabled: boolean;
  type?: 'bank' | 'exchange' | 'wallet' | 'other';
}

export const DEFAULT_NOTIFICATION_SENDERS: NotificationSenderRule[] = [
  { id: 'sender-kuraimi', name: 'الكريمي', enabled: true, type: 'bank' },
  { id: 'sender-tadhamon', name: 'بنك التضامن', enabled: true, type: 'bank' },
  { id: 'sender-onecash', name: 'ون كاش', enabled: true, type: 'wallet' },
  { id: 'sender-jeeb', name: 'جيب', enabled: true, type: 'wallet' },
  { id: 'sender-najm', name: 'النجم', enabled: true, type: 'exchange' },
  { id: 'sender-amqi', name: 'العمقي', enabled: true, type: 'exchange' },
  { id: 'sender-jawwal', name: 'جوال باي', enabled: true, type: 'wallet' },
  { id: 'sender-qutaibi', name: 'القطيبي', enabled: true, type: 'bank' }
];

export interface VoiceAssistantSettings {
  voiceName: string;
  voiceGender?: VoiceGender;
  voiceEngineProvider: VoiceEngineProvider;
  volume: number;
  rate: number;
  pitch: number;
  autoSpeak: boolean;
  speakImportantNotifications: boolean;
  muteNotificationVoiceSpeech?: boolean;
  bgStyle: string;
  textColor: string;
  effectColor: string;
  clarityMode: string;
  assistantMode: string;
  welcomeMessage: string;
  assistantEngineMode: number;
  quickPrompts: string[];
  notificationMonitoringEnabled: boolean;
  allowedNotificationSenders: NotificationSenderRule[];
  floatingAssistantOnExit: boolean;
  directChatFirstClick: boolean;
  showAppTransitionIcon: boolean;
  mainAssistantButtonEnabled?: boolean;
  mainAssistantPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  floatingExitAssistantPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showDirectChatNotification?: boolean;
  showAppAssistantIcons?: boolean;
  mainVoiceEngine?: 'samsung' | 'google';
  stopVoiceOnExit?: boolean;
  geminiApiKey?: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceAssistantSettings = {
  voiceName: "",
  voiceGender: "male",
  voiceEngineProvider: "device_default",
  volume: 1,
  rate: 0.94,
  // measured, natural pace for Arabic
  pitch: 0.82,
  // confident, respectable male tone (نبرة صوت رجالي حقيقي وقورة وواضحة بدون حركات)
  autoSpeak: true,
  speakImportantNotifications: true,
  muteNotificationVoiceSpeech: false,
  stopVoiceOnExit: true,
  bgStyle: "glass_white",
  textColor: "default",
  effectColor: "emerald",
  clarityMode: "crystal",
  assistantMode: "professional",
  welcomeMessage: "أهلاً بك، أنا جاهز لتنفيذ الأوامر مباشرة.",
  assistantEngineMode: 6,
  quickPrompts: [
    "ملخص اليوم",
    "كم الدخل؟",
    "المهام الجاهزة",
    "الديون المتأخرة"
  ],
  notificationMonitoringEnabled: true,
  allowedNotificationSenders: DEFAULT_NOTIFICATION_SENDERS,
  floatingAssistantOnExit: true,
  directChatFirstClick: true,
  showAppTransitionIcon: true,
  mainAssistantButtonEnabled: true,
  mainAssistantPosition: 'bottom-right',
  floatingExitAssistantPosition: 'bottom-right',
  showDirectChatNotification: true,
  showAppAssistantIcons: true,
  mainVoiceEngine: 'samsung',
  geminiApiKey: ''
};
const STORAGE_KEY = "al_faisel_voice_settings_v1";
export function getVoiceSettings(): VoiceAssistantSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const isMutedLocalStorage = localStorage.getItem('faisali_mute_notification_voice_speech') === 'true';
      return { 
        ...DEFAULT_VOICE_SETTINGS, 
        ...parsed, 
        voiceGender: parsed.voiceGender || 'male',
        voiceEngineProvider: 'device_default',
        muteNotificationVoiceSpeech: parsed.muteNotificationVoiceSpeech ?? isMutedLocalStorage 
      };
    }
  } catch (e) {
    console.warn("Failed to load voice settings:", e);
  }
  const isMutedLocalStorage = localStorage.getItem('faisali_mute_notification_voice_speech') === 'true';
  return { ...DEFAULT_VOICE_SETTINGS, muteNotificationVoiceSpeech: isMutedLocalStorage };
}
export function saveVoiceSettings(settings: VoiceAssistantSettings) {
  try {
    const toSave = { ...settings, voiceEngineProvider: 'device_default' as VoiceEngineProvider };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    if (settings.muteNotificationVoiceSpeech !== undefined) {
      localStorage.setItem('faisali_mute_notification_voice_speech', String(settings.muteNotificationVoiceSpeech));
    }
    window.dispatchEvent(new CustomEvent("voice_settings_changed", { detail: toSave }));
  } catch (e) {
    console.warn("Failed to save voice settings:", e);
  }
}

export function isNotificationVoiceMuted(): boolean {
  try {
    const s = getVoiceSettings();
    if (s.muteNotificationVoiceSpeech) return true;
    return localStorage.getItem('faisali_mute_notification_voice_speech') === 'true';
  } catch {
    return false;
  }
}

export function cleanTextForArabicSpeech(rawText: string): string {
  if (!rawText) return "";
  let cleaned = String(rawText);

  // 1. Remove all Arabic diacritics / tashkeel / harakat completely (بدون حركات نطق نهائياً)
  // تشمل: الفتح، الضم، الكسر، السكون، الشدة، التنوين بأنواعه، الألف الخنجرية، علامات الترتيل والتطويل، والهمزات المشكولة
  cleaned = cleaned.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D4-\u08FF\uFB50-\uFBB1\uFE70-\uFE7F]/gu, "");

  // تطبيع همزة الوصل والأحرف الخاصة والفواصل غير المرئية
  cleaned = cleaned.replace(/\u0671/g, "ا");
  cleaned = cleaned.replace(/[\u200B-\u200F\uFEFF]/g, "");

  // 2. Remove markdown syntax, headers, quotes, backticks
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  cleaned = cleaned.replace(/^#+\s+/gm, "");
  cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");
  cleaned = cleaned.replace(/^[*-]\s+/gm, "، ");
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // 3. Remove all emojis & graphic symbols
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // 4. Convert currencies and symbols into smooth spoken Arabic
  cleaned = cleaned.replace(/\bر\.ي\b|\bري\b/g, "ريال يمني");
  cleaned = cleaned.replace(/\bر\.س\b|\bر\.س\./g, "ريال سعودي");
  cleaned = cleaned.replace(/\$/g, " دولار ");
  cleaned = cleaned.replace(/%/g, " بالمئة ");
  cleaned = cleaned.replace(/&/g, " و ");
  cleaned = cleaned.replace(/[()\[\]{}]/g, " ");
  cleaned = cleaned.replace(/[-_~+=/\\|#]/g, " ");

  // 5. Clean extra spaces and ensure polite pause at the end
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned && !/[.!?؛،:]$/.test(cleaned)) {
    cleaned += ".";
  }
  return cleaned;
}

export function getBestArabicVoice(voiceGender: VoiceGender = 'male', preferredVoiceName?: string) {
  if (typeof window === 'undefined' || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const isArabicLang = (v: SpeechSynthesisVoice) => {
    const l = (v.lang || "").toLowerCase().replace("_", "-");
    const n = (v.name || "").toLowerCase();
    return l.startsWith("ar") || n.includes("arabic") || n.includes("العربية");
  };

  const arVoices = voices.filter(isArabicLang);
  const candidateVoices = arVoices.length > 0 ? arVoices : voices;

  const femaleKeywords = [
    "female", "امرأة", "أنثى", "انثى", "fatima", "zariyah", "layla", "mariam", 
    "nour", "zeina", "salma", "female-1", "female-2", "zira", "hazel", "susan", "linda", "hedda", "catherine"
  ];

  const maleKeywords = [
    "male", "رجل", "ذكور", "ذكر", "naayf", "shakir", "tarik", "tariq", "maged", 
    "salman", "hamdan", "faisal", "youssef", "zayd", "omar", "ahmed", "khalid", 
    "bassam", "ali", "saeed", "ard", "arb", "arz", "ar-xa", "ar-sa-x", "ar-eg-x", 
    "ar-ae-x", "ar-kw-x", "ar-qa-x", "male-1", "male-2", "male-3", "david", "mark", "george"
  ];

  if (preferredVoiceName) {
    const matched = candidateVoices.find(v => v.name === preferredVoiceName);
    if (matched) {
      if (voiceGender === 'male') {
        const isFemalePreferred = femaleKeywords.some(kw => matched.name.toLowerCase().includes(kw));
        if (!isFemalePreferred) return matched;
      } else {
        return matched;
      }
    }
  }

  if (voiceGender === 'male') {
    const maleVoice = candidateVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
    if (maleVoice) return maleVoice;

    // Fallback: Pick any Arabic voice that is not explicitly female
    const nonFemaleArabic = candidateVoices.find(v => !femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
    if (nonFemaleArabic) return nonFemaleArabic;
  } else if (voiceGender === 'female') {
    const femaleVoice = candidateVoices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
    if (femaleVoice) return femaleVoice;
  }

  // System default Arabic voice
  const defaultAr = candidateVoices.find(v => v.default) || candidateVoices[0];
  return defaultAr || null;
}
