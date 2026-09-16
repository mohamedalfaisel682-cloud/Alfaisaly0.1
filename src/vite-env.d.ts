/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

interface Window {
  AndroidInterface?: any;
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  webkitAudioContext?: any;
  AudioContext?: any;
  onSpeechRecognized?: (transcript: string, isFinal?: boolean) => void;
  onSpeechError?: (error: string) => void;
  onFilePicked?: (base64Data: string) => void;
  Capacitor?: any;
}
