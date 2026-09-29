package com.faisalysoft.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import android.provider.Settings;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

/**
 * الجسر البرمجي بين واجهة جافاسكربت ونظام أندرويد (Note 20 Ultra / Android 13)
 * يزود التطبيق بكافة الصلاحيات والوظائف المتقدمة: تحويل النص لكلام، التعرف على الصوت،
 * حفظ ومشاركة التقارير، الاتصال بالعملاء، الطباعة، ونسخ البيانات إلى Google Drive.
 */
public class AndroidBridge {

    private static final String TAG = "AndroidBridge";
    private final MainActivity activity;
    private final Handler mainHandler;
    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;
    private SpeechRecognizer speechRecognizer;

    public AndroidBridge(MainActivity activity) {
        this.activity = activity;
        this.mainHandler = new Handler(Looper.getMainLooper());
        initTTS();
    }

    private void initTTS() {
        try {
            textToSpeech = new TextToSpeech(activity.getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    int result = textToSpeech.setLanguage(new Locale("ar"));
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        textToSpeech.setLanguage(Locale.getDefault());
                    }
                    isTtsInitialized = true;
                    Log.d(TAG, "TTS Initialized successfully for Arabic");
                } else {
                    Log.e(TAG, "TTS Initialization failed with code: " + status);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error initializing TTS", e);
        }
    }

    @JavascriptInterface
    public void speakText(final String text) {
        if (text == null || text.trim().isEmpty()) return;
        mainHandler.post(() -> {
            try {
                if (textToSpeech != null && isTtsInitialized) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "UtteranceId_" + System.currentTimeMillis());
                    } else {
                        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in speakText", e);
            }
        });
    }

    @JavascriptInterface
    public boolean isAudioPermissionGranted() {
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public void requestAudioPermission() {
        mainHandler.post(() -> {
            try {
                ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.RECORD_AUDIO}, 2001);
            } catch (Exception e) {
                Log.e(TAG, "Error requesting audio permission", e);
            }
        });
    }

    @JavascriptInterface
    public boolean isSmsPermissionGranted() {
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED &&
               ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public boolean isNotificationPermissionGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @JavascriptInterface
    public boolean isNotificationListenerEnabled() {
        try {
            return NotificationManagerCompat.getEnabledListenerPackages(activity).contains(activity.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void openNotificationListenerSettings() {
        mainHandler.post(() -> {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                } else {
                    intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                }
                activity.startActivity(intent);
                Toast.makeText(activity, "يرجى تفعيل إذن الوصول للإشعارات لتطبيق الفيصلي", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Log.e(TAG, "Error opening notification listener settings", e);
                Toast.makeText(activity, "تعذر فتح إعدادات الإشعارات تلقائياً", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void requestNotificationAndSmsPermissions() {
        mainHandler.post(() -> {
            try {
                ArrayList<String> permissions = new ArrayList<>();
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
                    permissions.add(Manifest.permission.RECEIVE_SMS);
                }
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                    permissions.add(Manifest.permission.READ_SMS);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        permissions.add(Manifest.permission.POST_NOTIFICATIONS);
                    }
                }

                if (!permissions.isEmpty()) {
                    ActivityCompat.requestPermissions(activity, permissions.toArray(new String[0]), 2002);
                }

                if (!isNotificationListenerEnabled()) {
                    openNotificationListenerSettings();
                } else {
                    Toast.makeText(activity, "صلاحيات الوصول للإشعارات والرسائل مفعلة", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error requesting notification and SMS permissions", e);
            }
        });
    }

    @JavascriptInterface
    public void startSpeechRecognition(final String target) {
        startSpeechRecognition(target, "auto");
    }

    @JavascriptInterface
    public void startSpeechRecognition(final String target, final String provider) {
        mainHandler.post(() -> {
            try {
                if (!isAudioPermissionGranted()) {
                    requestAudioPermission();
                    return;
                }

                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.cancel();
                        speechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    speechRecognizer = null;
                }

                if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
                    Log.w(TAG, "SpeechRecognizer isRecognitionAvailable returned false");
                    activity.evaluateJavascript("window.dispatchEvent(new CustomEvent('speech_recognition_error', { detail: { code: 9, target: '" + (target != null ? target.replace("'", "\\'") : "") + "' } }));");
                    return;
                }

                boolean isLocalMode = "assistant_local".equals(target) || "local".equalsIgnoreCase(provider);

                if (isLocalMode && Build.VERSION.SDK_INT >= 31) {
                    try {
                        if (SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)) {
                            Log.d(TAG, "Creating On-Device SpeechRecognizer for Local Assistant");
                            speechRecognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
                        } else {
                            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);
                        }
                    } catch (Throwable t) {
                        Log.w(TAG, "On-device recognizer init failed, falling back to standard recognizer", t);
                        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);
                    }
                } else {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);
                }

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar");
                intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "ar");
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.getPackageName());
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);

                if (isLocalMode) {
                    intent.putExtra("android.speech.extra.PREFER_OFFLINE", true);
                    intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1100L);
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1100L);
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 900L);
                }

                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        String cleanTarget = target != null ? target.replace("'", "\\'") : "";
                        String js = "window.dispatchEvent(new CustomEvent('native_speech_ready'));" +
                                    "window.dispatchEvent(new CustomEvent('native_speech_start', { detail: { target: '" + cleanTarget + "' } }));";
                        activity.evaluateJavascript(js);
                    }

                    @Override
                    public void onBeginningOfSpeech() {}

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {}

                    @Override
                    public void onError(int error) {
                        Log.w(TAG, "SpeechRecognizer error code: " + error);
                        String cleanTarget = target != null ? target.replace("'", "\\'") : "";
                        String js = String.format(
                            "window.dispatchEvent(new CustomEvent('speech_recognition_error', { detail: { code: %d, target: '%s' } }));" +
                            "window.dispatchEvent(new CustomEvent('native_speech_cancel', { detail: { error: '%d', target: '%s' } }));",
                            error, cleanTarget, error, cleanTarget
                        );
                        activity.evaluateJavascript(js);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String spokenText = matches.get(0).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").trim();
                            String cleanTarget = target != null ? target.replace("'", "\\'") : "";
                            String js = String.format(
                                "window.dispatchEvent(new CustomEvent('speech_recognition_result', { detail: { text: '%s', target: '%s' } }));" +
                                "window.dispatchEvent(new CustomEvent('native_speech_result', { detail: { text: '%s', target: '%s' } }));" +
                                "if(typeof window.onSpeechRecognized === 'function') { window.onSpeechRecognized('%s', '%s'); }",
                                spokenText, cleanTarget, spokenText, cleanTarget, spokenText, cleanTarget
                            );
                            activity.evaluateJavascript(js);
                        }
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty()) {
                            String partialText = matches.get(0).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").trim();
                            String cleanTarget = target != null ? target.replace("'", "\\'") : "";
                            String js = String.format(
                                "window.dispatchEvent(new CustomEvent('speech_recognition_partial', { detail: { text: '%s', target: '%s' } }));" +
                                "window.dispatchEvent(new CustomEvent('native_speech_partial', { detail: { text: '%s', target: '%s' } }));",
                                partialText, cleanTarget, partialText, cleanTarget
                            );
                            activity.evaluateJavascript(js);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                speechRecognizer.startListening(intent);
            } catch (Exception e) {
                Log.e(TAG, "Error starting speech recognition", e);
            }
        });
    }

    @JavascriptInterface
    public void stopSpeechRecognition() {
        mainHandler.post(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error stopping speech recognition", e);
            }
        });
    }

    @JavascriptInterface
    public void cancelSpeechRecognition() {
        mainHandler.post(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.cancel();
                    speechRecognizer.destroy();
                    speechRecognizer = null;
                }
            } catch (Exception e) {
                Log.e(TAG, "Error cancelling speech recognition", e);
            }
        });
    }

    @JavascriptInterface
    public void phoneCall(final String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) return;
        mainHandler.post(() -> {
            try {
                String cleanNumber = phoneNumber.replaceAll("[^0-9+*#]", "");
                Intent callIntent;
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                    callIntent = new Intent(Intent.ACTION_CALL, Uri.parse("tel:" + cleanNumber));
                } else {
                    callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + cleanNumber));
                }
                activity.startActivity(callIntent);
            } catch (Exception e) {
                Log.e(TAG, "Error making phone call", e);
                // Fallback to DIAL
                try {
                    Intent dialIntent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phoneNumber));
                    activity.startActivity(dialIntent);
                } catch (Exception ex) {
                    Toast.makeText(activity, "تعذر فتح تطبيق الاتصال", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    @JavascriptInterface
    public void openExternalUrl(final String url) {
        if (url == null || url.trim().isEmpty()) return;
        mainHandler.post(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "Error opening external URL", e);
            }
        });
    }

    @JavascriptInterface
    public void print() {
        mainHandler.post(() -> {
            try {
                WebView webView = activity.getBridge() != null ? activity.getBridge().getWebView() : null;
                if (webView != null) {
                    PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter printAdapter = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
                            ? webView.createPrintDocumentAdapter("وثيقة_الفيصلي")
                            : webView.createPrintDocumentAdapter();
                    printManager.print("طباعة تقرير الفيصلي", printAdapter, new PrintAttributes.Builder().build());
                }
            } catch (Exception e) {
                Log.e(TAG, "Error executing print", e);
                Toast.makeText(activity, "تعذر تشغيل خدمة الطباعة", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void saveFile(final String base64Data, final String fileName) {
        mainHandler.post(() -> {
            try {
                byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) downloadsDir.mkdirs();

                File targetFile = new File(downloadsDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(decodedBytes);
                    fos.flush();
                }

                Toast.makeText(activity, "تم حفظ الملف بنجاح في مجلد التنزيلات:\n" + fileName, Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Log.e(TAG, "Error saving file", e);
                Toast.makeText(activity, "فشل حفظ الملف: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void saveImage(final String base64Data, final String fileName) {
        saveFile(base64Data, fileName);
    }

    @JavascriptInterface
    public void saveFileAndShare(final String base64Data, final String fileName) {
        mainHandler.post(() -> {
            try {
                byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
                File cacheDir = new File(activity.getCacheDir(), "shared_files");
                if (!cacheDir.exists()) cacheDir.mkdirs();

                File shareFile = new File(cacheDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                    fos.write(decodedBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        shareFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(getMimeType(fileName));
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                activity.startActivity(Intent.createChooser(shareIntent, "مشاركة " + fileName));
            } catch (Exception e) {
                Log.e(TAG, "Error sharing file", e);
                Toast.makeText(activity, "تعذر مشاركة الملف", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void shareFile(final String base64Data, final String fileName) {
        saveFileAndShare(base64Data, fileName);
    }

    @JavascriptInterface
    public void backupToGoogleDriveDirect(final String base64Data, final String fileName) {
        saveFileAndShare(base64Data, fileName);
    }

    @JavascriptInterface
    public void saveToDrive(final String base64Data, final String fileName) {
        saveFileAndShare(base64Data, fileName);
    }

    private String getMimeType(String fileName) {
        if (fileName == null) return "*/*";
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".csv")) return "text/csv";
        return "*/*";
    }

    public void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
    }
}
