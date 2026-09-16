import { getApiUrl } from './nativeService';

export interface SpeechRecognitionOptions {
  target: 'search' | 'assistant' | 'default';
  language?: string;
  prompt?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onPartialResult?: (transcript: string) => void;
  onStart?: () => void;
  onResult: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  onEnd?: () => void;
}

let activeRecognitionInstance: any = null;
let activeMediaRecorder: MediaRecorder | null = null;
let activeAudioStream: MediaStream | null = null;
let activeCleanupFn: (() => void) | null = null;

/**
 * Checks if the direct native Android interface is exposed to the WebView
 */
export function isNativeAndroidInterfaceAvailable(): boolean {
  try {
    return typeof (window as any).AndroidInterface?.startSpeechRecognition === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * Ensures audio / microphone permission is granted without crashing
 */
export async function ensureAudioPermission(): Promise<boolean> {
  // 1. Android Interface Native Permission Check
  try {
    if (typeof (window as any).AndroidInterface?.isAudioPermissionGranted === 'function') {
      const granted = (window as any).AndroidInterface.isAudioPermissionGranted();
      if (!granted && typeof (window as any).AndroidInterface.requestAudioPermission === 'function') {
        (window as any).AndroidInterface.requestAudioPermission();
      }
      return granted;
    }
  } catch (e) {}

  // 2. Capacitor Plugin Permission Check
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      try {
        const status = await SpeechRecognition.checkPermissions();
        if (status.speechRecognition === 'granted') {
          return true;
        }
        const req = await SpeechRecognition.requestPermissions();
        return req.speechRecognition === 'granted';
      } catch (permMethodErr) {
        const has = await (SpeechRecognition as any).hasPermission();
        if (has?.permission) return true;
        const req = await (SpeechRecognition as any).requestPermission();
        return !!req?.permission;
      }
    } catch (e) {
      console.warn("Capacitor SpeechRecognition checkPermissions error:", e);
    }
  }

  // 3. Web Permissions API Check (Safe check that does not lock or kill audio tracks)
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).permissions && (navigator as any).permissions.query) {
      const perm = await (navigator as any).permissions.query({ name: 'microphone' });
      if (perm && perm.state === 'denied') {
        return false;
      }
    }
  } catch (e) {}

  return true;
}

/**
 * Safely stop any text-to-speech audio that might conflict with microphone input on Android
 */
export async function stopAnyOngoingTTS(): Promise<void> {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {}

  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const tts = await import('@capacitor-community/text-to-speech');
      await tts.TextToSpeech.stop();
    }
  } catch (e) {}
}

/**
 * MediaRecorder + Server Gemini AI transcription fallback
 * High-accuracy Arabic speech recognition with active Voice Activity Detection (VAD)
 */
export async function startMediaRecorderFallback(
  options: SpeechRecognitionOptions,
  target: 'search' | 'assistant' | 'default' = 'default'
): Promise<() => void> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined') {
    options.onError?.('الميكروفون غير متوفر في هذا النظام.');
    options.onEnd?.();
    return () => {};
  }

  let hasHandled = false;
  let audioContext: AudioContext | null = null;
  let silenceTimer: any = null;
  let maxDurationTimer: any = null;
  let hasDetectedSpeech = false;
  let animationFrameId: number | null = null;

  try {
    // Request clean audio stream with noise suppression and echo cancellation
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    activeAudioStream = stream;
    options.onStart?.();

    // Determine the most compatible MIME type for mobile and desktop
    let mimeType = 'audio/webm';
    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    activeMediaRecorder = mediaRecorder;
    const audioChunks: Blob[] = [];

    // Real-Time Voice Activity Detection (VAD) using Web Audio AnalyserNode
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioContext = new AudioCtxClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!activeMediaRecorder || activeMediaRecorder.state !== 'recording') return;
          analyser.getByteFrequencyData(dataArray);

          let total = 0;
          for (let i = 0; i < bufferLength; i++) {
            total += dataArray[i];
          }
          const volume = total / bufferLength;

          // Sound detected above background noise threshold (optimized for Samsung Note 20 Ultra: 4.5)
          if (volume > 4.5) {
            hasDetectedSpeech = true;
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else if (hasDetectedSpeech && !silenceTimer) {
            // After user has spoken, 1.3 seconds of natural silence commits audio
            silenceTimer = setTimeout(() => {
              if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
                try { activeMediaRecorder.stop(); } catch (e) {}
              }
            }, 1300);
          }

          animationFrameId = requestAnimationFrame(checkVolume);
        };

        animationFrameId = requestAnimationFrame(checkVolume);
      }
    } catch (vadErr) {
      console.warn("AudioContext VAD initialization warning:", vadErr);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (e) {}
      }
      stream.getTracks().forEach(t => t.stop());
      activeAudioStream = null;
      activeMediaRecorder = null;

      if (audioChunks.length === 0) {
        options.onEnd?.();
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      // Lowered minimum size check to accommodate short queries (e.g. "سامسونج" or "علي")
      if (audioBlob.size < 150) {
        options.onError?.('لم يتم التقاط صوت واضح. يرجى التحدث بوضوح للميكروفون.');
        options.onEnd?.();
        return;
      }

      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string)?.split(',')[1];
          if (!base64Data) {
            options.onError?.('فشل تجهيز الصوت للإرسال.');
            options.onEnd?.();
            return;
          }

          try {
            const targetUrl = getApiUrl('/api/assistant/transcribe');
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64Data, mimeType })
            });

            if (res.ok) {
              const data = await res.json();
              const transcript = (data.transcript || '').trim();
              if (transcript && !hasHandled) {
                hasHandled = true;
                try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
                options.onResult(transcript);
              } else {
                options.onError?.('لم يتم تمييز أي كلمات واضحة.');
              }
            } else {
              options.onError?.('تعذر إتمام التحويل الصوتي عبر الذكاء الاصطناعي.');
            }
          } catch (netErr) {
            console.warn("Transcribe network error:", netErr);
            options.onError?.('خطأ في الاتصال بخدمة التحويل الصوتي.');
          }
          options.onEnd?.();
        };
      } catch (convErr) {
        options.onError?.('فشل معالجة المقطع الصوتي.');
        options.onEnd?.();
      }
    };

    mediaRecorder.start(250);

    // Maximum recording window: 7 seconds if no manual stop occurred
    maxDurationTimer = setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        try { mediaRecorder.stop(); } catch (e) {}
      }
    }, 7000);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (maxDurationTimer) clearTimeout(maxDurationTimer);
      if (mediaRecorder.state === 'recording') {
        try { mediaRecorder.stop(); } catch (e) {}
      }
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (e) {}
      }
      stream.getTracks().forEach(t => t.stop());
      activeAudioStream = null;
      activeMediaRecorder = null;
    };
  } catch (recorderErr) {
    console.error("MediaRecorder fallback failed:", recorderErr);
    options.onError?.('تعذر الوصول للميكروفون. يرجى التأكد من منحه الإذن.');
    options.onEnd?.();
    return () => {};
  }
}

/**
 * Start Unified Voice Recognition with multi-layer fallback tailored for Android 13 APK
 */
export async function startUnifiedSpeechRecognition(options: SpeechRecognitionOptions): Promise<() => void> {
  stopUnifiedSpeechRecognition();
  await stopAnyOngoingTTS();

  const target = options.target || 'default';
  const lang = options.language || 'ar-SA';
  let hasHandledResult = false;

  // Haptic feedback on mobile if supported
  try {
    if (navigator.vibrate) {
      navigator.vibrate(35);
    }
  } catch (e) {}

  // Ensure microphone permission is granted across Web and Android
  try {
    await ensureAudioPermission();
  } catch (e) {}

  // =========================================================================
  // Layer 1: Native Android Bridge (Highest priority for Android 13 APK with MainActivity)
  // =========================================================================
  if (isNativeAndroidInterfaceAvailable()) {
    try {
      // Check audio permission first
      if (typeof (window as any).AndroidInterface?.isAudioPermissionGranted === 'function') {
        const isGranted = (window as any).AndroidInterface.isAudioPermissionGranted();
        if (!isGranted) {
          if (typeof (window as any).AndroidInterface.requestAudioPermission === 'function') {
            (window as any).AndroidInterface.requestAudioPermission();
          }
          options.onError?.('يرجى منح إذن الميكروفون عند ظهور الطلب ثم إعادة المحاولة.');
          options.onEnd?.();
          return () => {};
        }
      }

      options.onStart?.();

      const onSpeechResult = (e: any) => {
        const detail = e.detail || {};
        const eventTarget = detail.target || 'default';
        if (eventTarget === target || eventTarget === 'default') {
          cleanup();
          const text = detail.text || '';
          if (text && !hasHandledResult) {
            hasHandledResult = true;
            try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
            options.onResult(text);
          }
          options.onEnd?.();
        }
      };

      const onSpeechCancel = async (e: any) => {
        const detail = e.detail || {};
        const eventTarget = detail.target || 'default';
        if (eventTarget === target || eventTarget === 'default') {
          cleanup();
          const errReason = String(detail.error || '');
          
          // Check if error is 12 (ERROR_LANGUAGE_NOT_SUPPORTED) or language engine missing on Android 13
          const isError12 = errReason === '12' || errReason.includes('12') || errReason.toLowerCase().includes('language') || errReason === 'service_not_installed';
          
          if (isError12) {
            console.log("Android 13 error 12 / speech engine language issue detected, activating MediaRecorder fallback seamlessly...");
            try {
              const fallbackCleanup = await startMediaRecorderFallback(options, target);
              activeCleanupFn = fallbackCleanup;
              return;
            } catch (fbErr) {
              console.warn("MediaRecorder fallback failed:", fbErr);
            }
          }

          if (errReason === 'permission_denied') {
            options.onError?.('إذن الميكروفون مطلوب للتعرف الصوتي.');
          } else if (errReason !== 'cancelled' && errReason !== 'no_match' && errReason !== '12') {
            // Attempt MediaRecorder before showing any error
            try {
              const fallbackCleanup = await startMediaRecorderFallback(options, target);
              activeCleanupFn = fallbackCleanup;
              return;
            } catch (err) {}
            options.onError?.(errReason);
          }
          options.onEnd?.();
        }
      };

      const onSpeechStart = (e: any) => {
        const detail = e.detail || {};
        const eventTarget = detail.target || 'default';
        if (eventTarget === target || eventTarget === 'default') {
          options.onStart?.();
        }
      };

      const cleanup = () => {
        window.removeEventListener('native_speech_result', onSpeechResult);
        window.removeEventListener('native_speech_cancel', onSpeechCancel);
        window.removeEventListener('native_speech_start', onSpeechStart);
        activeCleanupFn = null;
      };

      window.addEventListener('native_speech_result', onSpeechResult);
      window.addEventListener('native_speech_cancel', onSpeechCancel);
      window.addEventListener('native_speech_start', onSpeechStart);

      activeCleanupFn = cleanup;

      // Provide legacy direct window callback as secondary hook
      const prevCallback = (window as any).onSpeechRecognized;
      (window as any).onSpeechRecognized = (text: string, callbackTarget?: string) => {
        if (!callbackTarget || callbackTarget === target || callbackTarget === 'default') {
          cleanup();
          if (prevCallback) (window as any).onSpeechRecognized = prevCallback;
          if (text && !hasHandledResult) {
            hasHandledResult = true;
            try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
            options.onResult(text);
          }
          options.onEnd?.();
        }
      };

      // Call AndroidInterface safely
      (window as any).AndroidInterface.startSpeechRecognition(target);

      return () => {
        cleanup();
        try {
          (window as any).AndroidInterface.stopSpeechRecognition();
        } catch (e) {}
      };
    } catch (err) {
      console.warn("AndroidInterface call failed, trying next layer:", err);
    }
  }

  // =========================================================================
  // Layer 2: Capacitor Community Speech Recognition Plugin (Safe Execution)
  // =========================================================================
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

      // Check and request permission safely BEFORE calling start
      let isPermissionGranted = false;
      try {
        const status = await SpeechRecognition.checkPermissions();
        if (status?.speechRecognition === 'granted') {
          isPermissionGranted = true;
        } else {
          const req = await SpeechRecognition.requestPermissions();
          isPermissionGranted = req?.speechRecognition === 'granted';
        }
      } catch (permErr) {
        try {
          const has = await (SpeechRecognition as any).hasPermission();
          if (has?.permission) {
            isPermissionGranted = true;
          } else {
            const req = await (SpeechRecognition as any).requestPermission();
            isPermissionGranted = !!req?.permission;
          }
        } catch (e2) {}
      }

      if (!isPermissionGranted) {
        options.onError?.('يلزم تفعيل إذن الميكروفون للتحدث الصوتي.');
        options.onEnd?.();
        return () => {};
      }

      let isAvailable = false;
      try {
        const checkAvail = await SpeechRecognition.available();
        isAvailable = typeof checkAvail === 'boolean' ? checkAvail : !!checkAvail?.available;
      } catch (e) {
        isAvailable = true;
      }

      if (isAvailable) {
        options.onStart?.();
        let partialListener: any = null;
        let listeningStateListener: any = null;
        let latestSpokenText = '';

        try {
          partialListener = await SpeechRecognition.addListener('partialResults', (data: any) => {
            if (data?.matches && data.matches.length > 0) {
              const liveText = data.matches[0].trim();
              if (liveText) {
                latestSpokenText = liveText;
                options.onPartialResult?.(liveText);
              }
            }
          });
        } catch (e) {}

        try {
          listeningStateListener = await SpeechRecognition.addListener('listeningState', (data: any) => {
            if (data?.status === 'stopped') {
              if (latestSpokenText && !hasHandledResult) {
                hasHandledResult = true;
                try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
                options.onResult(latestSpokenText);
              }
              options.onEnd?.();
            }
          });
        } catch (e) {}

        const cleanup = () => {
          try { partialListener?.remove?.(); } catch (e) {}
          try { listeningStateListener?.remove?.(); } catch (e) {}
          try { SpeechRecognition.stop(); } catch (e) {}
        };
        activeCleanupFn = cleanup;

        try {
          // For search target, run seamlessly in the background (popup: false) without system dialog
          const preferNoPopup = target === 'search';
          const res = await SpeechRecognition.start({
            language: lang,
            maxResults: 1,
            prompt: options.prompt || (target === 'search' ? 'تحدث للبحث في المهام والعملاء...' : 'مساعد الفيصلي يستمع لك الآن...'),
            partialResults: true,
            popup: !preferNoPopup,
          });

          if (res && res.matches && res.matches.length > 0) {
            const text = res.matches[0].trim();
            if (text && !hasHandledResult) {
              hasHandledResult = true;
              try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
              options.onResult(text);
            }
          }
          options.onEnd?.();
          return cleanup;
        } catch (startErr: any) {
          console.warn("Capacitor SpeechRecognition initial mode failed, trying alternative mode:", startErr);
          try {
            const fallbackRes = await SpeechRecognition.start({
              language: lang,
              maxResults: 1,
              prompt: options.prompt || 'تحدث الآن...',
              partialResults: true,
              popup: target === 'search' ? true : false,
            });
            if (fallbackRes && fallbackRes.matches && fallbackRes.matches.length > 0) {
              const text = fallbackRes.matches[0].trim();
              if (text && !hasHandledResult) {
                hasHandledResult = true;
                try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
                options.onResult(text);
              }
            }
            options.onEnd?.();
            return cleanup;
          } catch (bgErr) {
            console.warn("Capacitor SpeechRecognition fallback mode failed, switching to MediaRecorder fallback:", bgErr);
            try {
              const fb = await startMediaRecorderFallback(options, target);
              activeCleanupFn = fb;
              return fb;
            } catch (e) {
              options.onError?.('تعذر تشغيل التعرف الصوتي الأصلي، تأكد من إعدادات الإدخال الصوتي بالهاتف.');
              options.onEnd?.();
              return cleanup;
            }
          }
        }
      }
    } catch (pluginErr: any) {
      console.warn("Capacitor SpeechRecognition plugin error, switching to MediaRecorder fallback:", pluginErr);
      try {
        const fb = await startMediaRecorderFallback(options, target);
        activeCleanupFn = fb;
        return fb;
      } catch (e) {}
    }
    // If we are in Capacitor native platform, we MUST return here and not clash with Web Speech
    return () => {};
  }

  // =========================================================================
  // Layer 3: Web Speech API (Browsers & Android WebViews)
  // =========================================================================
  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (SpeechRecognitionAPI) {
    try {
      const recognition = new SpeechRecognitionAPI();
      activeRecognitionInstance = recognition;

      recognition.lang = lang;
      recognition.interimResults = options.interimResults ?? true;
      recognition.continuous = options.continuous ?? false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        options.onStart?.();
      };

      let latestCapturedText = '';

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalText += trans;
          } else {
            interimText += trans;
          }
        }

        const currentStream = (finalText || interimText).trim();
        if (currentStream) {
          latestCapturedText = currentStream;
          if (options.onPartialResult) {
            options.onPartialResult(currentStream);
          }
        }

        const clean = finalText.trim();
        if (clean && !hasHandledResult) {
          hasHandledResult = true;
          try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
          options.onResult(clean);
        }
      };

      recognition.onerror = async (event: any) => {
        const error = event.error;
        if (error === 'no-speech') {
          // If no speech was caught by Web Speech API in WebView, seamlessly fallback to AI MediaRecorder
          if (!hasHandledResult) {
            try {
              const fb = await startMediaRecorderFallback(options, target);
              activeCleanupFn = fb;
              return;
            } catch (e) {}
          }
          if (options.target === 'assistant') {
            options.onError?.('no-speech');
            return;
          }
          options.onEnd?.();
          return;
        }
        if (error === 'aborted') {
          options.onEnd?.();
          return;
        }
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          options.onError?.('تم رفض إذن الميكروفون. يرجى تفعيله من إعدادات الهاتف.');
          options.onEnd?.();
        } else {
          // Switch to MediaRecorder
          try {
            const fb = await startMediaRecorderFallback(options, target);
            activeCleanupFn = fb;
            return;
          } catch (e) {
            options.onError?.(`خطأ في التعرف الصوتي (${error}).`);
            options.onEnd?.();
          }
        }
      };

      recognition.onend = () => {
        if (!hasHandledResult && latestCapturedText) {
          hasHandledResult = true;
          try { if (navigator.vibrate) navigator.vibrate([30, 40]); } catch (e) {}
          options.onResult(latestCapturedText);
        }
        options.onEnd?.();
        activeRecognitionInstance = null;
      };

      recognition.start();

      return () => {
        try { recognition.stop(); } catch (e) {}
        activeRecognitionInstance = null;
      };
    } catch (err: any) {
      console.warn("Web SpeechRecognition start failed, trying MediaRecorder fallback:", err);
    }
  }

  // =========================================================================
  // Layer 4: MediaRecorder + Server-side AI Transcription Fallback
  // =========================================================================
  return startMediaRecorderFallback(options, target);
}

/**
 * Stop any currently active speech recognition session
 */
export function stopUnifiedSpeechRecognition(): void {
  if (activeCleanupFn) {
    activeCleanupFn();
    activeCleanupFn = null;
  }

  if (isNativeAndroidInterfaceAvailable()) {
    try {
      (window as any).AndroidInterface.stopSpeechRecognition();
    } catch (e) {}
  }

  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.stop();
    } catch (e) {}
    activeRecognitionInstance = null;
  }

  if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
    try {
      activeMediaRecorder.stop();
    } catch (e) {}
    activeMediaRecorder = null;
  }

  if (activeAudioStream) {
    try {
      activeAudioStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    activeAudioStream = null;
  }
}