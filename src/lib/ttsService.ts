import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';
import { getVoiceSettings, cleanTextForArabicSpeech, getBestArabicVoice } from './voiceSettings';

/**
 * Speaks an important notification aloud using Web Speech API or Capacitor TextToSpeech for Android.
 * Works seamlessly on Web and Capacitor Android (Android 13 / Samsung Galaxy Note 20 Ultra).
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

  // 1. If running as native Capacitor app (e.g. Android 13 on Samsung Note 20 Ultra)
  if (Capacitor.isNativePlatform()) {
    try {
      // Stop any active speech first
      await TextToSpeech.stop().catch(() => {});

      // Query supported voices on Android to explicitly select Arabic male voice index
      let voiceIndex: number | undefined = undefined;
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        if (voices && voices.length > 0) {
          const maleKeywords = ['male', 'رجل', 'naayf', 'shakir', 'tarik', 'maged', 'salman', 'hamdan', 'ard', 'arb'];
          const maleIdx = voices.findIndex(v => 
            (v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية')) &&
            maleKeywords.some(kw => v.name?.toLowerCase().includes(kw))
          );
          if (maleIdx >= 0) {
            voiceIndex = maleIdx;
          } else {
            const anyArIdx = voices.findIndex(v => v.lang?.toLowerCase().startsWith('ar') || v.name?.toLowerCase().includes('arabic') || v.name?.includes('العربية'));
            if (anyArIdx >= 0) voiceIndex = anyArIdx;
          }
        }
      } catch (vErr) {}

      await TextToSpeech.speak({
        text: cleanText,
        lang: 'ar-SA',
        voice: voiceIndex,
        rate: settings.rate || 0.95,
        pitch: settings.pitch || 0.88,
        volume: settings.volume || 1.0,
        category: 'ambient',
      });
      return;
    } catch (err) {
      console.warn('Capacitor TextToSpeech failed, falling back to Web Speech API:', err);
    }
  }

  // 2. Fallback to Web Speech API (window.speechSynthesis)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel(); // Stop prior speech to avoid queue congestion
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      utterance.rate = settings.rate || 0.95;
      utterance.pitch = settings.pitch || 0.88;
      utterance.volume = settings.volume || 1.0;

      const bestVoice = getBestArabicVoice(settings.voiceName);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      window.speechSynthesis.speak(utterance);
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
 * Stops any ongoing text-to-speech.
 */
export async function stopSpeech(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
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
