import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { startUnifiedSpeechRecognition, stopUnifiedSpeechRecognition, ensureAudioPermission } from '../lib/nativeSpeechService';
import { parseArabicSpeechToNumber } from '../lib/arabicNumberParser';
import { toStandardDigits } from '../lib/arabicDigitsConverter';
import { stopSpeech } from '../lib/ttsService';
import { cn } from '../lib/utils';

export interface VoiceInputButtonProps {
  onResult?: (text: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  isNumeric?: boolean;
  className?: string;
  buttonClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  buttonTitle?: string;
  target?: string;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onResult,
  inputRef,
  isNumeric = false,
  className = '',
  buttonClassName = '',
  size = 'xs',
  title,
  buttonTitle,
  target = 'voice-input',
  disabled = false
}) => {
  const resolvedTitle = title || buttonTitle || (isNumeric ? 'إدخال المبلغ بالصوت' : 'إدخال بالصوت');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const lastSpokenTextRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (cleanupFnRef.current) {
        try { cleanupFnRef.current(); } catch (e) {}
      }
    };
  }, []);

  // Find target input element either from prop or nearby in DOM
  const getTargetInputElement = (): HTMLInputElement | HTMLTextAreaElement | null => {
    if (inputRef && inputRef.current) {
      return inputRef.current;
    }
    if (containerRef.current) {
      // Look in parent container or closest relative container
      const parentContainer = containerRef.current.closest('.relative') || containerRef.current.parentElement;
      if (parentContainer) {
        const found = parentContainer.querySelector('input:not([type="hidden"]), textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (found) return found;
      }
    }
    return null;
  };

  const initialValueRef = useRef<string>('');

  const handleStop = () => {
    if (cleanupFnRef.current) {
      try { cleanupFnRef.current(); } catch (e) {}
      cleanupFnRef.current = null;
    }
    stopUnifiedSpeechRecognition();
    setIsListening(false);
    setIsProcessing(false);
  };

  const handleApplyResult = (rawText: string) => {
    const textToApply = (rawText || lastSpokenTextRef.current || '').trim();
    if (!textToApply) {
      handleStop();
      return;
    }

    let finalValue = textToApply;
    if (isNumeric) {
      finalValue = parseArabicSpeechToNumber(finalValue);
      finalValue = toStandardDigits(finalValue);
    }

    // Clean common Arabic artifact words if present
    finalValue = finalValue.replace(/[\u064B-\u065F\u0670]/g, '').trim();

    // Preserve initial text and append new text to the end
    const initialText = initialValueRef.current || '';
    let combinedValue = finalValue;
    if (!isNumeric && initialText.trim()) {
      combinedValue = `${initialText.trim()}\n${finalValue}`;
    }

    // 1. Update target DOM element directly and dispatch input/change events
    const targetEl = getTargetInputElement();
    if (targetEl) {
      try {
        const proto = targetEl instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(targetEl, combinedValue);
        } else {
          targetEl.value = combinedValue;
        }
      } catch (e) {
        targetEl.value = combinedValue;
      }

      // Dispatch standard input & change events for React state updates
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      targetEl.dispatchEvent(inputEvent);

      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      targetEl.dispatchEvent(changeEvent);

      // Focus back to input
      try {
        targetEl.focus();
        if (targetEl.setSelectionRange) {
          const len = targetEl.value.length;
          targetEl.setSelectionRange(len, len);
        }
      } catch (e) {}
    }

    // 2. Trigger parent callback with combined text or final text
    if (onResult) {
      onResult(combinedValue);
    }

    // 3. Haptic confirmation
    try {
      if (navigator.vibrate) navigator.vibrate([30, 45]);
    } catch (e) {}

    // Cleanup listening state
    handleStop();
    lastSpokenTextRef.current = '';
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // إيقاف أي نطق أو تحويل نص لكلام فوراً عند النقر على الميكروفون
    stopSpeech().catch(() => {});

    if (disabled) return;

    if (isListening) {
      // عند النقر مجدداً على أيقونة الميكروفون: إيقاف الاستماع مع ضمان إيقاف أي نطق صوتي
      if (lastSpokenTextRef.current) {
        handleApplyResult(lastSpokenTextRef.current);
      } else {
        handleStop();
      }
      return;
    }

    // Capture target element initial text to append to it
    const targetEl = getTargetInputElement();
    initialValueRef.current = targetEl?.value || '';

    // Stop any ongoing TTS audio that might clash with microphone
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (e) {}

    // Initial haptic feedback
    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch (e) {}

    setIsListening(true);
    setIsProcessing(false);
    lastSpokenTextRef.current = '';

    try {
      // Ensure microphone permission is granted
      const hasPerm = await ensureAudioPermission();
      if (!hasPerm) {
        setIsListening(false);
        setIsProcessing(false);
        return;
      }

      const cleanup = await startUnifiedSpeechRecognition({
        target: `${target}-${Date.now()}`,
        language: 'ar-SA',
        continuous: false,
        prompt: isNumeric ? 'تحدث بالمبلغ المالي...' : 'تحدث الآن...',
        onStart: () => {
          setIsListening(true);
          setIsProcessing(false);
        },
        onPartialResult: (liveText: string) => {
          if (liveText && liveText.trim()) {
            const cleanLive = liveText.trim();
            lastSpokenTextRef.current = cleanLive;

            // تحويل الصوت فورياً لنص داخل نفس مربع النص المستهدف مباشرة مع الحفاظ على النص السابق
            const el = getTargetInputElement();
            if (el) {
              let displayVal = cleanLive;
              if (isNumeric) {
                displayVal = parseArabicSpeechToNumber(displayVal);
                displayVal = toStandardDigits(displayVal);
              } else if (initialValueRef.current.trim()) {
                displayVal = `${initialValueRef.current.trim()}\n${cleanLive}`;
              }
              try {
                const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (nativeSetter) {
                  nativeSetter.call(el, displayVal);
                } else {
                  el.value = displayVal;
                }
              } catch (e) {
                el.value = displayVal;
              }
              const inputEvt = new Event('input', { bubbles: true });
              el.dispatchEvent(inputEvt);
            }
          }
        },
        onResult: (text: string) => {
          setIsProcessing(true);
          lastSpokenTextRef.current = text;
          handleApplyResult(text);
        },
        onError: (err: string) => {
          console.warn("Voice input recognition error:", err);
          if (lastSpokenTextRef.current) {
            handleApplyResult(lastSpokenTextRef.current);
          } else {
            setIsListening(false);
            setIsProcessing(false);
          }
        },
        onEnd: () => {
          if (lastSpokenTextRef.current) {
            handleApplyResult(lastSpokenTextRef.current);
          } else {
            setIsListening(false);
            setIsProcessing(false);
          }
        }
      });

      cleanupFnRef.current = cleanup;
    } catch (err) {
      console.warn("Failed to start voice input:", err);
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const sizeClasses = {
    xs: 'w-5 h-5 min-w-[20px] min-h-[20px]',
    sm: 'w-6 h-6 min-w-[24px] min-h-[24px]',
    md: 'w-7 h-7 min-w-[28px] min-h-[28px]'
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5'
  };

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center justify-center", className)}>
      <button
        type="button"
        tabIndex={-1}
        onClick={handleStart}
        disabled={disabled}
        title={resolvedTitle}
        className={cn(
          "relative flex items-center justify-center rounded-md transition-all shrink-0 cursor-pointer shadow-2xs outline-none select-none",
          sizeClasses[size],
          isListening 
            ? "bg-red-500 text-white shadow-md shadow-red-500/30 ring-2 ring-red-400 ring-offset-1" 
            : isProcessing
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : isNumeric
                ? "bg-blue-50/80 hover:bg-blue-100 text-blue-600 hover:text-blue-700 border border-blue-200/80"
                : "bg-emerald-50/80 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border border-emerald-200/80",
          buttonClassName
        )}
      >
        {isListening && (
          <>
            <span className="absolute -inset-1 rounded-md bg-red-500/35 animate-ping pointer-events-none" />
            <span className="absolute -inset-2 rounded-md bg-red-500/20 animate-pulse pointer-events-none" />
          </>
        )}
        {isProcessing ? (
          <Loader2 className={cn(iconSizes[size], "animate-spin text-blue-600")} />
        ) : isListening ? (
          <Mic className={cn(iconSizes[size], "text-white animate-bounce relative z-10")} />
        ) : (
          <Mic className={cn(iconSizes[size], isNumeric ? "text-blue-600" : "text-emerald-600")} />
        )}
      </button>
    </div>
  );
};
