import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';
import { getVoiceSettings, cleanTextForArabicSpeech, getBestArabicVoice, VoiceGender } from './voiceSettings';

let activeTtsAudio: HTMLAudioElement | null = null;

export const MALE_VOICE_KEYWORDS = [
  'male', 'رجل', 'ذكور', 'ذكر', 'naayf', 'shakir', 'tarik', 'tariq', 'maged', 
  'salman', 'hamdan', 'faisal', 'youssef', 'zayd', 'omar', 'ahmed', 'khalid', 
  'bassam', 'ali', 'saeed', 'ard', 'arb', 'arz', 'ar-xa', 'ar-sa-x', 'ar-eg-x', 
  'ar-ae-x', 'ar-kw-x', 'ar-qa-x', 'male-1', 'male-2', 'male-3'
];

export const FEMALE_VOICE_KEYWORDS = [
  'female', 'امرأة', 'أنثى', 'انثى', 'fatima', 'zariyah', 'layla', 'mariam', 
  'nour', 'zeina', 'salma', 'female-1', 'female-2'
];

/**
 * Speaks an important notification aloud using device default TTS.
 * Guaranteed to operate natively on Android 13 (Samsung Galaxy Note 20 Ultra) and Web.
 */
export async function speakImportantNotification(title: string, body?: string, options?: { force?: boolean }): Promise<void> {
  const settings = getVoiceSettings();

  // If user disabled important notification voice alerts and force is not set, exit
  if (settings.speakImportantNotifications === false && !options?.force) {
    return;
  }

  const rawText = body ? `${title}: ${body}` : title;
  const cleanText = cleanTextForArabicSpeech(rawText);
  if (!cleanText) return;

  // Stop previous audio playback & speech synthesis
  try {
    if (activeTtsAudio) {
      activeTtsAudio.pause();
      activeTtsAudio.currentTime = 0;
      activeTtsAudio = null;
    }
  } catch (e) {}

  // 0. Android Native Interface Bridge (if available in WebView)
  try {
    if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.speakText === 'function') {
      (window as any).AndroidInterface.speakText(cleanText);
      return;
    }
  } catch (e) {}

  // 1. Android Capacitor Native TTS (Android 13 / Samsung Note 20 Ultra)
  if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      await TextToSpeech.stop().catch(() => {});

      let voiceIndex: number | undefined = undefined;
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        if (voices && voices.length > 0) {
          const voiceGender: VoiceGender = settings.voiceGender || 'male';

          if (voiceGender === 'male') {
            const maleIdx = voices.findIndex(v => 
              (v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')) &&
              MALE_VOICE_KEYWORDS.some(kw => v.name?.toLowerCase().includes(kw))
            );
            if (maleIdx >= 0) voiceIndex = maleIdx;
          } else if (voiceGender === 'female') {
            const femIdx = voices.findIndex(v => 
              (v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')) &&
              FEMALE_VOICE_KEYWORDS.some(kw => v.name?.toLowerCase().includes(kw))
            );
            if (femIdx >= 0) voiceIndex = femIdx;
          }

          if (typeof voiceIndex === 'undefined') {
            const anyArIdx = voices.findIndex(v => 
              v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')
            );
            if (anyArIdx >= 0) voiceIndex = anyArIdx;
          }
        }
      } catch (vErr) {}

      const effectivePitch = settings.voiceGender === 'male' ? 0.72 : settings.voiceGender === 'female' ? 1.05 : (settings.pitch || 0.88);
      const effectiveRate = settings.voiceGender === 'male' ? 0.92 : (settings.rate || 0.95);

      await TextToSpeech.speak({
        text: cleanText,
        lang: 'ar-SA',
        voice: voiceIndex,
        rate: effectiveRate,
        pitch: effectivePitch,
        volume: settings.volume || 1.0,
        category: 'ambient',
      });
      return;
    } catch (err) {
      console.warn('Capacitor TextToSpeech fallback to Web Speech:', err);
    }
  }

  // 2. Default Web Speech API (System voice of the device)
  playWebSpeechSynthesisFallback(cleanText, settings);
}

function playWebSpeechSynthesisFallback(cleanText: string, settings: any) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      const effectivePitch = settings.voiceGender === 'male' ? 0.72 : settings.voiceGender === 'female' ? 1.05 : (settings.pitch || 0.88);
      const effectiveRate = settings.voiceGender === 'male' ? 0.92 : (settings.rate || 0.95);

      utterance.rate = effectiveRate;
      utterance.pitch = effectivePitch;
      utterance.volume = settings.volume || 1.0;

      const bestVoice = getBestArabicVoice(settings.voiceGender || 'male', settings.voiceName);
      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang || 'ar-SA';
      }

      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (e) {}
      }, 50);
    } catch (err) {
      console.error('Web Speech Synthesis error:', err);
    }
  }
}

/**
 * Speaks any arbitrary text string aloud.
 */
export async function speakText(text: string, options?: { force?: boolean }): Promise<void> {
  return speakImportantNotification(text, '', options);
}

/**
 * Speaks arbitrary text with custom TTS audio options (rate, pitch, volume)
 */
export async function speakTtsText(
  text: string, 
  customOptions?: { rate?: number; pitch?: number; volume?: number; voiceGender?: VoiceGender }
): Promise<void> {
  const settings = getVoiceSettings();
  const effectiveSettings = {
    ...settings,
    ...(customOptions?.rate !== undefined ? { rate: customOptions.rate } : {}),
    ...(customOptions?.pitch !== undefined ? { pitch: customOptions.pitch } : {}),
    ...(customOptions?.volume !== undefined ? { volume: customOptions.volume } : {}),
    ...(customOptions?.voiceGender !== undefined ? { voiceGender: customOptions.voiceGender } : {}),
  };

  const cleanText = cleanTextForArabicSpeech(text);
  if (!cleanText) return;

  // Stop previous speech
  try {
    if (activeTtsAudio) {
      activeTtsAudio.pause();
      activeTtsAudio.currentTime = 0;
      activeTtsAudio = null;
    }
  } catch (e) {}

  // 0. Android Native Interface Bridge
  try {
    if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.speakText === 'function') {
      (window as any).AndroidInterface.speakText(cleanText);
      return;
    }
  } catch (e) {}

  // 1. Android Capacitor Native TTS (Android 13 / Samsung Note 20 Ultra)
  if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      await TextToSpeech.stop().catch(() => {});

      let voiceIndex: number | undefined = undefined;
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        if (voices && voices.length > 0) {
          const gender = effectiveSettings.voiceGender || 'male';

          if (gender === 'male') {
            const maleIdx = voices.findIndex(v => 
              (v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')) &&
              MALE_VOICE_KEYWORDS.some(kw => v.name?.toLowerCase().includes(kw))
            );
            if (maleIdx >= 0) voiceIndex = maleIdx;
          } else if (gender === 'female') {
            const femIdx = voices.findIndex(v => 
              (v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')) &&
              FEMALE_VOICE_KEYWORDS.some(kw => v.name?.toLowerCase().includes(kw))
            );
            if (femIdx >= 0) voiceIndex = femIdx;
          }

          if (typeof voiceIndex === 'undefined') {
            const anyArIdx = voices.findIndex(v => 
              v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')
            );
            if (anyArIdx >= 0) voiceIndex = anyArIdx;
          }
        }
      } catch (vErr) {}

      const effectivePitch = effectiveSettings.voiceGender === 'male' ? 0.72 : effectiveSettings.voiceGender === 'female' ? 1.05 : (effectiveSettings.pitch || 0.88);
      const effectiveRate = effectiveSettings.voiceGender === 'male' ? 0.92 : (effectiveSettings.rate || 0.95);

      await TextToSpeech.speak({
        text: cleanText,
        lang: 'ar-SA',
        voice: voiceIndex,
        rate: effectiveRate,
        pitch: effectivePitch,
        volume: effectiveSettings.volume || 1.0,
        category: 'ambient',
      });
      return;
    } catch (err) {
      console.warn('Capacitor TextToSpeech failed, trying fallback Web Speech:', err);
    }
  }

  // 2. Default Web Speech API
  playWebSpeechSynthesisFallback(cleanText, effectiveSettings);
}

/**
 * Stops any ongoing text-to-speech.
 */
export async function stopSpeech(): Promise<void> {
  try {
    if (activeTtsAudio) {
      activeTtsAudio.pause();
      activeTtsAudio.currentTime = 0;
      activeTtsAudio = null;
    }
  } catch (e) {}

  try {
    if ((window as any).AndroidInterface && typeof (window as any).AndroidInterface.stopSpeaking === 'function') {
      (window as any).AndroidInterface.stopSpeaking();
    }
  } catch (e) {}

  if (Capacitor.isNativePlatform() || !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      await TextToSpeech.stop();
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

// Global listener for custom events to trigger audio alerts from anywhere
if (typeof window !== 'undefined') {
  window.addEventListener('speak-notification', (e: any) => {
    const { title, body } = e.detail || {};
    if (title || body) {
      speakImportantNotification(title || '', body || '');
    }
  });

  window.addEventListener('speak-text', (e: any) => {
    const { text } = e.detail || {};
    if (text) {
      speakText(text);
    }
  });
}
