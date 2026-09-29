package com.faisalysoft.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * النشاط الرئيسي لتطبيق الفيصلي على نظام أندرويد (متوافق مع نوت 20 ألترا / أندرويد 13)
 * يربط بين كاباسيتور والجسر البرمجي AndroidBridge، ويدير الإشعارات المالية المباشرة.
 */
public class MainActivity extends BridgeActivity {

    private static MainActivity instance;
    private AndroidBridge androidBridge;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // تهيئة الجسر البرمجي الأصلي
        androidBridge = new AndroidBridge(this);

        // ربط الجسر البرمجي داخل WebView لكاباسيتور
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.addJavascriptInterface(androidBridge, "AndroidInterface");

                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // تحسين الأداء لشاشة نوت 20 ألترا بتردد 120 هرتز
                webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        // إعادة التأكد من ربط الجسر البرمجي عند العودة للنشاط
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && androidBridge != null) {
                webView.addJavascriptInterface(androidBridge, "AndroidInterface");
            }
        } catch (Exception ignored) {}
    }

    /**
     * تنفيذ كود جافاسكربت بأمان على واجهة التطبيق
     */
    public void evaluateJavascript(final String script) {
        mainHandler.post(() -> {
            try {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.evaluateJavascript(script, null);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    /**
     * إرسال إشعار بنكي أو مالي تم التقاطه من خدمة NotificationListenerService إلى المساعد الذكي في الواجهة
     */
    public void dispatchBankNotification(String title, String body, String packageName) {
        if (title == null) title = "";
        if (body == null) body = "";
        if (packageName == null) packageName = "";

        final String cleanTitle = title.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        final String cleanBody = body.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        final String cleanPkg = packageName.replace("'", "\\'");

        final String js = String.format(
            "try { " +
            "  var _finData = { title: '%s', text: '%s', body: '%s', message: '%s', package: '%s', timestamp: new Date().toISOString() }; " +
            "  window.dispatchEvent(new CustomEvent('bank_notification_received', { detail: _finData })); " +
            "  window.dispatchEvent(new CustomEvent('incoming_notification', { detail: _finData })); " +
            "} catch(e){}",
            cleanTitle, cleanBody, cleanBody, cleanBody, cleanPkg
        );

        evaluateJavascript(js);
    }

    @Override
    public void onDestroy() {
        if (androidBridge != null) {
            androidBridge.onDestroy();
        }
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
