export type VoiceEngineProvider = 'auto' | 'samsung' | 'google' | 'device_default' | 'gemini_stream' | 'samsung_voice' | 'samsung_tts' | 'google_voice' | 'google_tts' | 'system_default';

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
  voiceEngineProvider: VoiceEngineProvider;
  volume: number;
  rate: number;
  pitch: number;
  autoSpeak: boolean;
  speakImportantNotifications: boolean;
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
  floatingWidgetEnabled: boolean;
  floatingWidgetBackgroundMode: boolean;
  floatingWidgetPosition?: { x: number; y: number };
  floatingWidgetOpenChatDirectly: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceAssistantSettings = {
  voiceName: "",
  voiceEngineProvider: "auto",
  volume: 1,
  rate: 0.95,
  // slightly measured rate sounds much more natural in Arabic
  pitch: 0.84,
  // confident masculine pitch (نبرة صوت رجالي واضحة ووقورة)
  autoSpeak: true,
  speakImportantNotifications: true,
  bgStyle: "glass_white",
  textColor: "default",
  effectColor: "emerald",
  clarityMode: "crystal",
  assistantMode: "professional",
  welcomeMessage: "أهلاً بك، أنا جاهز لتنفيذ الأوامر.",
  assistantEngineMode: 6,
  quickPrompts: [
    "ملخص اليوم",
    "كم الدخل؟",
    "المهام الجاهزة",
    "الديون المتأخرة"
  ],
  notificationMonitoringEnabled: true,
  allowedNotificationSenders: DEFAULT_NOTIFICATION_SENDERS,
  floatingWidgetEnabled: true,
  floatingWidgetBackgroundMode: true,
  floatingWidgetPosition: { x: 16, y: 180 },
  floatingWidgetOpenChatDirectly: true
};
const STORAGE_KEY = "al_faisel_voice_settings_v1";
export function getVoiceSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("Failed to load voice settings:", e);
  }
  return DEFAULT_VOICE_SETTINGS;
}
export function saveVoiceSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("voice_settings_changed", { detail: settings }));
  } catch (e) {
    console.warn("Failed to save voice settings:", e);
  }
}
export function cleanTextForArabicSpeech(rawText) {
  if (!rawText) return "";
  let cleaned = rawText;
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");
  cleaned = cleaned.replace(/^#+\s+/gm, "");
  cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");
  cleaned = cleaned.replace(/^[*-]\s+/gm, "، ");
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  cleaned = cleaned.replace(/\bر\.ي\b|\bري\b/g, "ريال يمني");
  cleaned = cleaned.replace(/\bر\.س\b|\bر\.س\./g, "ريال سعودي");
  cleaned = cleaned.replace(/\$/g, " دولار ");
  cleaned = cleaned.replace(/%/g, " بالمئة ");
  cleaned = cleaned.replace(/&/g, " و ");
  cleaned = cleaned.replace(/[()\[\]{}]/g, " ");
  cleaned = cleaned.replace(/[-_~+=/\\|]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned && !/[.!?؛،:]$/.test(cleaned)) {
    cleaned += ".";
  }
  return cleaned;
}
export function getBestArabicVoice(preferredVoiceName?: string, provider?: string) {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const isArabicLang = (v) => {
    const l = (v.lang || "").toLowerCase().replace("_", "-");
    const n = (v.name || "").toLowerCase();
    return l.startsWith("ar") || n.includes("arabic") || n.includes("العربية");
  };
  const arVoices = voices.filter(isArabicLang);
  if (provider === "samsung_voice" || provider === "samsung_tts") {
    const samsungVoice = (arVoices.length > 0 ? arVoices : voices).find((v) => {
      const n = (v.name || "").toLowerCase();
      return n.includes("samsung") || n.includes("sm-") || n.includes("galaxy") || n.includes("sec_") || n.includes("bixby");
    });
    if (samsungVoice) return samsungVoice;
  }
  if (provider === "google_voice" || provider === "google_tts") {
    const googleVoice = (arVoices.length > 0 ? arVoices : voices).find((v) => {
      const n = (v.name || "").toLowerCase();
      return n.includes("google") || n.includes("ar-xa") || n.includes("ar-sa-x") || n.includes("speech services by google");
    });
    if (googleVoice) return googleVoice;
  }
  if (preferredVoiceName) {
    const matched = voices.find((v) => v.name === preferredVoiceName);
    if (matched) return matched;
  }
  const maleKeywords = ["male", "رجل", "ذكور", "ذكر", "ard", "arb", "arz", "naayf", "shakir", "tarik", "maged", "salman", "hamdan", "ar-xa", "ar-sa-x"];
  const maleArabic = arVoices.find((v) => maleKeywords.some((kw) => v.name.toLowerCase().includes(kw)));
  if (maleArabic) return maleArabic;
  const brandedArabic = arVoices.find(
    (v) => v.name.includes("Google") || v.name.includes("Samsung") || v.name.includes("Natural") || v.name.includes("Online")
  );
  if (brandedArabic) return brandedArabic;
  if (arVoices.length > 0) return arVoices[0];
  return null;
}
