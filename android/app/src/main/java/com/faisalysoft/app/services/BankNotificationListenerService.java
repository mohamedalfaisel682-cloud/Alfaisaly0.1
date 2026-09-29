package com.faisalysoft.app.services;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import com.faisalysoft.app.MainActivity;

/**
 * خدمة التنصت على إشعارات البنوك والرسائل المالية الواردة للهاتف.
 * تقوم بقراءة الإشعار وتحليله وتمريره مباشرة إلى واجهة التطبيق والمساعد الصوتي الذكي.
 */
public class BankNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "BankNotifListener";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) {
            return;
        }

        try {
            String packageName = sbn.getPackageName();
            Bundle extras = sbn.getNotification().extras;
            if (extras == null) return;

            CharSequence titleChar = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

            String title = titleChar != null ? titleChar.toString() : "";
            String body = textChar != null ? textChar.toString() : "";
            if (bigTextChar != null && bigTextChar.length() > body.length()) {
                body = bigTextChar.toString();
            }

            if (body.isEmpty() && title.isEmpty()) {
                return;
            }

            Log.d(TAG, "Notification received from " + packageName + " | Title: " + title + " | Body: " + body);

            // تصفية شاملة للاهتمام بالإشعارات المالية (أودع، تحويل، حساب، ريال، حوالة، بنك، كريمي، عمقي، الخ)
            boolean isLikelyFinancial = body.contains("أودع") || 
                                       body.contains("اودع") || 
                                       body.contains("إيداع") || 
                                       body.contains("ايداع") || 
                                       body.contains("تحويل") || 
                                       body.contains("حوالة") || 
                                       body.contains("ريال") || 
                                       body.contains("مبلغ") || 
                                       body.contains("سداد") || 
                                       body.contains("خصم") || 
                                       body.contains("سحب") || 
                                       body.contains("وصلتك") || 
                                       body.contains("SAR") || 
                                       body.contains("USD") || 
                                       body.contains("ر.ي") || 
                                       body.contains("ر.س") || 
                                       title.contains("أودع") ||
                                       title.contains("إيداع") ||
                                       title.contains("تحويل") ||
                                       title.contains("بنك") ||
                                       title.contains("كريمي") ||
                                       title.contains("تضامن") ||
                                       title.contains("عمقي") ||
                                       packageName.toLowerCase().contains("bank") ||
                                       packageName.toLowerCase().contains("kuraimi") ||
                                       packageName.toLowerCase().contains("amqi");

            if (isLikelyFinancial && MainActivity.getInstance() != null) {
                MainActivity.getInstance().dispatchBankNotification(title, body, packageName);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // لا يلزم اتخاذ إجراء عند حذف الإشعار
    }
}
